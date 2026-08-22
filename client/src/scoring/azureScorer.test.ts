import { parseAzureResult } from './azureScorer'

it('parses NBest[0] into PronunciationResult', () => {
  const r = parseAzureResult({ NBest: [{
    PronunciationAssessment: { AccuracyScore: 85, FluencyScore: 90, CompletenessScore: 100, PronScore: 88, ProsodyScore: 70 },
    Words: [{ Word: 'three', PronunciationAssessment: { AccuracyScore: 40, ErrorType: 'Mispronunciation' },
      Phonemes: [{ Phoneme: 'th', PronunciationAssessment: { AccuracyScore: 20 } }] }],
  }] })
  expect(r).toEqual({ overall: 88, accuracy: 85, fluency: 90, completeness: 100, prosody: 70, engine: 'azure',
    words: [{ word: 'three', score: 40, errorType: 'Mispronunciation', phonemes: [{ phoneme: 'th', score: 20 }] }] })
})
it('throws on missing NBest', () => { expect(() => parseAzureResult({})).toThrow() })
