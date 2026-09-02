import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { STORY_VOICE, findVoice } from '../content'
import type { VoicePassage } from '../content/types'
import type { PronunciationResult } from '../scoring/types'
import { playBlob, playUrl } from '../audio/player'
import { toFeedback } from '../scoring/feedback'
import { starsForVoice } from '../scoring/levelStars'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { missionNoun, useMissionNext } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { ScoredWords } from '../components/ScoredWords'
import { ScoreBars } from '../components/ScoreBars'
import { ProsodyChip } from '../components/ProsodyChip'
import { HintCard } from '../components/HintCard'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Card, Chip, PAGE_SHELL } from '../components/ui'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { SPEAK_ERROR_COPY } from '../speaking/speakError'

/**
 * Phone layout follows `SoundPractice`'s idiom to the letter (see the comment block at the top of
 * that file): phone values sit unprefixed, `md:` restores the exact landscape value, and `max-md:`
 * appears only where a shared primitive writes a competing class of its own. Nothing here is
 * `sticky` — a bottom-pinned panel paints over whatever happens to sit at its y.
 *
 * So does the iPad one: from `ipad:` the frame splits into a learning column (mood, passage,
 * translation, 🔊, tips) and a doing column (mic, countdown, Foxy — then the read-out and the CTA
 * row), because at a real 1080×700 the single column was 813 px tall and the mic 45 px below the
 * fold. Same two `contents`-until-`ipad:` wrappers as `SoundPractice`, same names.
 */
const CTA_PHONE = 'max-md:min-h-[64px] max-md:px-4 max-md:text-lg'

/** Three ways back and one way on, in a 400 px doing column: at the landscape button size they
 * wrap to three rows and eat 220 px of the read-out's room. The shape that fits is the one the
 * phone already uses — one row of three, then the primary across the bottom — so the iPad borrows
 * the phone's rule at its own breakpoint instead of inventing a second one. `ipad:px-4` beats the
 * `px-8`/`px-10` `Button` writes for itself for the same reason `max-md:` does: a variant is
 * emitted after the plain utilities. And, like `max-md:`, it provably cannot reach a phone. */
const CTA_IPAD = 'ipad:flex-1 ipad:px-4 ipad:text-lg'

/** Passages run 2–3 sentences read *slowly, with feeling*, so the mic stays open longer here than
 * anywhere else: at 10 s a careful reader was still mid-passage when it closed, and the unsaid
 * half scored as incomplete. 13 s covers the longest passage with room to breathe. */
const AUTO_STOP_MS = 13000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

/** What "reading with this feeling" actually means, in three things a child can do on purpose.
 * Each mood gets its own three. These are shared by every passage of that mood, so they name no
 * words — a word named here is wrong on the other passages; a passage that needs one carries its
 * own `tips` instead. */
const MOOD_TIPS: Record<VoicePassage['mood'], string[]> = {
  happy: [
    'Mỉm cười khi đọc — giọng sẽ tươi hơn',
    'Đọc hơi nhanh và nhẹ nhàng',
    'Nhấn mạnh vào những từ vui',
  ],
  surprised: [
    'Mở to giọng ngay ở từ đầu câu',
    'Nghỉ một nhịp trước từ bất ngờ',
    'Lên giọng thật cao ở cuối câu cảm thán',
  ],
  question: [
    'Lên giọng ở cuối câu hỏi',
    'Nhấn vào từ để hỏi',
    'Đọc chậm hơn một chút',
  ],
  sad: [
    'Đọc chậm và nhỏ giọng lại',
    'Hạ giọng xuống ở cuối câu',
    'Kéo dài những từ buồn ra một chút',
  ],
  excited: [
    'Đọc to và nhanh hơn bình thường',
    'Nhấn mạnh vào những từ quan trọng',
    'Kết câu bằng giọng đi lên, thật hào hứng',
  ],
  calm: [
    'Đọc thật chậm và êm',
    'Hạ giọng nhẹ ở cuối mỗi câu',
    'Nghỉ một nhịp giữa các câu',
  ],
}

/** Only the sentence-final ❗❓ are tinted: they are what the voice has to *do* at the end of the
 * line, and a ! that closes a quote or sits mid-sentence is not that instruction. "Sentence-final"
 * is "followed by a space or the end of the passage" — enough to tell `look!` from `"stop!"`.
 * The paragraph carries one aria-label so a screen reader hears the passage, not fragments. */
