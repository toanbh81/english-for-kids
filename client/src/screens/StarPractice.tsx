import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SENTENCE_STARS, findSentenceStar } from '../content'
import type { SentenceStar } from '../content/types'
import type { PronunciationResult } from '../scoring/types'
import { playBlob, playUrl } from '../audio/player'
import { toFeedback } from '../scoring/feedback'
import { starsForSentence } from '../scoring/levelStars'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { saveRecording } from '../progress/recordings'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { ScoredWords } from '../components/ScoredWords'
import { ScoreBars } from '../components/ScoreBars'
import { HintCard } from '../components/HintCard'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import { StressedSentence } from '../components/StressedSentence'
import { BackButton, Button, Card, Chip } from '../components/ui'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'

/** The hook stops the recording itself after this long; the countdown just mirrors it. */
const AUTO_STOP_MS = 6000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

/** Fluency is what "rhythm" means here: a sentence read word-by-word scores low on it however
 * accurate every single word was, and that is exactly the thing this bậc is teaching. */
const SLOW_BELOW = 60

export function StarPractice() {
  const { id = '' } = useParams()
  const star = findSentenceStar(id)
  // The hooks live in the inner component so an unknown sentence never renders half of them.
  if (!star) return <p>Không tìm thấy câu</p>
  return <StarRun key={star.id} star={star} />
}

function StarRun({ star }: { star: SentenceStar }) {
  const nav = useNavigate()
  const [audioMissing, setAudioMissing] = useState(false)
  // True only while the sample is actually sounding, so the rhythm dots pulse with it and stop
  // when it ends (or when the file turns out not to be there).
  const [playing, setPlaying] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_FROM)

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    logActivity({ ts: Date.now(), kind: 'speak', id: star.id, score: result.overall, phonemes: result.words.flatMap(w => w.phonemes) })
    if (blob) saveRecording({ id: `${star.id}:${Date.now()}`, ts: Date.now(), text: star.text, blob }).catch(() => {})
  }

  const attempt = useSpeakingAttempt({
    targetText: star.text,
    autoStopMs: AUTO_STOP_MS,
    resetKey: star.id,
    onResult: handleResult,
  })

  const result = attempt.result
  // `toFeedback` supplies the per-word tones and the hint; the stars themselves come from the
  // level's own rule, which weighs fluency and completeness rather than one overall number.
  const feedback = useMemo(() => (result ? toFeedback(result) : null), [result])
  const stars = useMemo(() => (result ? starsForSentence(result) : null), [result])

  // A retry can only raise the sentence's stars — `setStars` keeps the highest it has seen.
  useEffect(() => {
    if (result) setStars(`sstar:${star.id}`, starsForSentence(result))
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

  const index = SENTENCE_STARS.findIndex(s => s.id === star.id)
  const next = SENTENCE_STARS[index + 1]
  const stressed = new Set(star.stress)

  /** Sample audio is generated locally and may simply not be there yet — say so, never throw. */
  function playSample() {
    setPlaying(true)
    playUrl(star.audio).then(
      () => { setAudioMissing(false); setPlaying(false) },
      () => { setAudioMissing(true); setPlaying(false) },
    )
  }

  const message = stars === 3 ? 'Tuyệt vời!' : stars === 2 ? 'Hay lắm!' : 'Thử lại nhé'

  return (
    <main className="h-full overflow-y-auto bg-cream-50 px-6 py-5">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center gap-4">
        <header className="flex w-full items-center justify-between gap-4">
          <BackButton to="/level/sentence-stars" label="Quay lại" />
          <Chip tone="coral">Câu {index + 1}/{SENTENCE_STARS.length}</Chip>
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {attempt.engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        {/* The sentence itself is the headline of the screen — it stays put through the attempt. */}
        <section className="flex w-full flex-col items-center gap-2">
          <StressedSentence words={star.words} stress={star.stress} link={star.link} />
          <p className="text-center text-lg font-bold text-ink-500">{star.vi}</p>
          <p className="text-center text-base font-bold text-ink-300">Chữ cam = nhấn mạnh · ‿ = nối âm</p>
          <Button variant="secondary" onClick={playSample}>🔊 Nghe mẫu</Button>
          {audioMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}
        </section>

        {/* The rhythm card: one dot per word, big where the beat falls. Tapping it replays the
         * sample and the dots pulse along, so the child *sees* the shape they are aiming for. */}
        <Card className="flex w-full max-w-2xl flex-col items-center gap-1 px-6 py-3">
          <button
            type="button"
            onClick={playSample}
            aria-label="Nghe nhịp của câu"
            className="flex min-h-[64px] w-full items-center justify-center gap-4 transition-transform active:translate-y-[2px]"
          >
            {star.words.map((_w, i) => (
              <span
                key={i}
                data-testid="rhythm-dot"
                data-stress={stressed.has(i) ? 'on' : 'off'}
                aria-hidden="true"
                className={`shrink-0 rounded-full ${stressed.has(i) ? 'h-6 w-6 bg-coral-500' : 'h-3 w-3 bg-teal-500'} ${playing ? 'animate-pulse-soft' : ''}`}
                style={playing ? { animationDelay: `${i * 0.18}s` } : undefined}
              />
            ))}
          </button>
          <span className="text-base font-bold text-ink-300">Nhịp của câu — chạm để nghe lại</span>
        </Card>

        {result && feedback && stars ? (
          <section className="flex flex-col items-center gap-4 pb-2">
            {stars === 3 && <Confetti />}
            <Stars value={stars} animate={stars === 3} />
            <p className="font-display text-3xl font-extrabold text-ink-900">{message}</p>
            <p className="font-display text-xl font-extrabold text-ink-500">
              {result.fluency < SLOW_BELOW ? 'Nhịp: 🐢 chậm' : 'Nhịp: 🎵 tốt'}
            </p>
            <ScoredWords words={feedback.words} />
            <ScoreBars result={result} />
            {feedback.hint && <HintCard hint={feedback.hint} />}
            <div className="flex flex-wrap justify-center gap-4 pt-1">
              {attempt.lastBlob && (
                <Button variant="outline" onClick={() => playBlob(attempt.lastBlob!).catch(() => {})}>🎧 Nghe mình</Button>
              )}
              <Button variant="outline" onClick={playSample}>🔊 Nghe mẫu</Button>
              <Button variant="outline" onClick={attempt.reset}>↻ Thử lại</Button>
              {next
                ? <Button size="lg" pulse onClick={() => nav(`/star/${next.id}`)}>Tiếp theo →</Button>
                : <Button size="lg" pulse onClick={() => nav('/level/sentence-stars')}>Hoàn thành 🎉</Button>}
            </div>
          </section>
        ) : (
          <section className="flex min-h-[112px] flex-1 flex-col items-center justify-center gap-3">
            {recording ? (
              <>
                <div aria-hidden="true" className="font-display text-[56px] font-extrabold leading-none text-coral-text">{secondsLeft}</div>
                <Foxy mood="listening" size="sm" say="Foxy đang lắng nghe…" />
              </>
            ) : (
              <p className="font-display text-2xl font-extrabold text-ink-900">Nói cả câu một hơi nhé!</p>
            )}
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
