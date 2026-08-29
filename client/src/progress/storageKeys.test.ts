import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ACTIVE_PROFILE_KEY,
  PROFILES_KEY,
  activeProfileId,
  eventIdentity,
  isProfileId,
  mergeStored,
  mergeStoredValue,
  migrateKeysInto,
  namespacePrefix,
  onStoreWrite,
  profileStorageKey,
  rescueOrphanNamespaces,
  setActiveProfileId,
  storageKey,
  storageName,
  subscribeStoreWrites,
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

/**
 * The net under the one race localStorage cannot close: two documents booting the same update,
 * both reading an empty roster before either writes one. The loser's id disappears from the roster
 * while its namespace — possibly holding everything the child ever earned — stays on disk,
 * addressed by nothing. What a parent saw was a child with no stars.
 */
describe('the orphan rescue', () => {
  const ORPHAN = '77777777-6666-4555-8444-333333333333'
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  const event = (ts: number, id: string, score?: number) => ({ ts, kind: 'word', id, score })

  it('brings every kind of value home under the app\'s own rules', () => {
    localStorage.setItem(`speakup.${ID}.stars`, JSON.stringify({ 'sword:cat': 3, 'sword:dog': 1 }))
    localStorage.setItem(`speakup.${ID}.activity`, JSON.stringify([event(1, 'cat', 90)]))
    localStorage.setItem(`speakup.${ID}.band`, JSON.stringify({ value: 4, mode: 'manual' }))

    localStorage.setItem(`speakup.${ORPHAN}.stars`, JSON.stringify({ 'sword:cat': 1, 'sword:dog': 3, 'sword:fox': 2 }))
    localStorage.setItem(`speakup.${ORPHAN}.activity`, JSON.stringify([event(1, 'cat', 90), event(2, 'dog', 70)]))
    localStorage.setItem(`speakup.${ORPHAN}.band`, JSON.stringify({ value: 1, mode: 'auto' }))
    localStorage.setItem(`speakup.${ORPHAN}.lesson.2026-08-28`, 'a lesson record')

    expect(rescueOrphanNamespaces(ID, [ID])).toBe(4)

    // Stars take the maximum per card: a star the child earned is never lowered by the other side.
    expect(JSON.parse(localStorage.getItem(`speakup.${ID}.stars`) ?? '{}'))
      .toEqual({ 'sword:cat': 3, 'sword:dog': 3, 'sword:fox': 2 })
    // The event log is a union, deduped on (ts, kind, id) — the server's own primary key.
    expect(JSON.parse(localStorage.getItem(`speakup.${ID}.activity`) ?? '[]'))
      .toEqual([event(1, 'cat', 90), event(2, 'dog', 70)])
    // Everything else keeps what the active child has been using…
    expect(JSON.parse(localStorage.getItem(`speakup.${ID}.band`) ?? '{}')).toEqual({ value: 4, mode: 'manual' })
    // …and takes the orphan's where the active child has nothing at all.
    expect(localStorage.getItem(`speakup.${ID}.lesson.2026-08-28`)).toBe('a lesson record')

    // Nothing is left addressed by nobody.
    for (let i = 0; i < localStorage.length; i++) {
      expect(localStorage.key(i)?.startsWith(`speakup.${ORPHAN}.`)).toBe(false)
    }
  })

  it('never lets a lower orphan star clobber a higher one', () => {
    localStorage.setItem(`speakup.${ID}.stars`, JSON.stringify({ 'sword:cat': 3 }))
    localStorage.setItem(`speakup.${ORPHAN}.stars`, JSON.stringify({ 'sword:cat': 1 }))

    rescueOrphanNamespaces(ID, [ID])

    expect(JSON.parse(localStorage.getItem(`speakup.${ID}.stars`) ?? '{}')).toEqual({ 'sword:cat': 3 })
  })

  it('does nothing when nothing is orphaned', () => {
    localStorage.setItem(`speakup.${ID}.stars`, JSON.stringify({ 'sword:cat': 3 }))
    localStorage.setItem(`speakup.${OTHER}.stars`, JSON.stringify({ 'sword:dog': 2 }))
    const before = snapshotAll()

    expect(rescueOrphanNamespaces(ID, [ID, OTHER])).toBe(0)
    expect(rescueOrphanNamespaces(ID, [ID, OTHER])).toBe(0)
    expect(snapshotAll()).toEqual(before)
  })

  it('leaves the other children and the device alone', () => {
    // The second child on this iPad is in the roster, so their namespace is somebody's, not litter.
    localStorage.setItem(`speakup.${OTHER}.stars`, JSON.stringify({ 'sword:dog': 3 }))
    localStorage.setItem(ACTIVE_PROFILE_KEY, ID)
    localStorage.setItem(PROFILES_KEY, JSON.stringify([{ id: ID }, { id: OTHER }]))
    localStorage.setItem('speakup.auth', '{"access_token":"x"}')
    localStorage.setItem('speakup.outbox', '[]')
    localStorage.setItem('other-app.stars', 'not ours')
    localStorage.setItem(`speakup.${ORPHAN}.stars`, JSON.stringify({ 'sword:fox': 1 }))

    expect(rescueOrphanNamespaces(ID, [ID, OTHER])).toBe(1)

    expect(JSON.parse(localStorage.getItem(`speakup.${OTHER}.stars`) ?? '{}')).toEqual({ 'sword:dog': 3 })
    expect(localStorage.getItem('speakup.auth')).toBe('{"access_token":"x"}')
    expect(localStorage.getItem('speakup.outbox')).toBe('[]')
    expect(localStorage.getItem('other-app.stars')).toBe('not ours')
    expect(JSON.parse(localStorage.getItem(`speakup.${ID}.stars`) ?? '{}')).toEqual({ 'sword:fox': 1 })
  })

  it('keeps both copies when the store will not take the write', () => {
    localStorage.setItem(`speakup.${ORPHAN}.stars`, JSON.stringify({ 'sword:fox': 1 }))
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    expect(rescueOrphanNamespaces(ID, [ID])).toBe(0)
    setItem.mockRestore()

    expect(localStorage.getItem(`speakup.${ORPHAN}.stars`)).toBe(JSON.stringify({ 'sword:fox': 1 }))
  })

  it('keeps the readable copy — whichever side that is', () => {
    // Damaged bytes are not a value that wins, they are a value that cannot be read. Where the
    // ACTIVE namespace is the damaged one, the orphan is the only readable copy of the child's
    // stars and taking it is a recovery, not a regression. Where the ORPHAN is the damaged one, the
    // active value stands, exactly as before. (The pull applies the same rule for the same reason —
    // see `MergeSource.damaged` and cloud/sync.ts's F1 tests.)
    localStorage.setItem(`speakup.${ID}.stars`, '{not json')
    localStorage.setItem(`speakup.${ORPHAN}.stars`, JSON.stringify({ 'sword:fox': 1 }))
    localStorage.setItem(`speakup.${ID}.activity`, JSON.stringify([event(1, 'cat')]))
    localStorage.setItem(`speakup.${ORPHAN}.activity`, '{}')

    expect(rescueOrphanNamespaces(ID, [ID])).toBe(2)

    expect(JSON.parse(localStorage.getItem(`speakup.${ID}.stars`) ?? '{}')).toEqual({ 'sword:fox': 1 })
    expect(JSON.parse(localStorage.getItem(`speakup.${ID}.activity`) ?? '[]')).toEqual([event(1, 'cat')])
  })

  it('changes nothing when neither copy can be read', () => {
    localStorage.setItem(`speakup.${ID}.stars`, '{not json')
    localStorage.setItem(`speakup.${ORPHAN}.stars`, 'also not json')

    expect(rescueOrphanNamespaces(ID, [ID])).toBe(1)

    expect(localStorage.getItem(`speakup.${ID}.stars`)).toBe('{not json')
  })

  it('does nothing for an active id that is not a profile id', () => {
    localStorage.setItem(`speakup.${ORPHAN}.stars`, '{}')
    expect(rescueOrphanNamespaces('nobody', [])).toBe(0)
    expect(localStorage.getItem(`speakup.${ORPHAN}.stars`)).toBe('{}')
  })
})

