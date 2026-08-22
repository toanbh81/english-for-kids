import * as sdk from 'microsoft-cognitiveservices-speech-sdk'
import type { PronunciationResult, PronunciationScorer, WordScore } from './types'

type AzurePhoneme = { Phoneme: string; PronunciationAssessment?: { AccuracyScore?: number } }
type AzureWord = {
  Word: string
  PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: WordScore['errorType'] }
  Phonemes?: AzurePhoneme[]
}
type AzureNBest = {
  PronunciationAssessment: { AccuracyScore: number; FluencyScore: number; CompletenessScore: number; PronScore: number; ProsodyScore?: number }
  Words?: AzureWord[]
}
type AzureResultJson = { NBest?: AzureNBest[] }

export function parseAzureResult(json: unknown): PronunciationResult {
  const n = (json as AzureResultJson).NBest?.[0]
  if (!n) throw new Error('Azure result has no NBest')
  const pa = n.PronunciationAssessment
  const words: WordScore[] = (n.Words ?? []).map((w: AzureWord) => ({
    word: w.Word, score: w.PronunciationAssessment?.AccuracyScore ?? 0,
    errorType: w.PronunciationAssessment?.ErrorType ?? 'None',
    phonemes: (w.Phonemes ?? []).map((p: AzurePhoneme) => ({ phoneme: p.Phoneme, score: p.PronunciationAssessment?.AccuracyScore ?? 0 })),
  }))
  return { overall: pa.PronScore, accuracy: pa.AccuracyScore, fluency: pa.FluencyScore,
    completeness: pa.CompletenessScore, prosody: pa.ProsodyScore, words, engine: 'azure' }
}

export async function fetchToken(): Promise<{ token: string; region: string }> {
  const res = await fetch(`${import.meta.env.VITE_API_BASE ?? ''}/api/speech-token`)
  if (!res.ok) throw new Error('token unavailable')
  return res.json()
}

const TARGET_RATE = 16000
const SCORE_TIMEOUT_MS = 15000

/** Wrap mono float samples in a 16-bit PCM WAV container at the given sample rate. */
export function pcmToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytes = samples.length * 2
  const buf = new ArrayBuffer(44 + bytes); const v = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, bytes, true)
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true))
  return buf
}

/** Decode any browser-recorded blob (mp4/webm) to 16 kHz mono PCM WAV for the SDK. */
export async function blobToWav(blob: Blob): Promise<ArrayBuffer> {
  // Decode at the browser's own rate: AudioContext({ sampleRate }) is ignored by some
  // browsers (notably Safari), which would leave the samples at 44.1/48 kHz while the
  // header claimed 16 kHz. Resample explicitly instead so the header is always truthful.
  const ctx = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  } finally {
    await ctx.close()
  }
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * TARGET_RATE), TARGET_RATE)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  return pcmToWav(rendered.getChannelData(0), TARGET_RATE)
}

export class AzureScorer implements PronunciationScorer {
  private token: string
  private region: string

  constructor(token: string, region: string) {
    this.token = token
    this.region = region
  }

  async score(audio: Blob, targetText: string): Promise<PronunciationResult> {
    const wav = await blobToWav(audio)
    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(this.token, this.region)
    speechConfig.speechRecognitionLanguage = 'en-US'
    const pushStream = sdk.AudioInputStream.createPushStream(sdk.AudioStreamFormat.getWaveFormatPCM(TARGET_RATE, 16, 1))
    pushStream.write(wav.slice(44)); pushStream.close()
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream)
    const paConfig = new sdk.PronunciationAssessmentConfig(targetText,
      sdk.PronunciationAssessmentGradingSystem.HundredMark, sdk.PronunciationAssessmentGranularity.Phoneme, true)
    paConfig.enableProsodyAssessment = true
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)
    paConfig.applyTo(recognizer)
    const recognized = new Promise<PronunciationResult>((resolve, reject) => {
      recognizer.recognizeOnceAsync(result => {
        // A malformed payload must reject the promise, not throw inside the SDK callback
        // (where nothing would ever settle it and score() would hang forever).
        try {
          if (result.reason !== sdk.ResultReason.RecognizedSpeech) throw new Error(`Azure: ${sdk.ResultReason[result.reason]}`)
          resolve(parseAzureResult(JSON.parse(result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult))))
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)))
        }
      }, err => reject(new Error(err)))
    })
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Azure: timeout')), SCORE_TIMEOUT_MS)
    })
    try {
      return await Promise.race([recognized, timeout])
    } finally {
      clearTimeout(timer)
      recognizer.close() // exactly once, on success, failure and timeout alike
    }
  }
}
