import * as THREE from 'three';

export default class Earth {
    constructor() {
        this.group = new THREE.Group();
        this.createEarth();
        this.createAtmosphere();
        this.createClouds();
    }

    createEarth() {
        const geometry = new THREE.SphereGeometry(6371, 64, 64); // Earth radius in km
        const material = new THREE.MeshPhongMaterial({
            map: new THREE.TextureLoader().load('src/assets/textures/earth_daymap.jpg'),
            bumpMap: new THREE.TextureLoader().load('src/assets/textures/earth_bumpmap.jpg'),
            bumpScale: 0.05,
            specularMap: new THREE.TextureLoader().load('src/assets/textures/earth_specular.jpg'),
            specular: new THREE.Color('grey')
        });
        this.earthMesh = new THREE.Mesh(geometry, material);
        this.group.add(this.earthMesh);
    }

    createAtmosphere() {
        const geometry = new THREE.SphereGeometry(6371 * 1.01, 64, 64);
        const material = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                    gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        this.group.add(mesh);
    }

    createClouds() {
        const geometry = new THREE.SphereGeometry(6371 * 1.02, 64, 64);
        const material = new THREE.MeshPhongMaterial({
            map: new THREE.TextureLoader().load('src/assets/textures/earth_clouds.png'),
            transparent: true,
            opacity: 0.8
        });
        this.cloudsMesh = new THREE.Mesh(geometry, material);
        this.group.add(this.cloudsMesh);
    }

    update(deltaTime) {
        this.earthMesh.rotation.y += 0.05 * deltaTime;
        this.cloudsMesh.rotation.y += 0.07 * deltaTime;
    }

    getGroup() {
        return this.group;
    }

    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
    }

    getPosition() {
        return this.group.position;
    }

    setRotation(x, y, z) {
        this.earthMesh.rotation.set(x, y, z);
    }

    getRotation() {
        return this.earthMesh.rotation;
    }
}