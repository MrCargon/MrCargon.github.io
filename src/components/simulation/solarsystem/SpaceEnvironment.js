// SpaceEnvironment.js - Optimized background star field
class SpaceEnvironment {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.container = null;
        this.stars = null;
        this.width = 0;
        this.height = 0;
        this.clock = new THREE.Clock();
        this.initialized = false;
    }
    
    async init() {
        console.log("SpaceEnvironment initialization started");
        
        try {
            // Create a container for the 3D scene
            this.createContainer();
            
            // Basic Three.js setup
            this.setupThreeJS();
            
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
            
            // Set inline styles with !important to override any conflicting styles
            container.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                z-index: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
            `;
            
            // Insert at the beginning of body
            document.body.insertBefore(container, document.body.firstChild);
            console.log("Space environment container created with ID:", containerId);
        }
        
        this.container = document.getElementById(containerId);
    }
    
    setupThreeJS() {
        // Create basic Three.js components
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        // Scene
        this.scene = new THREE.Scene();
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 10000);
        this.camera.position.set(0, 30, 100);
        this.camera.lookAt(0, 0, 0);
        
        // Renderer with alpha for transparent background
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
        this.renderer.setClearColor(0x000000, 0); // Transparent background
        this.container.appendChild(this.renderer.domElement);
        
        // Lights - just a subtle ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Optional: Add OrbitControls if available and needed
        if (typeof THREE.OrbitControls === 'function') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.enableZoom = true;
        }
    }
    
    createStars() {
        // Create more efficient stars - using instancing for better performance
        const count = 7000;
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
            
            // Brighter stars (more white) with size variation
            colors[i * 3] = 0.9 + Math.random() * 0.1;       // R
            colors[i * 3 + 1] = 0.9 + Math.random() * 0.1;   // G
            colors[i * 3 + 2] = 1.0;                         // B
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true
        });
        
        this.stars = new THREE.Points(geometry, material);
        this.scene.add(this.stars);
        
        // Add a subtle blue glow to the scene
        const ambientLight = new THREE.AmbientLight(0x3366ff, 0.2);
        this.scene.add(ambientLight);
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
        
        const deltaTime = this.clock.getDelta();
        
        // Slow rotation of stars
        if (this.stars) {
            this.stars.rotation.y += 0.0001 * deltaTime * 60;
        }
        
        // Update controls if they exist
        if (this.controls) {
            this.controls.update();
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
    
    checkVisibility() {
        // Check if the container is visible
        if (this.container) {
            const isVisible = window.getComputedStyle(this.container).display !== 'none';
            console.log("Space environment visibility:", isVisible ? "visible" : "hidden");
        }
    }
    
    dispose() {
        // Clean up resources to prevent memory leaks
        window.removeEventListener('resize', this.handleResize.bind(this));
        
        if (this.stars) {
            this.scene.remove(this.stars);
            this.stars.geometry.dispose();
            this.stars.material.dispose();
        }
        
        if (this.renderer && this.container) {
            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }
        
        this.initialized = false;
    }
}

// Make available globally for PageManager
window.SpaceEnvironment = SpaceEnvironment;