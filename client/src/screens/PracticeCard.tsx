import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { findCard, LEVELS } from '../content'
import type { PronunciationResult } from '../scoring/types'
import { playBlob, playUrl } from '../audio/player'
import { toFeedback } from '../scoring/feedback'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { MISSION_STATE, useMissionPosition } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { ScoredWords } from '../components/ScoredWords'
import { ScoreBars } from '../components/ScoreBars'
import { HintCard } from '../components/HintCard'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { BackButton, Button, Card } from '../components/ui'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'

/** The hook stops the recording itself after this long; the countdown just mirrors it. */
const AUTO_STOP_MS = 6000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

const SAMPLE_CHIP =
  'inline-flex min-h-[64px] items-center gap-2 rounded-full bg-teal-50 px-7 font-display text-xl font-extrabold text-teal-600 shadow-[0_5px_0_#C4E8E1] active:translate-y-[2px]'

/** How many cards a level may have before the header's progress dots are dropped for the
 * "Thẻ n/N" counter alone — see the header below. */
const DOT_LIMIT = 12

export function PracticeCard() {
  const { cardId = '' } = useParams()
  const nav = useNavigate()
  const card = findCard(cardId)
  // Computed above the `!card` early return rather than after it, because every hook below has to
  // run unconditionally and the result effect branches on `isWordPop`. It is computed exactly
  // once: past the guard the card is known to be real, which is all the `level!` assertions
  // further down are asserting — nothing is recomputed there.
  const level = card ? LEVELS.find(l => l.cards.includes(card)) : undefined
  const isWordPop = level?.id === 'word-pop'
  // Null unless the child arrived from the mission: only then is this card step "Thẻ 2/4" of
  // today's lesson rather than card 2 of its level (spec §3).
  const mission = useMissionPosition()

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    logActivity({ ts: Date.now(), kind: 'speak', id: cardId, score: result.overall, phonemes: result.words.flatMap(w => w.phonemes) })
    if (blob) saveRecording({ id: `${cardId}:${Date.now()}`, ts: Date.now(), text: card?.text ?? '', blob }).catch(() => {})
  }

  const attempt = useSpeakingAttempt({ targetText: card?.text ?? '', autoStopMs: AUTO_STOP_MS, resetKey: cardId, onResult: handleResult })
  const [attempts, setAttempts] = useState(0)
  const [audioMissing, setAudioMissing] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_FROM)
  const [ipaRevealed, setIpaRevealed] = useState(false)
  /** Word Pop only: consecutive ≥80 attempts on this card, capped at 2 (the win condition). A
   * sub-80 attempt clears it; "Thử lại" re-scores the same card without touching it. */
  const [streak, setStreak] = useState(0)

  const feedback = useMemo(() => (attempt.result ? toFeedback(attempt.result) : null), [attempt.result])

  useEffect(() => {
    setAttempts(0); setAudioMissing(false); setIpaRevealed(false); setStreak(0)
  }, [cardId])

  // `useLayoutEffect`, not `useEffect`: the render that first sees the result still has the old
  // streak, so it draws 2 stars, and this effect is what turns them into 3. Run after paint, that
  // is a visible 2★ flash on the winning attempt; run before it, the child only ever sees 3★.
  useLayoutEffect(() => {
    if (!feedback) return
    setAttempts(a => a + 1)
    if (isWordPop) {
      const hit = (attempt.result?.overall ?? 0) >= 80
      const nextStreak = hit ? Math.min(2, streak + 1) : 0
      setStreak(nextStreak)
      setStars(cardId, nextStreak >= 2 ? 3 : (Math.min(2, feedback.stars) as 1 | 2))
    } else {
      setStars(cardId, feedback.stars)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.result])

  // The countdown only exists while the mic is open: it restarts on every recording and the
  // interval is cleared the moment the state changes (or the card unmounts).
  const recording = attempt.micState === 'recording'
  useEffect(() => {
    if (!recording) return
    setSecondsLeft(COUNTDOWN_FROM)
    const id = window.setInterval(() => setSecondsLeft(s => (s > 1 ? s - 1 : 1)), 1000)
    return () => clearInterval(id)
  }, [recording])

  if (!card) return <p>Không tìm thấy thẻ</p>
  const cardIndex = level!.cards.findIndex(c => c.id === cardId)
  // "Tiếp theo" stays inside this level, so it agrees with the "Thẻ n/N" counter above it: on
  // card N of N there is no next card, and the run ends with "Hoàn thành 🎉" back at the level.
  const next = level!.cards[cardIndex + 1]

  // For Word Pop this is the "two in a row" streak's stars, capped at 2 until the streak lands;
  // for every other level it is simply `feedback.stars`, so this is a no-op there.
  const effectiveStars: 0 | 1 | 2 | 3 = !feedback
    ? 0
    : isWordPop
      ? (streak >= 2 ? 3 : (Math.min(2, feedback.stars) as 1 | 2))
      : feedback.stars

  const mood: FoxyMood = recording
    ? 'listening'
    : effectiveStars === 3 ? 'cheer' : effectiveStars === 2 ? 'happy' : 'idle'

  const isWebSpeech = attempt.engine === 'webspeech'

  function retry() { attempt.reset() }

  /** The lesson's next step — or the mission itself, which celebrates when the lesson is done. */
  function goMission() {
    if (mission?.nextRoute) nav(mission.nextRoute, { state: MISSION_STATE })
    else nav('/mission')
  }

  /** Sample audio is generated locally and may simply not be there yet — say so, never throw. */
  function playSample() {
    playUrl(card!.audio).then(() => setAudioMissing(false), () => setAudioMissing(true))
  }

  return (
    <main className="h-full overflow-y-auto bg-cream-50 px-6 py-5">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center gap-5">
        <header className="flex w-full items-center justify-between gap-4">
          {mission
            ? <BackButton to="/mission" label="Nhiệm vụ" />
            : <BackButton to={`/level/${level!.id}`} label="Quay lại" />}
          <div className="flex min-w-0 flex-col items-center gap-2 overflow-hidden">
            {/* In a lesson the level's own count is the wrong count — and two of them side by side
                is one too many for a child to read — so the mission's position replaces it, dots
                and all. */}
            <span className="font-display text-xl font-extrabold text-ink-500">
              {mission
                ? `Thẻ ${mission.index}/${mission.total}`
                : `Thẻ ${cardIndex + 1}/${level!.cards.length}`}
            </span>
            {/* The dots are a nicety, the counter above them is the real read-out. Past a dozen
                cards they stop fitting: the legacy `/practice/sz-*` route walks all 27 Sound Zoo
                cards, and 27 of them made the header wider than a portrait iPad, squeezing the
                66 px back button under the 64 px tap-target floor. So they wrap, and beyond
                DOT_LIMIT they simply do not render. */}
            {!mission && level!.cards.length <= DOT_LIMIT && (
              <div data-testid="card-dots" className="flex flex-wrap justify-center gap-2">
                {level!.cards.map((c, i) => (
                  <span
                    key={c.id}
                    aria-hidden="true"
                    className={`h-4 w-4 rounded-full ${i < cardIndex ? 'bg-teal-500' : i === cardIndex ? 'bg-coral-500' : 'bg-line-200'}`}
                  />
                ))}
              </div>
            )}
          </div>
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">{isWebSpeech ? 'chế độ đơn giản' : ''}</span>
        </header>

        {feedback ? (
          <>
            {effectiveStars === 3 && <Confetti />}
            <section className="flex flex-col items-center gap-4 pb-2">
              <Stars value={effectiveStars} animate />
              <div className="flex items-end gap-3">
                <Foxy mood={mood} size="sm" />
                <p className="font-display text-3xl font-extrabold text-ink-900">
                  {isWordPop && streak >= 2 ? 'Nói đúng 2 lần liên tiếp! 🎉' : feedback.message}
                </p>
              </div>
              <ScoredWords words={feedback.words} onWordTap={playSample} />
              {feedback.hint && <HintCard hint={feedback.hint} />}
              <div className="flex flex-wrap justify-center gap-4">
                {attempt.lastBlob && (
                  <Button variant="outline" onClick={() => playBlob(attempt.lastBlob!).catch(() => {})}>🎧 Nghe mình</Button>
                )}
                <Button variant="outline" onClick={playSample}>🔊 Nghe mẫu</Button>
              </div>
              {audioMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}
              {attempt.result && <ScoreBars result={attempt.result} />}
              <div className="flex flex-wrap justify-center gap-4 pt-1">
                <Button variant="outline" onClick={retry}>↻ Thử lại</Button>
                {(effectiveStars === 3 || attempts >= 3) && (
                  mission
                    ? (
                      <Button size="lg" pulse onClick={goMission}>
                        {mission.nextRoute ? 'Tiếp theo →' : 'Hoàn thành 🎉'}
                      </Button>
                    )
                    : next
                      ? <Button size="lg" pulse onClick={() => nav(`/practice/${next.id}`)}>Tiếp theo →</Button>
                      : <Button size="lg" pulse onClick={() => nav(`/level/${level!.id}`)}>Hoàn thành 🎉</Button>
                )}
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
          <section className="flex w-full flex-1 flex-wrap items-center justify-center gap-8">
            <Card className="flex h-[220px] w-[220px] shrink-0 flex-col items-center justify-center gap-2">
              <span aria-hidden="true" className="text-[104px] leading-none">{card.emoji}</span>
              <span className="text-base font-bold text-ink-300">nghĩa của từ</span>
            </Card>

            <div className="flex flex-col items-center gap-3">
              <div className={`font-display font-extrabold leading-none text-ink-900 ${card.text.length > 12 ? 'text-[46px]' : 'text-[64px]'}`}>
                {card.text}
              </div>
              {isWordPop && !ipaRevealed ? (
                <Button variant="ghost" onClick={() => setIpaRevealed(true)}>Xem phiên âm</Button>
              ) : (
                <div className="text-[22px] font-bold text-ink-300">{card.ipa}</div>
              )}
              <button onClick={playSample} className={SAMPLE_CHIP}>🔊 Nghe mẫu</button>
              {audioMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio mẫu</p>}
            </div>

            <div className="flex h-[220px] w-[220px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl3 bg-[#FFF1E6] shadow-[0_8px_0_#F2DFC9]">
              <span aria-hidden="true" className="animate-wiggle text-[76px] leading-none">👄</span>
              <span className="text-base font-bold text-ink-500">Khẩu hình miệng</span>
            </div>
          </section>
        )}

        {isWordPop && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-3 text-3xl leading-none">
              <span aria-label="Lần 1/2" className={streak >= 1 ? 'text-coral-500' : 'text-line-200'}>{streak >= 1 ? '●' : '○'}</span>
              <span aria-label="Lần 2/2" className={streak >= 2 ? 'text-coral-500' : 'text-line-200'}>{streak >= 2 ? '●' : '○'}</span>
            </div>
            <p className="text-base font-bold text-ink-300">Nói đúng 2 lần liên tiếp để được 3 sao</p>
          </div>
        )}

        {attempt.error && <p className="font-display text-2xl font-extrabold text-fix-700">{attempt.error}</p>}

        {!feedback && (
          <div className="flex flex-col items-center gap-3 pb-2 pt-1">
            <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
            {!recording && <p className="font-display text-xl font-extrabold text-ink-500">Chạm để nói nào!</p>}
          </div>
        )}
      </div>
    </main>
  )
}
