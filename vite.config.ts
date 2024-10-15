import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const workerImportMetaUrlRE = /\bnew\s+(?:Worker|SharedWorker)\s*\(\s*(new\s+URL\s*\(\s*('[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url\s*\))/g;

export default defineConfig({
  base: "/",
  build: {
    chunkSizeWarningLimit: 2048
  },
  optimizeDeps: {
    exclude: ["cubing"]
  },
  worker: {
    format: 'es',
    plugins: () => [
      {
        name: 'disable-nested-workers',
        enforce: 'pre',
        transform(code, id) {
          if (code.includes('new Worker') && code.includes('new URL') && code.includes('import.meta.url')) {
            const result = code.replace(workerImportMetaUrlRE, `((() => { throw new Error('Nested workers are disabled') })()`);
            return result;
          }
        }
      }
    ],
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/worker/[name]-[hash].js',
        assetFileNames: 'assets/worker/[name]-[hash].js'
      }
    }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      manifest: {
        "name": "Cubedex",
        "short_name": "Cubedex",
        "description": "Cubedex allows to train Rubik's cube algorithms like PLL or OLL using a smartcube.",
        "start_url": "index.html",
        "display": "standalone",
        "scope":"/",
        "background_color": "#111827",
        "theme_color": "#111827",
        "icons": [
          {
            "src": "icons/icon-192x192.png",
            "sizes": "192x192",
            "type": "image/png"
          },
          {
            "src": "icons/icon-512x512.png",
            "sizes": "512x512",
            "type": "image/png"
          }
        ],
        "screenshots": [
          {
            "src": "icons/cubedex_screenshot_wide.png",
            "sizes": "1915x1423",
            "type": "image/png",
            "form_factor": "wide"
          },
          {
            "src": "icons/cubedex_screenshot_narrow.png",
            "sizes": "733x1456",
            "type": "image/png",
            "form_factor": "narrow"
          },
          {
            "src": "icons/cubedex_screenshot_narrow.png",
            "sizes": "733x1456",
            "type": "image/png"
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cubedex\.app\/.*\.(png|jpg|svg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      }
    })
  ]
});