export function Passage({ text }: { text: string }) {
  // The long passages run to three full lines at 34 px and push the mic off the bottom of a
  // landscape iPad. On a wide screen they drop to 30 px — the short ones keep the bigger type.
  // On a phone every passage starts at 24 px: 34 px wraps a three-sentence passage to six lines
  // in a 350 px column, which is most of the room the mic needs. `leading-snug` is spelled out
  // unprefixed, so no `text-*` step can quietly reset it at a breakpoint.
  const long = text.trim().split(/\s+/).length > 12
  return (
    <p
      aria-label={text}
      data-testid="voice-passage"
      className={`max-w-3xl text-center font-display font-extrabold leading-snug text-ink-900 ${long ? 'text-[24px] md:text-[34px] lg:text-[30px]' : 'text-[24px] md:text-[34px]'}`}
    >
      {text.split(/([!?](?=\s|$))/).map((part, i) =>
        part === '!' || part === '?' ? (
          <span key={i} data-testid="voice-punct" className="text-coral-text">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  )
}

export function VoicePractice() {
  const { id = '' } = useParams()
  const passage = findVoice(id)
  // The hooks live in the inner component so an unknown passage never renders half of them.
  if (!passage) return <p>Không tìm thấy đoạn</p>
  return <VoiceRun key={passage.id} passage={passage} />
}

function VoiceRun({ passage }: { passage: VoicePassage }) {
  const nav = useNavigate()
  // Null unless the child arrived from the mission: only then is this passage step "Thẻ 2/4" of
  // today's lesson rather than passage 2 of the bậc (spec §3).
  const mission = useMissionNext()
  const [audioMissing, setAudioMissing] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_FROM)

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    logActivity({ ts: Date.now(), kind: 'speak', id: passage.id, score: result.overall, phonemes: result.words.flatMap(w => w.phonemes) })
    if (blob) saveRecording({ id: `${passage.id}:${Date.now()}`, ts: Date.now(), text: passage.text, blob }).catch(() => {})
  }

  const attempt = useSpeakingAttempt({
    targetText: passage.text,
    autoStopMs: AUTO_STOP_MS,
    resetKey: passage.id,
    onResult: handleResult,
  })

  const result = attempt.result
  const engine = attempt.engine
  const feedback = useMemo(() => (result ? toFeedback(result) : null), [result])
  // Prosody is the point of this bậc, so the stars come from the level's own rule rather than
  // the generic feedback — and the chip shows nothing at all when the engine cannot measure it.
  const stars = useMemo(() => (result ? starsForVoice(result, engine) : null), [result, engine])
  const prosody = result && engine === 'azure' ? result.prosody ?? null : null

  // A retry can only raise the passage's stars — `setStars` keeps the highest it has seen.
  useEffect(() => {
    if (result) setStars(`voice:${passage.id}`, starsForVoice(result, engine))
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

  const index = STORY_VOICE.findIndex(v => v.id === passage.id)
  const next = STORY_VOICE[index + 1]
  // A passage that hinges on a particular word says so itself; otherwise the mood's own three.
  const tips = passage.tips ?? MOOD_TIPS[passage.mood]

  /** Sample audio is generated locally and may simply not be there yet — say so, never throw. */
  function playSample() {
    playUrl(passage.audio).then(() => setAudioMissing(false), () => setAudioMissing(true))
  }

  const message = stars === 3 ? 'Đọc có hồn quá!' : stars === 2 ? 'Hay lắm!' : 'Thử lại nhé'

  return (
    // 20 px of side frame on a phone (design §1, the speak-frame family), the 24 px this screen
    // has always had from the tablet breakpoint up. The vertical padding is the safe-area shell
    // resting at the 1.25 rem of the old `py-5`, so with no notch to clear — iPad, desktop,
    // jsdom — it is the same 20 px it was.
    <main className={`h-full overflow-y-auto bg-cream-50 px-5 [--page-pad-bottom:1.25rem] [--page-pad-top:1.25rem] md:px-6 ${PAGE_SHELL}`}>
      {/* Everything down to the mic has to fit a landscape iPad (1194×834) without scrolling:
        * a mic below the fold reads as "there is nothing to do here". Hence gap-3 rather than
        * gap-4, the smaller mood emoji, and the compact tips list. */}
      {/* A *definite* height on the phone is what lets the result read-out below take the leftover
        * space and scroll inside it; with `min-h-full` alone the column simply grows and the CTA
        * row walks off the bottom of the screen, which is the bug this screen had.
        *
        * It is switched on only for the result, and deliberately. A definite height also lets a
        * `flex-1` section be squeezed *below* its content — harmless for a read-out that scrolls,
        * but the recording state has no scroller and its countdown and Foxy would then be painted
        * over the mic. Idle and recording keep the growing `min-h-full` column they have always
        * had, so the worst they can ever do is make the page scroll. */}
      {/* `ipad:h-full` is the same trick the phone result uses one line to the left, for the same
          reason: `min-h-full` is a floor, not a height, so the split's `flex-1`/`min-h-0` can only
          bound a column once the column above it has a definite height to divide. Unlike the phone
          it is on at every state — the iPad frame has no state that needs to grow. */}
      <div className={`mx-auto flex min-h-full w-full max-w-5xl flex-col items-center gap-2 md:gap-3 ipad:h-full ${result ? 'max-md:h-full' : ''}`}>
        <header className="flex w-full items-center justify-between gap-4">
          {mission
            ? <BackButton to="/mission" label="Nhiệm vụ" />
            : <BackButton to="/level/story-voice" label="Quay lại" />}
          {/* In a lesson the bậc's own count is the wrong count, and two counters are one too many
              for a child to read — so the mission's position replaces it. */}
          {mission
            ? <Chip tone="coral">{missionNoun(mission.pos, 'Thẻ')} {mission.pos.index}/{mission.pos.total}</Chip>
            : <Chip tone="coral">Đoạn {index + 1}/{STORY_VOICE.length}</Chip>}
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        {/* The iPad split — see `SoundPractice`. `contents` everywhere else, so no other width
            sees a box here; `min-h-0` everywhere here, so a long column scrolls inside itself
            instead of pushing the page past `min-h-full` and taking the mic below the fold. */}
        <div className="contents ipad:flex ipad:min-h-0 ipad:w-full ipad:flex-1 ipad:items-stretch ipad:gap-6">
          {/* LEFT — what the child is learning: the mood badge, the passage and its 🔊, and the
              three things "reading with this feeling" actually means. */}
          <div data-testid="teach-col" className="contents ipad:flex ipad:min-h-0 ipad:min-w-0 ipad:flex-1 ipad:flex-col ipad:justify-center ipad:gap-3">

            {/* The mood is the instruction on this screen — bigger than the passage's own words.
                A phone result folds the whole brief away (mood, passage, translation, tips): the word
                chips below reprint every word of the passage and the mood has already been read, so
                the block would only be repeating itself over the room the CTA needs (§5 M3b). */}
            <section className={`flex flex-col items-center gap-1 ${result ? 'max-md:hidden' : ''}`}>
              <span aria-hidden="true" data-testid="mood-emoji" className="text-[38px] leading-none md:text-[56px]">{passage.emoji}</span>
              <p className="font-display text-lg font-extrabold text-ink-900 md:text-2xl">Đọc với giọng: {passage.moodVi}</p>
            </section>

            <section className={`flex w-full flex-col items-center gap-1.5 md:gap-2 ${result ? 'max-md:hidden' : ''}`}>
              <Passage text={passage.text} />
              <p className="max-w-2xl text-center text-sm font-bold leading-snug text-ink-500 md:text-lg md:leading-7">{passage.vi}</p>
              <Button variant="secondary" onClick={playSample} className={CTA_PHONE}>🔊 Nghe mẫu</Button>
              {audioMissing && <p className="text-sm font-bold text-ink-300 md:text-lg">Chưa có audio mẫu</p>}
            </section>

            {/* Three tips, three lines, 14 px: read once before the attempt and then ignored, so it
              * buys its height back for the mic rather than shouting over the passage. On a phone the
              * card is the design's compact tip block — and the 375×667 rules drop it outright, the
              * one thing on this screen that is genuinely read-once. */}
            <Card className={`flex w-full max-w-2xl flex-col gap-0.5 px-4 py-2 [@media(max-width:767px)_and_(max-height:700px)]:hidden md:px-6 md:py-3 ${result ? 'max-md:hidden' : ''}`}>
              <p className="font-display text-base font-extrabold text-ink-900 md:text-lg">🎭 Gợi ý giọng</p>
              <ul className="flex flex-col">
                {tips.map(tip => (
                  <li key={tip} data-testid="mood-tip" className="text-[13px] font-bold leading-snug text-ink-500 md:text-[14px]">• {tip}</li>
                ))}
              </ul>
            </Card>
          </div>

          {/* RIGHT — what the child does: the mic and its countdown, Foxy, and in the result
              state the score read-out and the CTA row in that same place. */}
          <div data-testid="do-col" className="contents ipad:flex ipad:min-h-0 ipad:w-[400px] ipad:shrink-0 ipad:flex-col ipad:items-center ipad:justify-center ipad:gap-3">

            {result && feedback && stars ? (
              /* On a phone the read-out is a bounded scrolling region with the CTA row as its
                 *sibling* underneath — never a `sticky` overlay, which would paint over whichever
                 word chip happened to sit at its y. A passage is up to fourteen words and fourteen
                 64 px chips cannot be made to fit 844 by shrinking type; what can be guaranteed is
                 that the way on is on screen and nothing is hidden behind anything. `md:contents`
                 takes the wrapper out of the box tree from 768 up, so the landscape frame is the same
                 flat column of the same section it has always been.

                 The iPad column takes the box back (`ipad:` is emitted after `md:`, so it wins),
                 because the same arithmetic applies to a 400 px column as to a phone: fourteen word
                 chips, four score bars and a hint card do not fit 590 px however small the type
                 gets. The read-out scrolls inside its own bounds and the CTA row stays its sibling
                 below — so the way on is always on screen and nothing is behind anything. */
              <section className="flex w-full flex-col items-center gap-2.5 pb-2 max-md:min-h-0 max-md:flex-1 md:w-auto md:gap-4 ipad:min-h-0 ipad:w-full ipad:flex-1 ipad:gap-2.5">
                {stars === 3 && <Confetti />}
                <div data-testid="result-readout" className="flex w-full flex-col items-center gap-2.5 max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto md:contents ipad:flex ipad:min-h-0 ipad:w-full ipad:flex-1 ipad:flex-col ipad:items-center ipad:gap-2.5 ipad:overflow-y-auto">
                  <ProsodyChip score={prosody} engine={engine} />
                  <Stars value={stars} animate={stars === 3} />
                  <p className="font-display text-xl font-extrabold text-ink-900 md:text-3xl">{message}</p>
                  <ScoreBars result={result} />
                  <ScoredWords words={feedback.words} />
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
                      ? <Button size="lg" pulse className={`${CTA_PHONE} max-md:w-full ipad:w-full`} onClick={() => nav(`/voice/${next.id}`)}>Tiếp theo →</Button>
                      : <Button size="lg" pulse className={`${CTA_PHONE} max-md:w-full ipad:w-full`} onClick={() => nav('/level/story-voice')}>Hoàn thành 🎉</Button>}
                </div>
              </section>
            ) : (
              /* 112 px of reserved blank space here was what pushed the mic off a landscape iPad. The
               * countdown state outgrows any reserve anyway, so it only ever padded the idle line.
               * `ipad:flex-none`: in the two-column frame the doing column centres its own group
               * (countdown, Foxy, mic), so a stretching reserve would only push the mic to the
               * bottom edge of the screen. */
              <section className="flex min-h-[64px] flex-1 flex-col items-center justify-center gap-3 max-md:min-h-0 ipad:min-h-0 ipad:flex-none">
                {recording ? (
                  <>
                    <div aria-hidden="true" className="font-display text-[44px] font-extrabold leading-none text-coral-text md:text-[56px]">{secondsLeft}</div>
                    <Foxy mood="listening" size="sm" say="Foxy đang lắng nghe…" />
                  </>
                ) : (
                  <p className="font-display text-base font-extrabold text-ink-900 [@media(max-width:767px)_and_(max-height:700px)]:hidden md:text-2xl">Đọc cả đoạn thật có hồn nhé!</p>
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
