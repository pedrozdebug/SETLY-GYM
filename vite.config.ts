import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png', 'splash/*.png'],
      manifest: {
        id: '/',
        name: 'Setly Gym',
        short_name: 'Setly Gym',
        description: 'Treinos de musculação, rotinas, progressão de cargas, recordes e relatórios — funciona offline.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#09090B',
        theme_color: '#09090B',
        categories: ['health', 'fitness', 'sports', 'lifestyle'],
        prefer_related_applications: false,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
        ],
        screenshots: [
          { src: '/screenshots/mobile-dashboard.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Painel inicial' },
          { src: '/screenshots/mobile-workout.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Treino ativo' },
          { src: '/screenshots/mobile-progress.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Progressão de cargas' },
          { src: '/screenshots/desktop-reports.png', sizes: '2560x1440', type: 'image/png', form_factor: 'wide', label: 'Relatórios' },
        ],
        shortcuts: [
          { name: 'Iniciar treino', short_name: 'Treinar', url: '/#/', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Relatórios', short_name: 'Relatórios', url: '/#/relatorios', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Histórico', short_name: 'Histórico', url: '/#/historico', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
        launch_handler: { client_mode: 'focus-existing' },
        handle_links: 'preferred',
        edge_side_panel: { preferred_width: 420 },
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        globIgnores: ['screenshots/**', 'splash/**'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/splash/') || url.pathname.startsWith('/screenshots/'),
            handler: 'CacheFirst',
            options: { cacheName: 'setly-images', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('ytimg.com'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'setly-video-thumbs', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
