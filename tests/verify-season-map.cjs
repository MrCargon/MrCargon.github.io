// verify-season-map.cjs - does Explore's 4k day map show the sim clock's month?
// Run: node tests/verify-season-map.cjs
//
// Loads the real TimeConverter and Earth.js (with a stub Planet) in a vm and checks
// Earth.monthSpanJ2000 + Earth.dayMapPathFor against UTC calendar months worked out by
// hand, at the days that matter: mid-January, the June solstice, today's month, and the
// last minute of the year (a 12 h epoch slip or local-time maths would show December 31
// 23:59 UTC as January). Every month file the template names must exist on disk.
// Positive control: two wrong mappings (0-based month, a 12 h epoch slip) must fail the
// same checks, so the checks can fail.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, isFinite, Number, String, Object, Array, Infinity };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'src/components/simulation/time/TimeConverter.js'), 'utf8')
    + '\n;this.TimeConverter = TimeConverter;', ctx);
vm.runInContext('class Planet {}\n'
    + fs.readFileSync(path.join(root, 'src/components/simulation/solarsystem/Planets/Earth.js'), 'utf8')
    + '\n;this.Earth = Earth;', ctx);
const { TimeConverter: TC, Earth } = ctx;

const cfg = fs.readFileSync(path.join(root, 'src/components/simulation/solarsystem/SolarSystem.js'), 'utf8');
const m = cfg.match(/dayHighResPath:\s*"([^"]+)"/);
const template = m ? m[1] : '';

let fails = 0;
const report = (ok, name) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name); };

// [ISO time, expected month]
const CASES = [
    ['2027-01-15T12:00:00Z', 1],
    ['2026-06-21T08:24:00Z', 6],
    ['2026-11-21T12:00:00Z', 11],
    ['2026-12-31T23:59:00Z', 12],
    ['2027-01-01T00:00:00Z', 1],
    ['2024-02-29T23:59:59Z', 2],
];

// Returns the failures of one mapping (j2000Days -> {month, from, to}); prints when loud.
function runCases(span, loud) {
    let bad = 0;
    for (const [iso, want] of CASES) {
        const t = TC.dateToJ2000Days(new Date(iso));
        const s = span(t);
        const file = Earth.dayMapPathFor(template, s.month);
        const ok = s.month === want && s.from <= t && t < s.to
            && file.endsWith('earth_day_4k_' + String(want).padStart(2, '0') + '.jpg');
        if (!ok) bad++;
        if (loud) report(ok, iso + ' -> month ' + s.month + ' (want ' + want + '), ' + path.basename(file));
    }
    return bad;
}

report(Math.abs(TC.j2000DaysToDate(0).getTime() - Earth.J2000_UTC_MS) < 1,
    'Earth.J2000_UTC_MS is TimeConverter\'s J2000 epoch (2000-01-01 12:00 UTC)');
report(template.includes('{MM}'), 'SolarSystem dayHighResPath is a monthly template: ' + template);
runCases((t) => Earth.monthSpanJ2000(t), true);

const t0 = TC.dateToJ2000Days(new Date('2026-03-10T00:00:00Z'));
const s0 = Earth.monthSpanJ2000(t0);
report(Math.abs(s0.from - TC.dateToJ2000Days(new Date('2026-03-01T00:00:00Z'))) < 1e-9
    && Math.abs(s0.to - TC.dateToJ2000Days(new Date('2026-04-01T00:00:00Z'))) < 1e-9,
    'span of March 2026 is exactly 1 Mar 00:00 .. 1 Apr 00:00 UTC');

for (let mo = 1; mo <= 12; mo++) {
    const f = path.join(root, Earth.dayMapPathFor(template, mo));
    const size = fs.existsSync(f) ? fs.statSync(f).size : 0;
    report(size > 100000, 'month file exists: ' + path.basename(f) + ' (' + size + ' bytes)');
}

// Positive control: wrong mappings must be caught by the same cases.
const zeroBased = (t) => { const s = Earth.monthSpanJ2000(t); return { ...s, month: s.month - 1 || 12 }; };
const halfDaySlip = (t) => Earth.monthSpanJ2000(t + 0.5);
const c1 = runCases(zeroBased, false), c2 = runCases(halfDaySlip, false);
report(c1 > 0, 'control: a 0-based month mapping fails ' + c1 + ' case(s)');
report(c2 > 0, 'control: a 12 h epoch slip fails ' + c2 + ' case(s)');

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
