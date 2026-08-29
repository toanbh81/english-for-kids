import type { AuthChangeEvent, AuthError, Session, User } from '@supabase/supabase-js'
// The leaf of the storage layer, not the profile module: importing `profileState` here would close
// a cycle (it imports this file), and all this needs to know is whether a child lives here.
import { activeProfileId } from '../progress/storageKeys'
import { getSupabase } from './supabase'

/**
 * Who the device is signed in as — and the whole of "use first, link later, lose nothing".
 *
 * The shape of it (spec §Non-negotiable principles, flows 1, 2, 7):
 *
 *  - A child never has an account. The account is created SILENTLY, as a Supabase anonymous user,
 *    the first time the app is online. Nothing on screen mentions it, nothing waits for it, and
 *    every function here returns a value rather than throwing — a failed sign-in must look exactly
 *    like being offline, which is to say: like nothing at all.
 *  - When a parent later links their email, `updateUser({ email })` upgrades THAT SAME user id.
 *    Every row the child has already synced is already theirs, so there is no migration and no
 *    moment where progress is in two places.
 *  - Without `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` there is no cloud at all: `getSupabase()`
 *    returns null and every function below is a no-op that reports "unconfigured". CI, and a
 *    contributor who cloned the repo, run the same app minus the mirror.
 *
 * Session persistence is supabase-js's own (`persistSession` + `autoRefreshToken`, under
 * `speakup.auth`), so a returning child is still signed in with no code here.
 */

export type AuthResult = { ok: true; userId: string | null } | { ok: false; error: string }

/** Not a validator — just enough to avoid asking the server about obvious typos. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const UNCONFIGURED = 'cloud-unconfigured'

const failed = (error: string): AuthResult => ({ ok: false, error })

const message = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : 'unknown-error'

// ---------------------------------------------------------------------------
// Reading the current session
// ---------------------------------------------------------------------------

/** The signed-in user, or null when there is no cloud, no session, or storage said no. */
export async function currentUser(): Promise<User | null> {
  const sb = await getSupabase()
  if (!sb) return null
  try {
    // getSession() reads the persisted session locally; getUser() would be a network round trip
    // on every call, and nothing here is a security decision — the server re-checks the JWT.
    const { data } = await sb.auth.getSession()
    return data?.session?.user ?? null
  } catch {
    return null
  }
}

export async function currentUserId(): Promise<string | null> {
  return (await currentUser())?.id ?? null
}

/**
 * This device's own access token, for the one caller outside this module that has to present it
 * itself: Task 4's `/api/recover` call (flow 4) authenticates as "whoever this JWT says", and the
 * server never accepts an id out of the request body. Null under every failure mode `currentUser`
 * already handles — no cloud, no session, storage unavailable.
 */
export async function currentAccessToken(): Promise<string | null> {
  const sb = await getSupabase()
  if (!sb) return null
  try {
    const { data } = await sb.auth.getSession()
    return data?.session?.access_token ?? null
  } catch {
    return null
  }
}

/** True while the account is still the silent one — i.e. no parent has linked an email yet. */
export async function isAnonymous(): Promise<boolean> {
  const user = await currentUser()
  return user !== null && user.is_anonymous === true
}

/** The linked parent email, or null. The parent screen shows this; the child never sees it. */
export async function currentEmail(): Promise<string | null> {
  return (await currentUser())?.email ?? null
}

// ---------------------------------------------------------------------------
// The silent anonymous bootstrap (flow 1)
// ---------------------------------------------------------------------------

export type BootstrapOptions = {
  /** How many sign-in attempts before giving up until the next `online` event. */
  attempts?: number
  /** First backoff step; each retry doubles it. */
  baseDelayMs?: number
  /** Test seam. */
  sleep?: (ms: number) => Promise<void>
  /** Test seam. */
  online?: () => boolean
  /**
   * What to run when the network comes back after a launch that could not sign in.
   *
   * It exists because signing in is only the first third of connecting: the profile rows and the
   * recovery code have to follow, and a device that booted offline had none of that done. The
   * caller passes the whole sequence (`connectCloud`), so the retry is the same work the launch
   * would have done, rather than a sign-in that leaves a session with nothing under it.
   */
  retry?: () => void
}

