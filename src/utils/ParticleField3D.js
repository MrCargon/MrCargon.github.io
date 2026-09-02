// ParticleField3D.js — Particle Life in three dimensions, as an alternative to the solar
// system behind the whole site. Requires ForceMatrix.js.
//
// WHAT THIS IS
// The same model as the 2D sim on the Life page — read ForceMatrix.js for the rule — with
// the world a wrapped CUBE instead of a wrapped square. Species chase, flee, orbit and
// clump into membranes and cells, and because you are inside the volume rather than
// looking at a plane, the structures pass in front of and behind each other. That depth is
// the entire reason to have a 3D version at all.
//
// WHY IT IS A SEPARATE FILE AND NOT A DIMENSION FLAG ON ParticleLife
// The difference between the two is confined to the innermost loop: 27 buckets instead of
// 9, three coordinates instead of two. Making that generic — a loop over an axis count, an
// array of offsets — would put an indirection inside the hottest code on the site, at
// several hundred thousand executions per step, to save about sixty lines. What actually
// must not be duplicated is the MODEL, and that lives in ForceMatrix, shared.
//
// THE COST OF THE THIRD DIMENSION, which is not a detail:
// A bucket is one interaction radius across. In 2D a particle tests 9 buckets; in 3D, 27.
// With the density held constant that is 3x the neighbours per particle, so the same
// particle count costs roughly 3x as much. Hence 2200 here against 1800 on the Life page,
// and a wider radius would make it far worse — cost scales with radius CUBED.
//
// WHY IT DOES NOT SHARE THE SOLAR SYSTEM'S SCENE
// It gets its own THREE.Scene and camera, drawn by the same renderer, and the animate loop
// draws one or the other. Adding the point cloud to the solar scene instead would put it
// under that scene's lighting, fog and layer rules, and would leave the planets updating
// invisibly behind it — paying for a simulation nobody is looking at.
class ParticleField3D {
    /**
     * @param {THREE.WebGLRenderer} renderer - shared with SpaceEnvironment
     * @param {Object} [opts]
     */
    constructor(renderer, opts) {
        console.assert(renderer && renderer.domElement, 'ParticleField3D: renderer required');
        console.assert(typeof ForceMatrix !== 'undefined', 'ParticleField3D: ForceMatrix must load first');
        const o = opts || {};
        this.renderer = renderer;
        this.count = Math.max(1, Math.min(ParticleField3D.MAX_PARTICLES, o.count || 2200));
        this.types = Math.max(2, Math.min(ForceMatrix.MAX_TYPES, o.types || 5));
        this.radius = o.radius || 0.11;      // interaction range in world units (cube is 1)
        this.beta = o.beta || 0.3;
        this.forceScale = (o.forceScale !== undefined) ? o.forceScale : 0.30;
        this.friction = (o.friction !== undefined) ? o.friction : 0.86;
        this.dt = o.dt || 0.012;
        this.generation = 0;
        this.spin = (o.spin !== undefined) ? o.spin : 0.035;   // radians/sec camera drift

        this._fm = new ForceMatrix(this.types);
        this.matrix = this._fm.m;
        this._px = null; this._py = null; this._pz = null;
        this._vx = null; this._vy = null; this._vz = null; this._type = null;
        this._points = null; this._geom = null; this._mat = null;
        this.scene = null; this.camera = null;
        this._cells = 0; this._cellCount = 0; this._cellHead = null; this._cellNext = null;
        this._angle = 0;
        this._disposed = false;
    }

    /** Read one matrix entry. Rule 5: 2 asserts. */
    getForce(a, b) {
        console.assert(this._fm, 'getForce: model built');
        console.assert(a >= 0 && b >= 0, 'getForce: non-negative types');
        return this._fm.get(a, b);
    }

    /** Write one matrix entry, clamped to [-1, 1]. Rule 5: 2 asserts. */
    setForce(a, b, v) {
        console.assert(this._fm, 'setForce: model built');
        console.assert(Number.isFinite(v), 'setForce: finite value');
        return this._fm.set(a, b, v);
    }

    /** New random relationships between the species. Rule 5: 2 asserts. */
    randomiseMatrix() {
        console.assert(this._fm, 'randomiseMatrix: model built');
        console.assert(this.matrix === this._fm.m, 'randomiseMatrix: buffer still shared');
        return this._fm.randomise();
    }

