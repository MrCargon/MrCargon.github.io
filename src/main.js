/**
 * ComponentLoader - Handles dynamic loading of HTML components
 * Optimized for GitHub Pages deployment with better error handling and performance
 */
class ComponentLoader {
    /**
     * Load a component HTML into a container element
     * @param {string} url - URL of the component HTML file
     * @param {string} containerId - ID of the container element
     * @param {number} retries - Number of retry attempts (default: 3)
     * @returns {Promise<boolean>} - Whether loading was successful
     */
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
                
                // Initialize any component-specific functionality
                if (containerId === 'header-container') {
                    ComponentLoader.initializeHeader();
                }
                
                return true;
            } catch (error) {
                console.error(`Attempt ${attempt + 1} failed for ${url}:`, error);
                attempt++;
                
                // Show error message after all retries fail
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

    /**
     * Update loading progress indicator
     * @param {number} progress - Progress percentage (0-100)
     */
    static updateLoadingProgress(progress) {
        const loadingScreen = window.loadingScreen;
        if (loadingScreen?.updateProgress) {
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
    
    /**
     * Initialize header-specific functionality
     * This centralizes header logic that was previously scattered
     */
    static initializeHeader() {
        // Apply active state to current page in navigation
        const currentPage = window.location.hash.substring(1) || 'about';
        const navLinks = document.querySelectorAll('.main-nav a');
        
        navLinks.forEach(link => {
            const pageName = link.getAttribute('href')?.substring(1);
            const isActive = pageName === currentPage;
            
            // Skip disabled links
            if (link.classList.contains('disabled')) return;
            
            // Set active state
            link.classList.toggle('active', isActive);
            link.setAttribute('aria-current', isActive ? 'page' : 'false');
            
            // Add accessibility improvements
            if (link.classList.contains('disabled')) {
                link.setAttribute('aria-disabled', 'true');
                link.tabIndex = -1;
            }
        });
    }
}

/**
 * Initialize application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    // Performance timer start
    const startTime = performance.now();
    
    // Create loading screen instance
    window.loadingScreen = new LoadingScreen();
    
    // Define components to load
    const components = [
        { url: 'src/components/header/header.html', id: 'header-container' },
        { url: 'src/components/pages/mainPage.html', id: 'page-container' },
        { url: 'src/components/footer/footer.html', id: 'footer-container' }
    ];
    
    let loadedCount = 0;
    
    // Load components with progress tracking
    Promise.all(
        components.map(comp => 
            ComponentLoader.loadComponent(comp.url, comp.id)
                .then(success => {
                    loadedCount++;
                    const progress = (loadedCount / components.length) * 100;
                    ComponentLoader.updateLoadingProgress(progress);
                    return success;
                })
        )
    ).then(results => {
        // Record components loaded time
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            window.perf = window.perf || {};
            window.perf.componentsLoaded = performance.now() - startTime;
        }
        
        // Check if all components loaded successfully
        const allLoaded = results.every(result => result === true);
        
        if (allLoaded) {
            // Initialize PageManager after components are loaded
            window.pageManager = new PageManager();
            
            // Hide loading screen with smooth transition
            setTimeout(() => {
                window.loadingScreen?.hide();
                document.getElementById('content')?.classList.remove('hidden');
            }, 300);
        } else {
            throw new Error('Some components failed to load');
        }
    }).catch(error => {
        console.error('Failed to initialize application:', error);
        window.loadingScreen?.setError('Failed to load application. Please refresh or try again later.');
    });
});

/**
 * Add performance monitoring in development mode
 */
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    // Initialize performance object
    window.perf = {
        domLoaded: 0,
        componentsLoaded: 0,
        pageReady: 0
    };
    
    document.addEventListener('DOMContentLoaded', () => {
        window.perf.domLoaded = performance.now();
    });
    
    window.addEventListener('load', () => {
        window.perf.pageReady = performance.now();
        
        console.log(`Performance metrics:
            - DOM Content Loaded: ${window.perf.domLoaded.toFixed(2)}ms
            - Components Loaded: ${window.perf.componentsLoaded?.toFixed(2) || 'N/A'}ms
            - Page Fully Loaded: ${window.perf.pageReady.toFixed(2)}ms
            - Total Load Time: ${(window.perf.pageReady - performance.timing.navigationStart).toFixed(2)}ms
        `);
    });
}