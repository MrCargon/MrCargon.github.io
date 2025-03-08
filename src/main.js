// Optimized main.js - Component loading and application initialization

// Component Loader Class - improved with better error handling and performance
class ComponentLoader {
    static async loadComponent(url, containerId, retries = 3) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with ID "${containerId}" not found`);
            return false;
        }
        
        let attempt = 0;

        while (attempt < retries) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const html = await response.text();
                container.innerHTML = html;
                return true;
            } catch (error) {
                console.error(`Attempt ${attempt + 1} failed for ${url}:`, error);
                attempt++;
                
                if (attempt === retries) {
                    container.innerHTML = `
                        <div class="error-container">
                            <p>Failed to load content. <button onclick="ComponentLoader.loadComponent('${url}', '${containerId}')">Retry</button></p>
                        </div>
                    `;
                    return false;
                }
                
                // Exponential backoff for retries
                await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
            }
        }
    }

    static updateLoadingProgress(progress) {
        const loadingScreen = window.loadingScreen;
        if (loadingScreen) {
            loadingScreen.updateProgress(progress);
        } else {
            // Fallback if loadingScreen instance isn't available
            const progressBar = document.getElementById('loading-progress');
            if (progressBar) {
                progressBar.style.transform = `scaleX(${progress / 100})`;
                progressBar.style.transformOrigin = 'left';
            }
        }
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create loading screen instance
    window.loadingScreen = new LoadingScreen();
    
    // Define components to load with GitHub Pages-friendly paths
    // Make sure to use relative paths that work with your repository structure
    const components = [
        { url: 'src/components/header/header.html', id: 'header-container' },
        { url: 'src/components/pages/mainPage.html', id: 'page-container' },
        { url: 'src/components/footer/footer.html', id: 'footer-container' }
    ];
    
    let loadedCount = 0;
    
    // Load components with progress tracking and better error handling
    Promise.all(
        components.map(comp => 
            ComponentLoader.loadComponent(comp.url, comp.id)
                .then(success => {
                    loadedCount++;
                    const progress = (loadedCount / components.length) * 100;
                    ComponentLoader.updateLoadingProgress(progress);
                    console.log(`Loaded ${comp.url}: ${success ? 'Success' : 'Failed'} (${progress.toFixed(0)}%)`);
                    return success;
                })
                .catch(error => {
                    console.error(`Error loading ${comp.url}:`, error);
                    // Return false to indicate failure but don't break the Promise.all
                    return false;
                })
        )
    ).then(results => {
        // Check if all components loaded successfully
        const allLoaded = results.every(result => result === true);
        
        if (allLoaded) {
            try {
                // Initialize PageManager after components are loaded
                window.pageManager = new PageManager();
                
                // Hide loading screen with smooth transition
                setTimeout(() => {
                    window.loadingScreen.hide();
                    document.getElementById('content').classList.remove('hidden');
                }, 300);
            } catch (error) {
                console.error('Error initializing PageManager:', error);
                window.loadingScreen.setError('Failed to initialize application. Please refresh.');
            }
        } else {
            // Some components didn't load
            const failedComponents = components.filter((comp, index) => !results[index]);
            console.error('Failed to load components:', failedComponents.map(c => c.url).join(', '));
            window.loadingScreen.setError('Failed to load some components. Please refresh.');
        }
    }).catch(error => {
        console.error('Failed to initialize application:', error);
        window.loadingScreen.setError('Failed to load application. Please refresh or try again later.');
    });
});

// Add performance monitoring in development mode
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    // Simple performance monitoring
    const perf = {
        domLoaded: 0,
        componentsLoaded: 0,
        pageReady: 0
    };
    
    document.addEventListener('DOMContentLoaded', () => {
        perf.domLoaded = performance.now();
    });
    
    window.addEventListener('load', () => {
        perf.pageReady = performance.now();
        console.log(`Performance metrics:
            - DOM Content Loaded: ${perf.domLoaded.toFixed(2)}ms
            - Components Loaded: ${perf.componentsLoaded.toFixed(2)}ms
            - Page Fully Loaded: ${perf.pageReady.toFixed(2)}ms
            - Total Load Time: ${(perf.pageReady - performance.timing.navigationStart).toFixed(2)}ms
        `);
    });
}