#!/usr/bin/env node
/**
 * verify-sat-geodetic.cjs - satellites sit over the same map point as the lat/lng layers
 * (roast R1 #12, geodetic vs geocentric latitude).
 *
 * The globe is a sphere, and every lat/lng layer (borders, cities, quakes, tiles, the ISS
 * marker) puts a geodetic latitude straight onto it. The satellite layer used to place
 * SGP4's Earth-fixed km vector as it is, so its direction gave the GEOCENTRIC latitude:
 * up to 0.19 deg (about 21 km on the ground) short of the map point the satellite is
 * really over, at 45 deg. Satellites now go through geodetic latitude + height, like the
 * ISS marker (radius 1 + h / 6371).
 *
 * For every object in the bundled snapshot, at a fixed date, this runs the real
 * Satellites._propagate, reads each dot back to a latitude, and compares it with
 * satellite.eciToGeodetic's subpoint latitude. Reports the worst ground error in km.
 *
 * Usage: node tests/verify-sat-geodetic.cjs [path/to/Satellites.js]  Exit 0 = pass.
 * Against the pre-fix Satellites.js (git show da823ef:src/utils/Satellites.js) it fails
 * with about 21 km.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const satPath = process.argv[2] || path.join(root, 'src', 'utils', 'Satellites.js');
const sandbox = { module: { exports: {} }, console, Math, Date, Float32Array, Uint8Array };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'src', 'assets', 'vendor', 'satellite.min.js'), 'utf8')
    + '\nthis.satellite = satellite;', sandbox);
const lib = sandbox.satellite;
sandbox.module = { exports: {} };
vm.runInContext(fs.readFileSync(satPath, 'utf8'), sandbox, { filename: satPath });
const Sat = sandbox.module.exports;

const snap = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'satellites-snapshot.json'), 'utf8'));
const records = [];
for (const id of Object.keys(snap.groups)) {
    for (const omm of snap.groups[id]) {
        try { const s = lib.json2satrec(omm); if (!s.error) records.push({ satrec: s, name: omm.OBJECT_NAME }); } catch (e) { /* skip */ }
    }
}
const now = Date.parse(snap.fetched) || Date.UTC(2026, 10, 19, 12);
const self = {
    _records: records, kmToUnits: 1 / 6371, _positions: new Float32Array(records.length * 3),
    points: { geometry: { attributes: { position: {} } } }, _markHidden() {}
};
Sat.prototype._propagate.call(self, now);

const date = new Date(now), gmst = lib.gstime(date), KM_PER_DEG = 6371 * Math.PI / 180;
let worst = 0, worstName = '', worstLat = 0, worstH = 0, worstLng = 0, n = 0;
for (let i = 0; i < records.length; i++) {
    const st = lib.propagate(records[i].satrec, date);
    if (!st || !st.position) continue;
    const geo = lib.eciToGeodetic(st.position, gmst);
    const x = self._positions[i * 3], y = self._positions[i * 3 + 1], z = self._positions[i * 3 + 2];
    const r = Math.hypot(x, y, z);
    if (!(r > 0)) continue;
    const drawnLat = Math.asin(y / r) * 180 / Math.PI;
    const wantLat = geo.latitude * 180 / Math.PI;
    const drawnLng = Math.atan2(-z, x), dl = Math.atan2(Math.sin(drawnLng - geo.longitude), Math.cos(drawnLng - geo.longitude));
    const lngErr = Math.abs(dl) * 180 / Math.PI * KM_PER_DEG * Math.cos(geo.latitude);
    if (lngErr > worstLng) worstLng = lngErr;
    const err = Math.abs(drawnLat - wantLat) * KM_PER_DEG;      // ground km at the subpoint
    const hErr = Math.abs((r - 1) * 6371 - geo.height);          // drawn height vs geodetic height
    n++;
    if (err > worst) { worst = err; worstName = records[i].name; worstLat = wantLat; }
    if (hErr > worstH) worstH = hErr;
}
const LIMIT_KM = 0.5;
console.log(`objects ${n}, worst latitude error ${worst.toFixed(3)} km (${worstName} at ${worstLat.toFixed(1)} deg), worst height error ${worstH.toFixed(2)} km, worst longitude error ${worstLng.toFixed(3)} km`);
if (n < 50) { console.log('FAIL: too few objects propagated'); process.exit(1); }
if (worst > LIMIT_KM || worstLng > LIMIT_KM) { console.log(`FAIL: latitude/longitude error over ${LIMIT_KM} km`); process.exit(1); }
console.log('PASS');
