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
})

it('picks Azure when online and the token endpoint answers', async () => {
  setOnLine(true)
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ token: 'tok', region: 'southeastasia' }),
  }) as unknown as typeof fetch
  const { scorer, engine } = await createScorer()
  expect(engine).toBe('azure')
  expect(scorer).toBeInstanceOf(AzureScorer)
})

it('falls back to Web Speech when the token fetch fails', async () => {
  setOnLine(true)
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline-ish')) as unknown as typeof fetch
  const { scorer, engine } = await createScorer()
  expect(engine).toBe('webspeech')
  expect(scorer).toBeInstanceOf(WebSpeechScorer)
})

it('falls back to Web Speech without any request when the browser reports offline', async () => {
  setOnLine(false)
  const fetchMock = vi.fn()
  globalThis.fetch = fetchMock as unknown as typeof fetch
  const { scorer, engine } = await createScorer()
  expect(engine).toBe('webspeech')
  expect(scorer).toBeInstanceOf(WebSpeechScorer)
  expect(fetchMock).not.toHaveBeenCalled()
})
