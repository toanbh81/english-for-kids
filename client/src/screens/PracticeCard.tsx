import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { findCard, LEVELS } from '../content'
import type { PronunciationResult } from '../scoring/types'
import { playBlob, playUrl } from '../audio/player'
import { toFeedback } from '../scoring/feedback'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { missionNoun, useMissionNext } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { Confetti } from '../components/Confetti'
import { BackButton, Button, Card } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { MicButton, ResultCard, SpeakError } from '../components/speak'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { useSpeakErrorAction } from '../speaking/useSpeakErrorAction'

/** The hook stops the recording itself after this long; the countdown just mirrors it. */
const AUTO_STOP_MS = 6000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

/** How many cards a level may have before the header's progress dots are dropped for the
 * "Thẻ n/N" counter alone — see the header below. */
const DOT_LIMIT = 12

export function PracticeCard() {
  const { cardId = '' } = useParams()
  const card = findCard(cardId)
  // Computed above the `!card` early return rather than after it, because every hook below has to
  // run unconditionally and the result effect branches on `isWordPop`. It is computed exactly
  // once: past the guard the card is known to be real, which is all the `level!` assertions
  // further down are asserting — nothing is recomputed there.
  const level = card ? LEVELS.find(l => l.cards.includes(card)) : undefined
  const isWordPop = level?.id === 'word-pop'
  // Null unless the child arrived from the mission: only then is this card step "Thẻ 2/4" of
  // today's lesson rather than card 2 of its level (spec §3).
  const mission = useMissionNext()

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    logActivity({ ts: Date.now(), kind: 'speak', id: cardId, score: result.overall, phonemes: result.words.flatMap(w => w.phonemes) })
    if (blob) saveRecording({ id: `${cardId}:${Date.now()}`, ts: Date.now(), text: card?.text ?? '', blob }).catch(() => {})
  }

  const attempt = useSpeakingAttempt({ targetText: card?.text ?? '', autoStopMs: AUTO_STOP_MS, resetKey: cardId, onResult: handleResult })
  const onErrorAction = useSpeakErrorAction(attempt)
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

  /** Sample audio is generated locally and may simply not be there yet — say so, never throw. */
  function playSample() {
    playUrl(card!.audio).then(() => setAudioMissing(false), () => setAudioMissing(true))
  }

  return (
    <PageShell gutter="20">
      <PageHeader back={mission ? <BackButton to="/mission" label="Nhiệm vụ" /> : <BackButton to={`/level/${level!.id}`} label="Quay lại" />} engine={attempt.engine}>
        <div className="flex min-w-0 flex-col items-center gap-2 overflow-hidden">
          {/* In a lesson the level's own count is the wrong count — and two of them side by side
              is one too many for a child to read — so the mission's position replaces it, dots
              and all. */}
          <span className="font-display text-base font-extrabold text-ink-500 md:text-xl">
            {mission
              ? `${missionNoun(mission.pos, 'Thẻ')} ${mission.pos.index}/${mission.pos.total}`
              : `Thẻ ${cardIndex + 1}/${level!.cards.length}`}
          </span>
          {/* The dots are a nicety, the counter above them is the real read-out. Past a dozen
              cards they stop fitting: the legacy `/practice/sz-*` route walks all 27 Sound Zoo
              cards, and 27 of them made the header wider than a portrait iPad. */}
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
      </PageHeader>
      <PageBody split={{
        teach: (
          <div className={`flex w-full flex-1 flex-col items-center justify-center gap-3 md:flex-row md:flex-wrap md:gap-6 ${feedback ? 'max-md:hidden' : ''}`}>
            <Card className="flex h-[96px] w-full shrink-0 flex-row items-center justify-center gap-4 md:h-[180px] md:w-[180px] md:flex-col md:gap-2">
              <span aria-hidden="true" className="text-[56px] leading-none md:text-[88px]">{card.emoji}</span>
              <span className="text-sm font-bold text-ink-300 md:text-base">nghĩa của từ</span>
            </Card>

            <div className="flex w-full flex-col items-center gap-2 md:w-auto md:gap-3">
              <div className={`font-display font-extrabold leading-none text-ink-900 md:leading-none ${card.text.length > 12 ? 'text-[32px] md:text-[40px]' : 'text-[42px] md:text-[54px]'}`}>
                {card.text}
              </div>
              {isWordPop && !ipaRevealed ? (
                <Button variant="ghost" onClick={() => setIpaRevealed(true)}>Xem phiên âm</Button>
              ) : (
                <div className="text-base font-bold text-ink-300 md:text-[20px] md:leading-normal">{card.ipa}</div>
              )}
              <Button variant="outline" onClick={playSample}>🔊 Nghe mẫu</Button>
              {audioMissing && <p className="text-sm font-bold text-ink-300 md:text-lg">Chưa có audio mẫu</p>}
            </div>

            <div className="flex h-16 w-full shrink-0 flex-row items-center justify-center gap-3 rounded-xl3 bg-[#FFF1E6] shadow-[0_8px_0_#F2DFC9] md:h-[180px] md:w-[180px] md:flex-col md:gap-2">
              <span aria-hidden="true" className="animate-wiggle text-[34px] leading-none md:text-[64px]">👄</span>
              <span className="text-sm font-bold text-ink-500 md:text-base">Khẩu hình miệng</span>
            </div>

            {isWordPop && (
              <div className="flex w-full flex-col items-center gap-1">
                <div className="flex gap-3 text-2xl leading-none md:text-3xl md:leading-none">
                  <span aria-label="Lần 1/2" className={streak >= 1 ? 'text-coral-500' : 'text-line-200'}>{streak >= 1 ? '●' : '○'}</span>
                  <span aria-label="Lần 2/2" className={streak >= 2 ? 'text-coral-500' : 'text-line-200'}>{streak >= 2 ? '●' : '○'}</span>
                </div>
                <p className="text-[13px] font-bold text-ink-300 md:text-base">Nói đúng 2 lần liên tiếp để được 3 sao</p>
              </div>
            )}
          </div>
        ),
        act: feedback ? (
          <>
            {effectiveStars === 3 && <Confetti />}
            <ResultCard
              stars={effectiveStars}
              praise={isWordPop && streak >= 2 ? 'Nói đúng 2 lần liên tiếp! 🎉' : feedback.message}
              score={attempt.result?.overall}
              words={feedback.words}
              bars={attempt.result ?? undefined}
              hint={feedback.hint}
              canReplay={!!attempt.lastBlob}
              onReplay={() => playBlob(attempt.lastBlob!).catch(() => {})}
              onSample={playSample}
              onRetry={() => attempt.reset()}
              // Retry-only until 3★ or 3 attempts: the CTA row shows "↻ Thử lại" alone until then.
              primary={effectiveStars === 3 || attempts >= 3
                ? (mission
                    ? { label: mission.label, onClick: mission.go }
                    : next
                      ? { label: 'Tiếp theo →', to: `/practice/${next.id}` }
                      : { label: 'Hoàn thành 🎉', to: `/level/${level!.id}` })
                : undefined}
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
