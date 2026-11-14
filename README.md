# 🌌 MrCargon.github.io - Interactive Portfolio

> **🚀 An interactive portfolio website featuring a 3D solar system simulation, built with performance optimization following web-adapted "Rules" for reliable development.**

## Engineering case study

What is actually in the code, with the file and function for each point, so any of it can be opened and checked.

### 1. Custom GLSL shaders

- **Earth day/night** - `Earth.getFragmentShader()` in `src/components/simulation/solarsystem/Planets/Earth.js`. Blends a day texture and a night city-lights texture across the terminator with `smoothstep` on the sun angle, tone-maps the city lights, limits specular glint to the sunlit side, and shades bump-map relief using screen-space derivatives (`dFdx`/`dFdy`). The derivative block is left out of the shader when the device can't support it, because on some mobile browsers its mere presence fails the compile and the Earth renders black.
- **Atmosphere glow** - `Earth.createAtmosphere()`: a slightly larger shell with a rim-glow fragment shader, additive blending, brighter on the sun side.
- **Sun** - corona and heliosphere `ShaderMaterial`s in `Sun.createCorona()` and `Sun.createHeliosphere()` (`src/components/simulation/solarsystem/Sun.js`).
- **Artificial life on the GPU** - `src/utils/Lenia.js` runs the Lenia cellular automaton in a fragment shader (`Lenia.FRAG`) over two float render targets in ping-pong (read one, write the other, swap).

### 2. Level of detail and a map-tile engine on the globe

- **`GeoLOD`** (`src/utils/GeoLOD.js`) - states, cities and districts each fade in inside a camera-distance band, with hysteresis (`showBelow` < `hideAbove`) so a tier does not flicker at its edge. One draw call per tier; `update()` walks a pre-built list, so there is no per-frame allocation.
- **`StreetTiles`** (vector, OpenFreeMap) and **`SatelliteTiles`** (Esri imagery) in `src/utils/`. `zoomForDistance()` picks the zoom from how much ground the camera sees (altitude and field of view), then holds the level inside a 0.25-level deadband. Before that deadband, a camera parked on a level boundary flipped levels 116 times in 200 ticks and re-downloaded the whole tile set each time (measured during development; the numbers are in the code comment).
- `StreetTiles.update()` does no work when the covering set of tiles has not changed, keeps the old tiles visible until the new set has fully loaded (no blank flash while zooming), and `_abortStale()` cancels in-flight downloads with `AbortController` when the camera has already moved on.
- Tile memory is bounded: `_evict()` drops the least recently used tiles past a cap and `_disposeMesh()` frees their GPU geometry, material and texture. Failed tiles retry with exponential backoff and full jitter, 30 s up to 5 min (`_scheduleRetry()`).

### 3. Circuit breaker for live data - `SafeFetch`

`SafeFetch.json(url, { ttl, timeout })` in `src/utils/SafeFetch.js`: a per-URL cache with a time-to-live, a request timeout via `AbortController`, and a circuit breaker that stops calling a URL for 60 s after 3 failures in a row. It never throws - it returns the last good value or `null`, so one dead feed cannot blank the globe. Used by `Earth.js` (live ISS position, USGS earthquakes, country shapes) and `GeoLOD.js`.

### 4. A service-worker cache that cannot go stale by mistake

- `sw.js`: code (JS, CSS, HTML, page loads) is network-first with a cache fallback for offline; textures and images are cache-first. The earlier stale-while-revalidate setup served the previous deploy's code on the first reload after every push, which produced bug reports for bugs that were already fixed.
- `deploy/stamp.py` derives `CACHE_NAME` from a hash of every deployed file (`--write` stamps it into `sw.js`, `--check` exits 1 if it is out of date). Any change gets a new cache name automatically, and a deploy that changes nothing keeps the old one, so visitors' caches are not thrown away for no reason.

### 5. Orbits and frame budget

- `Planet.updatePosition()` in `src/components/simulation/solarsystem/Planets/Planet.js` solves Kepler's equation with Newton-Raphson (up to 4 iterations) and falls back to a circular orbit if the result is not finite.
- The ambient background scenes are capped at 30 fps, and 20 fps when a content page covers them (`SpaceEnvironment.SCENE_FPS` / `BACKGROUND_FPS` in `SpaceEnvironment.js`), because the difference is not visible and the cost halves.

### Limits, stated plainly

This is an educational visualisation, not a research tool - see [Technical Limitations](src/components/simulation/time/LIMITATIONS.md). three.js r184 is loaded from a CDN through an import map, so the site needs a network connection on first load.

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
