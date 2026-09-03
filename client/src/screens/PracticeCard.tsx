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
import { BackButton, Button, Chip, NotFound } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { MicButton, MouthPanel, ResultCard, SpeakError, SpeakPrompt } from '../components/speak'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { useSpeakErrorAction } from '../speaking/useSpeakErrorAction'

/** The hook stops the recording itself after this long; the countdown just mirrors it. */
const AUTO_STOP_MS = 6000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

/** Word Pop's two-in-a-row streak, drawn once and shared by the header chip ("Thẻ n/12 · ● ○")
 * and the line under the card — fix round 1 C1: the line used to hardcode "● ○" as literal
 * characters, so it could show a filled dot at streak 0 or stay stuck at "● ○" once the chip had
 * already reached "●●". One component reading the same `streak` prop is what keeps them unable
 * to drift apart again. */
function StreakDots({ streak }: { streak: number }) {
  return (
    <>
      <span aria-label="Lần 1/2" className={streak >= 1 ? 'text-coral-500' : 'text-line-200'}>{streak >= 1 ? '●' : '○'}</span>
      <span aria-label="Lần 2/2" className={streak >= 2 ? 'text-coral-500' : 'text-line-200'}>{streak >= 2 ? '●' : '○'}</span>
    </>
  )
}

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
  const result = attempt.result
  const [attempts, setAttempts] = useState(0)
  const [audioMissing, setAudioMissing] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_FROM)
  const [ipaRevealed, setIpaRevealed] = useState(false)
  /** Word Pop only: consecutive ≥80 attempts on this card, capped at 2 (the win condition). A
   * sub-80 attempt clears it; "Thử lại" re-scores the same card without touching it. */
  const [streak, setStreak] = useState(0)
  /** `MouthPanel`'s own open state — the screen owns it because it has to close the instant a
   * fresh recording starts (below), not just when the card changes. */
  const [mouthOpen, setMouthOpen] = useState(false)

  const feedback = useMemo(() => (result ? toFeedback(result) : null), [result])

  useEffect(() => {
    setAttempts(0); setAudioMissing(false); setIpaRevealed(false); setStreak(0); setMouthOpen(false)
  }, [cardId])

  // Brief §1 "Tầng dạy gập": the teach column collapses to a tap-to-expand strip once a result
  // lands, and reopens either on tap or on a fresh attempt (`onRetry` below) — a retry should not
  // leave the child staring at yesterday's collapsed strip once they start reading again.
  const [teachOpen, setTeachOpen] = useState(true)
  useEffect(() => {
    if (result) setTeachOpen(false)
  }, [result])

  // `useLayoutEffect`, not `useEffect`: the render that first sees the result still has the old
  // streak, so it draws 2 stars, and this effect is what turns them into 3. Run after paint, that
  // is a visible 2★ flash on the winning attempt; run before it, the child only ever sees 3★.
  useLayoutEffect(() => {
    if (!feedback) return
    setAttempts(a => a + 1)
    if (isWordPop) {
      const hit = (result?.overall ?? 0) >= 80
      const nextStreak = hit ? Math.min(2, streak + 1) : 0
      setStreak(nextStreak)
      setStars(cardId, nextStreak >= 2 ? 3 : (Math.min(2, feedback.stars) as 1 | 2))
    } else {
      setStars(cardId, feedback.stars)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  // The countdown only exists while the mic is open: it restarts on every recording and the
  // interval is cleared the moment the state changes (or the card unmounts).
  const recording = attempt.micState === 'recording'
  useEffect(() => {
    if (!recording) return
    setSecondsLeft(COUNTDOWN_FROM)
    const id = window.setInterval(() => setSecondsLeft(s => (s > 1 ? s - 1 : 1)), 1000)
    return () => clearInterval(id)
  }, [recording])

  // Round-2 decision: the mouth panel closes the instant recording starts, so the child is never
  // looking at a static 👄 tile while Foxy is listening.
  useEffect(() => {
    if (recording) setMouthOpen(false)
  }, [recording])

  if (!card) return <NotFound what="thẻ" />
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

  // R24: Word Pop's first ≥80 attempt is stuck one hit short of the win at 2★ — say so, rather
  // than reusing the generic per-star copy that says nothing about the streak.
  const praise = !feedback
    ? ''
    : isWordPop
      ? (streak >= 2 ? 'Nói đúng 2 lần liên tiếp! 🎉' : streak === 1 ? 'Nói đúng lần nữa để 3★!' : feedback.message)
      : feedback.message

  /** Sample audio is generated locally and may simply not be there yet — say so, never throw. */
  function playSample() {
    playUrl(card!.audio).then(() => setAudioMissing(false), () => setAudioMissing(true))
  }

  const headerLabel = mission
    ? `${missionNoun(mission.pos, 'Thẻ')} ${mission.pos.index}/${mission.pos.total}`
    : `Thẻ ${cardIndex + 1}/${level!.cards.length}`

  return (
    <PageShell gutter="20">
      <PageHeader
        back={mission ? <BackButton to="/mission" label="Nhiệm vụ" /> : <BackButton to={`/level/${level!.id}`} label="Quay lại" />}
        engine={attempt.engine}
        dimmed={recording}
      >
        {recording
          ? <Chip tone="coral">● Đang ghi</Chip>
          : (
            <Chip tone={mission ? 'coral' : 'teal'}>
              {headerLabel}
              {isWordPop && (
                <span data-testid="header-streak" className="ml-1.5 inline-flex items-center gap-1 text-base leading-none">
                  <span aria-hidden="true">·</span>
                  <StreakDots streak={streak} />
                </span>
              )}
            </Chip>
          )}
      </PageHeader>
      <PageBody
        actGrow={!!result}
        split={{
          teach: (
            <div className="flex w-full flex-col items-center gap-3">
              <div
                data-testid="emoji-card"
                className={`flex shrink-0 items-center justify-center rounded-r26 bg-white shadow-card short:h-[110px] short:w-[110px] md:h-[220px] md:w-[220px] md:rounded-[32px] ${recording ? 'h-[110px] w-[140px]' : 'h-[140px] w-[140px]'}`}
              >
                <span aria-hidden="true" className="text-[76px] leading-none short:text-[60px] md:text-[120px]">{card.emoji}</span>
              </div>

              <div className="font-display text-[44px] font-extrabold leading-none text-ink-900 md:text-[64px]">{card.text}</div>

              {isWordPop && !ipaRevealed ? (
                <button
                  type="button"
                  onClick={() => setIpaRevealed(true)}
                  className="flex h-9 items-center justify-center gap-1 rounded-r12 bg-sand px-3 text-[14px] font-bold text-sand-text md:h-11 md:px-4 md:text-base"
                >
                  👁 Xem phiên âm
                </button>
              ) : (
                <div className="text-base font-bold text-ink-300 md:text-[20px] md:leading-normal">{card.ipa}</div>
              )}

              {!recording && (
                <div className="flex w-full flex-wrap items-center justify-center gap-3">
                  <Button variant="outline" onClick={playSample}>🔊 Nghe mẫu</Button>
                  <MouthPanel card={card} open={mouthOpen} onToggle={() => setMouthOpen(o => !o)} />
                </div>
              )}
              {audioMissing && <p className="text-sm font-bold text-ink-300 md:text-lg">Chưa có audio mẫu</p>}

              {isWordPop && (
                <p data-testid="streak-line" className="short:hidden flex flex-wrap items-center justify-center gap-1.5 text-center text-[12px] font-bold text-ink-300 md:text-[15px]">
                  <span className="inline-flex items-center gap-1 text-base leading-none">
                    <StreakDots streak={streak} />
                  </span>
                  <span>+ Nói đúng 2 lần liên tiếp → 3 sao</span>
                </p>
              )}
            </div>
          ),
          collapsed: result && !teachOpen ? { emoji: card.emoji, label: card.text, onExpand: () => setTeachOpen(true) } : undefined,
          act: feedback ? (
            <>
              {effectiveStars === 3 && <Confetti />}
              <ResultCard
                stars={effectiveStars}
                praise={praise}
                score={result?.overall}
                words={feedback.words}
                bars={result ?? undefined}
                hint={feedback.hint}
                canReplay={!!attempt.lastBlob}
                onReplay={() => playBlob(attempt.lastBlob!).catch(() => {})}
                onSample={playSample}
                onRetry={() => { attempt.reset(); setTeachOpen(true) }}
                // Retry-only until 3★ or 3 attempts: the CTA row shows "↻ Thử lại" alone until then.
                primary={effectiveStars === 3 || attempts >= 3
                  ? (mission
                      ? { label: mission.label, onClick: mission.go }
                      : next
                        ? { label: 'Tiếp theo →', to: `/practice/${next.id}` }
                        : { label: 'Hoàn thành 🎉', to: `/level/${level!.id}` })
                  : undefined}
                animate
                fox={{
                  mood: effectiveStars === 3 ? 'cheer' : effectiveStars === 2 ? 'happy' : 'idle',
                  say: effectiveStars === 3 ? 'Foxy: "Đọc chuẩn quá đi!"' : effectiveStars === 2 ? 'Foxy: "Gần chuẩn rồi đó!"' : 'Foxy: "Luyện thêm chút nữa nhé!"',
                }}
              />
            </>
          ) : (
            <>
              {recording
                ? <SpeakPrompt mood="listening" say="Foxy đang lắng nghe…" />
                : <SpeakPrompt mood="idle" say="Nói to, rõ trong 5 giây nhé!" />}
              {attempt.error && <SpeakError error={attempt.error} onAction={onErrorAction} onDismiss={attempt.dismissError} />}
              <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} secondsLeft={recording ? secondsLeft : undefined} countdownLayout="row" />
            </>
          ),
        }}
      />
    </PageShell>
  )
}
