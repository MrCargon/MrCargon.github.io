# 🌌 MrCargon.github.io - Interactive Portfolio

> **🚀 An interactive portfolio website featuring a 3D solar system simulation, built with performance optimization following web-adapted "Rules" for reliable development.**

## ⚡ Quick Start

```bash
# Clone & Enter
git clone https://github.com/MrCargon/MrCargon.github.io.git
cd MrCargon.github.io

# Install & Run
npm install
npm start
```

🌟 **Visit:** `http://localhost:3001`


## 🏗️ Project file structure

```
MrCargon.github.io/
│
├── 🎯 index.html              # Entry point with Three.js setup
├── 🎨 index.css               # Unified global styles & CSS architecture
├── ⚙️ server.js               # Express development server
│
└── src/                       # Source code (Rule-compliant v2.0)
    ├── 🚀 main.js             # Application bootstrap & loading
    │
    ├── 🛡️ rules/                # Optimized Safety-Critical System v2.0
    │   ├── Assert.js             # Validation & assertions
    │   ├── BoundedUtilities.js   # Memory-safe utilities
    │   ├── rules-config.json     # Web-adapted Ten Rules (v2.0.1)
    │   ├── PerformanceManager.js     # Circular buffer optimization
    │   ├── ScopeAnalyzer.js          # Rule data scope enforcement
    │   ├── RulesEnforcer.js          # Legacy system (disabled)
    │   ├── test-validation.js        # Comprehensive testing
    │   └── init.js                   # Optimized initialization
    │
    ├── 🎮 components/         # UI Components
    │   ├── header/            # Navigation & mobile menu
    │   ├── pages/             # Page content & routing
    │   ├── games/             # Interactive educational games
    │   ├── simulation/        # 3D space environment
    │   │   └── solarsystem/   # Planets, sun, orbits
    │   └── ui/                # Page manager, loading
    │
    ├── 🔧 utils/              # Helper Modules
    │   ├── MemoryManager.js   # Memory monitoring
    │   └── ResourceLoader.js  # Asset loading
    │
    └── 🎨 assets/             # Static Resources
        └── textures/          # Planet & sun textures
```

## 🚀 Performance Features

### ⚡ RulesEnforcer Architecture

```javascript
// Performance monitoring with selective activation
class RulesEnforcer {
    constructor(config) {
        // Overhead reduction through intelligent design
        this.performanceManager = new PerformanceManager(config);
        this.scopeAnalyzer = new ScopeAnalyzer(config.rules.rule6);
        
        // Circular buffer prevents memory growth
        this.violationBuffer = new CircularBuffer(50);
        
        // Only monitor functions above threshold (performance optimization)
        this.monitoringThreshold = config.monitoringThreshold || 10;
    }
    
    shouldMonitor(func) {
        // Rule 2: Only monitor functions above line threshold
        const lineCount = this.getLineCount(func);
        return lineCount >= this.monitoringThreshold;
    }
}
```

### 🧠 Circular Buffer Memory Management

```javascript
//  memory optimization
class CircularBuffer {
    constructor(size = 50) {
        // Rule 3: Pre-allocated fixed-size buffer
        this.buffer = new Array(size).fill(null);
        this.size = size;
        this.head = 0;
        this.count = 0;
    }
    
    push(item) {
        // Automatic overflow handling - no memory growth
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.size;
        if (this.count < this.size) this.count++;
    }
}
```

### 📊 Performance Modes

```javascript
// Adaptive monitoring for optimal performance
const performanceModes = {
    off: {
        runtimeMonitoring: false,
        memoryTracking: false,
        overhead: '0%'
    },
    production: {
        runtimeMonitoring: true,
        memoryTracking: false,
        monitoringThreshold: 30,
        overhead: '2-5%'
    },
    development: {
        runtimeMonitoring: true,
        memoryTracking: true,
        monitoringThreshold: 10,
        overhead: '5-10%'
    }
};
```

## 🛡️ Web-Adapted Safety Rules

### JavaScript-Specific Implementations

**Rule 1: Simple Control Flow**
```javascript
// Web-optimized async patterns
async function loadPlanetData(planetName) {
    Assert.assertType(planetName, 'string', 'Planet name');
    
    try {
        const response = await fetch(`/api/planets/${planetName}`);
        Assert.assertNotNull(response, 'API response');
        
        const data = await response.json();
        return this.validatePlanetData(data);
    } catch (error) {
        return this.handleLoadError(error, planetName);
    }
}
```

