// src/data/planetData.js

// Import textures directly using the import statement
import sunTexture from '../../../assets/textures/sun/sun_map.jpg';

// Planet map textures
import mercuryMap from '../../../assets/textures/planets/mercury/mercury_map.jpg';
import mercuryBump from '../../../assets/textures/planets/mercury/mercury_bump.jpg';
import venusMap from '../../../assets/textures/planets/venus/venus_map.jpg';
import venusClouds from '../../../assets/textures/planets/venus/venus_clouds.jpg';
import earthMap from '../../../assets/textures/planets/earth/earth_map.jpg';
import earthBump from '../../../assets/textures/planets/earth/earth_bump.jpg';
import moonMap from '../../../assets/textures/planets/earth/moon/moon_map.jpg';
import moonBump from '../../../assets/textures/planets/earth/moon/moon_bump.jpg';
import earthClouds from '../../../assets/textures/planets/earth/earth_clouds.jpg';
import earthSpecular from '../../../assets/textures/planets/earth/earth_specular.jpg';
import marsMap from '../../../assets/textures/planets/mars/mars_map.jpg';
import marsBump from '../../../assets/textures/planets/mars/mars_bump.jpg';
import jupiterMap from '../../../assets/textures/planets/jupiter/jupiter_map.jpg';
import saturnMap from '../../../assets/textures/planets/saturn/saturn_map.jpg';
import saturnRings from '../../../assets/textures/planets/saturn/saturn_rings.jpg';
import uranusMap from '../../../assets/textures/planets/uranus/uranus_map.jpg';
import uranusRings from '../../../assets/textures/planets/uranus/uranus_rings.jpg';
import neptuneMap from '../../../assets/textures/planets/neptune/neptune_map.jpg';

/**
 * Comprehensive planetary data based on NASA's planetary fact sheets
 * and additional visualization parameters
 * 
 * Units:
 * - Distances: Astronomical Units (AU)
 * - Sizes: Kilometers (km)
 * - Temperatures: Kelvin (K)
 * - Time periods: Earth days
 * - Masses: Relative to Earth (Earth = 1)
 * - Densities: g/cm³
 * - Gravities: Relative to Earth (Earth = 1)
 * - Escape Velocities: km/s
 */

export const PLANET_TEXTURES = {
    SUN: sunTexture,
    MAPS: {
        mercury: mercuryMap,
        venus: venusMap,
        earth: earthMap,
        mars: marsMap,
        jupiter: jupiterMap,
        saturn: saturnMap,
        uranus: uranusMap,
        neptune: neptuneMap
    },
    BUMPS: {
        mercury: mercuryBump,
        earth: earthBump,
        mars: marsBump
    },
    CLOUDS: {
        earth: earthClouds,
        venus: venusClouds
    },
    SPECULAR: {
        earth: earthSpecular
    },
    RINGS: {
        saturn: saturnRings,
        uranus: uranusRings
    },
    MOONS: {
        luna: {
            map: moonMap,
            bumpMap: moonBump
        }
    }
};

