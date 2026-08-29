import { describe, it, expect, beforeEach, vi } from 'vitest'
import { hasAnyHistory, profileHistory, sumHistory } from './history'

const A = '11111111-2222-4333-8444-555555555555'
const B = '22222222-3333-4444-8555-666666666666'

beforeEach(() => {
  localStorage.clear()
})

describe('profileHistory', () => {
  it('reads a namespace that is not the active one', () => {
    localStorage.setItem('speakup.profile', A)
    localStorage.setItem(`speakup.${B}.stars`, JSON.stringify({ 'sword:cat': 3, 'sword:dog': 2 }))
    localStorage.setItem(`speakup.${B}.activity`, JSON.stringify([{ ts: 1, kind: 'word', id: 'w' }]))

    // The whole point: every other reader resolves through `storageKey()` and would answer for A.
    expect(profileHistory(B)).toEqual({ stars: 5, events: 1, damaged: false })
    expect(profileHistory(A)).toEqual({ stars: 0, events: 0, damaged: false })
  })

  it('reads the legacy un-namespaced keys for a device with no profile', () => {
    localStorage.setItem('speakup.stars', JSON.stringify({ 'sword:cat': 1 }))

    expect(profileHistory(null)).toEqual({ stars: 1, events: 0, damaged: false })
  })

  /**
   * Zero and unreadable are not the same child.
   *
   * Every caller of this module is deciding something one-way — whether the restore door may
   * appear, whether an account may be abandoned, whether the roster entry a restore replaced may be
   * dropped. A value that is on disk and will not parse (the mid-`setItem` damage this codebase
   * models everywhere else) says nothing about how many stars are behind it, so it must never be
   * counted as none.
   */
  it('says a corrupt value is UNKNOWN rather than counting it as nothing', () => {
    localStorage.setItem(`speakup.${A}.stars`, '{not json')
    localStorage.setItem(`speakup.${A}.activity`, '{"shape":"wrong"}')

    expect(() => profileHistory(A)).not.toThrow()
    expect(profileHistory(A)).toEqual({ stars: 0, events: 0, damaged: true })
    // …and every caller's question therefore answers on the cautious side.
    expect(hasAnyHistory(profileHistory(A))).toBe(true)
  })

  it('is not damaged by a value that is simply absent', () => {
    expect(profileHistory(A)).toEqual({ stars: 0, events: 0, damaged: false })
    expect(hasAnyHistory(profileHistory(A))).toBe(false)
  })

  it('reports storage that refuses to answer as unknown too', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('nope') })

    expect(profileHistory(A).damaged).toBe(true)
    expect(hasAnyHistory(profileHistory(A))).toBe(true)

    getItem.mockRestore()
  })

  it('ignores non-numeric star values instead of producing NaN', () => {
    localStorage.setItem(`speakup.${A}.stars`, JSON.stringify({ 'sword:cat': 3, 'sword:bad': 'three' }))

    expect(profileHistory(A).stars).toBe(3)
  })
})

describe('sumHistory', () => {
  it('adds up every child on the device — the question an account has to ask', () => {
    localStorage.setItem(`speakup.${A}.stars`, JSON.stringify({ 'sword:cat': 3 }))
    localStorage.setItem(`speakup.${B}.activity`, JSON.stringify([{ ts: 1 }, { ts: 2 }]))

    expect(sumHistory([A, B])).toEqual({ stars: 3, events: 2, damaged: false })
    expect(hasAnyHistory(sumHistory([A, B]))).toBe(true)
  })

  it('is empty for an empty roster and for children who have done nothing', () => {
    expect(sumHistory([])).toEqual({ stars: 0, events: 0, damaged: false })
    expect(hasAnyHistory(sumHistory([A, B]))).toBe(false)
  })

  it('carries an unknown from one child across the whole sum', () => {
    localStorage.setItem(`speakup.${A}.stars`, JSON.stringify({ 'sword:cat': 3 }))
    localStorage.setItem(`speakup.${B}.stars`, '{half-writ')

    // The readable child's stars still count, and the account as a whole is no longer knowable —
    // which is the answer that keeps the caller from doing anything irreversible.
    expect(sumHistory([A, B])).toEqual({ stars: 3, events: 0, damaged: true })
  })
})
