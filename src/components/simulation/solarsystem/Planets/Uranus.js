// Example for Uranus.js
class Uranus extends Planet {
    constructor(scene, resourceLoader, data) {
        super(scene, resourceLoader, data);
        // Uranus-specific initialization
    }
    
    // Uranus-specific methods
}

// IMPORTANT: Make Uranus globally available
window.Uranus = Uranus;