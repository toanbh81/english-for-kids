import { scoreTranscript, WebSpeechScorer } from './webSpeechScorer'
import { beforeEach, afterEach, vi } from 'vitest'

describe('scoreTranscript', () => {
  it('scores 100 when all target words recognized', () => {
    const r = scoreTranscript('i like cats', 'I like cats.')
    expect(r.overall).toBe(100)
    expect(r.words.every(w => w.score === 100)).toBe(true)
    expect(r.engine).toBe('webspeech')
  })
  it('marks missing words as Omission with score 0', () => {
    const r = scoreTranscript('i like', 'I like cats')
    expect(r.words[2]).toMatchObject({ word: 'cats', score: 0, errorType: 'Omission' })
    expect(r.overall).toBe(67)
  })
  it('returns 0 for empty transcript', () => {
    expect(scoreTranscript('', 'cat').overall).toBe(0)
  })
})

describe('WebSpeechScorer', () => {
  beforeEach(() => {
    const fakeRecognition = {
      lang: '',
      interimResults: false,
      continuous: false,
      onresult: null as any,
      onend: null as any,
      onerror: null as any,
      start: vi.fn(),
      stop: vi.fn(function (this: typeof fakeRecognition) {
        // Simulate receiving results and then ending
        if (this.onresult) {
          this.onresult({
            results: { 0: { 0: { transcript: 'cat' } }, length: 1 } as any
          })
        }
        if (this.onend) {
          this.onend()
        }
      })
    }
    ;(window as any).webkitSpeechRecognition = class {
      lang = ''
      interimResults = false
      continuous = false
      onresult: any = null
      onend: any = null
      onerror: any = null
      start = vi.fn()
      stop = vi.fn(fakeRecognition.stop)
    }
  })

  afterEach(() => {
    delete (window as any).webkitSpeechRecognition
  })

  it('captures transcript and scores correctly with onend', async () => {
    const scorer = new WebSpeechScorer()
    scorer.start()
    const transcript = await scorer.stop()
    expect(transcript).toBe('cat')
    const result = await scorer.score(new Blob(), 'cat')
    expect(result.overall).toBe(100)
  })

  it('resolves timeout when onend never fires', async () => {
    vi.useFakeTimers()
    try {
      const fakeRecognitionTimeout = {
        lang: '',
        interimResults: false,
        continuous: false,
        onresult: null as any,
        onend: null as any,
        onerror: null as any,
        start: vi.fn(),
        stop: vi.fn() // Never fires onend or onerror
      }
      ;(window as any).webkitSpeechRecognition = class {
        lang = ''
        interimResults = false
        continuous = false
        onresult: any = null
        onend: any = null
        onerror: any = null
        start = vi.fn()
        stop = vi.fn(fakeRecognitionTimeout.stop)
      }

      const scorer = new WebSpeechScorer()
      scorer.start()
      const stopPromise = scorer.stop()
      await vi.advanceTimersByTimeAsync(3000)
      const transcript = await stopPromise
      expect(transcript).toBe('')
    } finally {
      vi.useRealTimers()
      delete (window as any).webkitSpeechRecognition
    }
  })
})
