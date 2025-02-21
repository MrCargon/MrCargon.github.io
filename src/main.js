// Component Loader Class
class ComponentLoader {
    static async loadComponent(url, containerId, retries = 3) {
        const container = document.getElementById(containerId);
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
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
            }
        }
        
    }

    static updateLoadingProgress(progress) {
        const progressBar = document.getElementById('loading-progress');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }
}

// Initialize loading
document.addEventListener('DOMContentLoaded', () => {
    const components = [
        { url: 'src/components/header/header.html', id: 'header-container' },
        { url: 'src/components/section/section.html', id: 'section-container' },
        { url: 'src/components/footer/footer.html', id: 'footer-container' }
    ];
    
    let loadedCount = 0;
    
    // Load components with progress tracking
    Promise.all(
        components.map(comp => 
            ComponentLoader.loadComponent(comp.url, comp.id)
                .then(() => {
                    loadedCount++;
                    ComponentLoader.updateLoadingProgress((loadedCount / components.length) * 100);
                })
        )
    ).then(() => {
        // Hide loading screen with smooth transition
        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            const content = document.getElementById('content');
            
            loadingScreen.classList.add('fade-out');
            content.classList.remove('hidden');
            
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }, 300);
    }).catch(error => {
        console.error('Error loading components:', error);
    });
});

