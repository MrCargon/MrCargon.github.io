import * as THREE from 'three';

export default class Galaxy {
    constructor() {
        this.group = new THREE.Group();
        this.galaxyRadius = 50000; // 50,000 light-years
        this.solarSystemPosition = new THREE.Vector3(26000, 0, 0); // Approximately 26,000 light-years from galactic center
        this.createGalaxy();
    }

    createGalaxy() {
        const particleCount = 1000000;
        const colorOptions  = [0xffffff, 0xffd700, 0xff4500, 0x00ffff];

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const r = Math.random() * this.galaxyRadius;
            const theta = Math.random() * Math.PI * 2;
            const y = (Math.random() - 0.5) * this.galaxyRadius * 0.1;

            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            const color = new THREE.Color(colorOptions[Math.floor(Math.random() * colorOptions.length)]);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 10,
            vertexColors: true,
            map: this.createStarTexture(),
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true
        });

        this.stars = new THREE.Points(geometry, material);
        this.group.add(this.stars);
    }

    createStarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.4, 'rgba(255,255,255,0.5)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(canvas);
    }

    update(deltaTime) {
        this.group.rotation.y += 0.00005 * deltaTime;
    }

    getGroup() {
        return this.group;
    }

    getSolarSystemPosition() {
        return this.solarSystemPosition;
    }

    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
    }
}