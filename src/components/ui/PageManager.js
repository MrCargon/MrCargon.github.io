// PageManager.js
class PageManager {
    constructor() {
        this.contentContainer = document.getElementById('page-container');
        this.pageCache = new Map();
        this.currentPage = null;
        this.isTransitioning = false;
        
        // Define page templates and their metadata
        this.pages = {
            main: {
                path: 'src/components/pages/mainPage.html',
                title: 'Home',
                init: () => this.initMainPage()
            },
            projects: {
                path: 'src/components/pages/projectsPage.html',
                title: 'Projects',
                init: () => this.initProjectsPage()
            },
            about: {
                path: 'src/components/pages/aboutPage.html',
                title: 'About',
                init: () => this.initAboutPage()
            },
            store: {
                path: 'src/components/pages/storePage.html',
                title: 'Store',
                init: () => this.initStorePage()
            },
            contact: {
                path: 'src/components/pages/contactPage.html',
                title: 'Contact',
                init: () => this.initContactPage()
            }
        };

        this.setupRouting();
        this.handleInitialRoute();
    }

    setupRouting() {
        // Handle navigation clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.main-nav a');
            if (link) {
                e.preventDefault();
                
                // Check if the link is disabled
                if (link.classList.contains('disabled')) {
                    // Do not navigate if the link is disabled
                    console.log('Navigation prevented: This feature is coming soon.');
                    return;
                }
                
                const pageName = link.getAttribute('href').substring(1);
                this.navigateToPage(pageName);
            }
        });
    
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            const pageName = e.state?.page || 'main';
            this.navigateToPage(pageName, false);
        });
    }

    handleInitialRoute() {
        const hash = window.location.hash.substring(1) || 'about';
        this.navigateToPage(hash, false);
    }

    async navigateToPage(pageName, updateHistory = true) {
        if (this.isTransitioning || !this.pages[pageName] || pageName === this.currentPage) {
            return;
        }

        this.isTransitioning = true;

        // Update browser history
        if (updateHistory) {
            window.history.pushState({ page: pageName }, '', `#${pageName}`);
        }

        try {
            // Start transition
            await this.startPageTransition();

            // Load and render page content
            await this.loadAndRenderPage(pageName);

            // Update UI state
            this.updateUIState(pageName);

            // Complete transition
            await this.completePageTransition();
        } catch (error) {
            console.error('Navigation error:', error);
            this.handleNavigationError();
        }

        this.isTransitioning = false;
    }

    async startPageTransition() {
        if (this.contentContainer) {
            this.contentContainer.style.opacity = '0';
            this.contentContainer.style.transform = 'translateY(20px)';
            return new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    async loadAndRenderPage(pageName) {
        const pageConfig = this.pages[pageName];
        let content;

        // Check cache first
        if (this.pageCache.has(pageName)) {
            content = this.pageCache.get(pageName);
        } else {
            // Load page content
            const response = await fetch(pageConfig.path);
            if (!response.ok) {
                throw new Error(`Failed to load ${pageName} page`);
            }
            content = await response.text();
            this.pageCache.set(pageName, content);
        }

        // Render content
        if (this.contentContainer) {
            this.contentContainer.innerHTML = content;
            // Initialize page-specific functionality
            if (pageConfig.init) {
                await pageConfig.init();
            }
        }
    }

    updateUIState(pageName) {
        // Update active navigation state
        document.querySelectorAll('.main-nav a').forEach(link => {
            const href = link.getAttribute('href').substring(1);
            link.classList.toggle('active', href === pageName);
        });

        // Update document title
        document.title = `${this.pages[pageName].title} - MrCargo Portfolio`;
        
        this.currentPage = pageName;
    }

    async completePageTransition() {
        if (this.contentContainer) {
            this.contentContainer.style.opacity = '1';
            this.contentContainer.style.transform = 'translateY(0)';
            return new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    handleNavigationError() {
        if (this.contentContainer) {
            this.contentContainer.innerHTML = `
                <div class="error-container">
                    <h2>Navigation Error</h2>
                    <p>Failed to load the requested page. Please try again.</p>
                    <button onclick="window.location.reload()">Reload Page</button>
                </div>
            `;
        }
    }

    // Page-specific initialization methods
    async initMainPage() {
        // Initialize main page specific features
        console.log('Initializing main page');
        // Here you can add the space exploration UI initialization
        if (window.spaceExploration) {
            await window.spaceExploration.init();
        }
    }

    async initProjectsPage() {
        console.log('Initializing projects page');
        
        // Add event listeners to project navigation buttons
        const projectNavButtons = document.querySelectorAll('.side-nav .nav-button');
        
        projectNavButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all buttons
                projectNavButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                button.classList.add('active');
                
                // Get the target project ID from the href attribute
                const targetId = button.getAttribute('href');
                
                // Find the target project element
                const targetProject = document.querySelector(targetId);
                
                if (targetProject) {
                    // Smooth scroll to the project
                    targetProject.scrollIntoView({ 
                        behavior: 'smooth',
                        block: 'start'
                    });
                    
                    // Add a highlight effect to the target project
                    targetProject.classList.add('highlight');
                    setTimeout(() => {
                        targetProject.classList.remove('highlight');
                    }, 1000);
                }
            });
        });

        // Add scroll spy functionality to update active button based on scroll position
        const projectCards = document.querySelectorAll('.project-card');
        
        const updateActiveButton = () => {
            let currentProject = null;
            
            projectCards.forEach(card => {
                const rect = card.getBoundingClientRect();
                if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2) {
                    currentProject = card.id;
                }
            });
            
            if (currentProject) {
                projectNavButtons.forEach(button => {
                    const href = button.getAttribute('href').substring(1);
                    button.classList.toggle('active', href === currentProject);
                });
            }
        };

        // Add scroll event listener with debounce
        let scrollTimeout;
        document.addEventListener('scroll', () => {
            if (this.currentPage === 'projects') {
                if (scrollTimeout) {
                    window.cancelAnimationFrame(scrollTimeout);
                }
                scrollTimeout = window.requestAnimationFrame(() => {
                    updateActiveButton();
                });
            }
        });

        // Initial update of active button
        updateActiveButton();
    }

    async initAboutPage() {
        console.log('Initializing about page');
        // Add about page specific initialization
    }

    async initStorePage() {
        console.log('Initializing store page');
        // Add store page specific initialization
    }

    async initContactPage() {
        console.log('Initializing contact page');
        // Add contact form initialization if needed
    }
}