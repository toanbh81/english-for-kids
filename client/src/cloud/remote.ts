import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivityEvent, ActivityKind, LessonLookup } from '../progress/activity'
import { averageScoreByKind, minutesPerDay, streak, weakPhonemes } from '../progress/activity'
import type { Lesson } from '../progress/lessonStore'
import { lessonDayInName, parseLesson } from '../progress/lessonStore'
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
 * passed events array" test). `streak` needed one small extension first — an injectable lesson
 * lookup — which this module supplies from the SAME profile's server-side lesson records; see the
 * long comment on `fetchRemoteStats` below.
 */

const WEEK_DAYS = 7
/** How many of the weakest phonemes the remote card shows — matches the local dashboard's card. */
const WEAK_PHONEME_COUNT = 5

export type RemoteStats = {
  /** From `activity.ts`'s `streak`, fed this same profile's own remote lesson records — see below. */
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
  /** The newest event's `ts` (epoch ms), i.e. when this profile last actually practised —
   * `undefined` when `eventCount` is 0, since there is no event to date it from. The `events`
   * query already orders by `ts` descending, so this is read straight off the first row rather
   * than recomputed; a caller (the parent dashboard's remote panel) uses it to tell a genuinely
   * stale reading from a fresh one, driven by the clock rather than a flag. */
  updatedAt?: number
}

type RemoteEventRow = { ts?: unknown; kind?: unknown; item_id?: unknown; score?: unknown; phonemes?: unknown }
type RemoteKvRow = { key?: unknown; value?: unknown }

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
 * Build a `LessonLookup` from THIS PROFILE's own server-side `kv` rows — never from `lessonForDay`,
 * which is local storage under whichever profile is active ON THIS DEVICE.
 *
 * This is the fix for the direction the first version of this module only disclosed rather than
 * corrected: `() => null` (the safe fallback against contaminating a remote streak with a stranger's
 * local lesson history) also meant a real, finished day could show `Chuỗi ngày: 0` whenever the
 * legacy per-day counters alone did not reach 1 story / 5 speak / 3 word — which a short generated
 * lesson is explicitly allowed not to. That is the worst direction to be wrong in under this phase's
 * honesty rule: a confident number making a child look like they skipped practice when they did not.
 *
 * The fetched `kv` rows ARE this profile's own record, from the same server the events came from —
 * so building the lookup from them, and refusing to fall back to anything else, closes the gap
 * without reopening the contamination this module exists to avoid. A row that fails
 * `parseLesson`'s validation (a hand-edited value, an older/newer shape) is skipped exactly as
 * `lessonForDay` would skip it locally — that day is simply absent from the map, which
 * `dayIsDone`'s legacy counters still cover.
 *
 * A failure fetching `kv` itself (network, RLS, a malformed reply) does not fail the whole stats
 * read: it returns a lookup that finds nothing, which is the ORIGINAL conservative behaviour and a
 * safe place to land — a possibly-undercounted streak, never a fabricated one.
 */
async function fetchRemoteLessonLookup(sb: SupabaseClient, profileId: string): Promise<LessonLookup> {
  const byDay = new Map<string, Lesson>()
  try {
    const { data, error } = await sb
      .from('kv')
      .select('key, value')
      .eq('profile_id', profileId)
      .like('key', 'lesson.%')
    if (!error && Array.isArray(data)) {
      for (const row of data as RemoteKvRow[]) {
        const name = typeof row.key === 'string' ? row.key : ''
        const day = lessonDayInName(name) // null for `lesson.length`, which this filter also matches
        if (!day) continue
        const lesson = parseLesson(row.value)
        if (lesson) byDay.set(day, lesson)
      }
    }
  } catch { /* degrade to the legacy counters alone — see the doc comment above */ }
  return (day: string) => byDay.get(day) ?? null
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
 * (Only the EVENTS read gates this — a failed lesson-lookup fetch degrades quietly, per
 * `fetchRemoteLessonLookup`'s own doc comment, rather than turning the whole read into "unknown".)
 *
 * **Call this only with an id that already came back from `fetchRemoteProfiles()`.** That function
 * scopes its own read to `owner_id = <this session's user>`, so every id it returns has already
 * cleared the one check that matters; this function trusts that and does not repeat it. Handing it
 * an arbitrary id is not a data leak — both `events` and `kv`'s RLS are scoped through `profiles`
 * the same way — but a profile nobody here can reach would come back as an empty, successful fetch,
 * which is indistinguishable from a real zero. `fetchRemoteProfiles()`'s own contract is what keeps
 * that case from ever reaching here in practice.
 *
 * **Day-completion is real, not approximated: the legacy per-day counters, OR this same profile's
 * own server-side lesson record for that day** — exactly the two-way rule `activity.ts`'s
 * `dayIsDone` already applies locally, just fed a lookup built from `kv` instead of `localStorage`.
 * See `fetchRemoteLessonLookup` for why that lookup may never fall back to `lessonForDay`.
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

    // `data` is still in the query's own `ts` descending order here — the newest row is `data[0]`.
    // Read before `toActivityEvents` re-sorts ascending, so this does not need its own re-scan.
    const newestRow = (data as RemoteEventRow[])[0]
    const updatedAt = newestRow ? toEpoch(newestRow.ts) ?? undefined : undefined

    const events = toActivityEvents(data as RemoteEventRow[])
    const lessonLookup = await fetchRemoteLessonLookup(sb, profileId)
    const now = Date.now()
    return {
      streak: streak(now, events, lessonLookup),
      weekMinutes: minutesPerDay(WEEK_DAYS, now, events).reduce((sum, d) => sum + d.minutes, 0),
      averages: averageScoreByKind(events),
      weak: weakPhonemes(WEAK_PHONEME_COUNT, events),
      eventCount: events.length,
      updatedAt,
    }
  } catch {
    return null
  }
}