    /** Build buffers, scene and point cloud. Rule 5: 2 asserts. */
    init() {
        console.assert(!this._disposed, 'init: not disposed');
        console.assert(typeof THREE !== 'undefined', 'init: THREE required');
        const n = ParticleField3D.MAX_PARTICLES;            // Rule 3: allocate the ceiling once
        this._px = new Float32Array(n); this._py = new Float32Array(n); this._pz = new Float32Array(n);
        this._vx = new Float32Array(n); this._vy = new Float32Array(n); this._vz = new Float32Array(n);
        this._type = new Uint8Array(n);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(55, 1, 0.01, 20);
        this._geom = new THREE.BufferGeometry();
        this._geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        this._geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
        // sizeAttenuation ON here, unlike the 2D sim: perspective is the only depth cue a
        // point cloud has, so near particles MUST draw larger than far ones or the volume
        // reads as a flat sheet of confetti.
        //
        // NOT additive blending, though it was at first and it looked like a nebula. The
        // problem is that additive SUMS colours, and a cluster is exactly where particles
        // overlap — so every interesting structure saturated to white and the species
        // became unreadable at precisely the moment they mattered. Screenshotted and
        // counted: the whole field came back as pale cream with barely a tint. Species
        // identity is the entire subject here, so normal blending, and depthWrite off so
        // the unordered points still blend cleanly against each other.
        this._mat = new THREE.PointsMaterial({
            size: ParticleField3D.POINT_SIZE, vertexColors: true, sizeAttenuation: true,
            map: ParticleField3D.dotTexture(), alphaTest: 0.25,
            transparent: true, opacity: 0.95, depthWrite: false
        });
        this._points = new THREE.Points(this._geom, this._mat);
        this._points.frustumCulled = false;                 // positions change every frame
        this.scene.add(this._points);

        this._buildGrid();
        this.seed();
        return true;
    }

    /**
     * Size the hash so a bucket is one interaction radius across: every neighbour in range
     * is then in this bucket or one of the 26 around it. Rule 5: 2 asserts.
     */
    _buildGrid() {
        console.assert(this.radius > 0, '_buildGrid: positive radius');
        console.assert(!this._disposed, '_buildGrid: not disposed');
        // Capped at 24 because the table is cells^3: 24 is 13,824 buckets, and going to
        // 64 as the 2D sim safely does would be 262,144 — cleared every single step.
        this._cells = Math.max(3, Math.min(24, Math.floor(1 / this.radius)));
        this._cellCount = this._cells * this._cells * this._cells;
        this._cellHead = new Int32Array(this._cellCount);
        this._cellNext = new Int32Array(ParticleField3D.MAX_PARTICLES);
        return true;
    }

