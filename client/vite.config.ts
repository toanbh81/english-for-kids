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
        icons: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
      },
      // The sample word audio is .mp3 and must be precached, or offline practice has no "Nghe mẫu".
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,mp3}'] },
    }),
  ],
  server: { host: true, proxy: { '/api': 'http://localhost:8787' } },
  preview: { proxy: { '/api': 'http://localhost:8787' } },
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', globals: true },
}))
