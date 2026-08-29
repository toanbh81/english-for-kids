import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getStars, setStars, totalStars } from '../progress/store'
import { getActivity, logActivity } from '../progress/activity'
import { getLimitMinutes, setLimitMinutes } from '../progress/limit'
import { getLessonLength, lessonForDay, saveLesson, setLessonLength } from '../progress/lessonStore'
import { activeProfileId, storageKey } from '../progress/storageKeys'

const cloud = vi.hoisted(() => ({ client: null as unknown }))
const auth = vi.hoisted(() => ({
  startAnonymousSession: vi.fn(async () => undefined),
  currentUserId: vi.fn(async (): Promise<string | null> => null),
  ensureRecoveryCode: vi.fn(async (): Promise<string | null> => null),
}))

vi.mock('./supabase', () => ({
  getSupabase: async () => cloud.client,
  isCloudConfigured: () => cloud.client !== null,
  resetSupabaseClient: () => undefined,
}))
vi.mock('./auth', () => auth)

import {
  DEFAULT_PROFILE_AVATAR,
  DEFAULT_PROFILE_NAME,
  addProfile,
  adoptProfiles,
  bootstrapProfiles,
  connectCloud,
  dropProfile,
  ensureLocalProfile,
  ensureRemoteProfiles,
  fetchRemoteProfiles,
  listProfiles,
  activeProfile,
  renameProfile,
  renameRemoteProfile,
  switchProfile,
} from './profileState'

type Reply = { data: unknown; error: { message: string } | null }
type Query = { table: string; verb: string; payload?: unknown; options?: unknown }

/**
 * Only the calls profileState makes: a profiles upsert, and selects. `select` is a function of the
 * ids asked for, because the ownership read-back — the one that tells "wrote the row" apart from
 * "the row belongs to an account this device has left" — is answered by RLS returning fewer rows.
 */
function makeClient(
  select: Reply | ((ids: unknown) => Reply) = { data: [], error: null },
  upsert: Reply = { data: null, error: null },
) {
  const queries: Query[] = []
  const from = vi.fn((table: string) => {
    const entry: Query = { table, verb: 'select' }
    const run = async (): Promise<Reply> => {
      queries.push({ ...entry })
      if (entry.verb !== 'select') return upsert
      return typeof select === 'function' ? select(entry.payload) : select
    }
    const chain = {
      select: () => chain,
      eq: (_column: string, value: unknown) => { entry.options = value; return chain },
      in: (_column: string, ids: unknown) => { entry.payload = ids; return chain },
      upsert: (payload: unknown, options?: unknown) => { entry.verb = 'upsert'; entry.payload = payload; entry.options = options; return chain },
      update: (payload: unknown) => { entry.verb = 'update'; entry.payload = payload; return chain },
      then: (onOk: (r: Reply) => unknown, onErr?: (e: unknown) => unknown) => run().then(onOk, onErr),
    }
    return chain
  })
  return { from, queries }
}

/** RLS, as far as these tests care: you get back exactly the rows you own. */
const ownedRows = (owned: string[]) => (ids: unknown): Reply => ({
  data: (Array.isArray(ids) ? ids : []).filter(id => owned.includes(String(id))).map(id => ({ id })),
  error: null,
})

/** A device that has been in use since before Phase 11: real progress, on the legacy keys. */
const seedLegacyProgress = () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sword:cat': 3, 'pair:pair-ship-sheep': 2 }))
  localStorage.setItem('speakup.activity', JSON.stringify([{ ts: 1000, kind: 'word', id: 'cat', score: 91 }]))
  localStorage.setItem('speakup.limit.minutes', '30')
  localStorage.setItem('speakup.lesson.length', 'long')
  localStorage.setItem('speakup.lesson.2026-08-28', JSON.stringify({
    v: 1, day: '2026-08-28', created: 900, band: 4, items: [],
  }))
}

beforeEach(() => {
  localStorage.clear()
  cloud.client = null
  vi.clearAllMocks()
  auth.currentUserId.mockResolvedValue(null)
  auth.ensureRecoveryCode.mockResolvedValue(null)
})
afterEach(() => vi.restoreAllMocks())

