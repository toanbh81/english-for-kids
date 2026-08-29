import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// `vite --mode nossl` serves plain HTTP (for in-app browser previews that reject self-signed certs);
// the default dev server stays HTTPS because iPad Safari needs it for the microphone.
export default defineConfig(({ mode }) => {
  // Phase 11: the same two-var, both-non-empty rule `client/src/cloud/supabase.ts`'s
  // `isCloudConfigured()` checks at RUNTIME — checked here at BUILD time instead of guessed,
  // because Vite bakes `import.meta.env.VITE_*` into the bundle once and for all, so whatever this
  // says is what that check will keep saying for the life of this build. It decides one thing
  // below: whether the `@supabase/supabase-js` chunk is worth precaching.
  //
  // `loadEnv`'s second argument is the directory it reads `.env` files from — this file's own
  // directory (`client/`), resolved from `import.meta.url` rather than `process.cwd()`, the same
  // "resolve against where this file lives, not wherever it happened to be invoked from" rule
  // `scripts/gen-audio.mjs` already applies to itself. Every current invocation (`pnpm --dir client
  // build`, `vite build` from inside `client/`) has cwd === this directory anyway, so this changes
  // nothing observable today; it just stops being an assumption.
  const clientDir = fileURLToPath(new URL('.', import.meta.url))
  const cloudEnv = loadEnv(mode, clientDir, 'VITE_')
  const cloudConfigured = !!cloudEnv.VITE_SUPABASE_URL?.trim() && !!cloudEnv.VITE_SUPABASE_ANON_KEY?.trim()

  return {
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
          globIgnores: [
            // …but not the voice-audition scratch files: they are alternate takes nothing routes to,
            // and precaching them would push megabytes of dead audio onto the iPad on first launch.
            '**/audio/audition/**',
            // The ~208 kB `@supabase/supabase-js` chunk (named explicitly below, via `manualChunks`,
            // so this glob does not depend on a third-party package's internal file layout) sits
            // behind `isCloudConfigured()` and a dynamic `import()` — Vite still emits the chunk even
            // when the cloud env vars are absent (it cannot prove the branch is dead), but a build
            // with no cloud configured can never reach the import that would need it. Precaching it
            // anyway would be ~208 kB spent on nothing, on exactly the flaky install this phase is
            // otherwise careful about. A CONFIGURED build (`cloudConfigured` above) leaves this glob
            // out and keeps precaching the chunk, because that build really does load it.
            ...(cloudConfigured ? [] : ['**/assets/cloud-vendor-*.js']),
          ],
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
    build: {
      rollupOptions: {
        output: {
          // A stable, deliberate name for the cloud chunk — the alternative is Vite's own naming
          // heuristic for a dynamic-import target, which today happens to be the generic `dist-*.js`
          // (an artifact of `@supabase/supabase-js`'s own package layout) and is not a name this file
          // should depend on staying put across a dependency bump.
          manualChunks(id) {
            if (id.includes('@supabase/supabase-js')) return 'cloud-vendor'
          },
        },
      },
    },
    server: { host: true, proxy: { '/api': 'http://localhost:8787' } },
    preview: { proxy: { '/api': 'http://localhost:8787' } },
    // testTimeout: the default 5s (and testing-library's 1s findBy* wait) flake under full-suite
    // parallelism on this machine — the same test passes 4/4 standalone and fails ~1/5 full runs,
    // always by timeout, never by assertion. The ceilings are for worker CPU starvation, not slowness.
    test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', globals: true, testTimeout: 20000 },
  }
})