describe('a key belonging to a child who is not the active one', () => {
  beforeEach(() => localStorage.clear())

  it('is built from the profile it names, not from whoever is using the iPad', () => {
    setActiveProfileId(ID)
    expect(profileStorageKey(OTHER, 'stars')).toBe(`speakup.${OTHER}.stars`)
    expect(profileStorageKey(ID, 'stars')).toBe(storageKey('stars'))
    // The sync outbox can hold an op for a child written before the iPad changed hands; reading it
    // out of the ACTIVE namespace would put one child's stars in the other's row.
    expect(profileStorageKey('not-an-id', 'stars')).toBe('speakup.stars')
  })
})

describe('the write seam', () => {
  beforeEach(() => localStorage.clear())

  it('is silent while nobody is subscribed — which is every build with no cloud', () => {
    // Not a formality: `onStoreWrite` is called on every star, every promotion and every lesson,
    // in an app that most often has no Supabase project behind it.
    expect(() => onStoreWrite('speakup.stars')).not.toThrow()
  })

  it('hands every subscriber the key that was written, and stops on unsubscribe', () => {
    const seen: string[] = []
    const off = subscribeStoreWrites(key => seen.push(key))
    const offToo = subscribeStoreWrites(key => seen.push(`2:${key}`))

    setActiveProfileId(ID)
    onStoreWrite(storageKey('stars'))
    off()
    onStoreWrite(storageKey('band'))
    offToo()
    onStoreWrite(storageKey('leitner'))

    expect(seen).toEqual([`speakup.${ID}.stars`, `2:speakup.${ID}.stars`, `2:speakup.${ID}.band`])
  })

  it('never lets a listener\'s failure reach the store that was writing', () => {
    const seen: string[] = []
    const off = subscribeStoreWrites(() => { throw new Error('the mirror fell over') })
    const offToo = subscribeStoreWrites(key => seen.push(key))

    expect(() => onStoreWrite('speakup.stars')).not.toThrow()
    expect(seen).toEqual(['speakup.stars']) // and the other subscriber still heard it
    off()
    offToo()
  })
})

