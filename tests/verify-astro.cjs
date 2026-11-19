// verify-astro.cjs - is the sky true at the shown time?  Run: node tests/verify-astro.cjs
//
// Checks the sim clock (TimeConverter) and the low-precision ephemeris
// (OrbitalCalculator) that drive Earth's spin, the day/night terminator and the Moon,
// against references that do not come from this code:
//
//   - Julian dates: 1970-01-01 00:00 UTC = JD 2440587.5, 2000-01-01 12:00 = J2000.0
//   - subsolar point 2026-11-19 06:33 UTC: lat -19.5, lng +78.1 (almanac: Sun dec
//     -19.5 deg, equation of time +14.6 min)
//   - June solstice 2026-06-21: subsolar latitude +23.4 (Tropic of Cancer)
//   - GMST 2026-11-19 00:00 UT = 58.0 deg (3h52m: ~0h at the 22 Sep equinox, + 3m56s a day)
//   - Moon, JPL Horizons (DE441) geocentric ecliptic longitude, J2000 frame:
//     2026-11-19 00:00 UT 343.50, 2026-11-20 00:00 UT 356.40. Ours is of-date, so
//     +0.37 deg of precession is expected; tolerance 1 deg.
//   - Moon mean motion over one sidereal month: 13.18 deg/day
//
// Fails on 7101db4: the clock ran 12 h fast and there was no Sun/GMST/Moon model.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Date, isFinite, Number };
vm.createContext(ctx);
for (const f of ['TimeConverter.js', 'OrbitalCalculator.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'simulation', 'time', f), 'utf8');
    vm.runInContext(src + '\n;this.' + f.replace('.js', '') + ' = ' + f.replace('.js', '') + ';', ctx);
}
const { TimeConverter: TC, OrbitalCalculator: OC } = ctx;

let fails = 0;
const check = (name, got, want, tol) => {
    const d = Math.abs(((got - want + 540) % 360) - 180);   // angle-safe for degrees
    const err = tol === 0 ? Math.abs(got - want) : Math.min(Math.abs(got - want), d);
    const ok = err <= (tol || 1e-9);
    if (!ok) fails++;
    console.log((ok ? 'PASS ' : 'FAIL ') + name + ': got ' + (+got).toFixed(4) + ', want ' + want + ' +-' + tol);
};
const days = (iso) => TC.dateToJ2000Days(new Date(iso));
const has = (fn) => typeof OC[fn] === 'function';

check('JD of 1970-01-01 00:00 UTC', TC.dateToJulianDate(new Date('1970-01-01T00:00:00Z')), 2440587.5, 1e-9);
check('J2000 days of 2000-01-01 12:00 UTC', days('2000-01-01T12:00:00Z'), 0, 1e-9);

if (!has('subsolarPoint') || !has('gmstDeg') || !has('moonEcliptic')) {
    console.log('FAIL OrbitalCalculator has no subsolarPoint/gmstDeg/moonEcliptic');
    process.exit(1);
}
const t = days('2026-11-19T06:33:00Z');
const s = OC.subsolarPoint(t);
check('subsolar lat 2026-11-19 06:33Z', s.lat, -19.5, 1);
check('subsolar lng 2026-11-19 06:33Z', s.lng, 78.1, 1);
check('subsolar lat at June solstice', OC.subsolarPoint(days('2026-06-21T08:24:00Z')).lat, 23.44, 0.1);
check('GMST 2026-11-19 00:00 UT (deg)', OC.gmstDeg(days('2026-11-19T00:00:00Z')), 58.0, 0.1);
check('Moon lon 2026-11-19 00:00 vs Horizons', OC.moonEcliptic(days('2026-11-19T00:00:00Z')).lon, 343.50, 1);
check('Moon lon 2026-11-20 00:00 vs Horizons', OC.moonEcliptic(days('2026-11-20T00:00:00Z')).lon, 356.40, 1);
const m0 = OC.moonEcliptic(t).lon;
const m1 = OC.moonEcliptic(t + 27.321661).lon;
check('Moon back to the same longitude after a sidereal month', m1, m0, 1.5);
let sweep = 0;
for (let i = 0; i < 273; i++) {
    const a = OC.moonEcliptic(t + (i * 0.1)).lon, b = OC.moonEcliptic(t + ((i + 1) * 0.1)).lon;
    sweep += ((b - a + 540) % 360) - 180;
}
check('Moon mean rate deg/day over 27.3 d', sweep / 27.3, 13.18, 0.3);

console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASS');
process.exit(fails ? 1 : 0);
