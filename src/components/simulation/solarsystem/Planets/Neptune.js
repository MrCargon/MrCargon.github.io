// Example for Neptune.js
class Neptune extends Planet {
    constructor(scene, resourceLoader, data) {
        super(scene, resourceLoader, data);
        // Neptune-specific initialization
    }
    
    // Neptune-specific methods
}

// IMPORTANT: Make Neptune globally available
window.Neptune = Neptune;