// Scene.js - The main 3D rendering container
class Scene {
    constructor(containerId = 'solar-system-container') {
        // Create container if it doesn't exist
        this.ensureContainer(containerId);
        
        this.container = document.getElementById(containerId);
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        // Three.js components
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        // Setup renderer
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0); // Transparent background
        this.container.appendChild(this.renderer.domElement);
        
        // Camera initial position
        this.camera.position.set(0, 30, 100);
        this.camera.lookAt(0, 0, 0);
        
        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        
        // Performance monitoring
        this.stats = null;
        this.initStats();
        
        // Lights
        this.addLights();
        
        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Animation loop
        this.animate = this.animate.bind(this);
        
        // Memory management
        this.memoryManager = new MemoryManager(this.scene, this.renderer);
    }
    
    ensureContainer(containerId) {
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
    }
    
    addLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        // Directional light (sun)
        const sunLight = new THREE.PointLight(0xffffff, 2, 1000);
        sunLight.position.set(0, 0, 0);
        this.scene.add(sunLight);
    }
    
    initStats() {
        if (process.env.NODE_ENV !== 'production') {
            this.stats = new Stats();
            this.stats.domElement.style.position = 'absolute';
            this.stats.domElement.style.top = '0px';
            this.stats.domElement.style.zIndex = '100';
            this.container.appendChild(this.stats.domElement);
        }
    }
    
    handleResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(this.width, this.height);
    }
    
    animate() {
        requestAnimationFrame(this.animate);
        
        // Update controls
        this.controls.update();
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
        
        // Update stats
        if (this.stats) this.stats.update();
    }
    
    start() {
        this.animate();
    }
    
    dispose() {
        // Clean up resources
        this.memoryManager.cleanUp();
        window.removeEventListener('resize', this.handleResize.bind(this));
        this.container.removeChild(this.renderer.domElement);
        if (this.stats) this.container.removeChild(this.stats.domElement);
    }
}