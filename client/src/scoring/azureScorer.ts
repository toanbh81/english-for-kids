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
  const res = await fetch('/api/speech-token')
  if (!res.ok) throw new Error('token unavailable')
  return res.json()
}

/** Decode any browser-recorded blob (mp4/webm) to 16 kHz mono PCM WAV for the SDK. */
export async function blobToWav(blob: Blob): Promise<ArrayBuffer> {
  const ctx = new AudioContext({ sampleRate: 16000 })
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  const ch = decoded.getChannelData(0)
  const buf = new ArrayBuffer(44 + ch.length * 2); const v = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); v.setUint32(4, 36 + ch.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, ch.length * 2, true)
  ch.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true))
  await ctx.close()
  return buf
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
    const pushStream = sdk.AudioInputStream.createPushStream(sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1))
    pushStream.write(wav.slice(44)); pushStream.close()
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream)
    const paConfig = new sdk.PronunciationAssessmentConfig(targetText,
      sdk.PronunciationAssessmentGradingSystem.HundredMark, sdk.PronunciationAssessmentGranularity.Phoneme, true)
    paConfig.enableProsodyAssessment = true
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)
    paConfig.applyTo(recognizer)
    return new Promise((resolve, reject) => {
      recognizer.recognizeOnceAsync(result => {
        recognizer.close()
        if (result.reason !== sdk.ResultReason.RecognizedSpeech) return reject(new Error(`Azure: ${sdk.ResultReason[result.reason]}`))
        const json = JSON.parse(result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult))
        resolve(parseAzureResult(json))
      }, err => { recognizer.close(); reject(new Error(err)) })
    })
  }
}
