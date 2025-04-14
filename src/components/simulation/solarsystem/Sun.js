// Sun.js - Scientifically realistic Sun implementation
class Sun {
    constructor(scene, resourceLoader, data) {
        this.scene = scene;
        this.resourceLoader = resourceLoader;
        this.data = data;
        this.mesh = null;
        this.light = null;
        this.corona = null;
        this.flares = [];
        this.prominences = [];
        this.sunspots = [];
        this.animationTime = 0;
        
        // Scientific parameters
        this.surfaceTemperature = 5778; // Kelvin
        this.coronaTemperature = 1000000; // Kelvin
        
        // Visual settings
        this.coronaSize = this.data.radius * 2.5; // More extensive corona
        this.coronaDensity = 0.8;
        
        // Solar features
        this.flareCount = 5;
        this.flareSize = this.data.radius * 0.4;
        this.flareCycleTime = 15; // seconds for a complete flare cycle
        
        this.prominenceCount = 8;
        this.prominenceSize = this.data.radius * 0.3;
        
        this.sunspotCount = 12;
        this.sunspotMaxSize = this.data.radius * 0.1;
        
        // Differential rotation (realistic)
        this.equatorialRotationPeriod = 25; // days at equator
        this.polarRotationPeriod = 35; // days at poles
    }
    
    async init() {
        try {
            console.log(`Initializing Sun with radius ${this.data.radius}`);
            
            // Try to load texture with fallback
            let texture;
            try {
                texture = await this.resourceLoader.loadTexture(this.data.texturePath);
                console.log("Sun texture loaded successfully");
            } catch (error) {
                console.warn("Failed to load sun texture, using scientifically accurate fallback:", error);
                texture = this.createScientificSolarTexture();
            }
            
            // Create the photosphere (visible surface)
            this.createPhotosphere(texture);
            
            // Create sunspots
            this.createSunspots();
            
            // Create chromosphere (lower atmosphere layer)
            this.createChromosphere();
            
            // Create light source
            this.createLight();
            
            // Create scientifically accurate corona
            this.createCorona();
            
            // Create prominences (plasma loops)
            this.createProminences();
            
            // Create solar flares
            this.createSolarFlares();
            
            console.log("Scientific Sun initialized successfully");
            return true;
        } catch (error) {
            console.error('Failed to initialize Sun:', error);
            return false;
        }
    }
    
    createScientificSolarTexture() {
        // Create a scientifically accurate solar texture
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Base color (photosphere) - yellowish with proper color temperature
        const baseColor = this.getTemperatureColor(this.surfaceTemperature);
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add granulation (convection cells)
        this.addGranulation(ctx, canvas.width, canvas.height);
        
        // Add limb darkening (edges appear darker)
        this.addLimbDarkening(ctx, canvas.width, canvas.height);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        return texture;
    }
    
