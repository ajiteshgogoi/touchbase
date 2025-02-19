import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'firebase/app',
      'firebase/messaging'
    ],
    exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  },
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
      polyfill: true,
      resolveDependencies: (filename) => {
        if (filename.includes('node_modules')) {
          return [];
        }
        return undefined;
      }
    },
    cssCodeSplit: true,
    reportCompressedSize: true,
    terserOptions: {
      compress: {
        drop_console: true,
        ecma: 2020,
        passes: 3,
        pure_getters: true,
        unsafe: true,
        unsafe_comps: true,
        toplevel: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        drop_debugger: true
      },
      mangle: {
        toplevel: true
      }
    },
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        generatedCode: {
          preset: 'es2015',
          symbols: false,
          },
          compact: true
        },
        treeshake: {
          moduleSideEffects: true,
          propertyReadSideEffects: true
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
