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
    
    enableControls(enabled) {
        this.controls.enabled = enabled;
    }
}