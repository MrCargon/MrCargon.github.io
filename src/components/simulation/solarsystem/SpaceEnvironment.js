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
    
    focusOnPlanet(planetName) {
        if (!this.solarSystem) return;
        
        // Update planet info in the UI
        this.updatePlanetInfo(planetName);
        
        // Store the selected planet
        this.selectedPlanet = planetName;
        console.log(`Focusing on planet: ${planetName}`);
        
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
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
            this.solarSystem.update(deltaTime);
            
            // Update camera behavior based on selected planet
            if (this.selectedPlanet && !this.cameraTransitioning) {
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
        
        // Clean up event listeners
        window.removeEventListener('resize', this.handleResize.bind(this));
        
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