const DEFAULT_ATTEMPTS = 5
const DEFAULT_BASE_DELAY_MS = 1000

const realSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/**
 * `navigator.onLine === false` is the only reliable half of that flag: false really does mean no
 * network, while true only means "an interface is up". So it is used to skip pointless attempts,
 * never to decide that a request will succeed.
 */
const isOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false

let bootstrap: Promise<void> | null = null
let armedForOnline = false

/**
 * Sign in anonymously, once, quietly.
 *
 * Concurrent callers share one attempt (two sign-ins would mean two accounts and a split child).
 * Offline, it does not try at all — it arms a one-shot `online` listener and returns, so an iPad
 * that spends the first week off Wi-Fi simply keeps its progress locally, then picks up an account
 * the moment it sees a network. The promise resolves either way and never rejects.
 */
export function startAnonymousSession(options: BootstrapOptions = {}): Promise<void> {
  bootstrap ??= runAnonymousBootstrap(options)
    // `finally`, not `then`: its callback runs BEFORE the promise the caller is awaiting settles,
    // so an `online` event that arrives the instant a failed attempt finishes starts a new attempt
    // instead of being handed the old, already-resolved one.
    .finally(() => { bootstrap = null })
    .catch(() => undefined)
  return bootstrap
}

async function runAnonymousBootstrap(options: BootstrapOptions): Promise<void> {
  const sb = await getSupabase()
  if (!sb) return
  if ((await currentUserId()) !== null) return

  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS)
  const base = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const sleep = options.sleep ?? realSleep
  const online = options.online ?? isOnline

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (!online()) break
    try {
      const { error } = await sb.auth.signInAnonymously()
      if (!error) return
    } catch { /* a network that threw is the same news as a network that errored */ }
    if (attempt < attempts - 1) await sleep(base * 2 ** attempt)
  }
  retryWhenOnline(options)
}

function retryWhenOnline(options: BootstrapOptions): void {
  if (armedForOnline || typeof window === 'undefined') return
  armedForOnline = true
  window.addEventListener('online', () => {
    armedForOnline = false
    if (options.retry) options.retry()
    else void startAnonymousSession(options)
  }, { once: true })
}

// ---------------------------------------------------------------------------
// The recovery code (flows 4 and 7)
// ---------------------------------------------------------------------------

/**
 * The 8-character code the parent screen shows once ("chụp màn hình lại nhé"), created with the
 * account.
 *
 * The insert names ONLY `user_id`, because that is the only column the migration grants a client
 * (supabase/migrations/0001_profiles_sync.sql): the code itself comes from the column default,
 * `gen_recovery_code()`. A client that could choose its own code would turn the UNIQUE index into
 * an oracle for guessing someone else's. So: no code is ever generated in JavaScript.
 *
 * Returns null rather than throwing — a missing recovery code is a thing the parent screen can be
 * quiet about, not an error the child's app should ever notice.
 */
export async function ensureRecoveryCode(): Promise<string | null> {
  const sb = await getSupabase()
  if (!sb) return null
  const user = await currentUser()
  const userId = user?.id
  if (!userId) return null

  const existing = await getRecoveryCode()
  if (existing) return existing

  // Nothing found — and for a LINKED account that is the right answer, not a gap to fill. A trigger
  // on auth.users drops the code the moment the account gains an email or a phone, because
  // /api/recover refuses to redeem for anything but an anonymous user (the code outliving the
  // upgrade was a way to take over the family account). Minting another here would produce a code
  // that can never be redeemed, and the parent screen would show it under "chụp màn hình lại nhé"
  // as if it were a way home. After linking, the way home is the email.
  if (user.is_anonymous !== true || user.email) return null

  try {
    const { data, error } = await sb
      .from('recovery_codes')
      .insert({ user_id: userId })
      .select('code')
      .single()
    if (!error && data && typeof data.code === 'string') return data.code
  } catch { /* fall through: another device may have inserted the row first */ }

  // The primary key is the user id, so a second device racing this one loses the insert and finds
  // the winner's code here. Reading it back is the whole recovery from that race.
  return await getRecoveryCode()
}

