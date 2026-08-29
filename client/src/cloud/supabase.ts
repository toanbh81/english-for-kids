import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The one place the app learns whether there is a cloud at all.
 *
 * Speak Up! is local-first: localStorage is the source of truth and every
 * screen works with the network off — and with these two env vars missing
 * entirely. A contributor who clones the repo, and CI, have no Supabase
 * project; the app they run must be the same app, minus the mirror. So this
 * module returns `null` instead of throwing, and every caller is expected to
 * treat `null` as "offline forever" rather than as an error.
 *
 * `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public by design: they
 * are compiled into the browser bundle and are useless on their own, because
 * Row Level Security is what protects the data (supabase/migrations). The
 * service-role key is the real secret and never appears in this directory.
 */

const readEnv = (name: string): string => {
  const raw = (import.meta.env as Record<string, unknown>)[name]
  return typeof raw === 'string' ? raw.trim() : ''
}

// `undefined` = not decided yet, `null` = decided: there is no cloud.
let client: SupabaseClient | null | undefined

export function isCloudConfigured(): boolean {
  return readEnv('VITE_SUPABASE_URL') !== '' && readEnv('VITE_SUPABASE_ANON_KEY') !== ''
}

/**
 * The shared Supabase client, or null when the app is running without a cloud.
 * Memoized: a second client would mean a second auth session listener and a
 * second token refresh timer racing the first.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client
  if (!isCloudConfigured()) {
    client = null
    return client
  }
  try {
    client = createClient(readEnv('VITE_SUPABASE_URL'), readEnv('VITE_SUPABASE_ANON_KEY'), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The parent types a 6-digit code; nothing ever arrives back as a URL
        // fragment, and parsing one would only be a way to be surprised.
        detectSessionInUrl: false,
        storageKey: 'speakup.auth',
      },
    })
  } catch {
    // A malformed URL in the env must not take the child's app down with it.
    client = null
  }
  return client
}

/** Test seam: forget the memoized decision (also used after an env change). */
export function resetSupabaseClient(): void {
  client = undefined
}
