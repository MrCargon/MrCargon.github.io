/**
 * LazyBundles.js - load page-specific classic scripts on first use, not at boot.
 *
 * WHY (roast R2 #7a): index.html loaded every script on every visit, including the
 * Life, Studio, Calendar and Notes pages and the cosmology features, which the solar
 * page never touches at boot. They are still plain classic scripts with globals; this
 * only moves WHEN they arrive.
 *
 * HOW: each bundle is an ordered list of files. load(name) appends one <script> per
 * file with async = false, so the files download in parallel but EXECUTE in list
 * order - the same guarantee the old deferred tags gave. A file that failed is removed
 * and fetched again (bounded retries with a short backoff). If it still fails, the
 * promise rejects, the cached promise is dropped, and the next call tries again; the
 * router shows a Retry panel for that case (PageManager._renderBundleError).
 *
 * Rules for a file in a bundle: it may only DEFINE classes/globals at load time and
 * must not be needed by anything that runs at boot. Load-time dependencies on files
 * that stay in index.html (ForceMatrix, SineShape, THREE at runtime) are fine, because
 * those always run first.
 *
 * KEEP IN SYNC: sw.js LAZY_CODE precaches exactly these files for offline use, and
 * tests/verify-lazy-bundles.cjs fails if the two lists or index.html drift apart.
 */
class LazyBundles {
    /**
     * Load a bundle once. Resolves true when every file has executed.
     * Rule 5: 2 asserts | Rule 6: rejects instead of throwing synchronously.
     */
    static load(name) {
        console.assert(typeof name === 'string', 'LazyBundles.load: name string');
        console.assert(typeof document !== 'undefined', 'LazyBundles.load: DOM available');
        const files = LazyBundles.BUNDLES[name];
        if (!files) return Promise.reject(new Error(`Unknown bundle: ${name}`));
        if (LazyBundles._done.has(name)) return Promise.resolve(true);
        if (LazyBundles._pending.has(name)) return LazyBundles._pending.get(name);
        const p = LazyBundles._loadWithRetry(name, files).then(() => {
            LazyBundles._done.add(name);
            LazyBundles._pending.delete(name);
            return true;
        }, (err) => {
            LazyBundles._pending.delete(name);           // so the next call tries again
            throw err;
        });
        LazyBundles._pending.set(name, p);
        return p;
    }

    /** True once a bundle has fully executed. Rule 5: 2 asserts. */
    static isLoaded(name) {
        console.assert(typeof name === 'string', 'LazyBundles.isLoaded: name string');
        console.assert(LazyBundles._done instanceof Set, 'LazyBundles.isLoaded: state');
        return LazyBundles._done.has(name);
    }

    /**
     * Fetch the files that are not loaded yet, up to MAX_TRIES rounds.
     * Rule 2: bounded loop | Rule 5: 2 asserts.
     */
    static async _loadWithRetry(name, files) {
        console.assert(Array.isArray(files) && files.length > 0, '_loadWithRetry: files');
        console.assert(LazyBundles.MAX_TRIES > 0, '_loadWithRetry: tries bounded');
        let missing = files.filter((f) => !LazyBundles._files.has(f));
        for (let attempt = 0; attempt < LazyBundles.MAX_TRIES && missing.length; attempt++) {
            if (attempt > 0) await new Promise((r) => setTimeout(r, LazyBundles.RETRY_MS * attempt));
            const results = await Promise.all(missing.map((f) => LazyBundles._inject(f)));
            missing = missing.filter((f, i) => !results[i]);
        }
        if (missing.length) {
            throw new Error(`Bundle '${name}' failed to load: ${missing.join(', ')}`);
        }
        return true;
    }

    /**
     * One classic script, ordered (async = false). Resolves true/false, never rejects.
     * A file shared by two bundles (CalendarSync) that is already in flight is awaited,
     * not injected twice: a second copy of a classic `class X` throws "already declared".
     * No timer: a script element always ends in load or error, and removing one that is
     * merely slow could let it execute after a retry had injected it again.
     * Rule 5: 2 asserts.
     */
    static _inject(src) {
        console.assert(typeof src === 'string' && src.length > 0, '_inject: src');
        console.assert(document.head, '_inject: head available');
        if (LazyBundles._files.has(src)) return Promise.resolve(true);
        if (LazyBundles._inflight.has(src)) return LazyBundles._inflight.get(src);
        const p = new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false;                             // execute in insertion order
            s.dataset.lazyBundle = '1';
            const done = (ok) => {
                s.onload = s.onerror = null;
                LazyBundles._inflight.delete(src);
                if (ok) LazyBundles._files.add(src); else s.remove();
                resolve(ok);
            };
            s.onload = () => done(true);
            s.onerror = () => done(false);
            document.head.appendChild(s);
        });
        LazyBundles._inflight.set(src, p);
        return p;
    }
}

// Order inside a bundle is the order the files had in index.html.
LazyBundles.BUNDLES = {
    // Life page (#life, #conway, #particles). ParticleLife reads ForceMatrix at load
    // time; ForceMatrix stays in index.html because the main-page backdrops need it.
    life: [
        'src/utils/SineAudio.js',
        'src/utils/Lenia.js',
        'src/utils/LifePatterns.js',
        'src/utils/ConwayLife.js',
        'src/utils/LifeView.js',
        'src/utils/ParticleLife.js',
        'src/components/pages/LifePage.js'
    ],
    studio: [
        'src/components/pages/StudioPage.js'
    ],
    calendar: [
        'src/utils/CalendarStore.js',
        'src/utils/CalendarSync.js',
        'src/components/pages/Calendar.js'
    ],
    notes: [
        'src/utils/CalendarSync.js',
        'src/utils/NotesStore.js',
        'src/components/pages/Notes.js'
    ],
    // SpaceEnvironment.enable*() features. CosmicDust is NOT here: Galaxy and
    // SolarSystem build it at boot.
    cosmology: [
        'src/components/simulation/cosmology/GravitationalWaves.js',
        'src/components/simulation/cosmology/DarkMatterHalo.js',
        'src/components/simulation/cosmology/ExoplanetSystems.js',
        'src/components/simulation/cosmology/CosmicScale.js',
        'src/components/simulation/cosmology/ExtraDimensionsViz.js',
        'src/components/simulation/cosmology/VibratingString.js',
        'src/components/simulation/cosmology/StringTheory.js'
    ]
};
LazyBundles.MAX_TRIES = 3;
LazyBundles.RETRY_MS = 400;
LazyBundles._done = new Set();      // bundle names fully executed
LazyBundles._files = new Set();     // files executed (shared files load once)
LazyBundles._pending = new Map();   // bundle name -> in-flight promise
LazyBundles._inflight = new Map();  // file -> in-flight promise

if (typeof window !== 'undefined') window.LazyBundles = LazyBundles;
if (typeof module !== 'undefined' && module.exports) module.exports = LazyBundles;
