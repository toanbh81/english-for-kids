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
import { missionNoun, useMissionNext } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { ScoredWords } from '../components/ScoredWords'
import { ScoreBars } from '../components/ScoreBars'
import { HintCard } from '../components/HintCard'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import { StressedSentence } from '../components/StressedSentence'
import { BackButton, Button, Card, Chip, PAGE_SHELL } from '../components/ui'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { SPEAK_ERROR_COPY } from '../speaking/speakError'

/**
 * Phone layout follows `SoundPractice`'s idiom to the letter (see the comment block at the top of
 * that file): phone values sit unprefixed, `md:` restores the exact landscape value, and `max-md:`
 * appears only where a shared primitive writes a competing class of its own. Nothing is `sticky`.
 *
 * So does the iPad one: from `ipad:` the frame splits into a learning column and a doing column
 * rather than growing downwards, because at a real 1080×700 the single column was 800 px tall and
 * the mic 32 px below the fold. Same two `contents`-until-`ipad:` wrappers, same names.
 */
const CTA_PHONE = 'max-md:min-h-[64px] max-md:px-4 max-md:text-lg'

/** Three ways back and one way on, in a 400 px doing column: at the landscape button size they
 * wrap to three rows and eat 220 px of the read-out's room. The shape that fits is the one the
 * phone already uses — one row of three, then the primary across the bottom — so the iPad borrows
 * the phone's rule at its own breakpoint instead of inventing a second one. `ipad:px-4` beats the
 * `px-8`/`px-10` `Button` writes for itself for the same reason `max-md:` does: a variant is
 * emitted after the plain utilities. And, like `max-md:`, it provably cannot reach a phone. */
