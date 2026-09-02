import { AzureScorer, fetchToken } from './azureScorer'
import { WebSpeechScorer } from './webSpeechScorer'
import type { PronunciationScorer } from './types'

/**
 * The token endpoint is a serverless function: its first request after an idle spell can fail on
 * the cold start alone. One retry costs 700 ms and is the difference between real phoneme scores
 * and a whole card demoted to the phoneme-blind Web Speech engine.
 */
const RETRY_MS = 700
const ATTEMPTS = 2

const wait = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms) })

export async function createScorer(): Promise<{
  scorer: PronunciationScorer
  engine: 'azure' | 'webspeech'
  fallbackReason?: 'offline' | 'token'
}> {
  // Offline is not a cold start: there is nothing to retry, and a backoff would only delay the mic.
  if (!navigator.onLine) return { scorer: new WebSpeechScorer(), engine: 'webspeech', fallbackReason: 'offline' }
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) await wait(RETRY_MS)
    try { const { token, region } = await fetchToken(); return { scorer: new AzureScorer(token, region), engine: 'azure' } }
    catch { /* try again, then fall through */ }
  }
  return { scorer: new WebSpeechScorer(), engine: 'webspeech', fallbackReason: 'token' }
}
