// HabitableZone.js - Visual indicator of the habitable zone
class HabitableZone {
    constructor(scene, innerRadius, outerRadius) {
        this.scene = scene;
        this.innerRadius = innerRadius;
        this.outerRadius = outerRadius;
        this.mesh = null;
    }
    
    init() {
        // Create a ring to represent the habitable zone
        const geometry = new THREE.RingGeometry(this.innerRadius, this.outerRadius, 64);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = Math.PI / 2;
        
        // Add to scene
        this.scene.add(this.mesh);
        
        // Initially invisible
        this.mesh.visible = false;
        
        return true;
    }
    
    show() {
        this.mesh.visible = true;
    }
    
    hide() {
        this.mesh.visible = false;
    }
    
    toggle() {
        this.mesh.visible = !this.mesh.visible;
        return this.mesh.visible;
    }
}