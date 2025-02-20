import * as THREE from 'three';

export class HabitableZone {
    constructor(innerRadius, outerRadius) {
        this.group = new THREE.Group();
        this.innerRadius = innerRadius;
        this.outerRadius = outerRadius;
        this.createZone();
    }

    createZone() {
        // Create visual representation of habitable zone
    }

    update(deltaTime) {
        // Add any animation or updates needed
    }
}