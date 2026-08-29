import type { ActivityEvent, ActivityKind } from '../progress/activity'
import { averageScoreByKind, minutesPerDay, streak, weakPhonemes } from '../progress/activity'
import { ACTIVITY_CAP } from '../progress/storageKeys'
import { currentUserId } from './auth'
import { getSupabase } from './supabase'

/**
 * Flow 5 — a parent signed in on another device, reading a child's progress straight off the
 * server. This module is a READ, and only a read: nothing here touches localStorage, the outbox,
 * or any of the merge rules in `sync.ts`.
 *
 * That is a deliberate departure from `pullProfile`, not an oversight. `pullProfile` MERGES a
 * profile's server copy into that profile's own local namespace, which is right for a device that
 * owns the profile — restoring after a cache wipe, or catching up after time offline. It is wrong
 * here for two reasons the design doc calls out by name: the profile being looked at usually has no
 * namespace on this device at all (that is flow 5's whole premise — a parent's OTHER device), and a
 * remote view is explicitly allowed to disagree with the local one rather than reconcile it
 * (`retainedLessonDays` prunes lessons locally that the server still holds, so a remote read
 * legitimately shows more history than the device sitting next to it ever will). Writing what this
 * module fetches into someone's localStorage would quietly turn an honest "this is what the server
 * has" into a corruption of whichever profile happens to be active on the reading device.
 *
 * **Reuse, not new analytics.** Every number below comes from `progress/activity.ts` — the exact
 * queries the local parent dashboard already runs — fed a plain in-memory event array instead of
 * `getActivity()`'s localStorage read. `activity.ts`'s functions were already built to take an
 * events array as an optional argument for precisely this reason (see its own "every query reads a
 * passed events array" test). The one exception, `streak`, needed a small extension first — see the
 * long comment on `fetchRemoteStats` below.
 */

const WEEK_DAYS = 7
/** How many of the weakest phonemes the remote card shows — matches the local dashboard's card. */
const WEAK_PHONEME_COUNT = 5

export type RemoteStats = {
  /** From `activity.ts`'s `streak`, with the lesson-completion rule turned off — see below. */
  streak: number
  /** Minutes practised in the last 7 days, from `minutesPerDay(7, …)` summed the same way the
   * local dashboard sums its own "Tuần này" line. */
  weekMinutes: number
  /** `averageScoreByKind`, unmodified — the same all-time average the local dashboard's three
   * score tiles already show. */
  averages: Record<ActivityKind, number | null>
  /** `weakPhonemes(5, …)`, unmodified. */
  weak: { phoneme: string; avg: number; count: number }[]
  /** How many events the fetch actually returned — 0 is a real, honest answer for a child who
   * genuinely has not practised yet; it is never used to distinguish that from a failed fetch,
   * which reports `null` from `fetchRemoteStats` instead of an object with this at 0. */
  eventCount: number
}

type RemoteEventRow = { ts?: unknown; kind?: unknown; item_id?: unknown; score?: unknown; phonemes?: unknown }

/**
 * An epoch-ms column read back off the wire, or null. `events.ts` is a Postgres `bigint`, which
 * PostgREST usually serialises as a JSON number but a differently configured project could send as
 * a string — accepting both is cheap, and the alternative is a remote view that quietly drops every
 * row on a project where it turns out to matter. Mirrors `cloud/sync.ts`'s `toEpoch`, which this
 * module does not import only because that one is a pull-engine internal, not an exported contract.
 */
