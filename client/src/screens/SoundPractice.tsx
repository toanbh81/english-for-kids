import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { findSound } from '../content'
import type { SoundGroup } from '../content/types'
import type { PronunciationResult, WordTone } from '../scoring/types'
import { playBlob, playUrl } from '../audio/player'
import { PHONEME_TIPS, toneFor } from '../scoring/feedback'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { saveRecording } from '../progress/recordings'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Chip } from '../components/ui'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'

/** The hook stops the recording itself after this long; the countdown just mirrors it. */
const AUTO_STOP_MS = 6000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

const SAMPLE_CHIP =
  'inline-flex min-h-[64px] items-center gap-2 rounded-full bg-teal-50 px-7 font-display text-xl font-extrabold text-teal-600 shadow-[0_5px_0_#C4E8E1] active:translate-y-[2px]'

// Written out per tone (never concatenated) so Tailwind keeps the classes in the build.
const TONE: Record<WordTone, { box: string; glyph: string; label: string }> = {
  good: { box: 'bg-good-50 border-good-300 text-good-700', glyph: '✓', label: 'tốt' },
  ok: { box: 'bg-ok-50 border-ok-300 text-ok-700', glyph: '～', label: 'tạm được' },
  fix: { box: 'bg-fix-50 border-fix-300 text-fix-700', glyph: '✗', label: 'cần sửa' },
}

/**
 * Tập âm scores ONE sound, not the whole word: the chip shows the target phoneme's own score,
 * taken from its WORST occurrence in the attempt (a word can contain the sound twice, and the
 * weak one is the one worth fixing). Engines that report no phoneme detail — Web Speech, or an
 * Azure result where the sound was dropped entirely — fall back to the word's accuracy.
 */
function targetScore(result: PronunciationResult, ph: string): number {
  const hits = result.words.flatMap(w => w.phonemes).filter(p => p.phoneme === ph)
  return hits.length ? Math.min(...hits.map(p => p.score)) : result.accuracy
}

/** 3 stars only when the sound was good in all three words; 2 when it was at least passable. */
function starsFor(scores: number[]): 1 | 2 | 3 {
  if (scores.every(s => s >= 80)) return 3
  if (scores.every(s => s >= 60)) return 2
  return 1
}

/** The whole result in one glance: the IPA symbol, how it went, and the number. */
function SoundChip({ ipa, score }: { ipa: string; score: number }) {
  const tone = toneFor(score)
  const t = TONE[tone]
  return (
    <div
      data-testid="sound-chip"
      data-tone={tone}
      aria-label={`Âm ${ipa} ${Math.round(score)} điểm, ${t.label}`}
      className={`inline-flex min-h-[110px] items-center gap-5 rounded-xl3 border-[4px] px-9 font-display font-extrabold ${t.box}`}
    >
      <span aria-hidden="true" className="text-[54px] leading-none">/{ipa}/</span>
      <span aria-hidden="true" className="text-[38px] leading-none">{t.glyph}</span>
      <span aria-hidden="true" className="text-[54px] leading-none">{Math.round(score)}</span>
    </div>
  )
}

export function SoundPractice() {
  const { ph = '' } = useParams()
  const sound = findSound(ph)
  // The hooks live in the inner component so an unknown phoneme never renders half of them.
  if (!sound || sound.cards.length === 0) return <p>Không tìm thấy âm</p>
  return <SoundRun key={sound.ph} sound={sound} />
}

