/**
 * PlaceSearch.js - "focus anywhere" (F1): find any continent, country, region, city or
 * typed "lat, lng" point, and describe it for the Explore detail card.
 *
 * WHY: Explore used to know one city. Every place now gets the same treatment from data
 * the site already ships (Natural Earth, src/assets/geo/): 177 country shapes, 4596
 * admin-1 regions, ~4400 named cities. No new network API.
 *
 * LAZY: this file is in the `explore` LazyBundle; the index is built on the first focus
 * of the search field (ensureIndex), never at page start. Region -> country is resolved
 * per result by point-in-polygon, only for what is shown.
 *
 * Matching folds diacritics ("jurmala" finds "Jūrmala"), ranks exact > prefix > word
 * prefix > contains, then by kind (continent, country, capital, region, city), then by
 * population.
 *
 * describe(entry, ctx) builds the card lines: kind, approximate local solar time, Sun up
 * or down at the sim clock, population (cities: POP_MAX; countries: Natural Earth admin-0
 * POP_EST with its year, from country-pop.json; regions: none, admin-1 has no population),
 * quakes in the last 24 h (in the polygon, or within
 * ~300 km of a point) and whether the ISS is near, both from data Explore already holds.
 */
class PlaceSearch {
    constructor() {
        console.assert(typeof PlaceSearch.CONTINENTS === 'object', 'PlaceSearch: continents table');
        console.assert(Array.isArray(PlaceSearch.CONTINENTS), 'PlaceSearch: continents array');
        this.entries = null;       // built index (null until ensureIndex resolves)
        this.countries = null;     // [{name, rings}] for parent lookups
        this.countryPop = null;    // country-pop.json {year, pop, yearOverride} once loaded
        this._popLoad = null;
        this._building = null;
    }

    /** Lower-case, diacritics stripped, a few letters NFD cannot split. Rule 5: 2 asserts. */
    static fold(s) {
        console.assert(s === undefined || s === null || typeof s === 'string', 'PlaceSearch.fold: string');
        const str = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const out = str.replace(/[øœæßłđðþı]/g, (c) => PlaceSearch.FOLD_MAP[c] || c).replace(/\s+/g, ' ').trim();
        console.assert(typeof out === 'string', 'PlaceSearch.fold: result');
        return out;
    }

