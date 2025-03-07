import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,  // Don't inject automatic registration
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'firebase-messaging-sw.js'],
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
              cacheName: 'touchbase-v2.5.5-manifest',
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
              cacheName: 'touchbase-v2.5.5-api',
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
              cacheName: 'touchbase-v2.5.5-api',
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
              cacheName: 'touchbase-v2.5.5-static',
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
              cacheName: 'touchbase-v2.5.5-fcm',
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
        drop_console: true,
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
    host: true,
    headers: {
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "default-src 'self'; connect-src 'self' https://*.supabase.co https://*.groq.com https://*.brevo.com https://api.brevo.com https://api.openai.com https://api.openrouter.ai https://openrouter.ai https://*.googleapis.com https://*.firebaseapp.com https://*.appspot.com https://analytics.google.com https://iid-keyserver.googleapis.com https://*.paypal.com https://api-m.paypal.com https://vitals.vercel-insights.com https://va.vercel-scripts.com https://play.google.com https://www.gstatic.com/firebasejs/ wss://*.firebaseio.com https://fcmregistrations.googleapis.com ws://localhost:* ws://127.0.0.1:* https://oauth2.googleapis.com https://androidpublisher.googleapis.com https://fcm.googleapis.com https://deno.land https://esm.sh https://cdn.esm.sh; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.paypal.com https://va.vercel-scripts.com https://*.firebaseapp.com https://*.googleapis.com https://www.gstatic.com https://play.google.com https://www.gstatic.com/firebasejs/ https://deno.land https://esm.sh https://cdn.esm.sh; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://* blob:; font-src 'self' data:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; frame-src https://*.paypal.com https://api-m.paypal.com https://*.firebaseapp.com https://play.google.com; worker-src 'self' blob: https://www.gstatic.com/firebasejs/; child-src 'self' blob:; manifest-src 'self'; media-src 'self'",
      'Permissions-Policy': "geolocation=self, payment=*, camera=self, microphone=self, magnetometer=self, accelerometer=self, gyroscope=self",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  },
  preview: {
    port: 3000,
    host: true,
    headers: {
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "default-src 'self'; connect-src 'self' https://*.supabase.co https://*.groq.com https://*.brevo.com https://api.brevo.com https://api.openai.com https://api.openrouter.ai https://openrouter.ai https://*.googleapis.com https://*.firebaseapp.com https://*.appspot.com https://analytics.google.com https://iid-keyserver.googleapis.com https://*.paypal.com https://api-m.paypal.com https://vitals.vercel-insights.com https://va.vercel-scripts.com https://play.google.com https://www.gstatic.com/firebasejs/ wss://*.firebaseio.com https://fcmregistrations.googleapis.com https://oauth2.googleapis.com https://androidpublisher.googleapis.com https://fcm.googleapis.com https://deno.land https://esm.sh https://cdn.esm.sh; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.paypal.com https://va.vercel-scripts.com https://*.firebaseapp.com https://*.googleapis.com https://www.gstatic.com https://play.google.com https://www.gstatic.com/firebasejs/ https://deno.land https://esm.sh https://cdn.esm.sh; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://* blob:; font-src 'self' data:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; frame-src https://*.paypal.com https://api-m.paypal.com https://*.firebaseapp.com https://play.google.com; worker-src 'self' blob: https://www.gstatic.com/firebasejs/; child-src 'self' blob:; manifest-src 'self'; media-src 'self'",
      'Permissions-Policy': "geolocation=self, payment=*, camera=self, microphone=self, magnetometer=self, accelerometer=self, gyroscope=self",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  }
});
