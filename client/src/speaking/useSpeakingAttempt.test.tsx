import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'

const recorderControl = vi.hoisted(() => ({ shouldFailStart: false, start: vi.fn(), opts: undefined as { maxMs?: number } | undefined }))
/** `queue` feeds successive createScorer() calls; `gate`, when set, holds the next one open so a
 * test can look at the hook while the token round trip is still in flight. */
const scorerControl = vi.hoisted(() => ({
  queue: [] as { engine: string; scorer: unknown; fallbackReason?: 'offline' | 'token' }[],
  gate: null as Promise<void> | null,
}))

vi.mock('../audio/recorder', () => ({
  useRecorder: (opts: { maxMs?: number } = {}) => {
    recorderControl.opts = opts
    const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle')
    return {
      state,
      level: 0,
      start: vi.fn(async () => {
        recorderControl.start()
        if (recorderControl.shouldFailStart) throw new Error('mic denied')
        setState('recording')
      }),
      stop: vi.fn(async () => { setState('idle'); return new Blob() }),
    }
  },
}))
vi.mock('../scoring/createScorer', () => ({
  createScorer: async () => {
    // Claimed when the call is made, not when it answers: a gated call must still be handed the
    // bundle queued for *its* turn, or a test about out-of-order answers cannot say which is which.
    const bundle = scorerControl.queue.shift() ?? {
      engine: 'azure',
      scorer: {
        score: async () => ({
          overall: 85, accuracy: 85, fluency: 90, completeness: 100, engine: 'azure',
          words: [{ word: 'cat', score: 85, errorType: 'None', phonemes: [] }],
        }),
      },
    }
    if (scorerControl.gate) await scorerControl.gate
    return bundle
  },
}))

import { useSpeakingAttempt } from './useSpeakingAttempt'
import { setLimitMinutes } from '../progress/limit'
import { logActivity } from '../progress/activity'

const origOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')
function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

afterEach(() => {
  recorderControl.shouldFailStart = false
  recorderControl.start.mockClear()
  recorderControl.opts = undefined
  scorerControl.queue.length = 0
  scorerControl.gate = null
  delete (window as any).webkitSpeechRecognition
  delete (navigator as unknown as Record<string, unknown>).onLine
  if (origOnLine) Object.defineProperty(Navigator.prototype, 'onLine', origOnLine)
  vi.useRealTimers()
})

/** A Web Speech bundle whose recognizer records whether it was ever asked to listen. */
function webSpeechBundle() {
  const start = vi.fn()
  const score = vi.fn(async () => ({
    overall: 40, accuracy: 40, fluency: 40, completeness: 100, engine: 'webspeech' as const,
    words: [{ word: 'cat', score: 40, errorType: 'None' as const, phonemes: [] }],
  }))
  return { bundle: { engine: 'webspeech', scorer: { start, score } }, start, score }
}

it('records and scores an attempt, then reset() clears the result', async () => {
  const { result } = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))

  await waitFor(() => expect(result.current.micState).toBe('idle'))

  act(() => { result.current.onMic() })
  await waitFor(() => expect(result.current.micState).toBe('recording'))

  act(() => { result.current.onMic() })
  await waitFor(() => expect(result.current.result?.overall).toBe(85))

  act(() => { result.current.reset() })
  expect(result.current.result).toBeNull()
})

/** The recorder has its own hard cap, and if it fires first the MediaRecorder is already closed
 * when the auto-stop tries to read the blob — the attempt scores silence. It must always outlast
 * the screen's window, including Story Voice's long 13 s one. */
it('always gives the recorder a second longer than the screen’s auto-stop', async () => {
  const long = renderHook(() => useSpeakingAttempt({ targetText: 'cat', autoStopMs: 13000 }))
  await waitFor(() => expect(long.result.current.micState).toBe('idle'))
  expect(recorderControl.opts).toEqual({ maxMs: 14000 })

  const short = renderHook(() => useSpeakingAttempt({ targetText: 'cat', autoStopMs: 6000 }))
  await waitFor(() => expect(short.result.current.micState).toBe('idle'))
  expect(recorderControl.opts).toEqual({ maxMs: 8000 })
})

