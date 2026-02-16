// Gravitational Wave Fragment Shader - LIGO Standard Colormap
// Reference: LIGO Scientific Collaboration visualization guidelines
// https://www.ligo.org/science/Publication-GW150914/
// Purpose: Visualize gravitational wave strain using LIGO convention
// Purple (compression) -> White (zero) -> Yellow (stretch)

uniform float time;

varying vec3 vPosition;
varying float vStrain;

void main() {
    // LIGO-standard strain colormap
    // Reference: LIGO Scientific Collaboration (purple/yellow diverging)
    vec3 compressColor = vec3(0.5, 0.0, 0.5);  // Purple (negative strain)
    vec3 zeroColor = vec3(1.0, 1.0, 1.0);      // White (zero strain)
    vec3 stretchColor = vec3(1.0, 1.0, 0.0);   // Yellow (positive strain)

    // Deep space base color
    vec3 baseColor = vec3(0.05, 0.05, 0.08);

    // Map strain to color using LIGO convention
    // Normalize strain to -1 to +1 range
    float normalizedStrain = clamp(vStrain / 5.0, -1.0, 1.0);

    vec3 strainColor;
    if (normalizedStrain < 0.0) {
        // Negative strain (compression): white to purple
        strainColor = mix(zeroColor, compressColor, -normalizedStrain);
    } else {
        // Positive strain (stretch): white to yellow
        strainColor = mix(zeroColor, stretchColor, normalizedStrain);
    }

    // Spacetime grid visualization
    // Creates grid lines to show fabric distortion
    float gridX = fract(vPosition.x / 20.0);
    float gridY = fract(vPosition.y / 20.0);
    float grid = step(0.98, max(gridX, gridY));

    // Blend base color with strain color based on distortion magnitude
    vec3 finalColor = mix(baseColor, strainColor, abs(normalizedStrain) * 0.8);

    // Add grid lines (subtle gray)
    finalColor = mix(finalColor, vec3(0.4, 0.4, 0.5), grid * 0.3);

    // Edge fade for smooth boundaries
    float edgeFadeX = smoothstep(0.0, 0.1, vPosition.x / 250.0 + 0.5) *
                      smoothstep(1.0, 0.9, vPosition.x / 250.0 + 0.5);
    float edgeFadeY = smoothstep(0.0, 0.1, vPosition.y / 250.0 + 0.5) *
                      smoothstep(1.0, 0.9, vPosition.y / 250.0 + 0.5);
    float edgeFade = edgeFadeX * edgeFadeY;

    // Output with transparency
    gl_FragColor = vec4(finalColor, 0.6 * edgeFade);
}
