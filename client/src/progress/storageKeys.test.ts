import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ACTIVE_PROFILE_KEY,
  PROFILES_KEY,
  activeProfileId,
  isProfileId,
  migrateKeysInto,
  namespacePrefix,
  setActiveProfileId,
  storageKey,
  storageName,
} from './storageKeys'

const ID = '11111111-2222-4333-8444-555555555555'
const OTHER = '99999999-8888-4777-9666-555555555555'

/**
 * What these tests defend: the update that introduces profiles must not cost one child one star.
 * Every case below is a device that already has progress on it.
 */
describe('the storage namespace', () => {
  beforeEach(() => localStorage.clear())

  it('is the legacy key names until a profile is active', () => {
    expect(namespacePrefix()).toBe('speakup.')
    expect(storageKey('stars')).toBe('speakup.stars')
    expect(storageKey('lesson.') + '2026-08-29').toBe('speakup.lesson.2026-08-29')
    expect(activeProfileId()).toBeNull()
  })

  it('is the child\'s own once one is active', () => {
    expect(setActiveProfileId(ID)).toBe(true)
    expect(activeProfileId()).toBe(ID)
    expect(storageKey('stars')).toBe(`speakup.${ID}.stars`)
    expect(storageKey('limit.minutes')).toBe(`speakup.${ID}.limit.minutes`)
  })

  it('reads a key back to the name it was built from', () => {
    setActiveProfileId(ID)
    expect(storageName(storageKey('stars'))).toBe('stars')
    expect(storageName(storageKey('lesson.2026-08-29'))).toBe('lesson.2026-08-29')

    // Not this child's, not a child's at all, not ours.
    expect(storageName(`speakup.${OTHER}.stars`)).toBeNull()
    expect(storageName('speakup.stars')).toBeNull()
    expect(storageName(ACTIVE_PROFILE_KEY)).toBeNull()
    expect(storageName('other-app.stars')).toBeNull()
    expect(storageName(`speakup.${ID}.`)).toBeNull()

    localStorage.removeItem(ACTIVE_PROFILE_KEY)
    expect(storageName('speakup.stars')).toBe('stars')
    expect(storageName(`speakup.${OTHER}.stars`)).toBeNull()
    expect(storageName('speakup.auth')).toBeNull()
  })

  it('refuses an id that is not a UUID, in and out', () => {
    expect(setActiveProfileId('bé-yêu')).toBe(false)
    expect(isProfileId('bé-yêu')).toBe(false)
    expect(isProfileId(ID)).toBe(true)

    // A hand-edited value must not scatter a child's stars under arbitrary text: it reads as "no
    // profile", which is the same data the app had before Phase 11.
    localStorage.setItem(ACTIVE_PROFILE_KEY, '../../evil')
    expect(activeProfileId()).toBeNull()
    expect(storageKey('stars')).toBe('speakup.stars')
  })

  it('survives storage that is not there at all', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('nope') })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('nope') })
    try {
      expect(activeProfileId()).toBeNull()
      expect(storageKey('stars')).toBe('speakup.stars')
      expect(setActiveProfileId(ID)).toBe(false)
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })
})

