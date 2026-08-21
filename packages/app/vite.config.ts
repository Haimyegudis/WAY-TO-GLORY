import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
        // Keep the install shell small. The career data and cloud SDK are lazy chunks;
        // each is cached on first use instead of being downloaded with the title screen.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // 605 club badges are far too much install weight for a phone, and a career only
        // shows a handful of them. They are cached the first time they are drawn
        // instead, which keeps the install small and still works offline afterwards.
        globIgnores: [
          '**/crests/**',
          '**/crests.html',
          '**/audio/**',
          // The shop's photographs are two megabytes he may never open. Same bargain as
          // the badges: cached the first time he looks at them.
          '**/life/**',
          '**/assets/pack-*.js',
          '**/assets/cloud-*.js',
        ],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(pack|cloud)-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'career-lazy-data',
              expiration: { maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/life\/.*\.(jpe?g|png)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'life-photos',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
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
