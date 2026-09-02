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
import { Confetti } from '../components/Confetti'
import { BackButton, Button, Card, Chip } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { MicButton, ResultCard, SpeakError } from '../components/speak'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import type { SpeakErrorKind } from '../speaking/speakError'

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

  const a = useSpeakingAttempt({
    targetText: passage.text,
    autoStopMs: AUTO_STOP_MS,
    resetKey: passage.id,
    onResult: handleResult,
  })

  const result = a.result
  const engine = a.engine
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
  const recording = a.micState === 'recording'
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

  const onErrorAction = (kind: SpeakErrorKind) => {
    if (kind === 'limit') nav('/')
    else if (kind === 'noSpeech' || kind === 'notReady') a.reset()
  }

  return (
    <PageShell gutter="20">
      <PageHeader back={mission ? <BackButton to="/mission" label="Nhiệm vụ" /> : <BackButton to="/level/story-voice" label="Quay lại" />} engine={engine}>
        {mission
          ? <Chip tone="coral">{missionNoun(mission.pos, 'Thẻ')} {mission.pos.index}/{mission.pos.total}</Chip>
          : <Chip tone="coral">Đoạn {index + 1}/{STORY_VOICE.length}</Chip>}
      </PageHeader>
      <PageBody split={{
        teach: (
          <div className={`flex w-full flex-col items-center gap-3 ${result ? 'max-md:hidden' : ''}`}>
            <section className="flex flex-col items-center gap-1">
              <span aria-hidden="true" data-testid="mood-emoji" className="text-[38px] leading-none md:text-[56px]">{passage.emoji}</span>
              <p className="font-display text-lg font-extrabold text-ink-900 md:text-2xl">Đọc với giọng: {passage.moodVi}</p>
            </section>

            <section className="flex w-full flex-col items-center gap-1.5 md:gap-2">
              <Passage text={passage.text} />
              <p className="max-w-2xl text-center text-sm font-bold leading-snug text-ink-500 md:text-lg md:leading-7">{passage.vi}</p>
              <Button variant="outline" onClick={playSample}>🔊 Nghe mẫu</Button>
              {audioMissing && <p className="text-sm font-bold text-ink-300 md:text-lg">Chưa có audio mẫu</p>}
            </section>

            <Card className="flex w-full max-w-2xl flex-col gap-0.5 px-4 py-2 md:px-6 md:py-3">
              <p className="font-display text-base font-extrabold text-ink-900 md:text-lg">🎭 Gợi ý giọng</p>
              <ul className="flex flex-col">
                {tips.map(tip => (
                  <li key={tip} data-testid="mood-tip" className="text-[13px] font-bold leading-snug text-ink-500 md:text-[14px]">• {tip}</li>
                ))}
              </ul>
            </Card>
          </div>
        ),
        act: result && feedback && stars ? (
          <>
            {stars === 3 && <Confetti />}
            <ResultCard
              stars={stars}
              praise={message}
              score={result.overall}
              prosody={{ score: prosody, engine }}
              words={feedback.words}
              bars={result}
              hint={feedback.hint}
              canReplay={!!a.lastBlob}
              onReplay={() => playBlob(a.lastBlob!).catch(() => {})}
              onSample={playSample}
              onRetry={() => a.reset()}
              primary={mission
                ? { label: mission.label, onClick: mission.go }
                : next
                  ? { label: 'Tiếp theo →', to: `/voice/${next.id}` }
                  : { label: 'Hoàn thành 🎉', to: '/level/story-voice' }}
              animate={stars === 3}
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {!recording && <p className="text-[15px] font-bold text-ink-500">Đọc cả đoạn thật có hồn nhé!</p>}
            {a.error && <SpeakError error={a.error} onAction={onErrorAction} onDismiss={a.dismissError} />}
            <MicButton state={a.micState} level={a.level} onPress={a.onMic} secondsLeft={recording ? secondsLeft : undefined} />
          </div>
        ),
      }} />
    </PageShell>
  )
}