/** This account's recovery code if it has one, without creating one. */
export async function getRecoveryCode(): Promise<string | null> {
  const sb = await getSupabase()
  if (!sb) return null
  const userId = await currentUserId()
  if (!userId) return null
  try {
    const { data, error } = await sb
      .from('recovery_codes')
      .select('code')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return null
    return typeof data.code === 'string' ? data.code : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Email: linking (flow 2) and returning devices (flow 3)
// ---------------------------------------------------------------------------

/**
 * Which kind of 6-digit code is in the parent's inbox.
 *
 * `email_change` is what an anonymous account's `updateUser({ email })` sends — the upgrade path,
 * which keeps the user id and therefore keeps every row. `email` is what `signInWithOtp` sends on
 * a device that has nothing yet. The token looks identical in the email, so the flow that asked
 * for it is remembered here rather than guessed.
 */
type OtpKind = 'email_change' | 'email'

let pending: { email: string; kind: OtpKind } | null = null

/**
 * Is this refusal one that trying the other kind of code could get past?
 *
 * A token that belongs to the other flow simply is not found for this one, and Supabase says so
 * with a 4xx about an invalid or expired token. A 429 (the parent has asked too often) and a 5xx
 * say nothing about the kind at all, and a second call would only burn one more of the attempts
 * they have left.
 */
function looksLikeWrongKind(error: AuthError): boolean {
  const status = typeof error.status === 'number' ? error.status : 0
  if (status === 429 || status >= 500) return false
  return /invalid|expired|not\s*found/i.test(error.message ?? '')
}

/**
 * Upgrade this device's anonymous account to a parent email (flow 2).
 *
 * Supabase sends a 6-digit code to the address; `verifyEmailOtp` finishes it. The user id does not
 * change, which is the whole promise: the child's synced rows already belong to this account.
 */
export async function linkEmail(email: string): Promise<AuthResult> {
  const sb = await getSupabase()
  if (!sb) return failed(UNCONFIGURED)
  const address = email.trim().toLowerCase()
  if (!EMAIL_RE.test(address)) return failed('invalid-email')
  try {
    const { error } = await sb.auth.updateUser({ email: address })
    // Nothing was sent, so nothing is pending: leaving an earlier flow recorded here would send
    // the NEXT code the parent types to the wrong verification.
    if (error) { pending = null; return failed(error.message) }
    pending = { email: address, kind: 'email_change' }
    return { ok: true, userId: await currentUserId() }
  } catch (e) {
    pending = null
    return failed(message(e))
  }
}

/**
 * Sign a parent in on a device that has no session of its own — a new iPad, or one whose cache was
 * wiped (flow 3). Creates the account if that email has never been used, which is what makes it
 * safe to offer on a fresh device: the parent types their address and gets their family either way.
 *
 * **It refuses while this device is holding an unlinked anonymous account with a child on it.**
 * Signing in as somebody else would strand that account: its rows would still exist, owned by a
 * user id nothing can reach again, with the recovery code as the only way back — and the child's
 * local progress would sit in a namespace the new account has never heard of. The right move there
 * is `linkEmail`, which upgrades in place and keeps everything.
 *
 * Task 4 owns that choice: it shows the parent which situation they are in and only passes
 * `{ abandonAnonymous: true }` once they have said, in Vietnamese and in as many words, that this
 * iPad's local progress is not the progress they are after.
 */
export async function signInWithEmail(
  email: string,
  options: { abandonAnonymous?: boolean } = {},
): Promise<AuthResult> {
  const sb = await getSupabase()
  if (!sb) return failed(UNCONFIGURED)
  const address = email.trim().toLowerCase()
  if (!EMAIL_RE.test(address)) return failed('invalid-email')
  if (!options.abandonAnonymous && activeProfileId() !== null && (await isAnonymous())) {
    return failed('anonymous-session-in-use')
  }
  try {
    const { error } = await sb.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } })
    if (error) { pending = null; return failed(error.message) }
    pending = { email: address, kind: 'email' }
    return { ok: true, userId: await currentUserId() }
  } catch (e) {
    pending = null
    return failed(message(e))
  }
}