describe('the first launch after the update', () => {
  it('gives the child a profile and carries every value they had into it', () => {
    seedLegacyProgress()

    const profile = ensureLocalProfile()!

    expect(profile.name).toBe(DEFAULT_PROFILE_NAME)
    expect(profile.avatar).toBe(DEFAULT_PROFILE_AVATAR)
    expect(activeProfileId()).toBe(profile.id)
    expect(storageKey('stars')).toBe(`speakup.${profile.id}.stars`)

    // The proof that the seam is in the right place: the modules were not told about any of this
    // and still read exactly what the child earned yesterday.
    expect(getStars('sword:cat')).toBe(3)
    expect(totalStars()).toBe(5)
    expect(getActivity()).toEqual([{ ts: 1000, kind: 'word', id: 'cat', score: 91 }])
    expect(getLimitMinutes()).toBe(30)
    expect(getLessonLength()).toBe('long')
    expect(lessonForDay('2026-08-28')?.band).toBe(4)

    expect(localStorage.getItem('speakup.stars')).toBeNull()
  })

  it('is the same profile on every launch after that, and writes keep landing in it', () => {
    seedLegacyProgress()
    const first = bootstrapProfiles()!

    setStars('sword:dog', 2)
    logActivity({ ts: 2000, kind: 'speak', id: 'hello', score: 88 })
    setLimitMinutes(45)

    const second = bootstrapProfiles()!
    expect(second.id).toBe(first.id)
    expect(listProfiles()).toHaveLength(1)
    expect(getStars('sword:cat')).toBe(3)
    expect(getStars('sword:dog')).toBe(2)
    expect(getActivity()).toHaveLength(2)
    expect(getLimitMinutes()).toBe(45)
    expect(localStorage.getItem(`speakup.${first.id}.limit.minutes`)).toBe('45')
  })

  it('mints ONE child when two documents boot the update at the same moment', () => {
    seedLegacyProgress()

    // The second tab a parent left open, booting the same update. Its roster write is simulated by
    // interleaving one at the instant this document reads the roster back after its own write —
    // which is the only window there is, localStorage being synchronous within a document.
    const other = { id: '11111111-2222-4333-8444-555555555555', name: 'Bơ', avatar: '🐨', created: 1 }
    const realGet = Storage.prototype.getItem
    let interleaved = false
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      const value = realGet.call(this, key)
      if (key === 'speakup.profiles' && !interleaved && value !== null) {
        interleaved = true
        localStorage.setItem('speakup.profiles', JSON.stringify([other]))
        return JSON.stringify([other])
      }
      return value
    })

    const profile = ensureLocalProfile()!
    getItem.mockRestore()

    // Both documents settle on the same child, so the progress is migrated once, into a namespace
    // the roster actually points at — instead of one namespace per tab and a half-migrated orphan.
    expect(profile.id).toBe(other.id)
    expect(listProfiles()).toEqual([other])
    expect(activeProfileId()).toBe(other.id)
    expect(getStars('sword:cat')).toBe(3)
  })

  it('rescues the child when the other document\'s roster write lands first', () => {
    // The window `mergeIntoRoster` cannot close: both documents read the empty roster BEFORE either
    // writes, so neither union sees the other and the second write replaces the first. Document A
    // gets all the way through — roster, active profile, migration — and then B's write, computed
    // from the empty roster it read a moment earlier, lands on top.
    seedLegacyProgress()
    const a = ensureLocalProfile()!
    setStars('sword:dog', 2)
    expect(getStars('sword:cat')).toBe(3)

    const b = { id: '11111111-2222-4333-8444-555555555555', name: 'Bơ', avatar: '🐨', created: 2 }
    localStorage.setItem('speakup.profiles', JSON.stringify([b]))
    localStorage.removeItem('speakup.profile')

    // This is the end state the review reproduced: the active child has NULL stars, and everything
    // the child earned is under an id the roster has never heard of.
    expect(localStorage.getItem(`speakup.${b.id}.stars`)).toBeNull()
    expect(localStorage.getItem(`speakup.${a.id}.stars`)).not.toBeNull()

    // B's boot continues. One key scan later, nothing has been lost.
    const settled = ensureLocalProfile()!

    expect(settled.id).toBe(b.id)
    expect(activeProfileId()).toBe(b.id)
    expect(getStars('sword:cat')).toBe(3)
    expect(getStars('sword:dog')).toBe(2)
    expect(getActivity()).toEqual([{ ts: 1000, kind: 'word', id: 'cat', score: 91 }])
    expect(getLimitMinutes()).toBe(30)
    expect(getLessonLength()).toBe('long')
    expect(lessonForDay('2026-08-28')?.band).toBe(4)
    expect(localStorage.getItem(`speakup.${a.id}.stars`)).toBeNull()

    // And a second launch has nothing left to do.
    expect(ensureLocalProfile()!.id).toBe(b.id)
    expect(getStars('sword:cat')).toBe(3)
  })

  it('leaves the app on the legacy keys when storage refuses to remember the profile', () => {
    seedLegacyProgress()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    const profile = ensureLocalProfile()!
    setItem.mockRestore()

    // Nothing was moved, because nothing could be pointed at: the child keeps reading the same
    // keys they always did rather than opening an empty namespace.
    expect(profile.id).toBeTruthy()
    expect(activeProfileId()).toBeNull()
    expect(storageKey('stars')).toBe('speakup.stars')
    expect(getStars('sword:cat')).toBe(3)
    expect(localStorage.getItem('speakup.stars')).not.toBeNull()
  })
})

