// SpaceEnvironment.js - Main controller class for the 3D background
class SpaceEnvironment {
    constructor() {
        this.scene = null;
        this.cameraController = null;
        this.solarSystem = null;
        this.initialized = false;
        this.clock = null;
    }
    
    async init() {
        console.log("SpaceEnvironment initialization started");
        
        // Create THREE.Clock for animation timing
        this.clock = new THREE.Clock();
        
        try {
            // Create a container for the 3D scene
            this.createContainer();
            
            // Basic Three.js setup
            await this.setupThreeJS();
            
            // Initialize with basic stars
            this.createStars();
            
            // Start animation loop
            this.animate();
            
            console.log("SpaceEnvironment initialized successfully");
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize Space Environment:', error);
            return false;
        }
    }
    
    createContainer() {
        // Create a container for the 3D scene if it doesn't exist
        const containerId = 'solar-system-container';
        if (!document.getElementById(containerId)) {
            const container = document.createElement('div');
            container.id = containerId;
            container.className = 'solar-system-background';
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.zIndex = '-1';
            container.style.overflow = 'hidden';
            document.body.insertBefore(container, document.body.firstChild);
        }
        
        this.container = document.getElementById(containerId);
    }
    
    async setupThreeJS() {
        // Create basic Three.js components
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        // Scene
        this.scene = new THREE.Scene();
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 10000);
        this.camera.position.set(0, 30, 100);
        this.camera.lookAt(0, 0, 0);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0); // Transparent background
        this.container.appendChild(this.renderer.domElement);
        
        // Controls - only add if OrbitControls is available
        if (typeof THREE.OrbitControls === 'function') {
            console.log("Creating OrbitControls");
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.enableZoom = true;
        } else {
            console.warn("OrbitControls not available");
        }
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    createStars() {
        // Create a simple starfield as a placeholder
        const count = 5000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        
        for (let i = 0; i < count; i++) {
            // Random position in a sphere
            const radius = 500 + Math.random() * 1500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            
            // White to blue-ish colors
            colors[i * 3] = 0.8 + Math.random() * 0.2;       // R
            colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;   // G
            colors[i * 3 + 2] = 0.8 + Math.random() * 0.2;   // B
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 1,
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });
        
        this.stars = new THREE.Points(geometry, material);
        this.scene.add(this.stars);
    }
    
    handleResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(this.width, this.height);
    }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        // Slow rotation of stars
        if (this.stars) {
            this.stars.rotation.y += 0.0001;
        }
        
        // Update controls if they exist
        if (this.controls) {
            this.controls.update();
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
    
    dispose() {
        // Clean up resources
        window.removeEventListener('resize', this.handleResize.bind(this));
        if (this.container && this.renderer.domElement) {
            this.container.removeChild(this.renderer.domElement);
        }
    }
}

// Make sure to expose the class to the window object
window.SpaceEnvironment = SpaceEnvironment;