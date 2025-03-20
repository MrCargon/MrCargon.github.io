// CameraController.js - Handles camera movement and effects
class CameraController {
    constructor(camera, controls) {
        this.camera = camera;
        this.controls = controls;
        this.targetPosition = new THREE.Vector3();
        this.isTransitioning = false;
        this.transitionDuration = 2000; // ms
        this.transitionStartTime = 0;
        this.startPosition = new THREE.Vector3();
        this.startRotation = new THREE.Euler();
        
        // Planet positions - could be moved to a configuration file
        this.planetPositions = {
            Sun: new THREE.Vector3(0, 0, 0),
            Mercury: new THREE.Vector3(10, 0, 0),
            Venus: new THREE.Vector3(20, 0, 0),
            Earth: new THREE.Vector3(30, 0, 0),
            Mars: new THREE.Vector3(40, 0, 0),
            Jupiter: new THREE.Vector3(60, 0, 0),
            Saturn: new THREE.Vector3(80, 0, 0),
            Uranus: new THREE.Vector3(100, 0, 0),
            Neptune: new THREE.Vector3(120, 0, 0)
        };
    }
    
    moveTo(position, lookAt, duration = null) {
        if (this.isTransitioning) return false;
        
        this.isTransitioning = true;
        this.transitionStartTime = Date.now();
        this.transitionDuration = duration || this.transitionDuration;
        
        // Store start position/rotation
        this.startPosition.copy(this.camera.position);
        this.startRotation.copy(this.camera.rotation);
        
        // Set target position
        this.targetPosition.copy(position);
        this.targetLookAt = lookAt;
        
        return true;
    }
    
    update() {
        if (!this.isTransitioning) return;
        
        const elapsed = Date.now() - this.transitionStartTime;
        const progress = Math.min(elapsed / this.transitionDuration, 1);
        
        // Ease function (cubic)
        const ease = t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        const easedProgress = ease(progress);
        
        // Move camera
        this.camera.position.lerpVectors(this.startPosition, this.targetPosition, easedProgress);
        
        // Look at target
        if (this.targetLookAt) {
            this.camera.lookAt(this.targetLookAt);
        }
        
        // End transition
        if (progress >= 1) {
            this.isTransitioning = false;
            this.controls.target.copy(this.targetLookAt);
        }
    }
    
    resetView() {
        return this.moveTo(
            new THREE.Vector3(0, 30, 100),
            new THREE.Vector3(0, 0, 0)
        );
    }
    
    /**
     * Focus on Earth at a good viewing distance
     * @param {number} duration - Transition duration in ms (optional)
     * @returns {boolean} - Whether the transition started
     */
    focusOnEarth(duration = null) {
        const earthPosition = this.planetPositions.Earth;
        // Position camera at a good viewing angle for Earth
        // Slightly above and to the side
        const cameraPosition = new THREE.Vector3(
            earthPosition.x + 15, 
            earthPosition.y + 10, 
            earthPosition.z + 15
        );
        
        return this.moveTo(cameraPosition, earthPosition, duration);
    }
    
    /**
     * Focus on a specific planet
     * @param {string} planetName - Name of the planet (Sun, Mercury, Venus, etc.)
     * @param {number} duration - Transition duration in ms (optional)
     * @returns {boolean} - Whether the transition started
     */
    focusOnPlanet(planetName, duration = null) {
        if (!this.planetPositions[planetName]) {
            console.error(`Planet "${planetName}" not found`);
            return false;
        }
        
        const planetPosition = this.planetPositions[planetName];
        // Position camera at a good viewing angle based on planet's distance from sun
        const distanceMultiplier = planetName === 'Sun' ? 1 : 0.5;
        const distance = planetPosition.length() * distanceMultiplier || 15;
        
        const cameraPosition = new THREE.Vector3(
            planetPosition.x + distance,
            planetPosition.y + distance * 0.5,
            planetPosition.z + distance
        );
        
        return this.moveTo(cameraPosition, planetPosition, duration);
    }
    
    enableControls(enabled) {
        this.controls.enabled = enabled;
    }
}