import { act, renderHook } from '@testing-library/react'
import { useSpeakingAttempt } from './useSpeakingAttempt'

/**
 * The one test in this family that does NOT mock `createScorer`: the whole question here is what
 * the child's mic does while the real token lookup is out, so the seam has to be the network.
 *
 * A mic that opens is the child's only way in. When the token endpoint accepts the connection and
 * then says nothing — the classroom wifi behind a captive portal — the lookup used to hang, the
 * mic stayed ⏳ and the card was over before it started. The deadline inside `fetchToken` is what
 * turns that into "the simple engine, in a few seconds".
 */

const origFetch = globalThis.fetch
const origOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')

/** Both attempts' deadlines plus the cold-start backoff between them. */
const BUDGET_MS = 2500 + 700 + 2500

afterEach(() => {
  globalThis.fetch = origFetch
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  delete (navigator as unknown as Record<string, unknown>).onLine
  if (origOnLine) Object.defineProperty(Navigator.prototype, 'onLine', origOnLine)
  vi.useRealTimers()
})

it('recovers the mic from a token request nobody answers, without a tap', async () => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  ;(window as unknown as Record<string, unknown>).webkitSpeechRecognition = class {}
  const fetchMock = vi.fn(() => new Promise<Response>(() => {}))
  globalThis.fetch = fetchMock as unknown as typeof fetch
  vi.useFakeTimers()

  const { result } = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))

  // Nothing has answered yet: the mic is not usable, and it says so rather than looking tappable.
  expect(result.current.micState).toBe('disabled')

  await act(async () => { await vi.advanceTimersByTimeAsync(BUDGET_MS) })

  expect(result.current.micState).toBe('idle')
  expect(result.current.engine).toBe('webspeech')
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
