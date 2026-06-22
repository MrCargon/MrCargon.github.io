// SpaceEnvironment.js - Main controller for the space visualization
class SpaceEnvironment {
    constructor() {
        // Rule 5: Validate THREE.js availability with assertions
        const Assert = window.Assert || {};
        if (typeof Assert.assert === 'function') {
            Assert.assert(typeof THREE !== 'undefined', 'THREE.js library required for SpaceEnvironment');
            Assert.assert(typeof THREE.Clock === 'function', 'THREE.Clock constructor required');
        }

        // Rule 6: Graceful fallback if THREE not available
        if (typeof THREE === 'undefined') {
            console.error('THREE.js not available - SpaceEnvironment will use fallback mode');
            this.fallbackMode = true;
            this.clock = {
                getDelta: () => 0.016,
                getElapsedTime: () => Date.now() * 0.001
            };
            this.initialized = false;
            this.animationId = null;
            this.timeManager = null; // Phase 2: Initialize even in fallback mode
            return;
        }

        // Normal initialization - THREE.js is available
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.container = null;
        this.solarSystem = null;
        this.clock = new THREE.Clock();
        this.initialized = false;
        this.animationId = null;
        this.resourceLoader = null;
        this.fallbackMode = false;

        // Phase 2: Time management system
        // NASA Rule 6: Graceful handling if TimeScaleManager not available
        this.timeManager = null;
        this.timeControlUI = null;
        if (typeof TimeScaleManager !== 'undefined') {
            this.timeManager = new TimeScaleManager(new Date()); // Start at current time
            this.timeManager.setTimeScale(5); // BUG FIX 2: Default 5000x (was 50000x - too fast, planets blurred)
            console.log('Phase 2: TimeScaleManager initialized (5000x speed)');
        } else {
            console.warn('Phase 2: TimeScaleManager not available - orbital positions will use fallback animation mode');
        }

        // FPS monitoring (roaster feedback fix #2)
        this.fpsMonitor = null;
        
        // Camera behavior flags
        this.followingPlanet = false;
        this.orbitingPlanet = true; // Default to orbiting when focused
        this.selectedPlanet = null;
        
        // Orbit zones - determines camera behavior
        this.orbitZoneRadius = 25; // How close to be considered "in orbit zone"
        this.insideOrbitZone = false;
        
        // Camera transition settings
        this.cameraTransitioning = false;
        this.transitionDuration = 1.5; // seconds
        
        // Auto-orbit settings for when camera is orbiting a planet
        this.autoOrbitSpeed = 0.0005; // Speed of automatic orbiting around planet
        this.orbitRadius = 15; // Distance to maintain when orbiting
        this.orbitAngle = 0; // Current angle for auto-orbit
        this.isAutoOrbiting = false;
        
        // Background mode settings
        this.backgroundMode = false;
        this.gentleRotationSpeed = 0.0001; // Very slow rotation for background mode
        this.backgroundOpacity = 0.3;
        this.backgroundCameraDistance = 150; // Default distance for background viewing
        
        // Camera state preservation for page transitions
        this.preservedCameraState = null;
        this.shouldPreserveCameraPosition = true; // Enable camera preservation by default

        // ── Explore Earth mode ──────────────────────────────────────────────
        // Free-look mode: focusing Earth flies in then FREEZES the globe and hands
        // control to the user (drag to rotate, zoom in close). See enter/exit below.
        this.exploreMode = false;
        // Restored on exit so other planets/auto-orbit behave exactly as before.
        this._preExploreOrbiting = this.orbitingPlanet;
        this._exploreMinDistance = 0;   // set on enter from Earth radius
        this._exploreMaxDistance = 0;
        this.bordersUrl = 'src/assets/geo/country_borders.json';
        // localStorage key for persisting which explore layers were toggled on.
        this._exploreLayersKey = 'mrcargon.explore.layers';
        // Zoom level-of-detail auto-reveal (states/cities/districts). Default ON.
        this._lodEnabled = true;
        // Per-frame scratch (Rule: no per-frame allocation in the animate loop).
        this._scratchEarthPos = new THREE.Vector3();
        this._scratchCamPos = new THREE.Vector3();
        this._scratchSurf = new THREE.Vector3();      // surface look-at point (orbit pivot)
        this._scratchTarget = new THREE.Vector3();     // blended orbit target
        this._exploreRaycaster = new THREE.Raycaster();
        this._ndc = new THREE.Vector2();
        this._onExploreClick = (e) => this._handleExploreClick(e);
        this._onExploreMove = (e) => this._handleExploreHover(e);
        this._onExploreDblClick = (e) => this._handleExploreDblClick(e);
        // Bound Escape handler so it can be added/removed without leaking.
        this._onExploreKeydown = (e) => {
            if (e.key === 'Escape' && this.exploreMode) {
                this.exitExploreMode();
            }
        };

        // A1: live reduced-motion flag. When true, the simulation starts PAUSED
        // (no autonomous orbital motion) but stays fully interactive — the Time
        // panel play/scrub still works. Kept live via matchMedia 'change'.
        this.reducedMotion = this.prefersReducedMotion();
        this._reducedMotionMq = (window.matchMedia)
            ? window.matchMedia('(prefers-reduced-motion: reduce)')
            : null;
        this._onReducedMotionChange = (e) => { this.reducedMotion = !!e.matches; };
        if (this._reducedMotionMq) {
            if (this._reducedMotionMq.addEventListener) {
                this._reducedMotionMq.addEventListener('change', this._onReducedMotionChange);
            } else if (this._reducedMotionMq.addListener) {
                this._reducedMotionMq.addListener(this._onReducedMotionChange); // legacy
            }
        }

        // Reduced-motion: start the clock paused so planets don't auto-orbit on
        // load. animate() still runs solarSystem.update every frame (explore +
        // time scrubbing stay live); the user can press play to opt into motion.
        if (this.reducedMotion && this.timeManager) {
            this.timeManager.pause();
        }

        // Cosmology features (Phase 5)
        this.cosmologyFeatures = {
            gravitationalWaves: null,
            darkMatterHalo: null,
            exoplanetSystems: null,
            cosmicScale: null,
            stringTheory: null
        };
        this.activeCosmologyFeature = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Store bound handler references for proper removal (FIX #4)
        this.boundHandleResize = this.handleResize.bind(this);
        this.boundAnimate = this.animate.bind(this);
    }

    /**
     * Show cosmology feature error notification (FIX #3)
     * NASA Rule 5: 2+ assertions | Rule 4: <= 60 lines
     */
    showCosmologyError(featureName, errorMessage) {
        console.assert(typeof featureName === 'string', 'showCosmologyError: featureName must be string');
        console.assert(typeof errorMessage === 'string', 'showCosmologyError: errorMessage must be string');

        const errorDiv = document.createElement('div');
        errorDiv.className = 'cosmology-error-notification';
        errorDiv.innerHTML = `
            <strong>Cosmology Feature Error</strong><br>
            <span>${featureName}: ${errorMessage}</span>
        `;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            max-width: 350px;
            animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(errorDiv);

        // Auto-remove after 7 seconds
        setTimeout(() => {
            errorDiv.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => errorDiv.remove(), 300);
        }, 7000);
    }

    /**
     * Show 3D scene initialization error notification
     * NASA Rule 5: 2+ assertions | Rule 4: <= 60 lines
     */
    show3DSceneError() {
        console.assert(document.body !== null, 'show3DSceneError: document.body required');
        console.assert(typeof document.createElement === 'function', 'show3DSceneError: createElement required');

        const errorDiv = document.createElement('div');
        errorDiv.className = '3d-scene-error-notification';
        errorDiv.innerHTML = `
            <strong>3D Visualization Unavailable</strong><br>
            <span>The 3D solar system failed to load. This may happen when viewing from file:// URLs.</span><br>
            <span>Time controls and settings remain functional.</span><br>
            <small>Try serving via HTTP server for the full experience.</small>
            <button style="
                margin-top: 10px;
                padding: 5px 10px;
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-size: 12px;
            " onclick="this.parentElement.remove()">Dismiss</button>
        `;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            max-width: 350px;
            line-height: 1.5;
        `;

        document.body.appendChild(errorDiv);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 10000);
    }

    /**
     * Show WebGL initialization error notification
     * Called when GPU/driver fails to create WebGL context
     * NASA Rule 5: 2+ assertions | Rule 4: <= 60 lines
     */
    showWebGLError() {
        console.assert(document.body !== null, 'showWebGLError: document.body required');
        console.assert(typeof document.createElement === 'function', 'showWebGLError: createElement required');

        const errorDiv = document.createElement('div');
        errorDiv.className = 'webgl-error-notification';
        errorDiv.innerHTML = `
            <strong>🖥️ WebGL Not Available</strong><br>
            <span>Your browser or GPU doesn't support WebGL, which is required for the 3D solar system.</span><br>
            <br>
            <strong>Possible solutions:</strong><br>
            <ul style="margin: 5px 0 10px 20px; padding: 0;">
                <li>Update your graphics drivers</li>
                <li>Try a different browser (Chrome, Firefox, Edge)</li>
                <li>Enable hardware acceleration in browser settings</li>
                <li>Check if WebGL is blocked by security software</li>
            </ul>
            <span>Navigation and content remain fully functional.</span>
            <button style="
                margin-top: 10px;
                padding: 8px 16px;
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-size: 12px;
                display: block;
            " onclick="this.parentElement.remove()">Continue Without 3D</button>
        `;
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #e24a4a 0%, #bd3535 100%);
            color: white;
            padding: 25px 30px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            z-index: 10001;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            max-width: 420px;
            line-height: 1.6;
            text-align: left;
        `;

        document.body.appendChild(errorDiv);
    }

    async init() {
        try {
            console.log("SpaceEnvironment initialization started");
            
            // Rule 6: Check if in fallback mode, handle gracefully
            if (this.fallbackMode) {
                console.warn("SpaceEnvironment in fallback mode - creating basic container");
                this.createFallbackContainer();
                return true;
            }
            
            // Create container first to show loading visuals ASAP
            this.createContainer();
            
            // Rule 2: Wait for THREE.js to be fully ready with timeout
            await this.waitForThreeJS(5000);
            
            // Defer Three.js setup to next animation frame for smoother loading
            await new Promise(resolve => requestAnimationFrame(resolve));
            this.setupThreeJS();
            
        // Load essential resources first with fallback handling
        if (typeof ResourceLoader !== 'undefined') {
            this.resourceLoader = new ResourceLoader();
            console.log('ResourceLoader initialized successfully');
        } else {
            console.warn('ResourceLoader not available, using fallback');
            this.resourceLoader = {
                loadTexture: async (path) => {
                    console.warn(`Fallback texture loading for: ${path}`);
                    return null;
                },
                purgeCache: () => {
                    console.log('Fallback cache purge - ResourceLoader not available');
                }
            };
        }
            
            // Initialize solar system with progressive loading strategy and fallback handling
            if (typeof SolarSystem !== 'undefined') {
                this.solarSystem = new SolarSystem(this, {
                    progressiveLoading: true,
                    prioritizeCentralBodies: true
                });
                console.log('SolarSystem initialized successfully');

                // Expose for testing (only in development/test environment)
                window.solarSystem = this.solarSystem;
                window.scene = this.scene;
            } else {
                console.warn('SolarSystem not available, using fallback');
                this.solarSystem = {
                    init: async () => {
                        console.log('Fallback SolarSystem init - no 3D simulation available');
                        return true;
                    },
                    update: () => {},
                    toggleAnimation: () => {
                        console.log('Fallback animation toggle - SolarSystem not available');
                        return false;
                    },
                    toggleOrbits: () => {
                        console.log('Fallback orbit toggle - SolarSystem not available');
                        return false;
                    },
                    getPlanetByName: () => {
                        console.warn('Fallback getPlanetByName - SolarSystem not available');
                        return null;
                    },
                    getPlanetInfo: () => {
                        console.warn('Fallback getPlanetInfo - SolarSystem not available');
                        return null;
                    },
                    dispose: () => {
                        console.log('Fallback dispose - SolarSystem not available');
                    }
                };
            }

            // Phase 3: Initialize time control UI (moved before solarSystem.init() to avoid blocking on texture loading)
            if (this.timeManager && typeof TimeControlUI !== 'undefined') {
                this.timeControlUI = new TimeControlUI(this.timeManager);
                console.log('Phase 3: TimeControlUI initialized successfully');
            } else {
                console.warn('Phase 3: TimeControlUI not available - time controls disabled');
            }

            // Initialize FPS monitor with display element (Roaster Fix #2)
            if (typeof FPSMonitor !== 'undefined') {
                this.fpsMonitor = new FPSMonitor();
                const fpsDisplay = document.createElement('div');
                fpsDisplay.id = 'fps-monitor';
                document.body.appendChild(fpsDisplay);
                this.fpsMonitor.init(fpsDisplay);
                console.log('FPS monitor initialized');
            } else {
                console.warn('FPSMonitor not available - FPS tracking disabled');
            }

            // Initialize solar system with error handling for user feedback
            try {
                await this.solarSystem.init();
            } catch (initError) {
                console.error('Failed to initialize 3D solar system:', initError);
                this.show3DSceneError();
                // Continue initialization - time controls still work
            }

            this.connectUIControls();

            this.animate();

            console.log("SpaceEnvironment initialized successfully");
            this.initialized = true;
            this.show();

            return true;
        } catch (error) {
            console.error('Failed to initialize Space Environment:', error);
            return false;
        }
    }
    
    createContainer() {
        // Create a container for the 3D scene if it doesn't exist
        const containerId = 'solar-system-container';
        let container = document.getElementById(containerId);
        
        if (!container) {
            console.log(`Creating new solar system container`);
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'solar-system-background';
            
            // Set styles to ensure the container acts as a background
            container.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                z-index: -5 !important;
                overflow: hidden !important;
                pointer-events: auto !important;
                opacity: 1 !important;
                background-color: #000011 !important;
                display: block !important;
            `;
            
            // Insert at the beginning of body
            document.body.insertBefore(container, document.body.firstChild);
            console.log("Creating new solar system container");
        } else {
            // Reset styles to ensure visibility and interactivity
            container.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                z-index: -5 !important;
                overflow: hidden !important;
                pointer-events: auto !important;
                opacity: 1 !important;
                background-color: #000011 !important;
                display: block !important;
            `;
        }
        
        // Log the container's style for debugging
        console.log("Container style:", {
            display: container.style.display,
            opacity: container.style.opacity,
            zIndex: container.style.zIndex,
            position: container.style.position,
            pointerEvents: container.style.pointerEvents
        });
        
        this.container = container;
        return container;
    }
    
    setupThreeJS() {
        // Get dimensions
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        // Create scene
        this.scene = new THREE.Scene();
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 4000);
        this.camera.position.set(0, 30, 100);
        this.camera.lookAt(0, 0, 0);

        // Store camera reference in scene for LOD systems (Sun.js particle LOD)
        this.scene.userData.camera = this.camera;

