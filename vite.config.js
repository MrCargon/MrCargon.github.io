import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

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
