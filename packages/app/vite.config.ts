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
        // The data pack is large but static: cache it so the game opens offline.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // 425 club badges are 30MB of install for a phone, and a career only ever
        // shows a handful of them. They are cached the first time they are drawn
        // instead, which keeps the install small and still works offline afterwards.
        globIgnores: ['**/crests/**', '**/crests.html'],
        runtimeCaching: [
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
