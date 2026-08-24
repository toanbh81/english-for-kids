import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { findSound } from '../content'
import type { SoundGroup } from '../content/types'
import type { PronunciationResult, WordTone } from '../scoring/types'
import { playBlob, playUrl } from '../audio/player'
import { PHONEME_TIPS, toneFor } from '../scoring/feedback'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { MISSION_STATE, useMissionPosition } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Chip } from '../components/ui'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'

/** The hook stops the recording itself after this long; the countdown just mirrors it. */
const AUTO_STOP_MS = 6000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

const SAMPLE_CHIP =
  'inline-flex min-h-[64px] items-center gap-2 rounded-full bg-teal-50 px-7 font-display text-xl font-extrabold text-teal-600 shadow-[0_5px_0_#C4E8E1] active:translate-y-[2px]'

// Written out per tone (never concatenated) so Tailwind keeps the classes in the build.
const TONE: Record<WordTone, { box: string; glyph: string; label: string }> = {
  good: { box: 'bg-good-50 border-good-300 text-good-700', glyph: '✓', label: 'tốt' },
  ok: { box: 'bg-ok-50 border-ok-300 text-ok-700', glyph: '～', label: 'tạm được' },
  fix: { box: 'bg-fix-50 border-fix-300 text-fix-700', glyph: '✗', label: 'cần sửa' },
}

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

/** What one word of the run is worth: the target sound's own score when something measured it,
 * and the word-level score the attempt did produce when nothing did. */
type WordBest = { phoneme: number | null; word: number }

/**
 * 3 stars only when the sound itself was good in all three words — that needs real phoneme
 * detail, so a word the engine never scored the sound in caps the run at 2.
 *
 * That cap is a ceiling, not a floor. The 1-vs-2 decision still has to be made, and for an
 * unmeasured word the word-level score is the only evidence there is: a Web Speech run the engine
 * barely recognised must not come out level with one it heard perfectly.
 */
function starsFor(scores: WordBest[]): 1 | 2 | 3 {
  if (scores.some(s => (s.phoneme ?? s.word) < 60)) return 1
  if (scores.every(s => s.phoneme !== null && s.phoneme >= 80)) return 3
  return 2
}

/** The whole result in one glance: the IPA symbol, how it went, and the number — or, when no
 * engine scored the sound, a plainly neutral card that says so instead of showing a number. */
function SoundChip({ ipa, score, engine }: { ipa: string; score: number | null; engine: 'azure' | 'webspeech' | null }) {
  const CHIP = 'inline-flex min-h-[110px] items-center gap-5 rounded-xl3 border-[4px] px-9 font-display font-extrabold'

  if (score === null) {
    const unscored = engine === 'webspeech' ? UNSCORED_SIMPLE : UNSCORED_UNHEARD
    return (
      <div
        data-testid="sound-chip"
        data-tone="unknown"
        aria-label={`Âm ${ipa}: ${unscored}`}
        className={`${CHIP} max-w-xl border-line-200 bg-white text-ink-500`}
      >
        <span aria-hidden="true" className="text-[54px] leading-none">/{ipa}/</span>
        <span aria-hidden="true" className="text-[38px] leading-none">?</span>
        <span aria-hidden="true" className="max-w-[280px] text-[20px] leading-snug">{unscored}</span>
      </div>
    )
  }

  const tone = toneFor(score)
  const t = TONE[tone]
  return (
    <div
      data-testid="sound-chip"
      data-tone={tone}
      aria-label={`Âm ${ipa} ${Math.round(score)} điểm, ${t.label}`}
      className={`${CHIP} ${t.box}`}
    >
      <span aria-hidden="true" className="text-[54px] leading-none">/{ipa}/</span>
      <span aria-hidden="true" className="text-[38px] leading-none">{t.glyph}</span>
      <span aria-hidden="true" className="text-[54px] leading-none">{Math.round(score)}</span>
    </div>
  )
}

export function SoundPractice() {
  const { ph = '' } = useParams()
  const sound = findSound(ph)
  // The hooks live in the inner component so an unknown phoneme never renders half of them.
  if (!sound || sound.cards.length === 0) return <p>Không tìm thấy âm</p>
  return <SoundRun key={sound.ph} sound={sound} />
}

