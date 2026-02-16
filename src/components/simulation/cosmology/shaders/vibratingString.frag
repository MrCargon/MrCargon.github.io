// Vibrating String Fragment Shader
// Visual representation of string vibration modes

uniform vec3 color;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vModeIntensity;

void main() {
    // Simple lighting model
    vec3 light = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = max(dot(normalize(vNormal), light), 0.3); // Minimum ambient

    // Glow effect based on vibration intensity
    float glow = 0.6 + 0.4 * vModeIntensity;

    // Final color with intensity and lighting
    vec3 finalColor = color * diffuse * glow;

    // Slight transparency for ethereal look
    float alpha = 0.9;

    gl_FragColor = vec4(finalColor, alpha);
}
