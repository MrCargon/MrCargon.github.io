// Example for Mars.js
class Mars extends Planet {
    constructor(scene, resourceLoader, data) {
        super(scene, resourceLoader, data);
        // Mars-specific initialization
    }
    
    // Mars-specific methods
}

// IMPORTANT: Make Mars globally available
window.Mars = Mars;