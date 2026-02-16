// Sun.js - Scientifically realistic Sun implementation
class Sun {
    constructor(scene, resourceLoader, data) {
        this.scene = scene;
        this.resourceLoader = resourceLoader;
        this.data = data;
        this.mesh = null;
        this.light = null;
        this.corona = null;
        this.flares = [];
        this.prominences = [];
        this.sunspots = [];
        this.animationTime = 0;
        
        // Scientific parameters
        this.surfaceTemperature = 5778; // Kelvin
        this.coronaTemperature = 1000000; // Kelvin
        
        // Visual settings
        this.coronaSize = this.data.radius * 1.5; // Corona
        this.coronaDensity = 0.8;
        
        // Solar features
        this.flareCount = 5;
        this.flareSize = this.data.radius * 0.4;
        this.flareCycleTime = 15; // seconds for a complete flare cycle
        
        this.prominenceCount = 8;
        this.prominenceSize = this.data.radius * 0.3;
        
        this.sunspotCount = 12;
        this.sunspotMaxSize = this.data.radius * 0.1;
        
        // Differential rotation (realistic)
        this.equatorialRotationPeriod = 25; // days at equator
        this.polarRotationPeriod = 35; // days at poles

        // Solar Wind particle system (NASA Rule 3: Pre-declare properties)
        this.solarWindConfig = {
            particleCount: this.getParticleCount(), // Tier-dependent
            speed: 2.0, // 400-800 km/s scaled
            lifetime: 60, // Seconds
            maxDistance: 500, // Reset when particles reach this distance
            color: 0xffaa44 // Orange-yellow plasma
        };
        this.solarWindParticles = null;
        this.solarWindPositions = null;
        this.solarWindVelocities = null;
        this.solarWindAges = null;

        // LOD system for camera-distance-based optimization (NASA Rule 3: Pre-declare)
        this.currentLOD = 'HIGH';
        this.lodConfig = {
            HIGH: { maxDistance: 50, activeCount: this.solarWindConfig.particleCount },
            MEDIUM: { maxDistance: 150, activeCount: Math.floor(this.solarWindConfig.particleCount * 0.5) },
            LOW: { maxDistance: Infinity, activeCount: Math.floor(this.solarWindConfig.particleCount * 0.25) }
        };
        this.originalPositions = null;

        // Heliosphere boundary (NASA Rule 3: Pre-declare properties)
        this.heliosphereConfig = {
            radius: 480, // Termination shock distance
            color: 0x66aaff, // Blue-white boundary
            pulseSpeed: 0.5, // Pulse cycles per minute
            minOpacity: 0.1,
            maxOpacity: 0.3
        };
        this.heliosphere = null;
        this.heliosphereTime = 0;

        // Solar cycle simulation (NASA Rule 3: Pre-declare properties)
        // 11-year Schwabe cycle compressed to 2 minutes for visualization
        this.solarCycle = {
            scaledPeriod: 120, // 2 minutes for demo (11 years compressed)
            phase: 0, // Current phase (0-1)
            currentActivity: 1.0 // Current activity level (0.3-1.0)
        };

        // Coronal Mass Ejection (CME) system (NASA Rule 3: Pre-declare properties)
        this.cmeConfig = {
            particlesPerCME: 200,
            speed: 5.0, // Faster than solar wind (2.0)
            coneAngle: Math.PI / 6, // 30 degrees
            lifetime: 20, // Seconds
            maxActive: 3, // Max simultaneous CMEs
            color: 0xff6600, // Orange plasma (brighter than solar wind)
            baseFrequency: 0.03 // Base probability per second at solar max
        };
        this.cmePool = []; // Pre-allocated pool of CME slots
        this.cmePoolInitialized = false;
    }

    /**
     * Get particle count based on performance tier
     * NASA Rule 4: <= 60 lines | Rule 2: Fixed bounds | Rule 5: 2+ assertions
     * @returns {number} Particle count for current tier
     */
    getParticleCount() {
        // NASA Rule 5: Assertions
        console.assert(typeof window !== 'undefined',
            'Sun.getParticleCount: window object required');

        // NASA Rule 2: Fixed tier set
        const TIER_COUNTS = {
            'HIGH': 1500,
            'MEDIUM': 800,
            'LOW': 400
        };

        const tier = window.performanceTier || 'HIGH';

        // NASA Rule 5: Validate tier
        console.assert(tier in TIER_COUNTS,
            `Sun.getParticleCount: invalid tier ${tier}`);

        return TIER_COUNTS[tier] || TIER_COUNTS['HIGH'];
    }

    async init() {
        try {
            // Try to load texture with fallback
            let texture;
            try {
                texture = await this.resourceLoader.loadTexture(this.data.texturePath);
            } catch (error) {
                console.warn("Failed to load sun texture, using scientifically accurate fallback:", error);
                texture = this.createScientificSolarTexture();
            }
            
            // Create the photosphere (visible surface)
            this.createPhotosphere(texture);
            
            // Create sunspots
            this.createSunspots();
            
            // Create chromosphere (lower atmosphere layer)
            this.createChromosphere();
            
            // Create light source
            this.createLight();
            
            // Create scientifically accurate corona
            this.createCorona();
            
            // Create prominences (plasma loops)
            this.createProminences();
            
            // Create solar flares
            this.createSolarFlares();

            // Create solar wind particle system
            this.createSolarWind();

            // Create heliosphere boundary
            this.createHeliosphere();

            // Initialize CME object pool
            this.initializeCMEPool();

            return true;
        } catch (error) {
            console.error('Failed to initialize Sun:', error);
            return false;
        }
    }
    
    createScientificSolarTexture() {
        // Create a scientifically accurate solar texture
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Base color (photosphere) - yellowish with proper color temperature
        const baseColor = this.getTemperatureColor(this.surfaceTemperature);
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add granulation (convection cells)
        this.addGranulation(ctx, canvas.width, canvas.height);
        
        // Add limb darkening (edges appear darker)
        this.addLimbDarkening(ctx, canvas.width, canvas.height);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        return texture;
    }
    