function SoundRun({ sound }: { sound: SoundGroup }) {
  const { ph, ipa, cards } = sound
  const [idx, setIdx] = useState(0)
  // Best target-phoneme score per word, so a retry can only improve the sound's stars.
  const [best, setBest] = useState<number[]>(() => cards.map(() => 0))
  const [earned, setEarned] = useState<1 | 2 | 3 | null>(null)
  const [soundMissing, setSoundMissing] = useState(false)
  const [sampleMissing, setSampleMissing] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_FROM)
  const card = cards[idx]
  const isLast = idx === cards.length - 1

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    logActivity({ ts: Date.now(), kind: 'speak', id: card.id, score: result.overall, phonemes: result.words.flatMap(w => w.phonemes) })
    if (blob) saveRecording({ id: `${card.id}:${Date.now()}`, ts: Date.now(), text: card.text, blob }).catch(() => {})
  }

  const attempt = useSpeakingAttempt({
    targetText: card.text,
    autoStopMs: AUTO_STOP_MS,
    resetKey: `${ph}:${idx}`,
    onResult: handleResult,
  })

  const result = attempt.result
  const score = result ? targetScore(result, ph) : null

  // One place decides the run's outcome: every scored attempt updates that word's best, and the
  // last word's result closes the run (a retry there can still raise the stars — `setStars` keeps
  // the highest it has seen).
  useEffect(() => {
    if (!result) return
    const next = best.map((v, i) => (i === idx ? Math.max(v, targetScore(result, ph)) : v))
    setBest(next)
    if (isLast) {
      const stars = starsFor(next)
      setStars(`sound:${ph}`, stars)
      setEarned(stars)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  // The countdown only exists while the mic is open: it restarts on every recording and the
  // interval is cleared the moment the state changes (or the screen unmounts).
  const recording = attempt.micState === 'recording'
  useEffect(() => {
    if (!recording) return
    setSecondsLeft(COUNTDOWN_FROM)
    const id = window.setInterval(() => setSecondsLeft(s => (s > 1 ? s - 1 : 1)), 1000)
    return () => clearInterval(id)
  }, [recording])

  const tip = PHONEME_TIPS[ph]
  const tone = score === null ? null : toneFor(score)

  /** Generated locally and possibly not there yet — say so, never throw. */
  function playIsolated() {
    playUrl(`/audio/sounds/${ph}.mp3`).then(() => setSoundMissing(false), () => setSoundMissing(true))
  }
  function playSample() {
    playUrl(card.audio).then(() => setSampleMissing(false), () => setSampleMissing(true))
  }

  function nextWord() {
    setSampleMissing(false)
    setIdx(i => i + 1)
  }

  return (
    <main className="h-full overflow-y-auto bg-cream-50 px-6 py-5">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center gap-4">
        <header className="flex w-full items-center justify-between gap-4">
          <BackButton to="/level/sound-zoo" label="Quay lại" />
          <div className="flex flex-col items-center gap-2">
            <Chip tone="coral">Từ {idx + 1}/{cards.length}</Chip>
            <div className="flex gap-2">
              {cards.map((c, i) => (
                <span
                  key={c.id}
                  aria-hidden="true"
                  className={`h-4 w-4 rounded-full ${i < idx ? 'bg-teal-500' : i === idx ? 'bg-coral-500' : 'bg-line-200'}`}
                />
              ))}
            </div>
          </div>
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {attempt.engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        {/* The sound itself is the headline of the screen — it stays put through every word. */}
        <section className="flex flex-col items-center gap-2">
          <div className="font-display text-[72px] font-extrabold leading-none text-coral-text">/{ipa}/</div>
          {tip && <p className="max-w-xl text-center text-lg font-bold text-ink-500">{tip}</p>}
          <Button variant="secondary" onClick={playIsolated}>🔊 Nghe âm lẻ</Button>
          {soundMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio âm này</p>}
        </section>

        {result && score !== null ? (
          <>
            {earned === 3 && <Confetti />}
            <section className="flex flex-col items-center gap-4 pb-2">
              <SoundChip ipa={ipa} score={score} />
              {tone !== 'good' && tip && (
                <p data-testid="sound-tip" className="max-w-xl rounded-xl3 border-[3px] border-[#FFDF9E] bg-[#FFF6E0] px-6 py-4 text-center text-lg font-bold text-ink-500">
                  👅 {tip}
                </p>
              )}
              <p className="text-lg font-bold text-ink-300">
                Từ <span className="font-display font-extrabold text-ink-900">{card.text}</span> · {Math.round(result.overall)} điểm
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                {attempt.lastBlob && (
                  <Button variant="outline" onClick={() => playBlob(attempt.lastBlob!).catch(() => {})}>🎧 Nghe mình</Button>
                )}
                <Button variant="outline" onClick={playSample}>🔊 Nghe mẫu</Button>
              </div>
              {sampleMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}

              {earned !== null && (
                <div className="flex flex-col items-center gap-2">
                  <Stars value={earned} animate />
                  <p className="font-display text-2xl font-extrabold text-ink-900">
                    {earned === 3 ? 'Cả 3 từ đều tuyệt!' : earned === 2 ? 'Gần được rồi, luyện thêm nhé!' : 'Nghe mẫu rồi thử lại nhé!'}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-4 pt-1">
                <Button variant="outline" onClick={attempt.reset}>↻ Thử lại</Button>
                {isLast
                  ? <Button size="lg" pulse to="/level/sound-zoo">Hoàn thành 🎉</Button>
                  : <Button size="lg" pulse onClick={nextWord}>Tiếp theo →</Button>}
              </div>
            </section>
          </>
        ) : recording ? (
          <section className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="font-display text-[44px] font-extrabold text-[#D9C9AE]">{card.text}</div>
            <div aria-hidden="true" className="font-display text-[56px] font-extrabold leading-none text-coral-text">{secondsLeft}</div>
            <Foxy mood="listening" size="sm" say="Foxy đang lắng nghe…" />
          </section>
        ) : (
          <section className="flex w-full flex-1 flex-wrap items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-3">
              <span aria-hidden="true" className="text-[96px] leading-none">{card.emoji}</span>
              <div className="font-display text-[56px] font-extrabold leading-none text-ink-900">{card.text}</div>
              <div className="text-[22px] font-bold text-ink-300">{card.ipa}</div>
              <button onClick={playSample} className={SAMPLE_CHIP}>🔊 Nghe mẫu</button>
              {sampleMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}
            </div>

            <div className="flex h-[200px] w-[200px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl3 bg-[#FFF1E6] shadow-[0_8px_0_#F2DFC9]">
              <span aria-hidden="true" className="animate-wiggle text-[76px] leading-none">👄</span>
              <span className="text-base font-bold text-ink-500">Khẩu hình miệng</span>
            </div>
          </section>
        )}

        {attempt.error && <p className="font-display text-2xl font-extrabold text-fix-700">{attempt.error}</p>}

        {!result && (
          <div className="flex flex-col items-center gap-3 pb-2 pt-1">
            <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
            {!recording && <p className="font-display text-xl font-extrabold text-ink-500">Chạm để nói nào!</p>}
          </div>
        )}
      </div>
    </main>
  )
}
