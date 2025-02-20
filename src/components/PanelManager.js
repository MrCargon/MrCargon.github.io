class PanelManager {
    constructor(app) {
        this.app = app;
        this.currentPanel = 'home';
        this.panels = new Map();
        this.planetData = new Map();
        this.scrollPosition = 0;
        
        // Initialize managers
        this.initializePanels();
        this.setupEventListeners();
        this.initializePlanetData();
    }

    initializePanels() {
        document.querySelectorAll('.panel').forEach(panel => {
            const id = panel.id.replace('-panel', '');
            this.panels.set(id, panel);
        });

        // Show header after initialization
        requestAnimationFrame(() => {
            const header = document.getElementById('main-header');
            if (header) header.classList.add('visible');
        });
    }

    initializePlanetData() {
        // Initialize static planet data
        this.planetData = new Map([
            ['Sun', { name: 'Sun', description: 'The star at the center of our solar system' }],
            ['Mercury', { name: 'Mercury', description: 'The smallest planet and closest to the Sun' }],
            ['Venus', { name: 'Venus', description: 'Second planet from the Sun' }],
            ['Earth', { name: 'Earth', description: 'Our home planet' }],
            ['Mars', { name: 'Mars', description: 'The red planet' }],
            ['Jupiter', { name: 'Jupiter', description: 'The largest planet' }],
            ['Saturn', { name: 'Saturn', description: 'Known for its spectacular rings' }],
            ['Uranus', { name: 'Uranus', description: 'An ice giant planet' }],
            ['Neptune', { name: 'Neptune', description: 'The most distant planet' }]
        ]);
    }

    setupEventListeners() {
        // Panel navigation
        document.querySelectorAll('.nav-button[data-panel]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetPanel = e.currentTarget.dataset.panel;
                this.switchToPanel(targetPanel);
            });
        });

        // Planet selection
        document.querySelectorAll('.nav-button[data-planet]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const planet = e.currentTarget.dataset.planet;
                this.handlePlanetSelection(planet);
            });
        });

        // Camera controls
        const resetBtn = document.getElementById('reset-camera');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (this.app.components.cameraController) {
                    this.app.components.cameraController.resetToDefaultView();
                }
            });
        }

        // Rotation toggle
        const rotationBtn = document.getElementById('toggle-rotation');
        if (rotationBtn) {
            rotationBtn.addEventListener('click', (e) => {
                this.app.uiState.autoRotate = !this.app.uiState.autoRotate;
                e.currentTarget.classList.toggle('active');
                if (this.app.components.cameraController) {
                    this.app.components.cameraController.enableAutoRotate(this.app.uiState.autoRotate);
                }
            });
        }

        // Orbit toggle
        const orbitBtn = document.getElementById('toggle-orbit');
        if (orbitBtn) {
            orbitBtn.addEventListener('click', (e) => {
                e.currentTarget.classList.toggle('active');
                if (this.app.components.solarSystem) {
                    this.app.components.solarSystem.toggleOrbits(e.currentTarget.classList.contains('active'));
                }
            });
        }
    }

    setupPlanetNavigation() {
        const selector = document.querySelector('.planet-selector');
        const leftIndicator = document.querySelector('.scroll-indicator.left');
        const rightIndicator = document.querySelector('.scroll-indicator.right');
        
        const updateIndicators = () => {
            if (!selector) return;
            
            const canScrollLeft = selector.scrollLeft > 0;
            const canScrollRight = selector.scrollLeft < selector.scrollWidth - selector.clientWidth;
            
            if (leftIndicator) {
                leftIndicator.classList.toggle('visible', canScrollLeft);
            }
            if (rightIndicator) {
                rightIndicator.classList.toggle('visible', canScrollRight);
            }
        };
    
        // Add scroll event listener
        selector?.addEventListener('scroll', updateIndicators);
    
        // Add click handlers for indicators
        leftIndicator?.addEventListener('click', () => {
            selector.scrollBy({
                left: -200,
                behavior: 'smooth'
            });
        });
    
        rightIndicator?.addEventListener('click', () => {
            selector.scrollBy({
                left: 200,
                behavior: 'smooth'
            });
        });
    
        // Initial check
        updateIndicators();
    
        // Update on resize
        window.addEventListener('resize', updateIndicators);
    }

    switchToPanel(panelId) {
        // Remove active class from all panels and buttons
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-button[data-panel]').forEach(b => b.classList.remove('active'));

        // Activate target panel and button
        const targetPanel = this.panels.get(panelId);
        const targetButton = document.querySelector(`.nav-button[data-panel="${panelId}"]`);

        if (targetPanel && targetButton) {
            targetPanel.classList.add('active', 'panel-transition');
            targetButton.classList.add('active');
        }

        // Update navigation controls position
        this.updateNavigationControls(panelId);
        
        // Store current panel
        this.currentPanel = panelId;
    }

    handlePlanetSelection(planetName) {
        if (!planetName) {
            console.warn('No planet name provided');
            return;
        }

        // Remove active class from all planet buttons
        document.querySelectorAll('.nav-button[data-planet]')
            .forEach(btn => btn.classList.remove('active'));
        
        // Add active class to selected planet button
        const selectedButton = document.querySelector(`.nav-button[data-planet="${planetName}"]`);
        if (selectedButton) {
            selectedButton.classList.add('active');
        }

        // Focus camera on selected planet using camera controller
        if (this.app.components.cameraController?.isInitialized) {
            this.app.components.cameraController.setTargetPlanet(planetName)
                .catch(error => console.warn('Error setting target planet:', error));
        }

        // Update UI and panel state
        if (this.currentPanel !== 'exploration') {
            this.switchToPanel('exploration');
        }

        // Update planet info panel
        this.updatePlanetInfo(planetName);
    }

    updateNavigationControls(panelId) {
        const navControls = document.getElementById('navigation-controls');
        if (navControls) {
            if (panelId === 'exploration') {
                navControls.classList.remove('fixed-bottom');
                navControls.style.opacity = '1';
            } else {
                navControls.classList.add('fixed-bottom');
                navControls.style.opacity = panelId === 'home' ? '1' : '0';
            }
        }
    }

    updatePlanetInfo(planetName) {
        const planetInfo = document.querySelector('.planet-info');
        if (!planetInfo) return;

        try {
            // Get planet data from the solar system component
            const planet = this.app.components.solarSystem?.planets?.find(
                p => p.data.name.toLowerCase() === planetName.toLowerCase()
            );

            // Fallback to static data if solar system data isn't available
            const fallbackData = this.planetData.get(planetName);
            const data = planet?.data || fallbackData;

            if (!data) {
                console.warn(`No data found for planet: ${planetName}`);
                return;
            }

            // Update UI elements
            const elements = {
                name: document.getElementById('planet-name'),
                description: document.getElementById('planet-description'),
                diameter: document.getElementById('planet-diameter'),
                distance: document.getElementById('planet-distance'),
                orbitalPeriod: document.getElementById('planet-orbital-period')
            };

            if (elements.name) elements.name.textContent = data.name;
            if (elements.description) elements.description.textContent = data.description;
            if (elements.diameter) {
                elements.diameter.textContent = data.radius ? 
                    `${(data.radius * 2).toFixed(0)} km` : 'N/A';
            }
            if (elements.distance) {
                elements.distance.textContent = data.distance ? 
                    `${data.distance.toFixed(2)} AU` : 'N/A';
            }
            if (elements.orbitalPeriod) {
                elements.orbitalPeriod.textContent = data.orbitalPeriod ? 
                    `${data.orbitalPeriod.toFixed(1)} Earth days` : 'N/A';
            }

            // Show the info panel
            planetInfo.style.display = 'block';
            void planetInfo.offsetWidth; // Force reflow
            planetInfo.classList.add('visible');

        } catch (error) {
            console.error('Error updating planet info:', error);
        }
    }
}

export default PanelManager;