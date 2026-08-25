import { afterEach, vi } from 'vitest'
import { createScorer } from './createScorer'
import { AzureScorer } from './azureScorer'
import { WebSpeechScorer } from './webSpeechScorer'

const origFetch = globalThis.fetch
const origOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

afterEach(() => {
  globalThis.fetch = origFetch
  delete (navigator as unknown as Record<string, unknown>).onLine
  if (origOnLine) Object.defineProperty(Navigator.prototype, 'onLine', origOnLine)
  vi.useRealTimers()
})

/** The retry sits behind a 700 ms backoff, so the timers have to be driven for it to happen. */
async function createScorerThroughBackoff() {
  vi.useFakeTimers()
  const pending = createScorer()
  await vi.advanceTimersByTimeAsync(700)
  return pending
}

it('picks Azure when online and the token endpoint answers', async () => {
  setOnLine(true)
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ token: 'tok', region: 'southeastasia' }),
  }) as unknown as typeof fetch
  const { scorer, engine } = await createScorer()
  expect(engine).toBe('azure')
  expect(scorer).toBeInstanceOf(AzureScorer)
})

/** The token endpoint is serverless: the first request after an idle spell can fail on the cold
 * start alone. Giving up on it would demote a whole card to the phoneme-blind engine. */
it('retries the token once after a backoff and still gets Azure', async () => {
  setOnLine(true)
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new Error('cold start'))
    .mockResolvedValue({ ok: true, json: async () => ({ token: 'tok', region: 'southeastasia' }) })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const { scorer, engine } = await createScorerThroughBackoff()

  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(engine).toBe('azure')
  expect(scorer).toBeInstanceOf(AzureScorer)
})

it('falls back to Web Speech only after the retry fails too', async () => {
  setOnLine(true)
  const fetchMock = vi.fn().mockRejectedValue(new Error('offline-ish'))
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const { scorer, engine } = await createScorerThroughBackoff()

  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(engine).toBe('webspeech')
  expect(scorer).toBeInstanceOf(WebSpeechScorer)
})

/** "Online" is not the same as "answered": a captive-portal wifi accepts the connection and then
 * says nothing at all. Both attempts have to hit their own deadline and hand back an engine — a
 * lookup that never settles is a mic that stays ⏳ for the rest of the card. */
it('falls back to Web Speech on its own when the token endpoint never answers', async () => {
  setOnLine(true)
  const fetchMock = vi.fn(() => new Promise<Response>(() => {}))
  globalThis.fetch = fetchMock as unknown as typeof fetch
  vi.useFakeTimers()

  const pending = createScorer()
  // 2.5 s deadline, the 700 ms cold-start backoff, then the second attempt's own 2.5 s.
  await vi.advanceTimersByTimeAsync(2500 + 700 + 2500)

  const { scorer, engine } = await pending
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(engine).toBe('webspeech')
  expect(scorer).toBeInstanceOf(WebSpeechScorer)
  expect(vi.getTimerCount()).toBe(0)
})

/** Offline is not a cold start — there is nothing to retry, and the child must not wait out a
 * backoff before the mic opens. The promise settles with the clock frozen. */
it('falls back to Web Speech with no request and no backoff when the browser reports offline', async () => {
  setOnLine(false)
  const fetchMock = vi.fn()
  globalThis.fetch = fetchMock as unknown as typeof fetch
  vi.useFakeTimers()

  const { scorer, engine } = await createScorer()

  expect(engine).toBe('webspeech')
  expect(scorer).toBeInstanceOf(WebSpeechScorer)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
