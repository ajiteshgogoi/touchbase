import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs/promises';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
      react(),
      {
        name: 'firebase-messaging-sw',
        enforce: 'post',
        async generateBundle() {
          // Read the service worker file
          const swContent = await fs.readFile('public/firebase-messaging-sw.js', 'utf-8');
          
          // Replace environment variables
          const processedContent = swContent
            .replace(/"VITE_FIREBASE_API_KEY"/g, `"${process.env.VITE_FIREBASE_API_KEY}"`)
            .replace(/"VITE_FIREBASE_AUTH_DOMAIN"/g, `"${process.env.VITE_FIREBASE_AUTH_DOMAIN}"`)
            .replace(/"VITE_FIREBASE_PROJECT_ID"/g, `"${process.env.VITE_FIREBASE_PROJECT_ID}"`)
            .replace(/"VITE_FIREBASE_STORAGE_BUCKET"/g, `"${process.env.VITE_FIREBASE_STORAGE_BUCKET}"`)
            .replace(/"VITE_FIREBASE_MESSAGING_SENDER_ID"/g, `"${process.env.VITE_FIREBASE_MESSAGING_SENDER_ID}"`)
            .replace(/"VITE_FIREBASE_APP_ID"/g, `"${process.env.VITE_FIREBASE_APP_ID}"`)
            .replace(/"VITE_FIREBASE_MEASUREMENT_ID"/g, `"${process.env.VITE_FIREBASE_MEASUREMENT_ID}"`);
          
          // Write the processed file
          await fs.writeFile('dist/firebase-messaging-sw.js', processedContent);
        }
      },
      VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,  // Don't inject automatic registration
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        globIgnores: ['**/firebase-messaging-sw.js'],  // Don't let Workbox handle Firebase SW
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /firebase-messaging-sw\.js/],  // Don't handle Firebase SW URLs
        runtimeCaching: [
          {
            urlPattern: /manifest\.json$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-manifest',
              cacheableResponse: {
                statuses: [0, 200],
                headers: {
                  'content-type': 'application/manifest+json'
                }
              }
            }
          },
          {
            urlPattern: /^https:\/\/api\.groq\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
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
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(js|css)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 365 * 24 * 60 * 60 // 365 days
              }
            }
          },
          {
            urlPattern: /firebase-messaging-sw\.js/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'firebase-messaging-sw',
              expiration: {
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              matchOptions: {
                ignoreVary: true,
                ignoreSearch: true
              }
            }
          }
        ],
        skipWaiting: true,
        clientsClaim: true
      }
    }),
    {
      name: 'configure-service-worker',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith('firebase-messaging-sw.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          }
          if (req.url?.endsWith('manifest.json')) {
            res.setHeader('Content-Type', 'application/manifest+json');
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
      polyfill: true
    },
    terserOptions: {
      compress: {
        drop_console: false,
        ecma: 2020,
        passes: 3,
        pure_getters: true,
        unsafe: true,
        unsafe_comps: true,
        unsafe_methods: true,
        unsafe_proto: true,
        toplevel: true,
        module: true,
        inline: 3,
        reduce_vars: true,
        reduce_funcs: true,
        sequences: true
      },
      mangle: {
        toplevel: true
      },
      format: {
        comments: false,
        ecma: 2020
      }
    },
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        generatedCode: {
          preset: 'es2015',
          symbols: false
        }
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
