// SpaceEnvironment.js - Main controller for the space visualization
class SpaceEnvironment {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.container = null;
        this.solarSystem = null;
        this.clock = new THREE.Clock();
        this.initialized = false;
        this.animationId = null;
        this.resourceLoader = null;
        
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
    }
    
    async init() {
        try {
            console.log("SpaceEnvironment initialization started");
            
            // Create container first to show loading visuals ASAP
            this.createContainer();
            
            // Defer Three.js setup to next animation frame for smoother loading
            await new Promise(resolve => requestAnimationFrame(resolve));
            this.setupThreeJS();
            
            // Load essential resources first
            this.resourceLoader = new ResourceLoader();
            
            // Initialize solar system with progressive loading strategy
            this.solarSystem = new SolarSystem(this, {
                progressiveLoading: true,
                prioritizeCentralBodies: true
            });
            
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
            console.log(`Using existing container with ID: ${containerId}`);
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
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setClearColor(0x000000);
        
        // Add renderer to container
        this.container.appendChild(this.renderer.domElement);
        
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
        
        // Add memory manager
        this.memoryManager = new MemoryManager(this.scene, this.renderer);
        
        console.log("ThreeJS setup complete. Container now has renderer:", 
            this.container.contains(this.renderer.domElement));
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
                            this.orbitAngle = 0; // Reset orbit angle
                            
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
            viewDistance * 0.5,   // cos(30 degrees)
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
    
    hide() {
        if (!this.container) return;
        
        this.container.style.opacity = '0';
        this.container.style.pointerEvents = 'none';
        
        console.log("Space environment hidden (but still rendered)");
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