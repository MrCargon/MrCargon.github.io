// LifePatterns.js — canonical Life patterns as RLE text, plus a decoder.
//
// RLE is the interchange format used by conwaylife.com and every Life tool. Storing
// patterns as RLE strings in source rather than as data files is the whole "no assets"
// point (see CELLULAR_AUTOMATA.md §8): the Gosper glider gun — an infinite, unbounded
// stream of moving structures — is about 70 characters here.
//
// FORMAT
//   optional header:  x = 36, y = 9, rule = B3/S23
//   body tokens:      <count>b  dead run      <count>o  live run
//                     <count>$  end of row    !          end of pattern
//   a missing count means 1; trailing dead cells in a row may be omitted entirely.
//
// EVERY PATTERN BELOW IS VERIFIED BY SIMULATION, not by eye — tests/verify-patterns.js
// decodes each one, runs a plain CPU implementation of B3/S23, and asserts the documented
// behaviour (period, displacement, or growth). RLE is easy to transcribe subtly wrong and
// a wrong pattern still *looks* like Life, so trusting the string is not good enough.
class LifePatterns {
    /**
     * Decode RLE text to { width, height, cells: [[x,y], ...] }.
     * Tolerates a missing header, CRLF, comment (#) lines and stray whitespace.
     * Rule 4: <=60 lines | Rule 5: 2 asserts.
     */
    static decode(rle) {
        console.assert(typeof rle === 'string', 'decode: string required');
        console.assert(rle.length > 0, 'decode: non-empty required');
        const lines = rle.split(/\r?\n/).filter(l => l.trim() && l.trim()[0] !== '#');
        let body = '';
        let declaredW = 0, declaredH = 0;
        for (let i = 0; i < lines.length; i++) {          // Rule 2: bounded
            const l = lines[i].trim();
            const m = l.match(/^x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)/i);
            if (m) { declaredW = parseInt(m[1], 10); declaredH = parseInt(m[2], 10); continue; }
            body += l;
        }
        const cells = [];
        let x = 0, y = 0, count = 0, maxX = 0;
        for (let i = 0; i < body.length; i++) {           // Rule 2: bounded by input
            const ch = body[i];
            if (ch >= '0' && ch <= '9') { count = count * 10 + (ch.charCodeAt(0) - 48); continue; }
            const run = count || 1;
            count = 0;
            if (ch === 'b') { x += run; }
            else if (ch === 'o') {
                for (let k = 0; k < run; k++) { cells.push([x, y]); x++; }   // Rule 2: bounded
            } else if (ch === '$') { if (x > maxX) maxX = x; x = 0; y += run; }
            else if (ch === '!') { break; }
            // anything else (spaces, stray chars) is ignored by design
        }
        if (x > maxX) maxX = x;
        return {
            width: declaredW || maxX,
            height: declaredH || (y + 1),
            cells: cells
        };
    }

    /** Look up a pattern by key and return its decoded cells. Rule 5: 2 asserts. */
    static get(name) {
        console.assert(typeof name === 'string', 'get: name required');
        console.assert(LifePatterns.RLE, 'get: library required');
        const rle = LifePatterns.RLE[name];
        if (!rle) return null;
        return LifePatterns.decode(rle);
    }

    /** Names in menu order. Rule 5: 2 asserts. */
    static names() {
        console.assert(LifePatterns.RLE, 'names: library required');
        console.assert(LifePatterns.META, 'names: metadata required');
        return Object.keys(LifePatterns.RLE);
    }

    /**
     * Parse a rule string like "B3/S23" or "b36/s23" into { birth:[], survive:[] }.
     * Returns null on anything unparseable so callers can keep the previous rule rather
     * than silently switching universe. Rule 5: 2 asserts.
     */
    static parseRule(str) {
        console.assert(typeof str === 'string', 'parseRule: string required');
        console.assert(str.length > 0, 'parseRule: non-empty required');
        const m = str.trim().match(/^B([0-8]*)\s*\/\s*S([0-8]*)$/i);
        if (!m) return null;
        const toList = (s) => {
            const out = [];
            for (let i = 0; i < s.length && i < 9; i++) out.push(s.charCodeAt(i) - 48);  // Rule 2
            return out;
        };
        return { birth: toList(m[1]), survive: toList(m[2]) };
    }
}

