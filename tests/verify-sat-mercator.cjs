#!/usr/bin/env node
/**
 * verify-sat-mercator.cjs - imagery patches put each texel row at its Web Mercator latitude
 * (roast R1 #11).
 *
 * Esri tiles are Web Mercator: texture v is linear in Mercator y, not in latitude. The patch
 * builder used to place vertex rows linearly between the tile's north and south edges, so
 * the picture slid north/south inside the tile: 225 km at z3, 15 km at z5 (the top of the
 * imagery band), 4 km at z6. Rows now sit at tileToLngLat(x, y + j/N).lat.
 *
 * For every tile row of zooms 3..8 (one column) this builds the patch with the real
 * _buildPatchGeometry, reads each vertex back to a latitude, and compares it with the
 * Mercator latitude of the texture row that vertex shows (from its uv). It also reports the
 * error halfway between two vertex rows (what linear interpolation inside a triangle leaves).
 *
 * Usage: node tests/verify-sat-mercator.cjs [path/to/SatelliteTiles.js]  Exit 0 = pass.
 * Against the pre-fix SatelliteTiles.js it fails (vertex error 225 km at z3).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const satPath = process.argv[2] || path.join(root, 'src', 'utils', 'SatelliteTiles.js');

class Vector3 { constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
class Float32BufferAttribute { constructor(a, n) { this.array = Float32Array.from(a); this.itemSize = n; } }
class BufferGeometry { constructor() { this.attributes = {}; } setAttribute(k, a) { this.attributes[k] = a; } setIndex(i) { this.index = i; } }
const THREE = { Vector3, BufferGeometry, Float32BufferAttribute };
const sandbox = { module: { exports: {} }, console, THREE, Math };
vm.createContext(sandbox);
// GlobeMath is a top-level const: re-expose it on the sandbox for the second script.
vm.runInContext(fs.readFileSync(path.join(root, 'src', 'utils', 'GlobeMath.js'), 'utf8') + '\nthis.GlobeMath = GlobeMath;', sandbox);
vm.runInContext(fs.readFileSync(satPath, 'utf8'), sandbox, { filename: satPath });
const ST = sandbox.module.exports;
const GM = sandbox.GlobeMath;

const N = 12, KM_PER_DEG = 6371 * Math.PI / 180;
const self = { patchSegments: N, radius: 1, rOffset: 1, projection: 'mercator', _toLngLat: ST.prototype._toLngLat };
const latOf = (y, z) => ST.tileToLngLat(0, y, z).lat;
let worstVertex = 0, fails = 0;
const rows = [];
for (let z = 3; z <= 8; z++) {
    let vErr = 0, midErr = 0;
    const n = Math.pow(2, z);
    for (let y = 0; y < n; y++) {
        const g = ST.prototype._buildPatchGeometry.call(self, z, 0, y);
        const pos = g.attributes.position.array, uv = g.attributes.uv.array;
        const lats = [];
        for (let j = 0; j <= N; j++) {
            const k = j * (N + 1);                                   // column 0 of row j
            const lat = GM.vector3ToLatLng({ x: pos[k * 3], y: pos[k * 3 + 1], z: pos[k * 3 + 2] }, 1).lat;
            const want = latOf(y + (1 - uv[k * 2 + 1]), z);          // the texture row it shows
            vErr = Math.max(vErr, Math.abs(lat - want) * KM_PER_DEG);
            lats.push(lat);
        }
        for (let j = 0; j < N; j++) {                                // halfway between rows
            const mid = (lats[j] + lats[j + 1]) / 2;
            midErr = Math.max(midErr, Math.abs(mid - latOf(y + (j + 0.5) / N, z)) * KM_PER_DEG);
        }
    }
    worstVertex = Math.max(worstVertex, vErr);
    rows.push({ z, vertexKm: +vErr.toFixed(3), betweenRowsKm: +midErr.toFixed(3) });
}
console.table(rows);
// Positive control: the measure does see a Mercator vs linear difference at z3.
const ctrl = Math.abs((latOf(0, 3) + latOf(1, 3)) / 2 - latOf(0.5, 3)) * KM_PER_DEG;
console.log('control: linear vs Mercator mid-tile at z3, row 0 = ' + ctrl.toFixed(0) + ' km');
if (!(ctrl > 10)) { console.log('FAIL control: the measure cannot see the error'); fails++; }
if (!(worstVertex < 0.01)) { console.log('FAIL vertex rows off their Mercator latitude by ' + worstVertex.toFixed(2) + ' km'); fails++; }
const z5 = rows.find((r) => r.z === 5);
if (!(z5.betweenRowsKm < 1)) { console.log('FAIL z5 between-row error ' + z5.betweenRowsKm + ' km'); fails++; }
console.log(fails ? 'FAIL' : 'PASS');
process.exit(fails ? 1 : 0);