describe('two children, one iPad', () => {
  // `{ reload: false }` throughout: the real switch reloads the document, which is the point of it
  // (see switchProfile) and which jsdom has no navigation to perform.
  it('keeps their progress apart', () => {
    seedLegacyProgress()
    const first = ensureLocalProfile()!
    expect(getStars('sword:cat')).toBe(3)

    const second = addProfile('Bơ', '🐨')!
    expect(listProfiles().map(p => p.name)).toEqual([DEFAULT_PROFILE_NAME, 'Bơ'])

    expect(switchProfile(second.id, { reload: false })).toBe(true)
    expect(activeProfile()?.name).toBe('Bơ')
    // A new child starts new: none of the first child's stars, and none of their minutes either.
    expect(getStars('sword:cat')).toBe(0)
    expect(totalStars()).toBe(0)
    expect(getActivity()).toEqual([])

    setStars('sword:dog', 3)
    saveLesson({ day: '2026-08-29', created: 1, band: 2, items: [] })
    setLessonLength('short')

    expect(switchProfile(first.id, { reload: false })).toBe(true)
    expect(getStars('sword:cat')).toBe(3)
    expect(getStars('sword:dog')).toBe(0)
    expect(getLessonLength()).toBe('long')
    expect(lessonForDay('2026-08-29')).toBeNull()

    expect(switchProfile(second.id, { reload: false })).toBe(true)
    expect(getStars('sword:dog')).toBe(3)
    expect(lessonForDay('2026-08-29')?.band).toBe(2)
  })

  it('refuses to switch to a child who does not live here', () => {
    const first = ensureLocalProfile()!
    expect(switchProfile('11111111-2222-4333-8444-555555555555', { reload: false })).toBe(false)
    expect(switchProfile('not-an-id', { reload: false })).toBe(false)
    expect(activeProfileId()).toBe(first.id)
  })

  it('repairs a half-written roster instead of losing the child behind it', () => {
    const id = '11111111-2222-4333-8444-555555555555'
    localStorage.setItem('speakup.profiles', JSON.stringify([
      { id },                        // an entry with nothing but the pointer to its namespace
      { name: 'no id' },             // nothing to point at: dropped
      'rubbish',
    ]))
    localStorage.setItem(`speakup.${id}.stars`, JSON.stringify({ 'sword:cat': 3 }))

    const profiles = listProfiles()
    expect(profiles).toEqual([{ id, name: DEFAULT_PROFILE_NAME, avatar: DEFAULT_PROFILE_AVATAR, created: 0 }])
    expect(ensureLocalProfile()!.id).toBe(id)
    expect(getStars('sword:cat')).toBe(3)
  })

  it('still mints a child when there is genuinely no roster on disk', () => {
    // The ordinary first launch, and the case the damaged one below must not be confused with.
    expect(listProfiles()).toEqual([])
    expect(activeProfile()).toBeNull()

    const minted = ensureLocalProfile()!

    expect(minted.id).toBeTruthy()
    expect(listProfiles().map(p => p.id)).toEqual([minted.id])
    expect(activeProfileId()).toBe(minted.id)
  })

  /**
   * The roster is the one stored value that had no "damaged" reading, and it is the one where the
   * cost is highest. A `speakup.profiles` value that iOS killed halfway through a `setItem` parsed
   * as nothing, read as "no children yet", and then `ensureLocalProfile` minted a fresh child over
   * it and ran `rescueOrphanNamespaces` with a roster of one - which folds EVERY other namespace on
   * the iPad into the newcomer and deletes the originals. Two children become one, `leitner` has no
   * merge rule so the second child's whole schedule is the loser, and none of it is recoverable.
   */
  describe('a roster that is on disk and unreadable', () => {
    const A = '11111111-2222-4333-8444-555555555555'
    const B = '22222222-3333-4444-8555-666666666666'

    function twoChildrenThenTruncateTheRoster() {
      const roster = JSON.stringify([
        { id: A, name: 'Soc', avatar: 'S', created: 1 },
        { id: B, name: 'Cao', avatar: 'C', created: 2 },
      ])
      localStorage.setItem(`speakup.${A}.stars`, JSON.stringify({ 'sword:cat': 3 }))
      localStorage.setItem(`speakup.${A}.leitner`, JSON.stringify({ 'w-a': { box: 3, due: 10 } }))
      localStorage.setItem(`speakup.${B}.stars`, JSON.stringify({ 'sword:dog': 2 }))
      localStorage.setItem(`speakup.${B}.leitner`, JSON.stringify({ 'w-b': { box: 5, due: 20 } }))
      localStorage.setItem('speakup.profile', A)
      // What a killed `setItem` leaves: the same value, short of its tail.
      localStorage.setItem('speakup.profiles', roster.slice(0, -12))
    }

    it('changes nothing at all rather than minting over it', () => {
      twoChildrenThenTruncateTheRoster()
      const damagedBytes = localStorage.getItem('speakup.profiles')

      const profile = ensureLocalProfile()

      // The child the device was already reading is still the child it reads.
      expect(profile?.id).toBe(A)
      expect(activeProfileId()).toBe(A)
      // No mint: the damaged bytes are still there, byte for byte, for whoever can recover them.
      expect(localStorage.getItem('speakup.profiles')).toBe(damagedBytes)
    })

    it('never folds the children into one another', () => {
      twoChildrenThenTruncateTheRoster()

      ensureLocalProfile()

      // Both namespaces survive, unmerged and undeleted. `leitner` is the one that proves it: it
      // has no merge rule, so a rescue would have taken B's schedule outright.
      expect(JSON.parse(localStorage.getItem(`speakup.${A}.stars`)!)).toEqual({ 'sword:cat': 3 })
      expect(JSON.parse(localStorage.getItem(`speakup.${B}.stars`)!)).toEqual({ 'sword:dog': 2 })
      expect(JSON.parse(localStorage.getItem(`speakup.${A}.leitner`)!)).toEqual({ 'w-a': { box: 3, due: 10 } })
      expect(JSON.parse(localStorage.getItem(`speakup.${B}.leitner`)!)).toEqual({ 'w-b': { box: 5, due: 20 } })
    })

    it('does not point the device at a child it cannot see, with nothing active', () => {
      twoChildrenThenTruncateTheRoster()
      localStorage.removeItem('speakup.profile')
      const damagedBytes = localStorage.getItem('speakup.profiles')

      // Nothing to return and nothing safe to do: the launch says so instead of inventing a child.
      expect(ensureLocalProfile()).toBeNull()
      expect(activeProfileId()).toBeNull()
      expect(localStorage.getItem('speakup.profiles')).toBe(damagedBytes)
      expect(JSON.parse(localStorage.getItem(`speakup.${B}.leitner`)!)).toEqual({ 'w-b': { box: 5, due: 20 } })
    })

    it('adds nobody to a roster it cannot read', () => {
      twoChildrenThenTruncateTheRoster()
      const damagedBytes = localStorage.getItem('speakup.profiles')

      dropProfile(A)

      expect(localStorage.getItem('speakup.profiles')).toBe(damagedBytes)
    })

    /**
     * The guard has to sit at EVERY door onto the roster, not at the two that were noticed first.
     * `mergeIntoRoster` is the third and fourth: "+ Thêm hồ sơ" and the restore path both write
     * through it, and it read the roster with `listProfiles()`, which throws the `damaged` flag
     * away. A union computed from "no children" then went straight over the half-written bytes —
     * and the next launch, finding a roster of one, folded every other namespace into it.
     */
    it('does not save a new child over a roster it cannot read', () => {
      twoChildrenThenTruncateTheRoster()
      const damagedBytes = localStorage.getItem('speakup.profiles')

      // The parent taps "+ Thêm hồ sơ" — which is exactly what a blank profile name invites.
      expect(addProfile('Bo')).toBeNull()

      expect(localStorage.getItem('speakup.profiles')).toBe(damagedBytes)
      expect(JSON.parse(localStorage.getItem(`speakup.${A}.stars`)!)).toEqual({ 'sword:cat': 3 })
      expect(JSON.parse(localStorage.getItem(`speakup.${B}.stars`)!)).toEqual({ 'sword:dog': 2 })
      expect(JSON.parse(localStorage.getItem(`speakup.${A}.leitner`)!)).toEqual({ 'w-a': { box: 3, due: 10 } })
      expect(JSON.parse(localStorage.getItem(`speakup.${B}.leitner`)!)).toEqual({ 'w-b': { box: 5, due: 20 } })
    })

    it('does not adopt a restored child over a roster it cannot read', () => {
      twoChildrenThenTruncateTheRoster()
      const damagedBytes = localStorage.getItem('speakup.profiles')
      const remote = [{ id: '33333333-4444-4555-8666-777777777777', name: 'Cun', avatar: 'C', created: 3 }]

      // `null`, not an empty roster: the caller has to say it could not join them rather than
      // report an account with no children (see CloudStart).
      expect(adoptProfiles(remote)).toBeNull()

      expect(localStorage.getItem('speakup.profiles')).toBe(damagedBytes)
      expect(JSON.parse(localStorage.getItem(`speakup.${A}.leitner`)!)).toEqual({ 'w-a': { box: 3, due: 10 } })
      expect(JSON.parse(localStorage.getItem(`speakup.${B}.leitner`)!)).toEqual({ 'w-b': { box: 5, due: 20 } })
    })

    it('renames nobody in a roster it cannot read', () => {
      twoChildrenThenTruncateTheRoster()
      const damagedBytes = localStorage.getItem('speakup.profiles')

      expect(renameProfile(A, 'Ten moi')).toEqual([])

      expect(localStorage.getItem('speakup.profiles')).toBe(damagedBytes)
    })
  })
})

