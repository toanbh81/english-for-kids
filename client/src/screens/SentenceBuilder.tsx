import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Sentence } from '../content'
import { SENTENCES, findSentence } from '../content'
import type { PronunciationResult } from '../scoring/types'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { missionNoun, useMissionNext } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { playUrl } from '../audio/player'
import { toFeedback } from '../scoring/feedback'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { MicButton } from '../components/MicButton'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { HintCard } from '../components/HintCard'
import { Stars } from '../components/Stars'
import { ScoredWords } from '../components/ScoredWords'
import { ScoreBars } from '../components/ScoreBars'
import { BackButton, Button, Chip, PAGE_SHELL } from '../components/ui'
import { shuffleTiles } from '../content/shuffle'

const SHAKE_MS = 400 // matches the .animate-shake keyframe duration in styles.css

/**
 * The phone layout of 🧱 Ghép câu, built to `SoundPractice.tsx`'s idiom (read the comment block at
 * the top of that file first): **phone rules sit at the default breakpoint and `md:` (768) puts
 * the exact previous value back**, so 1194×834 renders byte-for-byte as it did. `max-md:` appears
 * only where a shared primitive (`Button`) writes the class itself, or to fold a whole block away
 * below 768.
 *
 * What the screen had to give up, and why. At 390×844 it stood 806 px tall while the child built
 * the sentence and **1470 px** once it had been scored — "Tiếp theo →" landed at y1070, 226 px past
 * the fold, with nothing on screen suggesting there was anything to scroll to. The result state is
 * where all of that height was: the tray, the colour legend and the (by then empty) tile pool sat
 * above a stack of stars, message, scored words, tip and four score bars.
 *
 * So on a phone the scored state folds the building half away. It is not information lost:
 * `ScoredWords` prints the very same sentence, word for word, tinted by how each word was said —
 * it *is* the tray, with the score on top — and the legend and the empty pool have nothing left to
 * say once every tile has been placed. The mic goes with them, exactly as the sound screen's does
 * (design §5 M3b, "ở M3b, mic biến mất"); "Thử lại" is the way back to recording and brings it
 * along. That leaves the two CTAs as the bottom row, pushed onto the frame's bottom edge by
 * `mt-auto` — never `sticky bottom-0`, which would ride up over the words behind it.
 */
const CTA_PHONE = 'max-md:min-h-[64px] max-md:px-4 max-md:text-lg'

const TILE =
  'flex min-h-[64px] min-w-[64px] items-center justify-center rounded-xl2 border-[3px] px-3 font-display text-[21px] font-extrabold text-ink-900 transition-transform active:scale-95 md:px-5 md:text-[26px]'

/** The three sentence roles, keyed by which third of the sentence a tile belongs to. Colours are
 * written out per role (never concatenated) so Tailwind keeps them in the build. */
type Role = 'who' | 'doing' | 'thing'
const ROLE_TILE: Record<Role, string> = {
  who: 'bg-sky-400/30 border-sky-400',
  doing: 'bg-peach-400/30 border-peach-400',
  thing: 'bg-sun-400/40 border-sun-400',
}
const LEGEND: { role: Role; label: string }[] = [
  { role: 'who', label: '🟦 Ai?' },
  { role: 'doing', label: '🟧 Làm gì?' },
  { role: 'thing', label: '🟨 Cái gì?' },
]

/** A tile keeps its colour wherever it sits, so the role comes from the word's place in the
 * target sentence — not from where the child has put it. */
function roleOf(index: number, total: number): Role {
  if (index < total / 3) return 'who'
  if (index < (total * 2) / 3) return 'doing'
  return 'thing'
}

