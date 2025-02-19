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
    sourcemap: false, // Disable source maps in production
    target: 'esnext', // Enable latest JS features
    chunkSizeWarningLimit: 1000, // Set chunk size warning limit
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        ecma: 2020,
        passes: 2
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@headlessui/react', '@heroicons/react'],
          'vendor-state': ['@tanstack/react-query'],
          'vendor-date': ['dayjs', 'dayjs/plugin/utc', 'dayjs/plugin/timezone', 'dayjs/plugin/relativeTime'],
          
          // Feature-specific chunks
          'feature-auth': [
            '@supabase/supabase-js',
            './src/lib/supabase/client.ts',
            './src/lib/auth/google.ts'
          ],

          // Route-based chunks (automatically code-split)
          'route-dashboard': [
            './src/pages/Dashboard.tsx',
            './src/components/dashboard/DashboardMetrics.tsx',
            './src/components/dashboard/RecentContacts.tsx'
          ],
          'route-contacts': [
            './src/pages/Contacts.tsx',
            './src/components/contacts/ContactForm.tsx'
          ],
          'route-settings': [
            './src/pages/Settings.tsx',
            './src/components/settings/AISettings.tsx',
            './src/components/settings/NotificationSettings.tsx',
            './src/components/settings/SubscriptionSettings.tsx'
          ],

          // Lazy-loaded features
          'feature-interactions': [
            './src/components/contacts/QuickInteraction.tsx'
          ],
          'feature-feedback': [
            './src/components/shared/FeedbackModal.tsx'
          ]
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
