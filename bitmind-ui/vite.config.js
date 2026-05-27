import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'check-legacy-api',
      generateBundle(options, bundle) {
        let hasLegacyApi = false;
        for (const fileName in bundle) {
          const file = bundle[fileName];
          if (file.type === 'chunk' && file.code) {
            if (file.code.includes('/api/devices')) {
              hasLegacyApi = true;
              console.error(`❌ BUILD FAILED: Legacy /api/devices found in ${fileName}`);
            }
          }
        }
        if (hasLegacyApi) {
          throw new Error('Build failed: Legacy /api/devices references detected. Use /api/miners instead.');
        }
      }
    }
  ],
  base: '/', // Ensure assets are served from root
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
