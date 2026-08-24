import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SENTENCE_STARS, findSentenceStar } from '../content'
import type { SentenceStar } from '../content/types'
import type { PronunciationResult } from '../scoring/types'
import { playBlob, stopCurrentAudio, trackAudio } from '../audio/player'
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
 * accurate every single word was, and that is exactly the thing this bậc is teaching.
 *
 * Three bands, not two: a 70 is a nearly joined-up read that just earned 2 stars, and calling it
 * "chậm" would contradict them. The middle band names the one thing left to do instead. */
function rhythmLine(fluency: number): string {
  if (fluency >= 80) return 'Nhịp: 🎵 tốt'
  if (fluency >= 60) return 'Nhịp: 🙂 khá — nói liền hơi hơn nhé'
  return 'Nhịp: 🐢 chậm'
}

/** Roughly one word every 0.42 s is how these samples are read (Emma HD at rate -10%). It only
 * stands in for a real measurement when the browser never reports the file's duration. */
const ESTIMATED_WORD_MS = 420

/** How much of its beat a dot spends popping. Short of the full beat, so each dot is visibly
 * back down before the next one goes up and the eye can follow the beat travelling along. */
const POP_FRACTION = 0.6

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
  // True only while the sample is actually sounding, so the rhythm dots beat with it and stop
  // when it ends (or when the file turns out not to be there).
  const [playing, setPlaying] = useState(false)
  // One beat = one word of the sample. Measured from the file itself, so the dots keep the
  // sample's real tempo rather than a rate someone typed in.
  const [beatMs, setBeatMs] = useState(ESTIMATED_WORD_MS)
  // Each dot's pop is a one-shot animation, so it has already finished by the next play. Bumping
  // this re-keys the dots into fresh nodes, which is what re-arms them.
  const [run, setRun] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
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

  /** Detach and silence whatever is currently sounding. Safe to call on an already-stopped card
   * (nothing is playing) and on unmount, so a sample can never outlive the screen. */
  function stopSample() {
    const a = audioRef.current
    if (a) {
      a.onloadedmetadata = null; a.onended = null; a.onerror = null
      a.pause()
      audioRef.current = null
    }
    setPlaying(false)
  }

  /**
   * The sample is loaded here rather than through `playUrl` because the dots need its *duration*:
   * one beat per word only means anything if the beat is the sample's own. The estimate carries
   * the dots until `loadedmetadata` lands (and forever, if it never does).
   *
   * Sample audio is generated locally and may simply not be there yet — say so, never throw.
   */
  function playSample() {
    stopSample()
    // The card drives its own element, but the app still only ever sounds one clip: silence
    // anything the player has going before adding to it.
    stopCurrentAudio()
    const a = new Audio(star.audio)
    audioRef.current = a
    const live = () => audioRef.current === a
    const failed = () => { if (live()) { stopSample(); setAudioMissing(true) } }
    // …and hand this element over, so the next playUrl (a "Nghe mình" playback, say) stops it.
    trackAudio(a, () => { if (live()) stopSample() })

    setBeatMs(ESTIMATED_WORD_MS)
    setRun(r => r + 1)
    a.onloadedmetadata = () => {
      if (!live()) return
      setAudioMissing(false)
      const seconds = a.duration
      if (Number.isFinite(seconds) && seconds > 0) setBeatMs((seconds * 1000) / star.words.length)
    }
    a.onended = () => { if (live()) { setAudioMissing(false); stopSample() } }
    a.onerror = failed

    setPlaying(true)
    // Safari rejects play() rather than firing `error` when it cannot start — settle both ways.
    Promise.resolve(a.play()).catch(failed)
  }

  // A sample must not keep sounding after the child has left the sentence.
  useEffect(() => stopSample, [])

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
         * sample and each dot beats once as its word is said — a whole beat behind the one before
         * it — so the child *sees* the shape they are aiming for while they hear it. */}
        <Card className="flex w-full max-w-2xl flex-col items-center gap-1 px-6 py-3">
          <button
            type="button"
            onClick={playSample}
            aria-label="Nghe nhịp của câu"
            style={{ '--beat': `${Math.round(beatMs)}ms` } as React.CSSProperties}
            className="flex min-h-[64px] w-full items-center justify-center gap-4 transition-transform active:translate-y-[2px]"
          >
            {star.words.map((_w, i) => (
              <span
                // Re-keyed per play (and when a measured tempo replaces the estimate) so the
                // one-shot pop is re-armed instead of staying spent from the last time.
                key={`${run}:${Math.round(beatMs)}:${i}`}
                data-testid="rhythm-dot"
                data-stress={stressed.has(i) ? 'on' : 'off'}
                aria-hidden="true"
                className={`shrink-0 rounded-full ${stressed.has(i) ? 'h-6 w-6 bg-coral-500' : 'h-3 w-3 bg-teal-500'} ${playing ? 'animate-beat' : ''}`}
                style={playing ? {
                  animationDelay: `${Math.round(i * beatMs)}ms`,
                  animationDuration: `${Math.round(beatMs * POP_FRACTION)}ms`,
                  animationIterationCount: 1,
                } : undefined}
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
              {rhythmLine(result.fluency)}
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
