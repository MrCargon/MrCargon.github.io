// Gravitational Wave Spacetime Distortion Vertex Shader
// Reference: Abbott et al. (2016), strain pattern h+ and hx polarizations
// LIGO GW150914 detection - September 14, 2015
// Purpose: Simulate spacetime distortion from gravitational wave events
// NASA Rules Compliance: Rule 2 (fixed bounds), Rule 1 (no recursion)

uniform float time;
uniform float waveSpeed;
uniform vec4 events[4];  // x, y, startTime, amplitude (NASA Rule 2: bounded)
uniform int eventCount;

varying vec3 vPosition;
varying float vStrain;

// NASA Rule 2: Fixed maximum events
const int MAX_EVENTS = 4;
const float PI = 3.14159265359;

void main() {
    vec3 pos = position;
    float totalStrain = 0.0;

    // NASA Rule 2: Fixed loop bound - process up to 4 simultaneous events
    for (int i = 0; i < MAX_EVENTS; i++) {
        if (i >= eventCount) break;

        vec4 event = events[i];
        vec2 eventPos = event.xy;
        float eventStart = event.z;
        float amplitude = event.w;

        // Skip inactive events
        if (amplitude == 0.0) continue;

        float elapsed = time - eventStart;
        if (elapsed < 0.0) continue;

        // Distance from event source (2D plane)
        float dist = distance(pos.xy, eventPos);

        // Wave propagation - radial expansion
        float wavePhase = dist - (elapsed * waveSpeed);

        // Chirp signal: frequency increases as waves approach merger
        // Reference: LIGO chirp signal f(t) = f0 * (1 + alpha*t)
        // Starting frequency 2.0, increasing by 0.5x per second elapsed
        float chirpFreq = 2.0 + (elapsed * 0.5);

        // Standing wave pattern with chirp
        float wave = sin(wavePhase * chirpFreq) * amplitude;

        // Gaussian decay with distance
        float decayFactor = exp(-dist / 200.0);

        // Temporal decay (wave energy dissipates over time)
        float timeDecay = exp(-elapsed * 0.02);

        // Calculate vertical displacement (visualizing h+ polarization)
        float displacement = wave * decayFactor * timeDecay * 20.0;

        // Apply to Z position (vertical distortion)
        pos.z += displacement;

        // Accumulate strain for color mapping
        totalStrain += displacement / 20.0;
    }

    vPosition = pos;
    vStrain = totalStrain;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