function toEpoch(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Server rows to the exact shape `progress/activity.ts`'s queries already expect.
 *
 * This is the adapter's whole "map server rows to the existing helpers' shapes" job, pulled out on
 * its own so a test can call it directly against a plain array — no network, no Supabase client —
 * the same way `cloud/sync.ts`'s own `mergeEventRows` maps the identical row shape for the pull
 * path. A row this build cannot make sense of (no timestamp, no kind, no item id) is dropped rather
 * than guessed at; the child's real events do not need it and a guess could only be wrong.
 */
export function toActivityEvents(rows: readonly RemoteEventRow[]): ActivityEvent[] {
  const events: ActivityEvent[] = []
  for (const row of rows) {
    const ts = toEpoch(row.ts)
    if (ts === null) continue
    if (typeof row.kind !== 'string' || !row.kind) continue
    if (typeof row.item_id !== 'string' || !row.item_id) continue
    const event: ActivityEvent = { ts, kind: row.kind as ActivityKind, id: row.item_id }
    if (typeof row.score === 'number' && Number.isFinite(row.score)) event.score = row.score
    if (Array.isArray(row.phonemes)) event.phonemes = row.phonemes as ActivityEvent['phonemes']
    events.push(event)
  }
  return events.sort((a, b) => a.ts - b.ts)
}

/**
 * One profile's read-only stats, straight from the server.
 *
 * **`null` means "could not find out" and must never be read as "this child has done nothing".**
 * A network failure, a session that dropped mid-request, or RLS refusing the row all land here
 * identically — the caller's job is to say "chưa tải được", never to render zero.
 *
 * A resolved object, on the other hand, may legitimately hold every zero there is: a brand-new
 * profile with no events yet looks exactly like `{ streak: 0, weekMinutes: 0, ... }`, and that is
 * the honest answer for it. The two cases are distinguishable in the type (`null` vs. an object)
 * specifically so a caller cannot collapse them by accident the way an empty array would invite.
 *
 * **Call this only with an id that already came back from `fetchRemoteProfiles()`.** That function
 * scopes its own read to `owner_id = <this session's user>`, so every id it returns has already
 * cleared the one check that matters; this function trusts that and does not repeat it. Handing it
 * an arbitrary id is not a data leak — the `events` table's RLS is scoped through `profiles` the
 * same way — but a profile nobody here can reach would come back as an empty, successful fetch,
 * which is indistinguishable from a real zero. `fetchRemoteProfiles()`'s own contract is what keeps
 * that case from ever reaching here in practice.
 *
 * **Day-completion uses the legacy per-day counters ONLY — never the "finished today's generated
 * lesson" rule `streak` also knows about.** That second rule needs a lesson record, and lesson
 * records live in `kv`, which this function does not fetch (the brief is explicit: reuse the
 * activity queries against a fetched EVENT array, not new analytics over more tables). `streak`'s
 * default lesson lookup reads `lessonForDay`, which is `localStorage` under whichever profile is
 * ACTIVE ON THIS DEVICE — almost never the remote profile being looked at, and sometimes a
 * different child entirely (two profiles, one iPad, one of them open while the parent checks the
 * other's remote numbers). Passing that default through unexamined would silently blend a
 * stranger's lesson history into this child's streak. Passing `() => null` instead makes the
 * fallback explicit and honest: the streak may undercount a day the child finished via a short
 * lesson, but it can never count a day some OTHER profile's lesson happened to complete.
 */
export async function fetchRemoteStats(profileId: string): Promise<RemoteStats | null> {
  const sb = await getSupabase()
  if (!sb) return null
  const userId = await currentUserId()
  if (!userId) return null
  try {
    const { data, error } = await sb
      .from('events')
      .select('ts, kind, item_id, score, phonemes')
      .eq('profile_id', profileId)
      .order('ts', { ascending: false })
      .limit(ACTIVITY_CAP)
    // A refusal, a 500, or a shape this build does not recognise: all of them are "unknown" — see
    // the null-vs-empty-array distinction in the doc comment above.
    if (error || !Array.isArray(data)) return null

    const events = toActivityEvents(data as RemoteEventRow[])
    const now = Date.now()
    return {
      streak: streak(now, events, () => null),
      weekMinutes: minutesPerDay(WEEK_DAYS, now, events).reduce((sum, d) => sum + d.minutes, 0),
      averages: averageScoreByKind(events),
      weak: weakPhonemes(WEAK_PHONEME_COUNT, events),
      eventCount: events.length,
    }
  } catch {
    return null
  }
}