**Rule 2: Browser-Safe Bounded Loops**
```javascript
// Prevents browser freezing
function renderStars(starCount) {
    const MAX_STARS = 1000; // Rule 2: Fixed upper bound
    const count = Math.min(starCount, MAX_STARS);
    
    for (let i = 0; i < count; i++) {
        // 16ms frame budget for 60fps
        if (performance.now() - frameStart > 16) {
            requestAnimationFrame(() => this.renderStars(starCount - i));
            break;
        }
        this.renderStar(i);
    }
}
```

**Rule 3: DOM Memory Control**
```javascript
// Controlled DOM allocation
class SpaceEnvironment {
    constructor() {
        // Rule 3: Pre-allocate DOM elements
        this.maxDOMElements = 500;
        this.planetElements = new Array(20); // Fixed size
        this.eventListeners = new Map(); // Bounded collection
        
        // No 'new' DOM elements after initialization
        this.initializePlanetElements();
    }
}
```

### 🌐 Web-Specific Enhancements

- **Network Resilience** - Exponential backoff retry logic
- **DOM Safety** - Null checks for all element queries
- **Performance Budgets** - 1.5s first contentful paint target
- **Bundle Optimization** - 500KB max chunk sizes with code splitting
- **Browser Compatibility** - ES2020+ with graceful fallbacks

## Real-Time Clock System (Educational Demo)

This portfolio includes an **interactive educational demo** of solar system orbital mechanics. The time system allows you to:
- Control simulation speed (1x to 10,000x real-time)
- Jump to specific dates
- Observe how planets move at different time scales
- Learn Kepler's laws through visualization

**Important:** This is a visualization tool for learning, not a scientific research tool. Position accuracy: ±2,600 km for Earth. For accurate astronomical calculations, use NASA JPL Horizons.

### What This Is
✅ Educational demo for teaching orbital mechanics
✅ Interactive visualization of planetary motion

**See:** [Time System Documentation](src/components/simulation/time/README.md) | [Technical Limitations](src/components/simulation/time/LIMITATIONS.md)

## 🚀 Features

### 🌌 3D Solar System

- **Realistic Physics** - Planetary orbits and rotations
- **Dynamic Lighting** - Sun illuminates planets  
- **Smooth Transitions** - Hardware-accelerated camera easing
- **Performance Monitoring** - Real-time FPS and memory tracking
- **Adaptive Quality** - Scales based on device capability
- **Memory Optimization** - reduction in monitoring overhead

### 🎮 Interactive Elements

- **Planet Navigation** - Rule-compliant click handling
- **Camera Controls** - Bounded movement with validation
- **Keyboard Shortcuts** - Input sanitization and validation
- **Touch Support** - Mobile-optimized interactions
- **Error Recovery** - Graceful degradation for failed operations

## 🔧 Development Guide

### Prerequisites

```bash
# Check your environment
node --version  # Need 16.0.0+
npm --version   # Need 8.0.0+
```

### Local Development v2.0

```bash
# Install dependencies
npm install

# Start optimized dev server
npm start

# Check v2.0 rule compliance
npm run validate-rules

# Verify system integrity with new components
npm run check-integrity

# Enhanced project info
npm run info
```

### Performance Testing

```bash
# Test optimized rules system
node src/rules/test-validation.js

# Monitor memory usage
console.log(window.Rules.getPerformanceStats());

# Check performance mode
console.log(window.RulesEnforcer.config.performance.mode);
```

### Code Standards v2.0

Every contribution must follow the **Web-Adapted Rules**:

```javascript
// Web-optimized rule compliance
async function updateUserScore(userId, points) {
    // Rule 5: Comprehensive web validation
    Assert.assertType(userId, 'string', 'User ID');
    Assert.assertRange(points, 0, 1000, 'Points range');
    
    // Rule 7: Network error handling
    try {
        const response = await this.apiCall('/users/score', {
            userId, points
        });
        
        // Rule 8: Response validation
        Assert.assertNotNull(response, 'API response');
        Assert.assertType(response.success, 'boolean', 'Success flag');
        
        return response;
    } catch (error) {
        // Rule 7: Graceful error recovery
        return this.handleNetworkError(error, 'updateScore');
    }
}
```


## 🤝 Contributing

We welcome contributions that maintain our optimized safety standards!

*"The rules act like the seat-belt in your car: initially they are perhaps a little uncomfortable, but after a while their use becomes second-nature and not using them becomes unimaginable."* - Gerard J. Holzmann

**Built with passion & 💙.**

## 📞 Contact & Support

- **🐛 Issues**: [GitHub Issues](https://github.com/MrCargon/MrCargon.github.io/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/MrCargon/MrCargon.github.io/discussions)
- **🌐 Live Site**: [Visit Portfolio](https://mrcargon.github.io)

## 📜 License

MIT License - See [LICENSE](LICENSE) file for details.

**© 2025 Andrejs K (MrCargon). All rights reserved.**
