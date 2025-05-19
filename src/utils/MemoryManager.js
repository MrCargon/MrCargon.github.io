// MemoryManager.js - Handles cleaning up resources
class MemoryManager {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.disposables = [];
    }
    
    track(object) {
        this.disposables.push(object);
    }
    
    cleanUp() {
        // Track cleanup metrics
        const startTime = performance.now();
        let geometriesDisposed = 0;
        let materialsDisposed = 0;
        let texturesDisposed = 0;

        // Systematically dispose tracked objects
        this.disposables.forEach(obj => {
            if (obj.dispose) {
                obj.dispose();
            }
        });
        
        // Clear the tracking list
        this.disposables = [];
        
        // Dispose scene objects with metrics tracking
        this.disposeSceneObjects(this.scene, {
            onGeometryDisposed: () => geometriesDisposed++,
            onMaterialDisposed: () => materialsDisposed++,
            onTextureDisposed: () => texturesDisposed++
        });
        
        // Force renderer to release memory
        this.renderer.dispose();
        
        // Log cleanup metrics
        console.debug(`Memory cleanup complete in ${(performance.now() - startTime).toFixed(2)}ms:
            - Geometries disposed: ${geometriesDisposed}
            - Materials disposed: ${materialsDisposed}
            - Textures disposed: ${texturesDisposed}`);
    }
    
    disposeSceneObjects(obj, callbacks = {}) {
        if (!obj) return;
        
        // Get callbacks
        const { 
            onGeometryDisposed = () => {}, 
            onMaterialDisposed = () => {}, 
            onTextureDisposed = () => {} 
        } = callbacks;
        
        // Dispose children first
        if (obj.children) {
            while (obj.children.length > 0) {
                this.disposeSceneObjects(obj.children[0], callbacks);
                obj.remove(obj.children[0]);
            }
        }
        
        // Dispose geometries
        if (obj.geometry) {
            obj.geometry.dispose();
            onGeometryDisposed();
        }
        
        // Dispose materials
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(material => {
                    this.disposeMaterial(material, onTextureDisposed);
                    onMaterialDisposed();
                });
            } else {
                this.disposeMaterial(obj.material, onTextureDisposed);
                onMaterialDisposed();
            }
        }
    }
    
    disposeMaterial(material, onTextureDisposed = () => {}) {
        if (!material) return;
        
        // Dispose textures
        Object.keys(material).forEach(prop => {
            if (!material[prop]) return;
            if (material[prop].isTexture) {
                material[prop].dispose();
                onTextureDisposed();
            }
        });
        
        // Dispose material
        material.dispose();
    }
}