// Visual properties for planet materials
export const PLANET_MATERIALS = {
    mercury: {
        color: 0x8c7853,
        emissive: 0x0,
        roughness: 0.7,
        metalness: 0.3,
        bumpScale: 0.002,
        // Mercury has no real atmosphere but can have a very thin exosphere
        atmosphereColor: 0x111111,
        atmosphereThickness: 0.001,
        surfaceDetail: 1.0, // High surface detail for craters
        // Temperature-based emissive effect for day/night sides
        dayNightEffect: true,
        maxEmissive: 0x330000 // Red hot glow on day side
    },
    
    venus: {
        color: 0xffd700,
        emissive: 0x110000, // Slight glow due to high temperature
        roughness: 0.5,
        metalness: 0.0,
        atmosphereColor: 0xffffcc,
        atmosphereThickness: 0.15,
        cloudOpacity: 0.9,
        cloudColor: 0xffffee,
        // Venus-specific cloud layers
        cloudLayers: [
            { height: 0.12, opacity: 0.7, color: 0xffeecc },
            { height: 0.15, opacity: 0.5, color: 0xffffdd }
        ],
        // Sulfuric acid haze effect
        hazeColor: 0xffff99,
        hazeOpacity: 0.3
    },
    
    earth: {
        color: 0x2233ff,
        emissive: 0x0,
        roughness: 0.4,
        metalness: 0.1,
        atmosphereColor: 0x6688ff,
        atmosphereThickness: 0.03,
        cloudOpacity: 0.6,
        cloudColor: 0xffffff,
        oceanColor: 0x001133,
        landColor: 0x116633,
        // Add night lights effect
        nightLightsColor: 0xffaa00,
        nightLightsIntensity: 0.3,
        // Multiple cloud layers
        cloudLayers: [
            { height: 0.01, opacity: 0.4, color: 0xffffff }, // Low clouds
            { height: 0.03, opacity: 0.3, color: 0xeeeeff }  // High clouds
        ],
        // Atmospheric scattering
        rayleighScattering: 0.0025
    },
    
    mars: {
        color: 0xff4400,
        emissive: 0x0,
        roughness: 0.8,
        metalness: 0.0,
        atmosphereColor: 0xff8866,
        atmosphereThickness: 0.01,
        // Dust storm effects
        dustColor: 0xff6633,
        dustOpacity: 0.2,
        // Surface features
        polarCapsColor: 0xffffff,
        polarCapsIntensity: 0.8,
        // Oxidized surface detail
        surfaceRust: 0.7,
        bumpScale: 0.003
    },
    
    jupiter: {
        color: 0xffae5c,
        emissive: 0x110000, // Slight internal heat glow
        roughness: 0.4,
        metalness: 0.1,
        atmosphereColor: 0xffae5c,
        atmosphereThickness: 0.1,
        // Multiple band colors for stripes
        bandColors: [
            0xffae5c, // Base color
            0xcd8542, // Darker bands
            0xffcf9f  // Lighter bands
        ],
        // Great Red Spot effect
        stormColor: 0xff4422,
        stormIntensity: 0.8,
        // Atmospheric flow animation
        bandSpeed: [0.5, -0.3, 0.4], // Different speeds for different latitudes
        cloudLayerOpacity: 0.7
    },
    
    saturn: {
        color: 0xffd700,
        emissive: 0x110000, // Internal heat glow
        roughness: 0.4,
        metalness: 0.1,
        atmosphereColor: 0xffd700,
        atmosphereThickness: 0.08,
        // Ring system properties
        ringColor: 0xffd700,
        ringOpacity: 0.8,
        ringGap: 0.2, // Cassini Division
        // Multiple ring layers
        ringLayers: [
            { radius: 1.2, opacity: 0.9, color: 0xffcc00 },
            { radius: 1.4, opacity: 0.7, color: 0xffdd33 },
            { radius: 1.6, opacity: 0.5, color: 0xffee66 }
        ],
        // Atmospheric bands
        bandColors: [
            0xffd700,
            0xeec600,
            0xffdd33
        ]
    },
    
    uranus: {
        color: 0x40ffff,
        emissive: 0x0,
        roughness: 0.4,
        metalness: 0.2,
        atmosphereColor: 0x40ffff,
        atmosphereThickness: 0.05,
        ringColor: 0x40ffff,
        // Methane absorption effect
        methaneColor: 0x00cccc,
        methaneIntensity: 0.6,
        // Thin ring system
        ringLayers: [
            { radius: 1.1, opacity: 0.3, color: 0x40ffff },
            { radius: 1.2, opacity: 0.2, color: 0x60ffff }
        ],
        // Pole highlighting due to seasonal orientation
        polarHighlight: 0x80ffff,
        polarIntensity: 0.4
    },
    
    neptune: {
        color: 0x4040ff,
        emissive: 0x0,
        roughness: 0.4,
        metalness: 0.2,
        atmosphereColor: 0x4040ff,
        atmosphereThickness: 0.06,
        ringColor: 0x4040ff,
        // Dark spot features
        stormColor: 0x202080,
        stormIntensity: 0.7,
        // Methane absorption
        methaneColor: 0x0000cc,
        methaneIntensity: 0.8,
        // High-speed wind bands
        bandColors: [
            0x4040ff,
            0x3030cc,
            0x5050ff
        ],
        windSpeed: 2.0 // Fastest winds in the solar system
    }
};