// ---------------------------------------------------------------------------------------
// The library. Grouped by class (CELLULAR_AUTOMATA.md §3).
// ---------------------------------------------------------------------------------------
LifePatterns.RLE = {
    // --- still lifes: period 1 ---
    block: 'x = 2, y = 2, rule = B3/S23\n2o$2o!',
    beehive: 'x = 4, y = 3, rule = B3/S23\nb2o$o2bo$b2o!',
    loaf: 'x = 4, y = 4, rule = B3/S23\nb2o$o2bo$bobo$2bo!',

    // --- oscillators ---
    blinker: 'x = 3, y = 1, rule = B3/S23\n3o!',
    toad: 'x = 4, y = 2, rule = B3/S23\nb3o$3o!',
    beacon: 'x = 4, y = 4, rule = B3/S23\n2o2b$2o2b$2b2o$2b2o!',
    pulsar: 'x = 13, y = 13, rule = B3/S23\n' +
        '2b3o3b3o2b$12b$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2b$12b$' +
        '2b3o3b3o2b$o4bobo4bo$o4bobo4bo$o4bobo4bo$12b$2b3o3b3o2b!',
    pentadecathlon: 'x = 10, y = 3, rule = B3/S23\n2bo4bo2b$2ob4ob2o$2bo4bo2b!',

    // --- spaceships ---
    glider: 'x = 3, y = 3, rule = B3/S23\nbob$2bo$3o!',
    lwss: 'x = 5, y = 4, rule = B3/S23\nbo2bo$o4b$o3bo$4o!',

    // --- guns: unbounded growth (Gosper, Nov 1970) ---
    gosperGun: 'x = 36, y = 9, rule = B3/S23\n' +
        '24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$' +
        '2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!',

    // --- methuselahs: tiny, long-lived, chaotic ---
    rPentomino: 'x = 3, y = 3, rule = B3/S23\nb2o$2ob$bo!',
    acorn: 'x = 7, y = 3, rule = B3/S23\nbo5b$3bo3b$2o2b3o!',
    diehard: 'x = 8, y = 3, rule = B3/S23\n6bob$2o6b$bo3b3o!'
};

// Display metadata. `check` is what tests/verify-patterns.js asserts about each pattern:
//   period n     - returns to its exact starting cells after n generations
//   moves dx dy p- returns to its starting shape displaced by (dx,dy) after p generations
//   grows        - population is strictly larger after a long run (unbounded growth)
//   chaos n      - a methuselah; population still changing near generation n
LifePatterns.META = {
    block: { label: 'Block', group: 'Still life', check: 'period 1' },
    beehive: { label: 'Beehive', group: 'Still life', check: 'period 1' },
    loaf: { label: 'Loaf', group: 'Still life', check: 'period 1' },

    blinker: { label: 'Blinker', group: 'Oscillator', check: 'period 2' },
    toad: { label: 'Toad', group: 'Oscillator', check: 'period 2' },
    beacon: { label: 'Beacon', group: 'Oscillator', check: 'period 2' },
    pulsar: { label: 'Pulsar', group: 'Oscillator', check: 'period 3' },
    pentadecathlon: { label: 'Pentadecathlon', group: 'Oscillator', check: 'period 15' },

    glider: { label: 'Glider', group: 'Spaceship', check: 'moves 1 1 4' },
    lwss: { label: 'Lightweight spaceship', group: 'Spaceship', check: 'moves -2 0 4' },

    gosperGun: { label: 'Gosper glider gun', group: 'Gun', check: 'grows' },

    rPentomino: { label: 'R-pentomino', group: 'Methuselah', check: 'chaos 1103' },
    acorn: { label: 'Acorn', group: 'Methuselah', check: 'chaos 5206' },
    diehard: { label: 'Diehard', group: 'Methuselah', check: 'dies 130' }
};

// A few of the 262,144 rules worth visiting. See CELLULAR_AUTOMATA.md §5.
LifePatterns.RULES = [
    { name: 'Life', rule: 'B3/S23', note: "Conway's original — the balanced case" },
    { name: 'HighLife', rule: 'B36/S23', note: 'as Life, plus a genuine replicator' },
    { name: 'Day & Night', rule: 'B3678/S34678', note: 'symmetric under swapping alive/dead' },
    { name: 'Seeds', rule: 'B2/S', note: 'nothing ever survives; violently explosive' },
    { name: 'Life without Death', rule: 'B3/S012345678', note: 'nothing ever dies; grows forever' },
    { name: 'Maze', rule: 'B3/S12345', note: 'settles into maze corridors' },
    { name: 'Replicator', rule: 'B1357/S1357', note: 'every pattern copies itself' }
];

if (typeof window !== 'undefined') window.LifePatterns = LifePatterns;
if (typeof module !== 'undefined' && module.exports) module.exports = LifePatterns;