    addGranulation(ctx, width, height) {
        // Simulate solar granulation (convection cells)
        const granuleCount = 2000;
        const maxGranuleSize = 20; // pixels
        
        for (let i = 0; i < granuleCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * maxGranuleSize + 5;
            
            // Granules are slightly brighter than surrounding areas
            const brightness = Math.random() * 30 + 10;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${brightness/255})`;
            ctx.fill();
        }
    }
    
    addLimbDarkening(ctx, width, height) {
        // Scientific limb darkening effect (sun appears darker at edges)
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = width / 2;
        
        // Create radial gradient for limb darkening
        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, radius
        );
        
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
    
    createPhotosphere(texture) {
        // Create the visible surface layer (photosphere)
        const geometry = new THREE.SphereGeometry(this.data.radius, 128, 128);
        
        // Use MeshStandardMaterial for better lighting
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            emissive: 0xffdd66,
            emissiveIntensity: 1.0,
            emissiveMap: texture,
            roughness: 1.0,
            metalness: 0.0
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
    }
    
    createSunspots() {
        for (let i = 0; i < this.sunspotCount; i++) {
            // Sunspots appear mainly in mid-latitudes, not at poles or equator
            const latitude = (Math.random() * 60 - 30) * Math.PI / 180;
            const longitude = Math.random() * Math.PI * 2;
            
            // Size varies with solar cycle
            const spotSize = Math.random() * this.sunspotMaxSize + this.data.radius * 0.02;
            
            // Create spot geometry (slightly inset from surface)
            const spotGeometry = new THREE.CircleGeometry(spotSize, 32);
            const spotMaterial = new THREE.MeshBasicMaterial({
                color: 0x663300,
                transparent: true,
                opacity: 0.7,
                side: THREE.FrontSide
            });
            
            const spot = new THREE.Mesh(spotGeometry, spotMaterial);
            
            // Position on sphere surface
            spot.position.set(
                Math.cos(latitude) * Math.cos(longitude) * (this.data.radius + 0.01),
                Math.sin(latitude) * (this.data.radius + 0.01),
                Math.cos(latitude) * Math.sin(longitude) * (this.data.radius + 0.01)
            );
            
            // Orient to face outward
            spot.lookAt(0, 0, 0);
            spot.rotateX(Math.PI); // Flip to face outward
            
            this.sunspots.push(spot);
            this.mesh.add(spot);
        }
    }
    
    createChromosphere() {
        // Chromosphere - thin reddish layer above photosphere
        const chromoGeometry = new THREE.SphereGeometry(
            this.data.radius * 1.01, 64, 64
        );
        
        const chromoMaterial = new THREE.MeshBasicMaterial({
            color: 0xff5500,
            transparent: true,
            opacity: 0.2,
            side: THREE.FrontSide
        });
        
        const chromosphere = new THREE.Mesh(chromoGeometry, chromoMaterial);
        this.mesh.add(chromosphere);
    }
    
    createLight() {
        // Scientific values for solar illumination
        this.light = new THREE.PointLight(0xffffff, 2, 1);
        this.mesh.add(this.light);
        
        // Add ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.2);
        this.mesh.add(ambientLight);
    }
    
    createCorona() {
        // Create a more scientifically accurate corona effect
        const coronaGeometry = new THREE.SphereGeometry(this.coronaSize, 64, 64);
        
        // Complex shader for realistic corona appearance
        const coronaMaterial = new THREE.ShaderMaterial({
            uniforms: {
                coronaDensity: { value: this.coronaDensity },
                glowColor: { value: new THREE.Color(0xffeedd) },
                time: { value: 0.0 },
                sunSize: { value: this.data.radius },
                brightness: { value: 1.0 }
            },
            vertexShader: `
                uniform float time;
                varying vec3 vPosition;
                varying vec3 vNormal;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 glowColor;
                uniform float coronaDensity;
                uniform float sunSize;
                uniform float time;
                uniform float brightness;

                varying vec3 vPosition;
                varying vec3 vNormal;

                float noise(vec3 p) {
                    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
                }

                void main() {
                    // Calculate distance from center
                    float dist = length(vPosition) / sunSize;

                    // Corona density decreases with square of distance (scientific)
                    float density = 1.0 / (dist * dist);
                    density *= coronaDensity;

                    // Add some noise to make it less uniform
                    vec3 noisePos = (vPosition * 0.05) + vec3(0.0, 0.0, time * 0.1);
                    float noiseVal = (noise(noisePos) * 0.3) + 0.7;

                    // Adjust intensity based on angle (limb brightening effect)
                    float vface = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));

                    // Combine factors including brightness modulation
                    float intensity = density * vface * noiseVal * brightness;
                    intensity = clamp(intensity, 0.0, 1.0);

