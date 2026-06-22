// AsteroidBelt.js - Creates a belt of asteroids using InstancedMesh for performance
class AsteroidBelt {
    constructor(scene, innerRadius, outerRadius, count) {
        this.scene = scene;
        this.innerRadius = innerRadius;
        this.outerRadius = outerRadius;
        this.count = count;
        this.instancedMesh = null;
        this.orbitData = []; // Store orbital parameters per asteroid
        this.dummy = new THREE.Object3D(); // Reusable for matrix updates
        this.lastJ2000Days = null; // For time-scaling calculations
    }

    async init() {
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshPhongMaterial({
            color: 0x888888,
            flatShading: true
        });

        this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.count);

        // Initialize each asteroid
        for (let i = 0; i < this.count; i++) {
            const radius = this.innerRadius + Math.random() * (this.outerRadius - this.innerRadius);
            const angle = Math.random() * Math.PI * 2;
            const height = (Math.random() - 0.5) * 4;
            const scale = 0.5 + Math.random() * 1.5;

            // Store orbital data (not in userData - that's for meshes)
            this.orbitData.push({
                orbitRadius: radius,
                orbitAngle: angle,
                height: height,
                scale: scale,
                orbitSpeed: 0.001 + Math.random() * 0.003,
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.01,
                    y: (Math.random() - 0.5) * 0.01,
                    z: (Math.random() - 0.5) * 0.01
                },
                rotation: { x: 0, y: 0, z: 0 }
            });

            // Set initial position
            this.dummy.position.set(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
            );
            this.dummy.scale.setScalar(scale);
            this.dummy.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            this.dummy.updateMatrix();
            this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.instancedMesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.instancedMesh);

        return true;
    }

    update(deltaTime, j2000Days = null) {
        // NASA Rule 7: Calculate time-scaled delta for asteroid movement
        // Asteroids don't have specific orbital periods, so we scale based on j2000Days change
        let scaledDelta = deltaTime;

        if (j2000Days !== null) {
            if (this.lastJ2000Days !== null) {
                // Calculate how many "days" passed and convert to scaled delta
                // 1 day in simulation = 86400 seconds worth of movement
                const daysDelta = j2000Days - this.lastJ2000Days;
                // Realism fix: the previous *86400 made asteroids orbit ~20,000× too
                // fast (≈13 full revolutions per simulated day). orbitSpeed/rotationSpeed
                // below are already per-day rates (~0.001–0.004 rad/day ≈ multi-year
                // periods), so advance by elapsed days directly.
                scaledDelta = daysDelta;
            }
            this.lastJ2000Days = j2000Days;
        }

        for (let i = 0; i < this.count; i++) {
            const data = this.orbitData[i];

            // Update orbit angle using scaled delta
            data.orbitAngle += data.orbitSpeed * scaledDelta;

            // Update rotation using scaled delta
            data.rotation.x += data.rotationSpeed.x * scaledDelta;
            data.rotation.y += data.rotationSpeed.y * scaledDelta;
            data.rotation.z += data.rotationSpeed.z * scaledDelta;

            // Calculate new position
            this.dummy.position.set(
                Math.cos(data.orbitAngle) * data.orbitRadius,
                data.height,
                Math.sin(data.orbitAngle) * data.orbitRadius
            );
            this.dummy.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
            this.dummy.scale.setScalar(data.scale);
            this.dummy.updateMatrix();

            this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        // NASA Rule 5: Assertions for critical preconditions
        console.assert(this.instancedMesh !== null && this.instancedMesh !== undefined,
            "AsteroidBelt.dispose: instancedMesh should exist when dispose is called");
        console.assert(this.scene !== null && this.scene !== undefined,
            "AsteroidBelt.dispose: scene should exist when dispose is called");

        if (this.instancedMesh) {
            if (this.instancedMesh.geometry) {
                this.instancedMesh.geometry.dispose();
            }
            if (this.instancedMesh.material) {
                this.instancedMesh.material.dispose();
            }
            // Q1 Fix: Null-safe scene removal
            if (this.scene && this.instancedMesh) {
                this.scene.remove(this.instancedMesh);
            }
        }
        this.orbitData = [];
    }
}