describe('the merge contract', () => {
  const event = (ts: number, id: string) => ({ ts, kind: 'word', id })

  it('takes the higher star, never the newer one', () => {
    const merged = mergeStoredValue('stars', JSON.stringify({ a: 3, b: 1 }), JSON.stringify({ a: 1, c: 2 }), true)
    expect(JSON.parse(merged)).toEqual({ a: 3, b: 1, c: 2 })
  })

  it('unions the event log on (ts, kind, id) whichever side is preferred', () => {
    const mine = JSON.stringify([event(2, 'b')])
    const theirs = JSON.stringify([event(1, 'a'), event(2, 'b')])
    for (const prefer of [true, false]) {
      expect(JSON.parse(mergeStoredValue('activity', mine, theirs, prefer))).toEqual([event(1, 'a'), event(2, 'b')])
    }
  })

  it('lets the caller decide last-write-wins for everything else', () => {
    expect(mergeStoredValue('band', '{"value":4}', '{"value":1}', false)).toBe('{"value":4}')
    expect(mergeStoredValue('band', '{"value":4}', '{"value":1}', true)).toBe('{"value":1}')
    // Nothing local: there is nothing to weigh, and this is the restore after a wiped cache.
    expect(mergeStoredValue('band', null, '{"value":1}', false)).toBe('{"value":1}')
  })

  it('says where the value came from, which is not the same as whether it changed', () => {
    // The distinction the pull turns into "should I push this back?". `merged` and `existing` mean
    // the other side is behind; `incoming` means it is not; `damaged` means the question does not
    // apply, because the local bytes could not be read at all.
    expect(mergeStored('stars', '{"a":1}', '{"a":1}').source).toBe('incoming')
    expect(mergeStored('stars', '{"a":3}', '{"a":1}').source).toBe('merged')
    expect(mergeStored('stars', '{"a":1}', '{"a":1,"b":2}').source).toBe('incoming')
    expect(mergeStored('band', '{"v":4}', '{"v":1}', false).source).toBe('existing')
    expect(mergeStored('band', '{"v":4}', '{"v":1}', true).source).toBe('incoming')
    expect(mergeStored('band', null, '{"v":1}').source).toBe('incoming')
  })

  it('calls half-written local bytes damaged, and hands back the copy that can be read', () => {
    // The shape an iOS tab killed mid-setItem leaves behind. Reported as newer local truth it would
    // be pushed over the cloud's good copy — the last place the child's stars still existed.
    const half = '{"sword:cat":3,"sword:d'
    expect(mergeStored('stars', half, '{"sword:cat":3,"sword:dog":2}')).toEqual({
      value: '{"sword:cat":3,"sword:dog":2}', source: 'damaged',
    })
    expect(mergeStored('activity', '[{"ts":1,', '[{"ts":1,"kind":"word","id":"a"}]').source).toBe('damaged')
    // Every LWW key too — but only one the owning store says it writes as JSON. That `form` is not
    // a detail: without it, `lesson.length` ("medium") reads as unparseable on every single pull.
    expect(mergeStored('band', '{"value":4,"mo', '{"value":3,"mode":"auto"}', false, 'json')).toEqual({
      value: '{"value":3,"mode":"auto"}', source: 'damaged',
    })
    // …and a bare scalar is never damage: `limit.minutes` and `lesson.length` are stored unquoted on
    // purpose, and a truncated "20" is indistinguishable from a real one.
    expect(mergeStored('limit.minutes', '20', '30', false, 'text').source).toBe('existing')
    expect(mergeStored('lesson.length', 'medium', 'long', true, 'text').source).toBe('incoming')
    expect(mergeStored('lesson.length', 'medium', '"long"', false, 'text').source).toBe('existing')
  })

  it('calls a shape it does not recognise a stalemate, and touches neither side', () => {
    // Version skew, not corruption: a value some other build of the app wrote. The old shape test
    // could not tell the two apart and overwrote the local value with bytes the owning store cannot
    // read — a real `limit.minutes` of "45" replaced by an object `getLimitMinutes()` sees as NaN.
    // These three are the proven reversals.
    expect(mergeStored('limit.minutes', '45', '{"minutes":15}', false, 'text')).toEqual({
      value: '45', source: 'existing',
    })
    expect(mergeStored('lesson.length', 'short', '["medium"]', false, 'text')).toEqual({
      value: 'short', source: 'existing',
    })
    expect(mergeStored('band', '5', '{"value":1,"mode":"auto"}', false, 'json')).toEqual({
      value: '5', source: 'existing',
    })
    // Where a merge is attempted, an unrecognised LOCAL shape is a stalemate: readable, so not
    // damaged; not a star map, so not mergeable. Keep it, push nothing.
    expect(mergeStored('stars', '5', '{"a":1}')).toEqual({ value: '5', source: 'stalemate' })
    expect(mergeStored('activity', '{}', '[]')).toEqual({ value: '{}', source: 'stalemate' })
    // Neither side readable: nothing is claimed in either direction, and nothing is pushed.
    expect(mergeStored('stars', '{"a":1,', 'also broken')).toEqual({ value: '{"a":1,', source: 'stalemate' })
  })

  it('is the one place that says what makes two events the same event', () => {
    expect(eventIdentity(1, 'word', 'a')).toBe('1|word|a')
    // The rule the union dedupes on and the rule the sync engine asks "have I sent this?" with must
    // be the same string, or an event is new to one of them and old to the other.
    const one = JSON.stringify([event(1, 'a')])
    expect(JSON.parse(mergeStoredValue('activity', one, one))).toHaveLength(1)
  })
})

function snapshotAll(): Record<string, string> {
  const all: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key !== null) all[key] = localStorage.getItem(key) ?? ''
  }
  return all
}
