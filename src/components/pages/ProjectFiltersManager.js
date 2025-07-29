/**
 * ProjectFiltersManager - Manages project filtering functionality
 * Handles filter panel collapse/expand, search, and project filtering
 * Integrates with PageManager lifecycle for proper resource management
 */
class ProjectFiltersManager {
    /**
     * Create a new ProjectFiltersManager instance
     */
    constructor() {
        // Core elements
        this.filtersToggleBtn = null;
        this.filtersPanel = null;
        this.filterButtons = null;
        this.searchBox = null;
        this.projectCards = null;
        this.projectCount = null;
        this.emptyState = null;
        
        // State
        this.isCollapsed = true;
        this.currentFilter = 'featured'; // Start with featured projects
        this.searchTerm = '';
        
        // Event handlers bound to this context
        this.handleToggleClick = this.handleToggleClick.bind(this);
        this.handleFilterClick = this.handleFilterClick.bind(this);
        this.handleSearchInput = this.handleSearchInput.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleClearFilters = this.handleClearFilters.bind(this);
        
        // Resource tracking for cleanup
        this.eventListeners = [];
        this.timeouts = new Set();
        
        // Search debounce
        this.searchTimeout = null;
    }
    
    /**
     * Initialize the filter manager
     */
    async init() {
        try {
            console.log('🔍 Initializing ProjectFiltersManager');
            
            // Find DOM elements
            this.findElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup initial state
            this.setupInitialState();
            
            // Initialize with featured projects
            this.filterProjects('featured');
            
            console.log('✅ ProjectFiltersManager initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ ProjectFiltersManager initialization failed:', error);
            return false;
        }
    }
    
    /**
     * Find required DOM elements
     */
    findElements() {
        this.filtersToggleBtn = document.querySelector('.filters-toggle-btn');
        this.filtersPanel = document.querySelector('.filters-panel');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.searchBox = document.getElementById('project-search');
        this.projectCards = document.querySelectorAll('.project-card');
        this.projectCount = document.getElementById('project-count');
        this.emptyState = document.querySelector('.empty-state');
        
        // Validate required elements
        if (!this.filtersToggleBtn || !this.filtersPanel) {
            throw new Error('Required filter elements not found');
        }
        
        console.log(`🔍 Found ${this.filterButtons.length} filter buttons, ${this.projectCards.length} project cards`);
    }
    
