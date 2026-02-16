// Galaxy.js - Background stars
class Galaxy {
    constructor(scene, count = 10000) {
        this.scene = scene;
        this.count = count;
        this.particles = null;
    }
    
    init() {
        // Create geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.count * 3);
        const colors = new Float32Array(this.count * 3);
        
        for (let i = 0; i < this.count; i++) {
            // Random position in a sphere
            const radius = 500 + Math.random() * 1500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[(i * 3) + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[(i * 3) + 2] = radius * Math.cos(phi);
            
            // Stellar spectral distribution based on Gaia EDR3 catalog
            // M-type red dwarfs: ~70% of Milky Way stellar population
            // Reference: Gaia Collaboration, 2021
            // RGB colors approximate Wien's displacement law for visual plausibility
            const spectralClass = Math.random();

            if (spectralClass < 0.70) {
                // M-type red dwarf (70% of all stars) - Deep red/orange
                colors[i * 3] = 0.9 + Math.random() * 0.1; // R: 0.9-1.0 (keep bright)
                colors[(i * 3) + 1] = 0.2 + Math.random() * 0.2; // G: 0.2-0.4 (reduced for deeper red)
                colors[(i * 3) + 2] = 0.1 + Math.random() * 0.15; // B: 0.1-0.25 (reduced for deeper red)
            } else if (spectralClass < 0.85) {
                // K/G-type yellow-orange (15% of stars)
                colors[i * 3] = 0.95 + Math.random() * 0.05;
                colors[(i * 3) + 1] = 0.8 + Math.random() * 0.1;
                colors[(i * 3) + 2] = 0.5 + Math.random() * 0.1;
            } else if (spectralClass < 0.93) {
                // F/A-type yellow-white (8% of stars)
                colors[i * 3] = 1.0;
                colors[(i * 3) + 1] = 0.95 + Math.random() * 0.05;
                colors[(i * 3) + 2] = 0.8 + Math.random() * 0.1;
            } else {
                // O/B-type blue (7% of stars)
                colors[i * 3] = 0.9 + Math.random() * 0.1;
                colors[(i * 3) + 1] = 0.95 + Math.random() * 0.05;
                colors[(i * 3) + 2] = 1.0;
            }
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Create material
        const material = new THREE.PointsMaterial({
            size: 1,
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });
        
        // Create particle system
        this.particles = new THREE.Points(geometry, material);
        
        // Add to scene
        this.scene.add(this.particles);
        
        return true;
    }
    
    update(deltaTime) {
        // Slow rotation of the entire galaxy
        this.particles.rotation.y += 0.00005 * deltaTime;
    }

    dispose() {
        // NASA Rule 5: Validate dispose preconditions
        console.assert(this.particles, "Galaxy.dispose: particles should exist when dispose is called");
        console.assert(this.scene, "Galaxy.dispose: scene should exist when dispose is called");

        // Dispose particle system
        if (this.particles) {
            // Dispose geometry and its attributes
            if (this.particles.geometry) {
                // BufferAttributes are automatically disposed with geometry
                this.particles.geometry.dispose();
            }

            // Dispose material
            if (this.particles.material) {
                this.particles.material.dispose();
            }

            // Remove from scene
            this.scene.remove(this.particles);
            this.particles = null;
        }

        // Clear references
        this.scene = null;
        this.count = null;
    }
}