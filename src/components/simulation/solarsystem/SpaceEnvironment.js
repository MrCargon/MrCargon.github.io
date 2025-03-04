import * as THREE from 'three';

/**
 * SpaceEnvironment class
 * Creates a dynamic space background with stars, nebulae, and distant galaxies
 */
export default class SpaceEnvironment {
    /**
     * Initialize the space environment
     */
    constructor() {
        this.createEnvironment();
        this.createDistantGalaxies();
    }

    /**
     * Create the main space environment using a shader material
     */
    createEnvironment() {
        const geometry = new THREE.SphereGeometry(500000, 64, 64);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                resolution: { value: new THREE.Vector2() }
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            side: THREE.BackSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
    }

    /**
     * Create particle system to represent distant galaxies
     */
    createDistantGalaxies() {
        const particleCount = 500;
        const particles = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            this.setGalaxyParticle(particles, colors, i);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 1000,
            vertexColors: true,
            map: this.createGalaxyTexture(),
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            depthTest: true
        });

        this.galaxies = new THREE.Points(geometry, material);
        this.galaxies.renderOrder = -2000;
    }

    /**
     * Set position and color for a single galaxy particle
     * @param {Float32Array} particles - Array to store particle positions
     * @param {Float32Array} colors - Array to store particle colors
     * @param {number} index - Index of the particle
     */
    setGalaxyParticle(particles, colors, index) {
        const i = index * 3;
        const radius = Math.random() * 400000 + 100000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        particles[i] = radius * Math.sin(phi) * Math.cos(theta);
        particles[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
        particles[i + 2] = radius * Math.cos(phi);

        colors[i] = Math.random() * 0.3 + 0.7;     // Red
        colors[i + 1] = Math.random() * 0.3 + 0.4; // Green
        colors[i + 2] = Math.random() * 0.3 + 0.4; // Blue
    }

    /**
     * Create a texture for galaxy particles
     * @returns {THREE.Texture} The created texture
     */
    createGalaxyTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,240,220,0.8)');
        gradient.addColorStop(0.4, 'rgba(255,220,180,0.5)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(canvas);
    }

    /**
     * Get the vertex shader code
     * @returns {string} Vertex shader code
     */
    getVertexShader() {
        return `
            varying vec3 vPos;
            varying vec2 vUv;
            void main() {
                vPos = position;
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
    }

    getFragmentShader() {
        return `
            uniform float time;
            uniform vec2 resolution;
            varying vec3 vPos;
            varying vec2 vUv;
    
            // Optimized noise function using dot product instead of multiple operations
            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f); // Smoother step
                
                // Reduced number of random calculations
                float n = dot(i, vec3(1.0, 157.0, 113.0));
                vec4 v = fract(sin(vec4(n, n + 1.0, n + 157.0, n + 158.0)) * 43758.5453);
                
                // Simplified mixing
                float result = mix(
                    mix(v.x, v.y, f.x),
                    mix(v.z, v.w, f.x),
                    f.y
                );
                return result;
            }
    
            // Optimized FBM with fewer iterations and precalculated values
            float fbm(vec3 p) {
                float sum = 0.0;
                float amp = 0.5;
                p *= 1.0; // Initial frequency
    
                // Reduced iterations from 6 to 4 for better performance
                for(int i = 0; i < 4; i++) {
                    sum += amp * abs(noise(p));
                    p *= 2.1;
                    amp *= 0.4;
                }
                return sum;
            }
    
            // Simplified sparkle effect
            float starSparkle(vec3 p, float brightness) {
                return brightness * (0.85 + 0.15 * sin(time * 1.5 + noise(p * 80.0) * 8.0));
            }
    
            void main() {
                // Precalculate common values
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                float timeFactor = time * 0.01;
                
                // Base space color
                vec3 color = vec3(0.01, 0.012, 0.02);
                
                // Optimized star calculation
                vec3 timeOffsetPos = vPos * 0.0003 + timeFactor;
                float stars = smoothstep(0.87, 0.97, fbm(timeOffsetPos));
                stars = starSparkle(vPos, stars);
                
                // Add smaller stars with less computation
                stars += smoothstep(0.95, 0.98, fbm(vPos * 0.0005 - timeFactor)) * 0.2;
                
                // Add stars to color
                color += vec3(0.9, 0.95, 1.0) * stars;
                
                // Simplified nebulae calculation
                vec3 nebulaePos = vPos * 0.00002;
                vec3 nebulae = vec3(0.1, 0.15, 0.3) * fbm(nebulaePos + timeFactor)
                            + vec3(0.05, 0.1, 0.2) * fbm(nebulaePos * 1.5 - timeFactor)
                            + vec3(0.15, 0.1, 0.25) * fbm(nebulaePos * 2.0 + timeFactor);
                
                // Add depth and combine
                float depth = fbm(vPos * 0.00001);
                nebulae *= 0.15 * smoothstep(0.2, 0.8, depth);
                color += nebulae;
                
                // Final adjustments
                color = pow(color, vec3(1.3));
                color *= 0.6;
                
                // Optimized vignette
                float vignette = 1.0 - length(uv - 0.5) * 0.7;
                color *= vignette;
                
                gl_FragColor = vec4(color, 1.0);
            }
        `;
    }
    
    /**
     * Get the main environment mesh
     * @returns {THREE.Mesh} The environment mesh
     */
    getMesh() {
        return this.mesh;
    }

    /**
     * Get the distant galaxies particle system
     * @returns {THREE.Points} The galaxies particle system
     */
    getGalaxies() {
        return this.galaxies;
    }

    /**
     * Update the environment animation
     * @param {number} time - The current time for animation
     */
    update(time) {
        if (this.mesh.material.uniforms) {
            this.mesh.material.uniforms.time.value = time * 0.1;
        }
        if (this.galaxies) {
            this.galaxies.rotation.y = time * 0.00001;
        }
    }

    /**
     * Set the resolution for the shader
     * @param {number} width - The width of the viewport
     * @param {number} height - The height of the viewport
     */
    setResolution(width, height) {
        if (this.mesh.material.uniforms) {
            this.mesh.material.uniforms.resolution.value.set(width, height);
        }
    }
}