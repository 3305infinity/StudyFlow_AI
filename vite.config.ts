import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './public/manifest.json';
import path from 'path';

/**
 * Vite configuration for Chrome Extension
 * 
 * Key decisions:
 * 1. @crxjs/vite-plugin: Handles Chrome extension build automatically
 * 2. Multiple entry points: background, content script, sidebar
 * 3. Path aliases for clean imports
 * 4. Build optimizations for extension size
 */
export default defineConfig({
  plugins: [
    react(),
    crx({ manifest: manifest as any }),
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@store': path.resolve(__dirname, './src/store'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },

  build: {
    rollupOptions: {
      input: {
        // Content script will be injected into YouTube pages
        content: 'src/content/index.ts',
        // Background service worker
        background: 'src/background/index.ts',
      },
      output: {
        // Ensure consistent chunk naming for extension
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Optimize for extension size
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
      },
    },
  },

  // Development server config (for testing components)
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
