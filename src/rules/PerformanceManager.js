/**
 * PerformanceManager.js - Performance optimization for rule enforcement
 * Purpose: Minimize runtime overhead and memory usage
 * @version 2.0.1
 */

// Use centralized Assert system (loaded via Assert.js)

/**
 * CircularBuffer - Fixed-size circular buffer for violation storage
 * Purpose: Prevent memory growth while maintaining violation history
 * Rule 3: Fixed memory allocation | Rule 2: Bounded operations
 */
class CircularBuffer {
    constructor(size = 50) {
        // Rule 5: Validate buffer size
        if (window.Assert) {
            window.Assert.assertType(size, 'number', 'Buffer size must be number');
        }
        
        // Rule 3: Pre-allocated fixed-size buffer
        this.buffer = new Array(size).fill(null);
        this.size = size;
        this.head = 0;
        this.count = 0;
    }
    
    /**
     * Add item to circular buffer
     * Purpose: Store item with automatic overflow handling
     * Rule 2: Bounded operation | Rule 3: Fixed memory
     */
    push(item) {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.size;
        if (this.count < this.size) this.count++;
    }
    
    /**
     * Get all valid items from buffer
     * Purpose: Retrieve stored items for processing
     * Rule 2: Bounded iteration | Rule 4: ≤60 lines
     */
    getAll() {
        const items = [];
        for (let i = 0; i < this.count; i++) {
            const index = (this.head - this.count + i + this.size) % this.size;
            if (this.buffer[index] !== null) {
                items.push(this.buffer[index]);
            }
        }
        return items;
    }
    
    /**
     * Clear all items from buffer
     * Purpose: Reset buffer state
     * Rule 2: Bounded operation
     */
    clear() {
        this.count = 0;
        this.head = 0;
    }
}

/**
 * PerformanceBatch - Batch processing for reduced overhead
 * Purpose: Collect operations and process in batches
 * Rule 2: Bounded batching | Rule 3: Fixed memory
 */
class PerformanceBatch {
    constructor(size = 10) {
        // Rule 5: Validate batch configuration
        if (window.Assert) {
            window.Assert.assertType(size, 'number', 'Batch size must be number');
        }
        
        this.batchSize = size;
        this.batch = [];
        this.processors = new Map();
        this.lastFlush = Date.now();
        this.flushInterval = 1000; // 1 second
    }
    
    /**
     * Add item to batch for processing
     * Purpose: Collect items for batch processing
     * Rule 2: Auto-flush when full | Rule 4: ≤60 lines
     */
    add(type, item) {
        // Rule 5: Validate batch item
        if (window.Assert) {
            window.Assert.assertType(type, 'string', 'Batch type required');
        }
        
        this.batch.push({ type, item, timestamp: Date.now() });
        
        // Auto-flush when batch is full or time interval exceeded
        if (this.batch.length >= this.batchSize || 
            Date.now() - this.lastFlush > this.flushInterval) {
            this.flush();
        }
    }
    
    /**
     * Register batch processor for specific type
     * Purpose: Associate processing function with batch type
     * Rule 5: Processor validation
     */
    registerProcessor(type, processor) {
        if (window.Assert) {
            window.Assert.assertType(type, 'string', 'Processor type required');
            window.Assert.assertType(processor, 'function', 'Processor function required');
        }
        
        this.processors.set(type, processor);
    }
    
    /**
     * Flush batch and process all items
     * Purpose: Process accumulated batch items
     * Rule 2: Bounded processing | Rule 4: ≤60 lines
     */
    flush() {
        if (this.batch.length === 0) return;
        
        // Group by type for efficient processing
        const typeGroups = new Map();
        
        // Rule 2: Bounded loop over batch
        for (let i = 0; i < Math.min(this.batch.length, 1000); i++) {
            const batchItem = this.batch[i];
            if (!typeGroups.has(batchItem.type)) {
                typeGroups.set(batchItem.type, []);
            }
            typeGroups.get(batchItem.type).push(batchItem.item);
        }
        
        // Process each type group
        typeGroups.forEach((items, type) => {
            const processor = this.processors.get(type);
            if (processor) {
                try {
                    processor(items);
                } catch (error) {
                    console.warn(`Batch processing failed for ${type}:`, error.message);
                }
            }
        });
        
        // Clear batch
        this.batch.length = 0;
        this.lastFlush = Date.now();
    }
}

/**
 * PerformanceManager - Optimize rule enforcement performance
 * Purpose: Minimize runtime overhead and memory usage
 * Rule 4: ≤60 lines per method | Rule 3: Fixed memory allocation
 */
class PerformanceManager {
    /**
     * Initialize performance optimization system
     * Purpose: Setup performance monitoring and optimization
     * Rule 3: Pre-allocated structures | Rule 5: Validation
     */
    constructor(config = {}) {
        // Rule 5: Validate configuration
        if (window.Assert) {
            window.Assert.assertType(config, 'object', 'Configuration required');
        }
        
        // Performance modes: 'off', 'production', 'development'
        this.mode = config.mode || 'development';
        this.enableRuntimeMonitoring = config.enableRuntimeMonitoring !== false;
        this.enableMemoryTracking = config.enableMemoryTracking !== false;
        
        // Rule 3: Fixed-size structures
        this.violationBuffer = new CircularBuffer(config.maxViolationBuffer || 50);
        this.batch = new PerformanceBatch(config.batchSize || 10);
        this.metrics = new Map();
        
        // Performance thresholds
        this.monitoringThreshold = config.monitoringThreshold || 10; // Lines
        this.maxMetrics = 200; // Rule 2: Bounded metrics storage
        
        // Initialize based on mode
        this.initializePerformanceMode();
        
        console.log(`✅ PerformanceManager initialized - Mode: ${this.mode}`);
    }
    