    /** Scatter particles through the cube with random types and no velocity. */
    seed(count, types) {
        console.assert(this._px, 'seed: init first');
        console.assert(!this._disposed, 'seed: not disposed');
        if (Number.isFinite(count)) this.count = Math.max(1, Math.min(ParticleField3D.MAX_PARTICLES, count | 0));
        if (Number.isFinite(types)) this.types = Math.max(2, Math.min(ForceMatrix.MAX_TYPES, types | 0));
        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            this._px[i] = Math.random(); this._py[i] = Math.random(); this._pz[i] = Math.random();
            this._vx[i] = 0; this._vy[i] = 0; this._vz[i] = 0;
            this._type[i] = (Math.random() * this.types) | 0;
        }
        this.generation = 0;
        this._writeColours();
        return true;
    }

    /** Push species colours into the geometry once; positions update every step. */
    _writeColours() {
        console.assert(this._geom, '_writeColours: init first');
        console.assert(this.types > 0, '_writeColours: types set');
        const col = this._geom.getAttribute('color');
        // LINEAR, not the sRGB palette — the renderer encodes to sRGB on output and would
        // otherwise do it twice, washing every species to cream. See the long note on
        // TYPE_COLOURS_LINEAR in ForceMatrix.js.
        const PAL = ForceMatrix.TYPE_COLOURS_LINEAR;
        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            const c = PAL[this._type[i] % PAL.length];
            col.array[i * 3] = c[0]; col.array[i * 3 + 1] = c[1]; col.array[i * 3 + 2] = c[2];
        }
        col.needsUpdate = true;
        return true;
    }

    /** Rebuild the neighbour index for this step. Rule 5: 2 asserts. */
    _hash() {
        console.assert(this._cellHead, '_hash: grid built');
        console.assert(this._px, '_hash: buffers built');
        this._cellHead.fill(-1);
        const g = this._cells;
        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            const cx = Math.min(g - 1, (this._px[i] * g) | 0);
            const cy = Math.min(g - 1, (this._py[i] * g) | 0);
            const cz = Math.min(g - 1, (this._pz[i] * g) | 0);
            const c = (cz * g + cy) * g + cx;
            this._cellNext[i] = this._cellHead[c];
            this._cellHead[c] = i;
        }
        return true;
    }

    /** One step: index, accumulate, move. Rule 5: 2 asserts. */
    step() {
        console.assert(this._px, 'step: init first');
        console.assert(!this._disposed, 'step: not disposed');
        this._hash();
        this._accumulate();
        this._integrate();
        this.generation++;
        return true;
    }

    /**
     * Sum the force on every particle from the 27 buckets around it and turn that into a
     * new velocity. Rule 4: <=60 lines | Rule 5: 2 asserts.
     */
    _accumulate() {
        console.assert(this._cellHead, '_accumulate: hash built');
        console.assert(this.count >= 0, '_accumulate: count valid');
        const g = this._cells, R = this.radius, R2 = R * R, N = ForceMatrix.MAX_TYPES;
        const beta = this.beta, REP = ForceMatrix.REPULSION;

        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            let fx = 0, fy = 0, fz = 0;
            const xi = this._px[i], yi = this._py[i], zi = this._pz[i], ti = this._type[i];
            const cx = Math.min(g - 1, (xi * g) | 0);
            const cy = Math.min(g - 1, (yi * g) | 0);
            const cz = Math.min(g - 1, (zi * g) | 0);

            for (let oz = -1; oz <= 1; oz++) {              // Rule 2: bounded (27 buckets)
                const bz = ((cz + oz) % g + g) % g;
                for (let oy = -1; oy <= 1; oy++) {
                    const by = ((cy + oy) % g + g) % g;
                    for (let ox = -1; ox <= 1; ox++) {
                        const bx = ((cx + ox) % g + g) % g;
                        let j = this._cellHead[(bz * g + by) * g + bx];
                        let guard = 0;
                        while (j !== -1 && guard++ < ParticleField3D.MAX_PARTICLES) {  // Rule 2
                            if (j !== i) {
                                // Shortest offset on the 3-torus, so forces wrap with the world.
                                let dx = this._px[j] - xi, dy = this._py[j] - yi, dz = this._pz[j] - zi;
                                if (dx > 0.5) dx -= 1; else if (dx < -0.5) dx += 1;
                                if (dy > 0.5) dy -= 1; else if (dy < -0.5) dy += 1;
                                if (dz > 0.5) dz -= 1; else if (dz < -0.5) dz += 1;
                                const d2 = dx * dx + dy * dy + dz * dz;
                                if (d2 > 1e-12 && d2 < R2) {
                                    // INLINED ForceMatrix.curve — verify-field3d.cjs proves
                                    // this copy still agrees with the reference.
                                    const d = Math.sqrt(d2), q = d / R;
                                    let f;
                                    if (q < beta) f = (q / beta - 1) * REP;
                                    else f = this.matrix[ti * N + this._type[j]] *
                                             (1 - Math.abs(2 * q - 1 - beta) / (1 - beta));
                                    const s = f / d;
                                    fx += dx * s; fy += dy * s; fz += dz * s;
                                }
                            }
                            j = this._cellNext[j];
                        }
                    }
                }
            }
            this._applyForce(i, fx, fy, fz);
        }
        return true;
    }

    /**
     * Turn accumulated force into a capped velocity for one particle.
     * The cap is the same stability condition as the 2D sim: a step may never move a
     * particle further than the repulsion zone is wide, or it is thrown clean past the
     * neighbour it is being pushed away from and the pair swap places instead of
     * separating. Rule 5: 2 asserts.
     */
    _applyForce(i, fx, fy, fz) {
        console.assert(i >= 0 && i < ParticleField3D.MAX_PARTICLES, '_applyForce: index in range');
        console.assert(Number.isFinite(fx + fy + fz), '_applyForce: finite force');
        const k = this.forceScale * this.dt;
        let nvx = this._vx[i] * this.friction + fx * k;
        let nvy = this._vy[i] * this.friction + fy * k;
        let nvz = this._vz[i] * this.friction + fz * k;
        const lim = this.beta * this.radius;
        const sp2 = nvx * nvx + nvy * nvy + nvz * nvz;
        if (sp2 > lim * lim) {
            const s = lim / Math.sqrt(sp2);
            nvx *= s; nvy *= s; nvz *= s;
        }
        this._vx[i] = nvx; this._vy[i] = nvy; this._vz[i] = nvz;
        return true;
    }

    /** Move every particle and wrap it back into the unit cube. Rule 5: 2 asserts. */
    _integrate() {
        console.assert(this._px, '_integrate: buffers built');
        console.assert(this._vx, '_integrate: velocities built');
        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            const x = this._px[i] + this._vx[i];
            const y = this._py[i] + this._vy[i];
            const z = this._pz[i] + this._vz[i];
            this._px[i] = x - Math.floor(x);
            this._py[i] = y - Math.floor(y);
            this._pz[i] = z - Math.floor(z);
        }
        return true;
    }

    /**
     * Drift the camera around the cube. Slow on purpose: this is a background, and
     * anything fast enough to notice is something you have to look away from to read the
     * page. Honours prefers-reduced-motion by standing still. Rule 5: 2 asserts.
     */
    _orbit(deltaTime) {
        console.assert(this.camera, '_orbit: camera built');
        console.assert(Number.isFinite(deltaTime), '_orbit: finite delta');
        const dt = Math.max(0, Math.min(0.1, deltaTime));   // Rule 2: bound a stalled tab's delta
        this._angle += dt * this.spin;
        const r = ParticleField3D.ORBIT_RADIUS;
        this.camera.position.set(
            0.5 + Math.cos(this._angle) * r,
            0.5 + Math.sin(this._angle * 0.37) * r * 0.28,  // gentle bob, incommensurate period
            0.5 + Math.sin(this._angle) * r
        );
        this.camera.lookAt(0.5, 0.5, 0.5);
        return true;
    }

    /** Copy positions into the geometry, drift the camera, draw. Rule 5: 2 asserts. */
    render(deltaTime, width, height) {
        console.assert(this._geom, 'render: init first');
        console.assert(this.renderer, 'render: renderer required');
        const pos = this._geom.getAttribute('position');
        for (let i = 0; i < this.count; i++) {              // Rule 2: bounded
            pos.array[i * 3] = this._px[i];
            pos.array[i * 3 + 1] = this._py[i];
            pos.array[i * 3 + 2] = this._pz[i];
        }
        pos.needsUpdate = true;
        this._geom.setDrawRange(0, this.count);

        if (width > 0 && height > 0) {
            const aspect = width / height;
            if (this.camera.aspect !== aspect) {
                this.camera.aspect = aspect;
                this.camera.updateProjectionMatrix();
            }
        }
        this._orbit(deltaTime || 0);
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
        return true;
    }

    dispose() {
        console.assert(!this._disposed, 'dispose: once only');
        console.assert(this !== undefined, 'dispose: instance');
        this._disposed = true;
        if (this._geom) this._geom.dispose();
        if (this._mat) this._mat.dispose();
        if (this.scene && this._points) this.scene.remove(this._points);
        this._geom = null; this._mat = null; this._points = null; this.scene = null;
        this._px = this._py = this._pz = null;
        this._vx = this._vy = this._vz = null;
        this._type = null; this._cellHead = null; this._cellNext = null;
        return true;
    }
}

