import type { PronunciationResult, WordScore } from '../scoring/types'

/** Used whenever the route asks for a result fixture but doesn't carry a real target
 * (e.g. `voice-idle`'s own retell text is long) — 14 words, so `result3`'s 4th/9th/12th-word
 * pattern below always has something to land on. */
const DEFAULT_WORDS = [
  'This', 'is', 'a', 'test', 'sentence', 'for', 'the',
  'pronunciation', 'practice', 'screen', 'shot', 'fixture', 'result', 'today',
]

function wordsFor(targetText?: string): string[] {
  const words = targetText?.trim().split(/\s+/).filter(Boolean)
  return words && words.length > 0 ? words : DEFAULT_WORDS
}

function makeWord(word: string, score: number): WordScore {
  const errorType: WordScore['errorType'] = score >= 80 ? 'None' : score <= 0 ? 'Omission' : 'Mispronunciation'
  const phoneme = word.toLowerCase().replace(/[^a-z]/g, '').slice(0, 2) || 'x'
  return { word, score, errorType, phonemes: [{ phoneme, score }] }
}

/** Azure-like: mostly "good" words, with the 4th and 12th knocked down to "ok" and the 9th to
 * "fix" (see `toneFor` in scoring/feedback.ts) — short target text just means fewer of those
 * indices exist, not that the fixture breaks. */
function buildResult3(targetText?: string): PronunciationResult {
  const words = wordsFor(targetText).map((word, i) => {
    const n = i + 1
    const score = n === 9 ? 40 : n === 4 || n === 12 ? 70 : 95
    return makeWord(word, score)
  })
  return { overall: 86, accuracy: 88, fluency: 81, completeness: 100, prosody: 84, words, engine: 'azure' }
}

/** Web-Speech-like: no prosody (Web Speech never reports it), flat 50s, words alternating
 * perfect/missed. */
function buildResult1(targetText?: string): PronunciationResult {
  const words = wordsFor(targetText).map((word, i) => makeWord(word, i % 2 === 0 ? 100 : 0))
  return { overall: 50, accuracy: 50, fluency: 50, completeness: 50, words, engine: 'webspeech' }
}

/** DEV-only escape hatch for headless screenshots: a `?fixture=result3` / `?fixture=result1`
 * query param stands in for a real scored attempt, so `shoot.mjs` can land a screen straight on
 * its result state without a mic or an Azure/Web-Speech round trip. Never reachable in production
 * — `import.meta.env.DEV` is inlined at build time, so the whole branch (and every fixture id
 * string) is dead code a production build tree-shakes away. */
export function readResultFixture(search: string, targetText?: string): PronunciationResult | null {
  if (!import.meta.env.DEV) return null
  const fixture = new URLSearchParams(search).get('fixture')
  if (fixture === 'result3') return buildResult3(targetText)
  if (fixture === 'result1') return buildResult1(targetText)
  return null
}