    /**
     * Initialize performance mode settings
     * Purpose: Configure monitoring based on performance mode
     * Rule 2: Mode-based configuration | Rule 4: ≤60 lines
     */
    initializePerformanceMode() {
        switch (this.mode) {
            case 'off':
                this.enableRuntimeMonitoring = false;
                this.enableMemoryTracking = false;
                console.log('🚫 Rules enforcement disabled');
                break;
                
            case 'production':
                this.enableRuntimeMonitoring = true;
                this.enableMemoryTracking = false;
                this.monitoringThreshold = 30; // Higher threshold
                console.log('🚀 Production mode - Minimal overhead');
                break;
                
            case 'development':
                this.enableRuntimeMonitoring = true;
                this.enableMemoryTracking = true;
                this.monitoringThreshold = 10; // Lower threshold
                console.log('🔧 Development mode - Full monitoring');
                break;
                
            default:
                console.warn('⚠️ Unknown performance mode, using development');
                this.mode = 'development';
        }
    }
    
    /**
     * Check if monitoring should be active for given function
     * Purpose: Selective monitoring to reduce overhead
     * Rule 2: Threshold-based monitoring | Rule 5: Validation
     */
    shouldMonitor(func) {
        // Rule 5: Validate function
        if (window.Assert) {
            window.Assert.assertType(func, 'function', 'Function required for monitoring check');
        }
        
        // Skip monitoring if disabled
        if (!this.enableRuntimeMonitoring || this.mode === 'off') {
            return false;
        }
        
        try {
            // Get function source to check size
            const source = func.toString();
            const lineCount = (source.match(/\n/g) || []).length + 1;
            
            // Only monitor functions above threshold (performance optimization)
            return lineCount >= this.monitoringThreshold;
            
        } catch (error) {
            // Default to monitoring if can't determine size
            return this.mode === 'development';
        }
    }
    
    /**
     * Record performance metric with batching
     * Purpose: Collect metrics without immediate processing overhead
     * Rule 2: Batched recording | Rule 4: ≤60 lines
     */
    recordMetric(type, data) {
        if (this.mode === 'off') return;
        
        // Rule 5: Validate metric data
        if (window.Assert) {
            window.Assert.assertType(type, 'string', 'Metric type required');
        }
        
        // Add to batch for later processing
        this.batch.add('metric', { type, data, timestamp: Date.now() });
    }
    
    /**
     * Record violation with performance optimization
     * Purpose: Store violations efficiently with circular buffer
     * Rule 3: Fixed memory usage | Rule 2: Bounded storage
     */
    recordViolation(violation) {
        if (this.mode === 'off') return;
        
        // Rule 5: Validate violation
        if (window.Assert) {
            window.Assert.assertType(violation, 'object', 'Violation object required');
        }
        
        // Add to circular buffer (automatic memory management)
        this.violationBuffer.push({
            ...violation,
            timestamp: Date.now()
        });
        
        // Batch process if needed
        if (this.mode === 'development') {
            this.batch.add('violation', violation);
        }
    }
    
    /**
     * Get current performance statistics
     * Purpose: Provide performance metrics for monitoring
     * Rule 4: ≤60 lines | Rule 2: Bounded processing
     */
    getPerformanceStats() {
        const stats = {
            mode: this.mode,
            runtimeMonitoring: this.enableRuntimeMonitoring,
            memoryTracking: this.enableMemoryTracking,
            violations: this.violationBuffer.count,
            batchSize: this.batch.batch.length,
            metrics: this.metrics.size
        };
        
        // Add memory stats if tracking enabled
        if (this.enableMemoryTracking && performance.memory) {
            stats.memory = {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        
        return stats;
    }
    
    /**
     * Optimize memory usage by cleaning old data
     * Purpose: Prevent memory growth in long-running applications
     * Rule 3: Memory management | Rule 2: Bounded cleanup
     */
    optimizeMemory() {
        if (this.mode === 'off') return;
        
        // Flush pending batches
        this.batch.flush();
        
        // Clean old metrics (Rule 2: bounded cleanup)
        if (this.metrics.size > this.maxMetrics) {
            const metricsArray = Array.from(this.metrics.entries());
            const toKeep = metricsArray.slice(-this.maxMetrics / 2); // Keep newest half
            this.metrics.clear();
            toKeep.forEach(([key, value]) => this.metrics.set(key, value));
            
            console.log(`🧹 Cleaned metrics: ${metricsArray.length} → ${toKeep.length}`);
        }
    }
    
    /**
     * Set performance mode dynamically
     * Purpose: Allow runtime switching of performance modes
     * Rule 5: Mode validation | Rule 4: ≤60 lines
     */
    setPerformanceMode(mode) {
        // Rule 5: Validate mode
        if (window.Assert) {
            window.Assert.assertType(mode, 'string', 'Performance mode must be string');
        }
        
        const validModes = ['off', 'production', 'development'];
        if (!validModes.includes(mode)) {
            console.warn(`⚠️ Invalid performance mode: ${mode}`);
            return false;
        }
        
        // Update mode and reinitialize
        const oldMode = this.mode;
        this.mode = mode;
        this.initializePerformanceMode();
        
        console.log(`🔄 Performance mode changed: ${oldMode} → ${mode}`);
        return true;
    }
}

// Export for global access
window.PerformanceManager = PerformanceManager;
window.CircularBuffer = CircularBuffer;
window.PerformanceBatch = PerformanceBatch;

console.log('✅ PerformanceManager module loaded');