    addGranulation(ctx, width, height) {
        // Simulate solar granulation (convection cells)
        const granuleCount = 2000;
        const maxGranuleSize = 20; // pixels
        
        for (let i = 0; i < granuleCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * maxGranuleSize + 5;
            
            // Granules are slightly brighter than surrounding areas
            const brightness = Math.random() * 30 + 10;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${brightness/255})`;
            ctx.fill();
        }
    }
    
    addLimbDarkening(ctx, width, height) {
        // Scientific limb darkening effect (sun appears darker at edges)
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = width / 2;
        
        // Create radial gradient for limb darkening
        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, radius
        );
        
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
    
    createPhotosphere(texture) {
        // Create the visible surface layer (photosphere)
        const geometry = new THREE.SphereGeometry(this.data.radius, 128, 128);
        
        // Use MeshStandardMaterial for better lighting
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            emissive: 0xffdd66,
            emissiveIntensity: 1.0,
            emissiveMap: texture,
            roughness: 1.0,
            metalness: 0.0
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
    }
    
    createSunspots() {
        for (let i = 0; i < this.sunspotCount; i++) {
            // Sunspots appear mainly in mid-latitudes, not at poles or equator
            const latitude = (Math.random() * 60 - 30) * Math.PI / 180;
            const longitude = Math.random() * Math.PI * 2;
            
            // Size varies with solar cycle
            const spotSize = Math.random() * this.sunspotMaxSize + this.data.radius * 0.02;
            
            // Create spot geometry (slightly inset from surface)
            const spotGeometry = new THREE.CircleGeometry(spotSize, 32);
            const spotMaterial = new THREE.MeshBasicMaterial({
                color: 0x663300,
                transparent: true,
                opacity: 0.7,
                side: THREE.FrontSide
            });
            
            const spot = new THREE.Mesh(spotGeometry, spotMaterial);
            
            // Position on sphere surface
            spot.position.set(
                Math.cos(latitude) * Math.cos(longitude) * (this.data.radius + 0.01),
                Math.sin(latitude) * (this.data.radius + 0.01),
                Math.cos(latitude) * Math.sin(longitude) * (this.data.radius + 0.01)
            );
            
            // Orient to face outward
            spot.lookAt(0, 0, 0);
            spot.rotateX(Math.PI); // Flip to face outward
            
            this.sunspots.push(spot);
            this.mesh.add(spot);
        }
    }
    
    createChromosphere() {
        // Chromosphere - thin reddish layer above photosphere
        const chromoGeometry = new THREE.SphereGeometry(
            this.data.radius * 1.01, 64, 64
        );
        
        const chromoMaterial = new THREE.MeshBasicMaterial({
            color: 0xff5500,
            transparent: true,
            opacity: 0.2,
            side: THREE.FrontSide
        });
        
        const chromosphere = new THREE.Mesh(chromoGeometry, chromoMaterial);
        this.mesh.add(chromosphere);
    }
    
    createLight() {
        // Scientific values for solar illumination
        this.light = new THREE.PointLight(0xffffff, 2, 1000);
        this.mesh.add(this.light);
        
        // Add ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.2);
        this.mesh.add(ambientLight);
    }
    
    createCorona() {
        // Create a more scientifically accurate corona effect
        const coronaGeometry = new THREE.SphereGeometry(this.coronaSize, 64, 64);
        
        // Complex shader for realistic corona appearance
        const coronaMaterial = new THREE.ShaderMaterial({
            uniforms: {
                coronaDensity: { value: this.coronaDensity },
                glowColor: { value: new THREE.Color(0xffeedd) },
                time: { value: 0.0 },
                sunSize: { value: this.data.radius }
            },
            vertexShader: `
                uniform float time;
                varying vec3 vPosition;
                varying vec3 vNormal;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 glowColor;
                uniform float coronaDensity;
                uniform float sunSize;
                uniform float time;
                
                varying vec3 vPosition;
                varying vec3 vNormal;
                
                float noise(vec3 p) {
                    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
                }
                
                void main() {
                    // Calculate distance from center
                    float dist = length(vPosition) / sunSize;
                    
                    // Corona density decreases with square of distance (scientific)
                    float density = 1.0 / (dist * dist);
                    density *= coronaDensity;
                    
                    // Add some noise to make it less uniform
                    vec3 noisePos = vPosition * 0.05 + vec3(0.0, 0.0, time * 0.1);
                    float noiseVal = noise(noisePos) * 0.3 + 0.7;
                    
                    // Adjust intensity based on angle (limb brightening effect)
                    float vface = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
                    
                    // Combine factors
                    float intensity = density * vface * noiseVal;
                    intensity = clamp(intensity, 0.0, 1.0);
                    
                    // Output color
                    gl_FragColor = vec4(glowColor * intensity, intensity);
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });
        
