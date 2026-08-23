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
import { saveRecording } from '../progress/recordings'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { ScoredWords } from '../components/ScoredWords'
import { ScoreBars } from '../components/ScoreBars'
import { ProsodyChip } from '../components/ProsodyChip'
import { HintCard } from '../components/HintCard'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Card, Chip } from '../components/ui'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'

/** Passages run 2–3 sentences read *slowly, with feeling*, so the mic stays open longer here than
 * anywhere else: at 10 s a careful reader was still mid-passage when it closed, and the unsaid
 * half scored as incomplete. 13 s covers the longest passage with room to breathe. */
const AUTO_STOP_MS = 13000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

/** What "reading with this feeling" actually means, in three things a child can do on purpose.
 * Each mood gets its own three: the card is the only coaching before the attempt. */
const MOOD_TIPS: Record<VoicePassage['mood'], string[]> = {
  happy: [
    'Mỉm cười khi đọc — giọng sẽ tươi hơn',
    'Đọc hơi nhanh và nhẹ nhàng',
    'Nhấn vào từ vui (love, best, play)',
  ],
  surprised: [
    'Mở to giọng ở từ đầu (Wow, Look)',
    'Nghỉ một nhịp trước từ bất ngờ',
    'Lên giọng thật cao ở cuối câu cảm thán',
  ],
  question: [
    'Lên giọng ở cuối câu hỏi',
    'Nhấn vào từ để hỏi (Where, Is)',
    'Đọc chậm hơn một chút',
  ],
  sad: [
    'Đọc chậm và nhỏ giọng lại',
    'Hạ giọng xuống ở cuối câu',
    'Kéo dài từ buồn (sad, fell)',
  ],
  excited: [
    'Đọc to và nhanh hơn bình thường',
    'Nhấn mạnh vào từ quan trọng (birthday, big)',
    'Kết câu bằng giọng đi lên, thật hào hứng',
  ],
  calm: [
    'Đọc thật chậm và êm',
    'Hạ giọng nhẹ ở cuối mỗi câu',
    'Nghỉ một nhịp giữa các câu',
  ],
}

/** Only the sentence-final ❗❓ are tinted: they are what the voice has to *do* at the end of the
 * line. The paragraph carries one aria-label so a screen reader hears the passage, not fragments. */
function Passage({ text }: { text: string }) {
  return (
    <p
      aria-label={text}
      className="max-w-3xl text-center font-display text-[34px] font-extrabold leading-snug text-ink-900"
    >
      {text.split(/([!?])/).map((part, i) =>
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

  /** Sample audio is generated locally and may simply not be there yet — say so, never throw. */
  function playSample() {
    playUrl(passage.audio).then(() => setAudioMissing(false), () => setAudioMissing(true))
  }

  const message = stars === 3 ? 'Đọc có hồn quá!' : stars === 2 ? 'Hay lắm!' : 'Thử lại nhé'

  return (
    <main className="h-full overflow-y-auto bg-cream-50 px-6 py-5">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center gap-4">
        <header className="flex w-full items-center justify-between gap-4">
          <BackButton to="/level/story-voice" label="Quay lại" />
          <Chip tone="coral">Đoạn {index + 1}/{STORY_VOICE.length}</Chip>
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        {/* The mood is the instruction on this screen — bigger than the passage's own words. */}
        <section className="flex flex-col items-center gap-1">
          <span aria-hidden="true" className="text-[72px] leading-none">{passage.emoji}</span>
          <p className="font-display text-2xl font-extrabold text-ink-900">Đọc với giọng: {passage.moodVi}</p>
        </section>

        <section className="flex w-full flex-col items-center gap-2">
          <Passage text={passage.text} />
          <p className="max-w-2xl text-center text-lg font-bold text-ink-500">{passage.vi}</p>
          <Button variant="secondary" onClick={playSample}>🔊 Nghe mẫu</Button>
          {audioMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}
        </section>

        <Card className="flex w-full max-w-2xl flex-col gap-2 px-6 py-4">
          <p className="font-display text-xl font-extrabold text-ink-900">🎭 Gợi ý giọng</p>
          <ul className="flex flex-col gap-1">
            {MOOD_TIPS[passage.mood].map(tip => (
              <li key={tip} data-testid="mood-tip" className="text-lg font-bold text-ink-500">• {tip}</li>
            ))}
          </ul>
        </Card>

        {result && feedback && stars ? (
          <section className="flex flex-col items-center gap-4 pb-2">
            {stars === 3 && <Confetti />}
            <ProsodyChip score={prosody} engine={engine} />
            <Stars value={stars} animate={stars === 3} />
            <p className="font-display text-3xl font-extrabold text-ink-900">{message}</p>
            <ScoreBars result={result} />
            <ScoredWords words={feedback.words} />
            {feedback.hint && <HintCard hint={feedback.hint} />}
            <div className="flex flex-wrap justify-center gap-4 pt-1">
              {attempt.lastBlob && (
                <Button variant="outline" onClick={() => playBlob(attempt.lastBlob!).catch(() => {})}>🎧 Nghe mình</Button>
              )}
              <Button variant="outline" onClick={playSample}>🔊 Nghe mẫu</Button>
              <Button variant="outline" onClick={attempt.reset}>↻ Thử lại</Button>
              {next
                ? <Button size="lg" pulse onClick={() => nav(`/voice/${next.id}`)}>Tiếp theo →</Button>
                : <Button size="lg" pulse onClick={() => nav('/level/story-voice')}>Hoàn thành 🎉</Button>}
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
              <p className="font-display text-2xl font-extrabold text-ink-900">Đọc cả đoạn thật có hồn nhé!</p>
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
