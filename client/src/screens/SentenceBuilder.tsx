import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Sentence } from '../content'
import { SENTENCES, findSentence } from '../content'
import type { PronunciationResult } from '../scoring/types'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { missionNoun, useMissionNext } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { playBlob, playUrl } from '../audio/player'
import { toFeedback } from '../scoring/feedback'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { useSpeakErrorAction } from '../speaking/useSpeakErrorAction'
import { MicButton, ResultCard, SpeakError, SpeakPrompt } from '../components/speak'
import { ScoredWords } from '../components/ScoredWords'
import { BackButton, Button, Chip, NotFound } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { shuffleTiles } from '../content/shuffle'

const SHAKE_MS = 400 // matches the .animate-shake keyframe duration in styles.css
/** The hook stops the recording itself after this long; the countdown just mirrors it. */
const AUTO_STOP_MS = 6000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

/** Brief §2 C9, task 11: 44 min-width on a phone, 56 from md. */
const TILE =
  'flex h-11 min-w-[44px] items-center justify-center rounded-r12 border-[3px] px-3 font-display text-[17px] font-extrabold transition-transform active:scale-95 md:h-14 md:rounded-r14 md:px-5 md:text-[22px]'

/** The three sentence roles, keyed by which third of the sentence a tile belongs to. Colours are
 * written out per role (never concatenated) so Tailwind keeps them in the build — verbatim from
 * the brief, background/border/text together. */
