import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Word } from '../content/words/types'
import type { PronunciationResult } from '../scoring/types'
import { findTopic, findWord } from '../content/words'
import { getBox, promote, demote, dueWords } from '../progress/leitner'
import { logActivity } from '../progress/activity'
import { saveRecording } from '../progress/recordings'
import { playUrl } from '../audio/player'
import { toFeedback } from '../scoring/feedback'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { MicButton } from '../components/MicButton'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { HintCard } from '../components/HintCard'

const TAP_TARGET = 'min-h-[64px] min-w-[64px] flex items-center'
const UNLOCK_SCORE = 60

export function WordCard() {
  const { topic = '', wordId = '' } = useParams()
  const word = findWord(wordId)

  if (!word) {
    return (
      <main className="p-8">
        <p className="text-2xl mb-4">Không tìm thấy từ</p>
        <Link to="/words" className={`text-2xl px-4 ${TAP_TARGET}`}>← Từ vựng</Link>
      </main>
    )
  }

  const isReview = topic === 'review'
  const list: Word[] = isReview
    ? dueWords().map(findWord).filter((w): w is Word => !!w)
    : (findTopic(topic)?.words ?? [word])

  // Keying on the word id remounts the inner component on navigation, which resets its local
  // flip/outcome state for free instead of needing a synchronizing effect.
  return <WordCardInner key={word.id} word={word} topic={topic} isReview={isReview} list={list} />
}

function WordCardInner({ word, topic, isReview, list }: { word: Word; topic: string; isReview: boolean; list: Word[] }) {
  const nav = useNavigate()
  const [flipped, setFlipped] = useState(false)
  const [audioMissing, setAudioMissing] = useState(false)
  const [outcome, setOutcome] = useState<'unlocked' | 'retry' | null>(null)

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    if (result.overall >= UNLOCK_SCORE) {
      promote(word.id)
      setOutcome('unlocked')
    } else {
      if (getBox(word.id) > 0) demote(word.id)
      setOutcome('retry')
    }
    const ts = Date.now()
    logActivity({ ts, kind: 'word', id: word.id, score: result.overall, phonemes: result.words.flatMap(w => w.phonemes) })
    // Timestamped id: keying on the word alone overwrote the previous take of the same word, so
    // the "last 20 recordings" list silently held fewer than 20.
    if (blob) saveRecording({ id: `${word.id}:${ts}`, ts, text: word.word, blob }).catch(() => {})
  }

  const attempt = useSpeakingAttempt({ targetText: word.word, resetKey: word.id, onResult: handleResult })
  const feedback = useMemo(() => (attempt.result ? toFeedback(attempt.result) : null), [attempt.result])

  const index = list.findIndex(w => w.id === word.id)
  const next = index >= 0 ? list[index + 1] : undefined
  const backTo = isReview ? '/words/review' : `/words/${topic}`

  /** The outcome banner belongs to this attempt, so clear it with the attempt — otherwise
   * "🔓 Mở khoá!" stays on screen while the child records again. */
  function retry() {
    attempt.reset()
    setOutcome(null)
  }

  /** Sample audio is generated locally and may simply not be there yet — say so, never throw. */
  function playSample() {
    playUrl(word.audio).then(() => setAudioMissing(false), () => setAudioMissing(true))
  }

  const mood: FoxyMood = attempt.micState === 'recording'
    ? 'listening'
    : outcome === 'unlocked' ? 'cheer' : 'idle'
  const say = outcome === 'unlocked' ? '🔓 Mở khoá!' : outcome === 'retry' ? 'Thử lại nhé' : undefined

  return (
    <main className="h-full overflow-y-auto flex flex-col items-center p-6 gap-4">
      <div className="w-full flex justify-between text-xl">
        <Link to={backTo} className={`${TAP_TARGET} px-4`}>← {isReview ? 'Ôn tập' : 'Từ vựng'}</Link>
        <span className="text-slate-400">{attempt.engine === 'webspeech' ? 'chế độ đơn giản' : ''}</span>
      </div>

      <button
        type="button"
        aria-label="Lật thẻ"
        onClick={() => setFlipped(f => !f)}
        className="rounded-3xl bg-white shadow p-8 flex flex-col items-center justify-center gap-2 active:scale-95 min-w-[260px] min-h-[260px]"
      >
        {!flipped ? (
          <>
            <span className="text-8xl">{word.emoji}</span>
            <span className="text-5xl font-extrabold">{word.word}</span>
            <span className="text-2xl text-slate-500">{word.ipa}</span>
          </>
        ) : (
          <>
            <span className="text-4xl font-extrabold text-center">{word.vi}</span>
            <span className="text-2xl text-slate-500 text-center">{word.example}</span>
          </>
        )}
      </button>

      <div className="flex flex-col items-center gap-1">
        <button onClick={playSample} className="w-16 h-16 rounded-full bg-teal text-white text-3xl active:scale-95">🔊</button>
        {audioMissing && <p className="text-lg text-slate-400">Chưa có audio mẫu</p>}
      </div>

      <Foxy mood={mood} say={say} />

      {attempt.error && <p className="text-2xl text-fix">{attempt.error}</p>}

      {outcome === 'retry' && feedback?.hint && <HintCard hint={feedback.hint} />}

      {outcome && (
        <div className="flex gap-4 text-xl flex-wrap justify-center">
          <button onClick={retry} className={`px-6 rounded-2xl bg-white shadow ${TAP_TARGET}`}>Thử lại</button>
          <button
            onClick={() => nav(next ? `/words/${topic}/${next.id}` : backTo)}
            className={`px-6 rounded-2xl bg-coral text-white font-extrabold justify-center ${TAP_TARGET}`}
          >
            Tiếp theo →
          </button>
        </div>
      )}

      <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
    </main>
  )
}
