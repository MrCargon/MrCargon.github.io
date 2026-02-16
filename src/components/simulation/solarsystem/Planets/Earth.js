// Earth.js - Enhanced with Phase 1: Day/Night Shader, Normal Mapping, Accurate Rotation
// Roaster-approved specification implementation (2026-01-01)
class Earth extends Planet {
    constructor(scene, resourceLoader, data) {
        super(scene, resourceLoader, data);

        // NASA Rule 5: Validate constructor parameters
        console.assert(scene && resourceLoader && data,
            "Earth.constructor: Missing required dependencies");

        this.moonData = {
            radius: 0.5,
            distance: 5,
            rotationSpeed: 0.02,
            orbitSpeed: 0.05,
            texturePath: "src/assets/textures/planets/earth/moon/moon_map.jpg",
            bumpMapPath: "src/assets/textures/planets/earth/moon/moon_bump.jpg"
        };

        this.sunDirection = new THREE.Vector3(1, 0, 0);
        this.cloudsMesh = null;
    }

    async init() {
        console.assert(this.scene && this.resourceLoader && this.data,
            "Earth.init: Missing required dependencies");

        const texturePromises = [
            this.resourceLoader.loadTexture(this.data.texturePath),
            this.resourceLoader.loadTexture(this.data.nightLightsPath),
            this.resourceLoader.loadTexture(this.data.normalMapPath),
            this.resourceLoader.loadTexture(this.data.cloudsPath),
            this.resourceLoader.loadTexture(this.data.specularMapPath)
        ];

        const [dayMap, nightMap, normalMap, cloudsMap, specularMap] =
            await Promise.all(texturePromises);

        if (!dayMap || !nightMap || !normalMap || !specularMap) {
            console.error("Earth.init: Critical textures failed to load, using fallback");
            return await super.init();
        }

        const geometry = new THREE.SphereGeometry(this.data.radius, 64, 64);

        const shaderMaterial = new THREE.ShaderMaterial({
            uniforms: {
                dayTexture: { value: dayMap },
                nightTexture: { value: nightMap },
                normalMap: { value: normalMap },
                specularMap: { value: specularMap },
                sunDirection: { value: this.sunDirection }
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            lights: false,
            transparent: false,
            depthWrite: true,
            side: THREE.FrontSide,
            blending: THREE.NoBlending
        });

        // Validate shader uniforms are properly set
        if (!shaderMaterial.uniforms.dayTexture.value ||
            !shaderMaterial.uniforms.nightTexture.value ||
            !shaderMaterial.uniforms.normalMap.value ||
            !shaderMaterial.uniforms.specularMap.value) {
            console.error("Earth.init: Shader uniforms incomplete, using fallback");
            return await super.init();
        }

        this.mesh = new THREE.Mesh(geometry, shaderMaterial);

        const tiltRadians = THREE.MathUtils.degToRad(this.data.axialTilt || 0);
        this.mesh.rotation.x = tiltRadians;

        this.orbit = { angle: Math.random() * Math.PI * 2 };
        this.updatePosition();

        this.scene.add(this.mesh);

        if (cloudsMap) {
            await this.createClouds(cloudsMap);
        }

        await this.createMoon();

        return true;
    }

    getVertexShader() {
        return `
            varying vec2 vUv;
            varying vec3 vWorldNormal;
            varying vec3 vPosition;

            void main() {
                vUv = uv;
                vWorldNormal = normalize(normalMatrix * normal);
                vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
    }

    getFragmentShader() {
        return `
            precision mediump float;

            uniform sampler2D dayTexture;
            uniform sampler2D nightTexture;
            uniform sampler2D normalMap;
            uniform sampler2D specularMap;
            uniform vec3 sunDirection;

            varying vec2 vUv;
            varying vec3 vWorldNormal;
            varying vec3 vPosition;

            const float TWILIGHT_START = -0.1;
            const float TWILIGHT_END = 0.3;
            const float SPECULAR_POWER = 20.0;

            void main() {
                vec3 dayColor = texture2D(dayTexture, vUv).rgb;
                vec3 nightColor = texture2D(nightTexture, vUv).rgb;
                vec3 normalMapColor = texture2D(normalMap, vUv).rgb;
                float specularIntensity = texture2D(specularMap, vUv).r;

                vec3 tangentNormal = (normalMapColor * 2.0) - 1.0;
                vec3 normal = normalize(vWorldNormal + (tangentNormal * 0.3));

                float sunFactor = dot(normal, normalize(sunDirection));
                float dayNightMix = smoothstep(TWILIGHT_START, TWILIGHT_END, sunFactor);

                vec3 cityLights = nightColor * 0.3;
                vec3 baseColor = mix(cityLights, dayColor, dayNightMix);

                float diffuse = max(dot(normal, normalize(sunDirection)), 0.0);
                vec3 diffuseColor = baseColor * (0.3 + (0.7 * diffuse));

                vec3 viewDir = normalize(cameraPosition - vPosition);
                vec3 reflectDir = reflect(-normalize(sunDirection), normal);
                float specular = pow(max(dot(viewDir, reflectDir), 0.0), SPECULAR_POWER);
                vec3 specularColor = vec3(1.0) * specular * specularIntensity;

                vec3 finalColor = diffuseColor + specularColor;

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;
    }

    async createClouds(cloudsTexture) {
        console.assert(cloudsTexture, "Earth.createClouds: cloudsTexture required");

        const cloudsGeometry = new THREE.SphereGeometry(
            this.data.radius + 0.08,
            64,
            64
        );

        const cloudsMaterial = new THREE.MeshPhongMaterial({
            map: cloudsTexture,
            transparent: true,
            opacity: 0.6,
            depthWrite: false
        });

        this.cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
        this.mesh.add(this.cloudsMesh);
    }

    getSunDirection() {
        console.assert(this.scene, "Earth.getSunDirection: scene required");

        const sun = this.scene.children.find(child =>
            child instanceof THREE.DirectionalLight
        );

        if (sun) {
            return sun.position.clone().normalize();
        }

        return this.mesh.position.clone().normalize().negate();
    }

    update(deltaTime, j2000Days = null) {
        if (!this.mesh) return;

        // Temporary debug - remove after fixing
        if (!this._lastDebugLog || Date.now() - this._lastDebugLog > 1000) {
            console.log('Earth.update debug:', {
                j2000Days: j2000Days,
                rotationPeriodHours: this.data?.rotationPeriodHours,
                timeSync: j2000Days !== null && this.data?.rotationPeriodHours
            });
            this._lastDebugLog = Date.now();
        }

        this.sunDirection.copy(this.getSunDirection());
        if (this.mesh.material.uniforms) {
            this.mesh.material.uniforms.sunDirection.value = this.sunDirection;
        }

        // Time-synchronized rotation (respects TimeScaleManager time scale)
        // NASA Rule 7: Check if time-synchronized mode is available
        if (j2000Days !== null && this.data.rotationPeriodHours) {
            const hoursPerDay = 24;
            const rotationsPerJ2000Day = hoursPerDay / this.data.rotationPeriodHours;
            const totalRotations = j2000Days * rotationsPerJ2000Day;
            this.mesh.rotation.y = (totalRotations * Math.PI * 2) % (Math.PI * 2);

            if (this.cloudsMesh) {
                // Clouds rotate slightly slower (98% speed for subtle drift effect)
                this.cloudsMesh.rotation.y = (totalRotations * 0.98 * Math.PI * 2) % (Math.PI * 2);
            }
        } else {
            // FALLBACK: Animation mode (constant speed, ignores time scale)
            this.mesh.rotation.y += this.data.rotationSpeed * deltaTime;
            if (this.cloudsMesh) {
                this.cloudsMesh.rotation.y += this.data.rotationSpeed * 0.98 * deltaTime;
            }
        }

        // Phase 2: Orbital position calculation (same logic as Planet.js)
        // NASA Rule 7: Check if time-synchronized mode is available
        if (j2000Days !== null && this.data.orbitalPeriodDays && typeof OrbitalCalculator !== 'undefined') {
            // NEW: Calculate orbital position from real time
            const epochAnomaly = this.data.orbitalElements?.meanAnomalyAtEpoch || 0;
            const meanAnomaly = OrbitalCalculator.calculateMeanAnomaly(
                j2000Days,
                this.data.orbitalPeriodDays,
                epochAnomaly
            );

            // NASA Rule 5: Validate calculated anomaly
            if (isFinite(meanAnomaly)) {
                this.orbit.angle = meanAnomaly;
            } else {
                console.warn(`Earth.update: Invalid mean anomaly, using fallback`);
                this.orbit.angle += this.data.orbitSpeed * deltaTime;
            }
        } else {
            // FALLBACK: Animation mode
            this.orbit.angle += this.data.orbitSpeed * deltaTime;
        }

        this.updatePosition();

        // Phase 2: Pass j2000Days to moon update callbacks
        for (let i = 0; i < this.moons.length; i++) {
            if (this.moons[i].update) {
                this.moons[i].update(deltaTime, j2000Days);
            }
        }
    }

    async createMoon() {
        this.moonGroup = new THREE.Group();
        this.mesh.add(this.moonGroup);

        const moonTexture = await this.resourceLoader.loadTexture(this.moonData.texturePath);
        const moonBumpMap = await this.resourceLoader.loadTexture(this.moonData.bumpMapPath);

        const moonGeometry = new THREE.SphereGeometry(this.moonData.radius, 32, 32);
        const moonMaterial = new THREE.MeshPhongMaterial({
            map: moonTexture,
            bumpMap: moonBumpMap,
            bumpScale: 0.1
        });

        const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);

        moonMesh.position.set(this.moonData.distance, 0, 0);

        this.moonGroup.add(moonMesh);

        this.moons.push({
            mesh: moonMesh,
            orbit: { angle: 0 },
            data: this.moonData,
            update: (deltaTime, j2000Days) => {
                // Rotation (tidal locking - same face toward Earth)
                moonMesh.rotation.y += this.moonData.rotationSpeed * deltaTime;

                // Phase 2: Orbital position
                // NASA Rule 7: Check if time-synchronized mode is available
                if (j2000Days !== null && typeof OrbitalCalculator !== 'undefined') {
                    // NEW: Time-synchronized lunar orbit
                    const lunarPeriod = 27.32166; // Sidereal month (days)
                    const moonAngle = OrbitalCalculator.calculateMeanAnomaly(
                        j2000Days,
                        lunarPeriod,
                        0 // Epoch anomaly
                    );

                    // NASA Rule 5: Validate calculated angle
                    if (isFinite(moonAngle)) {
                        this.moonGroup.rotation.y = moonAngle;
                    } else {
                        console.warn('Earth.moon.update: Invalid moon angle, using fallback');
                        this.moonGroup.rotation.y += this.moonData.orbitSpeed * deltaTime;
                    }
                } else {
                    // FALLBACK: Animation mode
                    this.moonGroup.rotation.y += this.moonData.orbitSpeed * deltaTime;
                }
            }
        });
    }

    dispose() {
        // NASA Rule 5: Validate dispose preconditions
        console.assert(this.mesh, "Earth.dispose: mesh should exist when dispose is called");
        console.assert(this.scene, "Earth.dispose: scene should exist when dispose is called");

        // Dispose shader material uniforms (5 textures)
        if (this.mesh?.material?.uniforms) {
            const uniforms = this.mesh.material.uniforms;
            ['dayTexture', 'nightTexture', 'normalMap', 'specularMap'].forEach(key => {
                if (uniforms[key]?.value?.dispose) {
                    uniforms[key].value.dispose();
                }
            });
        }

        // Dispose main mesh
        if (this.mesh) {
            if (this.mesh.geometry) {
                this.mesh.geometry.dispose();
            }
            if (this.mesh.material) {
                this.mesh.material.dispose();
            }
            this.scene.remove(this.mesh);
        }

        // Dispose clouds mesh
        if (this.cloudsMesh) {
            if (this.cloudsMesh.geometry) {
                this.cloudsMesh.geometry.dispose();
            }
            if (this.cloudsMesh.material) {
                if (this.cloudsMesh.material.map) {
                    this.cloudsMesh.material.map.dispose();
                }
                this.cloudsMesh.material.dispose();
            }
        }

        // Dispose moon resources
        if (this.moons && this.moons.length > 0) {
            this.moons.forEach(moon => {
                if (moon.mesh) {
                    if (moon.mesh.geometry) {
                        moon.mesh.geometry.dispose();
                    }
                    if (moon.mesh.material) {
                        if (moon.mesh.material.map) {
                            moon.mesh.material.map.dispose();
                        }
                        if (moon.mesh.material.bumpMap) {
                            moon.mesh.material.bumpMap.dispose();
                        }
                        moon.mesh.material.dispose();
                    }
                }
            });
        }

        // Clear moon group
        if (this.moonGroup) {
            this.scene.remove(this.moonGroup);
            this.moonGroup = null;
        }

        this.moons = [];
    }
}
