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

    async handleInitialRoute() {
        // Initialize space background
        await this.initializeSpaceBackground();
        
        // Original code
        const hash = window.location.hash.substring(1) || 'main';
        this.navigateToPage(hash, false);
    }

    async initializeSpaceBackground() {
        try {
            console.log("Starting space environment initialization...");
            
            // Load Three.js
            await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');
            console.log("Three.js loaded successfully");
            
            // Define SpaceEnvironment class directly in PageManager
            // This avoids file loading issues
            class SpaceEnvironment {
                constructor() {
                    this.scene = null;
                    this.camera = null;
                    this.renderer = null;
                    this.container = null;
                    this.stars = null;
                    this.width = 0;
                    this.height = 0;
                    this.initialized = false;
                }
                
                async init() {
                    console.log("SpaceEnvironment initialization started");
                    
                    try {
                        // Create a container for the 3D scene
                        this.createContainer();
                        
                        // Basic Three.js setup
                        this.setupThreeJS();
                        
                        // Initialize with basic stars
                        this.createStars();
                        
                        // Start animation loop
                        this.animate();
                        
                        console.log("SpaceEnvironment initialized successfully");
                        this.initialized = true;
                        return true;
                    } catch (error) {
                        console.error('Failed to initialize Space Environment:', error);
                        return false;
                    }
                }
                
                createContainer() {
                    // Create a container for the 3D scene if it doesn't exist
                    const containerId = 'solar-system-container';
                    if (!document.getElementById(containerId)) {
                        const container = document.createElement('div');
                        container.id = containerId;
                        container.className = 'solar-system-background';
                        
                        // Set inline styles with !important to override any conflicting styles
                        container.style.cssText = `
                            position: fixed !important;
                            top: 0 !important;
                            left: 0 !important;
                            width: 100% !important;
                            height: 100% !important;
                            z-index: 0 !important; /* Change from -1 to 0 to appear above body background */
                            overflow: hidden !important;
                            pointer-events: none !important;
                        `;
                        
                        // Insert at the beginning of body
                        document.body.insertBefore(container, document.body.firstChild);
                        console.log("Space environment container created with ID:", containerId);
                    }
                    
                    this.container = document.getElementById(containerId);
                    
                    if (!this.container) {
                        console.error("Container not found after creation!");
                    }
                }
                
                
                setupThreeJS() {
                    // Create basic Three.js components
                    this.width = window.innerWidth;
                    this.height = window.innerHeight;
                    
                    // Scene
                    this.scene = new THREE.Scene();
                    
                    // Camera
                    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 10000);
                    this.camera.position.set(0, 30, 100);
                    this.camera.lookAt(0, 0, 0);
                    
                    // Renderer
                    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                    this.renderer.setSize(this.width, this.height);
                    this.renderer.setPixelRatio(window.devicePixelRatio);
                    this.renderer.setClearColor(0x000000, 0); // Transparent background
                    this.container.appendChild(this.renderer.domElement);
                    
                    // Lights
                    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
                    this.scene.add(ambientLight);
                    
                    // Handle window resize
                    window.addEventListener('resize', this.handleResize.bind(this));
                }
                
                createStars() {
                    // Create a simple starfield as a placeholder
                    const count = 7000; // Increase number of stars
                    const geometry = new THREE.BufferGeometry();
                    const positions = new Float32Array(count * 3);
                    const colors = new Float32Array(count * 3);
                    
                    for (let i = 0; i < count; i++) {
                        // Random position in a sphere
                        const radius = 500 + Math.random() * 1500;
                        const theta = Math.random() * Math.PI * 2;
                        const phi = Math.acos(2 * Math.random() - 1);
                        
                        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
                        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
                        positions[i * 3 + 2] = radius * Math.cos(phi);
                        
                        // Brighter stars (more white)
                        colors[i * 3] = 0.9 + Math.random() * 0.1;       // R (higher values)
                        colors[i * 3 + 1] = 0.9 + Math.random() * 0.1;   // G (higher values)
                        colors[i * 3 + 2] = 1.0;                         // B (full blue)
                    }
                    
                    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                    
                    const material = new THREE.PointsMaterial({
                        size: 2, // Larger size for better visibility
                        vertexColors: true,
                        transparent: true,
                        opacity: 0.9 // Higher opacity
                    });
                    
                    this.stars = new THREE.Points(geometry, material);
                    this.scene.add(this.stars);
                    
                    // Add a subtle blue glow to the scene
                    const ambientLight = new THREE.AmbientLight(0x3366ff, 0.2);
                    this.scene.add(ambientLight);
                }
                
                handleResize() {
                    this.width = window.innerWidth;
                    this.height = window.innerHeight;
                    
                    this.camera.aspect = this.width / this.height;
                    this.camera.updateProjectionMatrix();
                    
                    this.renderer.setSize(this.width, this.height);
                }
                
                animate() {
                    requestAnimationFrame(this.animate.bind(this));
                    
                    // Slow rotation of stars
                    if (this.stars) {
                        this.stars.rotation.y += 0.0001;
                    }
                    
                    // Render scene
                    this.renderer.render(this.scene, this.camera);
                }
                
                dispose() {
                    // Clean up resources
                    window.removeEventListener('resize', this.handleResize.bind(this));
                    if (this.container && this.renderer.domElement) {
                        this.container.removeChild(this.renderer.domElement);
                    }
                }
            }
            
            // Create and initialize the space environment if it doesn't exist
            if (!window.spaceEnvironment) {
                console.log("Creating SpaceEnvironment instance");
                window.spaceEnvironment = new SpaceEnvironment();
                
                console.log("Initializing space environment...");
                const success = await window.spaceEnvironment.init();
                
                if (success) {
                    console.log("Space environment initialized successfully");
                } else {
                    console.error("Space environment initialization returned false");
                    throw new Error("Space environment initialization failed");
                }
            }
            
            return true;
        } catch (error) {
            console.error("Failed to initialize space environment:", error);
            return false;
        }
    }

    async loadDependencies() {
        console.log("Loading Three.js dependencies...");
        
        // Load Three.js
        await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
        console.log("Three.js loaded successfully");
        
        // Load OrbitControls - use the correct URL structure for r128
        await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
        console.log("OrbitControls loaded successfully");
        
        // Load SpaceEnvironment
        await this.loadScript('src/simulation/solarsystem/SpaceEnvironment.js');
        console.log("SpaceEnvironment loaded successfully");
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
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
            // Start transition
            await this.startPageTransition();
    
            // Load and render page content
            await this.loadAndRenderPage(pageName);
    
            // Update UI state
            this.updateUIState(pageName);
            
            // Set page-specific body class
            this.setPageBodyClass(pageName);
    
            // Complete transition
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
            // Add extra stars or effects for the main page
            const container = document.getElementById('solar-system-container');
            if (container) {
                // Make sure it's visible
                container.style.opacity = '1';
                
                // Ensure it has pointer events on main page
                if (this.currentPage === 'main') {
                    container.style.pointerEvents = 'auto';
                }
                
                // Check visibility after a short delay
                if (window.spaceEnvironment.checkVisibility) {
                    window.spaceEnvironment.checkVisibility();
                }
            }
        }
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
        console.log('Initializing main page');
        
        // Make sure space environment is initialized and enhanced
        if (!window.spaceEnvironment || !window.spaceEnvironment.initialized) {
            await this.initializeSpaceBackground();
        } else {
            this.enhanceSpaceBackground();
        }
        
        // Initialize planet selector if it exists
        const planetSelector = document.querySelector('.planet-selector');
        if (planetSelector) {
            this.initPlanetSelector();
        }
        
        // Add body class for main page
        document.body.classList.add('page-main');
        
        console.log('Main page initialized');
    }

    addBackgroundStyles() {
        const styleId = 'space-environment-styles';
        
        // Only add once
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* Make background transparent to allow space environment to show through */
                body {
                    background: transparent !important;
                }
                
                /* Override any :root or * styles that might set background */
                #page-container, #header-container, #footer-container {
                    background-color: transparent;
                    position: relative;
                    z-index: 1;
                }
                
                /* Style main content to have semi-transparent background */
                .main-section, .main-header, .main-footer {
                    background-color: rgba(0, 0, 0, 0.7);
                    border-radius: 8px;
                    margin: 10px;
                    backdrop-filter: blur(5px);
                }
                
                /* Style for the space environment */
                .solar-system-background {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    z-index: 0 !important;
                }
                
                /* Make sure canvas is visible */
                .solar-system-background canvas {
                    display: block !important;
                }
                
                /* Enable pointer events on main page */
                body.page-main .solar-system-background {
                    pointer-events: auto !important;
                }
            `;
            document.head.appendChild(style);
            console.log("Space environment styles added");
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
        
        // Check if scroll indicators should be visible
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