// src/components/celestial/Sun.js
import * as THREE from 'three';
// Import textures directly using the import statement
import sunTexture from '../../assets/textures/sun/sun_map.jpg';
/**
 * Sun configuration constants based on NASA's solar fact sheet
 * https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html
 */
export const SUN_DATA = {
    radius: 696340,         // km
    mass: 333000,          // Earth masses
    surfaceTemp: 5778,     // Kelvin
    coreTemp: 15700000,    // Kelvin
    luminosity: 382.8e24,  // Watts
    age: 4.6e9,           // Years
    rotation: {
        period: 27,          // Days at equator (from NASA fact sheet)
        differential: true,   // Sun has differential rotation
        equatorialSpeed: 1.997,  // km/s at equator
        poleSpeed: 1.36,     // km/s at poles
    },
    
    // Visual properties
    materials: {
        core: {
            color: 0xffff80,
            emissive: 0xffff00,
            emissiveIntensity: 0.6
        },
        surface: {
            color: 0xffdd44,
            emissive: 0xffaa00,
            emissiveIntensity: 0.8
        },
        atmosphere: {
            color: 0xffaa00,
            opacity: 0.3
        },
        corona: {
            color: 0xff8800,
            opacity: 0.2
        }
    },
    
    // Light properties
    light: {
        color: 0xffffff,
        intensity: 2.5,
        distance: 1000,
        decay: 1
    }
};

export class Sun {
    constructor(sizeScale, textureLoader) {
        this.isInitialized = false;
        this.sizeScale = sizeScale;
        this.textureLoader = textureLoader;
        this.group = new THREE.Group();
        this.scaledRadius = (SUN_DATA.radius * this.sizeScale) / 2;
        
        // Remove texturePaths array since we're using direct import
        this.sunTexture = null;
        
        // Initialize texture cache
        this.textureCache = new Map();
        
        this.initializeComponents();
    }

    async initializeComponents() {
        try {
            // Create the basic sun structure first
            this.createSunGroup();
            await this.createBasicSurface();
            this.createLighting();
            
            this.isInitialized = true;
        } catch (error) {
            console.warn('Sun initialization warning:', error);
            // Continue with basic rendering even if texture fails
            this.isInitialized = true;
        }
    }

    applyTexture(texture) {
        if (this.surface && this.surface.material) {
            this.surface.material.map = texture;
            this.surface.material.needsUpdate = true;
        }
    }

    async loadTextures(material) {
        if (!this.textureLoader) {
            console.warn('No texture loader available for Sun, using basic material');
            return this.applyFallbackMaterial(material);
        }

        try {
            const texture = await this.tryLoadTextureWithFallbacks('sun_map.jpg');
            if (texture) {
                this.applyTextureToMaterial(material, texture);
            } else {
                this.applyFallbackMaterial(material);
            }
        } catch (error) {
            console.warn('Sun texture loading failed:', error);
            this.applyFallbackMaterial(material);
        }
    }

    async tryLoadTextureWithFallbacks(filename) {
        for (const basePath of this.textureBasePaths) {
            try {
                const fullPath = `${basePath}${filename}`;
                console.debug('Attempting to load texture from:', fullPath);
                
                const texture = await new Promise((resolve, reject) => {
                    this.textureLoader.load(
                        fullPath,
                        (tex) => {
                            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                            tex.minFilter = THREE.LinearMipmapLinearFilter;
                            tex.magFilter = THREE.LinearFilter;
                            tex.generateMipmaps = true;
                            tex.needsUpdate = true;
                            resolve(tex);
                        },
                        // Progress callback
                        undefined,
                        // Error callback
                        (err) => reject(err)
                    );
                });
                
                console.debug('Successfully loaded texture from:', fullPath);
                return texture;
            } catch (error) {
                console.debug(`Failed to load texture from ${basePath}:`, error);
                continue; // Try next path
            }
        }
        
        // If all paths fail, return null to trigger fallback
        return null;
    }