                    // Output color
                    gl_FragColor = vec4(glowColor * intensity, intensity);
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });
        
        this.corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
        this.mesh.add(this.corona);
    }
    
    createProminences() {
        // Create solar prominences (plasma arcs along the limb)
        for (let i = 0; i < this.prominenceCount; i++) {
            // Random position around the sun
            const angle = Math.random() * Math.PI * 2;
            
            // Prominences follow magnetic field lines
            const points = [];
            const segments = 30;
            
            for (let j = 0; j <= segments; j++) {
                const t = j / segments;
                
                // Calculate a point on the arc
                const h = this.prominenceSize * Math.sin(t * Math.PI); // Height
                const r = this.data.radius + (h * 0.2); // Radius
                const a = angle + (Math.PI * 0.4) * (t - 0.5); // Angle variation
                
                points.push(new THREE.Vector3(
                    r * Math.cos(a),
                    h,
                    r * Math.sin(a)
                ));
            }
            
            // Create the curve
            const curve = new THREE.CatmullRomCurve3(points);
            const geometry = new THREE.TubeGeometry(curve, 20, this.data.radius * 0.01, 8, false);
            
            // Glowing material
            const material = new THREE.MeshBasicMaterial({
                color: 0xff3300,
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending
            });
            
            const prominence = new THREE.Mesh(geometry, material);
            
            // Random rotation around y-axis
            prominence.rotation.y = Math.random() * Math.PI * 2;
            
            // Random animation phase
            prominence.userData.phase = Math.random() * Math.PI * 2;
            
            this.prominences.push(prominence);
            this.mesh.add(prominence);
        }
    }
    
    createSolarFlares() {
        // Create more scientifically accurate solar flares
        for (let i = 0; i < this.flareCount; i++) {
            // Flares follow magnetic field lines from sunspot regions
            const curve = new THREE.CubicBezierCurve3(
                new THREE.Vector3(this.data.radius, 0, 0),
                new THREE.Vector3(this.data.radius * 1.5, this.flareSize * 0.7, 0),
                new THREE.Vector3(this.data.radius * 1.2, this.flareSize, 0),
                new THREE.Vector3(this.data.radius * 1.3, this.flareSize * 0.5, 0)
            );
            
            const points = curve.getPoints(30);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            
            // Create glow effect for flare
            const material = new THREE.LineBasicMaterial({
                color: 0xff8800,
                linewidth: 5,
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending
            });

            const flare = new THREE.Line(geometry, material);

            // Random rotation
            flare.rotation.y = Math.random() * Math.PI * 2;
            flare.rotation.z = (Math.random() * 0.5 - 0.25) * Math.PI;

            // Store animation phase and base opacity
            flare.userData.phase = Math.random() * Math.PI * 2;
            flare.userData.lifetime = 5 + Math.random() * 10; // seconds
            flare.userData.baseOpacity = 0.7; // Store for solar cycle modulation

            this.flares.push(flare);
            this.mesh.add(flare);
        }
    }

    /**
     * Create solar wind particle system
     * NASA Rule 4: <= 60 lines | Rule 2: Fixed bounds | Rule 5: 2+ (assertions * Particles) emit continuously from corona and travel radially outward
     */
    createSolarWind() {
        // NASA Rule 5: Assertions
        console.assert(this.mesh !== null,
            'Sun.createSolarWind: mesh must be initialized first');
        console.assert(this.solarWindConfig.particleCount > 0,
            'Sun.createSolarWind: particleCount must be positive');

        const count = this.solarWindConfig.particleCount;

        // NASA Rule 3: Pre-allocate Float32Arrays (no dynamic allocation)
        this.solarWindPositions = new Float32Array(count * 3);
        this.solarWindVelocities = new Float32Array(count * 3);
        this.solarWindAges = new Float32Array(count);

        // NASA Rule 2: Fixed iteration bound
        for (let i = 0; i < count; i++) {
            // Initialize particle at corona surface with random position
            this.resetSolarWindParticle(i);
        }

        // Create BufferGeometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position',
            new THREE.BufferAttribute(this.solarWindPositions, 3));

        // Create PointsMaterial with plasma glow
        const material = new THREE.PointsMaterial({
            size: 0.5,
            color: this.solarWindConfig.color,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        // Create particle system
        this.solarWindParticles = new THREE.Points(geometry, material);
        this.solarWindParticles.name = 'SolarWind';
        this.mesh.add(this.solarWindParticles);

        // Store original positions for LOD restoration (NASA Rule 3: Pre-allocate)
        this.originalPositions = new Float32Array(this.solarWindPositions);

        console.log(`Solar Wind initialized: ${count} particles, ` +
                   `speed=${this.solarWindConfig.speed}, ` +
                   `maxDistance=${this.solarWindConfig.maxDistance}`);
    }

    /**
     * Create heliosphere boundary visualization
     * NASA Rule 4: <= 60 lines | Rule 2: Fixed bounds | Rule 5: 2+ (assertions * Renders) the termination shock where solar wind meets interstellar medium
     */
    createHeliosphere() {
        // NASA Rule 5: Assertions
        console.assert(this.mesh !== null,
            'Sun.createHeliosphere: mesh must be initialized first');
        console.assert(this.heliosphereConfig !== null,
            'Sun.createHeliosphere: heliosphereConfig required');

        const geometry = new THREE.SphereGeometry(this.heliosphereConfig.radius, 32, 32);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                color: { value: new THREE.Color(this.heliosphereConfig.color) },
                opacity: { value: this.heliosphereConfig.minOpacity },
                brightness: { value: 1.0 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vViewPosition;

                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 color;
                uniform float opacity;
                uniform float brightness;
                varying vec3 vNormal;
                varying vec3 vViewPosition;

                void main() {
                    // Fresnel effect (glow at edges)
                    vec3 viewDir = normalize(vViewPosition);
                    float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.0);

                    // Pulsing animation
                    float pulse = 0.5 + (0.5 * sin(time * 2.0));

                    // Combine fresnel + pulse + brightness
                    float alpha = fresnel * opacity * pulse * brightness;

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            side: THREE.BackSide, // View from inside the sphere
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.heliosphere = new THREE.Mesh(geometry, material);
        this.mesh.add(this.heliosphere);

        console.log('Heliosphere boundary created at radius:', this.heliosphereConfig.radius);
    }

    /**
     * Initialize CME object pool (NASA Rule 3 compliance)
     * NASA Rule 4: <= 60 lines | Rule 2: Fixed bounds | Rule 5: 2+ (assertions * Pre)-allocates maxActive CME slots to prevent dynamic allocation during runtime
     */
    initializeCMEPool() {
        // NASA Rule 5: Assertions
        console.assert(this.cmePool.length === 0,
            'Sun.initializeCMEPool: pool must be empty');
        console.assert(this.cmeConfig.maxActive > 0,
            'Sun.initializeCMEPool: maxActive must be positive');

        // NASA Rule 2: Fixed iteration bound
        // Pre-allocate maxActive CME slots (NASA Rule 3 compliance)
        for (let i = 0; i < this.cmeConfig.maxActive; i++) {
            this.cmePool.push({
                cme: null, // Will hold CME instance when active
                active: false // Flag instead of array manipulation
            });
        }
        this.cmePoolInitialized = true;

        console.log(`CME pool initialized: ${this.cmeConfig.maxActive} slots pre-allocated`);
    }

    /**
     * Update 11-year solar cycle simulation
     * NASA Rule 4: <= 60 lines | Rule 5: 2+ (assertions * Schwabe) cycle: 11 years compressed to 2 minutes for visualization
     * @param {number} deltaTime - Time since last frame (seconds)
     */
    updateSolarCycle(deltaTime) {
        // NASA Rule 5: Assertions
        console.assert(typeof deltaTime === 'number',
            'Sun.updateSolarCycle: deltaTime must be number');
        console.assert(deltaTime >= 0,
            'Sun.updateSolarCycle: deltaTime must be non-negative');

        // Update cycle phase (0-1 over scaledPeriod seconds)
        this.solarCycle.phase = (this.solarCycle.phase + (deltaTime / this.solarCycle.scaledPeriod)) % 1.0;

        // Calculate current activity using sine wave
        // Activity: 0.3 (minimum) to 1.0 (maximum)
        // phase 0 = minimum, phase 0.5 = maximum, phase 1.0 = minimum again
        this.solarCycle.currentActivity = 0.3 + 0.7 * Math.abs(Math.sin(this.solarCycle.phase * Math.PI));

        // Modulate existing features based on activity level
        this.modulateSunspots(this.solarCycle.currentActivity);
        this.modulateFlares(this.solarCycle.currentActivity);
        this.modulateCorona(this.solarCycle.currentActivity);
    }

    /**
     * Modulate sunspot visibility based on solar activity
     * NASA Rule 4: <= 60 lines | Rule 2: Fixed bounds | Rule 5: 2+ assertions
     * @param {number} activity - Current activity level (0.3-1.0)
     */
    modulateSunspots(activity) {
        // NASA Rule 5: Assertions
        console.assert(typeof activity === 'number',
            'Sun.modulateSunspots: activity must be number');
        console.assert(activity >= 0.3 && activity <= 1.0,
            'Sun.modulateSunspots: activity must be in range 0.3-1.0');

        // Early exit if no sunspots
        if (!this.sunspots || this.sunspots.length === 0) return;

        // At solar minimum (activity 0.3), show ~40% of sunspots
        // At solar maximum (activity 1.0), show 100% of sunspots
        const visibleCount = Math.floor(this.sunspots.length * activity);

        // NASA Rule 2: Fixed iteration bound
        const maxIndex = this.sunspots.length;
        for (let i = 0; i < maxIndex; i++) {
            if (this.sunspots[i]) {
                this.sunspots[i].visible = (i < visibleCount);
            }
        }
    }

    /**
     * Modulate flare intensity based on solar activity
     * NASA Rule 4: <= 60 lines | Rule 2: Fixed bounds | Rule 5: 2+ assertions
     * @param {number} activity - Current activity level (0.3-1.0)
     */
    modulateFlares(activity) {
        // NASA Rule 5: Assertions
        console.assert(typeof activity === 'number',
            'Sun.modulateFlares: activity must be number');
        console.assert(activity >= 0.3 && activity <= 1.0,
            'Sun.modulateFlares: activity must be in range 0.3-1.0');

        // Early exit if no flares
        if (!this.flares || this.flares.length === 0) return;

        // NASA Rule 2: Fixed iteration bound
        const maxIndex = this.flares.length;
        for (let i = 0; i < maxIndex; i++) {
            const flare = this.flares[i];
            if (flare && flare.material) {
                // At solar minimum, flares are dimmer (40% base intensity)
                // At solar maximum, flares are brighter (100% base intensity)
                const baseOpacity = flare.userData.baseOpacity || 0.7;
                const currentOpacity = flare.material.opacity;

                // Modulate only if flare is currently visible
                if (currentOpacity > 0) {
                    // Scale base opacity by activity level
                    flare.material.opacity = baseOpacity * activity;
                }
            }
        }
    }

    /**
     * Modulate corona brightness based on solar activity
     * NASA Rule 4: <= 60 lines | Rule 5: 2+ assertions
     * @param {number} activity - Current activity level (0.3-1.0)
     */
    modulateCorona(activity) {
        // NASA Rule 5: Assertions
        console.assert(typeof activity === 'number',
            'Sun.modulateCorona: activity must be number');
        console.assert(activity >= 0.3 && activity <= 1.0,
            'Sun.modulateCorona: activity must be in range 0.3-1.0');

        // Early exit if corona not initialized
        if (!this.corona || !this.corona.material || !this.corona.material.uniforms) return;

        // Modulate corona brightness based on activity
        // At solar minimum, corona is dimmer (60% brightness)
        // At solar maximum, corona is brighter (100% brightness)
        const coronaBrightness = 0.6 + (0.4 * activity);

        if (this.corona.material.uniforms.brightness) {
            this.corona.material.uniforms.brightness.value = coronaBrightness;
        }
    }

    /**
     * Reset a solar wind particle to corona surface
     * NASA Rule 4: <= 60 lines | Rule 5: 2+ assertions
     * @param {number} index - Particle index
     */
    resetSolarWindParticle(index) {
        // NASA Rule 5: Assertions
        console.assert(typeof index === 'number',
            'Sun.resetSolarWindParticle: index must be number');
        console.assert(index >= 0 && index < this.solarWindConfig.particleCount,
            'Sun.resetSolarWindParticle: index out of bounds');

        // Random spherical coordinates for emission
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        // Start at corona surface (corona is at ~1.5 * sunRadius)
        const startRadius = 1.5;
        this.solarWindPositions[index * 3] =
            startRadius * Math.sin(phi) * Math.cos(theta);
        this.solarWindPositions[(index * 3) + 1] =
            startRadius * Math.sin(phi) * Math.sin(theta);
        this.solarWindPositions[(index * 3) + 2] =
            startRadius * Math.cos(phi);

        // Radial velocity (outward from sun)
        const speed = this.solarWindConfig.speed;
        this.solarWindVelocities[index * 3] =
            Math.sin(phi) * Math.cos(theta) * speed;
        this.solarWindVelocities[(index * 3) + 1] =
            Math.sin(phi) * Math.sin(theta) * speed;
        this.solarWindVelocities[(index * 3) + 2] =
            Math.cos(phi) * speed;

        // Set age to 0 (scientifically accurate - particles start young)
        this.solarWindAges[index] = 0;
    }

    /**
     * Update particle LOD based on camera distance
     * NASA Rule 4: <= 60 lines | Rule 2: Fixed bounds | Rule 5: 2+ assertions
     * @param {number} cameraDistance - Distance from camera to sun
     */
    updateParticleLOD(cameraDistance) {
        // NASA Rule 5: Assertions
        console.assert(typeof cameraDistance === 'number',
            'Sun.updateParticleLOD: cameraDistance must be number');
        console.assert(cameraDistance >= 0,
            'Sun.updateParticleLOD: cameraDistance must be non-negative');

        // Early exit if particle system not initialized
        if (!this.solarWindParticles || !this.originalPositions) return;

        // Determine target LOD based on camera distance (NASA Rule 2: Fixed set)
        let targetLOD;
        if (cameraDistance < this.lodConfig.HIGH.maxDistance) {
            targetLOD = 'HIGH';
        } else if (cameraDistance < this.lodConfig.MEDIUM.maxDistance) {
            targetLOD = 'MEDIUM';
        } else {
            targetLOD = 'LOW';
        }

        // Only rebuild particles if LOD changed
        if (targetLOD === this.currentLOD) return;

        this.currentLOD = targetLOD;
        const targetCount = this.lodConfig[targetLOD].activeCount;
        const positions = this.solarWindParticles.geometry.attributes.position;
        const maxCount = this.solarWindConfig.particleCount;

        // NASA Rule 2: Fixed iteration bound
        // Hide particles beyond target count by moving to origin
        for (let i = targetCount; i < maxCount; i++) {
            positions.setXYZ(i, 0, 0, 0);
        }

        // Restore particles within target count from original positions
        for (let i = 0; i < targetCount; i++) {
            const x = this.originalPositions[i * 3];
            const y = this.originalPositions[(i * 3) + 1];
            const z = this.originalPositions[(i * 3) + 2];
            positions.setXYZ(i, x, y, z);
        }

        positions.needsUpdate = true;
        console.log(`Sun LOD changed to ${targetLOD} (${targetCount}/${maxCount} particles) at distance ${cameraDistance.toFixed(1)}`);
    }

    update(deltaTime, j2000Days = null) {
        // Update animation time
        this.animationTime += deltaTime;

        // Update LOD system based on camera distance (NASA Rule 2: Fixed conditionals)
        if (this.mesh && this.scene && this.scene.userData && this.scene.userData.camera) {
            const camera = this.scene.userData.camera;
            const cameraDistance = this.mesh.position.distanceTo(camera.position);
            this.updateParticleLOD(cameraDistance);
        }

        // Update solar cycle simulation (11 years compressed to 2 minutes)
        // Must be called before updating individual features
        this.updateSolarCycle(deltaTime);

        // Update differential rotation (scientifically accurate)
        if (this.mesh) {
            // NASA Rule 7: Check if time-synchronized mode is available
            if (j2000Days !== null) {
                // Time-synced rotation: Sun's equatorial rotation period is 25 days
                const rotationsPerDay = 1 / this.equatorialRotationPeriod; // ~0.04 rotations/day
                const totalRotations = j2000Days * rotationsPerDay;
                this.mesh.rotation.y = (totalRotations * Math.PI * 2) % (Math.PI * 2);
            } else {
                // FALLBACK: Animation mode (raw deltaTime)
                const equatorialSpeed = (2 * Math.PI) / (this.equatorialRotationPeriod * 24 * 60 * 60);
                this.mesh.rotation.y += equatorialSpeed * deltaTime;
            }

            // Sunspots rotate at different rates based on latitude
            this.updateSunspotRotation(deltaTime);
        }

        // Animate corona
        if (this.corona && this.corona.material && this.corona.material.uniforms) {
            // Update time uniform for corona shader
            this.corona.material.uniforms.time.value = this.animationTime;
        }

        // Animate solar flares
        this.updateFlares(deltaTime);

        // Animate prominences
        this.updateProminences(deltaTime);

        // Update solar wind particles
        this.updateSolarWind(deltaTime);

        // Update heliosphere boundary
        this.updateHeliosphere(deltaTime);

        // Update Coronal Mass Ejections
        this.updateCMEs(deltaTime);
    }
    
    updateSunspotRotation(deltaTime) {
        // Implement differential rotation for sunspots
        for (const spot of this.sunspots) {
            // Extract current position
            const pos = spot.position.clone().normalize();
            
            // Calculate latitude (0 at equator, PI/2 at poles)
            const latitude = Math.asin(pos.y / this.data.radius);
            
            // Differential rotation equation (faster at equator, slower at poles)
            const rotationOffset = Math.cos(latitude) * Math.cos(latitude) * 0.0001 * deltaTime;
            
            // Apply additional rotation based on latitude
            const rotMatrix = new THREE.Matrix4().makeRotationY(rotationOffset);
            spot.position.applyMatrix4(rotMatrix);
            
            // Keep spots facing outward
            spot.lookAt(0, 0, 0);
            spot.rotateX(Math.PI);
        }
    }
    
    updateFlares(deltaTime) {
        // Realistic flare behavior (eruptions followed by cooling)
        for (let i = 0; i < this.flares.length; i++) {
            const flare = this.flares[i];
            
            // Calculate flare life cycle
            const phase = flare.userData.phase;
            const lifetime = flare.userData.lifetime;
            const cyclePosition = ((this.animationTime + phase) % (lifetime * 2)) / lifetime;
            
            // Flares appear suddenly and fade gradually (realistic behavior)
            let opacity;
            if (cyclePosition < 1.0) {
                // Active phase - quick rise, slow fall
                opacity = cyclePosition < 0.2 ? 
                    cyclePosition * 5 : // Quick rise
                    1.0 - (cyclePosition - 0.2) * 1.25; // Gradual fall
            } else {
                // Inactive phase
                opacity = 0;
            }
            
            // Update flare opacity
            flare.material.opacity = Math.max(0, opacity);
            
            // Occasionally replace inactive flares with new ones
            if (opacity === 0 && Math.random() < 0.005) {
                // Remove old flare
                this.mesh.remove(flare);
                
                // Create a new flare in a different position
                const newAngle = Math.random() * Math.PI * 2;
                flare.rotation.y = newAngle;
                flare.rotation.z = (Math.random() * 0.5 - 0.25) * Math.PI;
                
                // Reset animation phase
                flare.userData.phase = this.animationTime;
                flare.userData.lifetime = 5 + Math.random() * 10;
                
                // Add back to mesh
                this.mesh.add(flare);
            }
        }
    }
    
    updateProminences(deltaTime) {
        // Animate prominences
        for (const prominence of this.prominences) {
            const phase = prominence.userData.phase;
            
            // Prominences slowly change shape
            const scale = 0.8 + Math.sin((this.animationTime * 0.1) + phase) * 0.2;
            prominence.scale.set(1, scale, 1);
            
            // Slight rotation to simulate plasma flow
            prominence.rotation.y += 0.0002 * deltaTime;
            
            // Pulsing opacity
            prominence.material.opacity = 0.3 + Math.sin((this.animationTime * 0.2) + phase) * 0.2;
        }
    }

    /**
     * Update heliosphere boundary animation
     * NASA Rule 4: <= 60 lines | Rule 5: 2+ assertions
     * @param {number} deltaTime - Time since last frame (seconds)
     */
    updateHeliosphere(deltaTime) {
        // NASA Rule 5: Assertions
        console.assert(typeof deltaTime === 'number',
            'Sun.updateHeliosphere: deltaTime must be number');
        console.assert(deltaTime >= 0,
            'Sun.updateHeliosphere: deltaTime must be non-negative');

        // Early exit if heliosphere not initialized
        if (!this.heliosphere) return;

        // Update pulse animation time
        this.heliosphereTime += deltaTime * this.heliosphereConfig.pulseSpeed;
        this.heliosphere.material.uniforms.time.value = this.heliosphereTime;

        // Pulsing opacity
        const pulse = 0.5 + 0.5 * Math.sin(this.heliosphereTime * 2.0);
        const opacity = this.heliosphereConfig.minOpacity +
            pulse * (this.heliosphereConfig.maxOpacity - this.heliosphereConfig.minOpacity);
        this.heliosphere.material.uniforms.opacity.value = opacity;
    }

    /**
     * Update solar wind particle positions
     * NASA Rule 4: <= 60 lines | Rule 2: Fixed bounds | Rule 5: 2+ assertions
     * @param {number} deltaTime - Time since last frame (seconds)
     */
    updateSolarWind(deltaTime) {
        // NASA Rule 5: Assertions
        console.assert(typeof deltaTime === 'number',
            'Sun.updateSolarWind: deltaTime must be number');
        console.assert(deltaTime >= 0,
            'Sun.updateSolarWind: deltaTime must be non-negative');

        // Early exit if particle system not initialized
        if (!this.solarWindParticles) return;

        const count = this.solarWindConfig.particleCount;
        const maxDist = this.solarWindConfig.maxDistance;
        const lifetime = this.solarWindConfig.lifetime;
        let needsUpdate = false;

        // NASA Rule 2: Fixed iteration bound
        for (let i = 0; i < count; i++) {
            // Update particle age
            this.solarWindAges[i] += deltaTime;

            // Get current position
            const x = this.solarWindPositions[i * 3];
            const y = this.solarWindPositions[(i * 3) + 1];
            const z = this.solarWindPositions[(i * 3) + 2];
            const distance = Math.sqrt((x * x) + (y * y) + (z * z));

            // Recycle particle if too old or too far
            if (this.solarWindAges[i] > lifetime || distance > maxDist) {
                this.resetSolarWindParticle(i);
                needsUpdate = true;
            } else {
                // Move particle along velocity vector
                this.solarWindPositions[i * 3] +=
                    this.solarWindVelocities[i * 3] * deltaTime;
                this.solarWindPositions[(i * 3) + 1] +=
                    this.solarWindVelocities[(i * 3) + 1] * deltaTime;
                this.solarWindPositions[(i * 3) + 2] +=
                    this.solarWindVelocities[(i * 3) + 2] * deltaTime;
                needsUpdate = true;
            }
        }

        // NASA Rule 7: Check condition before update
        if (needsUpdate) {
            this.solarWindParticles.geometry.attributes.position.needsUpdate = true;
        }
    }

    getTemperatureColor(temperature) {
        // Convert temperature to RGB using blackbody radiation formula
        // Simplified version of actual physics
        let r, g, b;
        
        temperature = temperature / 100;
        
        if (temperature <= 66) {
            r = 255;
            g = temperature;
            g = 99.4708025861 * Math.log(g) - 161.1195681661;
            if (temperature <= 19) {
                b = 0;
            } else {
                b = temperature - 10;
                b = 138.5177312231 * Math.log(b) - 305.0447927307;
            }
        } else {
            r = temperature - 60;
            r = 329.698727446 * Math.pow(r, -0.1332047592);
            g = temperature - 60;
            g = 288.1221695283 * Math.pow(g, -0.0755148492);
            b = 255;
        }
        
        r = Math.min(255, Math.max(0, Math.round(r)));
        g = Math.min(255, Math.max(0, Math.round(g)));
        b = Math.min(255, Math.max(0, Math.round(b)));
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    getMesh() {
        return this.mesh;
    }
    
    dispose() {
        // Clean up resources
        if (this.mesh) {
            if (this.mesh.material) {
                if (this.mesh.material.map) {
                    this.mesh.material.map.dispose();
                }
                this.mesh.material.dispose();
            }
            this.mesh.geometry.dispose();
        }
        
        if (this.corona && this.corona.material) {
            this.corona.material.dispose();
            this.corona.geometry.dispose();
        }
        
        // Clean up flares
        for (const flare of this.flares) {
            if (flare.material) {
                flare.material.dispose();
            }
            if (flare.geometry) {
                flare.geometry.dispose();
            }
        }
        
        // Clean up prominences
        for (const prominence of this.prominences) {
            if (prominence.material) {
                prominence.material.dispose();
            }
            if (prominence.geometry) {
                prominence.geometry.dispose();
            }
        }
        
        // Clean up sunspots
        for (const spot of this.sunspots) {
            if (spot.material) {
                spot.material.dispose();
            }
            if (spot.geometry) {
                spot.geometry.dispose();
            }
        }
        
        this.flares = [];
        this.prominences = [];
        this.sunspots = [];

        // Clean up solar wind
        if (this.solarWindParticles) {
            if (this.solarWindParticles.material) {
                this.solarWindParticles.material.dispose();
            }
            if (this.solarWindParticles.geometry) {
                this.solarWindParticles.geometry.dispose();
            }
            this.solarWindParticles = null;
        }

        this.solarWindPositions = null;
        this.solarWindVelocities = null;
        this.solarWindAges = null;
        this.originalPositions = null;

        // Clean up heliosphere
        if (this.heliosphere) {
            if (this.heliosphere.material) {
                this.heliosphere.material.dispose();
            }
            if (this.heliosphere.geometry) {
                this.heliosphere.geometry.dispose();
            }
            this.heliosphere = null;
        }

        // Clean up CME pool
        if (this.cmePool && this.cmePool.length > 0) {
            for (let i = 0; i < this.cmePool.length; i++) {
                const slot = this.cmePool[i];
                if (slot.active && slot.cme) {
                    if (this.mesh && slot.cme.particles) {
                        this.mesh.remove(slot.cme.particles);
                    }
                    slot.cme.dispose();
                    slot.cme = null;
                    slot.active = false;
                }
            }
        }
    }

    /**
     * Create a new Coronal Mass Ejection
     * NASA Rule 4: <= 60 lines | Rule 2: Fixed bounds | Rule 5: 2+ assertions
     */
    createCME() {
        // NASA Rule 5: Assertions
        console.assert(this.cmePoolInitialized,
            'Sun.createCME: pool must be initialized');
        console.assert(this.scene !== null,
            'Sun.createCME: scene required');

        // NASA Rule 2: Fixed iteration bound
        // Find first inactive slot (no allocation, just flag check)
        for (let i = 0; i < this.cmePool.length; i++) {
            const slot = this.cmePool[i];
            if (!slot.active) {
                // Random origin on sun surface
                const lat = (Math.random() - 0.5) * Math.PI; // -90° to +90°
                const lon = Math.random() * Math.PI * 2; // 0° to 360°

                // Create CME in pre-allocated slot
                slot.cme = new CME(lat, lon, this.cmeConfig.particlesPerCME, this.cmeConfig);
                slot.active = true;
                this.mesh.add(slot.cme.particles);

                console.log(`CME erupted at lat=${(lat * 180 / Math.PI).toFixed(1)}°, ` +
                           `lon=${(lon * 180 / Math.PI).toFixed(1)}°`);
                return;
            }
        }

        // All slots full (normal at maxActive limit)
        // Do nothing - this prevents creating more than maxActive CMEs
    }

    /**
     * Update all active CMEs
     * NASA Rule 4: <= 60 lines | Rule 2: Fixed bounds | Rule 5: 2+ assertions
     * @param {number} deltaTime - Time since last frame (seconds)
     */
    updateCMEs(deltaTime) {
        // NASA Rule 5: Assertions
        console.assert(typeof deltaTime === 'number',
            'Sun.updateCMEs: deltaTime must be number');
        console.assert(deltaTime >= 0,
            'Sun.updateCMEs: deltaTime must be non-negative');

        if (!this.cmePoolInitialized) return;

        // Count active CMEs
        let activeCount = 0;
        for (let i = 0; i < this.cmePool.length; i++) {
            if (this.cmePool[i].active) {
                activeCount++;
            }
        }

        // Random triggering based on solar cycle activity
        if (activeCount < this.cmeConfig.maxActive) {
            const probability = this.cmeConfig.baseFrequency *
                              this.solarCycle.currentActivity * deltaTime;
            if (Math.random() < probability) {
                this.createCME();
            }
        }

        // NASA Rule 2: Fixed iteration bound
        // Update all active CMEs (no splice, just flag manipulation)
        for (let i = 0; i < this.cmePool.length; i++) {
            const slot = this.cmePool[i];
            if (slot.active) {
                slot.cme.update(deltaTime);

                // Expire CME if too old
                if (slot.cme.age > this.cmeConfig.lifetime) {
                    this.mesh.remove(slot.cme.particles);
                    slot.cme.dispose();
                    slot.cme = null;
                    slot.active = false; // Mark inactive instead of splice
                }
            }
        }
    }
}

/**
 * CME (Coronal Mass Ejection) (Class * NASA) -compliant particle system for solar eruptions
 */
class CME {
    /**
     * Initialize CME with particle system
     * NASA Rule 4: <= 60 lines | Rule 5: 2+ assertions
     * @param {number} originLat - Latitude of eruption (-PI/2 to PI/2)
     * @param {number} originLon - Longitude of eruption (0 to 2*PI)
     * @param {number} particleCount - Number of particles in CME
     * @param {Object} config - CME configuration object
     */
    constructor(originLat, originLon, particleCount, config) {
        // NASA Rule 5: Assertions
        console.assert(typeof originLat === 'number',
            'CME.constructor: originLat must be number');
        console.assert(typeof originLon === 'number',
            'CME.constructor: originLon must be number');
        console.assert(particleCount > 0,
            'CME.constructor: particleCount must be positive');
        console.assert(config !== null,
            'CME.constructor: config required');

        this.originLat = originLat;
        this.originLon = originLon;
        this.age = 0;
        this.config = config;

        // NASA Rule 3: Pre-allocate Float32Arrays
        this.positions = new Float32Array(particleCount * 3);
        this.velocities = new Float32Array(particleCount * 3);

        // Initialize particles in cone around radial direction
        const radialDir = this.getRadialDirection(originLat, originLon);

        // NASA Rule 2: Fixed iteration bound
        for (let i = 0; i < particleCount; i++) {
            // Start at corona surface (1.5 * sunRadius)
            this.positions[i * 3] = radialDir.x * 1.5;
            this.positions[(i * 3) + 1] = radialDir.y * 1.5;
            this.positions[(i * 3) + 2] = radialDir.z * 1.5;

            // Velocity in cone around radial direction
            const velocity = this.getRandomConeVelocity(
                radialDir, config.coneAngle, config.speed);
            this.velocities[i * 3] = velocity.x;
            this.velocities[(i * 3) + 1] = velocity.y;
            this.velocities[(i * 3) + 2] = velocity.z;
        }

        // Create THREE.js particle system
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position',
            new THREE.BufferAttribute(this.positions, 3));

        const material = new THREE.PointsMaterial({
            size: 0.8,
            color: config.color,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, material);
    }

    /**
     * Convert lat/lon to 3D radial direction
     * NASA Rule 4: <= 60 lines | Rule 5: 2+ assertions
     * @param {number} lat - Latitude in radians
     * @param {number} lon - Longitude in radians
     * @returns {THREE.Vector3} Unit vector pointing from sun center
     */
    getRadialDirection(lat, lon) {
        // NASA Rule 5: Assertions
        console.assert(typeof lat === 'number',
            'CME.getRadialDirection: lat must be number');
        console.assert(typeof lon === 'number',
            'CME.getRadialDirection: lon must be number');

        return new THREE.Vector3(
            Math.cos(lat) * Math.cos(lon),
            Math.sin(lat),
            Math.cos(lat) * Math.sin(lon)
        );
    }

    /**
     * Generate random velocity within cone
     * NASA Rule 4: <= 60 lines | Rule 5: 2+ assertions
     * @param {THREE.Vector3} radialDir - Central direction of cone
     * @param {number} coneAngle - Half-angle of cone in radians
     * @param {number} speed - Speed magnitude
     * @returns {THREE.Vector3} Velocity vector
     */
    getRandomConeVelocity(radialDir, coneAngle, speed) {
        // NASA Rule 5: Assertions
        console.assert(radialDir instanceof THREE.Vector3,
            'CME.getRandomConeVelocity: radialDir must be Vector3');
        console.assert(coneAngle > 0,
            'CME.getRandomConeVelocity: coneAngle must be positive');

        // Create perpendicular vector for rotation axis
        const perpendicular = new THREE.Vector3(
            -radialDir.y,
            radialDir.x,
            0
        );

        // Handle edge case where radialDir is along z-axis
        if (perpendicular.lengthSq() < 0.001) {
            perpendicular.set(1, 0, 0);
        }
        perpendicular.normalize();

        const randomAngle = Math.random() * Math.PI * 2;
        const randomConeOffset = Math.random() * coneAngle;

        // Rotate radialDir by randomConeOffset around perpendicular
        const velocity = radialDir.clone();
        velocity.applyAxisAngle(perpendicular, randomConeOffset);
        velocity.applyAxisAngle(radialDir, randomAngle);
        velocity.multiplyScalar(speed);

        return velocity;
    }

    /**
     * Update particle positions
     * NASA Rule 4: <= 60 lines | Rule 2: Fixed bounds | Rule 5: 2+ assertions
     * @param {number} deltaTime - Time since last frame (seconds)
     */
    update(deltaTime) {
        // NASA Rule 5: Assertions
        console.assert(typeof deltaTime === 'number',
            'CME.update: deltaTime must be number');
        console.assert(deltaTime >= 0,
            'CME.update: deltaTime must be non-negative');

        this.age += deltaTime;

        // NASA Rule 2: Fixed iteration bound
        const particleCount = this.positions.length / 3;
        for (let i = 0; i < particleCount; i++) {
            this.positions[i * 3] += this.velocities[i * 3] * deltaTime;
            this.positions[(i * 3) + 1] += this.velocities[(i * 3) + 1] * deltaTime;
            this.positions[(i * 3) + 2] += this.velocities[(i * 3) + 2] * deltaTime;
        }

        this.particles.geometry.attributes.position.needsUpdate = true;
    }

    /**
     * Dispose of CME resources
     * NASA Rule 4: <= 60 lines | Rule 5: 2+ assertions
     */
    dispose() {
        // NASA Rule 5: Assertions
        console.assert(this.particles !== null,
            'CME.dispose: particles already disposed');
        console.assert(this.particles.geometry !== null,
            'CME.dispose: geometry already disposed');

        this.particles.geometry.dispose();
        this.particles.material.dispose();
    }
}

// Make sure Sun is globally available
window.Sun = Sun;
