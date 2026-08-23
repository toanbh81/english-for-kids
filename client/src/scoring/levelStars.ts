import type { PronunciationResult } from './types'

/** Sentence Stars rule: rewards accuracy, fluency AND completeness together, since the whole
 * point of the level is saying the full sentence smoothly, not just individual words. */
export function starsForSentence(r: PronunciationResult): 1 | 2 | 3 {
  if (r.accuracy >= 80 && r.fluency >= 80 && r.completeness >= 80) return 3
  if (r.accuracy >= 60 && r.completeness >= 60) return 2
  return 1
}

/** Story Voice rule: prosody-first, since the level is about reading with feeling. Web Speech
 * (and any engine that returns no prosody score) can't judge intonation at all, so it falls back
 * to accuracy and is capped at 2 stars — a child should never get "perfect" credit for feeling
 * the app couldn't actually measure. */
export function starsForVoice(r: PronunciationResult, engine: 'azure' | 'webspeech' | null): 1 | 2 | 3 {
  const p = r.prosody ?? r.accuracy
  if (engine === 'webspeech' || r.prosody === undefined) return Math.min(2, p >= 60 ? 2 : 1) as 1 | 2
  if (p >= 80 && r.accuracy >= 70) return 3
  if (p >= 60) return 2
  return 1
}