// Define moon materials
export const MOON_MATERIALS = {
    luna: {
        color: 0xDDDDDD,
        emissive: 0x000000,
        roughness: 0.8,
        metalness: 0.1,
        bumpScale: 0.002,
        // Add specific material properties for the moon
        craterDetail: 1.0,
        albedo: 0.12,
        nightEmission: 0x000033  // Slight blue tint for earthshine
    }
};

export const PLANET_DATA = [
    {
        name: 'Mercury',
        id: 'mercury',
        type: 'terrestrial',
        radius: 2439.7,
        mass: 0.0553,
        density: 5.427,
        gravity: 0.378,
        escapeVelocity: 4.25,
        
        distance: 0.387,
        orbitalPeriod: 87.97,
        orbitalSpeed: 47.36,
        orbitalInclination: 7.0,
        orbitalEccentricity: 0.206,
        
        rotationPeriod: 58.646,
        axialTilt: 0.034,
        
        minTemp: 100,
        maxTemp: 700,
        meanTemp: 340,
        
        hasAtmosphere: false,
        atmospherePressure: 0,
        
        ringSystem: false,
        hasClouds: false,
        
        moons: [],
        
        materials: PLANET_MATERIALS.mercury,
        textures: {
            map: PLANET_TEXTURES.MAPS.mercury,
            bumpMap: PLANET_TEXTURES.BUMPS.mercury
        }
    },
    {
        name: 'Venus',
        id: 'venus',
        type: 'terrestrial',
        radius: 6051.8,
        mass: 0.815,
        density: 5.243,
        gravity: 0.907,
        escapeVelocity: 10.36,
        
        distance: 0.723,
        orbitalPeriod: 224.7,
        orbitalSpeed: 35.02,
        orbitalInclination: 3.4,
        orbitalEccentricity: 0.007,
        
        rotationPeriod: -243.025,
        axialTilt: 177.4,
        
        minTemp: 737,
        maxTemp: 737,
        meanTemp: 737,
        
        hasAtmosphere: true,
        atmospherePressure: 92,
        atmosphereComposition: {
            CO2: 96.5,
            N2: 3.5
        },
        
        ringSystem: false,
        hasClouds: true,
        
        moons: [],
        
        materials: PLANET_MATERIALS.venus,
        textures: {
            map: PLANET_TEXTURES.MAPS.venus,
            cloudsMap: PLANET_TEXTURES.CLOUDS.venus
        }
    },
    {
        name: 'Earth',
        id: 'earth',
        type: 'terrestrial',
        radius: 6371.0,        // km
        mass: 1.0,             // Earth masses
        density: 5.514,        // g/cm³
        gravity: 1.0,          // g (Earth standard)
        escapeVelocity: 11.186,// km/s
        
        distance: 1.0,         // AU
        orbitalPeriod: 365.256363004, // days
        orbitalSpeed: 29.78,   // km/s
        orbitalInclination: 0.00005, // degrees to the invariable plane
        orbitalEccentricity: 0.0167086,
        
        rotationPeriod: 0.99726968, // days
        axialTilt: 23.4393,    // degrees
        
        meanTemp: 288,         // K
        minTemp: 184,          // K
        maxTemp: 330,          // K
        
        hasAtmosphere: true,
        atmospherePressure: 1.01325, // bar
        atmosphereComposition: {
            N2: 78.084,
            O2: 20.946,
            Ar: 0.934,
            CO2: 0.0417,
            Ne: 0.001818,
            He: 0.000524,
            CH4: 0.00017,
            Kr: 0.000114
        },
        
        ringSystem: false,
        hasClouds: true,
        
        moons: [{
            name: 'Luna',
            id: 'luna',
            radius: 1737.1,        // km (NASA confirmed)
            mass: 0.0123,          // Relative to Earth
            density: 3.344,        // g/cm³
            gravity: 0.1657,       // Relative to Earth
            
            distance: 384399,      // km - Average distance (NASA confirmed)
            orbitalPeriod: 27.322, // Sidereal orbital period in Earth days
            orbitalSpeed: 1.022,   // km/s
            orbitalInclination: 5.145, // degrees relative to Earth's equator
            orbitalEccentricity: 0.0549, // Added for accuracy
            
            rotationPeriod: 27.322,  // Tidally locked - same as orbital period
            axialTilt: 6.687,        // degrees relative to orbital plane
            
            albedo: 0.12,          // Bond albedo
            meanTemp: 250,         // K (average between day/night)
            
            // Adjusted material properties for better visibility
            materials: {
                color: 0xDDDDDD,
                emissive: 0x000000,
                roughness: 0.8,
                metalness: 0.1,
                bumpScale: 0.005,   // Increased for better crater visibility
                craterDetail: 1.0,
                albedo: 0.12,
                nightEmission: 0x000033
            },
            textures: {
                map: PLANET_TEXTURES.MOONS.luna.map,
                bumpMap: PLANET_TEXTURES.MOONS.luna.bumpMap
            }
        }],
        
        materials: PLANET_MATERIALS.earth,
        textures: {
            map: PLANET_TEXTURES.MAPS.earth,
            bumpMap: PLANET_TEXTURES.BUMPS.earth,
            specularMap: PLANET_TEXTURES.SPECULAR.earth,
            cloudsMap: PLANET_TEXTURES.CLOUDS.earth
        }
    },
    {
        name: 'Mars',
        id: 'mars',
        type: 'terrestrial',
        radius: 3389.5,
        mass: 0.107,
        density: 3.933,
        gravity: 0.379,
        escapeVelocity: 5.03,
        
        distance: 1.524,
        orbitalPeriod: 687,
        orbitalSpeed: 24.13,
        orbitalInclination: 1.85,
        orbitalEccentricity: 0.093,
        
        rotationPeriod: 1.026,
        axialTilt: 25.19,
        
        minTemp: 130,
        maxTemp: 308,
        meanTemp: 210,
        
        hasAtmosphere: true,
        atmospherePressure: 0.006,
        atmosphereComposition: {
            CO2: 95.3,
            N2: 2.7,
            Ar: 1.6
        },
        
        ringSystem: false,
        hasClouds: true,
        
        moons: ['Phobos', 'Deimos'],
        
        materials: PLANET_MATERIALS.mars,
        textures: {
            map: PLANET_TEXTURES.MAPS.mars,
            bumpMap: PLANET_TEXTURES.BUMPS.mars
        }
    },
    {
        name: 'Jupiter',
        id: 'jupiter',
        type: 'gas_giant',
        radius: 69911,
        mass: 317.8,
        density: 1.326,
        gravity: 2.528,
        escapeVelocity: 59.5,
        
        distance: 5.203,
        orbitalPeriod: 4333,
        orbitalSpeed: 13.07,
        orbitalInclination: 1.304,
        orbitalEccentricity: 0.048,
        
        rotationPeriod: 0.414,
        axialTilt: 3.13,
        
        minTemp: 110,
        maxTemp: 198,
        meanTemp: 165,
        
        hasAtmosphere: true,
        atmospherePressure: null, // No solid surface
        atmosphereComposition: {
            H2: 89.8,
            He: 10.2
        },
        
        ringSystem: true,
        hasClouds: true,
        
        moons: ['Io', 'Europa', 'Ganymede', 'Callisto'],
        
        materials: PLANET_MATERIALS.jupiter,
        textures: {
            map: PLANET_TEXTURES.MAPS.jupiter
        }
    },
    {
        name: 'Saturn',
        id: 'saturn',
        type: 'gas_giant',
        radius: 58232,
        mass: 95.2,
        density: 0.687,
        gravity: 1.065,
        escapeVelocity: 35.5,
        
        distance: 9.537,
        orbitalPeriod: 10759,
        orbitalSpeed: 9.68,
        orbitalInclination: 2.485,
        orbitalEccentricity: 0.054,
        
        rotationPeriod: 0.444,
        axialTilt: 26.73,
        
        minTemp: 84,
        maxTemp: 134,
        meanTemp: 134,
        
        hasAtmosphere: true,
        atmospherePressure: null,
        atmosphereComposition: {
            H2: 96.3,
            He: 3.7
        },
        
        ringSystem: true,
        hasClouds: true,
        
        moons: ['Titan', 'Enceladus', 'Mimas', 'Rhea'],
        
        materials: PLANET_MATERIALS.saturn,
        textures: {
            map: PLANET_TEXTURES.MAPS.saturn,
            ringsMap: PLANET_TEXTURES.RINGS.saturn
        }
    },
    {
        name: 'Uranus',
        id: 'uranus',
        type: 'ice_giant',
        radius: 25362,
        mass: 14.5,
        density: 1.27,
        gravity: 0.886,
        escapeVelocity: 21.3,
        
        distance: 19.191,
        orbitalPeriod: 30687,
        orbitalSpeed: 6.80,
        orbitalInclination: 0.772,
        orbitalEccentricity: 0.047,
        
        rotationPeriod: -0.718,
        axialTilt: 97.77,
        
        minTemp: 49,
        maxTemp: 76,
        meanTemp: 76,
        
        hasAtmosphere: true,
        atmospherePressure: null,
        atmosphereComposition: {
            H2: 82.5,
            He: 15.2,
            CH4: 2.3
        },
        
        ringSystem: true,
        hasClouds: true,
        
        moons: ['Miranda', 'Ariel', 'Umbriel', 'Titania', 'Oberon'],
        
        materials: PLANET_MATERIALS.uranus,
        textures: {
            map: PLANET_TEXTURES.MAPS.uranus,
            ringsMap: PLANET_TEXTURES.RINGS.uranus
        }
    },
    {
        name: 'Neptune',
        id: 'neptune',
        type: 'ice_giant',
        radius: 24622,
        mass: 17.1,
        density: 1.638,
        gravity: 1.14,
        escapeVelocity: 23.5,
        
        distance: 30.069,
        orbitalPeriod: 60190,
        orbitalSpeed: 5.43,
        orbitalInclination: 1.769,
        orbitalEccentricity: 0.009,
        
        rotationPeriod: 0.671,
        axialTilt: 28.32,
        
        minTemp: 55,
        maxTemp: 72,
        meanTemp: 72,
        
        hasAtmosphere: true,
        atmospherePressure: null,
        atmosphereComposition: {
            H2: 80.0,
            He: 19.0,
            CH4: 1.0
        },
        
        ringSystem: true,
        hasClouds: true,
        
        moons: ['Triton', 'Nereid', 'Naiad'],
        
        materials: PLANET_MATERIALS.neptune,
        textures: {
            map: PLANET_TEXTURES.MAPS.neptune
        }
    }
];

