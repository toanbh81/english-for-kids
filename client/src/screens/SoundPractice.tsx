import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { findSound } from '../content'
import type { SoundGroup } from '../content/types'
import type { PronunciationResult, WordTone } from '../scoring/types'
import { playBlob, playUrl } from '../audio/player'
import { PHONEME_TIPS, toneFor } from '../scoring/feedback'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { missionNoun, useMissionNext } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { Confetti } from '../components/Confetti'
import { BackButton, Button, Chip, NotFound } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { MicButton, ResultCard, SpeakError, WordChip } from '../components/speak'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { useSpeakErrorAction } from '../speaking/useSpeakErrorAction'

/** The hook stops the recording itself after this long; the countdown just mirrors it. */
const AUTO_STOP_MS = 6000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

/**
 * "Not scored" has two different causes and the child can only act on one of them, so it never
 * gets one blaming sentence about a service it has never heard of. The simple engine cannot score
 * a single sound at all — no retry changes that, so the copy only invites another go; a full
 * scoring run that simply missed the sound really can be fixed by saying it again.
 */
const UNSCORED_SIMPLE = 'Chế độ đơn giản chưa chấm được âm lẻ — bé thử lại nhé!'
const UNSCORED_UNHEARD = 'Chưa nghe rõ âm này — thử lại nhé!'

/**
 * Tập âm scores ONE sound, not the whole word: the chip shows the target phoneme's own score,
 * taken from its WORST occurrence in the attempt (a word can contain the sound twice, and the
 * weak one is the one worth fixing). `null` when nothing measured the sound — Web Speech reports
 * no phoneme detail at all, and an Azure result can drop the sound entirely. The word's accuracy
 * is NOT a stand-in: "three" said as "tree" scores high as a word while the θ never happened, and
 * printing that number under a /θ/ chip tells the child their θ was fine when nobody checked.
 */
function targetScore(result: PronunciationResult, ph: string): number | null {
  const hits = result.words.flatMap(w => w.phonemes).filter(p => p.phoneme === ph)
  return hits.length ? Math.min(...hits.map(p => p.score)) : null
}

/** What this word is worth so far: the target sound's own score when something measured it,
 * and the word-level score the attempt did produce when nothing did. */
type WordBest = { phoneme: number | null; word: number }

/**
 * 3 stars only when the sound itself was good in this word — that needs real phoneme detail, so a
 * word the engine never scored the sound in caps at 2.
 *
 * That cap is a ceiling, not a floor. The 1-vs-2 decision still has to be made, and for an
 * unmeasured word the word-level score is the only evidence there is: an attempt the engine barely
 * recognised must not come out level with one it heard perfectly.
 */
function starsFor(s: WordBest): 1 | 2 | 3 {
  if ((s.phoneme ?? s.word) < 60) return 1
  if (s.phoneme !== null && s.phoneme >= 80) return 3
  return 2
}

/**
 * ONE word of one sound (Phase 9 §1). The three words of a sound are separate cards with separate
 * stars now, picked off `SoundWordList`; this screen is the drill for the one the child chose.
 */
export function SoundPractice() {
  const { ph = '', cardId = '' } = useParams()
  const sound = findSound(ph)
  const idx = sound ? sound.cards.findIndex(c => c.id === cardId) : -1
  // The hooks live in the inner component so an unknown phoneme (or word) never renders half of
  // them — and so walking to the next word remounts with a clean attempt.
  if (!sound || idx < 0) return <NotFound what="âm" />
  return <SoundWord key={cardId} sound={sound} idx={idx} />
}

