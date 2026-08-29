import { describe, it, expect, beforeEach } from 'vitest'
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
    expect(profileHistory(B)).toEqual({ stars: 5, events: 1 })
    expect(profileHistory(A)).toEqual({ stars: 0, events: 0 })
  })

  it('reads the legacy un-namespaced keys for a device with no profile', () => {
    localStorage.setItem('speakup.stars', JSON.stringify({ 'sword:cat': 1 }))

    expect(profileHistory(null)).toEqual({ stars: 1, events: 0 })
  })

  it('counts a corrupt or hand-edited value as nothing rather than throwing', () => {
    localStorage.setItem(`speakup.${A}.stars`, '{not json')
    localStorage.setItem(`speakup.${A}.activity`, '{"shape":"wrong"}')

    expect(() => profileHistory(A)).not.toThrow()
    expect(profileHistory(A)).toEqual({ stars: 0, events: 0 })
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

    expect(sumHistory([A, B])).toEqual({ stars: 3, events: 2 })
    expect(hasAnyHistory(sumHistory([A, B]))).toBe(true)
  })

  it('is empty for an empty roster and for children who have done nothing', () => {
    expect(sumHistory([])).toEqual({ stars: 0, events: 0 })
    expect(hasAnyHistory(sumHistory([A, B]))).toBe(false)
  })
})
