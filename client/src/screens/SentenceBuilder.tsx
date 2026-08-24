import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Sentence } from '../content'
import { SENTENCES, findSentence } from '../content'
import type { PronunciationResult } from '../scoring/types'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
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
import { BackButton, Button } from '../components/ui'
import { shuffleTiles } from '../content/shuffle'

const SHAKE_MS = 400 // matches the .animate-shake keyframe duration in styles.css

const TILE =
  'flex min-h-[64px] min-w-[64px] items-center justify-center rounded-xl2 border-[3px] px-5 font-display text-[26px] font-extrabold text-ink-900 transition-transform active:scale-95'

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
      <main className="h-full overflow-y-auto bg-cream-50 p-6">
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

  const mood: FoxyMood = attempt.micState === 'recording' ? 'listening' : correct ? 'cheer' : 'idle'
  const say = correct ? 'Đúng rồi! 🎉' : wrong ? 'Thử lại nhé' : undefined

  return (
    <main className="h-full overflow-y-auto bg-cream-50 px-6 py-5">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center gap-4">
        <header className="flex w-full items-center justify-between gap-4">
          <BackButton to={listTo} label="Ghép câu" />
          <div className="text-center">
            <h1 className="font-display text-[36px] font-extrabold leading-tight text-ink-900">Ghép câu nào! 🧱</h1>
            <p className="mt-1 text-lg font-bold text-ink-500">Chạm các khối từ để xếp vào khay câu</p>
          </div>
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {attempt.engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        <p className="text-center text-xl font-bold text-ink-500">{sentence.vi}</p>

        {/* The placeholder lives outside the tray so the tray's children stay tiles-only. */}
        <div className="relative w-full max-w-3xl">
          <div
            data-testid="tray"
            className={`flex min-h-[96px] flex-wrap items-center justify-center gap-3 rounded-[24px] border-[3px] border-dashed border-line-200 bg-white p-4 ${shaking ? 'animate-shake' : ''}`}
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
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-xl font-extrabold text-ink-300">
              thả vào đây
            </span>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {LEGEND.map(l => (
            <span key={l.role} className={`rounded-xl2 border-[3px] px-4 py-1 font-display text-base font-extrabold text-ink-500 ${ROLE_TILE[l.role]}`}>
              {l.label}
            </span>
          ))}
        </div>

        <div data-testid="pool" className="flex w-full max-w-3xl flex-wrap justify-center gap-4">
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
            {audioMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}

            {attempt.error && <p className="font-display text-2xl font-extrabold text-fix-700">{attempt.error}</p>}

            {feedback && (
              <section className="flex flex-col items-center gap-4">
                <Stars value={feedback.stars} animate={feedback.stars === 3} />
                <p className="font-display text-3xl font-extrabold text-ink-900">{feedback.message}</p>
                <ScoredWords words={feedback.words} onWordTap={playSample} />
                {feedback.hint && <HintCard hint={feedback.hint} />}
                {attempt.result && <ScoreBars result={attempt.result} />}
                <div className="flex flex-wrap justify-center gap-4">
                  <Button variant="outline" onClick={attempt.reset}>Thử lại</Button>
                  <Button size="lg" pulse onClick={() => nav(next ? `/sentence/${next.id}` : listTo)}>
                    Tiếp theo →
                  </Button>
                </div>
              </section>
            )}

            <div className="flex flex-wrap items-end justify-center gap-6 pb-2">
              <Button variant="outline" onClick={playSample}>🔊 Đọc câu cho bé nghe</Button>
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