describe('the server side', () => {
  it('does nothing at all without a cloud', async () => {
    seedLegacyProgress()
    const profile = bootstrapProfiles()!
    await connectCloud()

    expect(auth.startAnonymousSession).not.toHaveBeenCalled()
    expect(auth.ensureRecoveryCode).not.toHaveBeenCalled()
    expect(await ensureRemoteProfiles()).toEqual([])
    expect(await fetchRemoteProfiles()).toEqual([])
    // …and the local half happened anyway, which is the whole local-first promise.
    expect(activeProfileId()).toBe(profile.id)
    expect(getStars('sword:cat')).toBe(3)
  })

  it('signs in silently, then makes sure the children and the recovery code exist', async () => {
    const profile = ensureLocalProfile()!
    const client = makeClient(ownedRows([profile.id]))
    cloud.client = client
    auth.currentUserId.mockResolvedValue('anon-1')

    await connectCloud()

    expect(auth.startAnonymousSession).toHaveBeenCalledTimes(1)
    expect(auth.ensureRecoveryCode).toHaveBeenCalledTimes(1)

    const upsert = client.queries.find(q => q.verb === 'upsert')
    expect(upsert?.table).toBe('profiles')
    // The id the device chose IS the server row's id — that is what makes the localStorage
    // namespace permanent and the sync outbox able to name a profile before it exists.
    expect(upsert?.payload).toEqual([{ id: profile.id, owner_id: 'anon-1', name: DEFAULT_PROFILE_NAME, avatar: DEFAULT_PROFILE_AVATAR }])
    // An existing row is already right; re-sending the local name would undo a rename made on
    // another device.
    expect(upsert?.options).toEqual({ onConflict: 'id', ignoreDuplicates: true })
  })

  it('finishes the whole connection when the network comes back, not just the sign-in', async () => {
    // The device booted offline: signed in nowhere, so no profile row and no recovery code either.
    const profile = ensureLocalProfile()!
    const client = makeClient(ownedRows([profile.id]))
    cloud.client = client
    let onlineAgain: (() => void) | undefined
    auth.startAnonymousSession.mockImplementation(async (options: { retry?: () => void } = {}) => {
      onlineAgain = options.retry
    })

    await connectCloud()
    expect(client.queries).toHaveLength(0)
    expect(auth.ensureRecoveryCode).not.toHaveBeenCalled()

    // An hour later, on the school Wi-Fi.
    auth.startAnonymousSession.mockImplementation(async () => undefined)
    auth.currentUserId.mockResolvedValue('anon-1')
    expect(onlineAgain).toBeTypeOf('function')
    onlineAgain?.()

    await vi.waitFor(() => {
      expect(client.queries.some(q => q.verb === 'upsert')).toBe(true)
      expect(auth.ensureRecoveryCode).toHaveBeenCalledTimes(1)
    })
  })

  it('does not report success for rows that belong to an account this device has left', async () => {
    // A recovery re-parented this device onto a new user: the profile row still exists, so an
    // `on conflict do nothing` writes nothing and errors not at all — and the row is not ours.
    const profile = ensureLocalProfile()!
    cloud.client = makeClient(ownedRows([]))
    auth.currentUserId.mockResolvedValue('anon-2')

    expect(await ensureRemoteProfiles()).toEqual([])

    cloud.client = makeClient(ownedRows([profile.id]))
    expect(await ensureRemoteProfiles()).toEqual([profile.id])
  })

  it('does not touch the server while nobody is signed in', async () => {
    cloud.client = makeClient()
    auth.currentUserId.mockResolvedValue(null)
    ensureLocalProfile()

    await connectCloud()

    expect(auth.startAnonymousSession).toHaveBeenCalledTimes(1)
    expect(auth.ensureRecoveryCode).not.toHaveBeenCalled()
    expect(await ensureRemoteProfiles()).toEqual([])
  })

  it('swallows a refusal from the server rather than surfacing it', async () => {
    cloud.client = makeClient({ data: null, error: { message: 'permission denied' } }, { data: null, error: { message: 'permission denied' } })
    auth.currentUserId.mockResolvedValue('anon-1')
    ensureLocalProfile()

    expect(await ensureRemoteProfiles()).toEqual([])
    // `null`, not `[]`: a refusal is "could not find out", and Task 4's `/start` may only abandon
    // an anonymous account on an answer, never on a failure that looks like an empty one.
    expect(await fetchRemoteProfiles()).toBeNull()
    await expect(connectCloud()).resolves.toBeUndefined()
  })

  it('tells an empty account apart from a read that failed', async () => {
    cloud.client = makeClient({ data: [], error: null })
    auth.currentUserId.mockResolvedValue('anon-1')
    ensureLocalProfile()

    // The account genuinely owns nothing: that is an answer, and it is `[]`.
    expect(await fetchRemoteProfiles()).toEqual([])

    cloud.client = makeClient({ data: null, error: { message: 'timeout' } })
    expect(await fetchRemoteProfiles()).toBeNull()

    // A thrown client is the same news as a refusal.
    cloud.client = makeClient({ data: [], error: null })
    ;(cloud.client as { from: unknown }).from = () => { throw new Error('network') }
    expect(await fetchRemoteProfiles()).toBeNull()
  })

  it('brings the account\'s other children onto this device, keeping the ones already here', async () => {
    const remoteId = '11111111-2222-4333-8444-555555555555'
    cloud.client = makeClient({
      data: [
        { id: remoteId, name: 'Bơ', avatar: '🐨', created_at: '2026-08-01T00:00:00Z' },
        { id: 'not-a-uuid', name: 'nonsense', avatar: '👻', created_at: 'never' },
      ],
      error: null,
    })
    auth.currentUserId.mockResolvedValue('anon-1')
    const local = ensureLocalProfile()!

    const remote = await fetchRemoteProfiles()
    expect(remote).toEqual([{ id: remoteId, name: 'Bơ', avatar: '🐨', created: Date.parse('2026-08-01T00:00:00Z') }])

    const merged = adoptProfiles(remote!)!
    expect(merged.map(p => p.id)).toEqual([local.id, remoteId])
    // Adopting twice must not clone anybody.
    expect(adoptProfiles(remote!)!.map(p => p.id)).toEqual([local.id, remoteId])
    expect(listProfiles()).toHaveLength(2)
  })

  it('renames on the server with UPDATE, never an upsert that could conflict', async () => {
    const profile = ensureLocalProfile()!
    const client = makeClient({ data: [], error: null }, { data: null, error: null })
    cloud.client = client
    auth.currentUserId.mockResolvedValue('anon-1')

    expect(await renameRemoteProfile(profile.id, ' Sóc con ')).toBe(true)

    const update = client.queries.find(q => q.verb === 'update')
    expect(update?.table).toBe('profiles')
    expect(update?.payload).toEqual({ name: 'Sóc con' })
    // The id is carried by `.eq`, never by the update body — an UPDATE that matches nothing this
    // account owns (RLS) simply changes nothing and reports nothing, which is the only answer a
    // stranger's id should get.
    expect(update?.options).toBe(profile.id)
    expect(client.queries.some(q => q.verb === 'upsert')).toBe(false)
  })

  it('does not rename on the server with no cloud, no session, or a blank name', async () => {
    const profile = ensureLocalProfile()!
    expect(await renameRemoteProfile(profile.id, 'Sóc')).toBe(false)

    cloud.client = makeClient()
    auth.currentUserId.mockResolvedValue(null)
    expect(await renameRemoteProfile(profile.id, 'Sóc')).toBe(false)

    auth.currentUserId.mockResolvedValue('anon-1')
    expect(await renameRemoteProfile(profile.id, '   ')).toBe(false)
  })
})

describe('renaming a profile locally', () => {
  it('trims the name and leaves every other profile untouched', () => {
    const first = addProfile('Bé')!
    const second = addProfile('Bơ')!

    const roster = renameProfile(second.id, ' Sóc con  ')

    expect(roster.find(p => p.id === second.id)?.name).toBe('Sóc con')
    expect(roster.find(p => p.id === first.id)?.name).toBe('Bé')
  })

  it('does nothing for an id this device does not know, or a blank name', () => {
    const profile = addProfile('Bé')!
    expect(renameProfile('11111111-2222-4333-8444-555555555555', 'Ai đó')).toEqual(listProfiles())
    expect(renameProfile(profile.id, '   ')).toEqual(listProfiles())
    expect(listProfiles().find(p => p.id === profile.id)?.name).toBe('Bé')
  })
})
