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
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            
            // Random colors (white to blue)
            colors[i * 3] = 0.8 + Math.random() * 0.2;       // R
            colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;   // G
            colors[i * 3 + 2] = 0.8 + Math.random() * 0.2;   // B
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
}