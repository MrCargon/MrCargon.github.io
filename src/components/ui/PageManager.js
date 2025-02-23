// PageManager.js
class PageManager {
    constructor() {
        this.currentPage = 'main';
        this.isTransitioning = false;
        this.pageTemplates = {
            main: 'src/components/pages/main.html',
            projects: 'src/components/section/section.html',
            about: 'src/components/pages/about.html',
            store: 'src/components/pages/store.html',
            contact: 'src/components/pages/contact.html'
        };
        
        this.setupNavigation();
        // Load default page after components are loaded
        this.loadPage('main');
    }

    setupNavigation() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.main-nav a');
            if (link) {
                e.preventDefault();
                const page = link.getAttribute('href').substring(1);
                this.handleNavigation(page);
            }
        });
    }

    async handleNavigation(targetPage) {
        if (this.isTransitioning || this.currentPage === targetPage) return;
        
        this.isTransitioning = true;
        const container = document.getElementById('section-container');
        
        // Fade out
        container.style.opacity = '0';
        container.style.transform = 'translateY(20px)';
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Load new content
        await this.loadPage(targetPage);
        
        // Fade in
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
        
        this.isTransitioning = false;
    }

    async loadPage(pageName) {
        if (!this.pageTemplates[pageName]) return;

        const container = document.getElementById('section-container');
        try {
            const response = await fetch(this.pageTemplates[pageName]);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();
            
            container.innerHTML = html;
            this.updateActiveNav(pageName);
            this.currentPage = pageName;
            
            // Initialize space exploration UI if on main page
            if (pageName === 'main') {
                this.initSpaceExploration();
            }
        } catch (error) {
            console.error('Error loading page:', error);
            container.innerHTML = '<div class="error-container">Failed to load page content</div>';
        }
    }

    updateActiveNav(pageName) {
        document.querySelectorAll('.main-nav a').forEach(link => {
            const href = link.getAttribute('href').substring(1);
            if (href === pageName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    initSpaceExploration() {
        // Initialize space exploration UI
        // This will be implemented when we create the space UI
        console.log('Space exploration UI initialized');
    }
}