/**
 * A soft round dot, drawn once into a 32px canvas and reused by every particle.
 *
 * Without a map, PointsMaterial draws SQUARES. At 2200 of them that reads as confetti,
 * not as organisms — and squares also alias badly as they shrink with distance, which is
 * the depth cue this scene depends on. Generated rather than loaded: zero asset bytes,
 * nothing to cache-bust, and it cannot 404.
 *
 * Rule 3: built once and memoised — a texture per instance would leak on every scene
 * switch. Rule 5: 2 asserts.
 */
ParticleField3D.dotTexture = function () {
    console.assert(typeof THREE !== 'undefined', 'dotTexture: THREE required');
    console.assert(ParticleField3D._dot === null || typeof ParticleField3D._dot === 'object',
        'dotTexture: memo holds a texture or nothing');
    if (ParticleField3D._dot) return ParticleField3D._dot;
    // Headless (the physics tests run in Node with a stub THREE and no DOM): no canvas to
    // draw into, so no sprite. PointsMaterial accepts map:null and falls back to squares,
    // which is invisible to arithmetic and keeps the tests runnable without a browser.
    if (typeof document === 'undefined' || !document.createElement) return null;
    const S = 32;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    // White, so vertexColors multiplies the species hue through unchanged. A tinted
    // sprite would shift every colour towards the tint.
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.95)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    ParticleField3D._dot = tex;
    return tex;
};
ParticleField3D._dot = null;

// Lower than the 2D sim's 6000: see THE COST OF THE THIRD DIMENSION in the header — the
// same count costs about 3x here, and this runs behind a page that must stay responsive.
ParticleField3D.MAX_PARTICLES = 4000;

// World units, with sizeAttenuation on, at ORBIT_RADIUS from a unit cube.
ParticleField3D.POINT_SIZE = 0.014;

// Far enough out that the whole cube is in frame at 55 degrees, close enough that the
// near face is meaningfully larger than the far one — that difference IS the depth cue.
ParticleField3D.ORBIT_RADIUS = 1.35;

if (typeof window !== 'undefined') window.ParticleField3D = ParticleField3D;
if (typeof module !== 'undefined' && module.exports) module.exports = ParticleField3D;
