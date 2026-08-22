import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
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
    }),
  ],
  server: { host: true, proxy: { '/api': 'http://localhost:8787' } },
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', globals: true },
})
