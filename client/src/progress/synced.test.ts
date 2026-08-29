import { describe, it, expect } from 'vitest'
import { SYNCED_KEYS, isSyncedName, isValidStoredValue, syncedForm } from './synced'

/**
 * This file exists to make the allowlist VISIBLE. Mirroring is now fail-closed — a store whose key
 * is not registered simply does not sync, quietly — and the trade only works if the list of what
 * does sync is written down somewhere a reviewer reads.
 */
describe('what is allowed to leave the device', () => {
  it('is exactly these keys, and nothing else', () => {
    expect([...SYNCED_KEYS.keys()].sort()).toEqual([
      'band',
      'leitner',
      'lesson.length',
      'limit.minutes',
      'stars',
    ])
    // Plus the one family whose tail is data. `lessonStore` owns the shape of the day.
    expect(isSyncedName('lesson.2026-08-29')).toBe(true)
    expect(isSyncedName('lesson.not-a-day')).toBe(false)
  })

  it('leaves out the two values that must not be mirrored as kv', () => {
    // The event log goes to the `events` table instead — it outgrows kv's 16 KB ceiling.
    expect(isSyncedName('activity')).toBe(false)
    // A once-a-day confetti stamp is this device's business; syncing it lets one device suppress
    // the celebration on another.
    expect(isSyncedName('celebrated')).toBe(false)
  })

  it('says no to a key no store registered, whatever it looks like', () => {
    // `migrateKeysInto` sweeps unknown legacy keys into the child's namespace on purpose, so these
    // are real shapes that turn up on real devices.
    for (const name of ['voice.lastTranscript', 'recordings', 'some.future.key', 'stars.extra', '']) {
      expect(isSyncedName(name)).toBe(false)
    }
  })

  it('records how each value is written, because two of them are not JSON', () => {
    // `mergeStored` can only call bytes unreadable for a key that is JSON by construction. Get this
    // wrong for `lesson.length` and every pull reads a perfectly good "medium" as damage.
    expect(syncedForm('stars')).toBe('json')
    expect(syncedForm('band')).toBe('json')
    expect(syncedForm('leitner')).toBe('json')
    expect(syncedForm('lesson.2026-08-29')).toBe('json')
    expect(syncedForm('limit.minutes')).toBe('text')
    expect(syncedForm('lesson.length')).toBe('text')
    expect(syncedForm('voice.lastTranscript')).toBeNull()
  })

  it('cannot be fooled by a name off Object.prototype', () => {
    for (const name of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      expect(isSyncedName(name)).toBe(false)
    }
  })
})

describe('the declared shapes', () => {
  it('accepts what the stores actually write, and refuses what they cannot read', () => {
    expect(isValidStoredValue('stars', '{"sword:cat":3}')).toBe(true)
    expect(isValidStoredValue('stars', '[]')).toBe(false)          // parses; is not a map
    expect(isValidStoredValue('stars', '{"a":1,')).toBe(false)     // does not parse
    expect(isValidStoredValue('stars', 'null')).toBe(false)
    expect(isValidStoredValue('band', '{"value":3,"mode":"auto"}')).toBe(true)
    expect(isValidStoredValue('band', '5')).toBe(false)
    expect(isValidStoredValue('leitner', '{}')).toBe(true)
    expect(isValidStoredValue('lesson.2026-08-29', '{"v":1}')).toBe(true)

    // The two bare scalars, where "not JSON" is the correct state.
    expect(isValidStoredValue('limit.minutes', '45')).toBe(true)
    expect(isValidStoredValue('limit.minutes', '{"minutes":15}')).toBe(false)
    expect(isValidStoredValue('limit.minutes', '0')).toBe(false)
    expect(isValidStoredValue('limit.minutes', '')).toBe(false)
    expect(isValidStoredValue('lesson.length', 'short')).toBe(true)
    expect(isValidStoredValue('lesson.length', '["medium"]')).toBe(false)
    expect(isValidStoredValue('lesson.length', '"long"')).toBe(false)
  })

  it('vouches for nothing it does not know', () => {
    // Callers use this to decide whether bytes may be sent or written, so "no opinion" has to read
    // as "no", never as "yes".
    expect(isValidStoredValue('voice.lastTranscript', '{"text":"hi"}')).toBe(false)
    expect(isValidStoredValue('activity', '[]')).toBe(false)
    expect(isValidStoredValue('toString', 'anything')).toBe(false)
  })
})
