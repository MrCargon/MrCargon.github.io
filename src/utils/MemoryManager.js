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
        // Dispose all tracked objects
        this.disposables.forEach(obj => {
            if (obj.dispose) {
                obj.dispose();
            }
        });
        
        // Clear the list
        this.disposables = [];
        
        // Dispose scene objects
        this.disposeSceneObjects(this.scene);
        
        // Force renderer to release memory
        this.renderer.dispose();
        
        // Suggest garbage collection
        if (window.gc) {
            window.gc();
        }
    }
    
    disposeSceneObjects(obj) {
        if (!obj) return;
        
        // Dispose children first
        if (obj.children) {
            while (obj.children.length > 0) {
                this.disposeSceneObjects(obj.children[0]);
                obj.remove(obj.children[0]);
            }
        }
        
        // Dispose geometries
        if (obj.geometry) {
            obj.geometry.dispose();
        }
        
        // Dispose materials
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(material => this.disposeMaterial(material));
            } else {
                this.disposeMaterial(obj.material);
            }
        }
    }
    
    disposeMaterial(material) {
        if (!material) return;
        
        // Dispose textures
        Object.keys(material).forEach(prop => {
            if (!material[prop]) return;
            if (material[prop].isTexture) {
                material[prop].dispose();
            }
        });
        
        // Dispose material
        material.dispose();
    }
}