/** One failed token fetch used to pin the card to Web Speech for its whole life — the child then
 * kept getting "not scored" long after the endpoint had recovered. Every attempt asks again. */
it('re-checks Azure on the next attempt instead of staying on Web Speech', async () => {
  setOnLine(true)
  ;(window as any).webkitSpeechRecognition = class {}
  const ws = webSpeechBundle()
  scorerControl.queue.push(ws.bundle) // only the card's first scorer falls back
  const { result } = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))

  await waitFor(() => expect(result.current.engine).toBe('webspeech'))

  act(() => { result.current.onMic() })

  // The token endpoint answered this time: Azure is adopted before the mic opens, and the
  // recognizer — which cannot score a single sound — is never started.
  await waitFor(() => expect(result.current.engine).toBe('azure'))
  expect(ws.start).not.toHaveBeenCalled()
  expect(recorderControl.start).toHaveBeenCalledTimes(1)

  // …and the freshly adopted scorer, not the one this attempt started with, is what scores it.
  act(() => { result.current.onMic() })
  await waitFor(() => expect(result.current.result?.overall).toBe(85))
  expect(ws.score).not.toHaveBeenCalled()
})

/** The re-check costs a round trip and, on a cold start, a backoff on top. For that whole window
 * the mic looked idle while quietly refusing taps — the child would tap again and again into
 * nothing. It now shows itself busy, and the tap that lands in the window is a no-op, not a
 * second mic. */
it('shows the mic as busy while it re-checks the engine, and refuses a second tap', async () => {
  setOnLine(true)
  ;(window as any).webkitSpeechRecognition = class {}
  const ws = webSpeechBundle()
  scorerControl.queue.push(ws.bundle)
  const { result } = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))

  await waitFor(() => expect(result.current.engine).toBe('webspeech'))
  expect(result.current.micState).toBe('idle')

  let answerToken!: () => void
  const gate = new Promise<void>(resolve => { answerToken = resolve })
  scorerControl.gate = gate

  act(() => { result.current.onMic() })

  // The token round trip is still in flight: busy, and no mic open yet.
  expect(result.current.micState).toBe('processing')
  expect(recorderControl.start).not.toHaveBeenCalled()
  expect(ws.start).not.toHaveBeenCalled()

  act(() => { result.current.onMic() }) // an impatient second tap

  scorerControl.gate = null
  await act(async () => { answerToken(); await gate })

  await waitFor(() => expect(result.current.micState).toBe('recording'))
  expect(recorderControl.start).toHaveBeenCalledTimes(1) // once, not twice
  expect(ws.start).not.toHaveBeenCalled()
})

it('keeps Web Speech when the token endpoint is still down', async () => {
  setOnLine(true)
  ;(window as any).webkitSpeechRecognition = class {}
  const first = webSpeechBundle()
  const second = webSpeechBundle()
  scorerControl.queue.push(first.bundle, second.bundle)
  const { result } = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))

  await waitFor(() => expect(result.current.engine).toBe('webspeech'))

  act(() => { result.current.onMic() })

  await waitFor(() => expect(first.start).toHaveBeenCalledTimes(1))
  expect(result.current.engine).toBe('webspeech')
  expect(recorderControl.start).not.toHaveBeenCalled()

  act(() => { result.current.onMic() })
  await waitFor(() => expect(result.current.result?.overall).toBe(40))
  expect(first.score).toHaveBeenCalledTimes(1)
})

/** Offline there is nothing to re-check, and the round trip would only delay the mic. */
it('does not re-check Azure while the browser is offline', async () => {
  setOnLine(false)
  ;(window as any).webkitSpeechRecognition = class {}
  const ws = webSpeechBundle()
  scorerControl.queue.push(ws.bundle) // a second createScorer() call would hand back Azure
  const { result } = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))

  await waitFor(() => expect(result.current.engine).toBe('webspeech'))

  act(() => { result.current.onMic() })

  expect(ws.start).toHaveBeenCalledTimes(1) // synchronously: no token round trip in the way
  expect(result.current.engine).toBe('webspeech')
})

