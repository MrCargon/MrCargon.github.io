// AsteroidBelt.js - Creates a belt of asteroids
class AsteroidBelt {
    constructor(scene, innerRadius, outerRadius, count) {
        this.scene = scene;
        this.innerRadius = innerRadius;
        this.outerRadius = outerRadius;
        this.count = count;
        this.asteroids = new THREE.Group();
        this.scene.add(this.asteroids);
    }
    
    async init() {
        // Create instanced mesh for performance
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshPhongMaterial({
            color: 0x888888,
            flatShading: true
        });
        
        // Create asteroids
        for (let i = 0; i < this.count; i++) {
            // Randomize position within the belt
            const radius = this.innerRadius + Math.random() * (this.outerRadius - this.innerRadius);
            const angle = Math.random() * Math.PI * 2;
            
            // Add some vertical spread
            const height = (Math.random() - 0.5) * 4;
            
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            // Create asteroid
            const asteroid = new THREE.Mesh(geometry, material);
            asteroid.position.set(x, height, z);
            
            // Random rotation
            asteroid.rotation.x = Math.random() * Math.PI;
            asteroid.rotation.y = Math.random() * Math.PI;
            asteroid.rotation.z = Math.random() * Math.PI;
            
            // Random scale
            const scale = 0.5 + Math.random() * 1.5;
            asteroid.scale.set(scale, scale, scale);
            
            // Data for animation
            asteroid.userData = {
                orbitSpeed: 0.001 + Math.random() * 0.003,
                orbitRadius: radius,
                orbitAngle: angle,
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.01,
                    y: (Math.random() - 0.5) * 0.01,
                    z: (Math.random() - 0.5) * 0.01
                }
            };
            
            this.asteroids.add(asteroid);
        }
        
        return true;
    }
    
    update(deltaTime) {
        // Update each asteroid
        this.asteroids.children.forEach(asteroid => {
            const data = asteroid.userData;
            
            // Update orbit
            data.orbitAngle += data.orbitSpeed * deltaTime;
            asteroid.position.x = Math.cos(data.orbitAngle) * data.orbitRadius;
            asteroid.position.z = Math.sin(data.orbitAngle) * data.orbitRadius;
            
            // Update rotation
            asteroid.rotation.x += data.rotationSpeed.x * deltaTime;
            asteroid.rotation.y += data.rotationSpeed.y * deltaTime;
            asteroid.rotation.z += data.rotationSpeed.z * deltaTime;
        });
    }
}