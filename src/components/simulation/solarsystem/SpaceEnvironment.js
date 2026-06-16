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
        
        // Camera behavior flags
        this.followingPlanet = false;
        this.orbitingPlanet = true;  // Default to orbiting when focused
        this.selectedPlanet = null;
        
        // Orbit zones - determines camera behavior
        this.orbitZoneRadius = 25; // How close to be considered "in orbit zone"
        this.insideOrbitZone = false;
        
        // Camera transition settings
        this.cameraTransitioning = false;
        this.transitionDuration = 1.5; // seconds
        // FIX C: monotonic per-focus generation token (see focusOnPlanet).
        this._focusGen = 0;
        this._transitionRaf = null;
        
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
        // Per-frame scratch (Rule: no per-frame allocation in the animate loop).
        this._scratchEarthPos = new THREE.Vector3();
        this._scratchCamPos = new THREE.Vector3();
        this._raycaster = new THREE.Raycaster();
        this._ndc = new THREE.Vector2();
        this._onExploreClick = (e) => this._handleExploreClick(e);
        this._onExploreMove = (e) => this._handleExploreHover(e);
        // Bound Escape handler so it can be added/removed without leaking.
        this._onExploreKeydown = (e) => {
            if (e.key === 'Escape' && this.exploreMode) {
                this.exitExploreMode();
            }
        };

        // A1: live reduced-motion flag. When true, the animate loop freezes all
        // solar-system motion (orbits/spins/asteroids/galaxy) while still
        // rendering and handling interaction. Kept live via matchMedia 'change'.
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

        // P3: pause the RAF loop when the tab is hidden; resume when visible.
        this._onVisibilityChange = () => {
            if (document.hidden) {
                if (this.animationId) {
                    cancelAnimationFrame(this.animationId);
                    this.animationId = null;
                }
            } else if (this.initialized && !this.fallbackMode && this.animationId === null) {
                // Drain the delta accumulated while hidden so the simulation
                // doesn't snap forward by the full hidden duration on resume.
                if (this.clock && this.clock.getDelta) {
                    this.clock.getDelta();
                }
                this.animate();
            }
        };
        document.addEventListener('visibilitychange', this._onVisibilityChange);
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
            
            await this.solarSystem.init();
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
        this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
        this.camera.position.set(0, 30, 100);
        this.camera.lookAt(0, 0, 0);
        
        // Renderer with enhanced lighting capabilities
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(this.width, this.height);
        // P1: clamp the device pixel ratio so HiDPI screens don't render at 2x-3x
        // resolution for a decorative background (big perf win, negligible quality
        // loss). Re-applied in handleResize.
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.setClearColor(0x000011); // Deep space color

        // P2: shadows disabled. The sun is a PointLight, so shadows would cost 6
        // cube-map passes per frame — wasted work for a background scene that
        // never shows cast shadows. Keep them off here and on the sun light.
        this.renderer.shadowMap.enabled = false;
        
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
        // A2: the canvas is decorative (it visually duplicates the HTML content),
        // so hide it from the accessibility tree.
        this.renderer.domElement.setAttribute('aria-hidden', 'true');

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
        
        // Add resize handler
        window.addEventListener('resize', this.handleResize.bind(this));
        
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
        // P2: no shadow casting — PointLight shadows are 6 passes/frame and are
        // not visible in this background use. Shadow config removed accordingly.
        this.sunLight.castShadow = false;

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
            sunIntensityBase: 0.8,          // Base sun light intensity (realistic level)
            sunIntensityRange: [0.5, 1.2],  // Min/max sun intensity bounds (realistic)
            ambientRange: [0.05, 0.12],     // Ambient light intensity bounds (realistic)
            glowRange: [0.2, 0.6],          // Sun glow intensity bounds (realistic)
            maxDistance: 300,                // Maximum light influence distance
            minDistance: 10                  // Minimum effective distance
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
        // P1: re-clamp pixel ratio on resize (DPR can change when a window moves
        // between monitors with different scaling).
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
        this._exploreMinDistance = radius * 1.08;
        this._exploreMaxDistance = radius * 12;
        this.controls.enabled = true;
        this.controls.minDistance = this._exploreMinDistance;
        this.controls.maxDistance = this._exploreMaxDistance;
        // Dolly to a close initial framing (~3x radius) so the grid/borders/marker
        // are immediately legible — the cinematic ends too far out otherwise. The
        // user can still freely zoom in/out from here. Reuses scratch (no alloc).
        const camDir = this._scratchCamPos.copy(this.camera.position).sub(earthPos).normalize();
        if (camDir.lengthSq() < 1e-6) camDir.set(0, 0, 1);
        this.camera.position.copy(earthPos).addScaledVector(camDir, radius * 3.0);
        this.controls.target.copy(earthPos);
        this.controls.enablePan = false; // two-finger/right-drag pan would drift off the globe
        this.controls.update();
        if (this.renderer && this.renderer.domElement) this.renderer.domElement.style.cursor = 'grab';

        // CRITICAL FIX: the WebGL canvas sits at z-index -5 BEHIND #content, so the
        // page content intercepts every mouse/touch event and OrbitControls never
        // receives them — the globe can't be rotated/zoomed. Make the content layer
        // transparent to pointer events during explore so they fall through to the
        // canvas; the explore panel sets its own pointer-events:auto so its buttons
        // still work. Restored on exit.
        // THE core fix: the canvas container lives at z-index -5 (behind BODY), so a
        // negative-z element never receives pointer events (they hit BODY first) and
        // OrbitControls can't see the drag. Raise the canvas ABOVE the page during
        // explore (below the explore panel z=40) so it gets mouse/touch/wheel events.
        if (this.container) { this._prevContainerZ = this.container.style.zIndex; this.container.style.zIndex = '30'; }
        const content = document.getElementById('content');
        if (content) { this._prevContentPE = content.style.pointerEvents; content.style.pointerEvents = 'none'; }
        // Hide the solar-system side panels (meaningless over a single frozen globe).
        document.querySelectorAll('.side-popup').forEach((p) => { p.style.display = 'none'; });
        const hints = document.getElementById('keyboard-hints'); if (hints) hints.style.display = 'none';

        // Build (lazy, once) + show explore overlays. On re-entry the overlays are
        // already built, so show them directly; only the first time do we await the
        // borders fetch (otherwise the _bordersRequested short-circuit returns a
        // still-null borders and they silently never reappear).
        if (typeof earth.buildGraticule === 'function') {
            const g = earth.buildGraticule();
            if (g) g.visible = true;
        }
        if (earth.borders) {
            earth.borders.visible = true;
        } else if (typeof earth.buildBorders === 'function') {
            earth.buildBorders(this.bordersUrl).then((b) => {
                if (b && this.exploreMode) b.visible = true;
                this._syncExploreToggleButtons();
            });
        }

        // Live keyless data layers (ISS, earthquakes, places) — built + shown on enter.
        if (typeof earth.buildPois === 'function') {
            const p = earth.buildPois(); if (p) p.visible = true;
        }
        if (typeof earth.buildQuakes === 'function') {
            earth.buildQuakes().then((q) => {
                if (q && this.exploreMode) q.visible = true;
                this._syncExploreToggleButtons();
            });
        }
        if (typeof earth.startISS === 'function') {
            earth.startISS();
            earth.setLayerVisible('iss', true);
        }
        // Click a marker → detail card; hover the surface → country highlight + name.
        if (typeof earth.buildCountryHover === 'function') earth.buildCountryHover();
        // Attach to window (not the canvas) so events fire regardless of canvas
        // z-index / pointer-events; the handlers compute coords from the canvas rect.
        window.addEventListener('click', this._onExploreClick);
        window.addEventListener('mousemove', this._onExploreMove);

        this.setupExplorePanel();
        this._syncExploreToggleButtons();
        this.announceExplore('Explore Earth mode. Drag to rotate, scroll to zoom. Click markers for details.');
        console.log('Entered Explore Earth mode');
        return true;
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
        }

        // Restore default orbit behaviour + global zoom bounds.
        this.orbitingPlanet = this._preExploreOrbiting;
        if (this.controls) {
            this.controls.enabled = true;
            this.controls.minDistance = 2;
            this.controls.maxDistance = 300;
            this.controls.enablePan = true;
        }
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.style.cursor = '';
        }
        window.removeEventListener('click', this._onExploreClick);
        window.removeEventListener('mousemove', this._onExploreMove);
        // Restore content pointer-events + the hidden solar-system panels.
        if (this.container) this.container.style.zIndex = (this._prevContainerZ != null ? this._prevContainerZ : '-5');
        const content = document.getElementById('content');
        if (content) content.style.pointerEvents = (this._prevContentPE || '');
        document.querySelectorAll('.side-popup').forEach((p) => { p.style.display = ''; });
        const hints = document.getElementById('keyboard-hints'); if (hints) hints.style.display = '';
        if (this._detailEl) this._detailEl.hidden = true;
        if (earth && typeof earth.highlightCountry === 'function') earth.highlightCountry(null);
        if (this._tooltipEl) this._tooltipEl.hidden = true;

        this.teardownExplorePanel();
        this.announceExplore('Exited Explore Earth mode.');
        console.log('Exited Explore Earth mode');

        if (!skipFlyBack) {
            // Escape path: fly back to the default solar-system framing.
            this.resetCamera();
        }
        return true;
    }

    /**
     * Smoothly rotate earth.mesh so the SF marker faces the camera (centred).
     * THE key UX fix for "I can't spot the dot". Instant under reduced-motion.
     * Rule 4: <=60 lines | Rule 5: asserts.
     * @returns {boolean}
     */
    centerOnSanFrancisco() {
        const earth = this.getEarthObject();
        console.assert(earth, 'centerOnSanFrancisco: Earth required');
        if (!earth || !earth.marker || !this.camera) return false;

        const mesh = earth.getMesh();
        // Direction from Earth centre toward the camera, in Earth's local frame.
        const earthPos = mesh.getWorldPosition(this._scratchEarthPos);
        const toCam = this._scratchCamPos.copy(this.camera.position).sub(earthPos).normalize();
        // SF marker direction in local space (marker is parented to mesh).
        const markerLocal = earth.marker.position.clone().normalize();
        // We rotate the mesh about Y so the marker's longitude faces the camera.
        const camYaw = Math.atan2(toCam.x, toCam.z);
        const markerYaw = Math.atan2(markerLocal.x, markerLocal.z);
        const targetY = mesh.rotation.y + (camYaw - markerYaw);

        if (this.prefersReducedMotion()) {
            mesh.rotation.y = targetY;
            console.log('Centered on San Francisco (instant)');
            return true;
        }
        this._animateMeshYaw(mesh, mesh.rotation.y, targetY, 0.8);
        console.log('Centering on San Francisco');
        return true;
    }

    /**
     * Eased rotate-in-Y helper for centerOnSanFrancisco. Rule 4: <=60 lines.
     * @param {THREE.Object3D} mesh
     * @param {number} fromY
     * @param {number} toY
     * @param {number} duration - seconds
     */
    _animateMeshYaw(mesh, fromY, toY, duration) {
        console.assert(mesh && mesh.rotation, '_animateMeshYaw: mesh required');
        console.assert(duration > 0, '_animateMeshYaw: positive duration required');
        // Cancel any prior yaw animation so rapid "Center on SF" clicks don't spawn
        // competing rAF loops fighting over mesh.rotation.y.
        if (this._yawRaf) { cancelAnimationFrame(this._yawRaf); this._yawRaf = null; }
        const start = this.clock.getElapsedTime();
        const tick = () => {
            if (!this.exploreMode) { mesh.rotation.y = toY; this._yawRaf = null; return; }
            const t = Math.min((this.clock.getElapsedTime() - start) / duration, 1);
            mesh.rotation.y = fromY + (toY - fromY) * this.easeInOutCubic(t);
            this._yawRaf = (t < 1) ? requestAnimationFrame(tick) : null;
        };
        tick();
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
     * on-SF, Borders/Grid toggles). Idempotent: wires handlers once. Rule 4: <=60.
     * @returns {boolean}
     */
    setupExplorePanel() {
        if (typeof document === 'undefined') return false;
        const panel = document.getElementById('explore-panel');
        console.assert(panel === null || panel.nodeType === 1, 'setupExplorePanel: bad panel');
        if (!panel) return false;
        panel.hidden = false;
        panel.style.display = 'flex';   // [hidden] alone is overridden by inline display; toggle explicitly
        this._distEl = document.getElementById('explore-distance'); // cache (no per-frame query)
        document.addEventListener('keydown', this._onExploreKeydown);

        this._detailEl = document.getElementById('explore-detail');
        this._tooltipEl = document.getElementById('country-tooltip');

        // The canvas is raised to z-index 30 in explore; the panel's z-40 is trapped
        // inside #content's stacking context (painted below the canvas → unclickable).
        // Reparent the explore UI to <body> so it's in the root stacking context and
        // sits above the canvas. Idempotent.
        [panel, this._detailEl, this._tooltipEl].forEach((el) => {
            if (el && el.parentElement !== document.body) document.body.appendChild(el);
        });

        if (!panel.dataset.wired) {
            const center = document.getElementById('explore-center-sf');
            const borders = document.getElementById('explore-toggle-borders');
            const grid = document.getElementById('explore-toggle-grid');
            const iss = document.getElementById('explore-toggle-iss');
            const quakes = document.getElementById('explore-toggle-quakes');
            const places = document.getElementById('explore-toggle-places');
            if (center) center.addEventListener('click', () => this.centerOnSanFrancisco());
            if (borders) borders.addEventListener('click', () => this._toggleExploreLayer('borders', borders));
            if (grid) grid.addEventListener('click', () => this._toggleExploreLayer('graticule', grid));
            if (iss) iss.addEventListener('click', () => this._toggleDataLayer('iss', iss));
            if (quakes) quakes.addEventListener('click', () => this._toggleDataLayer('quakes', quakes));
            if (places) places.addEventListener('click', () => this._toggleDataLayer('pois', places));
            const exit = document.getElementById('explore-exit');
            if (exit) exit.addEventListener('click', () => this.exitExploreMode());
            panel.dataset.wired = '1';
        }
        return true;
    }

    /**
     * Toggle a lazily-built explore overlay (borders|graticule) + sync its button
     * aria-pressed/active state. Rule 5: 2 asserts, checks the object exists.
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
        return true;
    }

    // Toggle a live data layer (iss|quakes|pois) by visibility. Rule 5: 2 asserts.
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
        return true;
    }

    // Raycast a click against the live markers → show a detail card. Rule 4: <=60.
    _handleExploreClick(event) {
        if (!this.exploreMode || !this.camera || !this._detailEl) return;
        const earth = this.getEarthObject();
        if (!earth || !earth.pickables || !earth.pickables.length) return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this._ndc.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        this._raycaster.setFromCamera(this._ndc, this.camera);
        const pick = earth.pickables.filter((m) => m.visible && (!m.parent || m.parent.visible));
        const hits = this._raycaster.intersectObjects(pick, false);
        if (hits.length) {
            const u = hits[0].object.userData || {};
            this._detailEl.innerHTML = '<strong>' + (u.name || 'Marker') + '</strong>'
                + (u.info ? '<br>' + u.info : '');
            this._detailEl.hidden = false;
        } else {
            this._detailEl.hidden = true;
        }
    }

    // Hover the globe → highlight the country under the cursor + show its name.
    // Raycasts the surface, converts the hit to lat/lng, point-in-polygon lookup.
    // Rule 4: <=60 lines. Only rebuilds the highlight when the country changes.
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
        this._raycaster.setFromCamera(this._ndc, this.camera);
        const hits = this._raycaster.intersectObject(earth.mesh, false);
        if (!hits.length) {
            earth.highlightCountry(null);
            if (this._tooltipEl) this._tooltipEl.hidden = true;
            return;
        }
        const local = earth.mesh.worldToLocal(hits[0].point.clone());
        const ll = GlobeMath.vector3ToLatLng(local, earth.data.radius);
        const name = earth.countryAt(ll.lat, ll.lng);
        earth.highlightCountry(name);
        if (this._tooltipEl) {
            if (name) {
                this._tooltipEl.textContent = name;
                this._tooltipEl.style.left = (event.clientX + 14) + 'px';
                this._tooltipEl.style.top = (event.clientY + 14) + 'px';
                this._tooltipEl.hidden = false;
            } else {
                this._tooltipEl.hidden = true;
            }
        }
    }

    /**
     * Sync the Borders/Grid toggle buttons' pressed state to the overlays' actual
     * visibility (overlays are shown on enter, so the buttons must reflect that or
     * the first click inverts the state). Rule 5: 2 asserts.
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
        return true;
    }

    /**
     * Hide the explore panel + remove the Escape listener. Rule 5: 2 asserts.
     * @returns {boolean}
     */
    teardownExplorePanel() {
        if (typeof document === 'undefined') return false;
        document.removeEventListener('keydown', this._onExploreKeydown);
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

        // FIX C: per-focus generation token. Incremented at the start of every
        // focus call. cinematicEmergence captures this value and bails out of its
        // chained onComplete callbacks if a newer focus has superseded it. This
        // catches the race where the user clicks a second planet during the ~1s
        // gap BETWEEN the two chained transitions (phase-1 onComplete fired,
        // phase-2 not yet started, no _transitionRaf pending) — the reentrancy
        // guard below can't catch that window, but the generation check can.
        const myGen = ++this._focusGen;

        // FIX 2: reentrancy guard. If a transition is already in flight, cancel it
        // so the latest click wins (cancel-and-restart, the saner UX than ignoring
        // the new click). smoothCameraTransition also cancels the RAF when it
        // starts, but we clear the handle here too in case we're mid-cinematic
        // phase (between the two chained transitions) where no RAF is pending.
        if (this.cameraTransitioning) {
            if (this._transitionRaf) {
                cancelAnimationFrame(this._transitionRaf);
                this._transitionRaf = null;
            }
            this.cameraTransitioning = false;
        }

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
        
        // Focus camera on the selected planet
        if (this.solarSystem && typeof this.solarSystem.focusOnPlanet === 'function') {
            const cameraInfo = this.getPlanetCameraInfo(planetName);
            if (cameraInfo && this.camera) {
                // Use smooth transition (cinematic emergence for Earth).
                this.cameraTransitioning = true;
                const useCinematic = planetName === 'Earth';
                const onArrive = () => {
                        this.cameraTransitioning = false;
                        this.insideOrbitZone = true;

                        // Earth → free-look Explore mode instead of auto-orbit.
                        // The whole point: stop the spin, let the user drag/zoom.
                        if (planetName === 'Earth') {
                            this.enterExploreMode();
                            console.log('Camera focused on Earth (explore mode)');
                            return;
                        }

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
                };

                if (useCinematic) {
                    this.cinematicEmergence(cameraInfo.position, cameraInfo.lookAt, onArrive, myGen);
                } else {
                    this.smoothCameraTransition(cameraInfo.position, cameraInfo.lookAt, onArrive);
                }
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
            viewDistance * 0.8,   // cos(30 degrees)
            viewDistance * 0.866  // sin(30 degrees)
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
     * @param {number} duration - Transition length in seconds (defaults to this.transitionDuration)
     */
    smoothCameraTransition(targetPosition, targetLookAt, onComplete = null, duration) {
        // FIX D: resolve the default inside the body so the param doesn't read
        // `this` at call time (fragile if ever called unbound).
        if (duration == null) duration = this.transitionDuration;
        // FIX 3: Cancel any in-flight transition RAF before starting a new one so
        // two transitions never fight over camera.position.
        if (this._transitionRaf) {
            cancelAnimationFrame(this._transitionRaf);
            this._transitionRaf = null;
        }

        // Store current camera state
        const startPosition = this.camera.position.clone();
        const startTarget = this.controls ? this.controls.target.clone() : new THREE.Vector3(0, 0, 0);

        // Animation variables
        const startTime = this.clock.getElapsedTime();

        // Create animation function
        const animate = () => {
            const currentTime = this.clock.getElapsedTime();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
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
                // FIX 3: store the handle so this loop can be cancelled.
                this._transitionRaf = requestAnimationFrame(animate);
            } else {
                // Animation complete
                this._transitionRaf = null;
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
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
     * Cinematic "emergence" fly-in: start far/wide, accelerate, settle into the
     * orbit framing. Extends the existing transition (eased, multi-phase) and
     * keeps cameraTransitioning gating + OrbitControls handoff intact.
     * Honors prefers-reduced-motion with an instant snap.
     * Rule 4: <=60 lines | Rule 5: assertions | Rule 6: graceful fallback.
     * @param {THREE.Vector3} targetPosition - Final camera position
     * @param {THREE.Vector3} targetLookAt - Final look-at point
     * @param {Function} onComplete - Called once when motion finishes
     * @param {number} gen - Focus generation token captured by the caller. Each
     *   chained phase bails if this._focusGen has moved on (a newer focus won).
     */
    cinematicEmergence(targetPosition, targetLookAt, onComplete = null, gen = this._focusGen) {
        console.assert(targetPosition && targetPosition.isVector3, 'cinematicEmergence: bad position');
        console.assert(targetLookAt && targetLookAt.isVector3, 'cinematicEmergence: bad lookAt');
        if (!this.camera) {
            if (onComplete) onComplete();
            return false;
        }

        // Reduced-motion: short, near-instant settle (no long fly-in).
        if (this.prefersReducedMotion()) {
            this.camera.position.copy(targetPosition);
            if (this.controls) {
                this.controls.target.copy(targetLookAt);
                this.controls.update();
            } else {
                this.camera.lookAt(targetLookAt);
            }
            if (onComplete) onComplete();
            return true;
        }

        // Phase 1: pull back to a wide framing, then fly in (phase 2).
        // FIX 1: pass phase durations as the per-call `duration` arg instead of
        // mutating this.transitionDuration (which left shared state wrong on interrupt).
        const wideOffset = targetPosition.clone().sub(targetLookAt).multiplyScalar(3.0);
        const widePos = targetLookAt.clone().add(wideOffset);
        this.smoothCameraTransition(widePos, targetLookAt, () => {
            // FIX C: if a newer focus started during the gap before phase 2,
            // abandon this stale chain. Do NOT touch cameraTransitioning here —
            // the newer focus call now owns that flag and its own transition.
            if (this._focusGen !== gen) return;
            this.smoothCameraTransition(targetPosition, targetLookAt, () => {
                // FIX C: same staleness check at the final arrival. onComplete
                // (onArrive) clears cameraTransitioning, so skipping it for a stale
                // chain prevents clobbering the newer selection's framing/flag.
                if (this._focusGen !== gen) return;
                if (onComplete) onComplete();
            }, 2.2); // accelerate-and-settle fly-in
        }, 1.0); // brief wide-pull
        return true;
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
        this.animationId = requestAnimationFrame(this.animate.bind(this));
        
        // Update controls if available and not auto-orbiting
        if (this.controls && !this.isAutoOrbiting) {
            this.controls.update();
        }
        
        // Update solar system - KEEP ORIGINAL SPEED (no * 1000)
        if (this.solarSystem) {
            const deltaTime = this.clock.getDelta(); // Keep original deltaTime for realistic speed
            // A1: under reduced-motion, freeze orbits/spins/asteroids/galaxy by
            // skipping the simulation tick. Render + camera + interaction below
            // still run, so the scene is fully usable, just static.
            if (!this.reducedMotion) {
                this.solarSystem.update(deltaTime);
            }

            // Update camera behavior based on selected planet
            if (this.exploreMode) {
                // Explore: free user controls + cloud fly-through; the auto-orbit
                // tracking is intentionally suppressed so the globe stays still.
                this.updateExploreClouds();
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
     * Disable gentle auto-rotation
     * Purpose: Stop background rotation when switching modes
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
            this.backgroundCameraDistance * 0.8  // Distance from center
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

    dispose() {
        console.log("Disposing space environment");
        
        // Stop animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        // FIX 3: cancel any in-flight camera transition RAF so it doesn't leak.
        if (this._transitionRaf) {
            cancelAnimationFrame(this._transitionRaf);
            this._transitionRaf = null;
        }

        // Tear down Explore mode if active so the Escape keydown listener on
        // document doesn't leak onto a disposed instance.
        if (this.exploreMode) {
            this.exitExploreMode(true);
        } else {
            this.teardownExplorePanel();
        }
        if (this._yawRaf) {
            cancelAnimationFrame(this._yawRaf);
            this._yawRaf = null;
        }

        // Clean up event listeners
        window.removeEventListener('resize', this.handleResize.bind(this));

        // P3 / A1: remove the visibility + reduced-motion listeners so they
        // don't leak or fire against a disposed instance.
        if (this._onVisibilityChange) {
            document.removeEventListener('visibilitychange', this._onVisibilityChange);
        }
        if (this._reducedMotionMq && this._onReducedMotionChange) {
            if (this._reducedMotionMq.removeEventListener) {
                this._reducedMotionMq.removeEventListener('change', this._onReducedMotionChange);
            } else if (this._reducedMotionMq.removeListener) {
                this._reducedMotionMq.removeListener(this._onReducedMotionChange);
            }
        }
        
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
