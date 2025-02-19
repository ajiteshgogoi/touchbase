import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'script',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'TouchBase',
        short_name: 'TouchBase',
        description: 'Stay connected with the people who matter most',
        theme_color: '#0EA5E9',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff'
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.groq\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'groq-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/[^.]+\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    }),
    {
      name: 'configure-service-worker',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith('firebase-messaging-sw.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          }
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    sourcemap: false,
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    modulePreload: {
      polyfill: true // Enable module preload polyfill
    },
    terserOptions: {
      compress: {
        drop_console: true,
        ecma: 2020,
        passes: 2
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core dependencies
          if (id.includes('node_modules')) {
            if (id.includes('react')) {
              return 'vendor-react';
            }
            if (id.includes('@headlessui') || id.includes('@heroicons')) {
              // Split UI components into smaller chunks
              const chunk = id.includes('@headlessui') ? 'headless-ui' : 'heroicons';
              return `vendor-ui-${chunk}`;
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-state';
            }
            if (id.includes('dayjs')) {
              return 'vendor-date';
            }
            // Other node_modules go to vendor chunk
            return 'vendor';
          }
          
          // Feature-based code splitting
          if (id.includes('/components/')) {
            if (id.includes('/layout/')) {
              return 'layout';
            }
            if (id.includes('/shared/')) {
              return 'shared';
            }
            // Split other components by their directory
            const match = id.match(/\/components\/([^/]+)\//);
            if (match) {
              return `feature-${match[1]}`;
            }
          }
          
          // Route-based code splitting
          if (id.includes('/pages/')) {
            const match = id.match(/\/pages\/([^/]+)\./);
            if (match) {
              return `route-${match[1].toLowerCase()}`;
            }
          }
        },
        // Output chunks with content hash for better caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  server: {
    port: 3000,
    host: true
  },
  preview: {
    port: 3000,
    host: true
  }
});