/**
 * Finish either email flow with the 6 digits the parent typed.
 *
 * The kind is the one the flow above recorded. If the page was reloaded in between — the parent
 * left the app to read the email, iOS discarded the tab — there is nothing recorded, so an
 * anonymous session is assumed to be mid-upgrade and anything else mid-sign-in. Either way the
 * other kind is tried once before giving up: a rejected token is not consumed, and getting this
 * wrong would mean telling a parent their correct code is wrong.
 *
 * That second attempt is only made when the refusal is the kind a wrong TYPE produces — a token
 * that cannot be found for this flow. A rate limit or a 500 says nothing about the kind, and
 * asking again would spend the parent's remaining attempts on the same wall. The message reported
 * is always the FIRST one, because that is the answer for the flow the parent was actually in.
 */
export async function verifyEmailOtp(email: string, token: string): Promise<AuthResult> {
  const sb = await getSupabase()
  if (!sb) return failed(UNCONFIGURED)
  const address = email.trim().toLowerCase()
  const code = token.trim()
  if (!EMAIL_RE.test(address)) return failed('invalid-email')
  if (!code) return failed('invalid-token')

  const first: OtpKind = pending?.email === address
    ? pending.kind
    : (await isAnonymous()) ? 'email_change' : 'email'
  const kinds: OtpKind[] = first === 'email_change' ? ['email_change', 'email'] : ['email', 'email_change']

  let firstError: string | null = null
  for (const kind of kinds) {
    try {
      const { data, error } = await sb.auth.verifyOtp({ email: address, token: code, type: kind })
      if (!error) {
        pending = null
        return { ok: true, userId: data?.user?.id ?? (await currentUserId()) }
      }
      firstError ??= error.message
      if (!looksLikeWrongKind(error)) break
    } catch (e) {
      firstError ??= message(e)
      break
    }
  }
  return failed(firstError ?? 'invalid-token')
}

/**
 * Sign out on this device.
 *
 * Only ever offered to a LINKED parent: signing out of an account that is still anonymous would
 * strand it — the recovery code would be the only way back — so the parent screen must not show
 * this until an email exists (flow 2 before flow 3).
 */
export async function signOut(): Promise<AuthResult> {
  const sb = await getSupabase()
  if (!sb) return failed(UNCONFIGURED)
  try {
    const { error } = await sb.auth.signOut()
    pending = null
    if (error) return failed(error.message)
    return { ok: true, userId: null }
  } catch (e) {
    return failed(message(e))
  }
}

/**
 * Session changes, for the parent screen.
 *
 * The one caller here that cannot be async: React effects must hand back their cleanup
 * synchronously. So the subscription is attached once the client chunk has loaded, and the
 * unsubscribe returned right now closes over whatever has happened by the time it is called — a
 * component that mounts and unmounts before the chunk arrives cancels the attachment instead of
 * leaking a listener into a screen that is gone.
 */
export function subscribeAuth(listener: (event: AuthChangeEvent, session: Session | null) => void): () => void {
  let cancelled = false
  let detach: (() => void) | null = null

  void getSupabase().then(sb => {
    if (!sb || cancelled) return
    try {
      const { data } = sb.auth.onAuthStateChange(listener)
      detach = () => {
        try { data?.subscription?.unsubscribe() } catch { /* already gone */ }
      }
    } catch { /* no subscription is better than a broken screen */ }
  }).catch(() => undefined)

  return () => {
    cancelled = true
    detach?.()
    detach = null
  }
}

/** Test seam: forget the in-flight bootstrap, the armed listener and the pending OTP flow. */
export function resetAuthState(): void {
  bootstrap = null
  armedForOnline = false
  pending = null
}
