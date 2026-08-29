import { profileStorageKey } from './storageKeys'

/**
 * "Has this child ever done anything" — asked about ANY child on the device, not just the active
 * one.
 *
 * Every other reader of stars and activity goes through `storageKey()`, which resolves to whoever
 * is active right now. That is right for a screen drawing one child's numbers and wrong for the two
 * questions that decide whether a whole ACCOUNT can be abandoned: Home's restore link and
 * `/start`'s stranding check. Both used the active namespace, so a family with two children could
 * hand the iPad to the empty sibling, see the restore door appear on their Home, and sign into
 * another account — stranding the first child's months of progress under an owner nothing can reach
 * again. A sibling's namespace is not "someone else's data" for that question; it is the same
 * anonymous account's data.
 *
 * Reads are deliberately dumb and defensive: a corrupt or unreadable value counts as zero rather
 * than throwing, because the caller is a render path on the child's Home screen.
 */

export type History = {
  /** Total stars across every card in that child's namespace. */
  stars: number
  /** How many activity events that child's log holds. */
  events: number
}

const EMPTY: History = { stars: 0, events: 0 }

/**
 * `profileId` is nullable on purpose: `null` reads the legacy, un-namespaced keys, which is what a
 * device that has not run the Phase 11 migration (or whose storage refused the active-profile
 * write) is still using. `profileStorageKey` already collapses a non-id to the bare `speakup.`
 * prefix, so this is one call either way.
 */
export function profileHistory(profileId: string | null): History {
  return {
    stars: readStars(profileId),
    events: readEventCount(profileId),
  }
}

/** The same question over a whole roster, summed. An empty list reads as an empty history. */
export function sumHistory(profileIds: readonly (string | null)[]): History {
  return profileIds.reduce<History>((total, id) => {
    const one = profileHistory(id)
    return { stars: total.stars + one.stars, events: total.events + one.events }
  }, EMPTY)
}

export const hasAnyHistory = (history: History): boolean => history.stars > 0 || history.events > 0

function readRaw(profileId: string | null, name: string): string | null {
  try { return localStorage.getItem(profileStorageKey(profileId ?? '', name)) }
  catch { return null }
}

function readStars(profileId: string | null): number {
  try {
    const parsed: unknown = JSON.parse(readRaw(profileId, 'stars') ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 0
    return Object.values(parsed).reduce<number>(
      (sum, v) => sum + (typeof v === 'number' && Number.isFinite(v) ? v : 0),
      0,
    )
  } catch {
    return 0
  }
}

function readEventCount(profileId: string | null): number {
  try {
    const parsed: unknown = JSON.parse(readRaw(profileId, 'activity') ?? '[]')
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}
