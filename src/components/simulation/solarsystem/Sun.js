// Sun.js - Special case for the sun
class Sun {
    constructor(scene, resourceLoader, data) {
        this.scene = scene;
        this.resourceLoader = resourceLoader;
        this.data = data;
        this.mesh = null;
        this.light = null;
    }
    
    async init() {
        try {
            // Load the texture
            const texture = await this.resourceLoader.loadTexture(this.data.texturePath);
            
            // Create geometry and material with emissive properties
            const geometry = new THREE.SphereGeometry(this.data.radius, 64, 64);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                emissive: 0xffff00,
                emissiveIntensity: 0.5
            });
            
            // Create the mesh
            this.mesh = new THREE.Mesh(geometry, material);
            
            // Add to scene
            this.scene.add(this.mesh);
            
            // Create a light source
            this.light = new THREE.PointLight(0xffffff, 1.5, 1000);
            this.mesh.add(this.light);
            
            // Add lens flare effect
            this.addLensFlare();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize Sun:', error);
            return false;
        }
    }
    
    addLensFlare() {
        // This would create a lens flare effect
        // Actual implementation would depend on which Three.js version you're using
        // as the Lensflare class has changed in recent versions
    }
    
    update(deltaTime) {
        // Slowly rotate the sun
        this.mesh.rotation.y += 0.001 * deltaTime;
    }
    
    getMesh() {
        return this.mesh;
    }
}