        // Renderer with enhanced lighting capabilities
        // CRITICAL FIX: Wrap WebGLRenderer in try/catch to handle GPU/driver failures
        try {
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                powerPreference: "high-performance"
            });
        } catch (webglError) {
            console.error('WebGL initialization failed:', webglError);
            this.showWebGLError();
            this.fallbackMode = true;
            this.createFallbackContainer();
            return; // Exit setupThreeJS early - can't continue without renderer
        }

        // Verify WebGL context was created successfully
        if (!this.renderer || !this.renderer.getContext()) {
            console.error('WebGL context creation failed - GPU may not support WebGL');
            this.showWebGLError();
            this.fallbackMode = true;
            this.createFallbackContainer();
            return;
        }

        this.renderer.setSize(this.width, this.height);
        this.renderer.setClearColor(0x000011); // Deep space color

        // Enable shadows for realistic lighting
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = true;

        // Enhanced tone mapping for realistic space lighting
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.25;
        // Correct color/output and lighting model for consistent brightness (r155+)
        if (THREE.SRGBColorSpace) {
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        }
        // New lighting flag per three r155+ (false = modern physically-based lights)
        this.renderer.useLegacyLights = false;

        // Add renderer to container
        this.container.appendChild(this.renderer.domElement);

        // Debug renderer settings
        console.log('Renderer lighting config', {
            outputColorSpace: this.renderer.outputColorSpace,
            toneMapping: this.renderer.toneMapping,
            exposure: this.renderer.toneMappingExposure,
            useLegacyLights: this.renderer.useLegacyLights
        });
        
        // 🌟 COMPREHENSIVE LIGHTING SYSTEM
        this.setupRealisticLighting();
        
        // Add OrbitControls if available
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.enableZoom = true;
            this.controls.minDistance = 2; // Don't get too close to objects
            this.controls.maxDistance = 300; // Don't go too far
            
            // Set up control change listener to detect manual camera movement
            this.controls.addEventListener('change', () => {
                // If user is manually controlling, stop auto-orbiting
                if (!this.cameraTransitioning) {
                    this.isAutoOrbiting = false;
                    this.checkOrbitZone();
                }
            });
            
            // Detect when user starts controlling
            this.controls.addEventListener('start', () => {
                if (!this.cameraTransitioning) {
                    this.isAutoOrbiting = false;
                }
            });
        }
        
        // Add resize handler (FIX #4: using bound reference)
        window.addEventListener('resize', this.boundHandleResize);
        
        // Add memory manager with fallback handling
        if (typeof MemoryManager !== 'undefined') {
            this.memoryManager = new MemoryManager(this.scene, this.renderer);
            console.log('MemoryManager initialized successfully');
        } else {
            console.warn('MemoryManager not available, using fallback cleanup');
            this.memoryManager = {
                track: () => {},
                cleanUp: () => {
                    console.log('Fallback cleanup - MemoryManager not available');
                }
            };
        }
        
        console.log("ThreeJS setup complete. Container now has renderer:", 
            this.container.contains(this.renderer.domElement));
    }
    
    /**
     * 🌟 COMPREHENSIVE REALISTIC LIGHTING SYSTEM
     * Purpose: Create realistic solar illumination for planets and space objects
     * Rule 2: Bounded light parameters | Rule 5: Validated lighting setup
     */
    setupRealisticLighting() {
        // Rule 5: Validate scene availability
        const Assert = window.Assert || {};
        if (typeof Assert.assertNotNull === 'function') {
            Assert.assertNotNull(this.scene, 'Scene required for lighting setup');
        }
        
        console.log('🌟 Setting up comprehensive solar lighting system...');
        
        // 1. PRIMARY SUN LIGHT - The main star illumination
        this.sunLight = new THREE.PointLight(0xFFFFE0, 0.8, 0, 2); // Warm sunlight color, more realistic intensity
        this.sunLight.position.set(0, 0, 0); // At Sun's position
        this.sunLight.castShadow = true;
        
        // Configure sun shadow properties for realistic shadows
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.1;
        this.sunLight.shadow.camera.far = 300;
        this.sunLight.shadow.radius = 4;
        this.sunLight.shadow.blurSamples = 8;
        
        // Add sun light to scene
        this.scene.add(this.sunLight);
        console.log('☀️ Primary sun light configured');
        
        // 2. AMBIENT SPACE LIGHT - Minimal fill lighting for visibility
        this.ambientLight = new THREE.AmbientLight(0x404080, 0.08); // Cool deep space ambient (realistic level)
        this.scene.add(this.ambientLight);
        console.log('🌌 Ambient space light added');
        
        // 3. SECONDARY SUN GLOW - Enhances the sun's visual presence
        this.sunGlow = new THREE.PointLight(0xFFA500, 0.4, 150, 1.5); // Orange glow (more realistic)
        this.sunGlow.position.set(0, 0, 0);
        this.scene.add(this.sunGlow);
        console.log('🔥 Sun glow enhancement added');
        
        // 4. DISTANT STARLIGHT - Very subtle illumination from distant stars
        this.starlightFill = new THREE.DirectionalLight(0x9BB4FF, 0.08); // Cool distant starlight
        this.starlightFill.position.set(100, 50, 100);
        this.scene.add(this.starlightFill);
        console.log('✨ Distant starlight fill configured');
        
        // 5. HEMISPHERE LIGHT - Creates natural sky-like illumination gradient
        this.hemisphereLight = new THREE.HemisphereLight(0x4A5FFF, 0x2E1B69, 0.06); // Cool space gradient (realistic)
        this.scene.add(this.hemisphereLight);
        console.log('🌐 Hemisphere gradient lighting added');
        
        // 6. SETUP DYNAMIC LIGHTING HELPER
        this.setupDynamicLighting();
        
        // Store all lights for easy management
        this.lights = {
            sun: this.sunLight,
            ambient: this.ambientLight,
            glow: this.sunGlow,
            starlight: this.starlightFill,
            hemisphere: this.hemisphereLight
        };
        
        console.log('🌟 Comprehensive lighting system initialized successfully!');
        return true;
    }
    
    /**
     * Setup dynamic lighting that responds to camera position and selected planets
     * Purpose: Rule 2 bounded dynamic adjustments | Rule 5 validated parameters
     */
    setupDynamicLighting() {
        // Dynamic lighting parameters with bounds (Rule 2)
        this.lightingConfig = {
            sunIntensityBase: 0.8, // Base sun light intensity (realistic level)
            sunIntensityRange: [0.5, 1.2], // Min/max sun intensity bounds (realistic)
            ambientRange: [0.05, 0.12], // Ambient light intensity bounds (realistic)
            glowRange: [0.2, 0.6], // Sun glow intensity bounds (realistic)
            maxDistance: 300, // Maximum light influence distance
            minDistance: 10 // Minimum effective distance
        };
        
        console.log('⚙️ Dynamic lighting configuration established');
        return true;
    }
    
    /**
     * Update lighting based on camera position and selected planet
     * Purpose: Rule 2 bounded updates | Called from animation loop
     * @param {string} selectedPlanet - Currently selected planet name
     * @param {THREE.Vector3} cameraPosition - Current camera position
     */
    updateDynamicLighting(selectedPlanet = null, cameraPosition = null) {
        if (!this.lights || !this.lightingConfig) return;
        
        // Rule 2: Calculate bounded distance from sun
        const camPos = cameraPosition || this.camera.position;
        const distanceFromSun = camPos.distanceTo(new THREE.Vector3(0, 0, 0));
        const clampedDistance = Math.max(
            this.lightingConfig.minDistance, 
            Math.min(this.lightingConfig.maxDistance, distanceFromSun)
        );
        
        // Rule 2: Calculate intensity factor based on distance (bounded 0-1)
        const distanceFactor = 1 - (clampedDistance / this.lightingConfig.maxDistance);
        const intensityFactor = Math.max(0.3, Math.min(1.0, distanceFactor + 0.3));
        
        // Update sun light intensity dynamically
        const targetSunIntensity = this.lightingConfig.sunIntensityBase * intensityFactor;
        this.lights.sun.intensity = Math.max(
            this.lightingConfig.sunIntensityRange[0],
            Math.min(this.lightingConfig.sunIntensityRange[1], targetSunIntensity)
        );
        
        // Update ambient based on selection context
        if (selectedPlanet === 'Sun') {
            // Brighter ambient when focused on sun
            this.lights.ambient.intensity = this.lightingConfig.ambientRange[1];
            this.lights.glow.intensity = this.lightingConfig.glowRange[1];
        } else {
            // Standard ambient for other contexts
            this.lights.ambient.intensity = this.lightingConfig.ambientRange[0] + 
                (intensityFactor * (this.lightingConfig.ambientRange[1] - this.lightingConfig.ambientRange[0]));
            this.lights.glow.intensity = this.lightingConfig.glowRange[0] + 
                (intensityFactor * (this.lightingConfig.glowRange[1] - this.lightingConfig.glowRange[0]));
        }
    }
    
    /**
     * Position sun light at the sun's mesh position
     * Purpose: Keep lighting synchronized with sun object
     * @param {THREE.Vector3} sunPosition - Position of the sun mesh
     */
    updateSunLightPosition(sunPosition) {
        if (!this.lights || !sunPosition) return false;
        
        // Update both primary light and glow position
        // Note: Removed per-frame assertion to prevent overflow
        this.lights.sun.position.copy(sunPosition);
        this.lights.glow.position.copy(sunPosition);
        
        return true;
    }
    
    /**
     * Toggle lighting effects for debugging and performance
     * Purpose: Rule 6 graceful lighting control | Debugging utility
     */
    toggleLightingEffects(effectType = 'all') {
        if (!this.lights) {
            console.warn('Cannot toggle lighting - lights not initialized');
            return false;
        }
        
        // Rule 2: Bounded effect types
        const validEffects = ['all', 'sun', 'ambient', 'glow', 'starlight', 'hemisphere'];
        if (!validEffects.includes(effectType)) {
            console.warn(`Invalid lighting effect type: ${effectType}`);
            return false;
        }
        
        switch (effectType) {
            case 'all':
                // Toggle all lighting
                Object.values(this.lights).forEach(light => {
                    light.visible = !light.visible;
                });
                console.log(`🔦 All lighting effects ${this.lights.sun.visible ? 'enabled' : 'disabled'}`);
                break;
                
            case 'sun':
                this.lights.sun.visible = !this.lights.sun.visible;
                console.log(`☀️ Sun light ${this.lights.sun.visible ? 'enabled' : 'disabled'}`);
                break;
                
            case 'ambient':
                this.lights.ambient.visible = !this.lights.ambient.visible;
                console.log(`🌌 Ambient light ${this.lights.ambient.visible ? 'enabled' : 'disabled'}`);
                break;
                
            case 'glow':
                this.lights.glow.visible = !this.lights.glow.visible;
                console.log(`🔥 Sun glow ${this.lights.glow.visible ? 'enabled' : 'disabled'}`);
                break;
                
            case 'starlight':
                this.lights.starlight.visible = !this.lights.starlight.visible;
                console.log(`✨ Starlight ${this.lights.starlight.visible ? 'enabled' : 'disabled'}`);
                break;
                
            case 'hemisphere':
                this.lights.hemisphere.visible = !this.lights.hemisphere.visible;
                console.log(`🌐 Hemisphere light ${this.lights.hemisphere.visible ? 'enabled' : 'disabled'}`);
                break;
        }
        
        return true;
    }

    handleResize() {
        if (!this.camera || !this.renderer) return;
        
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(this.width, this.height);
    }
    
    connectUIControls() {
        // Connect planet buttons - handled by PageManager
        
        // Connect camera controls
        const resetCameraBtn = document.getElementById('reset-camera');
        if (resetCameraBtn) {
            resetCameraBtn.addEventListener('click', () => this.resetCamera());
        }
        
        const toggleRotationBtn = document.getElementById('toggle-rotation');
        if (toggleRotationBtn) {
            toggleRotationBtn.addEventListener('click', () => {
                if (this.solarSystem) {
                    const isEnabled = this.solarSystem.toggleAnimation();
                    toggleRotationBtn.classList.toggle('active', isEnabled);
                    console.log(`Planet rotation ${isEnabled ? 'enabled' : 'disabled'}`);
                }
            });
        }
        
        const toggleOrbitBtn = document.getElementById('toggle-orbit');
        if (toggleOrbitBtn) {
            toggleOrbitBtn.addEventListener('click', () => {
                if (this.solarSystem) {
                    const isVisible = this.solarSystem.toggleOrbits();
                    toggleOrbitBtn.classList.toggle('active', isVisible);
                    console.log(`Orbit lines ${isVisible ? 'visible' : 'hidden'}`);
                }
            });
        }
        
        // Follow rotation toggle
        const toggleFollowRotationBtn = document.getElementById('toggle-follow-rotation');
        if (toggleFollowRotationBtn) {
            toggleFollowRotationBtn.addEventListener('click', () => {
                this.followingPlanet = !this.followingPlanet;
                toggleFollowRotationBtn.classList.toggle('active', this.followingPlanet);
                console.log(`Planet following ${this.followingPlanet ? 'enabled' : 'disabled'}`);
            });
        }
        
        // Orbit mode toggle - controls auto-orbiting around planets
        const toggleOrbitModeBtn = document.getElementById('toggle-orbit-mode');
        if (toggleOrbitModeBtn) {
            toggleOrbitModeBtn.addEventListener('click', () => {
                this.orbitingPlanet = !this.orbitingPlanet;
                toggleOrbitModeBtn.classList.toggle('active', this.orbitingPlanet);
                
                if (this.orbitingPlanet && this.selectedPlanet && this.insideOrbitZone) {
                    this.isAutoOrbiting = true;
                    // Disable manual controls when auto-orbiting
                    if (this.controls) {
                        this.controls.enabled = false;
                    }
                } else {
                    this.isAutoOrbiting = false;
                    // Re-enable manual controls
                    if (this.controls) {
                        this.controls.enabled = true;
                    }
                }
                
                console.log(`Auto-orbiting ${this.orbitingPlanet ? 'enabled' : 'disabled'}`);
            });
        }
    }
    
    resetCamera() {
        // Reset camera to default position
        if (this.camera) {
            // Exit explore mode first so the globe unfreezes and explore visuals
            // / panel are torn down before we fly back out. No stuck state.
            if (this.exploreMode) {
                this.exitExploreMode(true);
            }
            this.cameraTransitioning = true;
            this.isAutoOrbiting = false;
            
            // Re-enable manual controls
            if (this.controls) {
                this.controls.enabled = true;
            }
            
            // Use smooth transition
            this.smoothCameraTransition(
                new THREE.Vector3(0, 30, 100),
                new THREE.Vector3(0, 0, 0),
                () => {
                    // When done, clear selected planet
                    this.selectedPlanet = null;
                    this.insideOrbitZone = false;
                    this.cameraTransitioning = false;
                    console.log("Camera reset to default position");
                }
            );
        }
    }

    /**
     * Whether the user prefers reduced motion.
     * Rule 5: 2 assertions, return value used by callers.
     * @returns {boolean}
     */
    prefersReducedMotion() {
        console.assert(typeof window !== 'undefined', 'prefersReducedMotion: window required');
        const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
        console.assert(mq === undefined || typeof mq === 'object', 'prefersReducedMotion: bad mq');
        return !!(mq && mq.matches);
    }

    /**
     * Resolve the Earth planet object (with mesh + radius). Rule 5: 2 asserts.
     * @returns {Object|null}
     */
    getEarthObject() {
        console.assert(this.solarSystem, 'getEarthObject: solarSystem required');
        if (!this.solarSystem || !this.solarSystem.getPlanetByName) return null;
        const earth = this.solarSystem.getPlanetByName('Earth');
        console.assert(earth === null || typeof earth === 'object', 'getEarthObject: bad result');
        return (earth && earth.getMesh) ? earth : null;
    }

    /**
     * Read persisted explore layer toggle state from localStorage.
     * Rule 5: 2 asserts | Rule 6: graceful fallback on parse/storage failure.
     * @returns {Object} map of layer name → boolean (empty object on failure)
     */
    _readExploreLayerState() {
        console.assert(typeof this._exploreLayersKey === 'string', '_readExploreLayerState: key required');
        if (typeof localStorage === 'undefined') return {};
        try {
            const raw = localStorage.getItem(this._exploreLayersKey);
            console.assert(raw === null || typeof raw === 'string', '_readExploreLayerState: bad raw');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (e) {
            console.warn('Explore: could not read layer state', e);
            return {};
        }
    }

    /**
     * Persist current explore layer visibility to localStorage. Reads each layer's
     * live visibility off the Earth object. Rule 5: 2 asserts | Rule 6: try/catch.
     * @returns {boolean}
     */
    _writeExploreLayerState() {
        console.assert(typeof this._exploreLayersKey === 'string', '_writeExploreLayerState: key required');
        if (typeof localStorage === 'undefined') return false;
        const earth = this.getEarthObject();
        console.assert(earth === null || typeof earth === 'object', '_writeExploreLayerState: bad earth');
        if (!earth) return false;
        const L = earth.layers || {};
        const state = {
            borders: !!(earth.borders && earth.borders.visible),
            graticule: !!(earth.graticule && earth.graticule.visible),
            iss: !!(L.iss && L.iss.visible),
            quakes: !!(L.quakes && L.quakes.visible),
            pois: !!(L.pois && L.pois.visible),
            lod: !!this._lodEnabled
        };
        try {
            localStorage.setItem(this._exploreLayersKey, JSON.stringify(state));
            return true;
        } catch (e) {
            console.warn('Explore: could not persist layer state', e);
            return false;
        }
    }

    /**
     * Enter free-look Explore mode on Earth: freeze the globe, hand control to the
     * user, lock controls.target to Earth, set close zoom bounds, build/show the
     * graticule + borders, and show the location panel. Rule 4: <=60 lines.
     * @returns {boolean}
     */
    enterExploreMode() {
        const earth = this.getEarthObject();
        console.assert(earth, 'enterExploreMode: Earth object required');
        console.assert(this.controls, 'enterExploreMode: controls required');
        if (!earth || !this.controls) return false;

        const radius = (earth.data && earth.data.radius) || 2;
        this.exploreMode = true;
        this._preExploreOrbiting = this.orbitingPlanet;
        this.orbitingPlanet = false;
        this.isAutoOrbiting = false;

        // Freeze the globe so the marker holds still for inspection.
        if (typeof earth.setFrozen === 'function') earth.setFrozen(true);

        // Hand control to the user, pivoting around Earth's (now static) centre.
        const earthPos = earth.getMesh().getWorldPosition(this._scratchEarthPos);
        this._exploreMinDistance = radius * 1.005;   // hug the surface — see streets/satellite up close
        this._exploreMaxDistance = radius * 12;
        this.controls.enabled = true;
        this.controls.minDistance = this._exploreMinDistance;
        this.controls.maxDistance = this._exploreMaxDistance;
        // Dolly to a close initial framing (~3x radius). Reuses scratch (no alloc).
        const camDir = this._scratchCamPos.copy(this.camera.position).sub(earthPos).normalize();
        if (camDir.lengthSq() < 1e-6) camDir.set(0, 0, 1);
        this.camera.position.copy(earthPos).addScaledVector(camDir, radius * 3.0);
        this.controls.target.copy(earthPos);
        this.controls.enablePan = false; // pan would drift off the globe
        // Inertial damping for smooth, consistent drag/zoom (the animate loop already
        // calls controls.update() every frame, which damping requires). Restored on exit.
        this._preExploreDamping = this.controls.enableDamping;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.09;
        this.controls.update();
        if (this.renderer && this.renderer.domElement) this.renderer.domElement.style.cursor = 'grab';

        // THE core fix: the canvas container lives at z-index -5 (behind BODY), so a
        // negative-z element never receives pointer events (they hit BODY first) and
        // OrbitControls can't see the drag. Raise the canvas ABOVE the page during
        // explore so it gets mouse/touch/wheel events. #content is made transparent
        // to pointer events so they fall through. Both restored on exit.
        if (this.container) { this._prevContainerZ = this.container.style.zIndex; this.container.style.zIndex = '30'; }
        const content = document.getElementById('content');
        if (content) { this._prevContentPE = content.style.pointerEvents; content.style.pointerEvents = 'none'; }
        // Hide the solar-system side panels (meaningless over a single frozen globe).
        document.querySelectorAll('.side-popup').forEach((p) => { p.style.display = 'none'; });
        const hints = document.getElementById('keyboard-hints'); if (hints) hints.style.display = 'none';

        this._restoreExploreLayers(earth);
        // Click a marker → detail card; hover the surface → cascade region highlight +
        // name (country→state→county→district→zip, finest loaded tier for the zoom).
        if (typeof earth.buildRegionTiers === 'function') earth.buildRegionTiers();
        if (typeof earth.buildCountryHover === 'function') earth.buildCountryHover();
        // Cascade the five atmospheric shells in (Troposphere→Exosphere, staggered).
        if (earth.atmosphereLayers && typeof earth.atmosphereLayers.cascadeIn === 'function') {
            earth.atmosphereLayers.cascadeIn();
        }
        // Attach to window so events fire regardless of canvas z-index/pointer-events.
        window.addEventListener('click', this._onExploreClick);
        window.addEventListener('mousemove', this._onExploreMove);
        window.addEventListener('dblclick', this._onExploreDblClick);   // double-click → re-center

        this.setupExplorePanel();
        this._syncExploreToggleButtons();
        this.announceExplore('Explore Earth mode. Drag to rotate, scroll to zoom. Click markers for details.');
        this._updateExploreButton();   // hides the opt-in button while exploring
        console.log('Entered Explore Earth mode');
        return true;
    }

    /**
     * Build + show the explore data layers, honouring persisted toggle state from
     * localStorage (default: all on for first-time discovery). Lazy-builds each
     * layer then sets visibility. Rule 4: <=60 lines | Rule 5: 2 asserts.
     * @param {Object} earth
     * @returns {boolean}
     */
    _restoreExploreLayers(earth) {
        console.assert(earth && typeof earth === 'object', '_restoreExploreLayers: earth required');
        const saved = this._readExploreLayerState();
        console.assert(saved && typeof saved === 'object', '_restoreExploreLayers: bad saved');
        // Default visible when no key has ever been written, else honour saved bool.
        const want = (k) => (saved[k] === undefined ? true : !!saved[k]);

        if (typeof earth.buildGraticule === 'function') {
            const g = earth.buildGraticule();
            if (g) g.visible = want('graticule');
        }
        if (earth.borders) {
            earth.borders.visible = want('borders');
        } else if (typeof earth.buildBorders === 'function') {
            earth.buildBorders(this.bordersUrl).then((b) => {
                if (b && this.exploreMode) b.visible = want('borders');
                this._syncExploreToggleButtons();
            });
        }
        if (typeof earth.buildPois === 'function') {
            const p = earth.buildPois(); if (p) p.visible = want('pois');
            if (typeof earth.setLayerVisible === 'function') earth.setLayerVisible('pois', want('pois'));
        }
        if (typeof earth.buildQuakes === 'function') {
            earth.buildQuakes().then((q) => {
                if (q && this.exploreMode && typeof earth.setLayerVisible === 'function') {
                    earth.setLayerVisible('quakes', want('quakes'));
                }
                this._syncExploreToggleButtons();
            });
        }
        if (want('iss') && typeof earth.startISS === 'function') {
            earth.startISS();
            earth.setLayerVisible('iss', true);
        }
        // Zoom level-of-detail auto-reveal: default ON; if persisted off, suppress.
        this._lodEnabled = want('lod');
        this._applyLodState(earth, this._lodEnabled);
        return true;
    }

    /**
     * Apply the LOD auto-reveal state to the Earth's geoLOD engine. When enabled,
     * resume zoom-driven auto reveal; when disabled, stop auto + hide all tiers.
     * No-ops if geoLOD is absent (script not loaded / Earth not ready). Rule 5: 2 asserts.
     * @param {Object} earth
     * @param {boolean} enabled
     * @returns {boolean}
     */
    _applyLodState(earth, enabled) {
        console.assert(earth === null || typeof earth === 'object', '_applyLodState: bad earth');
        console.assert(typeof enabled === 'boolean', '_applyLodState: enabled must be boolean');
        const lod = earth && earth.geoLOD;
        // "Detail" governs BOTH the LOD geography AND the street basemap so the one
        // toggle is coherent (off = no states/cities/districts AND no streets).
        if (earth && earth.streetTiles && typeof earth.streetTiles.setVisible === 'function') {
            earth.streetTiles.setVisible(enabled);
        }
        if (earth && earth.satelliteTiles && typeof earth.satelliteTiles.setVisible === 'function') {
            earth.satelliteTiles.setVisible(enabled);
        }
        if (!lod) return !!(earth && earth.streetTiles);
        if (typeof lod.setAuto === 'function') lod.setAuto(enabled);
        if (!enabled && typeof lod.setTierVisible === 'function') {
            ['states', 'cities', 'districts'].forEach((t) => lod.setTierVisible(t, false));
        }
        return true;
    }

    /**
     * Show the opt-in "Explore Earth" button only when Earth is the focused planet
     * and we are not already exploring; wire its click once. This replaces the old
     * auto-enter-on-Earth-select behaviour. Rule 5: 2 asserts.
     * @returns {boolean} whether the button is shown
     */
    _updateExploreButton() {
        console.assert(typeof document !== 'undefined', '_updateExploreButton: document required');
        const btn = document.getElementById('explore-enter-btn');
        console.assert(btn === null || typeof btn === 'object', '_updateExploreButton: bad btn');
        if (!btn) return false;
        if (!btn.dataset.wired) {
            btn.dataset.wired = '1';
            btn.addEventListener('click', () => this.enterExploreMode());
            // The button lives in #content, and #footer-container (position:relative,
            // z-index:200) paints over it → unclickable. Reparent to <body> (root
            // stacking context), lift ABOVE the footer's z-index, and raise it up the
            // screen so it also clears the ~70px footer visually.
            if (btn.parentElement !== document.body) document.body.appendChild(btn);
            btn.style.zIndex = '300';
            btn.style.bottom = '96px';
        }
        const show = (this.selectedPlanet === 'Earth') && !this.exploreMode;
        btn.hidden = !show;
        btn.style.display = show ? 'block' : 'none';
        return show;
    }

    /**
     * Exit Explore mode: unfreeze Earth, hide explore visuals + panel, restore
     * orbit defaults and zoom bounds. If skipFlyBack is false, also flies the
     * camera back out (Escape path); resetCamera passes true and flies itself.
     * Rule 4: <=60 lines.
     * @param {boolean} [skipFlyBack=false]
     * @returns {boolean}
     */
    exitExploreMode(skipFlyBack = false) {
        if (!this.exploreMode) return false;
        console.assert(this.controls, 'exitExploreMode: controls required');
        // Persist toggle state BEFORE we flip everything off, so the user's choices
        // survive to the next entry.
        this._writeExploreLayerState();
        this.exploreMode = false;

        const earth = this.getEarthObject();
        if (earth) {
            if (typeof earth.setFrozen === 'function') earth.setFrozen(false);
            // Hide overlays + restore clouds that the fly-through may have faded.
            if (earth.graticule) earth.graticule.visible = false;
            if (earth.borders) earth.borders.visible = false;
            if (earth.cloudsMesh) {
                earth.cloudsMesh.visible = true;
                if (earth.cloudsMesh.material) earth.cloudsMesh.material.opacity = 0.8;
            }
            // Stop ISS polling + hide all live data layers.
            if (typeof earth.stopISS === 'function') earth.stopISS();
            ['iss', 'quakes', 'pois'].forEach((k) => {
                if (typeof earth.setLayerVisible === 'function') earth.setLayerVisible(k, false);
            });
            // Hide zoom-LOD geography + street tiles. These only update inside the
            // explore branch, so without an explicit hide they'd linger visible and
            // ride along on the globe once it resumes orbiting in solar-system view.
            if (earth.geoLOD && typeof earth.geoLOD.hideAll === 'function') earth.geoLOD.hideAll();
            if (earth.streetTiles && typeof earth.streetTiles.hide === 'function') earth.streetTiles.hide();
            if (earth.atmosphereLayers && typeof earth.atmosphereLayers.cascadeOut === 'function') {
                earth.atmosphereLayers.cascadeOut();   // retract the shells (outer→inner)
            }
            if (earth.satelliteTiles && typeof earth.satelliteTiles.hide === 'function') earth.satelliteTiles.hide();
            // Reset the SF marker scale (updateExploreLOD shrinks it when zoomed in
            // and only runs in explore — otherwise it stays shrunk in solar view).
            if (earth.marker) earth.marker.userData.distanceScale = 1;
            // Restore full base-globe brightness (explore dims it at close zoom).
            const bm2 = earth.mesh && earth.mesh.material && earth.mesh.material.uniforms;
            if (bm2 && bm2.uSurfaceDim) bm2.uSurfaceDim.value = 1.0;
        }

        // Restore default orbit behaviour + global zoom bounds.
        this.orbitingPlanet = this._preExploreOrbiting;
        if (this.controls) {
            this.controls.enabled = true;
            this.controls.minDistance = 2;
            this.controls.maxDistance = 300;
            this.controls.enablePan = true;
            this.controls.rotateSpeed = 1.0;
            this.controls.zoomSpeed = 1.0;
            this.controls.enableDamping = (this._preExploreDamping === true);
        }
        // Restore the default camera clip planes (explore shrinks them for close zoom).
        if (this.camera && (this.camera.near !== 0.1 || this.camera.far !== 4000)) {
            this.camera.near = 0.1; this.camera.far = 4000; this.camera.updateProjectionMatrix();
        }
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.style.cursor = '';
        }
        window.removeEventListener('click', this._onExploreClick);
        window.removeEventListener('mousemove', this._onExploreMove);
        window.removeEventListener('dblclick', this._onExploreDblClick);
        // Restore canvas z-index + content pointer-events + the hidden side panels.
        if (this.container) this.container.style.zIndex = (this._prevContainerZ != null ? this._prevContainerZ : '-5');
        const content = document.getElementById('content');
        if (content) content.style.pointerEvents = (this._prevContentPE || '');
        document.querySelectorAll('.side-popup').forEach((p) => { p.style.display = ''; });
        const hints = document.getElementById('keyboard-hints'); if (hints) hints.style.display = '';
        if (this._detailEl) this._detailEl.hidden = true;
        if (earth && typeof earth.highlightRegion === 'function') earth.highlightRegion(null, null);
        if (earth && typeof earth.highlightCountry === 'function') earth.highlightCountry(null);
        if (this._tooltipEl) this._tooltipEl.hidden = true;

        this.teardownExplorePanel();
        this.announceExplore('Exited Explore Earth mode.');
        console.log('Exited Explore Earth mode');

        if (!skipFlyBack) {
            // Escape path: fly back to the default solar-system framing.
            this.resetCamera();
        }
        this._updateExploreButton();   // re-show the opt-in button if still on Earth
        return true;
    }

    /**
     * Move the CAMERA onto the ray from Earth's centre through the SF marker's
     * WORLD position (accounts for latitude AND current rotation), keeping
     * controls.target on Earth centre — so SF ends up centred at ANY latitude.
     * Rule 4: <=60 lines | Rule 5: asserts.
     * @returns {boolean}
     */
    centerOnSanFrancisco() {
        const earth = this.getEarthObject();
        console.assert(earth, 'centerOnSanFrancisco: Earth required');
        if (!earth || !earth.marker || !this.camera) return false;
        if (!this.controls) return false;

        const mesh = earth.getMesh();
        const earthPos = mesh.getWorldPosition(this._scratchEarthPos);
        const markerWorld = earth.marker.getWorldPosition(this._scratchCamPos);
        const dir = markerWorld.clone().sub(earthPos).normalize();
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
        const dist = this.camera.position.distanceTo(earthPos);
        const destPos = earthPos.clone().addScaledVector(dir, dist);

        if (this.prefersReducedMotion()) {
            this.camera.position.copy(destPos);
            this.controls.target.copy(earthPos);
            this.controls.update();
            console.log('Centered on San Francisco (instant)');
            return true;
        }
        return this.centerOnLatLng(earth.markerCoords.lat, earth.markerCoords.lng);
    }

    /**
     * Re-orient the globe so a chosen (lat,lng) faces the camera, keeping the
     * centre-orbit pivot (you then spin the globe around it). Used by "Center on SF"
     * and by clicking any place / region / zip. Holds the current zoom distance.
     * Rule 4: <=60 lines | Rule 5: 2 asserts.
     * @returns {boolean}
     */
    centerOnLatLng(lat, lng) {
        console.assert(Number.isFinite(lat) && Number.isFinite(lng), 'centerOnLatLng: coords required');
        console.assert(typeof GlobeMath !== 'undefined', 'centerOnLatLng: GlobeMath required');
        const earth = this.getEarthObject();
        if (!earth || !this.camera || !this.controls || typeof GlobeMath === 'undefined') return false;
        const mesh = earth.getMesh();
        const earthPos = mesh.getWorldPosition(this._scratchEarthPos);
        // World position of the surface point at (lat,lng) on the (rotated) globe.
        const local = GlobeMath.latLngToVector3(lat, lng, earth.data.radius);
        const surfWorld = mesh.localToWorld(this._scratchSurf.copy(local));
        const dir = this._scratchTarget.copy(surfWorld).sub(earthPos).normalize();
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
        const dist = this.camera.position.distanceTo(earthPos);
        const destPos = earthPos.clone().addScaledVector(dir, dist);
        if (this.prefersReducedMotion()) {
            this.camera.position.copy(destPos); this.controls.target.copy(earthPos); this.controls.update();
            return true;
        }
        this.smoothCameraTransition(destPos, earthPos, null);
        return true;
    }

    /**
     * Cloud fly-through: as the camera nears Earth, fade clouds out so the camera
     * never sits inside an opaque shell; restore on zoom-out. Called per-frame
     * only while exploreMode. Reuses scratch vectors (no per-frame alloc).
     * Rule 4: <=60 lines.
     * @returns {boolean}
     */
    updateExploreClouds() {
        const earth = this.getEarthObject();
        if (!earth || !earth.cloudsMesh || !earth.cloudsMesh.material) return false;
        const radius = (earth.data && earth.data.radius) || 2;

        const earthPos = earth.getMesh().getWorldPosition(this._scratchEarthPos);
        const dist = this.camera.position.distanceTo(earthPos);
        // Live zoom readout — cached element, no per-frame DOM query/alloc.
        if (this._distEl) this._distEl.textContent = (dist / radius).toFixed(2) + '× Earth radius';
        const fadeStart = radius * 2.5;   // begin fading here
        const hideBelow = radius * 1.3;   // fully hidden below here

        const clouds = earth.cloudsMesh;
        if (dist <= hideBelow) {
            clouds.visible = false;
            return true;
        }
        clouds.visible = true;
        // Lerp opacity 0 (close) → 0.8 (at/above fadeStart).
        const span = Math.max(fadeStart - hideBelow, 1e-3);
        const k = Math.max(0, Math.min(1, (dist - hideBelow) / span));
        clouds.material.opacity = 0.8 * k;
        return true;
    }

    /**
     * Drive the zoom level-of-detail geography (states → cities → districts) from
     * the camera distance while exploring. GeoLOD lazily builds + cross-fades each
     * tier; safe no-op if absent. Called per-frame only while exploreMode.
     * Rule 4: <=60 lines.
     * @returns {boolean}
     */
    updateExploreLOD() {
        const earth = this.getEarthObject();
        if (!earth) return false;
        console.assert(this.camera, 'updateExploreLOD: camera required');
        const radius = (earth.data && earth.data.radius) || 2;
        console.assert(radius > 0, 'updateExploreLOD: radius must be positive');
        const earthPos = earth.getMesh().getWorldPosition(this._scratchEarthPos);
        const dist = this.camera.position.distanceTo(earthPos);
        const rr = dist / radius;
        // Dynamic near/far clip so the camera can get RIGHT up to the surface. The
        // default near=0.1 clips everything within 0.1 units, so at ~1.005R (surface
        // ~0.01 units away) the whole near surface — and its satellite tiles — was
        // clipped, leaving only the far limb/sky. Scale near to the altitude and pull
        // far in (nothing distant matters up close), which also sharpens depth
        // precision so the hugging overlays don't z-fight. Restored on exit.
        const surfDist = Math.max(dist - radius, 0.0008);
        const near = Math.max(0.0008, surfDist * 0.5);
        const far = dist + radius * 6;
        if (this.camera.near !== near || this.camera.far !== far) {
            this.camera.near = near; this.camera.far = far; this.camera.updateProjectionMatrix();
        }
        // Dim the base globe as the camera approaches (1.0 above 2R → ~0.22 at surface)
        // so where the satellite tiles have not loaded/reached, the low-res base reads
        // as a neutral dark surface instead of a blurry "old picture" on the sides.
        const bm = earth.mesh && earth.mesh.material && earth.mesh.material.uniforms;
        if (bm && bm.uSurfaceDim) {
            bm.uSurfaceDim.value = Math.max(0.22, Math.min(1.0, (rr - 1.05) / (2.0 - 1.05)));
        }
        // CENTRE-ORBIT (the comfortable, familiar model): a drag SPINS THE GLOBE around
        // its centre — like Google Earth's globe view — rather than tilting the camera
        // around a fixed surface point (the surface-pivot version felt wrong). Fine
        // close-up control comes from scaling rotate speed with ALTITUDE (rr-1): tiny
        // near the surface, normal far. "Center on <place/zip>" re-orients which point
        // faces you; you then spin the globe around it. Pivot gently held at centre.
        if (this.controls) {
            if (!this.cameraTransitioning) this.controls.target.lerp(earthPos, 0.2);
            const alt = Math.max(rr - 1, 0.001);
            this.controls.rotateSpeed = Math.max(0.02, Math.min(1.0, alt * 0.6));
            this.controls.zoomSpeed = Math.max(0.4, Math.min(1.0, 0.4 + alt * 0.3));
            this.controls.minDistance = radius * 1.005;
            this.controls.maxDistance = radius * 15;
        }
        // Interplanetary hand-off: zooming all the way back out leaves explore and
        // flies to the solar-system view, but KEEPS Earth selected with the Explore
        // button showing so the user can dive back in. Fires once (idempotent exit).
        if (rr > 9 && this.exploreMode) {
            this.exitExploreMode();              // skipFlyBack=false → resetCamera flies out
            this.selectedPlanet = 'Earth';       // keep Earth selected for easy re-entry
            this.updatePlanetInfo('Earth');
            this._updateExploreButton();         // show the "Explore Earth" button again
            return true;
        }
        // Location pins (SF marker + POI pins) are orientation aids for the far/mid
        // view; they balloon and cover the map up close, so fade them out as the
        // camera approaches (full >1.7R → gone by ~1.2R). Also keep the SF marker at
        // ~constant screen size while it's visible.
        const pinFade = Math.max(0, Math.min(1, (rr - 1.2) / (1.7 - 1.2)));
        if (earth.marker) {
            earth.marker.userData.distanceScale = Math.max(0.3, Math.min(1.8, rr / 3));
            if (earth.marker.material) earth.marker.material.opacity = pinFade;
            if (earth.markerHalo && earth.markerHalo.material) earth.markerHalo.material.opacity = 0.55 * pinFade;
            earth.marker.visible = pinFade > 0.02;
        }
        // All live-marker layers (ISS, quakes, POIs) are fixed-world-size spheres
        // that balloon up close (a big M5 quake dot or a POI pin covers the map at
        // street zoom). Fade them by the same pinFade; the toggle still owns .visible.
        if (earth.layers) {
            ['iss', 'quakes', 'pois'].forEach((k) => {
                const layer = earth.layers[k];
                if (!layer || !layer.traverse) return;
                layer.traverse((o) => { if (o.isMesh && o.material) o.material.opacity = 0.95 * pinFade; });
            });
        }
        // Country borders recede as the camera approaches the surface so they don't
        // compete with the satellite imagery + street lines at close zoom (full at
        // ~2R, faint by ~1.2R). Only when the borders layer is actually shown.
        if (earth.borders && earth.borders.visible && earth.borders.material) {
            const k = Math.max(0, Math.min(1, (rr - 1.2) / (2.0 - 1.2)));
            earth.borders.material.opacity = 0.15 + 0.55 * k;
        }
        if (earth.geoLOD) earth.geoLOD.update(dist / radius);
        // Atmosphere shells fade out as the camera zooms close (far/mid-view feature),
        // and their named labels track the limb.
        if (earth.atmosphereLayers && typeof earth.atmosphereLayers.update === 'function') {
            earth.atmosphereLayers.update(rr);
            if (this.renderer && this.renderer.domElement && typeof earth.atmosphereLayers.updateLabels === 'function') {
                earth.atmosphereLayers.updateLabels(this.camera, this.renderer.domElement.getBoundingClientRect());
            }
        }
        if (earth.streetTiles || earth.satelliteTiles) this._updateStreets(earth, radius, dist);
        return true;
    }

    /**
     * Drive the high-zoom street-tile engine: find the camera's look-at point on
     * the globe (ray through screen centre), convert to lat/lng in the mesh's local
     * frame (cancels globe rotation), and feed it + the camera distance to the
     * engine. Only meaningful when zoomed close. Rule 4: <=60 | Rule 5: 2 asserts.
     * @returns {boolean}
     */
    _updateStreets(earth, radius, dist) {
        console.assert(earth && (earth.streetTiles || earth.satelliteTiles), '_updateStreets: a tile layer required');
        console.assert(typeof GlobeMath !== 'undefined', '_updateStreets: GlobeMath required');
        const mesh = earth.getMesh();
        this._exploreRaycaster.setFromCamera(this._ndc.set(0, 0), this.camera);
        const hits = this._exploreRaycaster.intersectObject(mesh, false);
        // A4: streets are only meaningful when the look-at actually hits the globe.
        // The old camera-position fallback fetched sub-camera tiles the user wasn't
        // looking at, so on a ray miss we simply skip this frame.
        if (hits.length === 0) return false;
        const local = mesh.worldToLocal(this._scratchCamPos.copy(hits[0].point));
        const ll = GlobeMath.vector3ToLatLng(local, radius);
        if (ll && Number.isFinite(ll.lat) && Number.isFinite(ll.lng)) {
            if (earth.streetTiles) earth.streetTiles.update(ll.lat, ll.lng, dist / radius);
            // Reuse the SAME ll + dist (no re-raycast) to drive the satellite layer,
            // and dim it on the night hemisphere (unlit imagery would otherwise glow).
            if (earth.satelliteTiles) {
                if (typeof earth.satelliteTiles.setSunLight === 'function') {
                    earth.satelliteTiles.setSunLight(this._lookAtLit(earth, mesh, hits[0].point));
                }
                earth.satelliteTiles.update(ll.lat, ll.lng, dist / radius);
            }
        }
        return true;
    }

    /**
     * Sun-lit factor in [0.65, 1] at a world-space surface point: the outward normal
     * dotted with Earth's current sun direction (earth._sunDir, refreshed each frame
     * by Earth.update). Floor 0.65 so the night side stays clearly readable, not murky.
     * Rule 5: 2 asserts.
     * @returns {number}
     */
    _lookAtLit(earth, mesh, worldPoint) {
        console.assert(worldPoint && worldPoint.isVector3, '_lookAtLit: world point required');
        console.assert(earth && mesh, '_lookAtLit: earth + mesh required');
        const nrm = this._scratchCamPos.copy(worldPoint)
            .sub(mesh.getWorldPosition(this._scratchEarthPos)).normalize();
        const sun = earth._sunDir;
        if (!sun || !sun.isVector3) return 1;
        // Floor 0.65: the satellite is the layer the user zoomed in to SEE, so keep it
        // clearly readable on the night side rather than murky, while still dimming it
        // somewhat so it doesn't glow brighter than the lit hemisphere at far zoom.
        return Math.max(0.65, Math.min(1, nrm.dot(sun)));
    }

    /**
     * Visually-hidden aria-live announcement for explore mode enter/exit.
     * Reuses the same live region id PageManager uses. Rule 5: 2 asserts.
     * @param {string} message
     * @returns {boolean}
     */
    announceExplore(message) {
        console.assert(typeof message === 'string', 'announceExplore: string required');
        if (typeof document === 'undefined') return false;
        let region = document.getElementById('planet-live-region');
        console.assert(region === null || region.nodeType === 1, 'announceExplore: bad region');
        if (!region) {
            region = document.createElement('div');
            region.id = 'planet-live-region';
            region.setAttribute('aria-live', 'polite');
            region.setAttribute('aria-atomic', 'true');
            region.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
            document.body.appendChild(region);
        }
        region.textContent = message;
        return true;
    }

    /**
     * Show + wire the explore location panel (SF info, distance readout, Center-
     * on-SF, Borders/Grid/ISS/Quakes/Places toggles). Idempotent. Rule 4: <=60.
     * @returns {boolean}
     */
    /**
     * Make the explore panel draggable by its background (buttons still click).
     * Switches from the centered transform to explicit left/top on first grab and
     * clamps to the viewport. Wired once per panel. Rule 4: <=60 | Rule 5: 2 asserts.
     * @param {HTMLElement} panel
     * @returns {boolean}
     */
    _makePanelDraggable(panel) {
        console.assert(panel && panel.style, '_makePanelDraggable: panel required');
        console.assert(typeof window !== 'undefined', '_makePanelDraggable: window required');
        if (!panel) return false;
        // B1: dragging on touch must not fight native scroll.
        panel.style.touchAction = 'none';
        panel.style.cursor = 'move';
        // B2: only the pointerdown wiring lives behind the dataset guard (it dies with
        // the element). The window move/up + resize listeners are (re)attached by
        // _attachPanelWindowListeners on enter and removed on teardown — so re-running
        // after a teardown re-attaches them correctly. Drag state lives on the instance
        // so the window-bound move/up handlers can see it.
        this._panelDragState = this._panelDragState || { on: false, sx: 0, sy: 0, ox: 0, oy: 0 };
        if (!panel.dataset.draggable) {
            panel.dataset.draggable = '1';
            const st = this._panelDragState;
            this._panelDragDown = (e) => {
                if (e.target && e.target.closest && e.target.closest('button')) return; // buttons work
                const r = panel.getBoundingClientRect();
                panel.style.transform = 'none';
                panel.style.bottom = 'auto';
                panel.style.left = r.left + 'px';
                panel.style.top = r.top + 'px';
                st.on = true; st.sx = e.clientX; st.sy = e.clientY; st.ox = r.left; st.oy = r.top;
                panel.style.cursor = 'grabbing';
                e.preventDefault();
            };
            panel.addEventListener('pointerdown', this._panelDragDown);
        }
        this._attachPanelWindowListeners(panel);
        return true;
    }

    /**
     * Attach the window-level drag (move/up) + resize re-clamp listeners for the
     * explore panel. Idempotent: removes any prior set first so it never double-binds
     * or leaks. Stored on the instance so teardown/dispose can remove them.
     * B2 (move/up leak) + B3 (resize re-clamp). Rule 4: <=60 | Rule 5: 2 asserts.
     * @param {HTMLElement} panel
     * @returns {boolean}
     */
    _attachPanelWindowListeners(panel) {
        console.assert(panel && panel.style, '_attachPanelWindowListeners: panel required');
        console.assert(typeof window !== 'undefined', '_attachPanelWindowListeners: window required');
        this._detachPanelWindowListeners();
        const st = this._panelDragState || (this._panelDragState = { on: false, sx: 0, sy: 0, ox: 0, oy: 0 });
        this._panelDragMove = (e) => {
            if (!st.on) return;
            const r = panel.getBoundingClientRect();
            const nx = Math.max(0, Math.min(window.innerWidth - r.width, st.ox + e.clientX - st.sx));
            const ny = Math.max(0, Math.min(window.innerHeight - r.height, st.oy + e.clientY - st.sy));
            panel.style.left = nx + 'px';
            panel.style.top = ny + 'px';
        };
        this._panelDragUp = () => { st.on = false; panel.style.cursor = 'move'; };
        // B3: re-clamp the panel into the viewport after a resize/orientation change.
        this._panelResize = () => {
            if (panel.style.left === '' || panel.style.left === 'auto') return; // not yet dragged
            const r = panel.getBoundingClientRect();
            const nx = Math.max(0, Math.min(window.innerWidth - r.width, r.left));
            const ny = Math.max(0, Math.min(window.innerHeight - r.height, r.top));
            panel.style.left = nx + 'px';
            panel.style.top = ny + 'px';
        };
        window.addEventListener('pointermove', this._panelDragMove);
        window.addEventListener('pointerup', this._panelDragUp);
        window.addEventListener('resize', this._panelResize);
        return true;
    }

    /**
     * Remove the window-level explore-panel listeners (move/up/resize) if present.
     * Safe to call when none are attached. Rule 5: 2 asserts.
     * @returns {boolean}
     */
    _detachPanelWindowListeners() {
        console.assert(typeof window !== 'undefined', '_detachPanelWindowListeners: window required');
        console.assert(typeof window.removeEventListener === 'function', '_detachPanelWindowListeners: removeEventListener required');
        if (this._panelDragMove) { window.removeEventListener('pointermove', this._panelDragMove); this._panelDragMove = null; }
        if (this._panelDragUp) { window.removeEventListener('pointerup', this._panelDragUp); this._panelDragUp = null; }
        if (this._panelResize) { window.removeEventListener('resize', this._panelResize); this._panelResize = null; }
        return true;
    }

    setupExplorePanel() {
        if (typeof document === 'undefined') return false;
        const panel = document.getElementById('explore-panel');
        console.assert(panel === null || panel.nodeType === 1, 'setupExplorePanel: bad panel');
        if (!panel) return false;
        panel.hidden = false;
        panel.style.display = 'flex';   // [hidden] alone overridden by inline display; toggle explicitly
        this._distEl = document.getElementById('explore-distance'); // cache (no per-frame query)
        document.addEventListener('keydown', this._onExploreKeydown);

        this._detailEl = document.getElementById('explore-detail');
        this._tooltipEl = document.getElementById('country-tooltip');

        // The canvas is raised to z-index 30 in explore; the panel's z is trapped
        // inside #content's stacking context (painted below the canvas → unclickable).
        // Reparent the explore UI to <body> so it's in the root stacking context and
        // sits above the canvas. Idempotent.
        [panel, this._detailEl, this._tooltipEl].forEach((el) => {
            if (el && el.parentElement !== document.body) document.body.appendChild(el);
        });
        // #footer-container is position:relative z-index:200 in the root stacking
        // context; once reparented to <body> the panel/detail must out-rank it or
        // they paint under the footer. (Tooltip is pointer-events:none, lift too.)
        if (panel) panel.style.zIndex = '210';
        if (this._detailEl) this._detailEl.style.zIndex = '211';
        if (this._tooltipEl) this._tooltipEl.style.zIndex = '212';
        this._makePanelDraggable(panel);   // movable by its background; buttons still click

        if (!panel.dataset.wired) {
            const center = document.getElementById('explore-center-sf');
            const borders = document.getElementById('explore-toggle-borders');
            const grid = document.getElementById('explore-toggle-grid');
            const iss = document.getElementById('explore-toggle-iss');
            const quakes = document.getElementById('explore-toggle-quakes');
            const places = document.getElementById('explore-toggle-places');
            const lod = document.getElementById('explore-toggle-lod');
            if (center) center.addEventListener('click', () => this.centerOnSanFrancisco());
            if (borders) borders.addEventListener('click', () => this._toggleExploreLayer('borders', borders));
            if (grid) grid.addEventListener('click', () => this._toggleExploreLayer('graticule', grid));
            if (iss) iss.addEventListener('click', () => this._toggleDataLayer('iss', iss));
            if (quakes) quakes.addEventListener('click', () => this._toggleDataLayer('quakes', quakes));
            if (places) places.addEventListener('click', () => this._toggleDataLayer('pois', places));
            if (lod) lod.addEventListener('click', () => this._toggleLodLayer(lod));
            const mode = document.getElementById('explore-mode');
            if (mode) mode.addEventListener('click', () => this._cycleMapMode(mode));
            const exit = document.getElementById('explore-exit');
            if (exit) exit.addEventListener('click', () => this.exitExploreMode());
            panel.dataset.wired = '1';
        }
        return true;
    }

    /**
     * Toggle a lazily-built explore overlay (borders|graticule) + sync its button
     * aria-pressed/active state + persist. Rule 5: 2 asserts.
     * @param {string} layer - 'borders' | 'graticule'
     * @param {HTMLElement} btn
     * @returns {boolean}
     */
    _toggleExploreLayer(layer, btn) {
        console.assert(layer === 'borders' || layer === 'graticule', '_toggleExploreLayer: bad layer');
        const earth = this.getEarthObject();
        console.assert(earth, '_toggleExploreLayer: Earth required');
        if (!earth || !earth[layer]) return false;
        const obj = earth[layer];
        obj.visible = !obj.visible;
        if (btn) {
            btn.classList.toggle('active', obj.visible);
            btn.setAttribute('aria-pressed', obj.visible ? 'true' : 'false');
        }
        this._writeExploreLayerState();
        return true;
    }

    /**
     * Toggle a live data layer (iss|quakes|pois) by visibility + persist.
     * Rule 5: 2 asserts.
     * @param {string} name
     * @param {HTMLElement} btn
     * @returns {boolean}
     */
    _toggleDataLayer(name, btn) {
        console.assert(typeof name === 'string', '_toggleDataLayer: name required');
        const earth = this.getEarthObject();
        console.assert(earth === null || typeof earth === 'object', '_toggleDataLayer: bad earth');
        if (!earth || !earth.layers || !earth.layers[name]) return false;
        const obj = earth.layers[name];
        obj.visible = !obj.visible;
        if (btn) {
            btn.classList.toggle('active', obj.visible);
            btn.setAttribute('aria-pressed', obj.visible ? 'true' : 'false');
        }
        this._writeExploreLayerState();
        return true;
    }

    /**
     * Toggle zoom level-of-detail auto-reveal (states/cities/districts). When turned
     * off, stops auto-reveal and hides all tiers; when on, resumes auto-reveal.
     * No-ops if geoLOD is absent. Rule 5: 2 asserts.
     * @param {HTMLElement} btn
     * @returns {boolean}
     */
    _toggleLodLayer(btn) {
        console.assert(btn === null || btn.nodeType === 1, '_toggleLodLayer: bad btn');
        const earth = this.getEarthObject();
        console.assert(earth === null || typeof earth === 'object', '_toggleLodLayer: bad earth');
        this._lodEnabled = !this._lodEnabled;
        this._applyLodState(earth, this._lodEnabled);
        if (btn) {
            btn.classList.toggle('active', this._lodEnabled);
            btn.setAttribute('aria-pressed', this._lodEnabled ? 'true' : 'false');
        }
        this._writeExploreLayerState();
        return true;
    }

    /**
     * Cycle the basemap mode (satellite → dark → street → topo → light) and relabel
     * the button. The new map re-fetches from the chosen Esri service. Rule 5: 2 asserts.
     * @param {HTMLElement} btn
     * @returns {boolean}
     */
    _cycleMapMode(btn) {
        console.assert(btn === null || btn.nodeType === 1, '_cycleMapMode: bad btn');
        const earth = this.getEarthObject();
        console.assert(earth === null || typeof earth === 'object', '_cycleMapMode: bad earth');
        if (!earth || !earth.satelliteTiles || typeof earth.satelliteTiles.nextMode !== 'function') return false;
        const mode = earth.satelliteTiles.nextMode();
        if (btn) btn.textContent = '🗺️ ' + mode.charAt(0).toUpperCase() + mode.slice(1);
        return true;
    }

    /**
     * Raycast a click against the live markers → show a detail card. Rule 4: <=60.
     * @param {MouseEvent} event
     */
    _handleExploreClick(event) {
        if (!this.exploreMode || !this.camera || !this._detailEl) return;
        const earth = this.getEarthObject();
        if (!earth || !earth.pickables || !earth.pickables.length) return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this._ndc.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        this._exploreRaycaster.setFromCamera(this._ndc, this.camera);
        const pick = earth.pickables.filter((m) => m.visible && (!m.parent || m.parent.visible));
        const hits = this._exploreRaycaster.intersectObjects(pick, false);
        if (hits.length) {
            const u = hits[0].object.userData || {};
            // textContent (not innerHTML): marker info can come from live feeds
            // (e.g. USGS quake "place" strings), so never inject feed text as HTML.
            this._detailEl.textContent = '';
            const strong = document.createElement('strong');
            strong.textContent = u.name || 'Marker';
            this._detailEl.appendChild(strong);
            if (u.info) {
                this._detailEl.appendChild(document.createElement('br'));
                this._detailEl.appendChild(document.createTextNode(u.info));
            }
            this._detailEl.hidden = false;
        } else {
            this._detailEl.hidden = true;
        }
    }

    /**
     * Double-click a point on the globe (or a hovered region / zip) to RE-CENTER the
     * view there — the globe rotates so that point faces you, then you spin around it
     * (centre-orbit). The "set other surface points" interaction. Rule 4: <=60 lines.
     * @param {MouseEvent} event
     */
    _handleExploreDblClick(event) {
        if (!this.exploreMode || !this.camera) return;
        const earth = this.getEarthObject();
        if (!earth || !earth.getMesh || typeof GlobeMath === 'undefined') return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this._ndc.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        this._exploreRaycaster.setFromCamera(this._ndc, this.camera);
        const mesh = earth.getMesh();
        const hits = this._exploreRaycaster.intersectObject(mesh, false);
        if (!hits.length) return;
        const local = mesh.worldToLocal(this._scratchCamPos.copy(hits[0].point));
        const ll = GlobeMath.vector3ToLatLng(local, earth.data.radius);
        if (ll && Number.isFinite(ll.lat) && Number.isFinite(ll.lng)) {
            this.centerOnLatLng(ll.lat, ll.lng);
        }
    }

    /**
     * Hover the globe → highlight the country under the cursor + show its name.
     * Raycasts the surface, converts the hit to lat/lng, point-in-polygon lookup.
     * Rule 4: <=60 lines.
     * @param {MouseEvent} event
     */
    _handleExploreHover(event) {
        if (!this.exploreMode || !this.camera) return;
        const earth = this.getEarthObject();
        if (!earth || !earth.mesh || typeof earth.countryAt !== 'function') return;
        // Lazy-cache the tooltip element (robust against panel-setup timing).
        if (!this._tooltipEl && typeof document !== 'undefined') {
            this._tooltipEl = document.getElementById('country-tooltip');
        }
        const rect = this.renderer.domElement.getBoundingClientRect();
        this._ndc.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        this.camera.updateMatrixWorld();
        earth.mesh.updateMatrixWorld();
        this._exploreRaycaster.setFromCamera(this._ndc, this.camera);
        const hits = this._exploreRaycaster.intersectObject(earth.mesh, false);
        if (!hits.length) {
            if (typeof earth.highlightRegion === 'function') earth.highlightRegion(null, null);
            earth.highlightCountry(null);
            if (this._tooltipEl) this._tooltipEl.hidden = true;
            return;
        }
        const local = earth.mesh.worldToLocal(hits[0].point.clone());
        const ll = GlobeMath.vector3ToLatLng(local, earth.data.radius);
        // CASCADE: pick the finest loaded tier for the current zoom (country→state→
        // county→district→zip); if it has no region under the cursor, fall back to
        // country so there's always a name. Name + tier label in the tooltip.
        const rr = this.camera.position.distanceTo(
            earth.getMesh().getWorldPosition(this._scratchEarthPos)) / (earth.data.radius || 2);
        let tier = (typeof earth.cascadeTierForDistance === 'function')
            ? earth.cascadeTierForDistance(rr) : 'country';
        let name = (typeof earth.regionAt === 'function') ? earth.regionAt(tier, ll.lat, ll.lng) : null;
        if (!name && tier !== 'country' && typeof earth.regionAt === 'function') {
            tier = 'country'; name = earth.regionAt('country', ll.lat, ll.lng);
        }
        if (typeof earth.highlightRegion === 'function') earth.highlightRegion(name ? tier : null, name);
        if (this._tooltipEl) {
            if (name) {
                const label = (tier === 'country') ? '' : '  ·  ' + tier;
                this._tooltipEl.textContent = name + label;
                this._tooltipEl.style.left = (event.clientX + 14) + 'px';
                this._tooltipEl.style.top = (event.clientY + 14) + 'px';
                this._tooltipEl.hidden = false;
            } else {
                this._tooltipEl.hidden = true;
            }
        }
    }

    /**
     * Sync the toggle buttons' pressed state to the overlays' actual visibility
     * (overlays are shown on enter, so the buttons must reflect that or the first
     * click inverts the state). Rule 5: 2 asserts.
     * @returns {boolean}
     */
    _syncExploreToggleButtons() {
        if (typeof document === 'undefined') return false;
        const earth = this.getEarthObject();
        console.assert(earth === null || typeof earth === 'object', '_syncExploreToggleButtons: bad earth');
        if (!earth) return false;
        const set = (id, vis) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.classList.toggle('active', !!vis);
            btn.setAttribute('aria-pressed', vis ? 'true' : 'false');
        };
        console.assert(typeof set === 'function', '_syncExploreToggleButtons: helper present');
        set('explore-toggle-grid', earth.graticule && earth.graticule.visible);
        set('explore-toggle-borders', earth.borders && earth.borders.visible);
        const L = earth.layers || {};
        set('explore-toggle-iss', L.iss && L.iss.visible);
        set('explore-toggle-quakes', L.quakes && L.quakes.visible);
        set('explore-toggle-places', L.pois && L.pois.visible);
        set('explore-toggle-lod', this._lodEnabled);
        return true;
    }

    /**
     * Hide the explore panel + remove the Escape listener. Rule 5: 2 asserts.
     * @returns {boolean}
     */
    teardownExplorePanel() {
        if (typeof document === 'undefined') return false;
        document.removeEventListener('keydown', this._onExploreKeydown);
        // B2/B3: drop the window-level drag/resize listeners so they don't leak onto a
        // disposed instance. The pointerdown stays on the panel (dies with the element);
        // a later setup re-attaches the window listeners via _makePanelDraggable.
        this._detachPanelWindowListeners();
        const panel = document.getElementById('explore-panel');
        console.assert(panel === null || panel.nodeType === 1, 'teardownExplorePanel: bad panel');
        if (panel) { panel.hidden = true; panel.style.display = 'none'; }
        this._distEl = null;
        this._detailEl = null;
        this._tooltipEl = null;
        return true;
    }

    focusOnPlanet(planetName) {
        if (!this.solarSystem) return;

        // If we're leaving Earth-explore for a new focus, tear explore down first
        // so the globe unfreezes, zoom bounds + orbit defaults restore, and the
        // explore overlays/panel/Escape-listener are removed. skipFlyBack=true: the
        // new focus below flies the camera itself. (Without this, switching planets
        // mid-explore leaves Earth frozen with the wrong orbit pivot + zoom bounds.)
        if (this.exploreMode) {
            this.exitExploreMode(true);
        }

        // Update planet info in the UI
        this.updatePlanetInfo(planetName);

        // Store the selected planet
        this.selectedPlanet = planetName;
        console.log(`Focusing on planet: ${planetName}`);
        // Show/hide the opt-in "Explore Earth" button for the new selection.
        this._updateExploreButton();

        // Focus camera on the selected planet
        if (this.solarSystem && typeof this.solarSystem.focusOnPlanet === 'function') {
            const cameraInfo = this.getPlanetCameraInfo(planetName);
            if (cameraInfo && this.camera) {
                // Use smooth transition
                this.cameraTransitioning = true;
                this.smoothCameraTransition(
                    cameraInfo.position,
                    cameraInfo.lookAt,
                    () => {
                        this.cameraTransitioning = false;
                        this.insideOrbitZone = true;

                        // Earth: do NOT auto-enter explore. Earth now orbits like any
                        // other planet; the opt-in "Explore Earth" button (managed by
                        // _updateExploreButton) lets the user choose to enter free-look.

                        // Start auto-orbiting if enabled
                        if (this.orbitingPlanet) {
                            this.isAutoOrbiting = true;
                            this.orbitAngle = -180; // Set orbit angle
                            
                            // Calculate orbit radius based on current distance
                            const planetObj = this.solarSystem.getPlanetByName(planetName);
                            if (planetObj && planetObj.getMesh) {
                                const mesh = planetObj.getMesh();
                                this.orbitRadius = this.camera.position.distanceTo(mesh.position);
                            }
                            
                            // Disable manual controls when auto-orbiting
                            if (this.controls) {
                                this.controls.enabled = false;
                            }
                        }
                        
                        console.log(`Camera focused on ${planetName}`);
                    }
                );
            }
        }
    }
    
    /**
     * Get camera position information for a specific planet
     * @param {string} planetName - Name of the planet
     * @returns {Object} - Position and lookAt information
     */
    getPlanetCameraInfo(planetName) {
        if (!this.solarSystem) return null;
        
        // Get the planet object
        const planet = this.solarSystem.getPlanetByName(planetName);
        if (!planet || !planet.getMesh) return null;
        
        const mesh = planet.getMesh();
        const planetPosition = mesh.position.clone();
        
        // Get planet radius (if available) or use default values
        let planetRadius = 1;
        if (planetName === 'Sun') {
            planetRadius = 20;
        } else if (planet.data && planet.data.radius) {
            planetRadius = planet.data.radius;
        }
        
        // Calculate appropriate camera distance based on planet size
        // Larger planets viewed from further away, with minimum distance
        let viewDistance = planetRadius * 4;
        
        // Sun needs a special distance since it's much larger
        if (planetName === 'Sun') {
            viewDistance = planetRadius * 3.5;
        } else if (planetName === 'Jupiter' || planetName === 'Saturn') {
            viewDistance = planetRadius * 3.5;
        }
        
        // Ensure minimum viewing distance
        viewDistance = Math.max(viewDistance, 8);
        
        // Position camera at an angle to see the planet better
        const cameraOffset = new THREE.Vector3(
            viewDistance * 0.866, // sin(30 degrees)
            viewDistance * 0.8, // cos(30 degrees)
            viewDistance * 0.866 // sin(30 degrees)
        );
        
        const cameraPosition = planetPosition.clone().add(cameraOffset);
        
        return {
            position: cameraPosition,
            lookAt: planetPosition
        };
    }
    
    /**
     * Smoothly transition camera to a new position and target
     * @param {THREE.Vector3} targetPosition - Target camera position
     * @param {THREE.Vector3} targetLookAt - Target look at point
     * @param {Function} onComplete - Callback when animation completes
     */
    smoothCameraTransition(targetPosition, targetLookAt, onComplete = null) {
        // Store current camera state
        const startPosition = this.camera.position.clone();
        const startTarget = this.controls ? this.controls.target.clone() : new THREE.Vector3(0, 0, 0);
        
        // Animation variables
        const startTime = this.clock.getElapsedTime();
        
        // Create animation function
        const animate = () => {
            const currentTime = this.clock.getElapsedTime();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / this.transitionDuration, 1);
            
            // Easing function (cubic ease in/out)
            const ease = this.easeInOutCubic(progress);
            
            // Update camera position
            this.camera.position.lerpVectors(startPosition, targetPosition, ease);
            
            // Update controls target
            if (this.controls) {
                this.controls.target.lerpVectors(startTarget, targetLookAt, ease);
                this.controls.update();
            } else {
                // If no controls, update camera look at directly
                this.camera.lookAt(
                    startTarget.x + (targetLookAt.x - startTarget.x) * ease,
                    startTarget.y + (targetLookAt.y - startTarget.y) * ease,
                    startTarget.z + (targetLookAt.z - startTarget.z) * ease
                );
            }
            
            // Continue animation until complete
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete
                if (onComplete) onComplete();
            }
        };
        
        // Start animation
        animate();
    }
    
    /**
     * Cubic easing function for smooth transitions
     * @param {number} t - Progress (0-1)
     * @returns {number} - Eased value
     */
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-(2 * t) + 2, 3) / 2;
    }
    
    /**
     * Check if camera is within the orbit zone of the selected planet
     */
    checkOrbitZone() {
        if (!this.selectedPlanet || !this.solarSystem) return false;
        
        // Get the current planet object
        const planetObj = this.solarSystem.getPlanetByName(this.selectedPlanet);
        if (!planetObj || !planetObj.getMesh) return false;
        
        // Get the planet mesh and its current position
        const mesh = planetObj.getMesh();
        const planetPosition = mesh.position.clone();
        
        // Calculate distance from camera to planet
        const distanceToPlanet = this.camera.position.distanceTo(planetPosition);
        
        // Get planet radius (if available) or use default
        let planetRadius = 1;
        if (planetObj.data && planetObj.data.radius) {
            planetRadius = planetObj.data.radius;
        }
        
        // Adjust zone radius based on planet size
        const zoneMultiplier = this.selectedPlanet === 'Sun' ? 4 : 12;
        const adjustedZoneRadius = planetRadius * zoneMultiplier;
        
        // Check if we're inside the zone
        const wasInside = this.insideOrbitZone;
        this.insideOrbitZone = distanceToPlanet < adjustedZoneRadius;
        
        // Log zone change if it changed
        if (wasInside !== this.insideOrbitZone) {
            console.log(`Orbit zone: ${this.insideOrbitZone ? 'Entered' : 'Exited'}`);
            
            // If we exit the zone, stop auto-orbiting and re-enable controls
            if (!this.insideOrbitZone) {
                this.isAutoOrbiting = false;
                if (this.controls) {
                    this.controls.enabled = true;
                }
            }
        }
        
        return this.insideOrbitZone;
    }
    
    updatePlanetInfo(planetName) {
        // Get planet data from solar system
        if (!this.solarSystem || typeof this.solarSystem.getPlanetInfo !== 'function') return;
        
        const planetInfo = this.solarSystem.getPlanetInfo(planetName);
        if (!planetInfo) return;
        
        // Update UI elements
        const nameEl = document.getElementById('planet-name');
        const descEl = document.getElementById('planet-description');
        const diameterEl = document.getElementById('planet-diameter');
        const distanceEl = document.getElementById('planet-distance');
        const orbitalEl = document.getElementById('planet-orbital-period');
        
        if (nameEl) nameEl.textContent = planetInfo.name;
        if (descEl) descEl.textContent = planetInfo.description;
        if (diameterEl) diameterEl.textContent = planetInfo.diameter;
        if (distanceEl) distanceEl.textContent = planetInfo.distanceFromSun;
        if (orbitalEl) orbitalEl.textContent = planetInfo.orbitalPeriod;
    }
    
    animate() {
        this.animationId = requestAnimationFrame(this.boundAnimate);

        // OPTIMIZATION: Skip heavy calculations when tab is hidden
        // Saves significant CPU/battery when user switches tabs
        if (document.hidden) {
            return; // Skip frame entirely when not visible
        }

        // Update FPS monitor (Roaster Fix #2)
        if (this.fpsMonitor) {
            const currentTime = performance.now();
            this.fpsMonitor.update(currentTime);
        }

        // Update controls if available and not auto-orbiting
        if (this.controls && !this.isAutoOrbiting) {
            this.controls.update();
        }

        // Update solar system with time synchronization (Phase 2)
        if (this.solarSystem) {
            const deltaTime = this.clock.getDelta(); // Keep original deltaTime for realistic speed

            // Phase 2: Update virtual time and pass to solar system
            // NASA Rule 7: Check if timeManager exists before using
            let j2000Days = null;
            if (this.timeManager) {
                this.timeManager.update(deltaTime * 1000); // Convert seconds to milliseconds
                j2000Days = this.timeManager.getJ2000Days();
            }

            // Always advance the simulation so the Time panel (play/scrub) and
            // explore-mode Earth refresh stay live. Reduced-motion is honored by
            // starting the clock paused (see constructor) — TimeScaleManager.update
            // early-returns while paused, so there is no autonomous motion until
            // the user presses play.
            this.solarSystem.update(deltaTime, j2000Days);

            // Update camera behavior based on selected planet
            if (this.exploreMode) {
                // Explore: free user controls + cloud fly-through; the auto-orbit
                // tracking is intentionally suppressed so the globe stays still.
                this.updateExploreClouds();
                this.updateExploreLOD();
            } else if (this.selectedPlanet && !this.cameraTransitioning) {
                this.updateCameraPlanetTracking();
            }
            
            // 🌟 UPDATE DYNAMIC LIGHTING SYSTEM
            this.updateDynamicLighting(this.selectedPlanet, this.camera.position);
            
            // Update sun light position if sun object exists
            const sunObject = this.solarSystem.getPlanetByName ? this.solarSystem.getPlanetByName('Sun') : null;
            if (sunObject && sunObject.getMesh && this.updateSunLightPosition) {
                const sunMesh = sunObject.getMesh();
                if (sunMesh) {
                    this.updateSunLightPosition(sunMesh.position);
                }
            }

            // Update cosmology features (Phase 5)
            if (this.cosmologyFeatures.gravitationalWaves) {
                this.cosmologyFeatures.gravitationalWaves.update(deltaTime);
            }
            if (this.cosmologyFeatures.darkMatterHalo) {
                this.cosmologyFeatures.darkMatterHalo.update(deltaTime);
            }
            if (this.cosmologyFeatures.exoplanetSystems) {
                this.cosmologyFeatures.exoplanetSystems.update(deltaTime);
            }
            if (this.cosmologyFeatures.stringTheory) {
                this.cosmologyFeatures.stringTheory.update(deltaTime);
            }
            if (this.cosmologyFeatures.cosmicScale) {
                this.cosmologyFeatures.cosmicScale.update(deltaTime);
            }
        }
        
        // Update gentle rotation for background mode
        if (this.backgroundMode) {
            this.updateGentleRotation();
        }
        
        // Render scene
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    /**
     * Update camera to track selected planet
     */
    updateCameraPlanetTracking() {
        if (!this.selectedPlanet || !this.solarSystem) return;
        
        // Skip if transitioning
        if (this.cameraTransitioning) return;
        
        // Get the current planet object
        const planetObj = this.solarSystem.getPlanetByName(this.selectedPlanet);
        if (!planetObj || !planetObj.getMesh) return;
        
        // Get the planet mesh and its current position
        const mesh = planetObj.getMesh();
        const planetPosition = mesh.position.clone();

        // Explore mode: user owns the camera. Never auto-orbit / re-trigger here.
        // Keep controls.target locked to Earth's (frozen, static) position so
        // drag-rotation pivots around the globe centre.
        if (this.exploreMode) {
            if (this.controls) {
                this.controls.target.copy(planetPosition);
            }
            return;
        }

        // Check if we're in the planet's orbit zone
        this.checkOrbitZone();
        
        // Handle auto-orbiting around the planet
        if (this.isAutoOrbiting && this.insideOrbitZone) {
            // Update orbit angle
            this.orbitAngle += this.autoOrbitSpeed;
            
            // Calculate new camera position orbiting around the planet
            const orbitX = Math.cos(this.orbitAngle) * this.orbitRadius;
            const orbitZ = Math.sin(this.orbitAngle) * this.orbitRadius;
            const orbitY = Math.sin(this.orbitAngle * 0.3) * this.orbitRadius * 0.3; // Add some vertical movement
            
            // Position camera in orbit around planet
            this.camera.position.set(
                planetPosition.x + orbitX,
                planetPosition.y + orbitY,
                planetPosition.z + orbitZ
            );
            
            // Always look at the planet
            this.camera.lookAt(planetPosition);
            
            // Update controls target to the planet
            if (this.controls) {
                this.controls.target.copy(planetPosition);
            }
        }
        
        // If following is enabled and not auto-orbiting, follow the planet's movement
        else if (this.followingPlanet && this.insideOrbitZone && !this.isAutoOrbiting) {
            // Get original relative position between camera and planet
            const cameraInfo = this.getPlanetCameraInfo(this.selectedPlanet);
            if (!cameraInfo) return;
            
            // Create the relative offset vector
            const relativeOffset = cameraInfo.position.clone().sub(planetPosition);
            
            // Apply this offset to the current planet position
            const newCameraPosition = planetPosition.clone().add(relativeOffset);
            
            // Update camera position while maintaining the relative offset
            this.camera.position.copy(newCameraPosition);
            
            // Ensure the camera is looking at the planet
            if (this.controls) {
                this.controls.target.copy(planetPosition);
                this.controls.update();
            } else {
                this.camera.lookAt(planetPosition);
            }
        }
        
        // If inside orbit zone but not auto-orbiting or following, just keep target on planet
        else if (this.insideOrbitZone && this.controls) {
            this.controls.target.copy(planetPosition);
        }
    }
    
    show(interactive = true) {
        if (!this.container) return;
        
        // Always make container visible and interactive
        this.container.style.display = 'block';
        this.container.style.opacity = '1';
        this.container.style.zIndex = '-5'; // Keep behind content
        this.container.style.pointerEvents = 'auto'; // Always allow interaction
        
        // If controls exist, enable them based on auto-orbit state
        if (this.controls) {
            this.controls.enabled = !this.isAutoOrbiting;
        }
        
        // Force a resize to ensure proper rendering
        this.handleResize();
        
        console.log(`Space environment visible (interactive: ${interactive})`);
    }
    
    stopRendering() {
        // Stop animation loop
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Hide container but keep it available
        if (this.container) {
            this.container.style.opacity = '0';
            this.container.style.pointerEvents = 'none';
        }
        
        console.log('Space environment rendering stopped');
    }
    
    hide() {
        if (!this.container) return;
        
        this.container.style.opacity = '0';
        this.container.style.pointerEvents = 'none';
        
        console.log("Space environment hidden (but still rendered)");
    }
    
    /**
     * Set background mode for non-interactive pages
     * Purpose: Rule 5 validated background mode with Rule 2 bounded parameters
     * Rule 6: Graceful handling of missing components
     */
    setBackgroundMode(isBackground) {
        // Rule 5: Validate background mode parameter
        const Assert = window.Assert || {};
        if (typeof Assert.assertType === 'function') {
            Assert.assertType(isBackground, 'boolean', 'Background mode flag must be boolean');
        }
        
        if (!this.container) {
            console.warn('Cannot set background mode - container not available');
            return false;
        }
        
        this.backgroundMode = isBackground;
        
        if (isBackground) {
            // Preserve current camera state before transitioning
            this.preserveCameraState();
            
            // Background mode: subtle, non-intrusive
            this.container.style.opacity = this.backgroundOpacity.toString();
            this.container.style.zIndex = '-10'; // Further behind
            this.container.style.pointerEvents = 'none'; // Non-interactive
            
            // Enable gentle auto-rotation for ambient effect
            this.enableGentleAutoRotation();
            this.disableInteractiveControls();
            
            // Use preserved camera position if available, otherwise use default
            if (this.shouldPreserveCameraPosition && this.preservedCameraState) {
                this.restoreCameraState();
                console.log('📷 Camera position preserved during transition');
            } else {
                this.setBackgroundCameraPosition();
                console.log('📷 Background camera position set');
            }
            
            console.log('🌌 Space environment set to background mode');
        } else {
            // Interactive mode: full functionality
            this.container.style.opacity = '1';
            this.container.style.zIndex = '-5';
            this.container.style.pointerEvents = 'auto';
            
            // Disable background rotation, enable interactive controls
            this.disableGentleAutoRotation();
            this.enableInteractiveControls();
            
            // Restore camera state if coming back to interactive mode
            if (this.preservedCameraState) {
                this.restoreCameraState();
                console.log('📷 Camera state restored for interactive mode');
            }
            
            console.log('🚀 Space environment set to interactive mode');
        }
        
        return true;
    }
    
    /**
     * Enable gentle auto-rotation for background ambiance
     * Purpose: Rule 2 bounded gentle rotation | Rule 5 validated parameters
     */
    enableGentleAutoRotation() {
        if (!this.camera || !this.controls) {
            console.warn('Cannot enable gentle rotation - camera/controls not available');
            return false;
        }
        
        // Rule 2: Bounded gentle rotation settings
        this.gentleRotationActive = true;
        this.gentleRotationAngle = 0;
        this.gentleRotationRadius = this.backgroundCameraDistance;
        
        console.log('🌀 Gentle auto-rotation enabled for background mode');
        return true;
    }
    
    /**
     * Disable gentle auto- (rotation * Purpose): Stop background rotation when switching modes
     */
    disableGentleAutoRotation() {
        this.gentleRotationActive = false;
        console.log('⏹️ Gentle auto-rotation disabled');
        return true;
    }
    
    /**
     * Set camera position for background viewing
     * Purpose: Rule 2 bounded distance | Rule 5 validated positioning
     */
    setBackgroundCameraPosition() {
        if (!this.camera) {
            console.warn('Cannot set background camera position - camera not available');
            return false;
        }
        
        // Rule 2: Set bounded background viewing position
        const backgroundPosition = new THREE.Vector3(
            this.backgroundCameraDistance * 0.7, // Side angle
            this.backgroundCameraDistance * 0.4, // Elevated view  
            this.backgroundCameraDistance * 0.8 // Distance from center
        );
        
        this.camera.position.copy(backgroundPosition);
        this.camera.lookAt(0, 0, 0); // Look at solar system center
        
        // Update controls target if available
        if (this.controls) {
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
        
        console.log('📷 Background camera position set');
        return true;
    }
    
    /**
     * Disable interactive controls for background mode
     * Purpose: Rule 6 graceful handling of missing controls
     */
    disableInteractiveControls() {
        // Leaving the interactive (main) view: fully tear down Explore mode first.
        // Otherwise it leaks the Escape keydown listener on document and keeps
        // running updateExploreClouds() every frame against a panel that PageManager
        // wipes via innerHTML on navigation, and Earth is left frozen.
        if (this.exploreMode) {
            this.exitExploreMode(true);
        }
        // Belt-and-suspenders: the atmosphere DOM labels live in <body> (outside the
        // #content that PageManager wipes), so if explore was already torn down by
        // another path they could linger on the next page. Force them hidden here
        // (cascadeOut is idempotent: targets→0 + labels opacity 0).
        const earth = (typeof this.getEarthObject === 'function') ? this.getEarthObject() : null;
        if (earth && earth.atmosphereLayers && typeof earth.atmosphereLayers.cascadeOut === 'function') {
            earth.atmosphereLayers.cascadeOut();
        }

        if (this.controls) {
            this.controls.enabled = false;
        }

        // Clear any active selections
        this.selectedPlanet = null;
        this.isAutoOrbiting = false;
        this.insideOrbitZone = false;

        console.log('🔒 Interactive controls disabled for background mode');
        return true;
    }
    
    /**
     * Enable interactive controls for main page
     * Purpose: Rule 6 graceful handling of missing controls
     */
    enableInteractiveControls() {
        if (this.controls) {
            this.controls.enabled = true;
        }
        
        console.log('🎮 Interactive controls enabled for main page');
        return true;
    }
    
    /**
     * Update gentle rotation for background mode
     * Purpose: Rule 2 bounded gentle movement | Called from animate loop
     */
    updateGentleRotation() {
        if (!this.gentleRotationActive || !this.camera || this.backgroundMode !== true) {
            return;
        }
        
        // Skip rotation if we're preserving camera position
        if (this.shouldPreserveCameraPosition && this.preservedCameraState) {
            return; // Keep camera at preserved position
        }
        
        // Rule 2: Increment angle with bounded speed
        this.gentleRotationAngle += this.gentleRotationSpeed;
        
        // Keep angle bounded (Rule 2: 0 to 2π)
        if (this.gentleRotationAngle > Math.PI * 2) {
            this.gentleRotationAngle = 0;
        }
        
        // Calculate gentle orbital position around the solar system
        const x = Math.cos(this.gentleRotationAngle) * this.gentleRotationRadius;
        const z = Math.sin(this.gentleRotationAngle) * this.gentleRotationRadius;
        const y = Math.sin(this.gentleRotationAngle * 0.3) * (this.gentleRotationRadius * 0.2); // Gentle vertical movement
        
        // Update camera position smoothly
        this.camera.position.set(x, y + (this.gentleRotationRadius * 0.3), z);
        this.camera.lookAt(0, 0, 0);
        
        // Update controls if available
        if (this.controls) {
            this.controls.target.set(0, 0, 0);
        }
    }
    
    /**
     * Preserve current camera state before mode transition
     * Purpose: Store camera position and target for restoration
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 3: Bounded storage
     */
    preserveCameraState() {
        // Rule 5: Validate camera availability
        if (!this.camera) {
            console.warn('Cannot preserve camera state - camera not available');
            return false;
        }
        
        if (!this.camera.position || !this.camera.position.clone) {
            console.warn('Cannot preserve camera state - position not available');
            return false;
        }
        
        // Store current camera state
        this.preservedCameraState = {
            position: this.camera.position.clone(),
            target: this.controls ? this.controls.target.clone() : new THREE.Vector3(0, 0, 0),
            selectedPlanet: this.selectedPlanet,
            isAutoOrbiting: this.isAutoOrbiting,
            orbitAngle: this.orbitAngle,
            timestamp: Date.now()
        };
        
        console.log('📸 Camera state preserved:', {
            position: `(${this.preservedCameraState.position.x.toFixed(2)}, ${this.preservedCameraState.position.y.toFixed(2)}, ${this.preservedCameraState.position.z.toFixed(2)})`,
            selectedPlanet: this.preservedCameraState.selectedPlanet || 'none'
        });
        
        return true;
    }
    
    /**
     * Restore preserved camera state
     * Purpose: Apply saved camera position and target
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 6: Graceful handling
     */
    restoreCameraState() {
        // Rule 5: Validate preserved state
        if (!this.preservedCameraState) {
            console.warn('No preserved camera state to restore');
            return false;
        }
        
        if (!this.camera) {
            console.warn('Cannot restore camera state - camera not available');
            return false;
        }
        
        try {
            // Restore camera position
            if (this.preservedCameraState.position) {
                this.camera.position.copy(this.preservedCameraState.position);
            }
            
            // Restore controls target
            if (this.controls && this.preservedCameraState.target) {
                this.controls.target.copy(this.preservedCameraState.target);
                this.controls.update();
            } else if (this.preservedCameraState.target) {
                // If no controls, just look at the target
                this.camera.lookAt(this.preservedCameraState.target);
            }
            
            // Restore selection state (but not auto-orbiting in background mode)
            if (!this.backgroundMode) {
                this.selectedPlanet = this.preservedCameraState.selectedPlanet;
                this.isAutoOrbiting = this.preservedCameraState.isAutoOrbiting;
                this.orbitAngle = this.preservedCameraState.orbitAngle || 0;
            }
            
            console.log('📸 Camera state restored');
            return true;
            
        } catch (error) {
            console.error('Error restoring camera state:', error);
            return false; // Rule 6: Allow recovery
        }
    }
    
    /**
     * Toggle camera position preservation
     * Purpose: Enable/disable camera preservation during transitions
     * Rule 4: ≤60 lines | Rule 5: 2+ assertions | Rule 1: Simple toggle
     */
    setCameraPreservation(enabled) {
        // Rule 5: Validate parameter
        if (typeof enabled !== 'boolean') {
            console.error('Camera preservation flag must be boolean');
            return false;
        }
        
        const previousState = this.shouldPreserveCameraPosition;
        this.shouldPreserveCameraPosition = enabled;
        
        console.log(`Camera preservation ${enabled ? 'enabled' : 'disabled'} (was ${previousState ? 'enabled' : 'disabled'})`);
        return true;
    }
    
    /**
     * Wait for THREE.js to be fully loaded and ready
     * Purpose: Rule 2 bounded waiting with timeout
     * Rule 5: Validate timing parameters
     */
    async waitForThreeJS(timeout = 5000) {
        // Rule 5: Validate timeout parameter
        const Assert = window.Assert || {};
        if (typeof Assert.assertRange === 'function') {
            Assert.assertRange(timeout, 1000, 30000, 'THREE.js wait timeout bounds');
        }
        
        return new Promise((resolve, reject) => {
            // Rule 2: Set bounded timeout
            const timeoutId = setTimeout(() => {
                reject(new Error('THREE.js loading timeout'));
            }, timeout);
            
            // Check if already ready
            if (typeof THREE !== 'undefined' && typeof THREE.OrbitControls !== 'undefined') {
                clearTimeout(timeoutId);
                resolve(true);
                return;
            }
            
            // Listen for THREE.js ready event
            const handleReady = () => {
                clearTimeout(timeoutId);
                window.removeEventListener('threejs-ready', handleReady);
                resolve(true);
            };
            
            window.addEventListener('threejs-ready', handleReady);
            
            // Double-check in case the event already fired
            setTimeout(() => {
                if (typeof THREE !== 'undefined' && typeof THREE.OrbitControls !== 'undefined') {
                    handleReady();
                }
            }, 100);
        });
    }
    
    /**
     * Create fallback container for non-3D mode
     * Purpose: Rule 6 graceful degradation when THREE.js unavailable
     * Rule 5: Validate container creation
     */
    createFallbackContainer() {
        // Rule 5: Validate document availability
        const Assert = window.Assert || {};
        if (typeof Assert.assertNotNull === 'function') {
            Assert.assertNotNull(document, 'Document required for fallback container');
            Assert.assertNotNull(document.body, 'Document body required');
        }
        
        const containerId = 'solar-system-container';
        let container = document.getElementById(containerId);
        
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'solar-system-background fallback-mode';
            
            // Set fallback styles with space theme
            container.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                z-index: -5 !important;
                overflow: hidden !important;
                pointer-events: none !important;
                opacity: 1 !important;
                background: radial-gradient(ellipse at bottom, #1B2735 0%, #090A0F 100%) !important;
                display: block !important;
            `;
            
            // Add fallback content indicating 3D unavailable
            container.innerHTML = `
                <div style="
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    color: rgba(255,255,255,0.3);
                    font-size: 12px;
                    font-family: monospace;
                    pointer-events: none;
                ">
                    3D visualization unavailable - fallback mode
                </div>
            `;
            
            document.body.insertBefore(container, document.body.firstChild);
            console.log("Created fallback space container");
        }
        
        this.container = container;
        this.initialized = true; // Mark as initialized in fallback mode
        return container;
    }

    /**
     * Enable Gravitational Waves visualization
     * NASA Rule 5: 2+ assertions | Rule 7: Check returns
     * @returns {Promise<boolean>} Success status
     */
    async enableGravitationalWaves() {
        console.assert(this.scene !== null, 'enableGravitationalWaves: scene required');
        console.assert(typeof GravitationalWaves !== 'undefined',
            'enableGravitationalWaves: GravitationalWaves class required');

        // Disable other features first (mutually exclusive)
        this.disableAllCosmologyFeatures();

        // Determine performance tier
        const performanceTier = this.determinePerformanceTier();

        // Create gravitational waves instance
        this.cosmologyFeatures.gravitationalWaves = new GravitationalWaves(this.scene, {
            gridSize: performanceTier === 'HIGH' ? 64 : (performanceTier === 'MEDIUM' ? 45 : 32),
            meshSize: 500,
            waveSpeed: 50,
            performanceTier: performanceTier
        });

        // Initialize
        const success = await this.cosmologyFeatures.gravitationalWaves.init();
        if (!success) {
            console.error('Failed to initialize Gravitational Waves');
            this.showCosmologyError('Gravitational Waves', 'Failed to load shaders. Please refresh the page or check your network connection.');
            if (this.cosmologyFeatures.gravitationalWaves) {
                this.cosmologyFeatures.gravitationalWaves.dispose();
                this.cosmologyFeatures.gravitationalWaves = null;
            }
            return false;
        }

        this.activeCosmologyFeature = 'gravitationalWaves';

        // Add click listener for wave events
        this.setupWaveEventListener();

        console.log('Gravitational Waves visualization enabled');
        return true;
    }

    /**
     * Enable Dark Matter Halo visualization
     * NASA Rule 5: 2+ assertions | Rule 7: Check returns
     * @returns {Promise<boolean>} Success status
     */
    async enableDarkMatterHalo() {
        console.assert(this.scene !== null, 'enableDarkMatterHalo: scene required');
        console.assert(typeof DarkMatterHalo !== 'undefined',
            'enableDarkMatterHalo: DarkMatterHalo class required');

        // Disable other features first (mutually exclusive)
        this.disableAllCosmologyFeatures();

        // Determine performance tier
        const performanceTier = this.determinePerformanceTier();

        // Create dark matter halo instance with NFW profile parameters
        this.cosmologyFeatures.darkMatterHalo = new DarkMatterHalo(this.scene, {
            scaleRadius: 100, // NFW scale radius (rₛ)
            outerRadius: 500, // Halo extent (10-100× solar system)
            characteristicDensity: 1.0,
            particleSize: 2.0,
            opacity: 0.15,
            color: 0x4444ff, // Blue-purple
            pulseSpeed: 0.5,
            pulseAmplitude: 0.3,
            performanceTier: performanceTier
        });

        // Initialize
        const success = await this.cosmologyFeatures.darkMatterHalo.init();
        if (!success) {
            console.error('Failed to initialize Dark Matter Halo');
            this.showCosmologyError('Dark Matter Halo', 'Failed to initialize. Please refresh the page.');
            if (this.cosmologyFeatures.darkMatterHalo) {
                this.cosmologyFeatures.darkMatterHalo.dispose();
                this.cosmologyFeatures.darkMatterHalo = null;
            }
            return false;
        }

        this.activeCosmologyFeature = 'darkMatterHalo';

        console.log('Dark Matter Halo visualization enabled (NFW profile)');
        return true;
    }

    /**
     * Enable Exoplanet Systems visualization
     * NASA Rule 5: 2+ assertions | Rule 7: Check returns
     * @param {string} systemName - Initial system to display (default: 'TRAPPIST-1')
     * @returns {Promise<boolean>} Success status
     */
    async enableExoplanetSystems(systemName = 'TRAPPIST-1') {
        console.assert(this.scene !== null, 'enableExoplanetSystems: scene required');
        console.assert(typeof ExoplanetSystems !== 'undefined',
            'enableExoplanetSystems: ExoplanetSystems class required');

        // Disable other features first (mutually exclusive)
        this.disableAllCosmologyFeatures();

        // Determine performance tier
        const performanceTier = this.determinePerformanceTier();

        // Create exoplanet systems instance
        this.cosmologyFeatures.exoplanetSystems = new ExoplanetSystems(this.scene, {
            scaleFactor: 500,
            planetScale: 8,
            showOrbits: true,
            showHabitableZone: true,
            showLabels: performanceTier !== 'LOW',
            performanceTier: performanceTier
        });

        // Initialize
        const success = await this.cosmologyFeatures.exoplanetSystems.init();
        if (!success) {
            console.error('Failed to initialize Exoplanet Systems');
            this.showCosmologyError('Exoplanet Systems', 'Failed to load exoplanet data. Please refresh the page.');
            if (this.cosmologyFeatures.exoplanetSystems) {
                this.cosmologyFeatures.exoplanetSystems.dispose();
                this.cosmologyFeatures.exoplanetSystems = null;
            }
            return false;
        }

        // Switch to requested system if not default
        if (systemName !== 'TRAPPIST-1') {
            const switched = this.cosmologyFeatures.exoplanetSystems.switchSystem(systemName);
            if (!switched) {
                console.warn(`Failed to switch to system: ${systemName}, using TRAPPIST-1`);
            }
        }

        this.activeCosmologyFeature = 'exoplanetSystems';

        console.log(`Exoplanet Systems visualization enabled: ${systemName}`);
        return true;
    }

    /**
     * Switch active exoplanet system
     * NASA Rule 5: 2+ assertions | Rule 7: Check returns
     * @param {string} systemName - System to switch to
     * @returns {boolean} Success status
     */
    switchExoplanetSystem(systemName) {
        console.assert(typeof systemName === 'string',
            'switchExoplanetSystem: systemName must be string');
        console.assert(this.cosmologyFeatures.exoplanetSystems !== null,
            'switchExoplanetSystem: exoplanet systems not enabled');

        if (!this.cosmologyFeatures.exoplanetSystems) {
            console.error('Exoplanet systems not enabled');
            return false;
        }

        const success = this.cosmologyFeatures.exoplanetSystems.switchSystem(systemName);
        if (success) {
            console.log(`Switched to exoplanet system: ${systemName}`);
        }

        return success;
    }

    /**
     * Get available exoplanet systems
     * NASA Rule 7: Check returns
     * @returns {Array<string>} List of system names
     */
    getAvailableExoplanetSystems() {
        if (!this.cosmologyFeatures.exoplanetSystems) {
            console.warn('Exoplanet systems not enabled');
            return [];
        }

        return this.cosmologyFeatures.exoplanetSystems.getAvailableSystems();
    }

    /**
     * Enable String Theory visualization
     * CRITICAL: Mandatory disclaimer shown before activation
     * NASA Rule 5: 2+ assertions | Rule 7: Check returns
     * @returns {Promise<boolean>} Success status (false if user declines disclaimer)
     */
    async enableStringTheory() {
        console.assert(this.scene !== null, 'enableStringTheory: scene required');
        console.assert(typeof StringTheory !== 'undefined',
            'enableStringTheory: StringTheory class required');

        // Disable other features first (mutually exclusive)
        this.disableAllCosmologyFeatures();

        // Determine performance tier
        const performanceTier = this.determinePerformanceTier();

        // Create string theory instance
        this.cosmologyFeatures.stringTheory = new StringTheory(this.scene, {
            performanceTier: performanceTier,
            stringLength: 10,
            baseAmplitude: 2.0,
            baseFrequency: 1.0,
            showExtraDimensions: true
        });

        // Initialize (shows mandatory disclaimer)
        const success = await this.cosmologyFeatures.stringTheory.init();
        if (!success || this.cosmologyFeatures.stringTheory.strings.length === 0) {
            console.log('String theory initialization cancelled or failed');
            this.showCosmologyError('String Theory', 'Failed to initialize. Please refresh the page.');
            if (this.cosmologyFeatures.stringTheory) {
                this.cosmologyFeatures.stringTheory.dispose();
            }
            this.cosmologyFeatures.stringTheory = null;
            return false;
        }

        this.activeCosmologyFeature = 'stringTheory';
        console.log('String Theory visualization enabled');

        return true;
    }

    /**
     * Enable Cosmic Scale visualization (FIX #1)
     * NASA Rule 5: 2+ assertions | Rule 7: Check returns
     * @returns {Promise<boolean>} Success status
     */
    async enableCosmicScale() {
        console.assert(this.scene !== null, 'enableCosmicScale: scene required');
        console.assert(this.camera !== null, 'enableCosmicScale: camera required');
        console.assert(typeof CosmicScale !== 'undefined',
            'enableCosmicScale: CosmicScale class required');

        // Disable other features first (mutually exclusive)
        this.disableAllCosmologyFeatures();

        // Determine performance tier
        const performanceTier = this.determinePerformanceTier();

        // Create cosmic scale instance
        this.cosmologyFeatures.cosmicScale = new CosmicScale(this.scene, this.camera, {
            performanceTier: performanceTier,
            visible: true,
            autoTransition: false
        });

        // Initialize
        const success = await this.cosmologyFeatures.cosmicScale.init();
        if (!success) {
            console.error('enableCosmicScale: Failed to initialize CosmicScale');
            this.showCosmologyError('Cosmic Scale', 'Failed to initialize. Please refresh the page.');
            if (this.cosmologyFeatures.cosmicScale) {
                this.cosmologyFeatures.cosmicScale.dispose();
                this.cosmologyFeatures.cosmicScale = null;
            }
            return false;
        }

        this.activeCosmologyFeature = 'cosmicScale';
        this.cosmologyFeatures.cosmicScale.setEnabled(true);
        this.cosmologyFeatures.cosmicScale.setCosmicScaleLevel(1);

        console.log('CosmicScale enabled successfully');
        return true;
    }

    /**
     * Disable all cosmology features
     * NASA Rule 2: Bounded feature set
     */
    disableAllCosmologyFeatures() {
        if (this.cosmologyFeatures.gravitationalWaves) {
            this.cosmologyFeatures.gravitationalWaves.dispose();
            this.cosmologyFeatures.gravitationalWaves = null;
        }

        if (this.cosmologyFeatures.darkMatterHalo) {
            this.cosmologyFeatures.darkMatterHalo.dispose();
            this.cosmologyFeatures.darkMatterHalo = null;
        }

        if (this.cosmologyFeatures.exoplanetSystems) {
            this.cosmologyFeatures.exoplanetSystems.dispose();
            this.cosmologyFeatures.exoplanetSystems = null;
        }

        if (this.cosmologyFeatures.stringTheory) {
            this.cosmologyFeatures.stringTheory.dispose();
            this.cosmologyFeatures.stringTheory = null;
        }

        if (this.cosmologyFeatures.cosmicScale) {
            this.cosmologyFeatures.cosmicScale.dispose();
            this.cosmologyFeatures.cosmicScale = null;
        }

        // Remove event listeners
        if (this.waveEventListener) {
            this.renderer.domElement.removeEventListener('click', this.waveEventListener);
            this.waveEventListener = null;
        }

        this.activeCosmologyFeature = null;
    }

    /**
     * Setup mouse click listener for triggering wave events
     * NASA Rule 4: <= 60 lines
     */
    setupWaveEventListener() {
        // Create bound listener
        this.waveEventListener = (event) => {
            if (!this.cosmologyFeatures.gravitationalWaves) return;

            // Calculate mouse position in normalized device coordinates
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            // Raycast to find intersection with mesh
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const mesh = this.cosmologyFeatures.gravitationalWaves.mesh;

            if (!mesh) return;

            const intersects = this.raycaster.intersectObject(mesh);

            if (intersects.length > 0) {
                const point = intersects[0].point;
                this.cosmologyFeatures.gravitationalWaves.triggerWaveEvent(point, 1.0);
                console.log(`Wave event triggered at intersection point`);
            }
        };

        // Add listener to renderer canvas
        this.renderer.domElement.addEventListener('click', this.waveEventListener);
    }

    /**
     * Determine performance tier based on device capabilities
     * NASA Rule 2: Bounded tier values
     * NASA Rule 4: <= 60 lines
     * @returns {string} Performance tier ('HIGH', 'MEDIUM', or 'LOW')
     */
    determinePerformanceTier() {
        // Check renderer exists (NASA Rule 5: assert before dereference)
        if (!this.renderer) {
            console.warn('SpaceEnvironment: renderer not initialized, returning MEDIUM tier');
            return 'MEDIUM';
        }

        // Check WebGL capabilities
        const gl = this.renderer.getContext();

        if (!gl) return 'LOW';

        const maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const maxVertexUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);

        // Check device pixel ratio
        const devicePixelRatio = window.devicePixelRatio || 1;

        // Determine tier based on capabilities
        if (maxTexSize >= 8192 && maxVertexUniforms >= 256 && devicePixelRatio <= 2) {
            return 'HIGH';
        } else if (maxTexSize >= 4096 && maxVertexUniforms >= 128) {
            return 'MEDIUM';
        } else {
            return 'LOW';
        }
    }

    dispose() {
        console.log("Disposing space environment");
        
        // Stop animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Tear down Explore mode if active so the Escape keydown listener on
        // document + the window click/move handlers don't leak onto a disposed
        // instance, and Earth is never left frozen.
        if (this.exploreMode) {
            this.exitExploreMode(true);
        } else {
            this.teardownExplorePanel();
        }
        // B2/B3: belt-and-suspenders — ensure the panel window listeners are gone even
        // if neither branch above ran a teardown.
        this._detachPanelWindowListeners();

        // Remove the reduced-motion change listener so it doesn't fire against a
        // disposed instance.
        if (this._reducedMotionMq && this._onReducedMotionChange) {
            if (this._reducedMotionMq.removeEventListener) {
                this._reducedMotionMq.removeEventListener('change', this._onReducedMotionChange);
            } else if (this._reducedMotionMq.removeListener) {
                this._reducedMotionMq.removeListener(this._onReducedMotionChange);
            }
        }

        // Clean up event listeners (FIX #4: using bound reference)
        window.removeEventListener('resize', this.boundHandleResize);

        // Clean up solar system resources
        if (this.solarSystem) {
            // Assuming SolarSystem has a dispose method
            if (typeof this.solarSystem.dispose === 'function') {
                this.solarSystem.dispose();
            }
        }
        
        // Clean up ThreeJS resources
        if (this.memoryManager) {
            this.memoryManager.cleanUp();
        }
        
        // Clean up the resource loader
        if (this.resourceLoader) {
            this.resourceLoader.purgeCache();
        }

        // Clean up cosmology features (Phase 5)
        this.disableAllCosmologyFeatures();

        // Clean up time control UI (Phase 3)
        if (this.timeControlUI && typeof this.timeControlUI.dispose === 'function') {
            this.timeControlUI.dispose();
            this.timeControlUI = null;
        }

        // Dispose FPS monitor (Roaster Fix #2)
        if (this.fpsMonitor && typeof this.fpsMonitor.dispose === 'function') {
            this.fpsMonitor.dispose();
            this.fpsMonitor = null;
        }

        // Remove renderer from container
        if (this.renderer && this.container) {
            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }

        this.initialized = false;
    }
}

// Make globally available
window.SpaceEnvironment = SpaceEnvironment;
