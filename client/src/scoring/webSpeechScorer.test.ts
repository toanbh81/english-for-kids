import { scoreTranscript } from './webSpeechScorer'

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