// Define zones
export const SOLAR_SYSTEM_ZONES = {
    habitable: {
        innerBoundary: 0.95,  // AU
        outerBoundary: 1.37,  // AU
        color: 0x00ff00,
        opacity: 0.1
    },
    frost: {
        boundary: 2.7,        // AU
        color: 0x0000ff,
        opacity: 0.1
    },
    rock: {
        boundary: 4.0,        // AU
        color: 0xff0000,
        opacity: 0.1
    }
};

// Define belt properties
export const BELT_PROPERTIES = {
    asteroid: {
        innerRadius: 2.2,     // AU
        outerRadius: 3.2,     // AU
        thickness: 0.1,       // AU
        particleCount: 2000,
        particleSize: { min: 0.05, max: 0.15 },
        color: 0x888888
    },
    kuiper: {
        innerRadius: 30,      // AU
        outerRadius: 50,      // AU
        thickness: 0.2,       // AU
        particleCount: 1000,
        particleSize: { min: 0.1, max: 0.3 },
        color: 0x666666
    }
};

// Scale factors for visualization
export const VISUALIZATION_SCALES = {
    distance: 100,      // 1 AU = 100 units
    size: 0.0001,      // Planet size scaling
    moon: {
        distance: 0.00005,  // Adjusted for realistic proportions
        size: 0.0002       // Slightly increased for visibility while maintaining proportion
    },
    time: {
        orbital: 1.0,
        rotation: 1.0
    }
};