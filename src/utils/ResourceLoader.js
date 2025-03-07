// ResourceLoader.js - Handles texture loading and caching
class ResourceLoader {
    constructor() {
        this.textureLoader = new THREE.TextureLoader();
        this.textureCache = new Map();
        this.loadingPromises = new Map();
    }
    
    async loadTexture(path) {
        // Return from cache if available
        if (this.textureCache.has(path)) {
            return this.textureCache.get(path);
        }
        
        // Return existing promise if already loading
        if (this.loadingPromises.has(path)) {
            return this.loadingPromises.get(path);
        }
        
        // Start new load
        const promise = new Promise((resolve, reject) => {
            this.textureLoader.load(
                path,
                texture => {
                    this.textureCache.set(path, texture);
                    this.loadingPromises.delete(path);
                    resolve(texture);
                },
                undefined,
                error => {
                    this.loadingPromises.delete(path);
                    reject(error);
                }
            );
        });
        
        this.loadingPromises.set(path, promise);
        return promise;
    }
    
    purgeCache() {
        this.textureCache.forEach(texture => {
            texture.dispose();
        });
        this.textureCache.clear();
    }
}