const CTA_IPAD = 'ipad:flex-1 ipad:px-4 ipad:text-lg'

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
  // Null unless the child arrived from the mission: only then is this sentence step "Thẻ 2/4" of
  // today's lesson rather than sentence 2 of the bậc (spec §3).
  const mission = useMissionNext()
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
    // 20 px of side frame on a phone (design §1, the speak-frame family), the 24 px this screen
    // has always had from the tablet breakpoint up. The vertical padding is the safe-area shell
    // resting at the 1.25 rem of the old `py-5` — the same 20 px with no notch to clear.
    <main className={`h-full overflow-y-auto bg-cream-50 px-5 [--page-pad-bottom:1.25rem] [--page-pad-top:1.25rem] md:px-6 ${PAGE_SHELL}`}>
      {/* A *definite* height on the phone is what lets the result read-out below take the leftover
        * space and scroll inside it instead of walking the CTA row off the bottom of the screen.
        * It is switched on only for the result: a definite height also lets a `flex-1` section be
        * squeezed below its content, which is fine for a read-out that scrolls but would paint the
        * recording countdown over the mic. Idle and recording keep the growing `min-h-full`
        * column, so the worst they can do is make the page scroll. */}
      {/* `ipad:h-full` is the same trick the phone result uses one line to the left, for the same
          reason: `min-h-full` is a floor, not a height, so the split's `flex-1`/`min-h-0` can only
          bound a column once the column above it has a definite height to divide. Unlike the phone
          it is on at every state — the iPad frame has no state that needs to grow. */}
      <div className={`mx-auto flex min-h-full w-full max-w-5xl flex-col items-center gap-2.5 md:gap-4 ipad:h-full ${result ? 'max-md:h-full' : ''}`}>
        <header className="flex w-full items-center justify-between gap-4">
          {mission
            ? <BackButton to="/mission" label="Nhiệm vụ" />
            : <BackButton to="/level/sentence-stars" label="Quay lại" />}
          {/* In a lesson the bậc's own count is the wrong count, and two counters are one too many
              for a child to read — so the mission's position replaces it. */}
          {mission
            ? <Chip tone="coral">{missionNoun(mission.pos, 'Thẻ')} {mission.pos.index}/{mission.pos.total}</Chip>
            : <Chip tone="coral">Câu {index + 1}/{SENTENCE_STARS.length}</Chip>}
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {attempt.engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        {/* The iPad split — see `SoundPractice`. `contents` everywhere else, so no other width
            sees a box here; `min-h-0` everywhere here, so a long column scrolls inside itself
            instead of pushing the page past `min-h-full` and taking the mic below the fold. */}
        <div className="contents ipad:flex ipad:min-h-0 ipad:w-full ipad:flex-1 ipad:items-stretch ipad:gap-6">
          {/* LEFT — what the child is learning: the sentence with its stress and linking marks,
              its translation, its 🔊, and the rhythm card that beats it out. */}
          <div data-testid="teach-col" className="contents ipad:flex ipad:min-h-0 ipad:min-w-0 ipad:flex-1 ipad:flex-col ipad:justify-center ipad:gap-4">

            {/* The sentence itself is the headline of the screen — it stays put through the attempt.
                A phone result folds it away along with the rhythm card below: `ScoredWords` reprints
                every word of the sentence with its own score, so the pair would only be repeating
                itself over the room the CTA row needs (§5 M3b). */}
            <section className={`flex w-full flex-col items-center gap-1.5 md:gap-2 ${result ? 'max-md:hidden' : ''}`}>
              <StressedSentence words={star.words} stress={star.stress} link={star.link} />
              <p className="text-center text-sm font-bold leading-snug text-ink-500 md:text-lg md:leading-7">{star.vi}</p>
              <p className="text-center text-[13px] font-bold text-ink-300 [@media(max-width:767px)_and_(max-height:700px)]:hidden md:text-base">Chữ cam = nhấn mạnh · ‿ = nối âm</p>
              <Button variant="secondary" onClick={playSample} className={CTA_PHONE}>🔊 Nghe mẫu</Button>
              {audioMissing && <p className="text-sm font-bold text-ink-300 md:text-lg">Chưa có audio mẫu</p>}
            </section>

            {/* The rhythm card: one dot per word, big where the beat falls. Tapping it replays the
             * sample and each dot beats once as its word is said — a whole beat behind the one before
             * it — so the child *sees* the shape they are aiming for while they hear it. */}
            <Card className={`flex w-full max-w-2xl flex-col items-center gap-1 px-4 py-2 md:px-6 md:py-3 ${result ? 'max-md:hidden' : ''}`}>
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
              <span className="text-[13px] font-bold text-ink-300 md:text-base">Nhịp của câu — chạm để nghe lại</span>
            </Card>
          </div>

          {/* RIGHT — what the child does: the mic and its countdown, Foxy, and in the result
              state the score read-out and the CTA row in that same place. */}
          <div data-testid="do-col" className="contents ipad:flex ipad:min-h-0 ipad:w-[400px] ipad:shrink-0 ipad:flex-col ipad:items-center ipad:justify-center ipad:gap-3">

            {result && feedback && stars ? (
              /* On a phone the read-out is a bounded scrolling region with the CTA row as its
                 *sibling* underneath — never a `sticky` overlay, which would paint over whichever
                 word chip happened to sit at its y. A sentence is up to seven words and seven 64 px
                 chips plus four score bars cannot be made to fit 844 by shrinking type; what can be
                 guaranteed is that the way on is on screen and nothing is hidden behind anything.
                 `md:contents` takes the wrapper out of the box tree from 768 up, so the landscape
                 frame is the same flat column of the same section it has always been.

                 The iPad column takes the box back (`ipad:` is emitted after `md:`, so it wins),
                 because the same arithmetic applies to a 400 px column as to a phone: seven word
                 chips, four score bars and a hint card do not fit 590 px however small the type
                 gets. The read-out scrolls inside its own bounds and the CTA row stays its sibling
                 below — so the way on is always on screen and nothing is behind anything. */
              <section className="flex w-full flex-col items-center gap-2.5 pb-2 max-md:min-h-0 max-md:flex-1 md:w-auto md:gap-4 ipad:min-h-0 ipad:w-full ipad:flex-1 ipad:gap-2.5">
                {stars === 3 && <Confetti />}
                <div data-testid="result-readout" className="flex w-full flex-col items-center gap-2.5 max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto md:contents ipad:flex ipad:min-h-0 ipad:w-full ipad:flex-1 ipad:flex-col ipad:items-center ipad:gap-2.5 ipad:overflow-y-auto">
                  <Stars value={stars} animate={stars === 3} />
                  <p className="font-display text-xl font-extrabold text-ink-900 md:text-3xl">{message}</p>
                  <p className="font-display text-base font-extrabold text-ink-500 md:text-xl">
                    {rhythmLine(result.fluency)}
                  </p>
                  <ScoredWords words={feedback.words} />
                  <ScoreBars result={result} />
                  {feedback.hint && <HintCard hint={feedback.hint} />}
                </div>
                <div className="flex w-full flex-wrap justify-center gap-2 pt-1 md:w-auto md:gap-4 ipad:w-full ipad:shrink-0 ipad:gap-2">
                  {attempt.lastBlob && (
                    <Button variant="outline" className={`${CTA_PHONE} ${CTA_IPAD} max-md:flex-1`} onClick={() => playBlob(attempt.lastBlob!).catch(() => {})}>🎧 Nghe mình</Button>
                  )}
                  <Button variant="outline" className={`${CTA_PHONE} ${CTA_IPAD} max-md:flex-1`} onClick={playSample}>🔊 Nghe mẫu</Button>
                  <Button variant="outline" className={`${CTA_PHONE} ${CTA_IPAD} max-md:flex-1`} onClick={attempt.reset}>↻ Thử lại</Button>
                  {mission
                    ? <Button size="lg" pulse className={`${CTA_PHONE} max-md:w-full ipad:w-full`} onClick={mission.go}>{mission.label}</Button>
                    : next
                      ? <Button size="lg" pulse className={`${CTA_PHONE} max-md:w-full ipad:w-full`} onClick={() => nav(`/star/${next.id}`)}>Tiếp theo →</Button>
                      : <Button size="lg" pulse className={`${CTA_PHONE} max-md:w-full ipad:w-full`} onClick={() => nav('/level/sentence-stars')}>Hoàn thành 🎉</Button>}
                </div>
              </section>
            ) : (
              /* `ipad:flex-none`: in the two-column frame the doing column centres its own group
                 (countdown, Foxy, mic), so a stretching reserve here would only push the mic to
                 the bottom edge of the screen. */
              <section className="flex min-h-[112px] flex-1 flex-col items-center justify-center gap-3 max-md:min-h-0 ipad:min-h-0 ipad:flex-none">
                {recording ? (
                  <>
                    <div aria-hidden="true" className="font-display text-[44px] font-extrabold leading-none text-coral-text md:text-[56px]">{secondsLeft}</div>
                    <Foxy mood="listening" size="sm" say="Foxy đang lắng nghe…" />
                  </>
                ) : (
                  <p className="font-display text-base font-extrabold text-ink-900 [@media(max-width:767px)_and_(max-height:700px)]:hidden md:text-2xl">Nói cả câu một hơi nhé!</p>
                )}
              </section>
            )}

            {attempt.error && <p className="font-display text-xl font-extrabold text-fix-700 md:text-2xl">{SPEAK_ERROR_COPY[attempt.error.kind].title}</p>}

            {!result && (
              <div className="mt-auto flex flex-col items-center gap-2 pb-1 pt-1 [@media(max-width:767px)_and_(max-height:700px)]:pb-0 [@media(max-width:767px)_and_(max-height:700px)]:pt-0 md:mt-0 md:gap-3 md:pb-2">
                <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
                {!recording && <p className="font-display text-base font-extrabold text-ink-500 [@media(max-width:767px)_and_(max-height:700px)]:hidden md:text-xl">Chạm để nói nào!</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
