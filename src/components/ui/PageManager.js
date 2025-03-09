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
        
        // Setup event listeners
        this.setupRouting();
        
        // Handle initial route and space background
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
                    console.log('Navigation prevented: This feature is coming soon.');
                    return;
                }
                
                const pageName = link.getAttribute('href').substring(1);
                this.navigateToPage(pageName);
            }
        });
    
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            const pageName = e.state?.page || 'about';
            this.navigateToPage(pageName, false);
        });
    }

    async handleInitialRoute() {
        // Initialize space background first
        await this.initializeSpaceBackground();
        
        // Navigate to initial page
        const hash = window.location.hash.substring(1) || 'about';
        this.navigateToPage(hash, false);
    }

    async initializeSpaceBackground() {
        try {
            console.log("Starting space environment initialization...");
            
            // Load Three.js library
            await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');
            console.log("Three.js loaded successfully");
            
            // Load SpaceEnvironment script
            await this.loadScript('src/components/simulation/solarsystem/SpaceEnvironment.js');
            console.log("SpaceEnvironment script loaded");
            
            // Create and initialize the space environment
            if (!window.spaceEnvironment) {
                console.log("Creating SpaceEnvironment instance");
                window.spaceEnvironment = new SpaceEnvironment();
                
                console.log("Initializing space environment...");
                const success = await window.spaceEnvironment.init();
                
                if (success) {
                    console.log("Space environment initialized successfully");
                } else {
                    console.error("Space environment initialization failed");
                }
            }
            
            return true;
        } catch (error) {
            console.error("Failed to initialize space environment:", error);
            return false;
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if script is already loaded
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            
            script.onload = () => {
                console.log(`Loaded: ${src}`);
                resolve();
            };
            
            script.onerror = (error) => {
                console.error(`Failed to load script: ${src}`, error);
                reject(new Error(`Failed to load ${src}`));
            };
            
            document.head.appendChild(script);
        });
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
            // Start transition animation
            await this.startPageTransition();
    
            // Load and render page content
            await this.loadAndRenderPage(pageName);
    
            // Update UI state - navigation and document title
            this.updateUIState(pageName);
            
            // Set page-specific body class
            this.setPageBodyClass(pageName);
    
            // Complete transition animation
            await this.completePageTransition();
        } catch (error) {
            console.error('Navigation error:', error);
            this.handleNavigationError();
        }
    
        this.isTransitioning = false;
    }

    setPageBodyClass(pageName) {
        // Remove all page-specific classes
        document.body.classList.forEach(className => {
            if (className.startsWith('page-')) {
                document.body.classList.remove(className);
            }
        });
        
        // Add current page class
        document.body.classList.add(`page-${pageName}`);
        
        // If we're on the main page, make sure space environment is visible
        if (pageName === 'main') {
            this.enhanceSpaceBackground();
        }
    }

    enhanceSpaceBackground() {
        if (window.spaceEnvironment && window.spaceEnvironment.initialized) {
            // Make sure it's visible
            const container = document.getElementById('solar-system-container');
            if (container) {
                container.style.opacity = '1';
                container.style.pointerEvents = 'auto';
            }
        }
    }

    async startPageTransition() {
        if (this.contentContainer) {
            this.contentContainer.style.opacity = '0';
            this.contentContainer.style.transform = 'translateY(20px)';
            return new Promise(resolve => setTimeout(resolve, 300));
        }
        return Promise.resolve();
    }

    async loadAndRenderPage(pageName) {
        const pageConfig = this.pages[pageName];
        let content;

        // Check cache first
        if (this.pageCache.has(pageName)) {
            content = this.pageCache.get(pageName);
        } else {
            // Load page content
            try {
                const response = await fetch(pageConfig.path);
                if (!response.ok) {
                    throw new Error(`Failed to load ${pageName} page`);
                }
                content = await response.text();
                this.pageCache.set(pageName, content);
            } catch (error) {
                console.error(`Error loading page content for ${pageName}:`, error);
                throw error;
            }
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
            link.setAttribute('aria-current', href === pageName ? 'page' : 'false');
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
        return Promise.resolve();
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
        console.log('Initializing main page');
        
        // Make sure space environment is visible
        this.enhanceSpaceBackground();
        
        // Initialize planet selector if it exists
        const planetSelector = document.querySelector('.planet-selector');
        if (planetSelector) {
            this.initPlanetSelector();
        }
    }

    initPlanetSelector() {
        const selector = document.querySelector('.planet-selector');
        const leftBtn = document.querySelector('.scroll-indicator.left');
        const rightBtn = document.querySelector('.scroll-indicator.right');
        
        if (!selector || !leftBtn || !rightBtn) return;
        
        // Scroll left
        leftBtn.addEventListener('click', () => {
            selector.scrollBy({ left: -200, behavior: 'smooth' });
        });
        
        // Scroll right
        rightBtn.addEventListener('click', () => {
            selector.scrollBy({ left: 200, behavior: 'smooth' });
        });
        
        // Update scroll buttons visibility based on scroll position
        const updateScrollButtons = () => {
            leftBtn.style.opacity = selector.scrollLeft > 0 ? '1' : '0.3';
            rightBtn.style.opacity = 
                selector.scrollLeft < selector.scrollWidth - selector.clientWidth - 10 ? '1' : '0.3';
        };
        
        // Update on scroll
        selector.addEventListener('scroll', updateScrollButtons);
        
        // Initial update
        updateScrollButtons();
        
        // Update on window resize
        window.addEventListener('resize', updateScrollButtons);
        
        // Add planet selection functionality
        const planetButtons = document.querySelectorAll('.planet-btn');
        planetButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons
                planetButtons.forEach(btn => {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-selected', 'false');
                });
                
                // Add active class to clicked button
                button.classList.add('active');
                button.setAttribute('aria-selected', 'true');
                
                // Get planet name and update info panel
                const planetName = button.getAttribute('data-planet');
                this.updatePlanetInfo(planetName);
            });
        });
        
        // Select the first planet by default
        if (planetButtons.length > 0) {
            planetButtons[0].click();
        }
    }
    
    updatePlanetInfo(planetName) {
        // Example planet data - in a real app, this would come from an API or data file
        const planetData = {
            Sun: {
                description: "The star at the center of our Solar System.",
                diameter: "1,392,700 km",
                distance: "0 km",
                orbitalPeriod: "N/A"
            },
            Mercury: {
                description: "The smallest and innermost planet in the Solar System.",
                diameter: "4,880 km",
                distance: "57.9 million km",
                orbitalPeriod: "88 days"
            },
            Venus: {
                description: "The second planet from the Sun with a thick toxic atmosphere.",
                diameter: "12,104 km",
                distance: "108.2 million km",
                orbitalPeriod: "225 days"
            },
            Earth: {
                description: "Our home planet, the only known celestial body to harbor life.",
                diameter: "12,742 km",
                distance: "149.6 million km",
                orbitalPeriod: "365.25 days"
            },
            Mars: {
                description: "The Red Planet, known for its iron oxide surface.",
                diameter: "6,779 km",
                distance: "227.9 million km",
                orbitalPeriod: "687 days"
            },
            Jupiter: {
                description: "The largest planet in our Solar System, a gas giant.",
                diameter: "139,820 km",
                distance: "778.5 million km",
                orbitalPeriod: "11.86 years"
            },
            Saturn: {
                description: "Known for its prominent ring system composed of ice and rock particles.",
                diameter: "116,460 km",
                distance: "1.4 billion km",
                orbitalPeriod: "29.46 years"
            },
            Uranus: {
                description: "An ice giant with a tilted rotation axis of 97.8 degrees.",
                diameter: "50,724 km",
                distance: "2.9 billion km",
                orbitalPeriod: "84.01 years"
            },
            Neptune: {
                description: "The windiest planet in our Solar System, with winds up to 2,100 km/h.",
                diameter: "49,244 km",
                distance: "4.5 billion km",
                orbitalPeriod: "164.8 years"
            }
        };
        
        // Get planet data
        const planet = planetData[planetName];
        if (!planet) return;
        
        // Update planet info panel
        document.getElementById('planet-name').textContent = planetName;
        document.getElementById('planet-description').textContent = planet.description;
        document.getElementById('planet-diameter').textContent = planet.diameter;
        document.getElementById('planet-distance').textContent = planet.distance;
        document.getElementById('planet-orbital-period').textContent = planet.orbitalPeriod;
    }

    async initProjectsPage() {
        console.log('Initializing projects page');
        
        // Add event listeners to project navigation buttons
        const projectNavButtons = document.querySelectorAll('.side-nav .nav-button');
        const projectCards = document.querySelectorAll('.project-card');
        
        projectNavButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all buttons
                projectNavButtons.forEach(btn => {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-current', 'false');
                });
                
                // Add active class to clicked button
                button.classList.add('active');
                button.setAttribute('aria-current', 'true');
                
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

        // Add click events to project cards for details
        projectCards.forEach(card => {
            card.addEventListener('click', () => {
                // In a real app, this would show project details
                console.log(`Project clicked: ${card.id}`);
            });
            
            // Add keyboard accessibility
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
        });
    }

    async initAboutPage() {
        console.log('Initializing about page');
        // Simple initialization for about page
    }

    async initStorePage() {
        console.log('Initializing store page');
        
        // Add event listeners to filter buttons if they exist
        const filterButtons = document.querySelectorAll('.filter-btn');
        if (filterButtons.length > 0) {
            filterButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Remove active class from all buttons
                    filterButtons.forEach(btn => btn.classList.remove('active'));
                    
                    // Add active class to clicked button
                    button.classList.add('active');
                    
                    // Get category
                    const category = button.getAttribute('data-category');
                    
                    // Filter products
                    this.filterProducts(category);
                });
            });
        }
    }
    
    filterProducts(category) {
        const products = document.querySelectorAll('.product-card');
        
        products.forEach(product => {
            if (category === 'all' || product.getAttribute('data-category') === category) {
                product.style.display = 'block';
            } else {
                product.style.display = 'none';
            }
        });
    }

    async initContactPage() {
        console.log('Initializing contact page');
        
        // Add form validation if contact form exists
        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                // Validate form
                if (this.validateContactForm(contactForm)) {
                    // In a real app, this would send the form data
                    console.log('Form submitted successfully');
                    contactForm.reset();
                    
                    // Show success message
                    const formGroups = contactForm.querySelectorAll('.form-group');
                    const submitButton = contactForm.querySelector('.submit-button');
                    
                    submitButton.innerHTML = '<span>Message Sent!</span>';
                    submitButton.classList.add('success');
                    
                    setTimeout(() => {
                        submitButton.innerHTML = '<span>Send Message</span>';
                        submitButton.classList.remove('success');
                    }, 3000);
                }
            });
            
            // Add input validation
            const inputs = contactForm.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                input.addEventListener('blur', () => {
                    this.validateInput(input);
                });
                
                input.addEventListener('input', () => {
                    const errorElement = document.getElementById(`${input.id}-error`);
                    if (errorElement) {
                        errorElement.textContent = '';
                    }
                });
            });
        }
    }
    
    validateContactForm(form) {
        const nameInput = form.querySelector('#name');
        const emailInput = form.querySelector('#email');
        const messageInput = form.querySelector('#message');
        
        let isValid = true;
        
        if (!this.validateInput(nameInput)) isValid = false;
        if (!this.validateInput(emailInput)) isValid = false;
        if (!this.validateInput(messageInput)) isValid = false;
        
        return isValid;
    }
    
    validateInput(input) {
        const errorElement = document.getElementById(`${input.id}-error`);
        
        // Reset error
        if (errorElement) {
            errorElement.textContent = '';
        }
        
        // Check required
        if (input.hasAttribute('required') && !input.value.trim()) {
            if (errorElement) {
                errorElement.textContent = 'This field is required';
            }
            return false;
        }
        
        // Check email format
        if (input.type === 'email' && input.value.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input.value.trim())) {
                if (errorElement) {
                    errorElement.textContent = 'Please enter a valid email address';
                }
                return false;
            }
        }
        
        return true;
    }
}