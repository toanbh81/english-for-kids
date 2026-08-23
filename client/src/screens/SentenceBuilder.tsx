import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { shuffleTiles } from '../content/shuffle'

const TAP_TARGET = 'min-h-[64px] min-w-[64px] flex items-center justify-center'
const SHAKE_MS = 400 // matches the .animate-shake keyframe duration in styles.css

const TILE = `px-5 rounded-2xl shadow text-2xl font-extrabold active:scale-95 ${TAP_TARGET}`

export function SentenceBuilder() {
  const { id = '' } = useParams()
  const sentence = findSentence(id)

  if (!sentence) {
    return (
      <main className="p-8">
        <p className="text-2xl mb-4">Không tìm thấy câu</p>
        <Link to="/sentences" className={`text-2xl px-4 ${TAP_TARGET}`}>← Ghép câu</Link>
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

  const index = SENTENCES.findIndex(s => s.id === sentence.id)
  const next = index >= 0 ? SENTENCES[index + 1] : undefined

  const mood: FoxyMood = attempt.micState === 'recording' ? 'listening' : correct ? 'cheer' : 'idle'
  const say = correct ? 'Đúng rồi! 🎉' : wrong ? 'Thử lại nhé' : undefined

  return (
    <main className="h-full flex flex-col items-center justify-between p-6 gap-3 overflow-y-auto">
      <div className="w-full flex justify-between text-xl">
        <Link to="/sentences" className={`${TAP_TARGET} px-4`}>← Ghép câu</Link>
        <span className="text-slate-400">{attempt.engine === 'webspeech' ? 'chế độ đơn giản' : ''}</span>
      </div>

      <p className="text-2xl text-slate-500 text-center">{sentence.vi}</p>

      <div
        data-testid="tray"
        className={`min-h-[80px] w-full max-w-2xl flex flex-wrap gap-3 justify-center items-center rounded-3xl bg-white shadow p-4 ${shaking ? 'animate-shake' : ''}`}
      >
        {trayIndices.map((idx, pos) => (
          <button key={pos} type="button" onClick={() => tapTray(pos)} className={`${TILE} bg-teal text-white`}>
            {sentence.words[idx]}
          </button>
        ))}
      </div>

      <div data-testid="pool" className="w-full max-w-2xl flex flex-wrap gap-3 justify-center">
        {poolIndices.map(idx => (
          <button key={idx} type="button" onClick={() => tapPool(idx)} className={`${TILE} bg-white`}>
            {sentence.words[idx]}
          </button>
        ))}
      </div>

      <Foxy mood={mood} say={say} />

      {correct && (
        <>
          {audioMissing && <p className="text-lg text-slate-400">Chưa có audio mẫu</p>}

          {attempt.error && <p className="text-2xl text-fix">{attempt.error}</p>}

          {feedback && (
            <section className="flex flex-col items-center gap-4">
              <Stars value={feedback.stars} animate={feedback.stars === 3} />
              <p className="text-3xl font-extrabold">{feedback.message}</p>
              {feedback.hint && <HintCard hint={feedback.hint} />}
              <div className="flex gap-4 text-xl flex-wrap justify-center">
                <button onClick={attempt.reset} className={`px-6 rounded-2xl bg-white shadow ${TAP_TARGET}`}>Thử lại</button>
                <button
                  onClick={() => nav(next ? `/sentence/${next.id}` : '/sentences')}
                  className={`px-6 rounded-2xl bg-coral text-white font-extrabold justify-center ${TAP_TARGET}`}
                >
                  Tiếp theo →
                </button>
              </div>
            </section>
          )}

          <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
        </>
      )}
    </main>
  )
}
