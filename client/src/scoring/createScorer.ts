import { AzureScorer, fetchToken } from './azureScorer'
import { WebSpeechScorer } from './webSpeechScorer'
import type { PronunciationScorer } from './types'

export async function createScorer(): Promise<{ scorer: PronunciationScorer; engine: 'azure' | 'webspeech' }> {
  if (navigator.onLine) {
    try { const { token, region } = await fetchToken(); return { scorer: new AzureScorer(token, region), engine: 'azure' } }
    catch { /* fall through */ }
  }
  return { scorer: new WebSpeechScorer(), engine: 'webspeech' }
}
