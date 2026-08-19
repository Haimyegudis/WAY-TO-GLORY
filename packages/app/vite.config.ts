import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'הדרך לתהילה',
        short_name: 'הדרך לתהילה',
        description: 'Live one footballer\'s career, from the academy to the last match.',
        theme_color: '#060b18',
        background_color: '#060b18',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // A new build takes over on the next load instead of waiting for every tab to
        // close, which is what leaves a phone showing a half-updated app.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // The data pack is large but static: cache it so the game opens offline.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // 425 club badges are 30MB of install for a phone, and a career only ever
        // shows a handful of them. They are cached the first time they are drawn
        // instead, which keeps the install small and still works offline afterwards.
        globIgnores: ['**/crests/**', '**/crests.html', '**/audio/**'],
        runtimeCaching: [
          {
            // The human body: one binary, fetched the first time somebody makes a player
            // and kept, so the character works with no network like everything else.
            urlPattern: /\/models\/human\.(bin|json)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'human', expiration: { maxEntries: 4 } },
          },
          {
            // The soundtrack is cached the first time it is heard, not on install.
            urlPattern: /\/audio\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'soundtrack',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
          {
            urlPattern: /\/crests\/.*\.png$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'club-crests',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          engine: ['@fc/engine'],
          pack: ['@fc/data/pack'],
          cloud: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
