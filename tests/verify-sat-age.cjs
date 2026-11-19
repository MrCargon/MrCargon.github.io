#!/usr/bin/env node
/**
 * verify-sat-age.cjs - old satellite orbits are dropped by orbit class (roast R1 #7).
 *
 * One 90-day limit used to cover GPS and the ISS alike; a low orbit drifts by drag, so a
 * two-week-old element set for a station is already far off while GPS/GEO stay good for
 * months. Satellites.recordUsableAt now uses MAX_AGE_LEO_MS for mean motion >= 11.25
 * rev/day and MAX_AGE_HIGH_MS above that. This checks both bounds on synthetic records,
 * the "data as of" / "no recent orbits" helpers, and reports the bundled snapshot's
 * per-group state today (it must be rebuilt before its LEO groups age out).
 *
 * Usage: node tests/verify-sat-age.cjs [path/to/Satellites.js]   Exit 0 = pass, 1 = fail.
 * Against the pre-fix Satellites.js (one 90-day limit, no recordUsableAt) it fails.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Satellites.js is a classic browser script (package.json says type: module, so no require).
const satPath = process.argv[2] || path.join(__dirname, '..', 'src', 'utils', 'Satellites.js');
const sandbox = { module: { exports: {} }, console: console, Date: Date };
vm.runInNewContext(fs.readFileSync(satPath, 'utf8'), sandbox, { filename: satPath });
const Satellites = sandbox.module.exports;

const DAY = 86400000;
const NOW = Date.parse('2026-11-19T12:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const rec = (mm, ageDays) => ({ MEAN_MOTION: mm, EPOCH: iso(NOW - ageDays * DAY) });

const cases = [
    ['LEO (ISS, 15.5 rev/d) 1 d old', rec(15.5, 1), true],
    ['LEO 10 d old', rec(15.5, 10), true],
    ['LEO 15 d old: dropped', rec(15.5, 15), false],
    ['LEO weather (14.1 rev/d) 20 d old: dropped', rec(14.1, 20), false],
    ['MEO (GPS, 2.0 rev/d) 30 d old', rec(2.0057, 30), true],
    ['MEO 59 d old', rec(2.0057, 59), true],
    ['MEO 61 d old: dropped', rec(2.0057, 61), false],
    ['GEO (1.0027 rev/d) 45 d old', rec(1.0027, 45), true],
    ['GEO 91 d old: dropped', rec(1.0027, 91), false],
    ['epoch in the future by 20 d (LEO): dropped', rec(15.5, -20), false],
    ['unparseable epoch: dropped', { MEAN_MOTION: 15.5, EPOCH: 'not a date' }, false],
    ['missing mean motion: dropped', { EPOCH: iso(NOW) }, false],
    ['null record: dropped', null, false]
];

let bad = 0;
const check = (name, got, want) => {
    const ok = got === want;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  (got ${got}, want ${want})`}`);
};
cases.forEach((c) => check(c[0], Satellites.recordUsableAt(c[1], NOW), c[2]));

// asOf / agedOutGroups on a bare instance (no THREE needed).
const s = Object.create(Satellites.prototype);
s.perGroup = { 'gps-ops': 31, weather: 0, stations: 12 };
s.dataTime = { 'gps-ops': Date.parse('2026-11-10T00:00:00Z'), weather: Date.parse('2026-11-01T00:00:00Z'),
    stations: Date.parse('2026-11-07T00:00:00Z') };
check('asOf = oldest DRAWN group (weather has none drawn)', s.asOf(), Date.parse('2026-11-07T00:00:00Z'));
check('agedOutGroups names the empty group', s.agedOutGroups().join(','), 'Weather');
s.perGroup = {};
check('nothing drawn: asOf 0', s.asOf(), 0);

// The bundled snapshot: a positive control at its own fetch time, then today's state.
const snap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'satellites-snapshot.json'), 'utf8'));
const fetched = Date.parse(snap.fetched);
const today = Date.now();
Object.keys(snap.groups).forEach((g) => {
    const list = snap.groups[g];
    const atFetch = list.filter((r) => Satellites.recordUsableAt(r, fetched + DAY)).length;
    check(`snapshot ${g}: usable a day after it was fetched (control)`, atFetch > 0, true);
    const now = list.filter((r) => Satellites.recordUsableAt(r, today)).length;
    console.log(`info snapshot ${g}: ${now}/${list.length} usable today (fetched ${snap.fetched})`);
});

console.log(`\n${bad ? 'FAIL' : 'PASS'}: ${bad} failure(s)`);
process.exit(bad ? 1 : 0);
