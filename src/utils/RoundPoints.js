// RoundPoints.js - round, soft, screen-clamped point sprites for THREE.Points.
//
// A bare THREE.PointsMaterial with no `map` rasterises every point as a SQUARE,
// and with sizeAttenuation its pixel size grows without bound as the camera
// closes in (CosmicDust showed 20-40 px grey squares around Earth; the GeoLOD
// cities 7-25 px yellow squares). This patches a PointsMaterial in place via
// onBeforeCompile, so colour handling (diffuse, vertexColors, opacity, fog,
// colour space) stays exactly the stock path:
//   - fragment: analytic disc from gl_PointCoord with a ~1 device-pixel
//     anti-aliased rim (crisp at any pixel ratio, no texture), optional soft
//     glow falloff (soft 0 = crisp disc, 1 = gaussian-like mote).
//   - vertex: pixel size clamped to [minPx, maxPx] CSS px (x devicePixelRatio);
//     points that would be smaller than minPx fade instead of shrinking (no
//     sub-pixel shimmer).
//   - optional near fade: points closer to the camera than nearFade[0] world
//     units are hidden, ramping to full by nearFade[1] (dust around the focused
//     planet, where the camera sits).
//   - optional rank declutter: per-vertex attribute `rpRank` in [0,1] (0 = most
//     important); points with rank above the uniform uRankCut fade out.
// global THREE (r184). Classic script, no modules.
const RoundPoints = {
    // Patch `material` (a THREE.PointsMaterial). Returns the uniform bag so the
    // caller can drive uRankCut / uNearFade later. Rule 4: <=60 lines.
    apply(material, opts = {}) {
        console.assert(material && material.isPointsMaterial, 'RoundPoints.apply: PointsMaterial required');
        console.assert(opts && typeof opts === 'object', 'RoundPoints.apply: opts object required');
        const near = Array.isArray(opts.nearFade) ? opts.nearFade : [-2, -1];
        const u = {
            uDpr: { value: (typeof window !== 'undefined' && window.devicePixelRatio) || 1 },
            uMinPx: { value: Number.isFinite(opts.minPx) ? opts.minPx : 1.5 },
            uMaxPx: { value: Number.isFinite(opts.maxPx) ? opts.maxPx : 8 },
            uSoft: { value: Number.isFinite(opts.soft) ? opts.soft : 0 },
            uNearFade: { value: new THREE.Vector2(near[0], near[1]) },
            uRankCut: { value: 1.0 }
        };
        const useRank = Boolean(opts.rank);
        material.userData.roundPoints = u;
        material.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, u);
            shader.vertexShader = RoundPoints._vertex(shader.vertexShader, useRank);
            shader.fragmentShader = RoundPoints._fragment(shader.fragmentShader);
        };
        material.customProgramCacheKey = () => 'roundpoints-v1-' + (useRank ? 'r' : 'n');
        material.needsUpdate = true;
        return u;
    },

    // Keep uDpr in step with the renderer (pixel ratio can change on zoom/monitor
    // move). Rule 5: 2 asserts.
    attach(points) {
        console.assert(points && points.isPoints, 'RoundPoints.attach: Points required');
        console.assert(points.material && points.material.userData, 'RoundPoints.attach: material required');
        const u = points.material.userData.roundPoints;
        if (!u) return false;
        points.onBeforeRender = (renderer) => { u.uDpr.value = renderer.getPixelRatio(); };
        return true;
    },

    _vertex(src, useRank) {
        console.assert(typeof src === 'string', 'RoundPoints._vertex: source required');
        console.assert(src.indexOf('#include <logdepthbuf_vertex>') >= 0, 'RoundPoints._vertex: points chunk changed');
        const head = 'uniform float uDpr; uniform float uMinPx; uniform float uMaxPx;\n' +
            'uniform vec2 uNearFade; uniform float uRankCut;\n' +
            (useRank ? 'attribute float rpRank;\n' : '') +
            'varying float vRpFade; varying float vRpSize;\n';
        const body = [
            'float rpMin = uMinPx * uDpr;',
            'float rpPx = gl_PointSize' + (useRank ? ' * mix(1.0, 0.7, rpRank)' : '') + ';',
            'vRpFade = clamp(rpPx / rpMin, 0.0, 1.0);',
            'gl_PointSize = clamp(rpPx, rpMin, uMaxPx * uDpr);',
            'vRpSize = gl_PointSize;',
            'vRpFade *= smoothstep(uNearFade.x, uNearFade.y, length(mvPosition.xyz));',
            useRank ? 'vRpFade *= 1.0 - smoothstep(uRankCut - 0.04, uRankCut, rpRank);' : '',
            '#include <logdepthbuf_vertex>'
        ].join('\n');
        return head + src.replace('#include <logdepthbuf_vertex>', body);
    },

    _fragment(src) {
        console.assert(typeof src === 'string', 'RoundPoints._fragment: source required');
        console.assert(src.indexOf('#include <alphatest_fragment>') >= 0, 'RoundPoints._fragment: points chunk changed');
        const head = 'uniform float uSoft;\nvarying float vRpFade; varying float vRpSize;\n';
        const body = [
            'vec2 rpUv = gl_PointCoord * 2.0 - 1.0;',
            'float rpR = length(rpUv);',
            // the sprite spans 2 uv units over vRpSize device px -> ~1 px rim
            'float rpAa = min(2.0 / max(vRpSize, 1.0), 1.0);',
            'float rpDisc = 1.0 - smoothstep(1.0 - rpAa, 1.0, rpR);',
            'float rpGlow = (1.0 - min(rpR * rpR, 1.0)); rpGlow *= rpGlow;',
            'float rpA = mix(rpDisc, rpDisc * rpGlow, uSoft) * vRpFade;',
            'if (rpA < 0.004) discard;',
            'diffuseColor.a *= rpA;',
            '#include <alphatest_fragment>'
        ].join('\n');
        return head + src.replace('#include <alphatest_fragment>', body);
    }
};

if (typeof window !== 'undefined') {
    window.RoundPoints = RoundPoints;
}
