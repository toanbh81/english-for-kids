import type { PronunciationResult, PronunciationScorer } from './types'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean)

export function scoreTranscript(transcript: string, target: string): PronunciationResult {
  const heard = new Set(norm(transcript))
  const words = norm(target).map(w => ({
    word: w, score: heard.has(w) ? 100 : 0,
    errorType: heard.has(w) ? 'None' as const : 'Omission' as const, phonemes: [],
  }))
  const overall = words.length ? Math.round(words.reduce((s, w) => s + w.score, 0) / words.length) : 0
  return { overall, accuracy: overall, fluency: overall, completeness: overall, words, engine: 'webspeech' }
}

type Rec = { start(): void; stop(): void; lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null }

export class WebSpeechScorer implements PronunciationScorer {
  private rec: Rec | null = null
  private transcript = ''
  private done: Promise<string> = Promise.resolve('')

  static isSupported() { return typeof window !== 'undefined' && 'webkitSpeechRecognition' in window }

  start() {
    const Ctor = (window as unknown as { webkitSpeechRecognition: new () => Rec }).webkitSpeechRecognition
    this.rec = new Ctor()
    this.rec.lang = 'en-US'; this.rec.interimResults = false; this.rec.continuous = true
    this.transcript = ''
    this.done = new Promise(resolve => {
      this.rec!.onresult = e => { this.transcript = Array.from(e.results).map(r => r[0].transcript).join(' ') }
      this.rec!.onend = () => resolve(this.transcript)
    })
    this.rec.start()
  }
  stop() { this.rec?.stop(); return this.done }
  async score(_audio: Blob, target: string) { return scoreTranscript(await this.done, target) }
}