function SoundRun({ sound }: { sound: SoundGroup }) {
  const { ph, ipa, cards } = sound
  const nav = useNavigate()
  // Null unless the child arrived from the mission: only then does this sound know it is step
  // "Âm 2/4" of today's lesson rather than a tile they picked out of the Sound Zoo (spec §3).
  const mission = useMissionPosition()
  const [idx, setIdx] = useState(0)
  // Best scores per word, so a retry can only improve the sound's stars. A `phoneme` of `null` is
  // "no engine has scored the sound in this word yet" — distinct from a genuine 0 — and `word` is
  // the fallback the star rule falls back on when it stays null.
  const [best, setBest] = useState<WordBest[]>(() => cards.map(() => ({ phoneme: null, word: 0 })))
  const [earned, setEarned] = useState<1 | 2 | 3 | null>(null)
  const [soundMissing, setSoundMissing] = useState(false)
  const [sampleMissing, setSampleMissing] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_FROM)
  const card = cards[idx]
  const isLast = idx === cards.length - 1

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    logActivity({ ts: Date.now(), kind: 'speak', id: card.id, score: result.overall, phonemes: result.words.flatMap(w => w.phonemes) })
    if (blob) saveRecording({ id: `${card.id}:${Date.now()}`, ts: Date.now(), text: card.text, blob }).catch(() => {})
  }

  const attempt = useSpeakingAttempt({
    targetText: card.text,
    autoStopMs: AUTO_STOP_MS,
    resetKey: `${ph}:${idx}`,
    onResult: handleResult,
  })

  const result = attempt.result
  // Web Speech never reports phonemes, so it can only ever say "not scored" — asking `targetScore`
  // would give the same `null`, but naming the engine keeps the rule visible at the call site.
  const score = result && attempt.engine !== 'webspeech' ? targetScore(result, ph) : null

  // One place decides the run's outcome: every scored attempt updates that word's best, and the
  // last word's result closes the run (a retry there can still raise the stars — `setStars` keeps
  // the highest it has seen).
  useEffect(() => {
    if (!result) return
    const next = best.map((v, i) => {
      if (i !== idx) return v
      return {
        phoneme: score === null ? v.phoneme : Math.max(v.phoneme ?? score, score),
        word: Math.max(v.word, result.accuracy),
      }
    })
    setBest(next)
    if (isLast) {
      const stars = starsFor(next)
      setStars(`sound:${ph}`, stars)
      setEarned(stars)
    }
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
  const tone = score === null ? null : toneFor(score)

  /** Generated locally and possibly not there yet — say so, never throw. */
  function playIsolated() {
    playUrl(`/audio/sounds/${ph}.mp3`).then(() => setSoundMissing(false), () => setSoundMissing(true))
  }
  function playSample() {
    playUrl(card.audio).then(() => setSampleMissing(false), () => setSampleMissing(true))
  }

  function nextWord() {
    setSampleMissing(false)
    setIdx(i => i + 1)
  }

  /** Only the END of the run belongs to the lesson: the three words inside the sound are one step,
   * so the mission's next step is where "Hoàn thành" goes, not where "Tiếp theo" does. */
  function finishMission() {
    if (mission?.nextRoute) nav(mission.nextRoute, { state: MISSION_STATE })
    else nav('/mission')
  }

  return (
    <main className="h-full overflow-y-auto bg-cream-50 px-6 py-5">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center gap-4">
        <header className="flex w-full items-center justify-between gap-4">
          {mission
            ? <BackButton to="/mission" label="Nhiệm vụ" />
            : <BackButton to="/level/sound-zoo" label="Quay lại" />}
          <div className="flex flex-col items-center gap-2">
            {/* Both counters earn their place here: "Âm 2/4" is where the child is in the lesson,
                "Từ 1/3" is where they are inside this sound — the run the lesson counts as one
                step. Every other screen's own counter is a position in a free-play deck, which
                the mission chip replaces outright. The "Từ n/3" chip itself now lives with the
                word tile below (word row, cell B) while idle; the header only takes it back once
                that cell stops existing, so the count is never simply gone from the screen. */}
            {mission && <Chip tone="teal">Âm {mission.index}/{mission.total}</Chip>}
            {(result || recording) && <Chip tone="coral">Từ {idx + 1}/{cards.length}</Chip>}
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
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {attempt.engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        {/* Two rows, one shared cell-A column: the sound's tile (row 1) and the word's tile (row
            2) line up their left edges so the child reads them as one deck, not two unrelated
            blocks. Row 2 only exists while idle — once recording starts or a result lands, the
            word's slot is doing something else entirely (countdown, score chip) and stops being
            "a tile to line up". */}
        <div data-testid="sound-word-grid" className="grid w-full grid-cols-1 gap-4 sm:grid-cols-[minmax(180px,auto)_1fr] sm:items-center sm:gap-x-6 sm:gap-y-5">
          {/* Row 1, cell A — the sound stays put through every word. */}
          <div data-testid="sound-cell-a" className="flex flex-col items-center gap-2">
            <div className="font-display text-[72px] font-extrabold leading-none text-coral-text">/{ipa}/</div>
            <Button variant="secondary" onClick={playIsolated}>🔊 Nghe âm lẻ</Button>
            {soundMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio âm này</p>}
          </div>
          {/* Row 1, cell B — what the sound is. */}
          <div data-testid="sound-cell-b" className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
            {tip && <p className="max-w-xl text-lg font-bold text-ink-500">{tip}</p>}
          </div>

          {!result && !recording && (
            <>
              {/* Row 2, cell A — the word tile, directly under the sound tile. */}
              <div data-testid="word-cell-a" className="flex flex-col items-center gap-3">
                <span aria-hidden="true" className="text-[96px] leading-none">{card.emoji}</span>
                <button onClick={playSample} className={SAMPLE_CHIP}>🔊 Nghe mẫu</button>
                {sampleMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}
              </div>
              {/* Row 2, cell B — the word itself, plus this run's own "Từ n/3" counter. Kept out of
                  the header so it lives with the word it counts; while the run is scoring or
                  recording, the word slot is doing something else and the header shows it instead
                  (see below) so the counter is never lost, just relocated. */}
              <div data-testid="word-cell-b" className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
                <div className="font-display text-[56px] font-extrabold leading-none text-ink-900">{card.text}</div>
                <div className="text-[22px] font-bold text-ink-300">{card.ipa}</div>
                <Chip tone="coral">Từ {idx + 1}/{cards.length}</Chip>
              </div>
            </>
          )}
        </div>

        {result ? (
          <>
            {earned === 3 && <Confetti />}
            <section className="flex flex-col items-center gap-4 pb-2">
              <SoundChip ipa={ipa} score={score} engine={attempt.engine} />
              {tone !== 'good' && tip && (
                <p data-testid="sound-tip" className="max-w-xl rounded-xl3 border-[3px] border-[#FFDF9E] bg-[#FFF6E0] px-6 py-4 text-center text-lg font-bold text-ink-500">
                  👅 {tip}
                </p>
              )}
              <p className="text-lg font-bold text-ink-300">
                Từ <span className="font-display font-extrabold text-ink-900">{card.text}</span> · {Math.round(result.overall)} điểm
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                {attempt.lastBlob && (
                  <Button variant="outline" onClick={() => playBlob(attempt.lastBlob!).catch(() => {})}>🎧 Nghe mình</Button>
                )}
                <Button variant="outline" onClick={playSample}>🔊 Nghe mẫu</Button>
              </div>
              {sampleMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}

              {earned !== null && (
                <div className="flex flex-col items-center gap-2">
                  <Stars value={earned} animate />
                  <p className="font-display text-2xl font-extrabold text-ink-900">
                    {earned === 3 ? 'Cả 3 từ đều tuyệt!' : earned === 2 ? 'Gần được rồi, luyện thêm nhé!' : 'Nghe mẫu rồi thử lại nhé!'}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-4 pt-1">
                <Button variant="outline" onClick={attempt.reset}>↻ Thử lại</Button>
                {!isLast
                  ? <Button size="lg" pulse onClick={nextWord}>Tiếp theo →</Button>
                  : mission
                    ? (
                      <Button size="lg" pulse onClick={finishMission}>
                        {mission.nextRoute ? 'Tiếp theo →' : 'Hoàn thành 🎉'}
                      </Button>
                    )
                    : <Button size="lg" pulse to="/level/sound-zoo">Hoàn thành 🎉</Button>}
              </div>
            </section>
          </>
        ) : recording ? (
          <section className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="font-display text-[44px] font-extrabold text-[#D9C9AE]">{card.text}</div>
            <div aria-hidden="true" className="font-display text-[56px] font-extrabold leading-none text-coral-text">{secondsLeft}</div>
            <Foxy mood="listening" size="sm" say="Foxy đang lắng nghe…" />
          </section>
        ) : (
          <section className="flex w-full flex-1 items-center justify-center">
            <div className="flex h-[200px] w-[200px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl3 bg-[#FFF1E6] shadow-[0_8px_0_#F2DFC9]">
              <span aria-hidden="true" className="animate-wiggle text-[76px] leading-none">👄</span>
              <span className="text-base font-bold text-ink-500">Khẩu hình miệng</span>
            </div>
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
