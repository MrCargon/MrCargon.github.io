// Earth.js - Day/night city-lights shader + San Francisco marker + explore layers.
// Extends Planet. Overrides init() to build a custom ShaderMaterial so the dark
// hemisphere shows city lights instead of pure black, and adds the explore-mode
// overlays (graticule, borders, live ISS/quakes/places, country hover).
//
// MERGE NOTE: this file grafts the roaster-hardened globe work from the pre-Vite
// build onto the Vite migration. It PRESERVES the Vite time-sync behaviour:
// update(deltaTime, j2000Days) drives rotation from rotationPeriodHours and
// orbital position from OrbitalCalculator, and the moon is J2000-synced. Texture
// keys follow the Vite SolarSystem config (data.nightLightsPath, etc.).
// global THREE, three.js r128, classic script (no modules).
class Earth extends Planet {
    constructor(scene, resourceLoader, data) {
        super(scene, resourceLoader, data);

        // NASA Rule 5: validate dependencies.
        console.assert(scene && resourceLoader && data,
            'Earth.constructor: missing required dependencies');
        console.assert(data && data.radius > 0, 'Earth.constructor: bad radius');

        this.moonData = {
            radius: 0.5,
            distance: 5,
            rotationSpeed: 0.02,
            orbitSpeed: 0.05,
            texturePath: 'src/assets/textures/planets/earth/moon/moon_map.jpg',
            bumpMapPath: 'src/assets/textures/planets/earth/moon/moon_bump.jpg'
        };
        // Vite config exposes the night map as nightLightsPath; keep a fallback.
        this.nightTexturePath = (data && data.nightLightsPath)
            || 'src/assets/textures/planets/earth/earth_night.jpg';

        // San Francisco (lat, lng). Marker is parented to this.mesh.
        this.markerCoords = { lat: 37.7749, lng: -122.4194 };
        this.marker = null;
        this.markerHalo = null;
        this.markerPulse = 0;

        // Reduced-motion + per-frame scratch vectors (Rule: no per-frame alloc).
        // FIX 4: cache the value but keep it live by listening for OS toggles so the
        // marker pulse reacts mid-session instead of being frozen at construct time.
        this.reducedMotion = Earth.prefersReducedMotion();
        this._reducedMotionMq = (typeof window !== 'undefined' && window.matchMedia)
            ? window.matchMedia('(prefers-reduced-motion: reduce)')
            : null;
        this._onReducedMotionChange = (e) => { this.reducedMotion = !!e.matches; };
        if (this._reducedMotionMq) {
            if (this._reducedMotionMq.addEventListener) {
                this._reducedMotionMq.addEventListener('change', this._onReducedMotionChange);
            } else if (this._reducedMotionMq.addListener) {
                // Legacy Safari / older browsers.
                this._reducedMotionMq.addListener(this._onReducedMotionChange);
            }
        }
        this._sunDir = new THREE.Vector3(1, 0, 0);
        this._worldPos = new THREE.Vector3();

        this.atmosphereMesh = null;
        this.cloudsMesh = null;
        // Orbit state (also set in buildSurface; Planet.updatePosition reads .angle).
        this.orbit = { angle: Math.random() * Math.PI * 2 };

        // Explore-mode state. When frozen, update() skips rotation/orbit so the
        // globe stops moving and the SF marker stays put for inspection.
        this.frozen = false;
        // Lazily-built explore overlays (one draw call each, children of mesh).
        this.graticule = null;
        this.borders = null;
        this._bordersRequested = false;

        // Live keyless data layers (children of this.mesh so they track the globe).
        this.layers = { iss: null, quakes: null, pois: null };
        this._issTimer = null;
        this.pickables = [];          // meshes the raycaster can click for a detail card

        // Country hover: point-in-polygon hit-test + glowing outline + name.
        this.countryShapes = null;
        this.countryHighlight = null;
        this._hoverCountry = null;

        // Cascade hover: named-polygon tiers (country→state→county→district→zip),
        // lazily loaded from src/assets/geo/*. Each entry is [{name, rings}]. Missing
        // tier files are skipped so deeper tiers light up when their data lands.
        this.regionTiers = {};
        this.regionHighlight = null;
        this._hoverRegionKey = null;

        // Zoom level-of-detail geography (states/cities/districts), revealed by
        // camera distance in explore mode. Created in init() once mesh exists.
        this.geoLOD = null;
        // High-zoom OpenStreetMap street tiles projected on the globe (lazy).
        this.streetTiles = null;
        // Keyless Esri satellite imagery draped as textured patches (lazy).
        this.satelliteTiles = null;
        // Five named atmospheric shells (Troposphere→Exosphere) w/ cascade animation.
        this.atmosphereLayers = null;
    }

    // NASA Rule 5: pure helper, 2 asserts.
    static prefersReducedMotion() {
        console.assert(typeof window !== 'undefined', 'Earth: window required');
        const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
        console.assert(mq === undefined || typeof mq === 'object', 'Earth: bad matchMedia');
        return !!(mq && mq.matches);
    }

    // X1: does this device support GLSL standard derivatives (dFdx/dFdy)? WebGL2
    // has them as core; WebGL1 needs OES_standard_derivatives (often absent on
    // older iOS Safari). Picks the bump-capable vs flat shader variant.
    static _derivativesSupported() {
        try {
            if (typeof document === 'undefined') return false;
            const c = document.createElement('canvas');
            if (c.getContext('webgl2')) return true;
            const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
            return !!(gl && gl.getExtension('OES_standard_derivatives'));
        } catch (e) {
            return false;
        }
    }