    /**
     * "37.77, -122.42" / "37.77 -122.42" / "37.77N 122.42W" -> {lat, lng, text} or null.
     * Latitude is clamped to +-90 and longitude wrapped into -180..180. Rule 5: 2 asserts.
     */
    static parseLatLng(s) {
        console.assert(typeof s === 'string', 'parseLatLng: string');
        const m = String(s).trim().match(PlaceSearch.LATLNG_RE);
        if (!m) return null;
        let lat = parseFloat(m[1]); let lng = parseFloat(m[3]);
        if (m[2] && /s/i.test(m[2])) lat = -Math.abs(lat);
        if (m[4] && /w/i.test(m[4])) lng = -Math.abs(lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        lat = Math.max(-90, Math.min(90, lat));
        lng = ((lng + 540) % 360) - 180;
        console.assert(lat >= -90 && lat <= 90, 'parseLatLng: lat in range');
        return { lat: lat, lng: lng, text: (+lat.toFixed(5)) + ', ' + (+lng.toFixed(5)) };
    }

    /**
     * Centre + size of a polygon from its LARGEST ring (so Alaska or an overseas island
     * does not drag the centre off the mainland). Area-weighted centroid in lng/lat.
     * Rule 2: bounded | Rule 5: 2 asserts.
     * @returns {{lat:number,lng:number,spanKm:number}|null}
     */
    static ringCentre(rings) {
        console.assert(Array.isArray(rings), 'ringCentre: rings array');
        let best = null; let bestA = 0;
        for (let r = 0; r < Math.min(rings.length, 2000); r++) {
            const ring = rings[r];
            if (!Array.isArray(ring) || ring.length < 3) continue;
            let a = 0; let cx = 0; let cy = 0;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
                a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
            }
            if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = { ring: ring, a: a, cx: cx, cy: cy }; }
        }
        if (!best) return null;
        let minX = 180, maxX = -180, minY = 90, maxY = -90;
        best.ring.forEach((p) => {
            minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
            minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
        });
        const tiny = Math.abs(best.a) < 1e-9;
        const lng = tiny ? (minX + maxX) / 2 : best.cx / (3 * best.a);
        const lat = tiny ? (minY + maxY) / 2 : best.cy / (3 * best.a);
        const kx = 111.32 * Math.cos(lat * Math.PI / 180);
        const spanKm = Math.hypot((maxX - minX) * kx, (maxY - minY) * 110.57);
        console.assert(Number.isFinite(lat) && Number.isFinite(lng), 'ringCentre: finite centre');
        return { lat: lat, lng: lng, spanKm: spanKm };
    }

    /** Ray-casting point-in-ring in lng/lat space. Rule 5: 2 asserts. */
    static inRings(lat, lng, rings) {
        console.assert(Number.isFinite(lat) && Number.isFinite(lng), 'inRings: coords');
        console.assert(Array.isArray(rings), 'inRings: rings');
        for (let r = 0; r < Math.min(rings.length, 2000); r++) {
            const ring = rings[r];
            if (!Array.isArray(ring) || ring.length < 3) continue;
            let inside = false;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
                if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
            }
            if (inside) return true;
        }
        return false;
    }

    /** Great-circle distance in km. Rule 5: 2 asserts. */
    static distKm(lat1, lng1, lat2, lng2) {
        console.assert(Number.isFinite(lat1) && Number.isFinite(lng1), 'distKm: first point');
        console.assert(Number.isFinite(lat2) && Number.isFinite(lng2), 'distKm: second point');
        const d = Math.PI / 180;
        const a = Math.sin((lat2 - lat1) * d / 2) ** 2 +
            Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin((lng2 - lng1) * d / 2) ** 2;
        return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    /**
     * Fetch the shipped geo files once and build the index. Never rejects: a file that
     * fails to load just leaves its kind out. Rule 5: 2 asserts.
     * @returns {Promise<boolean>}
     */
    ensureIndex() {
        console.assert(typeof SafeFetch !== 'undefined', 'ensureIndex: SafeFetch required');
        console.assert(this.entries === null || Array.isArray(this.entries), 'ensureIndex: state');
        if (this.entries) return Promise.resolve(true);
        if (this._building) return this._building;
        const get = (u) => SafeFetch.json(PlaceSearch.GEO + u, { ttl: 3600000 }).catch(() => null);
        this._building = Promise.all(PlaceSearch.FILES.map(get).concat([this.loadPop()])).then((d) => {
            this._build(d[0], d[1], [d[2], d[3], d[4]]);
            return true;
        }).catch((e) => { console.error('PlaceSearch.ensureIndex:', e); this._building = null; return false; });
        return this._building;
    }

    /**
     * Load country-pop.json once (also used alone by a globe click before the index exists).
     * Never rejects; a bad or missing file leaves countryPop null. Rule 5: 2 asserts.
     * @returns {Promise<boolean>}
     */
    loadPop() {
        console.assert(typeof SafeFetch !== 'undefined', 'loadPop: SafeFetch required');
        if (this._popLoad) return this._popLoad;
        this._popLoad = SafeFetch.json(PlaceSearch.GEO + PlaceSearch.POP_FILE, { ttl: 3600000 }).then((d) => {
            const ok = d && typeof d === 'object' && Number.isInteger(d.year) && d.pop && typeof d.pop === 'object';
            if (ok) this.countryPop = d;
            console.assert(this.countryPop === null || typeof this.countryPop.pop === 'object', 'loadPop: shape');
            return !!ok;
        }).catch(() => { this._popLoad = null; return false; });
        return this._popLoad;
    }

    /** {pop, year} for a country entry from country-pop.json, or null. Regions have none. */
    countryPopOf(e) {
        console.assert(e && typeof e === 'object', 'countryPopOf: entry');
        const d = this.countryPop;
        if (!d || e.kind !== 'country' || typeof e.name !== 'string') return null;
        const n = d.pop[e.name];
        if (!Number.isFinite(n) || n <= 0) return null;
        const y = d.yearOverride && Number.isInteger(d.yearOverride[e.name]) ? d.yearOverride[e.name] : d.year;
        console.assert(Number.isInteger(y), 'countryPopOf: year');
        return { pop: n, year: y };
    }

    /** 1912789 -> "1.91 M", 1.4e9 -> "1.40 B", 4490 -> "4,490". */
    static formatPop(n) {
        console.assert(Number.isFinite(n) && n >= 0, 'formatPop: number');
        if (n >= 1e9) return (n / 1e9).toFixed(2) + ' B';
        if (n >= 1e6) return (n / 1e6).toFixed(2) + ' M';
        return Math.round(n).toLocaleString('en-US');
    }

    /** Build entries from the loaded files. Rule 2: bounded | Rule 5: 2 asserts. */
    _build(countries, states, cityFiles) {
        console.assert(Array.isArray(cityFiles), '_build: city files');
        const out = PlaceSearch.CONTINENTS.map((c) => ({ name: c.name, f: PlaceSearch.fold(c.name),
            kind: 'continent', lat: c.lat, lng: c.lng, distR: c.distR, pop: 0 }));
        this.countries = (countries && Array.isArray(countries.countries)) ? countries.countries : [];
        const addShape = (s, kind) => {
            if (!s || typeof s.name !== 'string' || !Array.isArray(s.rings)) return;
            const c = PlaceSearch.ringCentre(s.rings);
            if (!c) return;
            const e = { name: s.name, f: PlaceSearch.fold(s.name), kind: kind, lat: c.lat, lng: c.lng,
                spanKm: c.spanKm, rings: s.rings, pop: 0 };
            const cp = this.countryPopOf(e);
            if (cp) e.pop = cp.pop;
            out.push(e);
        };
        this.countries.slice(0, 400).forEach((s) => addShape(s, 'country'));
        const feats = (states && Array.isArray(states.features)) ? states.features : [];
        feats.slice(0, 8000).forEach((s) => addShape(s, 'region'));
        this._addCities(out, cityFiles);
        this.entries = out;
        console.assert(Array.isArray(this.entries), '_build: entries built');
        return out.length;
    }

    /** Cities from the three point files, deduped by name within ~0.2 deg (largest pop wins). */
    _addCities(out, cityFiles) {
        console.assert(Array.isArray(out) && Array.isArray(cityFiles), '_addCities: arrays');
        const byName = new Map();
        cityFiles.forEach((file) => {
            const places = (file && Array.isArray(file.places)) ? file.places.slice(0, 5000) : [];
            places.forEach((p) => {
                if (!p || typeof p.name !== 'string' || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
                const f = PlaceSearch.fold(p.name);
                const list = byName.get(f) || [];
                const twin = list.find((e) => Math.abs(e.lat - p.lat) < 0.2 && Math.abs(e.lng - p.lng) < 0.2);
                const pop = Number.isFinite(p.pop) ? p.pop : 0;
                if (twin) {
                    twin.capital = twin.capital || p.kind === 'capital';
                    if (pop > twin.pop) twin.pop = pop;
                    return;
                }
                const e = { name: p.name, f: f, kind: 'city', lat: p.lat, lng: p.lng, pop: pop, capital: p.kind === 'capital' };
                list.push(e); byName.set(f, list); out.push(e);
            });
        });
        console.assert(byName instanceof Map, '_addCities: map');
        return true;
    }

    /**
     * Ranked matches for a query: a typed point first, then places. Rule 2: bounded.
     * @returns {Array<Object>} at most `limit` entries
     */
    search(query, limit) {
        console.assert(typeof query === 'string', 'search: query string');
        const max = Math.max(1, Math.min(limit || PlaceSearch.LIMIT, 50));
        const out = [];
        const pt = PlaceSearch.parseLatLng(query);
        if (pt) out.push({ name: pt.text, f: '', kind: 'point', lat: pt.lat, lng: pt.lng, pop: 0 });
        const q = PlaceSearch.fold(query);
        if (!q || pt || !this.entries) return out;
        const hits = [];
        const n = Math.min(this.entries.length, 20000);
        for (let i = 0; i < n; i++) {
            const e = this.entries[i];
            const s = PlaceSearch._score(e.f, q);
            if (s >= 0) hits.push({ e: e, s: s });
        }
        hits.sort((a, b) => (a.s - b.s) || (PlaceSearch._kindRank(a.e) - PlaceSearch._kindRank(b.e)) ||
            (b.e.pop - a.e.pop) || (a.e.name.length - b.e.name.length));
        for (let i = 0; i < hits.length && out.length < max; i++) out.push(hits[i].e);
        console.assert(out.length <= max, 'search: bounded result');
        return out;
    }

    /** 0 exact, 1 prefix, 2 word prefix, 3 contains, -1 no match. */
    static _score(f, q) {
        if (f === q) return 0;
        if (f.startsWith(q)) return 1;
        const at = f.indexOf(q);
        if (at < 0) return -1;
        return /[\s\-'(),./]/.test(f.charAt(at - 1)) ? 2 : 3;
    }

    static _kindRank(e) {
        if (e.kind === 'city' && e.capital) return 2;
        return PlaceSearch.KIND_RANK[e.kind] !== undefined ? PlaceSearch.KIND_RANK[e.kind] : 9;
    }

    /** Country containing a point, or null. Rule 2: bounded | Rule 5: 2 asserts. */
    countryAt(lat, lng) {
        console.assert(Number.isFinite(lat) && Number.isFinite(lng), 'countryAt: coords');
        const list = this.countries || [];
        console.assert(Array.isArray(list), 'countryAt: country list');
        for (let i = 0; i < Math.min(list.length, 400); i++) {
            if (list[i] && Array.isArray(list[i].rings) && PlaceSearch.inRings(lat, lng, list[i].rings)) return list[i].name;
        }
        return null;
    }

    /** Parent country for a region / city / point, cached on the entry. */
    parentOf(e) {
        console.assert(e && typeof e === 'object', 'parentOf: entry');
        if (e.kind === 'continent' || e.kind === 'country') return null;
        if (e.parent === undefined) e.parent = this.countryAt(e.lat, e.lng);
        console.assert(e.parent === null || typeof e.parent === 'string', 'parentOf: result');
        return e.parent;
    }

    /** "Country", "Region of Latvia", "City, Latvia (capital)", "Point in France". */
    kindLabel(e) {
        console.assert(e && typeof e.kind === 'string', 'kindLabel: entry');
        const p = this.parentOf(e);
        switch (e.kind) {
            case 'continent': return 'Continent';
            case 'country': return 'Country';
            case 'region': return p ? 'Region of ' + p : 'Region';
            case 'city': return (p ? 'City, ' + p : 'City') + (e.capital ? ' (capital)' : '');
            default: return p ? 'Point in ' + p : 'Point';
        }
    }

    /** Camera distance in Earth radii for this place: continent far, city close. */
    static flyDistance(e) {
        console.assert(e && typeof e.kind === 'string', 'flyDistance: entry');
        if (e.distR) return e.distR;
        if (e.kind === 'city') return 1.06;
        if (e.kind === 'point') return 1.1;
        const span = Number.isFinite(e.spanKm) ? e.spanKm : 1000;
        const min = e.kind === 'country' ? 0.14 : 0.05;
        const d = 1 + Math.max(min, Math.min(2.2, span * 1.1 / 6371));
        console.assert(d > 1, 'flyDistance: above the surface');
        return d;
    }

    /**
     * Card lines for a place. ctx: {ms (clock), quakes: items|null, iss: {lat,lng}|null}.
     * Rule 5: 2 asserts.
     * @returns {{title:string, lines:string[]}}
     */
    describe(e, ctx) {
        console.assert(e && Number.isFinite(e.lat) && Number.isFinite(e.lng), 'describe: entry');
        const c = ctx || {};
        const ms = Number.isFinite(c.ms) ? c.ms : Date.now();
        const lines = [this.kindLabel(e)];
        lines.push('Local time ≈ ' + PlaceSearch.solarTime(e.lng, ms) + ' (approx., solar time)');
        const sun = PlaceSearch.sunUp(e.lat, e.lng, ms);
        if (sun !== null) lines.push(sun ? 'Sun: up ☀' : 'Sun: down ☾');
        const cp = this.countryPopOf(e);
        if (cp) lines.push('Population ≈ ' + PlaceSearch.formatPop(cp.pop) + ' (' + cp.year + ' est.)');
        else if (e.pop > 0 && e.kind !== 'country') lines.push('Population: ' + Math.round(e.pop).toLocaleString('en-US'));
        lines.push(this._quakeLine(e, c.quakes));
        lines.push(PlaceSearch._issLine(e, c.iss));
        console.assert(lines.length >= 3, 'describe: lines built');
        return { title: e.name, lines: lines };
    }

    /** HH:MM of mean solar time at a longitude (UTC + lng/15 h). */
    static solarTime(lng, ms) {
        console.assert(Number.isFinite(lng) && Number.isFinite(ms), 'solarTime: numbers');
        const day = 86400000;
        const t = (((ms + lng / 15 * 3600000) % day) + day) % day;
        const h = Math.floor(t / 3600000); const m = Math.floor((t % 3600000) / 60000);
        console.assert(h >= 0 && h < 24, 'solarTime: hour in range');
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    /** Sun above the horizon at (lat,lng) at ms? null when the ephemeris is not loaded. */
    static sunUp(lat, lng, ms) {
        console.assert(Number.isFinite(lat) && Number.isFinite(lng), 'sunUp: coords');
        if (typeof OrbitalCalculator === 'undefined' || typeof OrbitalCalculator.subsolarPoint !== 'function') return null;
        const days = (ms - Date.UTC(2000, 0, 1, 12)) / 86400000;
        const s = OrbitalCalculator.subsolarPoint(days);
        if (!s || !Number.isFinite(s.lat)) return null;
        const d = Math.PI / 180;
        const dot = Math.sin(lat * d) * Math.sin(s.lat * d) + Math.cos(lat * d) * Math.cos(s.lat * d) * Math.cos((lng - s.lng) * d);
        console.assert(Number.isFinite(dot), 'sunUp: finite');
        return dot > -0.0145;          // ~0.83 deg below: refraction + the Sun's radius
    }

    /** Quakes (USGS 24 h feed, already loaded by the Quakes layer) in the place. */
    _quakeLine(e, quakes) {
        console.assert(e && typeof e === 'object', '_quakeLine: entry');
        if (!Array.isArray(quakes)) return 'Quakes (24 h): no data loaded';
        const near = e.kind === 'continent' ? 3000 : PlaceSearch.QUAKE_KM;
        let n = 0; let top = -1;
        for (let i = 0; i < Math.min(quakes.length, 500); i++) {
            const q = quakes[i];
            if (!q || !Number.isFinite(q.lat) || !Number.isFinite(q.lng)) continue;
            const hit = e.rings ? PlaceSearch.inRings(q.lat, q.lng, e.rings)
                : PlaceSearch.distKm(e.lat, e.lng, q.lat, q.lng) <= near;
            if (!hit) continue;
            n++;
            const m = /^M(\d+(?:\.\d+)?)/.exec((q.data && q.data.name) || '');
            if (m) top = Math.max(top, parseFloat(m[1]));
        }
        const where = e.rings ? 'in this area' : 'within ' + near + ' km';
        console.assert(n >= 0, '_quakeLine: count');
        if (!n) return 'Quakes (24 h): none ' + where;
        return 'Quakes (24 h): ' + n + ' ' + where + (top >= 0 ? ', strongest M' + top.toFixed(1) : '');
    }

    /** Is the ISS (last fix the ISS layer fetched) within ~1500 km? */
    static _issLine(e, iss) {
        console.assert(e && typeof e === 'object', '_issLine: entry');
        if (!iss || !Number.isFinite(iss.lat) || !Number.isFinite(iss.lng)) return 'ISS: no position loaded';
        const km = PlaceSearch.distKm(e.lat, e.lng, iss.lat, iss.lng);
        const over = km <= PlaceSearch.ISS_KM || (e.rings && PlaceSearch.inRings(iss.lat, iss.lng, e.rings));
        console.assert(Number.isFinite(km), '_issLine: distance');
        return over ? 'ISS: overhead now (~' + Math.round(km) + ' km away)' : 'ISS: not nearby (~' + Math.round(km / 100) * 100 + ' km away)';
    }
}

// Centre + fly distance (Earth radii) for each continent. Not a data file: seven rows.
PlaceSearch.CONTINENTS = [
    { name: 'Africa', lat: 2, lng: 20, distR: 2.6 },
    { name: 'Antarctica', lat: -82, lng: 30, distR: 2.6 },
    { name: 'Asia', lat: 42, lng: 90, distR: 2.9 },
    { name: 'Europe', lat: 52, lng: 15, distR: 2.2 },
    { name: 'North America', lat: 45, lng: -100, distR: 2.7 },
    { name: 'Oceania', lat: -22, lng: 140, distR: 2.6 },
    { name: 'South America', lat: -16, lng: -60, distR: 2.5 }
];
PlaceSearch.GEO = 'src/assets/geo/';
PlaceSearch.FILES = ['country_shapes.json', 'states-named.json', 'capitals-named.json',
    'populated-places.json', 'towns-named.json'];
PlaceSearch.POP_FILE = 'country-pop.json';
PlaceSearch.KIND_RANK = { point: 0, continent: 0, country: 1, region: 3, city: 4 };
PlaceSearch.FOLD_MAP = { 'ø': 'o', 'œ': 'oe', 'æ': 'ae', 'ß': 'ss', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ı': 'i' };
PlaceSearch.LATLNG_RE = /^([-+]?\d{1,3}(?:\.\d+)?)\s*°?\s*([NSns])?\s*[,;\s]\s*([-+]?\d{1,3}(?:\.\d+)?)\s*°?\s*([EWew])?$/;
PlaceSearch.LIMIT = 8;
PlaceSearch.QUAKE_KM = 300;
PlaceSearch.ISS_KM = 1500;

if (typeof window !== 'undefined') window.PlaceSearch = PlaceSearch;
if (typeof module !== 'undefined' && module.exports) module.exports = PlaceSearch;