type Role = 'who' | 'doing' | 'thing'
const ROLE_TILE: Record<Role, string> = {
  who: 'bg-[#DDF0FB] border-[#7EC8F2] text-[#2E6F9E]',
  doing: 'bg-[#FFE7D2] border-[#FF9A62] text-[#B85E2A]',
  thing: 'bg-[#FFF1C9] border-[#FFC533] text-[#9A6B00]',
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
  const [searchParams] = useSearchParams()
  // `?topic=<id>` only ever arrives from a topic's own sentence list — a child stepping through
  // that list stays inside it: numbering, "Tiếp theo" and the way out all count inside the topic
  // instead of the flat SENTENCES order (spec brief R20).
  const topicParam = searchParams.get('topic')
  // Null unless the child arrived from the mission: only then is this sentence step "Câu 2/2" of
  // today's lesson rather than one sentence of a topic list (spec §3).
  const mission = useMissionNext()
  const [trayIndices, setTrayIndices] = useState<number[]>([])
  const [shaking, setShaking] = useState(false)
  const [audioMissing, setAudioMissing] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_FROM)
  const shakeTimerRef = useRef<number | null>(null)

  const target = sentence.words.join(' ')
  const full = trayIndices.length === sentence.words.length
  const correct = full && trayIndices.every((idx, pos) => idx === pos)
  const wrong = full && !correct

  // Tile display order is shuffled once per sentence, but tiles keep their identity as an index
  // into sentence.words — this is what lets the tray/pool logic tell duplicate words apart.
  const order = shuffleTiles(sentence.words.map((_, i) => i), sentence.id)
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
  const attempt = useSpeakingAttempt({ targetText: target, autoStopMs: AUTO_STOP_MS, resetKey: sentence.id, onResult: handleResult })
  const feedback = attempt.result ? toFeedback(attempt.result) : null

  // `?fixture=result3`/`result1` (`useSpeakingAttempt`'s own DEV-only shortcut) can land a scored
  // attempt before the tray was ever built by hand — a real result can never exist before the mic
  // even renders (it only shows once `correct`), so this only ever fires for that shortcut. Without
  // it the tray would keep showing its unbuilt tiles/pool/legend right next to a `ResultCard`
  // nobody earned by building anything, which is exactly the mixed state a fixture must not produce.
  useEffect(() => {
    if (attempt.result && !correct) setTrayIndices(sentence.words.map((_, i) => i))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.result])

  // The countdown only exists while the mic is open: it restarts on every recording and the
  // interval is cleared the moment the state changes (or the screen unmounts).
  const recording = attempt.micState === 'recording'
  useEffect(() => {
    if (!recording) return
    setSecondsLeft(COUNTDOWN_FROM)
    const id = window.setInterval(() => setSecondsLeft(s => (s > 1 ? s - 1 : 1)), 1000)
    return () => clearInterval(id)
  }, [recording])

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

  const flatIndex = SENTENCES.findIndex(s => s.id === sentence.id)
  const flatNext = flatIndex >= 0 ? SENTENCES[flatIndex + 1] : undefined
  const topicList = SENTENCES.filter(s => s.topic === sentence.topic)
  const topicIndex = topicList.findIndex(s => s.id === sentence.id)
  const topicNext = topicList[topicIndex + 1]
  const total = sentence.words.length
  // Both ways out keep the topic: the unfiltered list only shows unlocked topics now, so dropping
  // the filter would land the child on a different topic's sentences than the one they came from.
  const listTo = `/sentences?topic=${sentence.topic}`
  /** In a lesson the list order is not the child's path — the next step of today's mission is,
   * and the mission screen is where a finished lesson celebrates. Outside a lesson, a child who
   * arrived from a topic's own list (`?topic=`) stays inside that topic; one who arrived from the
   * flat index keeps stepping through it (spec brief R20). */
  function goNext() {
    if (mission) { mission.go(); return }
    if (topicParam) nav(topicNext ? `/sentence/${topicNext.id}?topic=${topicParam}` : listTo)
    else nav(flatNext ? `/sentence/${flatNext.id}` : listTo)
  }

  const onErrorAction = useSpeakErrorAction(attempt)

  return (
    <PageShell gutter="20">
      <PageHeader
        back={mission ? <BackButton to="/mission" label="Nhiệm vụ" /> : <BackButton to={listTo} label="Ghép câu" />}
        engine={attempt.engine}
        dimmed={recording}
      >
        {recording
          ? <Chip tone="coral">● Đang ghi</Chip>
          : mission
            ? <Chip tone="teal">{missionNoun(mission.pos, 'Câu')} {mission.pos.index}/{mission.pos.total}</Chip>
            : <Chip tone="teal">Câu {(topicParam ? topicIndex : flatIndex) + 1}/{(topicParam ? topicList : SENTENCES).length}</Chip>}
      </PageHeader>
      <PageBody
        actGrow={!!feedback}
        split={{
          teach: (
            <div className="flex w-full flex-col items-center gap-2.5 md:gap-4">
              <p className="text-center text-[15px] font-bold text-ink-500 md:text-[22px]">{sentence.vi}</p>
              {!correct && <p className="text-center text-[13px] font-bold text-ink-500 md:text-base">Chạm các khối từ để xếp vào khay câu</p>}

              <div
                data-testid="tray"
                className={`relative flex min-h-[76px] w-full flex-wrap items-center justify-center gap-2 rounded-r18 border-[3px] border-dashed border-line-200 bg-white p-2.5 md:min-h-[96px] md:max-w-[640px] md:gap-3 md:rounded-r22 md:p-4 ${shaking ? 'animate-shake border-fix-300' : ''}`}
              >
                {feedback ? (
                  <ScoredWords words={feedback.words} />
                ) : (
                  trayIndices.map((idx, pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => tapTray(pos)}
                      className={`${TILE} ${ROLE_TILE[roleOf(idx, total)]}`}
                    >
                      {sentence.words[idx]}
                    </button>
                  ))
                )}
                {trayIndices.length === 0 && !feedback && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-[13px] font-extrabold text-ink-300">
                    thả vào đây
                  </span>
                )}
              </div>

              {!correct && trayIndices.length > 0 && !full && (
                <p className="text-center text-[13px] font-bold text-ink-500">Còn {total - trayIndices.length} ô nữa</p>
              )}
              {wrong && (
                <p className="text-center text-[15px] font-bold text-fix-700">🦊 Chưa đúng — thử lại nhé</p>
              )}

              {!correct && (
                <>
                  <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                    {LEGEND.map(l => (
                      <span key={l.role} className={`rounded-xl2 border-[3px] px-2.5 py-1 font-display text-[11px] font-extrabold md:px-4 md:text-sm ${ROLE_TILE[l.role]}`}>
                        {l.label}
                      </span>
                    ))}
                  </div>

                  <div data-testid="pool" className="flex w-full max-w-2xl flex-wrap justify-center gap-2.5 md:gap-4">
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
                </>
              )}

              {correct && !feedback && (
                <>
                  <div className="flex w-full items-center justify-center gap-2 rounded-r12 bg-good-50 px-3.5 py-2 text-center text-[13px] font-bold text-good-700">
                    Đúng rồi! 🎉
                  </div>
                  <Button variant="outline" onClick={playSample}>🔊 Đọc câu cho bé nghe</Button>
                  {audioMissing && <p className="text-sm font-bold text-ink-300 md:text-lg">Chưa có audio mẫu</p>}
                </>
              )}
            </div>
          ),
          act: feedback ? (
            <ResultCard
              stars={feedback.stars}
              praise={feedback.message}
              score={attempt.result?.overall}
              bars={attempt.result ?? undefined}
              hint={feedback.hint}
              canReplay={!!attempt.lastBlob}
              onReplay={() => playBlob(attempt.lastBlob!).catch(() => {})}
              onSample={playSample}
              onRetry={() => attempt.reset()}
              primary={{ label: mission ? mission.label : 'Tiếp theo →', onClick: goNext }}
              animate={feedback.stars === 3}
              fox={{
                mood: feedback.stars === 3 ? 'cheer' : feedback.stars === 2 ? 'happy' : 'idle',
                say: feedback.stars === 3 ? 'Foxy: "Ghép câu và đọc siêu đỉnh!"' : feedback.stars === 2 ? 'Foxy: "Gần chuẩn rồi đó!"' : 'Foxy: "Luyện thêm chút nữa nhé!"',
              }}
            />
          ) : correct ? (
            <>
              <SpeakPrompt mood={recording ? 'listening' : 'cheer'} say={recording ? 'Foxy đang lắng nghe…' : 'Đúng rồi! Giờ đọc câu lên nhé'} />
              {attempt.error && <SpeakError error={attempt.error} onAction={onErrorAction} onDismiss={attempt.dismissError} />}
              <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} secondsLeft={recording ? secondsLeft : undefined} />
            </>
          ) : (
            // R19: on iPad the mic sits in the act column from the very start, disabled until the
            // tray is correct — a phone shows nothing here (design does not draw it), matching the
            // mic-only-after-`correct` behaviour it already had.
            <div className="hidden md:flex md:flex-col md:items-center md:gap-2">
              <MicButton state="disabled" level={0} onPress={() => {}} caption="Xếp đúng câu trước nhé" />
            </div>
          ),
        }}
      />
    </PageShell>
  )
}
