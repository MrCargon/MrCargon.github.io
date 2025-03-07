// Planet.js - Base class for all planets
class Planet {
    constructor(scene, resourceLoader, data) {
        this.scene = scene;
        this.resourceLoader = resourceLoader;
        this.data = data;
        this.mesh = null;
        this.orbit = { angle: Math.random() * Math.PI * 2 };
        this.cloudsMesh = null;
        this.ringsMesh = null;
        this.moonGroup = null;
        this.moons = [];
    }
    
    async init() {
        try {
            // Load the texture
            const texture = await this.resourceLoader.loadTexture(this.data.texturePath);
            
            // Create geometry and material
            const geometry = new THREE.SphereGeometry(this.data.radius, 64, 64);
            const material = new THREE.MeshPhongMaterial({
                map: texture,
                bumpScale: 0.05
            });
            
            // Load bump map if available
            if (this.data.bumpMapPath) {
                const bumpMap = await this.resourceLoader.loadTexture(this.data.bumpMapPath);
                material.bumpMap = bumpMap;
            }
            
            // Load specular map if available
            if (this.data.specularMapPath) {
                const specularMap = await this.resourceLoader.loadTexture(this.data.specularMapPath);
                material.specularMap = specularMap;
                material.shininess = 10;
            }
            
            // Create the mesh
            this.mesh = new THREE.Mesh(geometry, material);
            
            // Position the planet based on its distance from the sun
            this.updatePosition();
            
            // Add to scene
            this.scene.add(this.mesh);
            
            // Create clouds if available
            if (this.data.cloudsPath) {
                await this.createClouds();
            }
            
            // Create rings if available
            if (this.data.ringsPath) {
                await this.createRings();
            }
            
            return true;
        } catch (error) {
            console.error(`Failed to initialize planet ${this.data.name}:`, error);
            return false;
        }
    }
    
    async createClouds() {
        const cloudsTexture = await this.resourceLoader.loadTexture(this.data.cloudsPath);
        
        const cloudsGeometry = new THREE.SphereGeometry(this.data.radius + 0.05, 64, 64);
        const cloudsMaterial = new THREE.MeshPhongMaterial({
            map: cloudsTexture,
            transparent: true,
            opacity: 0.8
        });
        
        this.cloudsMesh = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
        this.mesh.add(this.cloudsMesh);
    }
    
    async createRings() {
        // Load ring textures
        const ringsTexture = await this.resourceLoader.loadTexture(this.data.ringsPath);
        const ringsColorTexture = this.data.ringsColorPath ? 
            await this.resourceLoader.loadTexture(this.data.ringsColorPath) : null;
        
        // Create ring geometry
        const innerRadius = this.data.radius * 1.5;
        const outerRadius = this.data.radius * 2.5;
        const segments = 128;
        
        const ringsGeometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);
        
        // Create mesh with double-sided material
        const ringsMaterial = new THREE.MeshPhongMaterial({
            map: ringsTexture,
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        
        if (ringsColorTexture) {
            ringsMaterial.alphaMap = ringsTexture;
            ringsMaterial.map = ringsColorTexture;
        }
        
        this.ringsMesh = new THREE.Mesh(ringsGeometry, ringsMaterial);
        
        // Rotate rings to be horizontal
        this.ringsMesh.rotation.x = Math.PI / 2;
        
        // Add rings to planet
        this.mesh.add(this.ringsMesh);
    }
    
    updatePosition() {
        const x = Math.cos(this.orbit.angle) * this.data.distance;
        const z = Math.sin(this.orbit.angle) * this.data.distance;
        this.mesh.position.set(x, 0, z);
    }
    
    update(deltaTime) {
        // Rotate on axis
        this.mesh.rotation.y += this.data.rotationSpeed * deltaTime;
        
        // Orbit around the sun
        this.orbit.angle += this.data.orbitSpeed * deltaTime;
        this.updatePosition();
        
        // Rotate clouds if they exist
        if (this.cloudsMesh) {
            this.cloudsMesh.rotation.y += this.data.rotationSpeed * 0.5 * deltaTime;
        }
        
        // Update moons if any
        for (const moon of this.moons) {
            moon.update(deltaTime);
        }
    }
    
    getMesh() {
        return this.mesh;
    }
}