    /**
     * Setup event listeners with proper tracking
     */
    setupEventListeners() {
        // Toggle button
        if (this.filtersToggleBtn) {
            this.addEventListener(this.filtersToggleBtn, 'click', this.handleToggleClick);
            this.addEventListener(this.filtersToggleBtn, 'keydown', this.handleKeydown);
        }
        
        // Filter buttons
        this.filterButtons.forEach(button => {
            this.addEventListener(button, 'click', this.handleFilterClick);
        });
        
        // Search box
        if (this.searchBox) {
            this.addEventListener(this.searchBox, 'input', this.handleSearchInput);
            this.addEventListener(this.searchBox, 'keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.performSearch(this.searchBox.value);
                }
            });
        }
        
        // Clear filters button
        const clearButton = document.querySelector('[data-action="clear-filters"]');
        if (clearButton) {
            this.addEventListener(clearButton, 'click', this.handleClearFilters);
        }
        
        // Document click to close panel when clicking outside
        this.addEventListener(document, 'click', (e) => {
            if (!this.isCollapsed && 
                !this.filtersPanel.contains(e.target) && 
                !this.filtersToggleBtn.contains(e.target)) {
                this.collapsePanel();
            }
        });
        
        // Escape key to close panel
        this.addEventListener(document, 'keydown', (e) => {
            if (e.key === 'Escape' && !this.isCollapsed) {
                this.collapsePanel();
                this.filtersToggleBtn.focus();
            }
        });
    }
    
    /**
     * Enhanced addEventListener with tracking for cleanup
     */
    addEventListener(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
        this.eventListeners.push({ element, event, handler, options });
    }
    
    /**
     * Setup initial state
     */
    setupInitialState() {
        // Add featured filter button if not present
        this.addFeaturedFilterButton();
        
        // Set initial collapsed state
        this.isCollapsed = true;
        
        if (this.filtersToggleBtn) {
            this.filtersToggleBtn.setAttribute('aria-expanded', 'false');
            this.filtersToggleBtn.classList.add('collapsed');
        }
        
        if (this.filtersPanel) {
            this.filtersPanel.classList.add('collapsed');
            this.filtersPanel.setAttribute('aria-hidden', 'true');
        }
        
        // Set featured as active filter
        this.setActiveFilter('featured');
        
        console.log('🔧 Initial state setup complete');
    }
    
    /**
     * Add Featured filter button as the first option
     */
    addFeaturedFilterButton() {
        const filterGroup = document.querySelector('.filter-group');
        let featuredButton = document.querySelector('.filter-btn[data-category="featured"]');
        
        if (!featuredButton && filterGroup) {
            featuredButton = document.createElement('button');
            featuredButton.className = 'filter-btn';
            featuredButton.setAttribute('data-category', 'featured');
            featuredButton.setAttribute('aria-pressed', 'false');
            featuredButton.innerHTML = '⭐ Featured';
            
            // Insert as first button
            filterGroup.insertBefore(featuredButton, filterGroup.firstChild);
            
            // Add event listener
            this.addEventListener(featuredButton, 'click', this.handleFilterClick);
            
            // Update filterButtons collection
            this.filterButtons = document.querySelectorAll('.filter-btn');
            
            console.log('⭐ Added Featured filter button');
        }
    }
    
    /**
     * Handle toggle button click
     */
    handleToggleClick(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (this.isCollapsed) {
            this.expandPanel();
        } else {
            this.collapsePanel();
        }
    }
    
    /**
     * Handle keyboard navigation
     */
    handleKeydown(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.handleToggleClick(e);
        }
    }
    
    /**
     * Expand the filter panel
     */
    expandPanel() {
        if (!this.isCollapsed) return;
        
        console.log('🔽 Expanding filter panel');
        
        this.isCollapsed = false;
        
        // Update button state
        if (this.filtersToggleBtn) {
            this.filtersToggleBtn.setAttribute('aria-expanded', 'true');
            this.filtersToggleBtn.classList.remove('collapsed');
            
            // Update icon
            const icon = this.filtersToggleBtn.querySelector('.filters-icon');
            if (icon) icon.textContent = '🔼';
        }
        
        // Show panel
        if (this.filtersPanel) {
            this.filtersPanel.classList.remove('collapsed');
            this.filtersPanel.setAttribute('aria-hidden', 'false');
            
            // Focus first filter button for accessibility
            const firstFilter = this.filterButtons[0];
            if (firstFilter) {
                this.createTimeout(() => firstFilter.focus(), 100);
            }
        }
        
        // Dispatch event
        this.dispatchEvent('filters:expanded');
    }
    
    /**
     * Collapse the filter panel
     */
    collapsePanel() {
        if (this.isCollapsed) return;
        
        console.log('🔼 Collapsing filter panel');
        
        this.isCollapsed = true;
        
        // Update button state
        if (this.filtersToggleBtn) {
            this.filtersToggleBtn.setAttribute('aria-expanded', 'false');
            this.filtersToggleBtn.classList.add('collapsed');
            
            // Update icon
            const icon = this.filtersToggleBtn.querySelector('.filters-icon');
            if (icon) icon.textContent = '🔽';
        }
        
        // Hide panel
        if (this.filtersPanel) {
            this.filtersPanel.classList.add('collapsed');
            this.filtersPanel.setAttribute('aria-hidden', 'true');
        }
        
        // Dispatch event
        this.dispatchEvent('filters:collapsed');
    }
    
    /**
     * Handle filter button click
     */
    handleFilterClick(e) {
        const button = e.currentTarget;
        const category = button.getAttribute('data-category');
        
        if (!category) return;
        
        console.log(`🔍 Filtering by: ${category}`);
        
        // Update active filter
        this.setActiveFilter(category);
        
        // Filter projects
        this.filterProjects(category);
        
        // Update project count
        this.updateProjectCount();
        
        // Auto-collapse panel on mobile
        if (window.innerWidth <= 768) {
            this.createTimeout(() => this.collapsePanel(), 500);
        }
    }
    
    /**
     * Set active filter button
     */
    setActiveFilter(category) {
        this.currentFilter = category;
        
        // Update button states
        this.filterButtons.forEach(btn => {
            const btnCategory = btn.getAttribute('data-category');
            const isActive = btnCategory === category;
            
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }
    
    /**
     * Filter projects based on category
     */
    filterProjects(category) {
        let visibleCount = 0;
        
        this.projectCards.forEach((card, index) => {
            const cardCategory = card.getAttribute('data-category');
            const isFeatured = card.getAttribute('data-featured') === 'true';
            
            let shouldShow = false;
            
            if (category === 'featured') {
                shouldShow = isFeatured;
            } else if (category === 'all') {
                shouldShow = true;
            } else {
                shouldShow = cardCategory === category;
            }
            
            // Apply search filter if active
            if (shouldShow && this.searchTerm) {
                shouldShow = this.matchesSearch(card, this.searchTerm);
            }
            
            if (shouldShow) {
                card.style.display = 'block';
                card.style.animation = `fadeInUp 0.6s ease-out ${index * 0.1}s both`;
                visibleCount++;
            } else {
                card.style.animation = 'fadeOut 0.3s ease-out';
                this.createTimeout(() => {
                    if (card.style.animation.includes('fadeOut')) {
                        card.style.display = 'none';
                    }
                }, 300);
            }
        });
        
        // Handle empty state
        if (this.emptyState) {
            this.emptyState.style.display = visibleCount === 0 ? 'flex' : 'none';
        }
        
        return visibleCount;
    }
    
    /**
     * Handle search input with debouncing
     */
    handleSearchInput(e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        // Debounce search
        this.searchTimeout = setTimeout(() => {
            this.performSearch(searchTerm);
        }, 300);
    }
    
    /**
     * Perform search with highlighting
     */
    performSearch(searchTerm) {
        this.searchTerm = searchTerm;
        
        console.log(`🔍 Searching for: "${searchTerm}"`);
        
        // Re-filter with current category and search term
        this.filterProjects(this.currentFilter);
        
        // Update project count
        this.updateProjectCount();
    }
    
    /**
     * Check if project matches search term
     */
    matchesSearch(card, searchTerm) {
        if (!searchTerm) return true;
        
        const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
        const description = card.querySelector('p')?.textContent.toLowerCase() || '';
        const tags = Array.from(card.querySelectorAll('.tag'))
            .map(tag => tag.textContent.toLowerCase())
            .join(' ');
        
        return title.includes(searchTerm) || 
               description.includes(searchTerm) || 
               tags.includes(searchTerm);
    }
    
    /**
     * Handle clear filters
     */
    handleClearFilters() {
        console.log('🔄 Clearing all filters');
        
        // Reset search
        if (this.searchBox) {
            this.searchBox.value = '';
        }
        this.searchTerm = '';
        
        // Reset to "All Projects" filter
        this.setActiveFilter('all');
        
        // Show all projects
        this.filterProjects('all');
        
        // Update count
        this.updateProjectCount();
        
        // Show toast notification
        this.showToast('Filters cleared', 'info');
    }
    
    /**
     * Update project count display
     */
    updateProjectCount() {
        if (!this.projectCount) return;
        
        const visibleProjects = document.querySelectorAll('.project-card:not([style*="display: none"])').length;
        const totalProjects = this.projectCards.length;
        
        const countText = visibleProjects === totalProjects 
            ? `${totalProjects} Projects` 
            : `${visibleProjects} of ${totalProjects} Projects`;
        
        // Animate count change
        this.projectCount.style.transition = 'opacity 0.2s ease';
        this.projectCount.style.opacity = '0.5';
        
        this.createTimeout(() => {
            this.projectCount.textContent = countText;
            this.projectCount.style.opacity = '1';
        }, 100);
    }
    
    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `filter-toast ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 1rem;
            right: 1rem;
            padding: 0.5rem 1rem;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            border-radius: 6px;
            z-index: 1001;
            font-size: 0.875rem;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove
        this.createTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease-out';
                this.createTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, 2000);
    }
    
    /**
     * Create tracked timeout
     */
    createTimeout(callback, delay) {
        const id = setTimeout(() => {
            this.timeouts.delete(id);
            callback();
        }, delay);
        this.timeouts.add(id);
        return id;
    }
    
    /**
     * Dispatch custom event
     */
    dispatchEvent(name, detail = {}) {
        const event = new CustomEvent(`projectfilters:${name}`, { 
            detail, 
            bubbles: true 
        });
        document.dispatchEvent(event);
    }
    
    /**
     * Get current state for debugging
     */
    getState() {
        return {
            isCollapsed: this.isCollapsed,
            currentFilter: this.currentFilter,
            searchTerm: this.searchTerm,
            visibleProjects: document.querySelectorAll('.project-card:not([style*="display: none"])').length,
            totalProjects: this.projectCards.length,
            eventListenersCount: this.eventListeners.length,
            timeoutsCount: this.timeouts.size
        };
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
        console.log('🧹 Cleaning up ProjectFiltersManager');
        
        // Clear timeouts
        this.timeouts.forEach(id => clearTimeout(id));
        this.timeouts.clear();
        
        // Clear search timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }
        
        // Remove event listeners
        this.eventListeners.forEach(({ element, event, handler, options }) => {
            try {
                element.removeEventListener(event, handler, options);
            } catch (error) {
                console.warn('⚠️ Error removing event listener:', error);
            }
        });
        this.eventListeners = [];
        
        // Reset references
        this.filtersToggleBtn = null;
        this.filtersPanel = null;
        this.filterButtons = null;
        this.searchBox = null;
        this.projectCards = null;
        this.projectCount = null;
        this.emptyState = null;
        
        console.log('✅ ProjectFiltersManager cleanup complete');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectFiltersManager;
} else {
    window.ProjectFiltersManager = ProjectFiltersManager;
}