function SoundWord({ sound, idx }: { sound: SoundGroup; idx: number }) {
  const { ph, ipa, cards } = sound
  // Null unless the child arrived from the mission: only then does this word know it is step
  // "Âm 2/4" of today's lesson rather than a card they picked off the sound's word list (spec §3).
  const mission = useMissionNext()
  // Best score for this word, so a retry can only improve its stars. A `phoneme` of `null` is
  // "no engine has scored the sound in this word yet" — distinct from a genuine 0 — and `word` is
  // the fallback the star rule falls back on when it stays null.
  const [best, setBest] = useState<WordBest>({ phoneme: null, word: 0 })
  const [earned, setEarned] = useState<1 | 2 | 3 | null>(null)
  const [soundMissing, setSoundMissing] = useState(false)
  const [sampleMissing, setSampleMissing] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_FROM)
  const card = cards[idx]
  const isLast = idx === cards.length - 1
  // Free play walks the sound's own words and ends back on the list it started from.
  const nextRoute = isLast ? `/sound/${ph}` : `/sound/${ph}/${cards[idx + 1].id}`

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    logActivity({ ts: Date.now(), kind: 'speak', id: card.id, score: result.overall, phonemes: result.words.flatMap(w => w.phonemes) })
    if (blob) saveRecording({ id: `${card.id}:${Date.now()}`, ts: Date.now(), text: card.text, blob }).catch(() => {})
  }

  const attempt = useSpeakingAttempt({
    targetText: card.text,
    autoStopMs: AUTO_STOP_MS,
    resetKey: card.id,
    onResult: handleResult,
  })

  const result = attempt.result
  // Web Speech never reports phonemes, so it can only ever say "not scored" — asking `targetScore`
  // would give the same `null`, but naming the engine keeps the rule visible at the call site.
  const score = result && attempt.engine !== 'webspeech' ? targetScore(result, ph) : null

  // One place decides this word's outcome: every scored attempt updates its best and re-stars it
  // (a retry can only raise them — `setStars` keeps the highest it has seen). The sound's own stars
  // are never written: they are derived from the words by `soundStars(ph)`.
  useEffect(() => {
    if (!result) return
    const next: WordBest = {
      phoneme: score === null ? best.phoneme : Math.max(best.phoneme ?? score, score),
      word: Math.max(best.word, result.accuracy),
    }
    setBest(next)
    const stars = starsFor(next)
    setStars(`sword:${card.id}`, stars)
    setEarned(stars)
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

  const tip = PHONEME_TIPS[ph]
  const tone: WordTone | null = score === null ? null : toneFor(score)

  /** Generated locally and possibly not there yet — say so, never throw. */
  function playIsolated() {
    playUrl(`/audio/sounds/${ph}.mp3`).then(() => setSoundMissing(false), () => setSoundMissing(true))
  }
  function playSample() {
    playUrl(card.audio).then(() => setSampleMissing(false), () => setSampleMissing(true))
  }

  const onErrorAction = useSpeakErrorAction(attempt)

  return (
    <PageShell gutter="20">
      <PageHeader back={mission ? <BackButton to="/mission" label="Nhiệm vụ" /> : <BackButton to={`/sound/${ph}`} label="Quay lại" />} engine={attempt.engine}>
        <div className="flex flex-col items-center gap-1.5">
          {/* Both counters earn their place here: "Âm 2/4" is where the child is in the lesson,
              "Từ 1/3" is which of the sound's words they are standing on. */}
          {mission && (
            <Chip tone="teal">
              {missionNoun(mission.pos, 'Âm')} {mission.pos.index}/{mission.pos.total}
            </Chip>
          )}
          <Chip tone="coral">Từ {idx + 1}/{cards.length}</Chip>
          <div className="flex gap-2">
            {cards.map((c, i) => (
              <span
                key={c.id}
                aria-hidden="true"
                className={`h-4 w-4 rounded-full ${i < idx ? 'bg-teal-500' : i === idx ? 'bg-coral-500' : 'bg-line-200'}`}
              />
            ))}
          </div>
        </div>
      </PageHeader>
      <PageBody split={{
        teach: (
          <div className={`flex w-full flex-col items-center gap-3 ${result ? 'max-md:hidden' : ''}`}>
            <div className="flex w-full flex-col rounded-[24px] bg-[#FFF1E6] px-4 py-3.5 shadow-[0_6px_0_#F2DFC9]">
              <div className="flex w-full flex-wrap items-center gap-3.5">
                <span data-testid="mouth-tile" aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white text-[34px] leading-none">
                  <span className="animate-wiggle">👄</span>
                </span>
                <div className="flex-1 font-display text-[40px] font-extrabold leading-none text-coral-text md:text-[56px]">/{ipa}/</div>
                <Button
                  variant="secondary"
                  aria-label="Nghe âm lẻ"
                  onClick={playIsolated}
                >
                  🔊 Nghe âm lẻ
                </Button>
                {soundMissing && <p className="w-full text-sm font-bold text-ink-300 md:w-auto md:text-lg">Chưa có audio âm này</p>}
              </div>
              <div className="flex w-full flex-col items-start gap-2 pt-2.5 text-left">
                {tip && <p className="max-w-xl text-sm font-bold leading-relaxed text-ink-500 md:text-lg md:leading-7">{tip}</p>}
                <span className="text-[13px] font-bold text-ink-300">👄 Khẩu hình miệng</span>
              </div>
            </div>

            {!result && !recording && attempt.micState !== 'processing' && (
              <div data-testid="word-tile" className="flex w-full flex-col items-center gap-2.5 rounded-xl3 bg-white px-4 py-5 shadow-card">
                <span aria-hidden="true" className="text-[76px] leading-none md:text-[84px]">{card.emoji}</span>
                <div className="font-display text-[42px] font-extrabold leading-none text-ink-900 md:text-[56px]">{card.text}</div>
                <div className="text-base font-bold text-ink-300 md:text-[22px] md:leading-normal">{card.ipa}</div>
                <Button variant="outline" onClick={playSample}>🔊 Nghe mẫu</Button>
                {sampleMissing && <p className="text-sm font-bold text-ink-300 md:text-lg">Chưa có audio mẫu</p>}
              </div>
            )}
          </div>
        ),
        act: result && earned ? (
          <>
            {earned === 3 && <Confetti />}
            <ResultCard
              stars={earned}
              praise={earned === 3 ? 'Từ này tuyệt lắm!' : earned === 2 ? 'Gần được rồi, luyện thêm nhé!' : 'Nghe mẫu rồi thử lại nhé!'}
              sub={`Từ ${card.text} · ${Math.round(result.overall)} điểm`}
              extra={
                <div className="flex flex-col items-center gap-2">
                  <WordChip word={`/${ipa}/`} tone={tone ?? 'unknown'} />
                  {score === null && (
                    <p className="max-w-xl text-center text-sm font-bold leading-relaxed text-ink-500">
                      {attempt.engine === 'webspeech' ? UNSCORED_SIMPLE : UNSCORED_UNHEARD}
                    </p>
                  )}
                </div>
              }
              hint={tip && tone !== 'good' ? { word: card.text, phoneme: ph, tip } : undefined}
              canReplay={!!attempt.lastBlob}
              onReplay={() => playBlob(attempt.lastBlob!).catch(() => {})}
              onSample={playSample}
              onRetry={() => attempt.reset()}
              primary={mission
                ? { label: mission.label, onClick: mission.go }
                : { label: isLast ? 'Hoàn thành 🎉' : 'Tiếp theo →', to: nextRoute }}
              animate
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {attempt.error && <SpeakError error={attempt.error} onAction={onErrorAction} onDismiss={attempt.dismissError} />}
            <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} secondsLeft={recording ? secondsLeft : undefined} />
          </div>
        ),
      }} />
    </PageShell>
  )
}
