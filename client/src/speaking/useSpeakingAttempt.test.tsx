import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'

const recorderControl = vi.hoisted(() => ({ shouldFailStart: false, start: vi.fn() }))
const scorerControl = vi.hoisted(() => ({ queue: [] as { engine: string; scorer: unknown }[] }))

vi.mock('../audio/recorder', () => ({
  useRecorder: () => {
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
  createScorer: async () => scorerControl.queue.shift() ?? ({
    engine: 'azure',
    scorer: {
      score: async () => ({
        overall: 85, accuracy: 85, fluency: 90, completeness: 100, engine: 'azure',
        words: [{ word: 'cat', score: 85, errorType: 'None', phonemes: [] }],
      }),
    },
  }),
}))

import { useSpeakingAttempt } from './useSpeakingAttempt'

afterEach(() => {
  recorderControl.shouldFailStart = false
  recorderControl.start.mockClear()
  scorerControl.queue.length = 0
  delete (window as any).webkitSpeechRecognition
  vi.useRealTimers()
})

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

it('shows a friendly error when mic permission is denied', async () => {
  recorderControl.shouldFailStart = true
  const { result } = renderHook(() => useSpeakingAttempt({ targetText: 'cat' }))

  await waitFor(() => expect(result.current.micState).toBe('idle'))

  act(() => { result.current.onMic() })
  await waitFor(() => expect(result.current.error).toMatch(/cho phép dùng mic/))
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