export function SentenceBuilder() {
  const { id = '' } = useParams()
  const sentence = findSentence(id)

  if (!sentence) {
    return (
      <main className={`h-full overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}>
        <p className="mb-4 font-display text-2xl font-extrabold text-ink-900">Không tìm thấy câu</p>
        <BackButton to="/sentences" label="Ghép câu" />
      </main>
    )
  }

  // Keying on the sentence id remounts the inner component on navigation, resetting the tray/tile
  // state for free instead of needing a synchronizing effect.
  return <SentenceBuilderInner key={sentence.id} sentence={sentence} />
}

function SentenceBuilderInner({ sentence }: { sentence: Sentence }) {
  const nav = useNavigate()
  // Null unless the child arrived from the mission: only then is this sentence step "Câu 2/2" of
  // today's lesson rather than one sentence of a topic list (spec §3).
  const mission = useMissionNext()
  const [trayIndices, setTrayIndices] = useState<number[]>([])
  const [shaking, setShaking] = useState(false)
  const [audioMissing, setAudioMissing] = useState(false)
  const shakeTimerRef = useRef<number | null>(null)

  const target = sentence.words.join(' ')
  const full = trayIndices.length === sentence.words.length
  const correct = full && trayIndices.every((idx, pos) => idx === pos)
  const wrong = full && !correct

  // Tile display order is shuffled once per sentence, but tiles keep their identity as an index
  // into sentence.words — this is what lets the tray/pool logic tell duplicate words apart.
  // Memoized on the sentence id so it is computed once per mount rather than every render (the
  // inner component is already remounted — and re-seeded — whenever the id changes).
  const order = useMemo(
    () => shuffleTiles(sentence.words.map((_, i) => i), sentence.id),
    [sentence.id, sentence.words],
  )
  const poolIndices = order.filter(i => !trayIndices.includes(i))

  useEffect(() => {
    if (!wrong) return
    setShaking(true)
    shakeTimerRef.current = window.setTimeout(() => {
      setShaking(false)
      setTrayIndices([])
      shakeTimerRef.current = null
    }, SHAKE_MS)
    return () => {
      if (shakeTimerRef.current) { clearTimeout(shakeTimerRef.current); shakeTimerRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrong])

  useEffect(() => {
    if (!correct) return
    // Sample audio is generated locally and may simply not be there yet — say so, never throw.
    // `alive` guards against setting state after this effect's owner has unmounted or moved on
    // (e.g. a fast "Tiếp theo" tap), which would otherwise log a stray act() warning in tests.
    let alive = true
    playUrl(sentence.audio).then(
      () => { if (alive) setAudioMissing(false) },
      () => { if (alive) setAudioMissing(true) },
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correct])

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    const fb = toFeedback(result)
    setStars(`sentence:${sentence.id}`, fb.stars)
    const ts = Date.now()
    logActivity({ ts, kind: 'sentence', id: sentence.id, score: result.overall, phonemes: result.words.flatMap(w => w.phonemes) })
    // Timestamped id: keying on the sentence alone overwrote the previous take of the same
    // sentence, so the "last 20 recordings" list silently held fewer than 20.
    if (blob) saveRecording({ id: `${sentence.id}:${ts}`, ts, text: target, blob }).catch(() => {})
  }

  // Called unconditionally on every render regardless of tray state, so hooks stay unconditional —
  // the mic UI just stays hidden until `correct` is true.
  const attempt = useSpeakingAttempt({ targetText: target, resetKey: sentence.id, onResult: handleResult })
  const feedback = attempt.result ? toFeedback(attempt.result) : null

  function tapPool(idx: number) {
    if (wrong) return
    setTrayIndices(prev => [...prev, idx])
  }
  function tapTray(pos: number) {
    if (wrong) return
    setTrayIndices(prev => prev.filter((_, i) => i !== pos))
  }
  function playSample() {
    playUrl(sentence.audio).then(() => setAudioMissing(false), () => setAudioMissing(true))
  }

  const index = SENTENCES.findIndex(s => s.id === sentence.id)
  const next = index >= 0 ? SENTENCES[index + 1] : undefined
  const total = sentence.words.length
  // Both ways out keep the topic: the unfiltered list only shows unlocked topics now, so dropping
  // the filter would land the child on a different topic's sentences than the one they came from.
  const listTo = `/sentences?topic=${sentence.topic}`
  /** In a lesson the list order is not the child's path — the next step of today's mission is,
   * and the mission screen is where a finished lesson celebrates. */
  function goNext() {
    if (mission) mission.go()
    else nav(next ? `/sentence/${next.id}` : listTo)
  }

  const mood: FoxyMood = attempt.micState === 'recording' ? 'listening' : correct ? 'cheer' : 'idle'
  const say = correct ? 'Đúng rồi! 🎉' : wrong ? 'Thử lại nhé' : undefined

  /** The building half of the screen — tray, legend, pool. Folded away on a phone once a score is
   * in, where `ScoredWords` is already printing the same sentence (see the note at the top). */
  const built = correct && feedback ? 'max-md:hidden' : ''

  return (
    // 20 px of side frame on a phone (design §1, the speak-frame family), the 24 px this screen has
    // always had from the tablet breakpoint up. The safe-area shell rests on the 1.25 rem of the
    // old `py-5`, so with no notch to clear — iPad, desktop, jsdom — the vertical padding is
    // unchanged; on an iPhone it is what keeps the header out from under the notch.
    <main className={`h-full overflow-y-auto bg-cream-50 px-5 [--page-pad-bottom:1.25rem] [--page-pad-top:1.25rem] md:px-6 ${PAGE_SHELL}`}>
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center gap-2.5 md:gap-4">
        <header className="flex w-full items-center justify-between gap-4">
          {mission
            ? <BackButton to="/mission" label="Nhiệm vụ" />
            : <BackButton to={listTo} label="Ghép câu" />}
          {/* The column only exists to seat the mission chip above the title; free play keeps the
              plain centred block it always had. */}
          <div className={mission ? 'flex flex-col items-center text-center' : 'text-center'}>
            {mission && (
              <Chip tone="teal">
                {missionNoun(mission.pos, 'Câu')} {mission.pos.index}/{mission.pos.total}
              </Chip>
            )}
            <h1 className="font-display text-[24px] font-extrabold leading-tight text-ink-900 md:text-[36px]">Ghép câu nào! 🧱</h1>
            {/* The line that teaches the gesture, dropped once the sentence is built — by then the
                child has done the thing it describes — and at 375×667, where the tiles below say
                the same thing by being obviously tappable. Untouched from 768 up. */}
            <p className={`mt-1 text-[13px] font-bold leading-snug text-ink-500 [@media(max-width:767px)_and_(max-height:700px)]:hidden md:text-lg ${correct ? 'max-md:hidden' : ''}`}>
              Chạm các khối từ để xếp vào khay câu
            </p>
          </div>
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {attempt.engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        <p className="text-center text-base font-bold text-ink-500 md:text-xl">{sentence.vi}</p>

        {/* The placeholder lives outside the tray so the tray's children stay tiles-only. */}
        <div className={`relative w-full max-w-3xl ${built}`}>
          <div
            data-testid="tray"
            className={`flex min-h-[76px] flex-wrap items-center justify-center gap-2 rounded-[24px] border-[3px] border-dashed border-line-200 bg-white p-2.5 md:min-h-[96px] md:gap-3 md:p-4 ${shaking ? 'animate-shake' : ''}`}
          >
            {trayIndices.map((idx, pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => tapTray(pos)}
                className={`${TILE} ${ROLE_TILE[roleOf(idx, total)]}`}
              >
                {sentence.words[idx]}
              </button>
            ))}
          </div>
          {trayIndices.length === 0 && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-base font-extrabold text-ink-300 md:text-xl">
              thả vào đây
            </span>
          )}
        </div>

        {/* The colour key. It only helps while there are tiles to place, so on a phone it goes with
            them — and on a 667 screen it goes one step earlier, as soon as the sentence is right:
            the three colours are already sitting in the tray, in order, which is the lesson. */}
        <div className={`flex flex-wrap justify-center gap-2 md:gap-3 ${built} ${correct ? '[@media(max-width:767px)_and_(max-height:700px)]:hidden' : ''}`}>
          {LEGEND.map(l => (
            <span key={l.role} className={`rounded-xl2 border-[3px] px-2.5 py-1 font-display text-[13px] font-extrabold text-ink-500 md:px-4 md:text-base ${ROLE_TILE[l.role]}`}>
              {l.label}
            </span>
          ))}
        </div>

        <div data-testid="pool" className={`flex w-full max-w-3xl flex-wrap justify-center gap-2.5 md:gap-4 ${built}`}>
          {poolIndices.map(idx => (
            <button
              key={idx}
              type="button"
              onClick={() => tapPool(idx)}
              className={`${TILE} ${ROLE_TILE[roleOf(idx, total)]}`}
            >
              {sentence.words[idx]}
            </button>
          ))}
        </div>

        {correct ? (
          <>
            {audioMissing && <p className="text-sm font-bold text-ink-300 md:text-lg">Chưa có audio mẫu</p>}

            {attempt.error && <p className="font-display text-lg font-extrabold text-fix-700 md:text-2xl">{attempt.error}</p>}

            {feedback && (
              /* `flex-1` below 768 only: the section takes the free height so its CTA row can sit
                 on the bottom edge of the frame. From 768 up it is the same content-height block
                 it has always been. */
              <section className="flex w-full flex-col items-center gap-2 max-md:flex-1 md:w-auto md:gap-4">
                <Stars value={feedback.stars} animate={feedback.stars === 3} />
                <p className="text-center font-display text-lg font-extrabold text-ink-900 md:text-3xl">{feedback.message}</p>
                <ScoredWords words={feedback.words} onWordTap={playSample} />
                {feedback.hint && <HintCard hint={feedback.hint} />}
                {/* Four bars are the least actionable thing on the screen and the first to go on a
                    667 phone, where the tip above them is what tells the child what to do next. */}
                <div className="contents [@media(max-width:767px)_and_(max-height:700px)]:hidden">
                  {attempt.result && <ScoreBars result={attempt.result} />}
                </div>
                <div className="flex w-full flex-wrap justify-center gap-3 pt-1 max-md:mt-auto md:w-auto md:gap-4 md:pt-0">
                  <Button variant="outline" className={`${CTA_PHONE} max-md:flex-1`} onClick={attempt.reset}>Thử lại</Button>
                  <Button size="lg" pulse className={`${CTA_PHONE} max-md:flex-[1.35]`} onClick={goNext}>
                    {mission ? mission.label : 'Tiếp theo →'}
                  </Button>
                </div>
              </section>
            )}

            {/* The speaking row. On a phone it is a column pushed to the bottom edge — listen,
                then the mic, then Foxy — and it is gone once a score is in, where "Thử lại" is
                what brings it back. From 768 up it is the one landscape row it has always been. */}
            <div className={`mt-auto flex w-full flex-col flex-wrap items-center justify-center gap-2 pb-2 md:mt-0 md:w-auto md:flex-row md:items-end md:gap-6 ${feedback ? 'max-md:hidden' : ''}`}>
              <Button variant="outline" className={CTA_PHONE} onClick={playSample}>🔊 Đọc câu cho bé nghe</Button>
              <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
              <Foxy mood={mood} size="sm" say={say} />
            </div>
          </>
        ) : (
          <Foxy mood={mood} size="sm" say={say} />
        )}
      </div>
    </main>
  )
}
