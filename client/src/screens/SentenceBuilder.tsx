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
import { useSpeakErrorAction } from '../speaking/useSpeakErrorAction'
import { MicButton, ResultCard, SpeakError } from '../components/speak'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { BackButton, Button, Chip, NotFound } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { shuffleTiles } from '../content/shuffle'

const SHAKE_MS = 400 // matches the .animate-shake keyframe duration in styles.css

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

  if (!sentence) return <NotFound what="câu" to="/sentences" />

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

  const mood: FoxyMood = correct ? 'cheer' : 'idle'
  // The wrong-tray shake bubble — kept outside the mic entirely, since the mic is not even
  // rendered until the sentence is built correctly.
  const say = correct ? 'Đúng rồi! 🎉' : wrong ? 'Thử lại nhé' : undefined

  const onErrorAction = useSpeakErrorAction(attempt)

  /** The building half of the screen — tray, legend, pool. Folded away on a phone once a score is
   * in, where `ScoredWords` is already printing the same sentence. */
  const built = correct && feedback ? 'max-md:hidden' : ''

  return (
    <PageShell gutter="20">
      <PageHeader back={mission ? <BackButton to="/mission" label="Nhiệm vụ" /> : <BackButton to={listTo} label="Ghép câu" />} engine={attempt.engine}>
        {mission && (
          <Chip tone="teal">
            {missionNoun(mission.pos, 'Câu')} {mission.pos.index}/{mission.pos.total}
          </Chip>
        )}
      </PageHeader>
      <PageBody split={{
        teach: (
          <div className="flex w-full flex-col items-center gap-2.5 md:gap-4">
            <h1 className="font-display text-[24px] font-extrabold leading-tight text-ink-900 md:text-[28px]">Ghép câu nào! 🧱</h1>
            <p className="text-center text-base font-bold text-ink-500 md:text-lg">{sentence.vi}</p>
            {!correct && <p className="text-center text-[13px] font-bold text-ink-500 md:text-base">Chạm các khối từ để xếp vào khay câu</p>}

            <div className={`relative w-full max-w-2xl ${built}`}>
              <div
                data-testid="tray"
                className={`flex min-h-[76px] flex-wrap items-center justify-center gap-2 rounded-[24px] border-[3px] border-dashed border-line-200 bg-white p-2.5 md:min-h-[88px] md:gap-3 md:p-4 ${shaking ? 'animate-shake' : ''}`}
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

            <div className={`flex flex-wrap justify-center gap-2 md:gap-3 ${built}`}>
              {LEGEND.map(l => (
                <span key={l.role} className={`rounded-xl2 border-[3px] px-2.5 py-1 font-display text-[13px] font-extrabold text-ink-500 md:px-4 md:text-base ${ROLE_TILE[l.role]}`}>
                  {l.label}
                </span>
              ))}
            </div>

            <div data-testid="pool" className={`flex w-full max-w-2xl flex-wrap justify-center gap-2.5 md:gap-4 ${built}`}>
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
          </div>
        ),
        act: correct ? (
          feedback ? (
            <ResultCard
              stars={feedback.stars}
              praise={feedback.message}
              score={attempt.result?.overall}
              words={feedback.words}
              bars={attempt.result ?? undefined}
              hint={feedback.hint}
              onRetry={() => attempt.reset()}
              primary={{ label: mission ? mission.label : 'Tiếp theo →', onClick: goNext }}
              animate={feedback.stars === 3}
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              {audioMissing && <p className="text-sm font-bold text-ink-300 md:text-lg">Chưa có audio mẫu</p>}
              <Button variant="outline" onClick={playSample}>🔊 Đọc câu cho bé nghe</Button>
              {attempt.error && <SpeakError error={attempt.error} onAction={onErrorAction} onDismiss={attempt.dismissError} />}
              <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
              <Foxy mood={mood} size="sm" say={say} />
            </div>
          )
        ) : (
          <Foxy mood={mood} size="sm" say={say} />
        ),
      }} />
    </PageShell>
  )
}
