import type { Feedback, PronunciationResult, WordTone } from './types'

export const PHONEME_TIPS: Record<string, string> = {
  th: 'Đặt đầu lưỡi giữa hai hàm răng rồi thổi nhẹ.',
  dh: 'Đặt đầu lưỡi giữa hai hàm răng và rung cổ họng.',
  v: 'Răng trên chạm môi dưới, rung cổ họng.',
  f: 'Răng trên chạm môi dưới, thổi hơi ra.',
  z: 'Như âm "s" nhưng rung cổ họng.',
  sh: 'Chu môi ra, thổi hơi như "suỵt".',
  ch: 'Đầu lưỡi chạm vòm miệng rồi bật ra.',
  r: 'Cuộn lưỡi lên, không chạm vòm miệng.',
  l: 'Đầu lưỡi chạm sau răng trên.',
}
const DEFAULT_TIP = 'Nghe mẫu rồi nói chậm lại từng âm nhé.'

export function toneFor(score: number): WordTone {
  return score >= 80 ? 'good' : score >= 60 ? 'ok' : 'fix'
}

export function toFeedback(r: PronunciationResult): Feedback {
  const stars = r.overall >= 80 ? 3 : r.overall >= 60 ? 2 : 1
  const message = stars === 3 ? 'Tuyệt vời!' : stars === 2 ? 'Tốt lắm! Sửa một chút nhé' : 'Thử lại nào!'
  const words = r.words.map(w => ({ word: w.word, tone: toneFor(w.score) }))
  const worst = [...r.words].filter(w => w.score < 80).sort((a, b) => a.score - b.score)[0]
  let hint: Feedback['hint']
  if (worst) {
    const ph = [...worst.phonemes].sort((a, b) => a.score - b.score)[0]
    hint = { word: worst.word, phoneme: ph?.phoneme, tip: (ph && PHONEME_TIPS[ph.phoneme]) ?? DEFAULT_TIP }
  }
  return { stars, message, words, hint }
}
