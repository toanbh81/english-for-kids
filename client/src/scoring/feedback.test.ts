import { toFeedback } from './feedback'
import type { PronunciationResult } from './types'

const base = (over: Partial<PronunciationResult>): PronunciationResult => ({
  overall: 0, accuracy: 0, fluency: 0, completeness: 0, words: [], engine: 'azure', ...over,
})

describe('toFeedback', () => {
  it('maps score bands to stars and messages', () => {
    expect(toFeedback(base({ overall: 30 })).stars).toBe(1)
    expect(toFeedback(base({ overall: 60 })).stars).toBe(2)
    expect(toFeedback(base({ overall: 80 })).stars).toBe(3)
    expect(toFeedback(base({ overall: 30 })).message).toBe('Thử lại nào!')
    expect(toFeedback(base({ overall: 90 })).message).toBe('Tuyệt vời!')
  })
  it('colors words: >=80 good, 60-79 ok, <60 fix', () => {
    const fb = toFeedback(base({ overall: 70, words: [
      { word: 'I', score: 95, errorType: 'None', phonemes: [] },
      { word: 'like', score: 65, errorType: 'None', phonemes: [] },
      { word: 'three', score: 40, errorType: 'Mispronunciation', phonemes: [{ phoneme: 'th', score: 20 }, { phoneme: 'r', score: 80 }] },
    ] }))
    expect(fb.words.map(w => w.tone)).toEqual(['good', 'ok', 'fix'])
  })
  it('gives exactly one hint for the lowest word and its worst phoneme', () => {
    const fb = toFeedback(base({ overall: 70, words: [
      { word: 'three', score: 40, errorType: 'Mispronunciation', phonemes: [{ phoneme: 'th', score: 20 }, { phoneme: 'r', score: 80 }] },
      { word: 'very', score: 50, errorType: 'Mispronunciation', phonemes: [{ phoneme: 'v', score: 30 }] },
    ] }))
    expect(fb.hint).toEqual({ word: 'three', phoneme: 'th', tip: 'Đặt đầu lưỡi giữa hai hàm răng rồi thổi nhẹ.' })
  })
  it('falls back to the default tip when the weak word has no phoneme detail', () => {
    const fb = toFeedback(base({ overall: 70, words: [
      { word: 'three', score: 55, errorType: 'Mispronunciation', phonemes: [] },
    ] }))
    expect(fb.hint).toEqual({ word: 'three', phoneme: undefined, tip: 'Nghe mẫu rồi nói chậm lại từng âm nhé.' })
  })
  it('gives no hint when every word is good', () => {
    expect(toFeedback(base({ overall: 90, words: [{ word: 'cat', score: 92, errorType: 'None', phonemes: [] }] })).hint).toBeUndefined()
  })
})
