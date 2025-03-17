// SpaceEnvironment.js - Simplified star field background
class SpaceEnvironment {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.container = null;
        this.stars = null;
        this.clock = new THREE.Clock();
        this.initialized = false;
        this.animationId = null;
    }
    
    async init() {
        console.log("SpaceEnvironment initialization started");
        
        try {
            // Create container
            this.createContainer();
            
            // Setup Three.js basics
            this.setupThreeJS();
            
            // Create stars
            this.createStars();
            
            // Connect UI controls
            this.connectUIControls();
            
            // Start animation loop
            this.animate();
            
            console.log("SpaceEnvironment initialized successfully");
            this.initialized = true;
            
            // Make it visible right away
            this.show();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize Space Environment:', error);
            console.error(error.stack);
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
        
        // Add resize handler
        window.addEventListener('resize', this.handleResize.bind(this));
        
        console.log("ThreeJS setup complete. Container now has renderer:", 
            this.container.contains(this.renderer.domElement));
    }
    
    createStars() {
        // Create basic star field
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xFFFFFF,
            size: 2,
            sizeAttenuation: false
        });
        
        const starsVertices = [];
        for (let i = 0; i < 5000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            starsVertices.push(x, y, z);
        }
        
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        this.stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(this.stars);
        
        console.log("Stars created:", this.stars instanceof THREE.Points);
    }
    
    connectUIControls() {
        // Connect planet buttons
        const planetButtons = document.querySelectorAll('.planet-btn');
        if (planetButtons.length) {
            planetButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const planetName = button.getAttribute('data-planet');
                    this.updatePlanetInfo(planetName);
                });
            });
            console.log(`Connected ${planetButtons.length} planet buttons`);
        } else {
            console.log("No planet buttons found");
        }
    }
    
    updatePlanetInfo(planetName) {
        // Planet data (simplified)
        const planetData = {
            Sun: {
                description: "The star at the center of our Solar System.",
                diameter: "1,392,700 km",
                distance: "0 km",
                orbitalPeriod: "N/A"
            },
            Mercury: {
                description: "The smallest and innermost planet in the Solar System.",
                diameter: "4,880 km",
                distance: "57.9 million km",
                orbitalPeriod: "88 days"
            },
            Venus: {
                description: "The second planet from the Sun with a thick toxic atmosphere.",
                diameter: "12,104 km",
                distance: "108.2 million km",
                orbitalPeriod: "225 days"
            },
            Earth: {
                description: "Our home planet, the only known celestial body to harbor life.",
                diameter: "12,742 km",
                distance: "149.6 million km",
                orbitalPeriod: "365.25 days"
            },
            Mars: {
                description: "The Red Planet, known for its iron oxide surface.",
                diameter: "6,779 km",
                distance: "227.9 million km",
                orbitalPeriod: "687 days"
            },
            Jupiter: {
                description: "The largest planet in our Solar System, a gas giant.",
                diameter: "139,820 km",
                distance: "778.5 million km",
                orbitalPeriod: "11.86 years"
            },
            Saturn: {
                description: "Known for its prominent ring system.",
                diameter: "116,460 km",
                distance: "1.4 billion km",
                orbitalPeriod: "29.46 years"
            },
            Uranus: {
                description: "An ice giant with a tilted rotation axis of 97.8 degrees.",
                diameter: "50,724 km",
                distance: "2.9 billion km",
                orbitalPeriod: "84.01 years"
            },
            Neptune: {
                description: "The windiest planet in our Solar System.",
                diameter: "49,244 km",
                distance: "4.5 billion km",
                orbitalPeriod: "164.8 years"
            }
        };
        
        const planet = planetData[planetName];
        if (!planet) return;
        
        // Update UI
        const nameEl = document.getElementById('planet-name');
        const descEl = document.getElementById('planet-description');
        const diameterEl = document.getElementById('planet-diameter');
        const distanceEl = document.getElementById('planet-distance');
        const orbitalEl = document.getElementById('planet-orbital-period');
        
        if (nameEl) nameEl.textContent = planetName;
        if (descEl) descEl.textContent = planet.description;
        if (diameterEl) diameterEl.textContent = planet.diameter;
        if (distanceEl) distanceEl.textContent = planet.distance;
        if (orbitalEl) orbitalEl.textContent = planet.orbitalPeriod;
    }
    
    handleResize() {
        if (!this.camera || !this.renderer) return;
        
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(this.width, this.height);
    }
    
    animate() {
        this.animationId = requestAnimationFrame(this.animate.bind(this));
        
        // Rotate stars
        if (this.stars) {
            this.stars.rotation.y += 0.000025;
        }
        
        // Render scene
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    show() {
        if (!this.container) return;
        
        console.log("Showing space environment");
        this.container.style.display = 'block';
        this.container.style.opacity = '1';
        
        // Force re-render
        this.handleResize();
        
        // Debug visibility
        setTimeout(() => {
            const computed = window.getComputedStyle(this.container);
            console.log("Container computed style:", {
                display: computed.display,
                opacity: computed.opacity,
                zIndex: computed.zIndex,
                visibility: computed.visibility
            });
            
            // Check if renderer is active
            if (this.renderer) {
                console.log("Renderer info:", this.renderer.info.render);
            }
        }, 100);
    }
    
    hide() {
        
        
        console.log("Hiding space environment");
       
    }
    
    dispose() {
        console.log("Disposing space environment");
        
        // Stop animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Remove resize listener
        window.removeEventListener('resize', this.handleResize.bind(this));
        
        // Dispose resources
        if (this.stars) {
            this.scene.remove(this.stars);
            this.stars.geometry.dispose();
            this.stars.material.dispose();
        }
        
        // Remove renderer
        if (this.renderer && this.container) {
            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }
        
        this.initialized = false;
    }
}

// Make globally available
window.SpaceEnvironment = SpaceEnvironment;