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
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { Confetti } from '../components/Confetti'
import { Foxy } from '../components/Foxy'
import { BackButton, Button, Chip, PAGE_SHELL } from '../components/ui'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'

/** The hook stops the recording itself after this long; the countdown just mirrors it. */
const AUTO_STOP_MS = 6000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

const SAMPLE_CHIP =
  'inline-flex min-h-[64px] items-center gap-2 rounded-full bg-teal-50 px-7 font-display text-xl font-extrabold text-teal-600 shadow-[0_5px_0_#C4E8E1] active:translate-y-[2px]'

/**
 * This screen is the phase-10 reference for the shared speaking frame (design §5 M3/M3b, §6 M4),
 * so the breakpoint idiom it uses is the one the flashcard, the stories and the stairs copy.
 *
 * **Phone styles sit at the default breakpoint and `md:` (768) puts the tablet/iPad value back.**
 * That is the binding rule of the phase: 1194×834 must render byte-for-byte as it did before, so
 * every restore has to be the *exact* previous value — `md:flex-initial`, not `md:flex-none`.
 *
 * `max-md:` appears in exactly one situation: overriding a class that a shared primitive writes
 * for itself. `Button` puts `px-8`/`min-h-[72px]` in its own class list, and an unprefixed
 * override of ours would be a coin-toss on Tailwind's utility order — a `max-md:` one always wins,
 * because every variant is emitted after the plain utilities. It is also, by construction, invisible
 * from 768 up, which is the property this screen is graded on. It is never used for layout the
 * screen owns outright; that stays at the default breakpoint where the next task can read it.
 */
const CTA_PHONE = 'max-md:min-h-[64px] max-md:px-4 max-md:text-lg'

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

/** The whole result in one glance: the IPA symbol, how it went, and the number — or, when no
 * engine scored the sound, a plainly neutral card that says so instead of showing a number. */