describe('the one-time migration', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  const legacy = {
    'speakup.stars': JSON.stringify({ 'sword:cat': 3, 'pair:pair-ship-sheep': 2 }),
    'speakup.activity': JSON.stringify([{ ts: 1, kind: 'word', id: 'cat', score: 91 }]),
    'speakup.leitner': JSON.stringify({ cat: { box: 3, due: 99 } }),
    'speakup.band': JSON.stringify({ value: 4, mode: 'manual' }),
    'speakup.limit.minutes': '30',
    'speakup.celebrated': '2026-08-28',
    'speakup.lesson.2026-08-28': JSON.stringify({ v: 1, day: '2026-08-28', created: 5, band: 4, items: [] }),
    'speakup.lesson.length': 'long',
    // A key from a version of the app nobody remembers. It is still this child's.
    'speakup.something.we.forgot': 'keep me',
  }

  const seedLegacy = () => { for (const [k, v] of Object.entries(legacy)) localStorage.setItem(k, v) }

  const snapshot = (): Record<string, string> => {
    const all: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key !== null) all[key] = localStorage.getItem(key) ?? ''
    }
    return all
  }

  it('moves every child key under the profile, byte for byte', () => {
    seedLegacy()
    expect(migrateKeysInto(ID)).toBe(Object.keys(legacy).length)

    for (const [key, value] of Object.entries(legacy)) {
      const moved = key.replace('speakup.', `speakup.${ID}.`)
      expect(localStorage.getItem(moved)).toBe(value)
      expect(localStorage.getItem(key)).toBeNull()
    }
  })

  it('leaves the device\'s own keys where they are', () => {
    const device = {
      [ACTIVE_PROFILE_KEY]: ID,
      [PROFILES_KEY]: JSON.stringify([{ id: ID }]),
      'speakup.auth': '{"access_token":"x"}',
      'speakup.parent': '1724880000000',
      'speakup.outbox': '[]',
      // Not ours at all.
      'other-app.stars': 'not ours',
    }
    for (const [k, v] of Object.entries(device)) localStorage.setItem(k, v)

    expect(migrateKeysInto(ID)).toBe(0)
    for (const [k, v] of Object.entries(device)) expect(localStorage.getItem(k)).toBe(v)
    expect(localStorage.getItem(`speakup.${ID}.auth`)).toBeNull()
  })

  it('is idempotent — the second run has nothing left to do', () => {
    seedLegacy()
    migrateKeysInto(ID)
    const after = snapshot()

    expect(migrateKeysInto(ID)).toBe(0)
    expect(migrateKeysInto(ID)).toBe(0)
    expect(snapshot()).toEqual(after)
  })

  it('never touches another child\'s namespace', () => {
    localStorage.setItem(`speakup.${OTHER}.stars`, JSON.stringify({ 'sword:dog': 3 }))
    localStorage.setItem('speakup.stars', JSON.stringify({ 'sword:cat': 1 }))

    expect(migrateKeysInto(ID)).toBe(1)
    expect(localStorage.getItem(`speakup.${OTHER}.stars`)).toBe(JSON.stringify({ 'sword:dog': 3 }))
    expect(localStorage.getItem(`speakup.${ID}.stars`)).toBe(JSON.stringify({ 'sword:cat': 1 }))
  })

  it('keeps the namespaced value when a stale legacy key turns up later', () => {
    // An old cached bundle, served once more by the service worker after the migration, writing
    // yesterday's stars to the old key. The namespaced value is the one the app has been using.
    localStorage.setItem(`speakup.${ID}.stars`, JSON.stringify({ 'sword:cat': 3 }))
    localStorage.setItem('speakup.stars', JSON.stringify({ 'sword:cat': 1 }))

    expect(migrateKeysInto(ID)).toBe(0)
    expect(localStorage.getItem(`speakup.${ID}.stars`)).toBe(JSON.stringify({ 'sword:cat': 3 }))
    expect(localStorage.getItem('speakup.stars')).toBe(JSON.stringify({ 'sword:cat': 1 }))
  })

  it('finishes a run that was interrupted between the copy and the delete', () => {
    const value = JSON.stringify({ 'sword:cat': 3 })
    localStorage.setItem('speakup.stars', value)
    localStorage.setItem(`speakup.${ID}.stars`, value)

    expect(migrateKeysInto(ID)).toBe(1)
    expect(localStorage.getItem(`speakup.${ID}.stars`)).toBe(value)
    expect(localStorage.getItem('speakup.stars')).toBeNull()
  })

  it('leaves the legacy key in place when the store refuses the write', () => {
    seedLegacy()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    expect(migrateKeysInto(ID)).toBe(0)
    setItem.mockRestore()

    // A store that will not take the copy — full, or read-only in private browsing — must never be
    // a reason to delete a child's progress: nothing is ever removed before its copy has been read
    // back, so every value is exactly where it was and the next launch tries again.
    for (const [key, value] of Object.entries(legacy)) expect(localStorage.getItem(key)).toBe(value)
  })

  it('brings a key home on the retry even after the app wrote a fresh default over the hole', () => {
    // The exact sequence that used to strand a child's stars for good:
    //   1. the store is full for one key, so the copy fails and the legacy value stays behind;
    //   2. the app runs the session anyway, reads an empty namespace and writes a default into it;
    //   3. the next launch sees a namespaced value that DIFFERS from the legacy one — which is
    //      also what a stale old bundle looks like — and would protect the default for ever.
    const earned = JSON.stringify({ 'sword:cat': 3, 'pair:pair-ship-sheep': 2 })
    localStorage.setItem('speakup.stars', earned)
    localStorage.setItem('speakup.band', JSON.stringify({ value: 4, mode: 'manual' }))

    const real = Storage.prototype.setItem
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === `speakup.${ID}.stars`) throw new DOMException('quota', 'QuotaExceededError')
      real.call(this, k, v)
    })
    expect(migrateKeysInto(ID)).toBe(1) // the band made it; the stars did not
    setItem.mockRestore()

    expect(localStorage.getItem('speakup.stars')).toBe(earned)
    expect(JSON.parse(localStorage.getItem('speakup.migrate.pending') ?? '[]')).toEqual(['speakup.stars'])

    // The session carries on and the app writes its default over the empty namespace.
    localStorage.setItem(`speakup.${ID}.stars`, '{}')

    expect(migrateKeysInto(ID)).toBe(1)
    expect(localStorage.getItem(`speakup.${ID}.stars`)).toBe(earned)
    expect(localStorage.getItem('speakup.stars')).toBeNull()
    // And the note is torn up, so the key is an ordinary one again.
    expect(localStorage.getItem('speakup.migrate.pending')).toBeNull()
  })

  it('keeps its own bookkeeping out of the children\'s namespaces', () => {
    localStorage.setItem('speakup.migrate.pending', JSON.stringify(['speakup.stars']))
    localStorage.setItem('speakup.stars', 'x')

    migrateKeysInto(ID)
    expect(localStorage.getItem(`speakup.${ID}.migrate.pending`)).toBeNull()
  })

  it('does nothing for an id that is not a profile id', () => {
    seedLegacy()
    expect(migrateKeysInto('first-child')).toBe(0)
    expect(localStorage.getItem('speakup.stars')).toBe(legacy['speakup.stars'])
  })

  it('reports nothing moved when storage cannot even be listed', () => {
    const key = vi.spyOn(Storage.prototype, 'key').mockImplementation(() => { throw new Error('nope') })
    expect(migrateKeysInto(ID)).toBe(0)
    key.mockRestore()
  })
})
