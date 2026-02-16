// Vibrating String Vertex Shader - ZERO CPU allocations per frame
// Standing wave animation: y(x,t) = A * sin(n*pi*x/L) * cos(omega*t)
// Reference: String Theory - Polchinski (1998)

uniform float time;
uniform float amplitude;
uniform float frequency;
uniform float mode1;
uniform float mode2;
uniform float mode3;
uniform float stringLength;

attribute vec3 basePosition;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vModeIntensity;

// NASA Rule 2: Fixed mode count (max 3)
const int MAX_MODES = 3;
const float PI = 3.14159265359;

void main() {
    // NASA Rule 5: Assertions via defensive conditionals
    vec3 pos = basePosition;

    // Calculate normalized position along string (0 to 1)
    // Y-axis is string length for cylinder geometry
    float t = (pos.y + stringLength * 0.5) / stringLength;

    // Clamp to valid range
    t = clamp(t, 0.0, 1.0);

    // Sum contributions from each vibrational mode
    // Different modes represent different particle types
    float displacementX = 0.0;
    float displacementZ = 0.0;
    float totalModeStrength = 0.0;

    // Mode 1 (fundamental - e.g., electron)
    if (mode1 > 0.0) {
        float modeFreq = frequency * mode1;
        float modeAmp = amplitude / mode1;
        float spatial = sin(mode1 * PI * t);
        float temporal = cos(2.0 * PI * modeFreq * time);
        float temporalZ = sin(2.0 * PI * modeFreq * time + 0.785); // Phase shift for 3D effect

        displacementX += modeAmp * spatial * temporal;
        displacementZ += modeAmp * spatial * temporalZ;
        totalModeStrength += abs(spatial);
    }

    // Mode 2 (first harmonic - e.g., up quark)
    if (mode2 > 0.0) {
        float modeFreq = frequency * mode2;
        float modeAmp = amplitude / mode2;
        float spatial = sin(mode2 * PI * t);
        float temporal = cos(2.0 * PI * modeFreq * time);
        float temporalZ = sin(2.0 * PI * modeFreq * time + 0.785);

        displacementX += modeAmp * spatial * temporal;
        displacementZ += modeAmp * spatial * temporalZ;
        totalModeStrength += abs(spatial);
    }

    // Mode 3 (second harmonic - e.g., down quark)
    if (mode3 > 0.0) {
        float modeFreq = frequency * mode3;
        float modeAmp = amplitude / mode3;
        float spatial = sin(mode3 * PI * t);
        float temporal = cos(2.0 * PI * modeFreq * time);
        float temporalZ = sin(2.0 * PI * modeFreq * time + 0.785);

        displacementX += modeAmp * spatial * temporal;
        displacementZ += modeAmp * spatial * temporalZ;
        totalModeStrength += abs(spatial);
    }

    // Apply displacement perpendicular to string axis
    // String vibrates in plane perpendicular to length
    pos.x += displacementX;
    pos.z += displacementZ;

    vPosition = pos;
    vNormal = normal;
    vModeIntensity = totalModeStrength / 3.0; // Normalized mode intensity

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
