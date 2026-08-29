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
  /**
   * A value was there and could not be read — storage refused, or the bytes do not parse (the
   * mid-`setItem` damage this codebase models everywhere else).
   *
   * Zero and unreadable are not the same child. Every caller of this module is deciding something
   * one-way — whether a restore door may appear, whether an account may be abandoned, whether a
   * roster entry may be dropped — so an unreadable namespace must never be counted as an empty one.
   */
  damaged: boolean
}

const EMPTY: History = { stars: 0, events: 0, damaged: false }

/**
 * `profileId` is nullable on purpose: `null` reads the legacy, un-namespaced keys, which is what a
 * device that has not run the Phase 11 migration (or whose storage refused the active-profile
 * write) is still using. `profileStorageKey` already collapses a non-id to the bare `speakup.`
 * prefix, so this is one call either way.
 */
export function profileHistory(profileId: string | null): History {
  const stars = readStars(profileId)
  const events = readEventCount(profileId)
  return { stars: stars.value, events: events.value, damaged: stars.damaged || events.damaged }
}

/** The same question over a whole roster, summed. An empty list reads as an empty history. */
export function sumHistory(profileIds: readonly (string | null)[]): History {
  return profileIds.reduce<History>((total, id) => {
    const one = profileHistory(id)
    return {
      stars: total.stars + one.stars,
      events: total.events + one.events,
      damaged: total.damaged || one.damaged,
    }
  }, EMPTY)
}

/**
 * "Might this child have done something?" — and `damaged` answers yes.
 *
 * Every caller uses this to decide whether it is safe to do something irreversible, so the unknown
 * case has to land on the side that does nothing: the restore door stays hidden, the account counts
 * as holding a child, and the placeholder profile a restore would drop is left alone.
 */
export const hasAnyHistory = (history: History): boolean =>
  history.stars > 0 || history.events > 0 || history.damaged

/** A count, or the admission that there was something there and it could not be counted. */
type Read = { value: number; damaged: boolean }

const NOTHING: Read = { value: 0, damaged: false }
const UNREADABLE: Read = { value: 0, damaged: true }

/** `null` = no such key (an answer); `undefined` = storage refused to say (not an answer). */
function readRaw(profileId: string | null, name: string): string | null | undefined {
  try { return localStorage.getItem(profileStorageKey(profileId ?? '', name)) }
  catch { return undefined }
}

function readStars(profileId: string | null): Read {
  const raw = readRaw(profileId, 'stars')
  if (raw === undefined) return UNREADABLE
  const trimmed = raw?.trim() ?? ''
  if (trimmed === '') return NOTHING
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return UNREADABLE
    return {
      value: Object.values(parsed).reduce<number>(
        (sum, v) => sum + (typeof v === 'number' && Number.isFinite(v) ? v : 0),
        0,
      ),
      damaged: false,
    }
  } catch {
    // Bytes are there and they are not a star map: this child may have any number of stars.
    return UNREADABLE
  }
}

function readEventCount(profileId: string | null): Read {
  const raw = readRaw(profileId, 'activity')
  if (raw === undefined) return UNREADABLE
  const trimmed = raw?.trim() ?? ''
  if (trimmed === '') return NOTHING
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return Array.isArray(parsed) ? { value: parsed.length, damaged: false } : UNREADABLE
  } catch {
    return UNREADABLE
  }
}
