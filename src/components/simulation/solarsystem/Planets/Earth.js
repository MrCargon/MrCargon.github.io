// Earth.js - Example of a specialized planet class
class Earth extends Planet {
    constructor(scene, resourceLoader, data) {
        super(scene, resourceLoader, data);
        this.moonData = {
            radius: 0.5,
            distance: 5,
            rotationSpeed: 0.02,
            orbitSpeed: 0.05,
            texturePath: "src/assets/textures/planets/earth/moon/moon_map.jpg",
            bumpMapPath: "src/assets/textures/planets/earth/moon/moon_bump.jpg"
        };
    }
    
    async init() {
        await super.init();
        
        // Create the moon
        await this.createMoon();
        
        return true;
    }
    
    async createMoon() {
        // Create a group for the moon's orbit
        this.moonGroup = new THREE.Group();
        this.mesh.add(this.moonGroup);
        
        // Load moon textures
        const moonTexture = await this.resourceLoader.loadTexture(this.moonData.texturePath);
        const moonBumpMap = await this.resourceLoader.loadTexture(this.moonData.bumpMapPath);
        
        // Create moon geometry and material
        const moonGeometry = new THREE.SphereGeometry(this.moonData.radius, 32, 32);
        const moonMaterial = new THREE.MeshPhongMaterial({
            map: moonTexture,
            bumpMap: moonBumpMap,
            bumpScale: 0.1
        });
        
        // Create moon mesh
        const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
        
        // Position moon
        moonMesh.position.set(this.moonData.distance, 0, 0);
        
        // Add moon to its orbit group
        this.moonGroup.add(moonMesh);
        
        // Store moon data for animation
        this.moons.push({
            mesh: moonMesh,
            orbit: { angle: 0 },
            data: this.moonData,
            update: (deltaTime) => {
                // Rotate moon
                moonMesh.rotation.y += this.moonData.rotationSpeed * deltaTime;
                
                // Orbit moon around planet
                this.moonGroup.rotation.y += this.moonData.orbitSpeed * deltaTime;
            }
        });
    }
}