    async init() {
        console.assert(this.scene && this.resourceLoader, 'Earth.init: deps missing');
        console.assert(this.data.texturePath, 'Earth.init: day texture path missing');

        // FIX B: wrap the happy path in try/catch to match the base Planet.init
        // contract (returns false on failure). SolarSystem.createPlanets awaits
        // planet.init() with no per-planet guard, so an unguarded throw from
        // buildSurface/createMoon/createAtmosphere/createMarker would reject the
        // whole SolarSystem.init() and kill the entire simulation.
        try {
            const dayMap = await this.resourceLoader.loadTexture(this.data.texturePath);
            let nightMap = null;
            try {
                nightMap = await this.resourceLoader.loadTexture(this.nightTexturePath);
            } catch (err) {
                console.error('Earth.init: night texture failed to load:', err);
            }
            if (!dayMap) {
                console.error('Earth.init: day texture missing, falling back to Planet');
                const ok = await super.init();
                return ok;
            }
            if (!nightMap) {
                console.error('Earth.init: no night map - dark side will use day map + floor');
            }

            await this.buildSurface(dayMap, nightMap);
            await this.createMoon();
            this.createAtmosphere();
            this.createMarker();
            // Zoom-LOD geography overlays (lazy; safe no-op if GeoLOD absent).
            this.geoLOD = (typeof GeoLOD !== 'undefined' && this.mesh)
                ? new GeoLOD(this.mesh, this.data.radius)
                : null;
            // High-zoom street tiles (lazy; safe no-op if StreetTiles absent).
            this.streetTiles = (typeof StreetTiles !== 'undefined' && this.mesh)
                ? new StreetTiles(this.mesh, this.data.radius)
                : null;
            // Atmospheric shells (lazy; safe no-op if absent).
            this.atmosphereLayers = (typeof AtmosphereLayers !== 'undefined' && this.mesh)
                ? new AtmosphereLayers(this.mesh, this.data.radius)
                : null;
            // Keyless Esri satellite imagery patches (lazy; safe no-op if absent).
            this.satelliteTiles = (typeof SatelliteTiles !== 'undefined' && this.mesh)
                ? new SatelliteTiles(this.mesh, this.data.radius)
                : null;
            return true;
        } catch (err) {
            console.error('Earth.init: failed to initialize:', err);
            return false;
        }
    }

