// Sun.js - Enhanced implementation of the Sun with special effects
class Sun {
    constructor(scene, resourceLoader, data) {
        this.scene = scene;
        this.resourceLoader = resourceLoader;
        this.data = data;
        this.mesh = null;
        this.light = null;
        this.corona = null;
        this.flares = [];
        this.animationTime = 0;
        
        // Corona settings
        this.coronaSize = this.data.radius * 1.5;
        
        // Solar flare settings
        this.flareCount = 3;
        this.flareSize = this.data.radius * 0.3;
        this.flareCycleTime = 10; // seconds for a complete flare cycle
    }
    
    async init() {
        try {
            console.log(`Initializing Sun with radius ${this.data.radius}`);
            
            // Load texture with fallback
            let texture;
            try {
                texture = await this.resourceLoader.loadTexture(this.data.texturePath);
                console.log("Sun texture loaded successfully");
            } catch (error) {
                console.warn("Failed to load sun texture, using fallback:", error);
                // Create a fallback procedural texture
                texture = this.createFallbackTexture();
            }
            
            // Create a material that works with the sun's emissive properties
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                color: 0xffdd66,
                transparent: true,
                opacity: 1.0
            });
            
            // Create the sun mesh
            const geometry = new THREE.SphereGeometry(this.data.radius, 64, 64);
            this.mesh = new THREE.Mesh(geometry, material);
            
            // Add to scene
            this.scene.add(this.mesh);
            
            // Create light source
            this.createLight();
            
            // Create corona effect
            this.createCorona();
            
            // Create solar flares
            this.createSolarFlares();
            
            console.log("Sun initialized successfully");
            return true;
        } catch (error) {
            console.error('Failed to initialize Sun:', error);
            return false;
        }
    }
    
    createFallbackTexture() {
        // Create a dynamic canvas texture for the sun
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Fill with gradient
        const gradient = ctx.createRadialGradient(
            256, 256, 0,
            256, 256, 256
        );
        gradient.addColorStop(0, '#ffff80');
        gradient.addColorStop(0.5, '#ffdd55');
        gradient.addColorStop(1, '#ff8800');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        
        // Add some noise for texture
        for (let i = 0; i < 5000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const size = Math.random() * 3 + 1;
            const alpha = Math.random() * 0.2;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fill();
        }
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        return texture;
    }
    
    createLight() {
        // Point light at the center of the sun
        this.light = new THREE.PointLight(0xffffee, 2, 1000);
        this.mesh.add(this.light);
        
        // Add an ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.2);
        this.mesh.add(ambientLight);
        
        console.log("Sun light sources created");
    }
    
    createCorona() {
        // Create a corona glow effect
        const coronaGeometry = new THREE.SphereGeometry(this.coronaSize, 32, 32);
        const coronaMaterial = new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: new THREE.Color(0xffffaa) },
                viewVector: { value: new THREE.Vector3(0, 0, 1) }
            },
            vertexShader: `
                uniform vec3 viewVector;
                varying float intensity;
                void main() {
                    vec3 vNormal = normalize(normalMatrix * normal);
                    intensity = pow(0.5 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 glowColor;
                varying float intensity;
                void main() {
                    vec3 glow = glowColor * intensity;
                    gl_FragColor = vec4(glow, 1.0);
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true
        });
        
        this.corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
        this.mesh.add(this.corona);
        
        console.log("Sun corona effect created");
    }
    
    createSolarFlares() {
        // Create several solar flare effects
        for (let i = 0; i < this.flareCount; i++) {
            // Create a curved line for the flare
            const curve = new THREE.QuadraticBezierCurve3(
                new THREE.Vector3(this.data.radius, 0, 0),
                new THREE.Vector3(this.data.radius * 1.3, this.flareSize, 0),
                new THREE.Vector3(this.data.radius * 1.2, this.flareSize * 1.5, 0)
            );
            
            const points = curve.getPoints(20);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            
            const material = new THREE.LineBasicMaterial({
                color: 0xffaa00,
                linewidth: 3,
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending
            });
            
            const flare = new THREE.Line(geometry, material);
            
            // Random rotation
            flare.rotation.y = Math.random() * Math.PI * 2;
            flare.rotation.z = Math.random() * Math.PI * 0.5;
            
            // Store animation phase
            flare.userData.phase = Math.random() * Math.PI * 2;
            
            this.flares.push(flare);
            this.mesh.add(flare);
        }
        
        console.log(`Created ${this.flareCount} solar flares`);
    }
    
    update(deltaTime) {
        // Update animation time
        this.animationTime += deltaTime;
        
        // Rotate the sun
        if (this.mesh) {
            this.mesh.rotation.y += 0.0005 * deltaTime;
        }
        
        // Animate corona
        if (this.corona) {
            // Pulse the corona size slightly
            const scale = 1 + Math.sin(this.animationTime * 0.2) * 0.05;
            this.corona.scale.set(scale, scale, scale);
        }
        
        // Animate solar flares
        for (let i = 0; i < this.flares.length; i++) {
            const flare = this.flares[i];
            
            // Each flare has its own phase in the animation cycle
            const phase = flare.userData.phase;
            
            // Calculate opacity based on time for a pulsing effect
            const cyclePosition = (this.animationTime + phase) % this.flareCycleTime / this.flareCycleTime;
            const opacity = Math.sin(cyclePosition * Math.PI) * 0.7;
            
            // Update flare opacity
            flare.material.opacity = Math.max(0.1, opacity);
            
            // Rotate flares slightly for more dynamic look
            flare.rotation.y += 0.001 * deltaTime;
        }
    }
    
    getMesh() {
        return this.mesh;
    }
    
    dispose() {
        // Clean up resources
        if (this.mesh) {
            if (this.mesh.material) {
                if (this.mesh.material.map) {
                    this.mesh.material.map.dispose();
                }
                this.mesh.material.dispose();
            }
            this.mesh.geometry.dispose();
        }
        
        if (this.corona && this.corona.material) {
            this.corona.material.dispose();
            this.corona.geometry.dispose();
        }
        
        for (const flare of this.flares) {
            if (flare.material) {
                flare.material.dispose();
            }
            if (flare.geometry) {
                flare.geometry.dispose();
            }
        }
        
        this.flares = [];
    }
}

// Make sure Sun is globally available
window.Sun = Sun;