    async loadTextureWithFallbacks(baseName) {
        // Try each path until one works
        for (const basePath of this.texturePaths) {
            try {
                console.debug('Attempting to load texture from:', basePath);
                const texture = await new Promise((resolve, reject) => {
                    if (!this.textureLoader) {
                        reject(new Error('No texture loader available'));
                        return;
                    }
    
                    this.textureLoader.load(
                        basePath,
                        (texture) => {
                            // Configure texture properties
                            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                            texture.minFilter = THREE.LinearMipmapLinearFilter;
                            texture.magFilter = THREE.LinearFilter;
                            texture.anisotropy = 16;
                            texture.needsUpdate = true;
                            
                            // Cache the successful texture
                            this.textureCache.set(baseName, texture);
                            resolve(texture);
                        },
                        undefined,
                        (error) => {
                            console.debug(`Failed to load texture from ${basePath}:`, error);
                            reject(error);
                        }
                    );
                });
                
                console.debug('Successfully loaded texture from:', basePath);
                return texture;
            } catch (error) {
                console.debug(`Failed to load texture from ${basePath}, trying next path...`);
                continue;
            }
        }
    
        // If all paths fail, create and return a procedural texture
        console.warn('All texture paths failed, using procedural fallback');
        return this.createProceduralTexture();
    }
    
    createProceduralTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Create a more realistic sun texture procedurally
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Base gradient
        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, canvas.width / 2
        );
        gradient.addColorStop(0, '#ffff80');
        gradient.addColorStop(0.5, '#ffdd44');
        gradient.addColorStop(1, '#ff8800');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add solar granulation effect
        ctx.globalAlpha = 0.1;
        for (let i = 0; i < 2000; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = 1 + Math.random() * 3;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#ffaa00';
            ctx.fill();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.generateMipmaps = false; // Disable mipmaps
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    }

    applyTextureToMaterial(material, texture) {
        material.map = texture;
        material.map.needsUpdate = true;
        material.needsUpdate = true;
    }

    createBasicSurface() {
        const geometry = new THREE.SphereGeometry(this.scaledRadius, 64, 64);
        
        // Create initial material without texture
        const material = new THREE.MeshStandardMaterial({
            color: SUN_DATA.materials.surface.color,
            emissive: SUN_DATA.materials.surface.emissive,
            emissiveIntensity: 0.5,
            transparent: false,
            depthWrite: true,
            depthTest: true,
            side: THREE.FrontSide
        });

        // Create procedural texture immediately
        const proceduralTexture = this.createProceduralTexture();
        material.map = proceduralTexture;
        material.needsUpdate = true;

        this.surface = new THREE.Mesh(geometry, material);
        this.sunGroup.add(this.surface);

        return Promise.resolve(); // Return resolved promise since we're using procedural texture
    }

    initialize() {
        this.createSunGroup();
        this.createCoreGlow();
        this.createSurface();
        this.createLighting();
    }

    createLighting() {
        this.sunLight = new THREE.PointLight(
            SUN_DATA.light.color,
            SUN_DATA.light.intensity,
            SUN_DATA.light.distance,
            SUN_DATA.light.decay
        );
        
        const ambientLight = new THREE.AmbientLight(0x404040, 10.6);
        this.sunGroup.add(this.sunLight);
        this.sunGroup.add(ambientLight);
    }

    createSunGroup() {
        this.sunGroup = new THREE.Group();
        this.sunGroup.renderOrder = 1000;
        this.group.add(this.sunGroup);
    }

    createCoreGlow() {
        const geometry = new THREE.SphereGeometry(this.scaledRadius * 2.0, 64, 64);
        const material = new THREE.MeshStandardMaterial({
            color: SUN_DATA.materials.core.color,
            emissive: SUN_DATA.materials.core.emissive,
            emissiveIntensity: SUN_DATA.materials.core.emissiveIntensity,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            side: THREE.BackSide
        });

        this.coreGlow = new THREE.Mesh(geometry, material);
        this.coreGlow.renderOrder = 999;
        this.sunGroup.add(this.coreGlow);
    }


    createSurface() {
        const geometry = new THREE.SphereGeometry(this.scaledRadius, 64, 64);
        
        // Create material with default settings
        const material = new THREE.MeshStandardMaterial({
            color: SUN_DATA.materials.surface.color,
            emissive: SUN_DATA.materials.surface.emissive,
            emissiveIntensity: 0.5,
            transparent: false,
            depthWrite: true,
            depthTest: true,
            side: THREE.FrontSide
        });

        this.surface = new THREE.Mesh(geometry, material);
        this.sunGroup.add(this.surface);

        // Attempt to load texture only if textureLoader is provided
        if (this.textureLoader && typeof this.textureLoader.load === 'function') {
            try {
                this.textureLoader.load(
                    '/textures/sun/sun_map.jpg', // Update path as needed
                    (texture) => {
                        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;
                        texture.generateMipmaps = false;
                        
                        material.map = texture;
                        material.emissiveMap = texture;
                        material.needsUpdate = true;
                    },
                    undefined,
                    (error) => {
                        console.warn('Failed to load sun texture, using fallback', error);
                    }
                );
            } catch (error) {
                console.warn('Error in texture loading setup', error);
            }
        }
    }

    createAtmosphere() {
        const geometry = new THREE.SphereGeometry(this.scaledRadius * 1.2, 64, 64);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                baseColor: { value: new THREE.Color(SUN_DATA.materials.atmosphere.color) },
                chromosphereColor: { value: new THREE.Color(0xff3300) },
                spiculeIntensity: { value: 0.5 },
                // Missing uniforms that are used in fragment shader:
                photosphereColor: { value: new THREE.Color(0xfff4e5) },
                transitionColor: { value: new THREE.Color(0xff8844) },
                coronaColor: { value: new THREE.Color(0xffddaa) },
                magneticFieldStrength: { value: 1.0 },
                solarWindIntensity: { value: 0.5 },
                turbulenceScale: { value: 2.0 },
                granulationScale: { value: 50.0 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec2 vUv;
                varying vec3 vPosition;
                varying float vDistanceFromCenter;
                uniform float time;

                // Hash functions for noise
                vec2 hash22(vec2 p) {
                    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
                }

                float simplex2D(vec2 p) {
                    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
                    const float K2 = 0.211324865; // (3-sqrt(3))/6;

                    vec2 i = floor(p + (p.x + p.y) * K1);
                    vec2 a = p - i + (i.x + i.y) * K2;
                    vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec2 b = a - o + K2;
                    vec2 c = a - 1.0 + 2.0 * K2;

                    vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
                    vec3 n = h * h * h * h * vec3(dot(a, hash22(i)), dot(b, hash22(i + o)), dot(c, hash22(i + 1.0)));

                    return dot(n, vec3(70.0));
                }

                // Simplified 3D noise based on 2D
                float noise3D(vec3 p) {
                    vec2 offset = vec2(100.0, 100.0);
                    float xy = simplex2D(p.xy);
                    float xz = simplex2D(p.xz + offset);
                    float yz = simplex2D(p.yz + offset * 2.0);
                    return (xy + xz + yz) / 3.0;
                }

                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vUv = uv;
                    vPosition = position;
                    vDistanceFromCenter = length(position) / ${this.scaledRadius.toFixed(1)};

                    // Magnetic field influence on vertex position using simplified noise
                    float magneticNoise = noise3D(position * 0.1 + vec3(time * 0.1));
                    float solarActivity = noise3D(position * 0.2 - vec3(time * 0.05));
                    
                    // Calculate displacement based on layer position
                    float layerFactor = smoothstep(1.0, 1.5, vDistanceFromCenter);
                    float displacement = 
                        magneticNoise * 0.02 * layerFactor +
                        solarActivity * 0.03 * layerFactor;

                    // Apply more displacement to outer layers
                    vec3 newPosition = position + normal * displacement * (vDistanceFromCenter - 0.9);
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 photosphereColor;
                uniform vec3 chromosphereColor;
                uniform vec3 transitionColor;
                uniform vec3 coronaColor;
                uniform float magneticFieldStrength;
                uniform float solarWindIntensity;
                uniform float turbulenceScale;
                uniform float granulationScale;

                varying vec3 vNormal;
                varying vec2 vUv;
                varying vec3 vPosition;
                varying float vDistanceFromCenter;

                // Hash function for fragment shader
                vec2 hash22(vec2 p) {
                    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
                }

                // Simplified noise for fragment shader
                float noise2D(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    
                    f = f * f * (3.0 - 2.0 * f);
                    
                    float n = mix(
                        mix(dot(hash22(i), f),
                            dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), f.x),
                        mix(dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                            dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), f.x),
                        f.y);
                            
                    return n * 0.5 + 0.5;
                }

                // Granulation pattern
                float granulation(vec2 uv) {
                    float n = 0.0;
                    float amplitude = 1.0;
                    float frequency = 1.0;
                    
                    for(int i = 0; i < 3; i++) {
                        vec2 p = uv * granulationScale * frequency + time * 0.1 * (1.0 - frequency);
                        n += noise2D(p) * amplitude;
                        amplitude *= 0.5;
                        frequency *= 2.0;
                    }
                    
                    return n;
                }

                // Magnetic field visualization
                vec3 magneticField(vec3 p) {
                    float x = noise2D(p.xy * 0.1 + time * 0.05);
                    float y = noise2D(p.yz * 0.1 - time * 0.05);
                    float z = noise2D(p.xz * 0.1 + time * 0.05);
                    return normalize(vec3(x, y, z) * 2.0 - 1.0);
                }

                void main() {
                    // Calculate view angle for edge effects
                    float viewAngle = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
                    
                    // Layer blending factors
                    float photosphereFactor = smoothstep(1.02, 1.0, vDistanceFromCenter);
                    float chromosphereFactor = smoothstep(1.01, 1.02, vDistanceFromCenter);
                    float transitionFactor = smoothstep(1.02, 1.05, vDistanceFromCenter);
                    float coronaFactor = smoothstep(1.05, 1.5, vDistanceFromCenter);

                    // Base color mixing
                    vec3 color = photosphereColor;
                    
                    // Photosphere granulation
                    if(photosphereFactor > 0.0) {
                        float granules = granulation(vUv);
                        color = mix(color, photosphereColor * 1.2, granules * photosphereFactor);
                    }

                    // Chromosphere with magnetic field influence
                    if(chromosphereFactor > 0.0) {
                        vec3 magneticInfluence = magneticField(vPosition);
                        vec3 chromoColor = mix(chromosphereColor, transitionColor, 
                            dot(magneticInfluence, vNormal) * 0.5 + 0.5);
                        color = mix(color, chromoColor, chromosphereFactor);
                    }

                    // Transition region
                    if(transitionFactor > 0.0) {
                        color = mix(color, transitionColor, transitionFactor);
                    }

                    // Corona with solar wind effects
                    if(coronaFactor > 0.0) {
                        float solarWindEffect = noise2D(vPosition.xy * 0.05 + time * 0.1) * solarWindIntensity;
                        vec3 coronaWithWind = mix(coronaColor, vec3(1.0), solarWindEffect);
                        color = mix(color, coronaWithWind, coronaFactor * viewAngle);
                    }

                    // Calculate opacity based on layer and view angle
                    float alpha = 0.0;
                    if(photosphereFactor > 0.0) alpha = 0.95;
                    else if(chromosphereFactor > 0.0) alpha = 0.7;
                    else if(transitionFactor > 0.0) alpha = 0.5;
                    else alpha = 0.3 * viewAngle;

                    // Add magnetic field distortions
                    vec3 magneticDistortion = magneticField(vPosition);
                    float fieldIntensity = dot(magneticDistortion, vNormal) * magneticFieldStrength;
                    color += vec3(fieldIntensity * 0.1);

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.atmosphere = new THREE.Mesh(geometry, material);
        this.atmosphere.renderOrder = 997;
        this.sunGroup.add(this.atmosphere);
    }

    createCorona() {
        const geometry = new THREE.SphereGeometry(this.scaledRadius * 2.5, 128, 128); // Increased segments
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                baseColor: { value: new THREE.Color(SUN_DATA.materials.corona.color) },
                noiseScale: { value: 2.0 },
                pulseSpeed: { value: 0.5 },
                coronaIntensity: { value: 0.4 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                varying vec2 vUv;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 baseColor;
                uniform float noiseScale;
                uniform float pulseSpeed;
                uniform float coronaIntensity;
                
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                varying vec2 vUv;
                
                // Improved noise function
                vec3 mod289(vec3 x) {
                    return x - floor(x * (1.0 / 289.0)) * 289.0;
                }
                
                vec4 mod289(vec4 x) {
                    return x - floor(x * (1.0 / 289.0)) * 289.0;
                }
                
                vec4 permute(vec4 x) {
                    return mod289(((x * 34.0) + 1.0) * x);
                }
                
                vec4 taylorInvSqrt(vec4 r) {
                    return 1.79284291400159 - 0.85373472095314 * r;
                }
                
                float snoise(vec3 v) {
                    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
                    
                    vec3 i  = floor(v + dot(v, C.yyy));
                    vec3 x0 = v - i + dot(i, C.xxx);
                    
                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min(g.xyz, l.zxy);
                    vec3 i2 = max(g.xyz, l.zxy);
                    
                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - D.yyy;
                    
                    i = mod289(i);
                    vec4 p = permute(permute(permute(
                        i.z + vec4(0.0, i1.z, i2.z, 1.0))
                        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                        
                    float n_ = 0.142857142857;
                    vec3 ns = n_ * D.wyz - D.xzx;
                    
                    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                    
                    vec4 x_ = floor(j * ns.z);
                    vec4 y_ = floor(j - 7.0 * x_);
                    
                    vec4 x = x_ *ns.x + ns.yyyy;
                    vec4 y = y_ *ns.x + ns.yyyy;
                    vec4 h = 1.0 - abs(x) - abs(y);
                    
                    vec4 b0 = vec4(x.xy, y.xy);
                    vec4 b1 = vec4(x.zw, y.zw);
                    
                    vec4 s0 = floor(b0)*2.0 + 1.0;
                    vec4 s1 = floor(b1)*2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));
                    
                    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
                    
                    vec3 p0 = vec3(a0.xy, h.x);
                    vec3 p1 = vec3(a0.zw, h.y);
                    vec3 p2 = vec3(a1.xy, h.z);
                    vec3 p3 = vec3(a1.zw, h.w);
                    
                    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
                    p0 *= norm.x;
                    p1 *= norm.y;
                    p2 *= norm.z;
                    p3 *= norm.w;
                    
                    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
                }
                
                void main() {
                    // Calculate view-space normal
                    vec3 viewNormal = normalize(vNormal);
                    
                    // Create seamless noise
                    vec3 noiseCoord = vec3(vUv * noiseScale, time * 0.1);
                    float noise = snoise(noiseCoord) * 0.5 + 0.5;
                    
                    // Improved edge glow
                    float fresnel = pow(1.0 - abs(dot(viewNormal, vec3(0.0, 0.0, 1.0))), 4.0);
                    
                    // Animated pulse
                    float pulse = (sin(time * pulseSpeed) * 0.15 + 0.85);
                    
                    // Layer multiple noise octaves
                    float detail = snoise(noiseCoord * 2.0) * 0.5 + 0.5;
                    noise = mix(noise, detail, 0.5);
                    
                    // Create color variation
                    vec3 warmColor = vec3(1.0, 0.6, 0.2);
                    vec3 coolColor = baseColor;
                    vec3 finalColor = mix(coolColor, warmColor, noise * 0.3);
                    
                    // Combine all effects
                    float alpha = fresnel * coronaIntensity * pulse * (noise * 0.5 + 0.5);
                    
                    // Smooth out the edges
                    alpha *= smoothstep(0.0, 0.2, fresnel);
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide
        });
    
        this.corona = new THREE.Mesh(geometry, material);
        this.corona.renderOrder = 996;
        
        // Add some subtle rotation
        this.corona.rotation.x = Math.PI * 0.05;
        this.corona.rotation.y = Math.PI * 0.05;
        
        this.sunGroup.add(this.corona);
    }

    createLighting() {
        this.sunLight = new THREE.PointLight(
            SUN_DATA.light.color,
            SUN_DATA.light.intensity,
            SUN_DATA.light.distance,
            SUN_DATA.light.decay
        );
        
        const ambientLight = new THREE.AmbientLight(0x404040, 10.6);
        
        this.sunGroup.add(this.sunLight);
        this.sunGroup.add(ambientLight);
    }

    update(deltaTime) {
        // Check if surface exists before updating
        if (this.surface) {
            // Calculate rotation based on the sun's rotation period
            const solarDay = SUN_DATA.rotation.period * 24 * 60 * 60; // Convert days to seconds
            const rotationSpeed = (2 * Math.PI) / solarDay;
            
            // Apply rotation
            this.surface.rotation.y += rotationSpeed * deltaTime;
        }
        
        // Update shader uniforms for animations if they exist
        const materials = [
            this.coreGlow?.material,
            this.surface?.material,
            this.atmosphere?.material,
            this.corona?.material
        ];
    
        materials.forEach(material => {
            if (material?.uniforms?.time) {
                material.uniforms.time.value += deltaTime;
            }
        });
    }

    applyFallbackMaterial(material) {
        // Create a procedural texture as fallback
        const texture = this.createProceduralSunTexture();
        
        material.map = texture;
        material.color.setHex(0xffdd44);
        material.emissive.setHex(0xff8800);
        material.emissiveIntensity = 0.6;
        material.needsUpdate = true;
    }

    createProceduralSunTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Create a more realistic sun texture procedurally
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Base gradient
        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, canvas.width / 2
        );
        gradient.addColorStop(0, '#ffff80');
        gradient.addColorStop(0.5, '#ffdd44');
        gradient.addColorStop(1, '#ff8800');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add solar granulation effect
        ctx.globalAlpha = 0.1;
        for (let i = 0; i < 2000; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = 1 + Math.random() * 3;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#ffaa00';
            ctx.fill();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createFallbackTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512; // Larger size for better quality
        const ctx = canvas.getContext('2d');
        
        // Create a more sophisticated fallback texture
        const gradient = ctx.createRadialGradient(
            256, 256, 0,
            256, 256, 256
        );
        gradient.addColorStop(0, '#ffdd44');
        gradient.addColorStop(0.5, '#ffaa00');
        gradient.addColorStop(1, '#ff8800');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        
        // Add some noise for texture
        ctx.globalAlpha = 0.1;
        for (let i = 0; i < 1000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#ffaa00';
            ctx.fillRect(
                Math.random() * 512,
                Math.random() * 512,
                2,
                2
            );
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    setTimeScale(scale) {
        this.timeScale = scale;
    }

    getGroup() {
        return this.group;
    }

    dispose() {
        if (this.sunLight) {
            this.sunLight.dispose();
        }

        if (this.surface) {
            if (this.surface.geometry) {
                this.surface.geometry.dispose();
            }
            if (this.surface.material) {
                if (this.surface.material.map) {
                    this.surface.material.map.dispose();
                }
                this.surface.material.dispose();
            }
        }
    }
}