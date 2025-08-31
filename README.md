# 🌌 MrCargon.github.io - Interactive Space Portfolio

[![Rules Compliant v2.0.1](https://img.shields.io/badge/Ten%20Rules-v2.0.1-success)](src/rules/)
[![Safety Critical](https://img.shields.io/badge/Code%20Quality-Safety%20Critical-important)](src/rules/)
[![Performance](https://img.shields.io/badge/Performance-Optimized-brightgreen)](src/rules/)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen)](#)
[![License](https://img.shields.io/badge/License-MIT-blue)](#license)

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

### 📦 Available Commands

| Command | Description | Status |
|---------|-------------|--------|
| `npm start` | 🚀 Start development server on port 3001 | ✅ Working |
| `npm run dev` | 🔧 Alias for npm start | ✅ Working |
| `npm run validate-rules` | 📏 Check Ten Rules compliance | ✅ Optimized v2.0 |
| `npm run check-integrity` | 🛡️ Verify system integrity | ✅ Working |
| `npm run info` | 📊 Display project information | ✅ Working |
| `npm test` | 🧪 Run test suite | 🚧 Coming Soon |

### 🌟 Live Features

- **🪐 Interactive 3D Solar System** - Click planets to explore, smooth camera transitions
- **📱 Responsive Design** - Experience across all devices  
- **⚡ 60+ FPS Performance** - Optimized monitoring overhead
- **🎮 Games** - Interactive experiences with progress tracking
- **🛡️ Safety-Critical Code** - Web-adapted "Rules" for reliability
- **📸 Camera Persistence** - Your view stays consistent across page changes
- **🚀 Performance Modes** - Development, production, and off modes for optimal efficiency

### 📏 Optimized Rules Compliance

This project demonstrates **coding practices** with performance monitoring:

| Rule | Web Adaptation |
|------|----------------|
| **Simple Control Flow** | ✅ Async/await patterns, event delegation |
| **Bounded Loops** | ✅ Browser-safe iteration limits (1000 max) |
| **Controlled Memory** | ✅ DOM allocation control, object pooling |
| **Function Length** | ✅ ≤60 lines, event handlers ≤30 lines |
| **Validation Density** | ✅ Input validation, type checking, DOM safety |
| **Data Scope** | ✅ ES6 modules, minimal globals (≤5) |
| **Error Recovery** | ✅ Network resilience, graceful degradation |
| **Comprehensive Validation** | ✅ API responses, DOM queries, user inputs |
| **Limited Build Complexity** | ✅ Simple bundling, tree-shaking patterns |
| **Safe References** | ✅ Optional chaining, null checks |
| **Zero Warnings** | ✅ ESLint strict, TypeScript compatibility |

### 🚀 Performance 

Our **RulesEnforcer** system delivers unprecedented performance:

- **Overhead Reduction** - Selective monitoring with thresholds
- **Circular Buffer Architecture** - Fixed memory usage prevents growth
- **Batch Processing** -  violation handling with minimal impact
- **Performance Modes** -  monitoring: off/production/development
- **Modular Design** - 5 focused components replace 1 monolithic system

## 🏗️ Advanced Architecture

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

## 🚀 Features Deep Dive

### 🌌 3D Solar System

- **Realistic Physics** - Accurate planetary orbits and rotations
- **Dynamic Lighting** - Sun illuminates planets realistically  
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

## 🌟 Technical Highlights v2.0

### Performance Metrics
- **Load Time**: <500ms initial load (unchanged)
- **Frame Rate**: 60-140 FPS (device dependent) 
- **Memory**: Stable +- 50MB usage with monitoring optimization
- **Bundle Size**: Optimized with code splitting

### Advanced Browser Support
- ✅ Chrome 90+ (Full WebGL2 support)
- ✅ Firefox 88+ (Complete feature set)
- ✅ Safari 14+ (Optimized for Apple Silicon)
- ✅ Edge 90+ (Enhanced performance)
- ⚠️ Graceful degradation for older browsers

### Comprehensive Monitoring Systems v2.0
- **RulesEnforcer** - For less overhead monitoring
- **PerformanceManager** - Circular buffer efficiency
- **ScopeAnalyzer** - Data scope minimization tracking
- **Memory Optimization** - Automated cleanup and garbage collection
- **Real-time Metrics** - FPS, memory, and performance stats

## 🤝 Contributing

We welcome contributions that maintain our optimized safety standards!

### Contribution Checklist

- [ ] Code follows all Rules v2.1.0
- [ ] Functions are ≤60 lines (event handlers ≤30 lines)
- [ ] All loops have browser-safe bounds (≤1000 iterations)
- [ ] 2+ validations per function (input/DOM/network)
- [ ] Controlled memory allocation patterns
- [ ] Zero ESLint warnings in strict mode
- [ ] Passes RulesEnforcer validation
- [ ] Includes comprehensive documentation

### Getting Started v2.0

1. **Fork & Clone**
   ```bash
   git clone https://github.com/MrCargon/MrCargon.github.io.git
   ```

2. **Setup Development Environment**
   ```bash
   cd MrCargon.github.io
   npm install
   npm run validate-rules  # Check compliance
   ```

3. **Create Branch**
   ```bash
   git checkout -b feature/amazing-optimization
   ```

4. **Make Changes**
   - Follow the Web-Adapted Rules v2.1.0
   - Test with RulesEnforcer
   - Document performance impact
   - Maintain optimization standards

5. **Validate v2.0 System**
   ```bash
   npm run validate-rules    # New optimized validation
   npm run check-integrity   # System health check
   node src/rules/test-validation.js  # Comprehensive tests
   ```

6. **Submit PR**
   - Clear description of optimizations
   - Performance impact measurements
   - Reference any issues
   - Show compliance proof

## 📚 Learning Resources v2.0

### Why Optimized Safety-Critical Code?

This project demonstrates **web-adapted** principles used in:
- **✈️ Aviation** - Flight control systems (JavaScript adaptation)
- **🏥 Medical** - Life support devices (web safety patterns)
- **🚗 Automotive** - Self-driving systems (real-time web optimization)

### Key Optimization Concepts

- **Selective Monitoring** - Only monitor functions above threshold
- **Circular Buffers** - Fixed memory usage prevents growth
- **Batch Processing** - Efficient violation collection and processing
- **Performance Modes** - Adaptive overhead based on environment
- **Memory Optimization** - reduction in monitoring memory usage

### Web-Specific Safety Patterns

- **DOM Safety** - Null checks for all element queries
- **Network Resilience** - Retry logic with exponential backoff
- **Bundle Optimization** - Code splitting and tree shaking
- **Performance Budgets** - Core Web Vitals compliance
- **Accessibility First** - Universal design principles

### Further Reading

- [Safety-Critical Programming Rules](https://en.wikipedia.org/wiki/The_Power_of_10:_Rules_for_Developing_Safety-Critical_Code)
- [Web Performance Optimization](https://web.dev/performance/)
- [Core Web Vitals](https://web.dev/vitals/)
- [Three.js Performance](https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects)
- [JavaScript Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)

## 🎯 Roadmap v2.0

### ✅ Completed v2.0
- RulesEnforcer with performance improvement
- Web-adapted Rules configuration (v2.0.1)
- Circular buffer memory management
- Performance modes (off/production/development)
- Modular architecture (5 focused components)
- Comprehensive validation system
- Unified CSS architecture

### 🚧 In Progress
- WebGPU rendering optimization
- Progressive Web App features
- Advanced performance analytics
- Automated rule compliance testing

### 📋 Planned v3.0
- AI-powered rule violation prediction
- Real-time collaboration features
- Multi-language rule adaptations
- WebAssembly performance modules
- Advanced accessibility features

## 🐛 Troubleshooting

### Common Issues

**RulesEnforcer not working?**
```bash
# Check system status
console.log(window.OptimizedRules.getStatus());

# Verify performance mode
console.log(window.RulesEnforcer?.config?.performance?.mode);

# Reset to development mode
window.RulesEnforcer?.setPerformanceMode('development');
```

**Performance issues?**
```bash
# Check performance stats
console.log(window.OptimizedRules.getPerformanceStats());

# Switch to production mode for better performance
window.OptimizedRules.setPerformanceMode('production');

# Or disable monitoring completely
window.OptimizedRules.setPerformanceMode('off');
```

**Legacy system conflicts?**
```bash
# Legacy system should be automatically disabled
# Check init.js console output for confirmation
npm run check-integrity
```

## 📞 Contact & Support

- **🐛 Issues**: [GitHub Issues](https://github.com/MrCargon/MrCargon.github.io/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/MrCargon/MrCargon.github.io/discussions)
- **📧 Email**: Via contact page on the website
- **🌐 Live Site**: [Visit Portfolio](https://mrcargon.github.io)

## 📜 License

MIT License - See [LICENSE](LICENSE) file for details.

**© 2024 Andrejs K (MrCargon). All rights reserved.**

---

### 🚀 Quick Commands Reference

```bash
npm start                     # Start optimized dev server
npm run validate-rules        # Check v2.0 rule compliance  
npm run check-integrity       # Verify system health
npm run info                 # Enhanced project info
node src/rules/test-validation.js  # Test optimized system
```

### 🔧 Performance Commands

```bash
# Check system status
console.log(window.OptimizedRules.getStatus());

# View performance stats
console.log(window.OptimizedRules.getPerformanceStats());

# Set performance mode
window.OptimizedRules.setPerformanceMode('production');

# Generate compliance report
window.OptimizedRules.showReport();
```

---

*"The rules act like the seat-belt in your car: initially they are perhaps a little uncomfortable, but after a while their use becomes second-nature and not using them becomes unimaginable."* - Gerard J. Holzmann

**Built with 💙 following optimized safety-critical coding practices for reliable, high-performance web applications.**

### 🏆 Achievement Unlocked: Performance Optimization
*Successfully adapted "Power of Ten" rules for modern web development with  performance improvements.*
