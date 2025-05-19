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
                pointer-events: none !important;
                opacity: 1 !important;
                background-color: #000011 !important;
                display: block !important;
            `;
            
            // Insert at the beginning of body
            document.body.insertBefore(container, document.body.firstChild);
            console.log("Creating new solar system container");
        } else {
            console.log(`Using existing container with ID: ${containerId}`);
            // Reset styles to ensure visibility
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
                background-color: #000011 !important;
                display: block !important;
            `;
        }
        
        // Log the container's style for debugging
        console.log("Container style:", {
            display: container.style.display,
            opacity: container.style.opacity,
            zIndex: container.style.zIndex,
            position: container.style.position
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
        this.camera.position.set(0, 0, 100);
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
        // Connect planet buttons
        const planetButtons = document.querySelectorAll('.planet-btn');
        if (planetButtons.length) {
            planetButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const planetName = button.getAttribute('data-planet');
                    this.focusOnPlanet(planetName);
                });
            });
            console.log(`Connected ${planetButtons.length} planet buttons`);
        } else {
            console.log("No planet buttons found");
        }
        
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
                }
            });
        }
        
        const toggleOrbitBtn = document.getElementById('toggle-orbit');
        if (toggleOrbitBtn) {
            toggleOrbitBtn.addEventListener('click', () => {
                if (this.solarSystem) {
                    const isVisible = this.solarSystem.toggleOrbits();
                    toggleOrbitBtn.classList.toggle('active', isVisible);
                }
            });
        }
    }
    
    resetCamera() {
        // Reset camera to default position
        if (this.camera) {
            this.camera.position.set(0, 30, 100);
            this.camera.lookAt(0, 0, 0);
        }
        
        // Reset controls if available
        if (this.controls) {
            this.controls.reset();
        }
    }
    
    focusOnPlanet(planetName) {
        if (!this.solarSystem) return;
        
        // Update planet info in the UI
        this.updatePlanetInfo(planetName);
        
        // Focus camera on the selected planet
        if (this.solarSystem && typeof this.solarSystem.focusOnPlanet === 'function') {
            const cameraInfo = this.solarSystem.focusOnPlanet(planetName);
            if (cameraInfo && this.camera) {
                this.camera.position.copy(cameraInfo.position);
                this.camera.lookAt(cameraInfo.lookAt);
                
                if (this.controls) {
                    this.controls.target.copy(cameraInfo.lookAt);
                    this.controls.update();
                }
            }
        }
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
        
        // Update controls if available
        if (this.controls) {
            this.controls.update();
        }
        
        // Update solar system
        if (this.solarSystem) {
            const deltaTime = this.clock.getDelta() * 1; // Convert to milliseconds
            this.solarSystem.update(deltaTime);
        }
        
        // Render scene
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    show(interactive = true) {
        if (!this.container) return;
        
        // Always make container visible
        this.container.style.display = 'block';
        this.container.style.opacity = '1';
        this.container.style.zIndex = '-5'; // Keep behind content
        
        // Set pointer events based on interactivity
        this.container.style.pointerEvents = interactive ? 'auto' : 'none';
        
        // If controls exist and interactive is false, disable them
        if (this.controls) {
            this.controls.enabled = interactive;
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