        this.corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
        this.mesh.add(this.corona);
    }
    
    createProminences() {
        // Create solar prominences (plasma arcs along the limb)
        for (let i = 0; i < this.prominenceCount; i++) {
            // Random position around the sun
            const angle = Math.random() * Math.PI * 2;
            
            // Prominences follow magnetic field lines
            const points = [];
            const segments = 30;
            
            for (let j = 0; j <= segments; j++) {
                const t = j / segments;
                
                // Calculate a point on the arc
                const h = this.prominenceSize * Math.sin(t * Math.PI); // Height
                const r = this.data.radius + h * 0.2; // Radius
                const a = angle + (Math.PI * 0.4) * (t - 0.5); // Angle variation
                
                points.push(new THREE.Vector3(
                    r * Math.cos(a),
                    h,
                    r * Math.sin(a)
                ));
            }
            
            // Create the curve
            const curve = new THREE.CatmullRomCurve3(points);
            const geometry = new THREE.TubeGeometry(curve, 20, this.data.radius * 0.01, 8, false);
            
            // Glowing material
            const material = new THREE.MeshBasicMaterial({
                color: 0xff3300,
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending
            });
            
            const prominence = new THREE.Mesh(geometry, material);
            
            // Random rotation around y-axis
            prominence.rotation.y = Math.random() * Math.PI * 2;
            
            // Random animation phase
            prominence.userData.phase = Math.random() * Math.PI * 2;
            
            this.prominences.push(prominence);
            this.mesh.add(prominence);
        }
    }
    
    createSolarFlares() {
        // Create more scientifically accurate solar flares
        for (let i = 0; i < this.flareCount; i++) {
            // Flares follow magnetic field lines from sunspot regions
            const curve = new THREE.CubicBezierCurve3(
                new THREE.Vector3(this.data.radius, 0, 0),
                new THREE.Vector3(this.data.radius * 1.5, this.flareSize * 0.7, 0),
                new THREE.Vector3(this.data.radius * 1.2, this.flareSize, 0),
                new THREE.Vector3(this.data.radius * 1.3, this.flareSize * 0.5, 0)
            );
            
            const points = curve.getPoints(30);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            
            // Create glow effect for flare
            const material = new THREE.LineBasicMaterial({
                color: 0xff8800,
                linewidth: 5,
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending
            });
            
            const flare = new THREE.Line(geometry, material);
            
            // Random rotation
            flare.rotation.y = Math.random() * Math.PI * 2;
            flare.rotation.z = (Math.random() * 0.5 - 0.25) * Math.PI;
            
            // Store animation phase
            flare.userData.phase = Math.random() * Math.PI * 2;
            flare.userData.lifetime = 5 + Math.random() * 10; // seconds
            
            this.flares.push(flare);
            this.mesh.add(flare);
        }
    }
    
    update(deltaTime) {
        // Update animation time
        this.animationTime += deltaTime;
        
        // Update differential rotation (scientifically accurate)
        if (this.mesh) {
            // Base rotation speed (equatorial)
            const equatorialSpeed = (2 * Math.PI) / (this.equatorialRotationPeriod * 24 * 60 * 60);
            this.mesh.rotation.y += equatorialSpeed * deltaTime;
            
            // Sunspots rotate at different rates based on latitude
            this.updateSunspotRotation(deltaTime);
        }
        
        // Animate corona
        if (this.corona && this.corona.material && this.corona.material.uniforms) {
            // Update time uniform for corona shader
            this.corona.material.uniforms.time.value = this.animationTime;
        }
        
        // Animate solar flares
        this.updateFlares(deltaTime);
        
        // Animate prominences
        this.updateProminences(deltaTime);
    }
    
    updateSunspotRotation(deltaTime) {
        // Implement differential rotation for sunspots
        for (const spot of this.sunspots) {
            // Extract current position
            const pos = spot.position.clone().normalize();
            
            // Calculate latitude (0 at equator, PI/2 at poles)
            const latitude = Math.asin(pos.y / this.data.radius);
            
            // Differential rotation equation (faster at equator, slower at poles)
            const rotationOffset = Math.cos(latitude) * Math.cos(latitude) * 0.0001 * deltaTime;
            
            // Apply additional rotation based on latitude
            const rotMatrix = new THREE.Matrix4().makeRotationY(rotationOffset);
            spot.position.applyMatrix4(rotMatrix);
            
            // Keep spots facing outward
            spot.lookAt(0, 0, 0);
            spot.rotateX(Math.PI);
        }
    }
    
    updateFlares(deltaTime) {
        // Realistic flare behavior (eruptions followed by cooling)
        for (let i = 0; i < this.flares.length; i++) {
            const flare = this.flares[i];
            
            // Calculate flare life cycle
            const phase = flare.userData.phase;
            const lifetime = flare.userData.lifetime;
            const cyclePosition = ((this.animationTime + phase) % (lifetime * 2)) / lifetime;
            
            // Flares appear suddenly and fade gradually (realistic behavior)
            let opacity;
            if (cyclePosition < 1.0) {
                // Active phase - quick rise, slow fall
                opacity = cyclePosition < 0.2 ? 
                    cyclePosition * 5 : // Quick rise
                    1.0 - (cyclePosition - 0.2) * 1.25; // Gradual fall
            } else {
                // Inactive phase
                opacity = 0;
            }
            
            // Update flare opacity
            flare.material.opacity = Math.max(0, opacity);
            
            // Occasionally replace inactive flares with new ones
            if (opacity === 0 && Math.random() < 0.005) {
                // Remove old flare
                this.mesh.remove(flare);
                
                // Create a new flare in a different position
                const newAngle = Math.random() * Math.PI * 2;
                flare.rotation.y = newAngle;
                flare.rotation.z = (Math.random() * 0.5 - 0.25) * Math.PI;
                
                // Reset animation phase
                flare.userData.phase = this.animationTime;
                flare.userData.lifetime = 5 + Math.random() * 10;
                
                // Add back to mesh
                this.mesh.add(flare);
            }
        }
    }
    
    updateProminences(deltaTime) {
        // Animate prominences
        for (const prominence of this.prominences) {
            const phase = prominence.userData.phase;
            
            // Prominences slowly change shape
            const scale = 0.8 + Math.sin(this.animationTime * 0.1 + phase) * 0.2;
            prominence.scale.set(1, scale, 1);
            
            // Slight rotation to simulate plasma flow
            prominence.rotation.y += 0.0002 * deltaTime;
            
            // Pulsing opacity
            prominence.material.opacity = 0.3 + Math.sin(this.animationTime * 0.2 + phase) * 0.2;
        }
    }
    
    getTemperatureColor(temperature) {
        // Convert temperature to RGB using blackbody radiation formula
        // Simplified version of actual physics
        let r, g, b;
        
        temperature = temperature / 100;
        
        if (temperature <= 66) {
            r = 255;
            g = temperature;
            g = 99.4708025861 * Math.log(g) - 161.1195681661;
            if (temperature <= 19) {
                b = 0;
            } else {
                b = temperature - 10;
                b = 138.5177312231 * Math.log(b) - 305.0447927307;
            }
        } else {
            r = temperature - 60;
            r = 329.698727446 * Math.pow(r, -0.1332047592);
            g = temperature - 60;
            g = 288.1221695283 * Math.pow(g, -0.0755148492);
            b = 255;
        }
        
        r = Math.min(255, Math.max(0, Math.round(r)));
        g = Math.min(255, Math.max(0, Math.round(g)));
        b = Math.min(255, Math.max(0, Math.round(b)));
        
        return `rgb(${r}, ${g}, ${b})`;
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
        
        // Clean up flares
        for (const flare of this.flares) {
            if (flare.material) {
                flare.material.dispose();
            }
            if (flare.geometry) {
                flare.geometry.dispose();
            }
        }
        
        // Clean up prominences
        for (const prominence of this.prominences) {
            if (prominence.material) {
                prominence.material.dispose();
            }
            if (prominence.geometry) {
                prominence.geometry.dispose();
            }
        }
        
        // Clean up sunspots
        for (const spot of this.sunspots) {
            if (spot.material) {
                spot.material.dispose();
            }
            if (spot.geometry) {
                spot.geometry.dispose();
            }
        }
        
        this.flares = [];
        this.prominences = [];
        this.sunspots = [];
    }
}

// Make sure Sun is globally available
window.Sun = Sun;