    // Build the day/night ShaderMaterial mesh. Rule 4: <=60 lines.
    async buildSurface(dayMap, nightMap) {
        console.assert(dayMap, 'Earth.buildSurface: dayMap required');
        console.assert(this.data.radius > 0, 'Earth.buildSurface: bad radius');

        const specularMap = this.data.specularMapPath
            ? await this.resourceLoader.loadTexture(this.data.specularMapPath).catch(() => null)
            : null;

        // G1: load the bump/relief map so the day side regains surface relief.
        // Guarded (.catch) and optional — a missing bump map = flat shading.
        const bumpMap = this.data.bumpMapPath
            ? await this.resourceLoader.loadTexture(this.data.bumpMapPath).catch(() => null)
            : null;

        // G6: anisotropy + horizontal wrap reduce limb shimmer and the seam.
        const tuneTexture = (tex) => {
            if (!tex) return;
            tex.anisotropy = 8;
            tex.wrapS = THREE.RepeatWrapping;
        };
        tuneTexture(dayMap);
        tuneTexture(nightMap);
        tuneTexture(specularMap);

        // X1: gate the dFdx bump path on actual derivative support (iOS Safari on
        // WebGL1 may lack OES_standard_derivatives → a shader containing dFdx fails
        // to compile and the Earth renders black). Without it we ship a flat variant.
        const useBump = !!bumpMap && Earth._derivativesSupported();

        const geometry = new THREE.SphereGeometry(this.data.radius, 64, 64);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                dayTexture: { value: dayMap },
                nightTexture: { value: nightMap || dayMap },
                specularMap: { value: specularMap },
                hasSpecular: { value: specularMap ? 1.0 : 0.0 },
                bumpTexture: { value: bumpMap || dayMap },
                hasBump: { value: useBump ? 1.0 : 0.0 },
                sunDirection: { value: this._sunDir },
                uSurfaceDim: { value: 1.0 }   // dimmed at close zoom so the low-res base
                                              // doesn't show as a blurry "old picture"
                                              // around the satellite tiles
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(useBump)
        });
        // Only enable the derivatives extension when the bump variant is in use.
        if (useBump) {
            material.extensions = material.extensions || {};
            material.extensions.derivatives = true;
        }

        this.mesh = new THREE.Mesh(geometry, material);
        // Preserve axial tilt + orbit phase from the Vite migration.
        this.mesh.rotation.x = THREE.MathUtils.degToRad(this.data.axialTilt || 0);
        this.orbit = this.orbit || { angle: Math.random() * Math.PI * 2 };
        this.updatePosition();
        this.scene.add(this.mesh);

        if (this.data.cloudsPath) {
            await this.createClouds();
        }
    }

    getVertexShader() {
        return [
            'varying vec2 vUv;',
            'varying vec3 vWorldNormal;',
            'varying vec3 vPosition;',
            'void main() {',
            '  vUv = uv;',
            '  vWorldNormal = normalize(mat3(modelMatrix) * normal);',
            '  vPosition = (modelMatrix * vec4(position, 1.0)).xyz;',
            '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n');
    }

    // Day/night surface shader.
    // G1 bump: perturb the lighting normal from the bump height gradient so the
    //   day side reads relief (cheap screen-space derivative approximation).
    // G3 specular: gated by the real sun dot (sunFactor), and a missing spec map
    //   (hasSpecular==0) yields zero specular instead of a full white glint.
    // G4 city lights: soft Reinhard-ish tone-map so bright cities don't clip to
    //   white and oceans don't go grey; tiny bluish earthshine floor.
    // G5 terminator: tight, centered band via smoothstep(-0.08, 0.08, sunFactor).
    getFragmentShader(useBump) {
        // X1: dFdx/dFdy need OES_standard_derivatives on WebGL1; if unsupported
        // (some iOS Safari) their mere presence fails the whole compile → black
        // Earth. Omit the derivative block entirely when useBump is false (flat).
        const bumpBlock = useBump ? [
            '  float bumpH = texture2D(bumpTexture, vUv).r;',
            '  vec3 bumpNormal = normal;',
            '  if (hasBump > 0.5) {',
            '    vec3 dpx = dFdx(vPosition);',
            '    vec3 dpy = dFdy(vPosition);',
            '    float dhx = dFdx(bumpH);',
            '    float dhy = dFdy(bumpH);',
            '    vec3 tangent = normalize(dpx - normal * dot(normal, dpx));',
            '    vec3 bitangent = normalize(dpy - normal * dot(normal, dpy));',
            '    vec3 perturb = (tangent * dhx + bitangent * dhy) * 6.0;',
            '    bumpNormal = normalize(normal - perturb);',
            '  }'
        ] : ['  vec3 bumpNormal = normal;'];
        return [
            'precision mediump float;',
            'uniform sampler2D dayTexture;',
            'uniform sampler2D nightTexture;',
            'uniform sampler2D specularMap;',
            'uniform sampler2D bumpTexture;',
            'uniform float hasSpecular;',
            'uniform float hasBump;',
            'uniform vec3 sunDirection;',
            'uniform float uSurfaceDim;',
            'varying vec2 vUv;',
            'varying vec3 vWorldNormal;',
            'varying vec3 vPosition;',
            'void main() {',
            '  vec3 normal = normalize(vWorldNormal);',
            '  vec3 sunDir = normalize(sunDirection);'
        ].concat(bumpBlock).concat([
            '  float sunFactor = dot(normal, sunDir);',
            // Lighting uses the bumped normal so relief shades; terminator/spec use
            // the geometric sunFactor so the day/night split stays clean.
            '  float bumpDiffuse = max(dot(bumpNormal, sunDir), 0.0);',
            '  float dayMix = smoothstep(-0.08, 0.08, sunFactor);',
            '  vec3 dayColor = texture2D(dayTexture, vUv).rgb;',
            '  vec3 nightColor = texture2D(nightTexture, vUv).rgb;',
            // G4: tone-mapped city lights + small bluish earthshine floor.
            '  vec3 cityLights = nightColor * 3.5;',
            '  cityLights = cityLights / (cityLights + vec3(0.5));',
            '  vec3 nightSide = cityLights + vec3(0.005, 0.008, 0.015);',
            '  float diffuse = max(sunFactor, 0.0);',
            '  vec3 litDay = dayColor * (0.35 + 0.75 * bumpDiffuse);',
            '  vec3 baseColor = mix(nightSide, litDay, dayMix);',
            // G3: specular only where the sun actually hits, only with a spec map.
            '  vec3 viewDir = normalize(cameraPosition - vPosition);',
            '  vec3 reflectDir = reflect(-sunDir, normal);',
            '  float spec = pow(max(dot(viewDir, reflectDir), 0.0), 20.0);',
            '  float specMask = mix(0.0, texture2D(specularMap, vUv).r, hasSpecular);',
            '  float sunGate = step(0.0, sunFactor) * diffuse;',
            '  vec3 specColor = vec3(1.0) * spec * specMask * sunGate * 0.6;',
            // uSurfaceDim darkens the base globe at close zoom (1.0 far → ~0.22 close)
            // so where the satellite tiles have not loaded/reached, the low-res base
            // reads as a neutral dark surface instead of a blurry "old picture".
            '  gl_FragColor = vec4((baseColor + specColor) * uSurfaceDim, 1.0);',
            '}'
        ]).join('\n');
    }

    async createClouds() {
        const cloudsTexture = await this.resourceLoader.loadTexture(this.data.cloudsPath)
            .catch(() => null);
        console.assert(this.mesh, 'Earth.createClouds: mesh required');
        if (!cloudsTexture) {
            console.error('Earth.createClouds: clouds texture failed to load');
            return;
        }
        const cloudsGeometry = new THREE.SphereGeometry(this.data.radius + 0.05, 64, 64);
        const cloudsMaterial = new THREE.MeshPhongMaterial({
            map: cloudsTexture,
            transparent: true,
            opacity: 0.8,
            depthWrite: false
        });
        this.cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
        this.mesh.add(this.cloudsMesh);
    }

    // Glowing additive marker fixed to SF, parented to the Earth mesh so it
    // rotates with the globe. Rule 4: <=60 lines.
    createMarker() {
        console.assert(this.mesh, 'Earth.createMarker: mesh required');
        console.assert(typeof GlobeMath !== 'undefined', 'Earth.createMarker: GlobeMath required');
        if (typeof GlobeMath === 'undefined') {
            console.error('Earth.createMarker: GlobeMath missing, skipping marker');
            return;
        }

        const surfacePos = GlobeMath.latLngToVector3(
            this.markerCoords.lat, this.markerCoords.lng, this.data.radius);
        // Smaller base dot; SpaceEnvironment scales it per-frame by camera distance
        // (userData.distanceScale) so it stays ~constant on screen while exploring.
        const markerSize = this.data.radius * 0.022;

        // G7: a thin dark rim halo behind the core so the marker stays legible
        // against bright day-side terrain. depthTest stays on so the far side
        // stays occluded.
        const haloGeometry = new THREE.SphereGeometry(markerSize * 1.7, 16, 16);
        const haloMaterial = new THREE.MeshBasicMaterial({
            color: 0x001018,
            transparent: true,
            opacity: 0.55,
            depthWrite: false
        });
        const halo = new THREE.Mesh(haloGeometry, haloMaterial);

        const geometry = new THREE.SphereGeometry(markerSize, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0x66e8ff,
            transparent: true,
            opacity: 1.0,
            depthWrite: false
        });
        this.marker = new THREE.Mesh(geometry, material);
        this.markerHalo = halo;
        this.marker.add(halo);
        // Lift slightly off the surface so it reads against day and night sides.
        this.marker.position.copy(surfacePos).multiplyScalar(1.02);
        this.marker.userData.baseScale = 1.0;
        this.mesh.add(this.marker);
    }

    /**
     * Lazily build a lat/long graticule (meridians + parallels every 15°) as ONE
     * THREE.LineSegments child of this.mesh (one draw call). Sampled via
     * GlobeMath so it matches the marker mapping. Hidden by default; the caller
     * toggles .visible in explore mode. Rule 4: <=60 lines.
     * @returns {THREE.LineSegments|null}
     */
    buildGraticule() {
        console.assert(this.mesh, 'Earth.buildGraticule: mesh required');
        console.assert(typeof GlobeMath !== 'undefined', 'Earth.buildGraticule: GlobeMath required');
        if (this.graticule) return this.graticule;
        if (!this.mesh || typeof GlobeMath === 'undefined') return null;

        const r = this.data.radius * 1.0014;  // hugs surface so the camera can zoom in close
        const step = 15;          // degrees between grid lines
        const sample = 5;         // degrees between sampled points along a line
        const verts = [];
        const pushLine = (pts) => {
            for (let i = 0; i < pts.length - 1; i++) {
                verts.push(pts[i].x, pts[i].y, pts[i].z);
                verts.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
            }
        };
        // Meridians (constant lng, lat -90..90).
        for (let lng = -180; lng < 180; lng += step) {
            const pts = [];
            for (let lat = -90; lat <= 90; lat += sample) {
                pts.push(GlobeMath.latLngToVector3(lat, lng, r));
            }
            pushLine(pts);
        }
        // Parallels (constant lat, lng -180..180).
        for (let lat = -75; lat <= 75; lat += step) {
            const pts = [];
            for (let lng = -180; lng <= 180; lng += sample) {
                pts.push(GlobeMath.latLngToVector3(lat, lng, r));
            }
            pushLine(pts);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        const material = new THREE.LineBasicMaterial({
            color: 0x5aa0e0, transparent: true, opacity: 0.55, depthWrite: false
        });
        this.graticule = new THREE.LineSegments(geometry, material);
        this.graticule.visible = false;
        this.mesh.add(this.graticule);
        return this.graticule;
    }

    /**
     * Lazily fetch country borders JSON and build ONE THREE.LineSegments
     * (one draw call) child of this.mesh. depthTest true so the far side is
     * occluded by the globe. Fetch failure is logged and skipped. Async; the
     * caller toggles .visible once it resolves. Rule 4: <=60 lines.
     * @param {string} url
     * @returns {Promise<THREE.LineSegments|null>}
     */
    async buildBorders(url) {
        console.assert(this.mesh, 'Earth.buildBorders: mesh required');
        console.assert(typeof url === 'string' && url.length > 0, 'Earth.buildBorders: url required');
        if (this.borders || this._bordersRequested) return this.borders;
        this._bordersRequested = true;
        if (!this.mesh || typeof GlobeMath === 'undefined') return null;

        let data = null;
        try {
            const res = await fetch(url);
            if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
            data = await res.json();
        } catch (err) {
            console.error('Earth.buildBorders: fetch failed, skipping borders:', err);
            return null;
        }
        if (!data || !Array.isArray(data.rings)) {
            console.error('Earth.buildBorders: malformed borders data');
            return null;
        }

        const r = this.data.radius * 1.0018;  // above the graticule; hugs surface for close zoom
        const verts = [];
        for (let i = 0; i < data.rings.length; i++) {
            const ring = data.rings[i];
            if (!Array.isArray(ring) || ring.length < 2) continue;
            for (let j = 0; j < ring.length - 1; j++) {
                const a = GlobeMath.latLngToVector3(ring[j][1], ring[j][0], r);
                const b = GlobeMath.latLngToVector3(ring[j + 1][1], ring[j + 1][0], r);
                verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        const material = new THREE.LineBasicMaterial({
            color: 0x8fe3ff, transparent: true, opacity: 0.7,
            depthWrite: false, depthTest: true
        });
        this.borders = new THREE.LineSegments(geometry, material);
        this.borders.visible = false;
        this.mesh.add(this.borders);
        return this.borders;
    }

    getSunDirection(target) {
        console.assert(target && target.isVector3, 'Earth.getSunDirection: Vector3 required');
        console.assert(this.mesh, 'Earth.getSunDirection: mesh required');
        // Sun is a PointLight at the origin; direction from Earth toward it.
        this.mesh.getWorldPosition(this._worldPos);
        target.copy(this._worldPos).normalize().negate();
        if (target.lengthSq() < 1e-6) {
            target.set(1, 0, 0);
        }
        return target;
    }

    /**
     * Freeze/unfreeze Earth for explore mode. Frozen => no solar orbit / axis
     * spin (update() skips the motion block), but the day/night shader + marker
     * pulse still refresh so the globe stays lit and the marker findable.
     * Rule 5: 2 asserts, return value used by caller.
     * @param {boolean} value
     * @returns {boolean} the new frozen state
     */
    setFrozen(value) {
        console.assert(typeof value === 'boolean', 'Earth.setFrozen: boolean required');
        console.assert(this.mesh !== undefined, 'Earth.setFrozen: mesh field expected');
        this.frozen = !!value;
        return this.frozen;
    }

    // Merged update: preserves Vite time-sync (j2000Days) rotation + orbital
    // position + J2000 moon sync, gated by the explore-mode freeze, then refreshes
    // the day/night sun direction + atmosphere glow + marker pulse every frame.
    update(deltaTime, j2000Days = null) {
        if (!this.mesh) return;

        // Frozen (explore mode): skip orbit/spin/clouds/moon so the globe holds
        // still for inspection. Sun + marker refresh below still run.
        if (!this.frozen) {
            // Time-synchronized rotation (respects TimeScaleManager via j2000Days).
            if (j2000Days !== null && this.data.rotationPeriodHours) {
                const rotationsPerJ2000Day = 24 / this.data.rotationPeriodHours;
                const totalRotations = j2000Days * rotationsPerJ2000Day;
                this.mesh.rotation.y = (totalRotations * Math.PI * 2) % (Math.PI * 2);
                if (this.cloudsMesh) {
                    this.cloudsMesh.rotation.y = (totalRotations * 0.98 * Math.PI * 2) % (Math.PI * 2);
                }
            } else {
                this.mesh.rotation.y += this.data.rotationSpeed * deltaTime;
                if (this.cloudsMesh) {
                    this.cloudsMesh.rotation.y += this.data.rotationSpeed * 0.98 * deltaTime;
                }
            }

            // Orbital position from real time (falls back to constant speed).
            if (j2000Days !== null && this.data.orbitalPeriodDays && typeof OrbitalCalculator !== 'undefined') {
                const epochAnomaly = (this.data.orbitalElements && this.data.orbitalElements.meanAnomalyAtEpoch) || 0;
                const meanAnomaly = OrbitalCalculator.calculateMeanAnomaly(
                    j2000Days, this.data.orbitalPeriodDays, epochAnomaly);
                if (isFinite(meanAnomaly)) {
                    this.orbit.angle = meanAnomaly;
                } else {
                    this.orbit.angle += this.data.orbitSpeed * deltaTime;
                }
            } else {
                this.orbit.angle += this.data.orbitSpeed * deltaTime;
            }
            this.updatePosition();

            for (let i = 0; i < this.moons.length; i++) {
                if (this.moons[i].update) {
                    this.moons[i].update(deltaTime, j2000Days);
                }
            }
        }

        // Refresh sun direction for the day/night shader (no per-frame alloc).
        this.getSunDirection(this._sunDir);
        if (this.mesh.material && this.mesh.material.uniforms) {
            this.mesh.material.uniforms.sunDirection.value = this._sunDir;
        }
        // G2: keep the atmosphere glow locked to the same sun direction so the
        // halo concentrates on the lit limb (shares the _sunDir Vector3).
        if (this.atmosphereMesh && this.atmosphereMesh.material &&
            this.atmosphereMesh.material.uniforms) {
            this.atmosphereMesh.material.uniforms.sunDirection.value = this._sunDir;
        }

        // Marker scale = distance-based base (set by the explore camera each frame so
        // the dot stays ~constant on screen — smaller zoomed in, larger zoomed out)
        // × a subtle pulse (pulse disabled under reduced-motion).
        if (this.marker) {
            const base = this.marker.userData.distanceScale || 1;
            let pulse = 1;
            if (!this.reducedMotion) {
                this.markerPulse += deltaTime * 3.0;
                pulse = 1 + Math.sin(this.markerPulse) * 0.18;
            }
            this.marker.scale.setScalar(base * pulse);
        }
    }

    async createMoon() {
        this.moonGroup = new THREE.Group();
        this.mesh.add(this.moonGroup);

        const moonTexture = await this.resourceLoader.loadTexture(this.moonData.texturePath)
            .catch(() => null);
        const moonBumpMap = await this.resourceLoader.loadTexture(this.moonData.bumpMapPath)
            .catch(() => null);
        console.assert(this.moonGroup, 'Earth.createMoon: moonGroup required');
        if (!moonTexture) {
            console.error('Earth.createMoon: moon texture failed to load');
            return;
        }

        const moonGeometry = new THREE.SphereGeometry(this.moonData.radius, 32, 32);
        const moonMaterial = new THREE.MeshPhongMaterial({
            map: moonTexture,
            bumpMap: moonBumpMap || undefined,
            bumpScale: 0.1
        });
        const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
        moonMesh.position.set(this.moonData.distance, 0, 0);
        this.moonGroup.add(moonMesh);

        this.moons.push({
            mesh: moonMesh,
            orbit: { angle: 0 },
            data: this.moonData,
            // Preserve Vite's J2000-synced lunar orbit (falls back to constant speed).
            update: (dt, j2000Days = null) => {
                moonMesh.rotation.y += this.moonData.rotationSpeed * dt;
                if (j2000Days !== null && typeof OrbitalCalculator !== 'undefined') {
                    const lunarPeriod = 27.32166;   // sidereal month (days)
                    const moonAngle = OrbitalCalculator.calculateMeanAnomaly(j2000Days, lunarPeriod, 0);
                    if (isFinite(moonAngle)) {
                        this.moonGroup.rotation.y = moonAngle;
                    } else {
                        this.moonGroup.rotation.y += this.moonData.orbitSpeed * dt;
                    }
                } else {
                    this.moonGroup.rotation.y += this.moonData.orbitSpeed * dt;
                }
            }
        });
    }

    /**
     * createAtmosphere() - thin glowing Fresnel rim shell around Earth.
     * G2: the rim glow is sun-locked. The fresnel term uses the view-space normal
     * (so the halo stays on the limb), but its intensity is modulated by
     * max(dot(worldNormal, sunDir), 0) + a small ambient, so the glow concentrates
     * on the lit limb and fades across the terminator instead of following camera.
     */
    createAtmosphere() {
        console.assert(this.mesh, 'Earth.createAtmosphere: mesh required');
        console.assert(this.data.radius > 0, 'Earth.createAtmosphere: bad radius');
        const atmGeometry = new THREE.SphereGeometry(this.data.radius * 1.06, 64, 64);
        const atmMaterial = new THREE.ShaderMaterial({
            uniforms: {
                sunDirection: { value: this._sunDir }
            },
            vertexShader: [
                'varying vec3 vNormal;',
                'varying vec3 vWorldNormal;',
                'void main() {',
                '  vNormal = normalize(normalMatrix * normal);',
                '  vWorldNormal = normalize(mat3(modelMatrix) * normal);',
                '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform vec3 sunDirection;',
                'varying vec3 vNormal;',
                'varying vec3 vWorldNormal;',
                'void main() {',
                '  float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);',
                '  intensity = clamp(intensity, 0.0, 1.0);',
                '  float sunLit = max(dot(normalize(vWorldNormal), normalize(sunDirection)), 0.0);',
                '  float litFactor = 0.15 + 0.85 * sunLit;',
                '  gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity * litFactor;',
                '}'
            ].join('\n'),
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false
        });
        this.atmosphereMesh = new THREE.Mesh(atmGeometry, atmMaterial);
        this.mesh.add(this.atmosphereMesh);
    }

    // ---- Live keyless data layers (children of this.mesh; reuse GlobeMath) ----

    // Small glowing marker helper. Rule 5: 2 asserts.
    _makeMarker(lat, lng, radiusFactor, color, size, userData) {
        console.assert(typeof GlobeMath !== 'undefined', 'Earth._makeMarker: GlobeMath required');
        console.assert(size > 0, 'Earth._makeMarker: size required');
        const pos = GlobeMath.latLngToVector3(lat, lng, this.data.radius * radiusFactor);
        const geo = new THREE.SphereGeometry(size, 12, 12);
        const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.95 });
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(pos);
        m.userData = userData || {};
        return m;
    }

    // Curated places of interest (static, no API). Click → detail card.
    buildPois() {
        console.assert(this.mesh, 'Earth.buildPois: mesh required');
        if (this.layers.pois) return this.layers.pois;
        const places = [
            { name: 'San Francisco', lat: 37.7749, lng: -122.4194, info: 'Based here · open to work' },
            { name: 'London', lat: 51.5074, lng: -0.1278, info: 'Open to remote / relocation' },
            { name: 'Tokyo', lat: 35.6762, lng: 139.6503, info: 'Open to remote / relocation' },
            { name: 'New York', lat: 40.7128, lng: -74.0060, info: 'Open to remote / relocation' }
        ];
        const group = new THREE.Group();
        for (let i = 0; i < places.length; i++) {
            const p = places[i];
            const m = this._makeMarker(p.lat, p.lng, 1.02, 0xffd24a, this.data.radius * 0.02,
                { type: 'place', name: p.name, info: p.info });
            group.add(m);
            this.pickables.push(m);
        }
        group.visible = false;
        this.layers.pois = group;
        this.mesh.add(group);
        return group;
    }

    // Live earthquakes (USGS, keyless + CORS). Markers sized by magnitude.
    async buildQuakes() {
        console.assert(this.mesh, 'Earth.buildQuakes: mesh required');
        if (this.layers.quakes) return this.layers.quakes;
        if (typeof SafeFetch === 'undefined') return null;
        const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
        const data = await SafeFetch.json(url, { ttl: 300000 });
        if (!data || !Array.isArray(data.features)) {
            console.error('Earth.buildQuakes: no USGS data');
            return null;
        }
        const group = new THREE.Group();
        const max = Math.min(data.features.length, 250);   // Rule 2: bounded
        for (let i = 0; i < max; i++) {
            const f = data.features[i];
            if (!f.geometry || !f.geometry.coordinates) continue;
            const lng = f.geometry.coordinates[0], lat = f.geometry.coordinates[1];
            const mag = (f.properties && f.properties.mag) || 2.5;
            const size = this.data.radius * (0.006 + mag * 0.004);
            const m = this._makeMarker(lat, lng, 1.01, 0xff5a3c, size,
                { type: 'quake', name: 'M' + mag.toFixed(1) + ' earthquake',
                    info: (f.properties && f.properties.place) || '' });
            group.add(m);
            this.pickables.push(m);
        }
        group.visible = false;
        this.layers.quakes = group;
        this.mesh.add(group);
        return group;
    }

    // ISS live position (wheretheiss.at, keyless + CORS). Polls while shown.
    startISS() {
        console.assert(this.mesh, 'Earth.startISS: mesh required');
        if (this._issTimer) return;
        this._ensureIssMarker();
        const poll = async () => {
            if (typeof document !== 'undefined' && document.hidden) return;   // pause when hidden
            if (typeof SafeFetch === 'undefined') return;
            const d = await SafeFetch.json('https://api.wheretheiss.at/v1/satellites/25544', { ttl: 4000 });
            if (d && this.layers.iss && typeof d.latitude === 'number') {
                const altF = 1 + ((d.altitude || 420) / 6371);
                const pos = GlobeMath.latLngToVector3(d.latitude, d.longitude, this.data.radius * altF);
                this.layers.iss.position.copy(pos);
                this.layers.iss.userData.info = 'Alt ' + Math.round(d.altitude) + ' km · '
                    + Math.round(d.velocity) + ' km/h';
            }
        };
        poll();
        this._issTimer = setInterval(poll, 5000);   // 5s cadence
    }

    _ensureIssMarker() {
        if (this.layers.iss) return;
        const m = this._makeMarker(0, 0, 1.06, 0x66ffcc, this.data.radius * 0.025,
            { type: 'iss', name: 'ISS (Zarya)', info: 'International Space Station' });
        m.visible = false;
        this.layers.iss = m;
        this.pickables.push(m);
        this.mesh.add(m);
    }

    stopISS() {
        if (this._issTimer) { clearInterval(this._issTimer); this._issTimer = null; }
    }

    // Toggle a built layer's visibility. Rule 5: 2 asserts.
    setLayerVisible(name, vis) {
        console.assert(typeof name === 'string', 'Earth.setLayerVisible: name required');
        console.assert(this.layers, 'Earth.setLayerVisible: layers map required');
        const obj = this.layers[name];
        if (obj) obj.visible = !!vis;
        return !!obj;
    }

    // ---- Country hover (names + rings → hit-test + glowing outline) ----

    // Load country shapes (names + rings) for hover hit-testing. Keyless static.
    async buildCountryHover() {
        if (this.countryShapes) return true;
        if (typeof SafeFetch === 'undefined') return false;
        const data = await SafeFetch.json('src/assets/geo/country_shapes.json', { ttl: 3600000 });
        if (!data || !Array.isArray(data.countries)) {
            console.error('Earth.buildCountryHover: no country shapes');
            return false;
        }
        this.countryShapes = data.countries;
        return true;
    }

    // Ray-casting point-in-ring test in lng/lat space. Rule 5: 2 asserts.
    static _pointInRing(lng, lat, ring) {
        console.assert(Array.isArray(ring), 'Earth._pointInRing: ring array required');
        console.assert(ring.length >= 3, 'Earth._pointInRing: ring too short');
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
            if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    // Which country contains (lat,lng)? null if none. Rule 2: bounded loops.
    countryAt(lat, lng) {
        if (!this.countryShapes) return null;
        for (let i = 0; i < this.countryShapes.length; i++) {
            const c = this.countryShapes[i];
            for (let r = 0; r < c.rings.length; r++) {
                if (Earth._pointInRing(lng, lat, c.rings[r])) return c.name;
            }
        }
        return null;
    }

    // Highlight a country's outline (bright glow). name=null clears it. Rule 4: <=60.
    highlightCountry(name) {
        if (name === this._hoverCountry) return this._hoverCountry;
        this._hoverCountry = name;
        if (this.countryHighlight) {
            Earth.disposeMesh(this.countryHighlight);
            if (this.countryHighlight.parent) this.countryHighlight.parent.remove(this.countryHighlight);
            this.countryHighlight = null;
        }
        if (!name || !this.countryShapes) return null;
        const country = this.countryShapes.find((c) => c.name === name);
        if (!country) return null;
        const r = this.data.radius * 1.0019;  // just above the borders layer (1.0018)
        const verts = [];
        for (let k = 0; k < country.rings.length; k++) {
            const ring = country.rings[k];
            for (let j = 0; j < ring.length - 1; j++) {
                const a = GlobeMath.latLngToVector3(ring[j][1], ring[j][0], r);
                const b = GlobeMath.latLngToVector3(ring[j + 1][1], ring[j + 1][0], r);
                verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        const mat = new THREE.LineBasicMaterial({ color: 0xffe680, transparent: true, opacity: 0.95, depthWrite: false });
        this.countryHighlight = new THREE.LineSegments(geo, mat);
        this.mesh.add(this.countryHighlight);
        return name;
    }

    // ---- Cascade hover: country → state → county → district → zip ----

    // Fetch JSON via SafeFetch (fallback fetch). Never throws. Rule 5: 2 asserts.
    static async _fetchJson(url) {
        console.assert(typeof url === 'string', 'Earth._fetchJson: url required');
        console.assert(url.length > 0, 'Earth._fetchJson: non-empty url');
        try {
            if (typeof SafeFetch !== 'undefined' && SafeFetch.json) return await SafeFetch.json(url, { ttl: 3600000 });
            const r = await fetch(url); if (!r || !r.ok) return null; return await r.json();
        } catch (e) { return null; }
    }

    // Normalize {features|countries:[{name,rings}]} → [{name,rings}]. Rule 5: 2 asserts.
    static _normalizeFeatures(data) {
        console.assert(arguments.length === 1, 'Earth._normalizeFeatures: 1 arg');
        console.assert(data === null || typeof data === 'object', 'Earth._normalizeFeatures: object');
        if (!data) return null;
        const arr = data.features || data.countries;
        return Array.isArray(arr) ? arr : null;
    }

    // Lazily load every available named-polygon tier (missing files skipped, so
    // deeper tiers auto-enable once their data is added). Rule 4: <=60 lines.
    async buildRegionTiers() {
        console.assert(Array.isArray(Earth.REGION_TIER_DEFS), 'buildRegionTiers: defs required');
        console.assert(this.regionTiers, 'buildRegionTiers: registry expected');
        const defs = Earth.REGION_TIER_DEFS;
        for (let i = 0; i < defs.length; i++) {
            const def = defs[i];
            if (this.regionTiers[def.key]) continue;
            const data = await Earth._fetchJson(def.url);
            const feats = Earth._normalizeFeatures(data);
            if (feats) this.regionTiers[def.key] = feats;
        }
        return true;
    }

    // Pick the FINEST loaded tier valid at this camera distance (radii). Rule 5: 2 asserts.
    cascadeTierForDistance(rr) {
        console.assert(Number.isFinite(rr), 'cascadeTierForDistance: distance required');
        console.assert(Array.isArray(Earth.REGION_TIER_DEFS), 'cascadeTierForDistance: defs');
        const defs = Earth.REGION_TIER_DEFS;
        for (let i = defs.length - 1; i >= 0; i--) {            // finest → coarsest
            const def = defs[i];
            if (this.regionTiers[def.key] && rr <= def.showTo) return def.key;
        }
        return 'country';
    }

    // Which named region of `tier` contains (lat,lng)? null if none. Rule 2: bounded.
    regionAt(tier, lat, lng) {
        console.assert(typeof tier === 'string', 'regionAt: tier required');
        console.assert(Number.isFinite(lat) && Number.isFinite(lng), 'regionAt: coords required');
        const feats = this.regionTiers[tier];
        if (!feats) return null;
        const max = Math.min(feats.length, 8000);              // Rule 2: bounded
        for (let i = 0; i < max; i++) {
            const f = feats[i];
            if (!f || !Array.isArray(f.rings)) continue;
            for (let r = 0; r < f.rings.length; r++) {
                if (Array.isArray(f.rings[r]) && f.rings[r].length >= 3 &&
                    Earth._pointInRing(lng, lat, f.rings[r])) return f.name;
            }
        }
        return null;
    }

    // Highlight a region's outline (tier color + rOffset). (tier,null) clears. Rule 4: <=60.
    highlightRegion(tier, name) {
        const key = (tier && name) ? (tier + '|' + name) : null;
        if (key === this._hoverRegionKey) return this._hoverRegionKey;
        this._hoverRegionKey = key;
        if (this.regionHighlight) {
            Earth.disposeMesh(this.regionHighlight);
            if (this.regionHighlight.parent) this.regionHighlight.parent.remove(this.regionHighlight);
            this.regionHighlight = null;
        }
        if (!key) return null;
        const def = Earth.REGION_TIER_DEFS.find((d) => d.key === tier);
        const feats = this.regionTiers[tier];
        if (!def || !feats) return null;
        const region = feats.find((f) => f.name === name);
        if (!region || !Array.isArray(region.rings)) return null;
        const r = this.data.radius * def.rOffset;
        const verts = [];
        for (let k = 0; k < region.rings.length; k++) {
            const ring = region.rings[k];
            if (!Array.isArray(ring)) continue;
            for (let j = 0; j < ring.length - 1; j++) {
                const a = GlobeMath.latLngToVector3(ring[j][1], ring[j][0], r);
                const b = GlobeMath.latLngToVector3(ring[j + 1][1], ring[j + 1][0], r);
                verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        const mat = new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0.95, depthWrite: false });
        this.regionHighlight = new THREE.LineSegments(geo, mat);
        this.mesh.add(this.regionHighlight);
        return name;
    }

    // Dispose all Earth-owned GPU resources. Rule 4: <=60 lines.
    dispose() {
        console.assert(this.scene, 'Earth.dispose: scene required');
        console.assert(this.mesh !== undefined, 'Earth.dispose: mesh field expected');

        // FIX 4: remove the reduced-motion listener so it doesn't leak.
        if (this._reducedMotionMq && this._onReducedMotionChange) {
            if (this._reducedMotionMq.removeEventListener) {
                this._reducedMotionMq.removeEventListener('change', this._onReducedMotionChange);
            } else if (this._reducedMotionMq.removeListener) {
                this._reducedMotionMq.removeListener(this._onReducedMotionChange);
            }
        }

        // FIX 5: do NOT dispose dayTexture/nightTexture/specularMap here — they come
        // from the shared ResourceLoader cache and ResourceLoader owns their
        // lifecycle. Only Earth-owned GPU resources are disposed below.
        Earth.disposeMesh(this.markerHalo);
        Earth.disposeMesh(this.marker);
        Earth.disposeMesh(this.atmosphereMesh);
        // Explore overlays: BufferGeometry + LineBasicMaterial, no textures.
        Earth.disposeMesh(this.graticule);
        Earth.disposeMesh(this.borders);
        this.graticule = null;
        this.borders = null;

        // Live data layers: stop ISS polling + dispose marker meshes (no cached textures).
        this.stopISS();
        ['iss', 'quakes', 'pois'].forEach((k) => {
            const obj = this.layers[k];
            if (!obj) return;
            obj.traverse((c) => { if (c.isMesh) Earth.disposeMesh(c); });
            if (obj.parent) obj.parent.remove(obj);
            this.layers[k] = null;
        });
        this.pickables = [];
        if (this.countryHighlight) { Earth.disposeMesh(this.countryHighlight); this.countryHighlight = null; }
        this.countryShapes = null;
        this._hoverCountry = null;
        if (this.regionHighlight) { Earth.disposeMesh(this.regionHighlight); this.regionHighlight = null; }
        this.regionTiers = {};
        this._hoverRegionKey = null;
        if (this.geoLOD) { this.geoLOD.dispose(); this.geoLOD = null; }
        if (this.streetTiles) { this.streetTiles.dispose(); this.streetTiles = null; }
        if (this.satelliteTiles) { this.satelliteTiles.dispose(); this.satelliteTiles = null; }
        if (this.atmosphereLayers) { this.atmosphereLayers.dispose(); this.atmosphereLayers = null; }
        // clouds.map and moon.map/bumpMap are ResourceLoader-cached — skip
        // disposing those textures (pass false) so a recreated Earth keeps valid
        // textures. Geometry + material are still disposed.
        Earth.disposeMesh(this.cloudsMesh, false);

        for (let i = 0; i < this.moons.length; i++) {
            Earth.disposeMesh(this.moons[i].mesh, false);
        }
        if (this.moonGroup) {
            this.scene.remove(this.moonGroup);
            this.moonGroup = null;
        }
        if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.scene.remove(this.mesh);
        }
        this.moons = [];
    }

    // Static mesh disposer. Rule 5: 2 asserts, checks return values.
    // disposeTextures: when false, skip disposing material.map / material.bumpMap
    // because those textures come from the shared ResourceLoader cache. Geometry
    // and the material object itself are always Earth-owned and always disposed.
    static disposeMesh(mesh, disposeTextures = true) {
        console.assert(arguments.length <= 2, 'Earth.disposeMesh: 1-2 args');
        console.assert(mesh === null || typeof mesh === 'object', 'Earth.disposeMesh: bad arg');
        if (!mesh) return false;
        if (mesh.geometry && mesh.geometry.dispose) mesh.geometry.dispose();
        if (mesh.material) {
            if (disposeTextures) {
                if (mesh.material.map && mesh.material.map.dispose) mesh.material.map.dispose();
                if (mesh.material.bumpMap && mesh.material.bumpMap.dispose) mesh.material.bumpMap.dispose();
            }
            if (mesh.material.dispose) mesh.material.dispose();
        }
        return true;
    }
}

// Cascade-hover tier definitions (coarsest → finest). `showTo` = the max camera
// distance (Earth radii) at which the tier is the active hover layer; the hover
// picks the FINEST loaded tier whose showTo covers the current distance. county/
// district/zip files may not exist yet — they auto-enable once added (buildRegionTiers
// skips missing files). Classic-script static (defined after the class, not a field).
Earth.REGION_TIER_DEFS = [
    { key: 'country',  url: 'src/assets/geo/country_shapes.json',     color: 0xffe680, rOffset: 1.0019, showTo: Infinity },
    { key: 'state',    url: 'src/assets/geo/states-named.json',       color: 0x9fe0ff, rOffset: 1.0023, showTo: 2.4 },
    { key: 'county',   url: 'src/assets/geo/counties-us-named.json',  color: 0xb6ffd0, rOffset: 1.0027, showTo: 1.7 },
    { key: 'district', url: 'src/assets/geo/districts-sf-named.json', color: 0xffc6f0, rOffset: 1.0033, showTo: 1.35 },
    { key: 'zip',      url: 'src/assets/geo/zip-sf-named.json',       color: 0xffd2a6, rOffset: 1.0036, showTo: 1.22 }
];

// Make globally available (matches the rest of the codebase).
if (typeof window !== 'undefined') {
    window.Earth = Earth;
}
