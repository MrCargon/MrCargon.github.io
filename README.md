# Solar System Portfolio

A single-page application featuring an impressive interactive 3D solar system visualization.

![Solar System Portfolio](screenshot.png)

## Features

- Interactive 3D solar system with scientifically accurate models
- Smooth camera transitions between planets
- Responsive design that works on desktop and mobile devices
- Planet information panels with key facts about each celestial body
- Performance optimized rendering with Three.js

## Technologies Used

- HTML5, CSS3, and JavaScript
- Three.js for 3D rendering
- Custom component loading system
- Responsive design with CSS variables
- PageManager for single-page application navigation
- ResourceLoader for optimized asset loading
- Memory management system for improved performance

## Project Structure

```
├── index.html               # Main entry point
├── index.css                # Global styles
├── src/
│   ├── assets/              # Textures and other assets
│   │   └── textures/        # Planet and environment textures
│   ├── components/          # UI components
│   │   ├── footer/          # Footer component
│   │   ├── header/          # Header and navigation
│   │   ├── pages/           # Page content
│   │   ├── simulation/      # 3D simulation components
│   │   │   └── solarsystem/ # Solar system objects
│   │   │       ├── Planets/ # Planet classes
│   │   │       └── ...      # Other solar system components
│   │   └── ui/              # UI controllers and managers
│   ├── main.js              # Main application initialization
│   └── utils/               # Utility classes
│       ├── ResourceLoader.js # Asset loading optimization
│       └── MemoryManager.js  # Memory management
```

## Core Components

### SpaceEnvironment

The `SpaceEnvironment` class is responsible for managing the 3D rendering environment, including:

- Setting up the Three.js scene, camera, and renderer
- Managing the solar system objects
- Handling user interactions with the 3D environment
- Coordinating camera movements between planets

### CameraController

The `CameraController` manages camera transitions with smooth animations:

- Handles focusing on selected planets
- Provides camera movement animations
- Manages camera controls and view states
- Works with OrbitControls for user interaction

### SolarSystem

The `SolarSystem` class orchestrates the celestial bodies:

- Creates and manages all planets, the sun, and other objects
- Handles orbital mechanics and rotations
- Manages object positioning and scaling
- Provides planet information for the UI

### PageManager

The `PageManager` coordinates the single-page application:

- Handles page navigation without page reloads
- Manages component loading and initialization
- Coordinates the UI with the 3D environment
- Handles responsive design adaptations

## Camera System

The camera system uses a combination of:

1. **CameraController** - Manages smooth transitions between camera positions
2. **OrbitControls** - Allows user interaction with the camera
3. **Planet Focusing** - Automatically positions the camera for optimal planet viewing

When a planet is selected in the UI:
1. The UI updates to show the selected planet's information
2. The SpaceEnvironment's focusOnPlanet method is called
3. The CameraController animates the camera to focus on the selected planet
4. The OrbitControls target is updated to allow orbiting around the selected planet

## Getting Started

### Prerequisites

- Modern web browser with WebGL support
- Node.js and npm (for development)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/YourUsername/solar-system-portfolio.git
   cd solar-system-portfolio
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Open your browser and visit ~ `http://localhost:3001`

## Deployment

This project is configured for GitHub Pages deployment:

1. Push to your GitHub repository
2. Enable GitHub Pages in repository settings
3. The site will be available at `https://mrcargon.github.io`

## Performance Optimization

- Texture caching through ResourceLoader
- Memory management to prevent leaks
- Progressive loading of planets
- Optimized render loop
- Level-of-detail adjustments for distant objects

## Accessibility

- Keyboard navigation support
- ARIA attributes for screen readers
- High contrast mode support
- Reduced motion preferences respected

## Browser Compatibility

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers with WebGL support

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Planet textures sourced from NASA
- Three.js for the 3D rendering framework
- Inspiration from various space visualization projects
