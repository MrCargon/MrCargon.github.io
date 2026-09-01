import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Teach Vite the browser's <script type="importmap">.
 *
 * three.js is deliberately NOT an npm dependency here — index.html declares it in an
 * import map pointing at jsDelivr, and the browser resolves it directly. Vite does not
 * honour import maps: it saw the bare specifier `three` in the inline module, tried to
 * resolve it from node_modules, failed, and returned 500 for the whole module. The
 * practical effect was that `npm run dev` served a page with NO THREE at all — the solar
 * system, Lenia and Life were all dead, while the static build worked fine.
 *
 * This resolves those bare specifiers to the exact CDN URLs and marks them external, so
 * Vite leaves the import alone and the browser fetches it — the same thing the import map
 * does, just declared where Vite can see it.
 *
 * The URLs are PARSED OUT OF index.html rather than repeated here on purpose. Two copies
 * of a version number is how you end up with the dev server silently running a different
 * three.js from production.
 */
function importMapPlugin() {
    let imports = {};
    return {
        name: 'honour-html-import-map',
        enforce: 'pre',
        configResolved(config) {
            const htmlPath = path.resolve(config.root || '.', 'index.html');
            try {
                const html = fs.readFileSync(htmlPath, 'utf8');
                const m = html.match(/<script\s+type=["']importmap["']\s*>([\s\S]*?)<\/script>/i);
                if (m) imports = JSON.parse(m[1]).imports || {};
            } catch (e) {
                // A missing or malformed map is not fatal: fall through and let Vite
                // report the unresolved import as it normally would.
                imports = {};
            }
        },
        resolveId(id) {
            // Exact match first, e.g. "three".
            if (imports[id]) return { id: imports[id], external: true };
            // Then trailing-slash prefixes, e.g. "three/addons/" -> ".../examples/jsm/",
            // which is how the import map spec defines scoped prefixes.
            for (const key of Object.keys(imports)) {
                if (key.endsWith('/') && id.startsWith(key)) {
                    return { id: imports[key] + id.slice(key.length), external: true };
                }
            }
            return null;
        }
    };
}

export default defineConfig({
  // Root directory
  root: '.',

  // Public base path
  base: '/',

  // Build options
  build: {
    outDir: 'dist',
    assetsDir: 'assets',

    // Code splitting configuration
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        // Naming pattern for chunks
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      },
      // External dependencies (loaded via CDN)
      external: []
    },

    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: []
      }
    },

    // Source maps for debugging
    sourcemap: true,

    // Asset handling
    assetsInlineLimit: 4096, // 4kb - inline small assets

    // CSS code splitting
    cssCodeSplit: true,

    // Report compressed size
    reportCompressedSize: true,

    // Chunk size warning limit (500kb)
    chunkSizeWarningLimit: 500
  },

  // Development server
  server: {
    port: 3000,
    open: true,
    cors: true,
    strictPort: false,

    // Hot Module Replacement
    hmr: {
      overlay: true
    }
  },

  // Preview server (for production builds)
  preview: {
    port: 4173,
    open: true
  },

  // Plugin configuration
  plugins: [
    // MUST come first: it resolves the CDN bare specifiers before Vite's own
    // import-analysis tries (and fails) to find them in node_modules.
    importMapPlugin(),

    // Legacy browser support (optional - adds polyfills)
    legacy({
      targets: ['defaults', 'not IE 11'],
      modernPolyfills: true
    })
  ],

  // Optimization
  optimizeDeps: {
    include: [], // Three.js loaded via CDN
    exclude: []
  },

  // Asset handling
  assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.hdr'],

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify('2.0.1'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  }
});
