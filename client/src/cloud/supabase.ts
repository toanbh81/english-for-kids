import type { SupabaseClient } from '@supabase/supabase-js'

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

// `null` = not decided yet; the promise, once made, is the decision.
let client: Promise<SupabaseClient | null> | null = null

export function isCloudConfigured(): boolean {
  return readEnv('VITE_SUPABASE_URL') !== '' && readEnv('VITE_SUPABASE_ANON_KEY') !== ''
}

/**
 * The shared Supabase client, or null when the app is running without a cloud.
 *
 * Memoized as a PROMISE, for two reasons. The obvious one: a second client
 * would mean a second auth session listener and a second token refresh timer
 * racing the first, and concurrent callers must therefore share one build.
 *
 * The one that shows up on the child's iPad: `supabase-js` is ~214 KB of the
 * critical path, and on a device with no cloud configured — CI, a contributor's
 * clone, and every build until the project's env vars exist — it is 214 KB
 * spent on nothing. Behind `import()` it becomes a chunk that is fetched only
 * once `isCloudConfigured()` says there is something to talk to, and the app a
 * six-year-old waits for is the app they were waiting for before Phase 11.
 */
export function getSupabase(): Promise<SupabaseClient | null> {
  client ??= build()
  return client
}

async function build(): Promise<SupabaseClient | null> {
  if (!isCloudConfigured()) return null
  try {
    const { createClient } = await import('@supabase/supabase-js')
    return createClient(readEnv('VITE_SUPABASE_URL'), readEnv('VITE_SUPABASE_ANON_KEY'), {
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
    // A malformed URL in the env — or a chunk that never arrived, on the flaky
    // hotel Wi-Fi this app is used on — must not take the child's app down with
    // it. It is the same answer as having no cloud at all.
    //
    // The memo is dropped rather than left holding this null: an env that is
    // malformed will fail again in a microsecond, but a chunk that failed to
    // download deserves to be asked for again on the next sync attempt instead
    // of turning one bad moment into a session with no cloud in it.
    client = null
    return null
  }
}

/** Test seam: forget the memoized decision (also used after an env change). */
export function resetSupabaseClient(): void {
  client = null
}
