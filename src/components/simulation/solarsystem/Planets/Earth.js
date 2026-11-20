// Earth.js - Day/night city-lights shader + explore layers.
// Extends Planet. Overrides init() to build a custom ShaderMaterial so the dark
// hemisphere shows city lights instead of pure black, and adds the explore-mode
// overlays (graticule, borders, live ISS/quakes/places, country hover).
//
// MERGE NOTE: this file grafts the roaster-hardened globe work from the pre-Vite
// build onto the Vite migration. It PRESERVES the Vite time-sync behaviour:
// update(deltaTime, j2000Days) drives rotation from rotationPeriodHours and
// orbital position from OrbitalCalculator, and the moon is J2000-synced. Texture
// keys follow the Vite SolarSystem config (data.nightLightsPath, etc.).
// global THREE (r184, republished from an ES module by index.html), classic script (no modules).
class Earth extends Planet {
    constructor(scene, resourceLoader, data) {
        super(scene, resourceLoader, data);

        // NASA Rule 5: validate dependencies.
        console.assert(scene && resourceLoader && data,
            'Earth.constructor: missing required dependencies');
        console.assert(data && data.radius > 0, 'Earth.constructor: bad radius');

        this.moonData = {
            // SCALE CHOICE (R1 #2): the Moon's SIZE is true (0.5 = 0.25 Earth radii, real
            // 0.27), its DISTANCE is not: 15 units = 7.5 Earth radii, the real one is 60.
            // At 60R it would sit 120 units out, past Venus's and Mars's drawn orbits.
            // 7.5R keeps it readable from Explore (shown above 4R, hand-off at 9R) and
            // puts it OUTSIDE the true-scale satellite shells (GPS 4.2R, geostationary
            // 6.6R) - at the old 2.5R it was drawn inside both. Its DIRECTION is real.
            radius: 0.5,
            distance: 15,
            rotationSpeed: 0.02,
            orbitSpeed: 0.05,
            texturePath: 'src/assets/textures/planets/earth/moon/moon_map.jpg',
            bumpMapPath: 'src/assets/textures/planets/earth/moon/moon_bump.jpg'
        };
        // Vite config exposes the night map as nightLightsPath; keep a fallback.
        this.nightTexturePath = (data && data.nightLightsPath)
            || 'src/assets/textures/planets/earth/earth_night.jpg';

        // F2: no home-city marker (privacy: the owner asked the globe not to point at
        // where he lives). Live markers (quakes, ISS, places) are this.markers below.

        // Reduced-motion + per-frame scratch vectors (Rule: no per-frame alloc).
        // FIX 4: cache the value but keep it live by listening for OS toggles so
        // motion reacts mid-session instead of being frozen at construct time.
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
        // Explore-only surface detail (see setExploreDetail). Nothing loads before that.
        this._exploreDetailOn = false;
        this._cloudShadowsAllowed = false;
        this._cloudCut = { value: 0 };      // 0 = shell as it always was, 1 = real clouds
        this._dayLow = null;
        this._dayHigh = null;
        this._sunLocal = new THREE.Vector3(1, 0, 0);
        this._invRotation = new THREE.Matrix3();
        // Orbit state (also set in buildSurface; Planet.updatePosition reads .angle).
        this.orbit = { angle: Math.random() * Math.PI * 2 };

        // Explore-mode state. When frozen, update() skips rotation/orbit so the
        // globe stops moving and stays put for inspection.
        this.frozen = false;
        // Lazily-built explore overlays (one draw call each, children of mesh).
        this.graticule = null;
        this.borders = null;
        this._bordersRequested = false;

        // Live keyless data layers (children of this.mesh so they track the globe).
        this.layers = { iss: null, quakes: null, pois: null };
        this._issTimer = null;
        this.markers = null;          // GlobeMarkers: the 3 layers above as Points (screen-space pick)
        this.pickables = [];          // extra meshes the raycaster can click for a detail card

        // Country hover: point-in-polygon hit-test + glowing outline + name.
        this.countryShapes = null;
        this.countryHighlight = null;
        this._hoverCountry = null;

        // Cascade hover: named-polygon tiers (country→state→county),
        // lazily loaded from src/assets/geo/*. Each entry is [{name, rings}]. Missing
        // tier files are skipped so deeper tiers light up when their data lands.
        this.regionTiers = {};
        this.regionHighlight = null;
        this._hoverRegionKey = null;

        // Zoom level-of-detail geography (states/cities), revealed by
        // camera distance in explore mode. Created in init() once mesh exists.
        this.geoLOD = null;
        // High-zoom OpenStreetMap street tiles projected on the globe (lazy).
        this.streetTiles = null;
        // Keyless Esri satellite imagery draped as textured patches (lazy).
        this.satelliteTiles = null;
        // Five named atmospheric shells (Troposphere→Exosphere) w/ cascade animation.
        this.atmosphereLayers = null;
        // Living objects inside the Troposphere shell (hot-air/weather balloons, jets).
        this.troposphereObjects = null;
        // Aurora ovals in the Thermosphere shell, sized by the live Kp index (P42).
        this.auroraOval = null;
        // Real satellites (src/utils/Satellites.js): even the class loads only in Explore.
        this.satellites = null;
        this.satsWanted = false;        // saved on/off state; a failed start keeps it
        this._satsActive = false;       // inside Explore with the layer on
        this._satsScript = null;
        this._satsState = 'idle';       // idle | loading | ok | failed (the Layers status line)
        // Live feeds (roast R3 #5): what the user asked for, and when each feed last answered.
        this.quakesWanted = false;
        this.issWanted = false;
        this.feeds = { quakes: { okAt: 0, failAt: 0, count: 0 }, iss: { okAt: 0, failAt: 0 } };
        this._quakesInFlight = null;
        this._quakeLoopOn = false;
        this._quakeTimer = null;
        // User-managed saved map pins (dot/area), persisted to localStorage.
        this.explorePins = null;
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
        // buildSurface/createMoon/createAtmosphere would reject the
        // whole SolarSystem.init() and kill the entire simulation.
        // This override does NOT call super.init() on the happy path, so it has to do the
        // orbital precompute itself. Without it cosOmega/sinOmega stay undefined and
        // Planet.updatePosition falls back to an argument of periapsis of zero — Earth's
        // ellipse pointed the wrong way while every other planet was correct. See
        // Planet.precomputeOrbitalConstants for the measurement.
        this.precomputeOrbitalConstants();

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
            // Keyless Esri satellite imagery patches (lazy; safe no-op if absent). Stays at
            // boot: Mars streams its surface through the same class outside Explore.
            this.satelliteTiles = (typeof SatelliteTiles !== 'undefined' && this.mesh)
                ? new SatelliteTiles(this.mesh, this.data.radius)
                : null;
            // The Explore-only layers. Their classes load with the 'explore' bundle on the
            // first enterExploreMode (roast R2 #7b), so here this is usually a no-op;
            // SpaceEnvironment calls it again once the bundle has run.
            this.buildExploreLayers();
            return true;
        } catch (err) {
            console.error('Earth.init: failed to initialize:', err);
            return false;
        }
    }

    /**
     * Build the Explore-only globe layers whose class is loaded and that are not built
     * yet. Idempotent: the classes arrive with LazyBundles 'explore' on the first
     * enterExploreMode (roast R2 #7b), not at boot. Each is a safe no-op if absent.
     * Rule 5: 2 asserts.
     * @returns {number} how many layers were built by this call
     */
    buildExploreLayers() {
        console.assert(this.data && this.data.radius > 0, 'Earth.buildExploreLayers: radius required');
        console.assert(typeof window !== 'undefined', 'Earth.buildExploreLayers: window required');
        if (!this.mesh) return 0;
        const r = this.data.radius;
        let n = 0;
        const make = (field, name) => {
            const C = (typeof window[name] === 'function') ? window[name] : null;
            if (this[field] || !C) return;
            this[field] = new C(this.mesh, r);
            n++;
        };
        make('geoLOD', 'GeoLOD');                         // zoom-LOD geography overlays
        make('streetTiles', 'StreetTiles');               // high-zoom street tiles
        make('atmosphereLayers', 'AtmosphereLayers');     // atmospheric shells
        make('troposphereObjects', 'TroposphereObjects'); // balloons/jets
        make('auroraOval', 'AuroraOval');                 // Kp-sized aurora ovals
        make('explorePins', 'ExplorePins');               // user-saved pins (loads persisted)
        // Live presence markers (ephemeral; online visitors). Renderer only - the
        // Presence controller + opt-in UI live in SpaceEnvironment. Hidden until enabled.
        make('presencePins', 'PresencePins');
        return n;
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
                // Cloud shadows: strength 0 skips the whole block in the shader, so the
                // solar-system view pays nothing until Explore turns them on.
                cloudMap: { value: null },
                uCloudShadow: { value: 0.0 },
                uCloudU: { value: 0.0 },
                uCloudHeight: { value: 0.05 / this.data.radius },
                uSunLocal: { value: this._sunLocal },
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

        this._dayLow = dayMap;
        this.mesh = new THREE.Mesh(geometry, material);
        // Axial tilt about world +x = the vernal-equinox direction (OrbitalCalculator's
        // scene frame). NEGATIVE so the north pole leans toward ecliptic longitude 90
        // (world -z), where the Sun is seen from Earth at the June solstice. The old +23.4
        // leaned it the other way, which swapped the seasons (R1 #1). rotation.y is GMST.
        this.mesh.rotation.x = -THREE.MathUtils.degToRad(this.data.axialTilt || 0);
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
            'uniform sampler2D cloudMap;',
            'uniform float uCloudShadow;',
            'uniform float uCloudU;',
            'uniform float uCloudHeight;',
            'uniform vec3 uSunLocal;',
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
            '  float dayMix = smoothstep(-0.08, 0.08, sunFactor);'
        ]).concat(this.getCloudShadowBlock()).concat([
            '  vec3 dayColor = texture2D(dayTexture, vUv).rgb;',
            '  vec3 nightColor = texture2D(nightTexture, vUv).rgb;',
            // G4: tone-mapped city lights + small bluish earthshine floor.
            '  vec3 cityLights = nightColor * 3.5;',
            '  cityLights = cityLights / (cityLights + vec3(0.5));',
            '  vec3 nightSide = cityLights + vec3(0.005, 0.008, 0.015);',
            '  float diffuse = max(sunFactor, 0.0);',
            '  vec3 litDay = dayColor * (0.35 + 0.75 * bumpDiffuse * cloudShade);',
            '  vec3 baseColor = mix(nightSide, litDay, dayMix);',
            // G3: specular only where the sun actually hits, only with a spec map.
            '  vec3 viewDir = normalize(cameraPosition - vPosition);',
            '  vec3 reflectDir = reflect(-sunDir, normal);',
            '  float spec = pow(max(dot(viewDir, reflectDir), 0.0), 20.0);',
            '  float specMask = mix(0.0, texture2D(specularMap, vUv).r, hasSpecular);',
            '  float sunGate = step(0.0, sunFactor) * diffuse;',
            '  vec3 specColor = vec3(1.0) * spec * specMask * sunGate * 0.6 * cloudShade;',
            // uSurfaceDim darkens the base globe at close zoom (1.0 far → ~0.22 close)
            // so where the satellite tiles have not loaded/reached, the low-res base
            // reads as a neutral dark surface instead of a blurry "old picture".
            '  gl_FragColor = vec4((baseColor + specColor) * uSurfaceDim, 1.0);',
            '}'
        ]).join('\n');
    }

    // Cloud shadows. A surface point is shaded by the cloud that sits between it and the
    // sun: walk along the sun direction up to the cloud shell, in this point's east/north
    // frame (globe-local, the same space as the UVs), and read the cloud map there. The
    // shift is added to vUv rather than solved with atan, so there is no seam at the
    // date line. The cloud map is white cloud on blue, so its red channel is the cover.
    // Only the direct sun term is dimmed: ambient stays, as in a real shadow.
    getCloudShadowBlock() {
        return [
            '  float cloudShade = 1.0;',
            '  if (uCloudShadow > 0.001) {',
            '    float phi = vUv.x * 6.2831853;',
            '    float theta = (1.0 - vUv.y) * 3.1415927;',
            '    float sP = sin(phi);',
            '    float cP = cos(phi);',
            '    float sT = sin(theta);',
            '    float cT = cos(theta);',
            '    vec3 up = vec3(-cP * sT, cT, sP * sT);',
            '    vec3 east = vec3(sP, 0.0, cP);',
            '    vec3 north = vec3(cP * cT, sT, -sP * cT);',
            '    float climb = uCloudHeight / max(dot(up, uSunLocal), 0.2);',
            '    vec2 shift = climb * vec2(dot(uSunLocal, east) / (6.2831853 * max(sT, 0.15)),',
            '                              dot(uSunLocal, north) / 3.1415927);',
            '    float cover = texture2D(cloudMap, vUv + shift + vec2(uCloudU, 0.0), 1.5).r;',
            '    cloudShade = 1.0 - uCloudShadow * 0.6 * smoothstep(0.35, 0.9, cover);',
            '  }'
        ];
    }

    // The cloud map has no alpha: it is white cloud on a blue sheet, so at opacity 0.8 the
    // shell paints the whole globe turquoise and hides the day map. With the cut on, the
    // blue goes clear and only white cloud remains, which is what lets the 4k map and the
    // shadows show. Off by default, so the solar-system view looks exactly as before.
    _addCloudCut(material) {
        console.assert(material && material.isMaterial, 'Earth._addCloudCut: material required');
        console.assert(this._cloudCut, 'Earth._addCloudCut: uniform required');
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uCloudCut = this._cloudCut;
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', 'uniform float uCloudCut;\n#include <common>')
                .replace('#include <map_fragment>', [
                    '#include <map_fragment>',
                    'float cloudCover = smoothstep(0.35, 0.9, diffuseColor.r);',
                    'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97), uCloudCut);',
                    'diffuseColor.a *= mix(1.0, cloudCover, uCloudCut);'
                ].join('\n'));
        };
    }

    /**
     * Turn the Explore-only surface detail on or off. On: cloud shadows are allowed and the
     * 4k day map starts loading in the background; the 1k map keeps showing until it lands,
     * and stays if it fails. Off: back to the 1k map, and the 4k copy leaves the GPU (it
     * re-uploads from the kept image on the next Explore).
     * @param {boolean} on
     * @param {{cloudShadows:boolean, highRes:boolean}} [allow] - device gates, from the caller
     * @returns {boolean} the new state
     */
    setExploreDetail(on, allow) {
        console.assert(typeof on === 'boolean', 'Earth.setExploreDetail: boolean required');
        console.assert(this.mesh, 'Earth.setExploreDetail: mesh required');
        const uniforms = this.mesh && this.mesh.material && this.mesh.material.uniforms;
        if (!uniforms) return false;
        this._exploreDetailOn = on;
        this._cloudShadowsAllowed = !!(on && allow && allow.cloudShadows);
        if (!this._cloudShadowsAllowed) uniforms.uCloudShadow.value = 0;
        this._cloudCut.value = on ? 1 : 0;       // costs nothing, so every device gets it
        if (on) {
            if (allow && allow.highRes) this._useHighResDay();
        } else {
            uniforms.dayTexture.value = this._dayLow;
            if (this._dayHigh) this._dayHigh.dispose();
        }
        return on;
    }

    // Load (once) and swap in the 4k day map. Never throws: failure leaves the 1k map on.
    async _useHighResDay() {
        console.assert(this.resourceLoader, 'Earth._useHighResDay: loader required');
        console.assert(this._dayLow, 'Earth._useHighResDay: low-res map required');
        if (!this.data.dayHighResPath) return false;
        try {
            const tex = await this.resourceLoader.loadTexture(this.data.dayHighResPath);
            tex.anisotropy = 8;
            tex.wrapS = THREE.RepeatWrapping;
            this._dayHigh = tex;
            const uniforms = this.mesh && this.mesh.material && this.mesh.material.uniforms;
            // The user may have left Explore while this was loading.
            if (uniforms && this._exploreDetailOn) uniforms.dayTexture.value = tex;
            return true;
        } catch (err) {
            console.warn('Earth: 4k day map unavailable, keeping 1k:', err);
            return false;
        }
    }

    /**
     * Set the cloud shadow strength for this frame (0..1) and refresh what the shader needs:
     * the sun in globe-local space, and the drift of the cloud shell over the surface.
     * @param {number} strength
     * @returns {boolean} true when shadows are drawn
     */
    setCloudShadow(strength) {
        console.assert(Number.isFinite(strength), 'Earth.setCloudShadow: strength required');
        console.assert(this.mesh, 'Earth.setCloudShadow: mesh required');
        const uniforms = this.mesh && this.mesh.material && this.mesh.material.uniforms;
        if (!uniforms || !this.cloudsMesh || !uniforms.cloudMap.value) return false;
        const value = this._cloudShadowsAllowed ? Math.max(0, Math.min(1, strength)) : 0;
        uniforms.uCloudShadow.value = value;
        if (value <= 0) return false;
        // The globe's matrix is pure rotation here, so its transpose is the inverse.
        this.mesh.updateWorldMatrix(false, false);
        this._invRotation.setFromMatrix4(this.mesh.matrixWorld).transpose();
        this._sunLocal.copy(this._sunDir).applyMatrix3(this._invRotation).normalize();
        uniforms.uCloudU.value = -this.cloudsMesh.rotation.y / (Math.PI * 2);
        return true;
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
        this._addCloudCut(cloudsMaterial);
        this.cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
        this.mesh.add(this.cloudsMesh);
        // The surface shader reads this map for cloud shadows; the drift offset takes u
        // past 0..1, so it has to repeat. Harmless for the shell's own 0..1 UVs.
        cloudsTexture.wrapS = THREE.RepeatWrapping;
        cloudsTexture.needsUpdate = true;
        this.mesh.material.uniforms.cloudMap.value = cloudsTexture;
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

        const r = this.data.radius * 1.00060; // graticule — coplanar with the satellite map (in the map, not floating)
        const step = 15;          // degrees between grid lines
        const sample = 5;         // degrees between sampled points along a line
        const verts = [], cols = [];
        // Per-vertex alpha: full to 60 deg, then fading to 0 at the poles, so the meridians
        // no longer meet in a bright starburst (roast R1 #4).
        const fadeA = (lat) => Math.max(0, Math.min(1, (90 - Math.abs(lat)) / 30));
        const pushLine = (pts, lats) => {
            for (let i = 0; i < pts.length - 1; i++) {
                verts.push(pts[i].x, pts[i].y, pts[i].z);
                verts.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
                cols.push(1, 1, 1, fadeA(lats[i]), 1, 1, 1, fadeA(lats[i + 1]));
            }
        };
        // Meridians (constant lng). Only 0/90/180/270 run to the poles; the rest stop at 80.
        for (let lng = -180; lng < 180; lng += step) {
            const pts = [], lats = [];
            const lim = (lng % 90 === 0) ? 90 : 80;
            for (let lat = -lim; lat <= lim; lat += sample) {
                pts.push(GlobeMath.latLngToVector3(lat, lng, r)); lats.push(lat);
            }
            pushLine(pts, lats);
        }
        // Parallels (constant lat, lng -180..180).
        for (let lat = -75; lat <= 75; lat += step) {
            const pts = [], lats = [];
            for (let lng = -180; lng <= 180; lng += sample) {
                pts.push(GlobeMath.latLngToVector3(lat, lng, r)); lats.push(lat);
            }
            pushLine(pts, lats);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 4));
        // Neutral grey and faint: the grid is a reference, not data; blue is for borders.
        const material = new THREE.LineBasicMaterial({
            color: GlobeMarkers.color(Earth.PALETTE.grid), vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false
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

        const r = this.data.radius * 1.00061; // borders — coplanar with the satellite map (in the map, not floating)
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
        // Country borders: the brightest, solid line on the globe (roast R1 #4).
        const material = new THREE.LineBasicMaterial({
            color: GlobeMarkers.color(Earth.PALETTE.border), transparent: true, opacity: 0.85,
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
     * World direction of the Sun from the subsolar point at a given sim time, through
     * the globe's CURRENT rotation (correct even while the globe is frozen).
     * Globe-local axes follow GlobeMath: lng 0 = +x, lng 90E = -z, north = +y.
     * @param {number} j2000Days - days since J2000.0
     * @param {THREE.Vector3} target
     * @returns {THREE.Vector3} target, unit length
     */
    getEarthFixedSunDirection(j2000Days, target) {
        console.assert(Number.isFinite(j2000Days), 'Earth.getEarthFixedSunDirection: days required');
        console.assert(target && target.isVector3 && this.mesh, 'Earth.getEarthFixedSunDirection: Vector3 + mesh required');
        const p = OrbitalCalculator.subsolarPoint(j2000Days);
        const lat = THREE.MathUtils.degToRad(p.lat);
        const lng = THREE.MathUtils.degToRad(p.lng);
        target.set(Math.cos(lat) * Math.cos(lng), Math.sin(lat), -Math.cos(lat) * Math.sin(lng));
        return target.applyQuaternion(this.mesh.quaternion).normalize();
    }

    /**
     * Show the satellites, loading their code on first use. Never rejects.
     * @returns {Promise<boolean>} true when the layer is drawn
     */
    async startSatellites() {
        console.assert(this.mesh, 'Earth.startSatellites: mesh required');
        console.assert(this.data.radius > 0, 'Earth.startSatellites: bad radius');
        this.satsWanted = true;
        this._satsActive = true;
        if (this._satsState !== 'ok') this._satsState = 'loading';
        try {
            await this._loadSatellitesScript();
            // Explore may have ended, or the layer been turned off, during the load.
            if (!this._satsActive || !this.mesh) return false;
            if (!this.satellites) this.satellites = new Satellites(this.mesh, this.data.radius);
            const ok = await this.satellites.start();
            if (this._satsActive) this._satsState = ok ? 'ok' : 'failed';
            return ok;
        } catch (err) {
            console.warn('Earth: satellites unavailable:', err && err.message);
            this._satsState = 'failed';
            return false;
        }
    }

    /** @param {boolean} remember - also save the layer as off (the user's button) */
    hideSatellites(remember) {
        console.assert(typeof remember === 'boolean', 'Earth.hideSatellites: boolean required');
        console.assert(this.layers, 'Earth.hideSatellites: earth state required');
        if (remember) this.satsWanted = false;
        this._satsActive = false;
        if (this.satellites) this.satellites.setVisible(false);
    }

    // Same origin, so CSP script-src 'self' covers it. A failed load may be retried.
    _loadSatellitesScript() {
        console.assert(typeof document !== 'undefined', 'Earth._loadSatellitesScript: document required');
        console.assert(this.data, 'Earth._loadSatellitesScript: data required');
        if (typeof Satellites !== 'undefined') return Promise.resolve(true);
        if (!this._satsScript) {
            this._satsScript = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'src/utils/Satellites.js';
                s.onload = () => resolve(true);
                s.onerror = () => {
                    this._satsScript = null;
                    reject(new Error('Satellites.js failed to load'));
                };
                document.head.appendChild(s);
            });
        }
        return this._satsScript;
    }

    /**
     * Freeze/unfreeze Earth for explore mode. Frozen => no solar orbit / axis
     * spin (update() skips the motion block), but the day/night shader still
     * refreshes so the globe stays lit.
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
    // the day/night sun direction + atmosphere glow every frame.
    update(deltaTime, j2000Days = null) {
        if (!this.mesh) return;

        // Scale View owns every planet's transform while active. This override does NOT
        // call super.update(), so the identical guard in Planet.update() never runs for
        // Earth — without this line Earth was the one body that stayed in its orbit
        // while the other eight lined up. Returning early (rather than relying on
        // `frozen`) keeps the two modes independent: `frozen` is explore mode's flag and
        // is cleared on explore exit, which would silently release Earth mid-lineup.
        // The Moon is no longer a child of the globe, so it would stay behind at Earth's
        // orbital position while Earth stands in the lineup: hide it for that time.
        if (this.freezePosition) {
            if (this.moonGroup && this.moonGroup.visible) {
                this.moonGroup.visible = false;
                this._moonHiddenForScale = true;
            }
            return;
        }
        if (this._moonHiddenForScale && this.moonGroup) {
            this.moonGroup.visible = true;
            this._moonHiddenForScale = false;
        }

        // Frozen (explore mode): skip orbit/spin/clouds/moon so the globe holds
        // still for inspection. Sun + marker refresh below still run.
        if (!this.frozen) {
            // Time-synchronized rotation (respects TimeScaleManager via j2000Days).
            // R1 #1: the spin angle IS Greenwich sidereal time, so the Greenwich meridian
            // faces the equinox direction at the right instant. The old count of sidereal
            // turns since J2000 had no anchor (GMST at J2000 is 280.46 deg) and set noon
            // over Baja California at 06:33Z.
            if (j2000Days !== null && this.data.rotationPeriodHours) {
                const rotationsPerJ2000Day = 24 / this.data.rotationPeriodHours;
                const totalRotations = j2000Days * rotationsPerJ2000Day;
                this.mesh.rotation.y = (typeof OrbitalCalculator !== 'undefined')
                    ? THREE.MathUtils.degToRad(OrbitalCalculator.gmstDeg(j2000Days))
                    : (totalRotations * Math.PI * 2) % (Math.PI * 2);
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
                const epochAnomaly = (typeof this.epochAnomaly === 'number') ? this.epochAnomaly
                    : ((this.data.orbitalElements && this.data.orbitalElements.meanAnomalyAtEpoch) || 0);
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
        }

        // The Moon runs on the sim clock even in Explore: it is not part of the frozen
        // globe (R1 #2), so freezing the globe for inspection must not stop it.
        this._lastJ2000Days = j2000Days;
        if (this.moonGroup) this.moonGroup.position.copy(this.mesh.position);
        for (let i = 0; i < this.moons.length; i++) {
            if (this.moons[i].update) {
                this.moons[i].update(deltaTime, j2000Days);
            }
        }

        // Refresh sun direction for the day/night shader (no per-frame alloc).
        // Free-running: the direction to the Sun at the origin - true, because the orbit
        // and the GMST spin are. Frozen (Explore): the globe holds still for inspection,
        // so the Sun is moved instead - the Earth-fixed subsolar point at the sim clock
        // (pinned to the wall clock in Explore, see SpaceEnvironment._pinExploreClock),
        // turned into world space by the frozen globe's own rotation. The terminator then
        // keeps time with the satellites, which also run on the wall clock.
        if (this.frozen && j2000Days !== null && typeof OrbitalCalculator !== 'undefined') {
            this.getEarthFixedSunDirection(j2000Days, this._sunDir);
        } else {
            this.getSunDirection(this._sunDir);
        }
        if (this.mesh.material && this.mesh.material.uniforms) {
            this.mesh.material.uniforms.sunDirection.value = this._sunDir;
        }
        // G2: keep the atmosphere glow locked to the same sun direction so the
        // halo concentrates on the lit limb (shares the _sunDir Vector3).
        if (this.atmosphereMesh && this.atmosphereMesh.material &&
            this.atmosphereMesh.material.uniforms) {
            this.atmosphereMesh.material.uniforms.sunDirection.value = this._sunDir;
        }
    }

    async createMoon() {
        // R1 #2: the Moon's pivot is NOT a child of the globe. As a child it inherited
        // one full turn per sidereal day from the spin (measured -97 deg in 6 h; the real
        // Moon moves ~3.3) and orbited in the tilted equator plane. The pivot sits in the
        // scene and follows Earth's centre each frame (Earth.update); it never rotates.
        this.moonGroup = new THREE.Group();
        this.scene.add(this.moonGroup);
        this.moonGroup.position.copy(this.mesh.position);

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

        const moonState = { mesh: moonMesh, orbit: { angle: 0 }, data: this.moonData };
        // Geocentric ecliptic longitude/latitude from the sim clock (~13.2 deg/day, the
        // real 5 deg tilt to the ecliptic), placed in the scene frame of
        // OrbitalCalculator (lon 0 = +x, lon 90 = -z, ecliptic north = +y). Tidally
        // locked: the texture's lng 0 (local +x) - the near side - always faces Earth.
        // Without a clock it falls back to a constant-speed ecliptic circle.
        moonState.update = (dt, j2000Days = null) => {
            let lon = moonState.orbit.angle;
            let lat = 0;
            if (j2000Days !== null && typeof OrbitalCalculator !== 'undefined') {
                const m = OrbitalCalculator.moonEcliptic(j2000Days);
                lon = THREE.MathUtils.degToRad(m.lon);
                lat = THREE.MathUtils.degToRad(m.lat);
            } else {
                lon += this.moonData.orbitSpeed * dt;
            }
            moonState.orbit.angle = lon;
            const r = this.moonData.distance;
            moonMesh.position.set(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat),
                -r * Math.cos(lat) * Math.sin(lon));
            moonMesh.rotation.y = lon + Math.PI;
            return lon;
        };
        this.moons.push(moonState);
        moonState.update(0, this._lastJ2000Days === undefined ? null : this._lastJ2000Days);
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

    // One GlobeMarkers instance holds the places / quakes / ISS layers: one Points draw
    // per layer, constant pixel size, linear colours, screen-space picking (audit F3).
    _ensureMarkers() {
        console.assert(this.mesh, 'Earth._ensureMarkers: mesh required');
        if (this.markers) return this.markers;
        if (typeof GlobeMarkers === 'undefined') {
            console.error('Earth._ensureMarkers: GlobeMarkers missing');
            return null;
        }
        this.markers = new GlobeMarkers(this.mesh, this.data.radius);
        console.assert(this.markers, 'Earth._ensureMarkers: create failed');
        return this.markers;
    }

    // Curated places of interest (static, no API). Click -> detail card.
    buildPois() {
        console.assert(this.mesh, 'Earth.buildPois: mesh required');
        if (this.layers.pois) return this.layers.pois;
        const mk = this._ensureMarkers();
        if (!mk) return null;
        const places = [
            { name: 'London', lat: 51.5074, lng: -0.1278, info: 'Open to remote / relocation' },
            { name: 'Tokyo', lat: 35.6762, lng: 139.6503, info: 'Open to remote / relocation' },
            { name: 'New York', lat: 40.7128, lng: -74.0060, info: 'Open to remote / relocation' }
        ];
        // Places own yellow and the diamond shape + a name label (quakes are orange-purple
        // discs, cities warm-white dots), so a place never reads as a quake or a city.
        const group = mk.addLayer('pois', { clusterPx: 0, labels: true });
        mk.setItems('pois', places.map((p) => ({ lat: p.lat, lng: p.lng, alt: 1.0009, color: Earth.PALETTE.place,
            size: 15, shape: 1, rank: 1, data: { type: 'place', name: p.name, info: p.info } })));
        this.layers.pois = group;
        return group;
    }

    // Live earthquakes (USGS, keyless + CORS). Colour + size by magnitude, clustered
    // on screen where they pile up (Pacific ring at far zoom). Builds on the first good
    // reply; refreshQuakes() keeps it current while Explore runs (startQuakeRefresh).
    async buildQuakes() {
        console.assert(this.mesh, 'Earth.buildQuakes: mesh required');
        console.assert(this.feeds && this.feeds.quakes, 'Earth.buildQuakes: feed state required');
        if (this.layers.quakes) return this.layers.quakes;
        await this.refreshQuakes();
        return this.layers.quakes || null;
    }

    /**
     * Fetch the USGS day feed and (re)draw the layer. A failure keeps the last drawn
     * quakes and is recorded in feeds.quakes, so the panel can say "stale" or "offline"
     * (roast R3 #5, R1 #7). Never rejects. Rule 5: 2 asserts.
     * @returns {Promise<boolean>} true when the layer holds data from the last reply
     */
    refreshQuakes() {
        console.assert(this.mesh, 'Earth.refreshQuakes: mesh required');
        console.assert(this.feeds && this.feeds.quakes, 'Earth.refreshQuakes: feed state required');
        if (this._quakesInFlight) return this._quakesInFlight;
        if (typeof SafeFetch === 'undefined') return Promise.resolve(false);
        const st = this.feeds.quakes;
        const url = Earth.QUAKES_URL;
        this._quakesInFlight = (async () => {
            const data = await SafeFetch.json(url, { ttl: Earth.QUAKE_REFRESH_MS - 30000 });
            const at = SafeFetch.fetchedAt(url);
            if (!data || !Array.isArray(data.features) || SafeFetch.failing(url)) {
                st.failAt = Date.now();
                console.warn('Earth.refreshQuakes: no fresh USGS data');
                return false;
            }
            if (this.layers.quakes && at === st.okAt) return true;   // cache hit, nothing new
            const mk = this._ensureMarkers();
            if (!mk) return false;
            const items = Earth.quakeItems(data.features);
            if (!this.layers.quakes) {
                this.layers.quakes = mk.addLayer('quakes', { clusterPx: 14, clusterNoun: 'earthquakes' });
                this.layers.quakes.visible = !!this.quakesWanted;
            }
            mk.setItems('quakes', items);
            st.okAt = at || Date.now();
            st.failAt = 0;
            st.count = items.length;
            return true;
        })().finally(() => { this._quakesInFlight = null; });
        return this._quakesInFlight;
    }

    /**
     * USGS features -> marker items. A quake with no reported magnitude is "M?" with a
     * neutral grey marker, never an invented M2.5 (R1 #7). Rule 2: bounded.
     * @param {Array} features
     * @returns {Array}
     */
    static quakeItems(features) {
        console.assert(Array.isArray(features), 'Earth.quakeItems: features required');
        console.assert(typeof GlobeMarkers !== 'undefined', 'Earth.quakeItems: GlobeMarkers required');
        const items = [];
        const max = Math.min(features.length, 250);   // Rule 2: bounded
        for (let i = 0; i < max; i++) {
            const f = features[i];
            if (!f || !f.geometry || !Array.isArray(f.geometry.coordinates)) continue;
            const c = f.geometry.coordinates;
            const lng = Number(c[0]), lat = Number(c[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            const p = f.properties || {};
            // Number(null) is 0, so test for a real number first.
            const known = typeof p.mag === 'number' && Number.isFinite(p.mag);
            const mag = known ? p.mag : 2.5;              // size only; the label says "M?"
            const info = [p.place || 'Location not given'];
            if (Number.isFinite(p.time)) info.push(new Date(p.time).toISOString().slice(11, 16) + ' UTC');
            if (typeof c[2] === 'number' && Number.isFinite(c[2])) info.push(Math.round(c[2]) + ' km deep');
            if (!known) info.push('magnitude not reported');
            items.push({ lat: lat, lng: lng, alt: 1.0009,
                color: known ? GlobeMarkers.quakeColor(mag) : Earth.QUAKE_UNKNOWN_COLOR,
                size: GlobeMarkers.quakeSize(mag), rank: known ? mag : 0,
                data: { type: 'quake', name: known ? 'M' + mag.toFixed(1) + ' earthquake' : 'M? earthquake',
                    info: info.join(' · ') } });
        }
        return items;
    }

    // Refresh the quakes every QUAKE_REFRESH_MS while Explore runs (USGS updates the feed
    // each minute), sooner after a failure. Explore calls stopQuakeRefresh on exit.
    startQuakeRefresh() {
        console.assert(this.feeds && this.feeds.quakes, 'Earth.startQuakeRefresh: feed state required');
        console.assert(Earth.QUAKE_REFRESH_MS >= 60000, 'Earth.startQuakeRefresh: cadence too fast');
        if (this._quakeLoopOn) return;
        this._quakeLoopOn = true;
        const st = this.feeds.quakes;
        const delay = () => (st.failAt > st.okAt ? Earth.QUAKE_RETRY_MS : Earth.QUAKE_REFRESH_MS);
        const step = async () => {
            if (!this._quakeLoopOn) return;
            const hidden = typeof document !== 'undefined' && document.hidden;
            if (this.quakesWanted && !hidden) await this.refreshQuakes();
            if (this._quakeLoopOn) this._quakeTimer = setTimeout(step, delay());
        };
        this._quakeTimer = setTimeout(step, delay());
    }

    stopQuakeRefresh() {
        this._quakeLoopOn = false;
        if (this._quakeTimer) { clearTimeout(this._quakeTimer); this._quakeTimer = null; }
    }

    // ISS live position (wheretheiss.at, keyless + CORS). Polls while shown.
    // One ISS on the globe: while this marker is on and placed, Satellites.js skips its ISS
    // dot (SpaceEnvironment passes issMarkerShown() to Satellites.setView each frame).
    // A fix older than ISS_STALE_MS hides the marker, so a dead feed never leaves a frozen
    // ISS on the globe; the SGP4 dot comes back instead (R1 #7).
    startISS() {
        console.assert(this.mesh, 'Earth.startISS: mesh required');
        console.assert(this.feeds && this.feeds.iss, 'Earth.startISS: feed state required');
        if (this._issTimer) return;
        this._ensureIssMarker();
        const st = this.feeds.iss;
        const url = Earth.ISS_URL;
        const poll = async () => {
            this._issStaleCheck(Date.now());
            if (typeof document !== 'undefined' && document.hidden) return;   // pause when hidden
            // R2 #8: no request while the marker is not drawn (zoomed in past the pin fade,
            // or its layer hidden). issPollIfResumed() fetches at once when it shows again.
            if (this._issMarkerFaded()) { st.paused = true; return; }
            st.paused = false;
            if (typeof SafeFetch === 'undefined') return;
            const d = await SafeFetch.json(url, { ttl: 4000 });
            const ok = d && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)
                && !SafeFetch.failing(url);
            if (!ok) st.failAt = Date.now();
            else if (this.markers && this.layers.iss && SafeFetch.fetchedAt(url) > st.okAt) {
                st.okAt = SafeFetch.fetchedAt(url);
                st.failAt = 0;
                const altKm = (Number.isFinite(d.altitude) && d.altitude > 100) ? d.altitude : 420;
                this.markers.setItemPosition('iss', 0, d.latitude, d.longitude, 1 + altKm / 6371);
                const info = this.markers.itemData('iss', 0);
                const parts = [];
                if (Number.isFinite(d.altitude)) parts.push('Alt ' + Math.round(d.altitude) + ' km');
                if (Number.isFinite(d.velocity)) parts.push(Math.round(d.velocity) + ' km/h');
                if (info) info.info = parts.length ? parts.join(' · ') : 'International Space Station';
            }
            this._issStaleCheck(Date.now());
        };
        this._issPoll = poll;
        poll();
        this._issTimer = setInterval(poll, 5000);   // 5s cadence
    }

    // True while the ISS marker is not drawn: its layer is hidden, or the zoom fade put it
    // out (GlobeMarkers.update draws nothing at fade <= 0.01). Rule 5: 2 asserts.
    _issMarkerFaded() {
        console.assert(this.layers, 'Earth._issMarkerFaded: layers required');
        console.assert(!this.markers || Number.isFinite(this.markers.fade), 'Earth._issMarkerFaded: bad fade');
        if (!this.layers.iss || !this.layers.iss.visible) return true;
        return !!(this.markers && this.markers.fade <= 0.01);
    }

    /**
     * Per frame from Explore, after markers.update: polling was paused while the marker
     * was not drawn; once it shows again, fetch now instead of waiting up to 5 s. Rule 5.
     * @returns {boolean} true when a poll was started
     */
    issPollIfResumed() {
        console.assert(this.feeds && this.feeds.iss, 'Earth.issPollIfResumed: feed state required');
        console.assert(!this._issPoll || typeof this._issPoll === 'function', 'Earth.issPollIfResumed: bad poll');
        if (!this._issTimer || !this._issPoll || !this.feeds.iss.paused || this._issMarkerFaded()) return false;
        this.feeds.iss.paused = false;
        this._issPoll();
        return true;
    }

    // Hide the ISS marker once its last fix is older than ISS_STALE_MS. Rule 5: 2 asserts.
    _issStaleCheck(now) {
        console.assert(Number.isFinite(now), 'Earth._issStaleCheck: time required');
        console.assert(this.feeds && this.feeds.iss, 'Earth._issStaleCheck: feed state required');
        const L = this.markers && this.markers.layers && this.markers.layers.iss;
        if (!L || !L.items[0]) return false;
        const stale = now - this.feeds.iss.okAt > Earth.ISS_STALE_MS;
        if (stale) L.items[0].hidden = true;
        return stale;
    }

    _ensureIssMarker() {
        if (this.layers.iss) return;
        const mk = this._ensureMarkers();
        if (!mk) return;
        const group = mk.addLayer('iss', { clusterPx: 0 });
        // Hidden until the first position fix (it used to sit at 0,0 until then).
        // R1 #12: the ISS is a station, so it takes the Stations pink (it replaces that
        // group's SGP4 dot). Its old mint 0x66ffcc was 15 dE from the GPS mint 0x7dffb0.
        const issColor = Earth.PALETTE.satStation || 0xff6ad3;
        mk.setItems('iss', [{ lat: 0, lng: 0, alt: 1.06, color: issColor, size: 9, rank: 2, hidden: true,
            data: { type: 'iss', name: 'ISS (Zarya)', info: 'International Space Station' } }]);
        this.layers.iss = group;
    }

    // True while the ISS marker is on AND has a fresh fix: only then does it replace the
    // satellite layer's ISS dot (a dead wheretheiss.at feed leaves the SGP4 dot). Rule 5.
    issMarkerShown() {
        console.assert(this.layers, 'Earth.issMarkerShown: layers required');
        const L = this.markers && this.markers.layers && this.markers.layers.iss;
        console.assert(!L || Array.isArray(L.items), 'Earth.issMarkerShown: bad layer');
        return !!(this.layers.iss && this.layers.iss.visible && L && L.items[0] && !L.items[0].hidden
            && Date.now() - this.feeds.iss.okAt <= Earth.ISS_STALE_MS);
    }

    stopISS() {
        if (this._issTimer) { clearInterval(this._issTimer); this._issTimer = null; }
        if (this.feeds && this.feeds.iss) this.feeds.iss.paused = false;
    }

    /**
     * One short status line per live layer for the Layers tab (roast R3 #5): what the
     * user sees on the globe and how old it is. Rule 5: 2 asserts.
     * @param {string} name - 'iss' | 'quakes' | 'sats' | 'aurora'
     * @param {number} [now]
     * @returns {{state:string, text:string}} state: off | loading | live | stale | offline
     */
    feedStatus(name, now) {
        console.assert(name === 'iss' || name === 'quakes' || name === 'sats' || name === 'aurora',
            'Earth.feedStatus: bad name');
        console.assert(this.feeds, 'Earth.feedStatus: feed state required');
        if (name === 'sats') return this._satsStatus();
        if (name === 'aurora') {
            // The Kp line (P42): no switch, the ovals ride the Thermosphere layer.
            return this.auroraOval ? this.auroraOval.status(now) : { state: 'off', text: 'off' };
        }
        const t = Number.isFinite(now) ? now : Date.now();
        const hm = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const wanted = name === 'iss' ? this.issWanted : this.quakesWanted;
        if (!wanted) return { state: 'off', text: 'off' };
        const st = this.feeds[name];
        const maxAge = name === 'iss' ? Earth.ISS_STALE_MS : 2 * Earth.QUAKE_REFRESH_MS + 60000;
        if (!st.okAt && !st.failAt) return { state: 'loading', text: 'loading…' };
        if (!st.okAt) return { state: 'offline', text: 'offline - retrying' };
        // R2 #8: a paused ISS poll (marker zoomed out of view) is not a lost signal.
        const paused = name === 'iss' && st.paused && st.failAt <= st.okAt;
        if (!paused && (st.failAt > st.okAt || t - st.okAt > maxAge)) {
            const sgp4 = name === 'iss' && this.satellites && this.satellites.visible;
            const what = name === 'iss' ? 'signal lost since ' : 'stale since ';
            return { state: 'stale', text: what + hm(st.okAt) + ' - retrying' + (sgp4 ? ' · orbit estimate shown' : '') };
        }
        const tail = name === 'quakes' ? ' · ' + st.count + ' in 24 h' : '';
        return { state: 'live', text: 'live · updated ' + hm(st.okAt) + tail };
    }

    // Satellites: orbits come from the bundled snapshot or the cache, refreshed only on the
    // live host once per FETCH_GAP_MS, so the line says how old they are. Rule 5: 2 asserts.
    _satsStatus() {
        console.assert(typeof this.satsWanted === 'boolean', 'Earth._satsStatus: wanted flag required');
        const s = this.satellites;
        console.assert(s === null || typeof s === 'object', 'Earth._satsStatus: bad layer');
        if (!this.satsWanted) return { state: 'off', text: 'off' };
        if (this._satsState === 'failed') return { state: 'offline', text: 'unavailable - no recent orbit data' };
        if (!s || !s.count || this._satsState !== 'ok') return { state: 'loading', text: 'loading…' };
        const asOf = s.asOf();
        const day = asOf ? new Date(asOf).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '?';
        const old = s.agedOutGroups();
        const text = s.count + ' objects · orbits as of ' + day + (old.length ? ' · no recent orbits: ' + old.join(', ') : '');
        return { state: old.length ? 'stale' : 'live', text: text };
    }

    // Toggle a built layer's visibility. Rule 5: 2 asserts.
    setLayerVisible(name, vis) {
        console.assert(typeof name === 'string', 'Earth.setLayerVisible: name required');
        console.assert(this.layers, 'Earth.setLayerVisible: layers map required');
        const obj = this.layers[name];
        if (obj) obj.visible = !!vis;
        if (this.markers) this.markers.syncVisibility();   // drop count badges of hidden layers
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
        const r = this.data.radius * 1.00063; // country highlight — coplanar with the satellite map (in the map)
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

    // ---- Cascade hover: country → state → county ----

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
        Earth.disposeMesh(this.atmosphereMesh);
        // Explore overlays: BufferGeometry + LineBasicMaterial, no textures.
        Earth.disposeMesh(this.graticule);
        Earth.disposeMesh(this.borders);
        this.graticule = null;
        this.borders = null;

        // Live data layers: stop ISS polling + dispose marker meshes (no cached textures).
        this.stopISS();
        if (this.markers) { this.markers.dispose(); this.markers = null; }
        ['iss', 'quakes', 'pois'].forEach((k) => { this.layers[k] = null; });
        this.pickables = [];
        if (this.countryHighlight) { Earth.disposeMesh(this.countryHighlight); this.countryHighlight = null; }
        this.countryShapes = null;
        this._hoverCountry = null;
        if (this.regionHighlight) { Earth.disposeMesh(this.regionHighlight); this.regionHighlight = null; }
        this.regionTiers = {};
        this._hoverRegionKey = null;
        if (this._dayHigh) { this._dayHigh.dispose(); this._dayHigh = null; }
        if (this.geoLOD) { this.geoLOD.dispose(); this.geoLOD = null; }
        if (this.streetTiles) { this.streetTiles.dispose(); this.streetTiles = null; }
        if (this.satelliteTiles) { this.satelliteTiles.dispose(); this.satelliteTiles = null; }
        if (this.atmosphereLayers) { this.atmosphereLayers.dispose(); this.atmosphereLayers = null; }
        if (this.troposphereObjects) { this.troposphereObjects.dispose(); this.troposphereObjects = null; }
        if (this.auroraOval) { this.auroraOval.dispose(); this.auroraOval = null; }
        if (this.satellites) { this.satellites.dispose(); this.satellites = null; }
        if (this.explorePins) { this.explorePins.dispose(); this.explorePins = null; }
        if (this.presencePins) { this.presencePins.dispose(); this.presencePins = null; }
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
// picks the FINEST loaded tier whose showTo covers the current distance. A missing
// file is skipped (buildRegionTiers). No single-city tiers (F3, privacy): every
// place on the globe gets the same detail. Classic-script static (defined after the class, not a field).
Earth.REGION_TIER_DEFS = [
    { key: 'country',  url: 'src/assets/geo/country_shapes.json',     color: 0xffe680, rOffset: 1.00061, showTo: Infinity },
    { key: 'state',    url: 'src/assets/geo/states-named.json',       color: 0x9fe0ff, rOffset: 1.00062, showTo: 2.4 },
    { key: 'county',   url: 'src/assets/geo/counties-us-named.json',  color: 0xb6ffd0, rOffset: 1.00063, showTo: 1.7 }
];

// The globe palette lives in GlobeMarkers.PALETTE (loaded first, see index.html).
Earth.PALETTE = (typeof GlobeMarkers !== 'undefined' && GlobeMarkers.PALETTE) ? GlobeMarkers.PALETTE
    : { place: 0xffe14a, border: 0x8fe3ff, grid: 0xb4bcc6 };

// Live feeds. USGS rebuilds its day feed every minute; five minutes is plenty for a globe.
Earth.QUAKES_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
Earth.QUAKE_REFRESH_MS = 300000;
Earth.QUAKE_RETRY_MS = 60000;          // after a failure (SafeFetch's breaker also cools 60 s)
Earth.QUAKE_UNKNOWN_COLOR = 0x9aa3ad;  // neutral grey: magnitude not reported ("M?")
Earth.ISS_URL = 'https://api.wheretheiss.at/v1/satellites/25544';
Earth.ISS_STALE_MS = 30000;            // older fix = marker hidden, SGP4 dot shown instead

// Make globally available (matches the rest of the codebase).
if (typeof window !== 'undefined') {
    window.Earth = Earth;
}