function SoundChip({ ipa, score, engine }: { ipa: string; score: number | null; engine: 'azure' | 'webspeech' | null }) {
  // The design's "nén vừa 844": on a phone the chip is a full-width 76 px band rather than the
  // 96 px slab of the landscape frame, which is what buys the result state its room.
  const CHIP = 'inline-flex min-h-[76px] w-full items-center justify-center gap-3 rounded-xl3 border-[4px] px-4 font-display font-extrabold'
    + ' md:min-h-[96px] md:w-auto md:gap-5 md:px-9'
  const GLYPH = 'text-[34px] leading-none md:text-[54px]'

  if (score === null) {
    const unscored = engine === 'webspeech' ? UNSCORED_SIMPLE : UNSCORED_UNHEARD
    return (
      <div
        data-testid="sound-chip"
        data-tone="unknown"
        aria-label={`Âm ${ipa}: ${unscored}`}
        className={`${CHIP} max-w-xl border-line-200 bg-white text-ink-500`}
      >
        <span aria-hidden="true" className={GLYPH}>/{ipa}/</span>
        <span aria-hidden="true" className="text-[26px] leading-none md:text-[38px]">?</span>
        <span aria-hidden="true" className="max-w-[280px] text-sm leading-snug md:text-[20px]">{unscored}</span>
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
      <span aria-hidden="true" className={GLYPH}>/{ipa}/</span>
      <span aria-hidden="true" className="text-[26px] leading-none md:text-[38px]">{t.glyph}</span>
      <span aria-hidden="true" className={GLYPH}>{Math.round(score)}</span>
    </div>
  )
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
  if (!sound || idx < 0) return <p>Không tìm thấy âm</p>
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
  const tone = score === null ? null : toneFor(score)

  /** Generated locally and possibly not there yet — say so, never throw. */
  function playIsolated() {
    playUrl(`/audio/sounds/${ph}.mp3`).then(() => setSoundMissing(false), () => setSoundMissing(true))
  }
  function playSample() {
    playUrl(card.audio).then(() => setSampleMissing(false), () => setSampleMissing(true))
  }

  // The whole screen has to fit the iPad's 834 px landscape without scrolling: a five-year-old does
  // not scroll to find the mic, or the button that ends the step. The gaps down this column are
  // the budget that buys that, so they are deliberately tighter than the rest of the app's.
  return (
    // 20 px of side frame on a phone (design §1, the speak-frame family), the 24 px this screen has
    // always had from the tablet breakpoint up. The vertical padding is the safe-area shell resting
    // at the 1 rem of the old `py-4`, so with no notch to clear — iPad, desktop, jsdom — it is the
    // same 16 px it was.
    <main className={`h-full overflow-y-auto bg-cream-50 px-5 [--page-pad-bottom:1rem] [--page-pad-top:1rem] md:px-6 ${PAGE_SHELL}`}>
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center gap-3">
        <header className="flex w-full items-center justify-between gap-4">
          {mission
            ? <BackButton to="/mission" label="Nhiệm vụ" />
            : <BackButton to={`/sound/${ph}`} label="Quay lại" />}
          <div className="flex flex-col items-center gap-1.5">
            {/* Both counters earn their place here: "Âm 2/4" is where the child is in the lesson,
                "Từ 1/3" is which of the sound's words they are standing on — two different facts,
                so the mission chip does not replace this one the way it replaces a free-play
                deck's position. The "Từ n/3" chip itself lives with the word tile below (word row,
                cell B) while idle; the header only takes it back once that cell stops existing, so
                the count is never simply gone from the screen. */}
            {mission && (
              <Chip tone="teal">
                {missionNoun(mission.pos, 'Âm')} {mission.pos.index}/{mission.pos.total}
              </Chip>
            )}
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
            "a tile to line up".

            On a phone there is no room for a shared column, so the same four cells are read as the
            design's two stacked tiers (§6 M4): a warm sound card and a white word card. The two
            `md:contents` wrappers are what make that one DOM instead of two — below 768 they are
            the cards, and from 768 up they leave the box tree entirely, so cell A and cell B are
            grid items in exactly the order and at exactly the size they always were. A result
            folds the whole deck away on the phone: the score chip already carries the sound and
            the tip is reprinted under it, so the tier would only be repeating itself (§5 M3b). */}
        <div data-testid="sound-word-grid" className={`grid w-full grid-cols-1 gap-3 md:grid-cols-[minmax(180px,auto)_1fr] md:items-center md:gap-x-6 md:gap-y-3 ${result ? 'max-md:hidden' : ''}`}>
          <div data-testid="sound-tier" className="flex w-full flex-col rounded-[24px] bg-[#FFF1E6] px-4 py-3.5 shadow-[0_6px_0_#F2DFC9] md:contents">
            {/* Row 1, cell A — the sound stays put through every word. On the phone this is the
                design's sound row: mouth, symbol, speaker, all on one 64 px line. */}
            <div data-testid="sound-cell-a" className="flex w-full flex-wrap items-center gap-3.5 md:w-auto md:flex-col md:flex-nowrap md:gap-2">
              {/* The mouth shape the landscape frame gives a 168×200 tile of its own. The design
                  cuts that tile precisely so the mic stays above the fold, and folds the shape
                  into this row at 64 px instead — where, unlike the big tile, it is on screen
                  while the child is recording too. */}
              <span
                data-testid="mouth-tile"
                aria-hidden="true"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white text-[34px] leading-none md:hidden"
              >
                <span className="animate-wiggle">👄</span>
              </span>
              <div className="flex-1 font-display text-[40px] font-extrabold leading-none text-[#C08457] md:flex-initial md:text-[72px] md:text-coral-text">/{ipa}/</div>
              {/* One control, two shapes: a 64 px speaker button on the phone row, the full
                  labelled button of the landscape frame from `md` up. The label is spelled out for
                  assistive tech at both sizes, so the round version is not a mystery glyph. */}
              <Button
                variant="secondary"
                aria-label="Nghe âm lẻ"
                onClick={playIsolated}
                className={`shrink-0 max-md:h-16 max-md:w-16 max-md:rounded-full max-md:px-0 max-md:text-[26px] md:shrink`}
              >
                <span aria-hidden="true" className="md:hidden">🔊</span>
                <span aria-hidden="true" className="hidden md:inline">🔊 Nghe âm lẻ</span>
              </Button>
              {soundMissing && <p className="w-full text-sm font-bold text-ink-300 md:w-auto md:text-lg">Chưa có audio âm này</p>}
            </div>
            {/* Row 1, cell B — what the sound is. Never dropped, at any width: how to put the
                tongue is the thing this screen teaches (design §6). */}
            <div data-testid="sound-cell-b" className="flex w-full flex-col items-start gap-2 pt-2.5 text-left md:w-auto md:pt-0">
              {tip && <p className="max-w-xl text-sm font-bold leading-relaxed text-sun-700 md:text-lg md:leading-7 md:text-ink-500">{tip}</p>}
            </div>
          </div>

          {!result && !recording && (
            <div data-testid="word-tier" className="flex w-full flex-col items-center gap-2.5 rounded-xl3 bg-white px-4 py-5 shadow-card md:contents">
              {/* Row 2, cell A — the word tile, directly under the sound tile. `contents` on the
                  phone so the card can put the sample button *after* the word instead of between
                  the emoji and it: the order the design reads top to bottom is emoji, word, IPA,
                  then the thing to press. The cells keep their DOM shape, only the boxes go. */}
              <div data-testid="word-cell-a" className="contents md:flex md:flex-col md:items-center md:gap-2">
                <span aria-hidden="true" className="order-1 text-[76px] leading-none [@media(max-width:767px)_and_(max-height:700px)]:text-[56px] md:order-none md:text-[84px]">{card.emoji}</span>
                <button onClick={playSample} className={`${SAMPLE_CHIP} order-4 md:order-none`}>🔊 Nghe mẫu</button>
                {sampleMissing && <p className="order-4 text-sm font-bold text-ink-300 md:order-none md:text-lg">Chưa có audio mẫu</p>}
              </div>
              {/* Row 2, cell B — the word itself, plus its "Từ n/3" place in the sound. Kept out of
                  the header so it lives with the word it counts; while the screen is scoring or
                  recording, the word slot is doing something else and the header shows it instead
                  (see above) so the counter is never lost, just relocated. */}
              <div data-testid="word-cell-b" className="contents md:flex md:flex-col md:items-start md:gap-2 md:text-left">
                <div className="order-2 font-display text-[42px] font-extrabold leading-none text-ink-900 md:order-none md:text-[56px]">{card.text}</div>
                {/* The 375×667 rules of the design, and the only two things it lets this screen
                    drop there: the word's IPA and (below) the "chạm để nói" caption. The mouth
                    description is explicitly NOT droppable — it is what the screen teaches — so
                    the query is spelled out per element rather than hung on a container. It names
                    its own width bound because a height query alone would also catch a short
                    laptop window, where the landscape layout is the one being rendered. */}
                <div className="order-3 text-base font-bold text-ink-300 [@media(max-width:767px)_and_(max-height:700px)]:hidden md:order-none md:text-[22px] md:leading-normal">{card.ipa}</div>
                <Chip tone="coral" className="order-5 md:order-none">Từ {idx + 1}/{cards.length}</Chip>
              </div>
            </div>
          )}
        </div>

        {result ? (
          <>
            {earned === 3 && <Confetti />}
            {/* The result state on a phone is the design's compressed M3b: the score band, the
                tip, the two listening buttons and then a spacer, so the pair of CTAs sits on the
                bottom edge instead of wherever the content happens to end. `flex-1` only exists
                below 768 — from there up the section is the same content-height block it was. */}
            <section className="flex w-full flex-col items-center gap-3 pb-1 max-md:flex-1 md:w-auto">
              <SoundChip ipa={ipa} score={score} engine={attempt.engine} />
              {tone !== 'good' && tip && (
                <p data-testid="sound-tip" className="max-w-xl rounded-[18px] border-[3px] border-[#FFDF9E] bg-[#FFF6E0] px-3.5 py-2.5 text-center text-sm font-bold leading-relaxed text-ink-500 md:rounded-xl3 md:px-5 md:text-lg md:leading-7">
                  👅 {tip}
                </p>
              )}
              <p className="text-base font-bold text-ink-300 md:text-lg">
                Từ <span className="font-display font-extrabold text-ink-900">{card.text}</span> · {Math.round(result.overall)} điểm
              </p>

              <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                {attempt.lastBlob && (
                  <Button variant="outline" className="max-md:px-3 max-md:text-base" onClick={() => playBlob(attempt.lastBlob!).catch(() => {})}>🎧 Nghe mình</Button>
                )}
                <Button variant="outline" className="max-md:px-3 max-md:text-base" onClick={playSample}>🔊 Nghe mẫu</Button>
              </div>
              {sampleMissing && <p className="text-sm font-bold text-ink-300 md:text-lg">Chưa có audio mẫu</p>}

              {/* Stars and the sentence about them are one white card on a phone — the design's
                  "thẻ điểm gộp", read across in a single row rather than down two. Every one of
                  those card styles is unset again from `md` up, where this is the bare stacked
                  pair it has always been. */}
              {earned !== null && (
                <div className="flex w-full items-center justify-between gap-3 rounded-[24px] bg-white px-4 py-3.5 shadow-card md:w-auto md:flex-col md:justify-center md:gap-1 md:rounded-none md:bg-transparent md:p-0 md:shadow-none">
                  <Stars value={earned} animate size="sm" />
                  <p className="text-right font-display text-base font-extrabold text-ink-900 md:text-center md:text-2xl">
                    {earned === 3 ? 'Từ này tuyệt lắm!' : earned === 2 ? 'Gần được rồi, luyện thêm nhé!' : 'Nghe mẫu rồi thử lại nhé!'}
                  </p>
                </div>
              )}

              <div className="flex w-full flex-wrap justify-center gap-3 pt-1 max-md:mt-auto md:w-auto md:gap-4">
                <Button variant="outline" className={`${CTA_PHONE} max-md:flex-1`} onClick={attempt.reset}>↻ Thử lại</Button>
                {/* One word is one lesson step now, so the mission hand-off owns the CTA outright:
                    a child working through today's lesson must not be walked into the sound's
                    other two words instead of the step the lesson has lined up next. Free play
                    still strolls along the sound and ends back on its word list. */}
                {mission
                  ? <Button size="lg" pulse className={`${CTA_PHONE} max-md:flex-[1.35]`} onClick={mission.go}>{mission.label}</Button>
                  : !isLast
                    ? <Button size="lg" pulse className={`${CTA_PHONE} max-md:flex-[1.35]`} to={nextRoute}>Tiếp theo →</Button>
                    : <Button size="lg" pulse className={`${CTA_PHONE} max-md:flex-[1.35]`} to={nextRoute}>Hoàn thành 🎉</Button>}
              </div>
            </section>
          </>
        ) : recording ? (
          <section className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="font-display text-[32px] font-extrabold text-[#D9C9AE] md:text-[44px]">{card.text}</div>
            <div aria-hidden="true" className="font-display text-[44px] font-extrabold leading-none text-coral-text md:text-[56px]">{secondsLeft}</div>
            <Foxy mood="listening" size="sm" say="Foxy đang lắng nghe…" />
          </section>
        ) : (
          /* The 168×200 mouth tile is the one thing the design cuts outright from this screen: it
             is what pushed the mic under the fold. Below 768 the shape lives in the sound row
             instead (see `mouth-tile`); the tile itself is untouched from 768 up. */
          <section className="hidden w-full flex-1 items-center justify-center md:flex">
            <div className="flex h-[168px] w-[200px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl3 bg-[#FFF1E6] shadow-[0_8px_0_#F2DFC9]">
              <span aria-hidden="true" className="animate-wiggle text-[68px] leading-none">👄</span>
              <span className="text-base font-bold text-ink-500">Khẩu hình miệng</span>
            </div>
          </section>
        )}

        {attempt.error && <p className="font-display text-xl font-extrabold text-fix-700 md:text-2xl">{attempt.error}</p>}

        {/* `mt-auto`: with the big mouth tile gone there is no stretching block left on a phone, so
            the mic would otherwise float directly under the word card. It takes the free space
            instead and sits on the bottom edge, which is where the design pins it. From 768 up the
            tile is back and takes the space, so the margin goes to nothing.
            `sticky`: that is enough at 390×844, where nothing scrolls — but the design's own frame
            rule is "CTA chính luôn trên nếp gấp 844, trên 667 thì ghim đáy", and 667 is where the
            deck genuinely does not fit. Sticking the mic to the bottom edge is what "ghim đáy"
            means: the one control the child needs is never the thing they have to scroll for. It
            is inert wherever the page fits, and `md:static` takes it away above the phone. */}
        {!result && (
          <div className="sticky bottom-0 z-10 mt-auto flex flex-col items-center gap-3 bg-cream-50 pb-2 pt-1 md:static md:mt-0 md:bg-transparent">
            <MicButton state={attempt.micState} level={attempt.level} onPress={attempt.onMic} />
            {!recording && <p className="font-display text-base font-extrabold text-ink-500 [@media(max-width:767px)_and_(max-height:700px)]:hidden md:text-xl">Chạm để nói nào!</p>}
          </div>
        )}
      </div>
    </main>
  )
}
