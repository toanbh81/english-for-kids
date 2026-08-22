import { afterEach, beforeEach, vi } from 'vitest'

const recognizeOnceAsync = vi.fn()
const closeRecognizer = vi.fn()

vi.mock('microsoft-cognitiveservices-speech-sdk', () => ({
  SpeechConfig: { fromAuthorizationToken: () => ({ speechRecognitionLanguage: '' }) },
  AudioInputStream: { createPushStream: () => ({ write: vi.fn(), close: vi.fn() }) },
  AudioStreamFormat: { getWaveFormatPCM: () => ({}) },
  AudioConfig: { fromStreamInput: () => ({}) },
  PronunciationAssessmentConfig: class { enableProsodyAssessment = false; applyTo = vi.fn() },
  PronunciationAssessmentGradingSystem: { HundredMark: 1 },
  PronunciationAssessmentGranularity: { Phoneme: 3 },
  SpeechRecognizer: class { recognizeOnceAsync = recognizeOnceAsync; close = closeRecognizer },
  ResultReason: { 0: 'NoMatch', 3: 'RecognizedSpeech', NoMatch: 0, RecognizedSpeech: 3 },
  PropertyId: { SpeechServiceResponse_JsonResult: 'json' },
}))

import { AzureScorer } from './azureScorer'

const RESULT_JSON = JSON.stringify({
  NBest: [{
    PronunciationAssessment: { AccuracyScore: 85, FluencyScore: 90, CompletenessScore: 100, PronScore: 88 },
    Words: [{ Word: 'three', PronunciationAssessment: { AccuracyScore: 85, ErrorType: 'None' }, Phonemes: [] }],
  }],
})
const recognizedResult = (json: string) => ({ reason: 3, properties: { getProperty: () => json } })

const origAudioContext = (globalThis as any).AudioContext
const origOfflineAudioContext = (globalThis as any).OfflineAudioContext

beforeEach(() => {
  recognizeOnceAsync.mockReset()
  closeRecognizer.mockReset()
  ;(globalThis as any).AudioContext = class {
    close = vi.fn().mockResolvedValue(undefined)
    decodeAudioData = vi.fn().mockResolvedValue({ duration: 0.01, getChannelData: () => new Float32Array(160) })
  }
  ;(globalThis as any).OfflineAudioContext = class {
    destination = {}
    createBufferSource() { return { buffer: null, connect: () => {}, start: () => {} } }
    startRendering = vi.fn().mockResolvedValue({ getChannelData: () => new Float32Array(160) })
  }
})

afterEach(() => {
  vi.useRealTimers()
  ;(globalThis as any).AudioContext = origAudioContext
  ;(globalThis as any).OfflineAudioContext = origOfflineAudioContext
})

describe('AzureScorer.score', () => {
  it('resolves the parsed result and closes the recognizer exactly once', async () => {
    recognizeOnceAsync.mockImplementation((ok: (r: unknown) => void) => ok(recognizedResult(RESULT_JSON)))
    const r = await new AzureScorer('tok', 'southeastasia').score(new Blob(['x']), 'three')
    expect(r.overall).toBe(88)
    expect(closeRecognizer).toHaveBeenCalledTimes(1)
  })

  it('rejects (instead of throwing inside the SDK callback) on a malformed payload', async () => {
    recognizeOnceAsync.mockImplementation((ok: (r: unknown) => void) => ok(recognizedResult('not json')))
    await expect(new AzureScorer('tok', 'r').score(new Blob(['x']), 'three')).rejects.toThrow()
    expect(closeRecognizer).toHaveBeenCalledTimes(1)
  })

  it('rejects on a non-speech reason and still closes once', async () => {
    recognizeOnceAsync.mockImplementation((ok: (r: unknown) => void) => ok({ reason: 0, properties: { getProperty: () => '' } }))
    await expect(new AzureScorer('tok', 'r').score(new Blob(['x']), 'three')).rejects.toThrow('Azure: NoMatch')
    expect(closeRecognizer).toHaveBeenCalledTimes(1)
  })

  it('rejects with a timeout after 15s when the SDK never calls back, closing once', async () => {
    vi.useFakeTimers()
    recognizeOnceAsync.mockImplementation(() => {}) // never settles
    const settled = new AzureScorer('tok', 'r').score(new Blob(['x']), 'three').catch((e: Error) => e)
    await vi.advanceTimersByTimeAsync(0) // let blobToWav finish
    expect(recognizeOnceAsync).toHaveBeenCalled()
    expect(closeRecognizer).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(15000)
    expect(await settled).toEqual(new Error('Azure: timeout'))
    expect(closeRecognizer).toHaveBeenCalledTimes(1)
  })
})