/** A child tapping through a deck starts one token round trip per card, and the answers can come
 * back out of order. The card that has been left behind must not adopt anything: its slow lookup
 * landing last would swap the live card's engine underneath it — on a bad token, all the way down
 * to the phoneme-blind one. */
it('ignores the scorer of a card the child has already left', async () => {
  setOnLine(true)
  const stale = webSpeechBundle()
  scorerControl.queue.push(stale.bundle) // claimed by the first card; the second gets Azure

  let answerStale!: () => void
  const gate = new Promise<void>(resolve => { answerStale = resolve })
  scorerControl.gate = gate

  const { result, rerender } = renderHook(
    (props: { resetKey: string }) => useSpeakingAttempt({ targetText: 'cat', resetKey: props.resetKey }),
    { initialProps: { resetKey: 'apple' } },
  )

  // Straight on to the next card while the first card's lookup is still in flight.
  scorerControl.gate = null
  rerender({ resetKey: 'banana' })
  await waitFor(() => expect(result.current.engine).toBe('azure'))

  await act(async () => { answerStale(); await gate })

  expect(result.current.engine).toBe('azure')
  expect(result.current.micState).toBe('idle')
})

it('shows a friendly error when mic permission is denied', async () => {
  recorderControl.shouldFailStart = true
  const { result } = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))

  await waitFor(() => expect(result.current.micState).toBe('idle'))

  act(() => { result.current.onMic() })
  await waitFor(() => expect(result.current.error).toEqual({ kind: 'mic' }))
})

it('calls onResult exactly once per scored attempt, with the result and recorded blob', async () => {
  const onResult = vi.fn()
  const { result, rerender } = renderHook(
    (props: { onResult: typeof onResult }) => useSpeakingAttempt({ targetText: 'cat', onResult: props.onResult }),
    { initialProps: { onResult } },
  )

  await waitFor(() => expect(result.current.micState).toBe('idle'))

  act(() => { result.current.onMic() })
  await waitFor(() => expect(result.current.micState).toBe('recording'))

  act(() => { result.current.onMic() })
  await waitFor(() => expect(result.current.result?.overall).toBe(85))

  expect(onResult).toHaveBeenCalledTimes(1)
  expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ overall: 85 }), expect.any(Blob))

  // A new callback identity (e.g. a re-render) must not re-invoke onResult for the same result.
  const onResult2 = vi.fn()
  rerender({ onResult: onResult2 })
  expect(onResult2).not.toHaveBeenCalled()

  act(() => { result.current.reset() })
  expect(onResult).toHaveBeenCalledTimes(1)
  expect(onResult2).not.toHaveBeenCalled()
})

describe('typed errors, locked mic, fallback notice, not-ready timer', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

  it('reports notReady when the scorer takes longer than 3 s', async () => {
    vi.useFakeTimers()
    // Never resolves: the same shape as a token round trip that hangs forever.
    scorerControl.gate = new Promise(() => {})
    const { result } = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.error).toEqual({ kind: 'notReady' })
  })

  it('reports fallback once per session when Azure was not available', async () => {
    scorerControl.queue.push({ engine: 'webspeech', scorer: webSpeechBundle().bundle.scorer, fallbackReason: 'token' })
    const first = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))
    await waitFor(() => expect(first.result.current.error).toEqual({ kind: 'fallback', detail: 'token' }))
    act(() => first.result.current.dismissError())

    scorerControl.queue.push({ engine: 'webspeech', scorer: webSpeechBundle().bundle.scorer, fallbackReason: 'token' })
    const second = renderHook(() => useSpeakingAttempt({ targetText: 'dog' }))
    await waitFor(() => expect(second.result.current.engine).toBe('webspeech'))
    expect(second.result.current.error).toBeNull()
  })

  it('locks the mic when today is over the daily limit', async () => {
    const now = Date.now()
    setLimitMinutes(20)
    for (let i = 0; i < 25; i++) {
      logActivity({ ts: now - 25 * 60e3 + i * 60e3, kind: 'speak', id: `x${i}`, score: 80 })
    }
    const { result } = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))
    await waitFor(() => expect(result.current.micState).toBe('locked'))
    expect(result.current.error).toEqual({ kind: 'limit' })
  })
})
