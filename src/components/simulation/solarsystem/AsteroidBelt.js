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

    /**
     * Pick an orbital radius that respects the KIRKWOOD GAPS.
     *
     * The real main belt is not a uniform smear. Jupiter's mean-motion resonances have
     * swept near-empty lanes through it over billions of years, and they are the most
     * recognisable feature the belt has. Previously the radius was a flat
     * `inner + random*(outer-inner)`, which produced a featureless ring.
     *
     * Rejection sampling against a Gaussian notch at each resonance. Bounded to a fixed
     * number of attempts so this can never spin (NASA Rule 2) — on exhaustion it simply
     * accepts the last candidate, which at worst puts one rock in a gap.
     * Rule 5: 2 asserts.
     */
    _sampleRadius() {
        console.assert(this.outerRadius > this.innerRadius, '_sampleRadius: bad belt bounds');
        console.assert(Array.isArray(AsteroidBelt.KIRKWOOD_GAPS_AU), '_sampleRadius: gap table required');
        const AU = (typeof SolarSystem !== 'undefined' && SolarSystem.AU) ? SolarSystem.AU : 60;
        let r = 0;
        for (let attempt = 0; attempt < 12; attempt++) {          // Rule 2: bounded
            r = this.innerRadius + Math.random() * (this.outerRadius - this.innerRadius);
            const au = r / AU;
            let keep = 1;
            for (let g = 0; g < AsteroidBelt.KIRKWOOD_GAPS_AU.length; g++) {
                const gap = AsteroidBelt.KIRKWOOD_GAPS_AU[g];
                const d = (au - gap.au) / gap.width;
                keep *= 1 - gap.depth * Math.exp(-0.5 * d * d);    // Gaussian notch
            }
            if (Math.random() < keep) return r;
        }
        return r;
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
            const radius = this._sampleRadius();
            const angle = Math.random() * Math.PI * 2;
            // Belt inclination is real: most of the main belt sits within ~10 deg of the
            // ecliptic, so scale the vertical spread with orbital radius instead of a
            // flat +/-2 units, which made the belt a suspiciously uniform slab.
            const height = (Math.random() - 0.5) * radius * 0.18;
            const scale = 0.5 + Math.random() * 1.5;

            // Store orbital data (not in userData - that's for meshes)
            this.orbitData.push({
                orbitRadius: radius,
                orbitAngle: angle,
                height: height,
                scale: scale,
                // KEPLER, not random. Angular speed goes as a^-3/2 (third law), so inner
                // asteroids genuinely lap outer ones. The old `0.001 + random*0.003`
                // gave a body at 3.3 AU a decent chance of orbiting faster than one at
                // 2.1 AU, which is simply not how gravity works — and it made the belt
                // visibly shear in the wrong direction over time.
                orbitSpeed: AsteroidBelt.BASE_SPEED * Math.pow(radius, -1.5),
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

// Kirkwood gaps — mean-motion resonances with Jupiter that have cleared near-empty
// lanes through the main belt. `au` is the resonance location, `width` the Gaussian
// sigma in AU, `depth` how strongly the lane is depleted (1 = fully empty).
// Source: JPL / standard main-belt resonance positions.
AsteroidBelt.KIRKWOOD_GAPS_AU = [
    { au: 2.065, width: 0.015, depth: 0.75, res: '4:1' },
    { au: 2.502, width: 0.020, depth: 0.92, res: '3:1' },   // the most prominent gap
    { au: 2.825, width: 0.018, depth: 0.85, res: '5:2' },
    { au: 2.958, width: 0.012, depth: 0.60, res: '7:3' },
    { au: 3.279, width: 0.020, depth: 0.88, res: '2:1' }
];

// Angular speed scale for orbitSpeed = BASE_SPEED * r^-1.5 (Kepler's third law).
// Tuned so the belt drifts at a believable rate against the planets rather than
// matching real seconds, which at real time would be visually static.
AsteroidBelt.BASE_SPEED = 2.2;

// Largest main-belt bodies, real JPL Small-Body Database values (a in AU,
// e, i in degrees, diameter in km). These are rendered as NAMED asteroids rather
// than anonymous instanced rocks, because "the asteroid belt" containing Ceres and
// Vesta is a different claim from "the asteroid belt is a thousand grey dots".
// Fetched from https://ssd-api.jpl.nasa.gov/sbdb.api
AsteroidBelt.MAJOR_BODIES = [
    { name: 'Ceres',   a: 2.77, e: 0.0797, i: 10.6, diameterKm: 939.4, color: 0x9c9186 },
    { name: 'Vesta',   a: 2.36, e: 0.0902, i: 7.14, diameterKm: 522.8, color: 0xb9a887 },
    { name: 'Pallas',  a: 2.77, e: 0.231,  i: 34.9, diameterKm: 513.0, color: 0x8e8e96 },
    { name: 'Hygiea',  a: 3.15, e: 0.107,  i: 3.83, diameterKm: 407.1, color: 0x6f6b66 },
    { name: 'Juno',    a: 2.67, e: 0.256,  i: 13.0, diameterKm: 246.6, color: 0xa39481 },
    { name: 'Psyche',  a: 2.93, e: 0.135,  i: 3.10, diameterKm: 222.0, color: 0xa89a7c }
];
