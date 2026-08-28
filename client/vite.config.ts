import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// `vite --mode nossl` serves plain HTTP (for in-app browser previews that reject self-signed certs);
// the default dev server stays HTTPS because iPad Safari needs it for the microphone.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'nossl' ? [] : [basicSsl()]),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Speak Up!',
        short_name: 'SpeakUp',
        display: 'standalone',
        orientation: 'any',
        background_color: '#FFF8EE',
        theme_color: '#FF7A59',
        // `any` and `maskable` are listed separately on purpose: Android crops a maskable icon to
        // whatever shape the launcher uses, so declaring the same square as both is what turns a
        // mascot into a cropped chin on some phones. The 192 is the size a launcher grid asks for.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        // The sample word audio is .mp3 and must be precached, or offline practice has no "Nghe mẫu".
        globPatterns: ['**/*.{js,css,html,svg,png,mp3}'],
        // …but not the voice-audition scratch files: they are alternate takes nothing routes to,
        // and precaching them would push megabytes of dead audio onto the iPad on first launch.
        globIgnores: ['**/audio/audition/**'],
        // Baloo 2 / Nunito come from Google Fonts, which precaching cannot reach: without these
        // two routes an offline launch falls back to the system font and the whole app reflows.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              // The font files are immutable and few — keep them for a year.
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: { host: true, proxy: { '/api': 'http://localhost:8787' } },
  preview: { proxy: { '/api': 'http://localhost:8787' } },
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', globals: true },
}))
