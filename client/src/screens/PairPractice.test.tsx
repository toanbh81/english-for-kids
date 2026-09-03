import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'

/** The hook is mocked, not the recorder + scorer: these tests are about what PairPractice does
 * with a result, and `useSpeakingAttempt` is covered by its own suite and PracticeCard.test.
 * `micState` is real state (not a hardcoded `'idle'`) because round-2's carrier behaviours —
 * dimmed header, "● Đang ghi" chip, the collapsed strip, `processing` — all key off it. */
type MicState = 'idle' | 'recording' | 'processing' | 'disabled' | 'locked'
const mic = vi.hoisted(() => ({
  push: (_r: PronunciationResult, _b: Blob | null = null) => {},
  engine: 'azure' as 'azure' | 'webspeech',
  error: null as { kind: string; detail?: string } | null,
  dismissError: () => {},
  setMicState: (_s: MicState) => {},
  // Read once, on mount/reset, by the effect below — set before `renderPair()` so a screen can be
  // rendered already mid-attempt (e.g. `processing`) with no post-render `act()` needed.
  initialMicState: 'idle' as MicState,
  // Stands in for `?fixture=result3` landing a result before the listening game ever ran — the
  // real fixture lives inside the real `useSpeakingAttempt` (speaking/fixture.ts), out of reach of
  // this mock, so the DEV-only "skip to phase 2" wiring in PairPractice is exercised this way.
  initialResult: null as PronunciationResult | null,
}))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    const [state, setState] = useState<{ result: PronunciationResult | null; blob: Blob | null }>({ result: mic.initialResult, blob: null })
    const [micState, setMicState] = useState<MicState>('idle')
    useEffect(() => { setState({ result: mic.initialResult, blob: null }); setMicState(mic.initialMicState) }, [opts.resetKey])
    mic.push = (r: PronunciationResult, b: Blob | null = null) => {
      setState({ result: r, blob: b })
      opts.onResult?.(r, b)
    }
    mic.dismissError = () => {}
    mic.setMicState = setMicState
    return {
      micState, level: 0, engine: mic.engine,
      result: state.result, error: mic.error, lastBlob: state.blob,
      onMic: () => {}, reset: () => { setState({ result: null, blob: null }); setMicState('idle') }, dismissError: mic.dismissError,
    }
  },
}))
const playerControl = vi.hoisted(() => ({ playUrl: vi.fn() }))
vi.mock('../audio/player', () => ({ playUrl: playerControl.playUrl, playBlob: vi.fn().mockResolvedValue(undefined) }))

import { PairPractice } from './PairPractice'
import { PAIRS, findPair } from '../content'
import { seededSide } from '../content/shuffle'
import { dayKey } from '../progress/activity'
import { saveLesson } from '../progress/lessonStore'
import type { LessonItem } from '../progress/lesson'

/** Where a mission hand-off landed, and whether it was still carrying `{ mission: true }` — the
 * flag leaves no trace in the DOM, so the probe is the only way to see it. */
function Probe() {
  const location = useLocation()
  return <p data-testid="probe">{location.pathname} {JSON.stringify(location.state)}</p>
}

const step = (id: string, route: string): LessonItem =>
  ({ kind: 'speak', activity: 'speak', id, route, label: id, emoji: '🗣️' })

/** Today's lesson, written straight to storage, so the screen counts real steps. */
function seedLesson(...items: LessonItem[]) {
  const now = Date.now()
  saveLesson({ day: dayKey(now), created: now, band: 5, items })
}

const PAIR_STEP = step('pair-ship-sheep', '/pair/pair-ship-sheep')
const NEXT_STEP = step('sz-th-three', '/practice/sz-th-three')

const SHIP_SHEEP = findPair('pair-ship-sheep')!

/** The word 🔊 plays on listen number `n` (0-based) — computed from the screen's own seeded
 * stream, so the flow tests below read as "tap the word that was played" instead of pinning a
 * hard-coded order that only holds for this one pair. */
const played = (n: number) => SHIP_SHEEP[seededSide(SHIP_SHEEP.id, n, ['a', 'b'] as const)].word
/** The word that was *not* played — the wrong card, whichever side that happens to be. */
const other = (word: string) => (word === SHIP_SHEEP.a.word ? SHIP_SHEEP.b.word : SHIP_SHEEP.a.word)
/** The listening scoreboard: one tick per word, so the child can see which one they still owe. */
const caption = (a: boolean, b: boolean) =>
  `${SHIP_SHEEP.a.word} ${a ? '✓' : '○'} · ${SHIP_SHEEP.b.word} ${b ? '✓' : '○'}`
/** Ticks the scoreboard would show after one correct pick of `word`. */
const ticks = (word: string) => (word === SHIP_SHEEP.a.word ? caption(true, false) : caption(false, true))

/** One attempt on "ship, sheep" — both words scored the same, which is all the screen reads. */
function result(overall = 85): PronunciationResult {
  return {
    overall, accuracy: overall, fluency: overall, completeness: 100, engine: 'azure',
    words: [
      { word: 'ship', score: overall, errorType: 'None', phonemes: [] },
      { word: 'sheep', score: overall, errorType: 'None', phonemes: [] },
    ],
  }
}

const score = (r: PronunciationResult, blob: Blob | null = null) => act(() => { mic.push(r, blob) })
const startRecording = () => act(() => { mic.setMicState('recording') })

function renderPair(id = 'pair-ship-sheep', mission = false) {
  render(
    <MemoryRouter initialEntries={[{ pathname: `/pair/${id}`, state: mission ? { mission: true } : null }]}>
      <Routes>
        <Route path="/pair/:id" element={<PairPractice />} />
        <Route path="/level/minimal-pairs" element={<p>các cặp từ</p>} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** The 🔊 tap starts a `playUrl` whose promise settles into `setAudioMissing`, so the click has to
 * be awaited inside act() — otherwise that state update lands after the test body. */
const listen = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Nghe' })) })
}
const pick = (word: string) => fireEvent.click(screen.getByRole('button', { name: word }))

/** Walks up from `el` to the nearest ancestor carrying `cls` — used where the class under test
 * sits on a wrapper `data-testid` doesn't reach (PageBody's own collapse wrapper). */
function ancestorWithClass(el: Element, cls: string): HTMLElement {
  let node: Element | null = el
  while (node && !node.classList.contains(cls)) node = node.parentElement
  if (!node) throw new Error(`no ancestor of ${el.outerHTML.slice(0, 80)} carries class "${cls}"`)
  return node as HTMLElement
}

beforeEach(() => {
  localStorage.clear()
  mic.engine = 'azure'
  mic.error = null
  mic.initialMicState = 'idle'
  mic.initialResult = null
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
})

// --- phase 1: listen & pick, no mic at all -----------------------------------------------------

it('opens on the two options, locked and dim until the child has listened', () => {
  renderPair()

  expect(screen.getByText('Cặp 1/8')).toBeInTheDocument()
  const ship = screen.getByRole('button', { name: 'ship' })
  expect(ship).toBeDisabled()
  expect(screen.getByRole('button', { name: 'sheep' })).toBeDisabled()
  expect(ship.className).toContain('h-24')
  expect(ship.className).toContain('w-24')
  expect(ship.className).toContain('md:h-[200px]')
  expect(ship.className).toContain('md:w-[200px]')
  // Fix round 1: the pre-listen dim is a plain `opacity-45` class, NOT `disabled:opacity-45` —
  // the latter would also dim the answered tile's celebratory/miss ring, since both states share
  // the `disabled` attribute.
  expect(ship.className).toContain('opacity-45')
  expect(ship.className).not.toContain('disabled:opacity-45')
  expect(screen.getByText('Bấm 🔊 trước nhé')).toBeInTheDocument()
  expect(screen.getByText(caption(false, false))).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/level/minimal-pairs')
})

/** Brief §2 B4: "loa 56 teal outline:4px #C4E8E1" while nothing has been played yet — the ring
 * disappears the moment the child taps it, whether or not the round is a hit. */
it('rings the speaker teal until the first listen, then drops the ring', async () => {
  renderPair()
  expect(screen.getByRole('button', { name: 'Nghe' }).className).toContain('outline-4')
  expect(screen.getByRole('button', { name: 'Nghe' }).className).toContain('outline-teal-line')

  await listen()
  expect(screen.getByRole('button', { name: 'Nghe' }).className).not.toContain('outline-teal-line')
})

/** The order is a PRNG stream seeded by the pair id, so it is the same every run. */
it('plays one of the two words and unlocks the cards', async () => {
  renderPair()
  await listen()

  expect(playerControl.playUrl).toHaveBeenCalledWith(`/audio/pairs/${played(0)}.mp3`)
  expect(screen.getByRole('button', { name: 'ship' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'sheep' })).toBeEnabled()
})

it('cheers the matching card in one line and locks up again after it', async () => {
  renderPair()

  await listen()
  pick(played(0))
  expect(screen.getByText('✅ Đúng rồi! 🎉')).toBeInTheDocument()
  expect(screen.getByText(ticks(played(0)))).toBeInTheDocument()
  const cheered = screen.getByRole('button', { name: played(0) })
  expect(cheered.className).toContain('shadow-[0_6px_0_#7ED99A,0_0_0_4px_#B9ECC8]')
  // Fix round 1: the tile the child actually tapped is locked (disabled) but its ring must read at
  // full opacity — it is the round's whole celebratory signal, not the "nothing played yet" dim.
  expect(cheered).toBeDisabled()
  expect(cheered.className).not.toContain('opacity-45')
  expect(cheered.className).not.toContain('disabled:opacity-45')
  // A finished round locks the cards again until the next 🔊.
  expect(screen.getByRole('button', { name: 'ship' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'sheep' })).toBeDisabled()
})

/** Brief §4 R12: the old two-line "🙈 …" + "Bấm 🔊 nghe lại nhé" is now one line only. With only
 * two cards a miss still costs a fresh listen instead of handing over the answer. */
it('gives the wrong pick one line of feedback and costs a fresh listen', async () => {
  renderPair()

  await listen()
  const wrongWord = other(played(0))
  pick(wrongWord)
  expect(screen.getByText('🙈 Nghe lại rồi chọn nhé')).toBeInTheDocument()
  const missed = screen.getByRole('button', { name: wrongWord })
  expect(missed.className).toContain('shadow-[0_6px_0_#F8A3AE,0_0_0_4px_#FFD4DA]')
  // Fix round 1: same full-opacity rule for the miss ring as the hit ring above.
  expect(missed.className).not.toContain('opacity-45')
  expect(screen.getByText(caption(false, false))).toBeInTheDocument()

  // The other card is locked too, so tapping it changes nothing.
  expect(screen.getByRole('button', { name: played(0) })).toBeDisabled()
  pick(played(0))
  expect(screen.getByText(caption(false, false))).toBeInTheDocument()
  expect(screen.queryByText('✅ Đúng rồi! 🎉')).not.toBeInTheDocument()

  // A fresh listen moves on to the next draw of the pair's seeded stream.
  await listen()
  expect(playerControl.playUrl).toHaveBeenLastCalledWith(`/audio/pairs/${played(1)}.mp3`)
  pick(played(1))
  expect(screen.getByText('✅ Đúng rồi! 🎉')).toBeInTheDocument()
  expect(screen.getByText(ticks(played(1)))).toBeInTheDocument()
})

/** Every 🔊 url played over `n` listens on a freshly mounted screen. */
async function playedUrls(n: number): Promise<string[]> {
  renderPair()
  for (let i = 0; i < n; i++) await listen()
  const urls = playerControl.playUrl.mock.calls.map(c => c[0] as string)
  cleanup()
  playerControl.playUrl.mockClear()
  return urls
}

/** A strict a/b alternation is a pattern a child spots in two rounds and then stops listening
 * for, so the side is drawn from a PRNG — but one seeded by the pair, so the same pair always
 * plays the same sequence and the screen stays testable. */
it('draws the same sequence for a pair every time it is opened', async () => {
  const first = await playedUrls(8)
  const second = await playedUrls(8)

  expect(first).toHaveLength(8)
  expect(second).toEqual(first)
})

it('does not simply alternate: both words come up over the first 12 listens', async () => {
  const urls = await playedUrls(12)

  expect(new Set(urls)).toEqual(new Set(['/audio/pairs/ship.mp3', '/audio/pairs/sheep.mp3']))
  // At least one listen repeats the previous word — an alternation never does.
  expect(urls.some((u, i) => i > 0 && u === urls[i - 1])).toBe(true)
})

/** Unpredictable must not turn into "heard the same word five times running": the contrast is the
 * whole exercise, and a child who never hears the other side has nothing to compare against. The
 * run cap in `seededSide` bounds that at two, which puts both words inside any four listens. */
it('gives every pair both of its words within the first 4 listens', () => {
  for (const p of PAIRS) {
    const sides = [0, 1, 2, 3].map(n => seededSide(p.id, n, ['a', 'b'] as const))
    expect(new Set(sides), `pair ${p.id} drew ${sides.join('')}`).toEqual(new Set(['a', 'b']))
  }
})

it('says so when the pair audio is missing', async () => {
  playerControl.playUrl.mockRejectedValue(new Error('audio failed'))
  renderPair()
  await listen()

  await screen.findByText('Chưa có audio mẫu')
})

/** Two correct picks used to open the mic, which a child could satisfy without ever hearing the
 * contrast — the draw repeats a side, and "ship" twice proves nothing about "sheep". The gate is
 * now one correct pick of EACH word. */
it('does not open the mic until each word has been picked correctly once', async () => {
  renderPair()

  // This pair's stream opens on the same side twice, so two correct picks cover only one word.
  expect(played(0)).toBe(played(1))

  await listen(); pick(played(0))
  expect(screen.getByText(ticks(played(0)))).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /bấm để nói/i })).not.toBeInTheDocument()

  await listen(); pick(played(1))
  // Still the same single tick — the other word is still owed.
  expect(screen.getByText(ticks(played(0)))).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /bấm để nói/i })).not.toBeInTheDocument()
})

// --- phase 2: speak both words -------------------------------------------------------------

/** Listens and picks correctly until the gate opens — how many turns that takes depends on the
 * pair's own draw order, which is exactly what the screen decides. */
async function reachMic(mission = false) {
  renderPair('pair-ship-sheep', mission)
  for (let n = 0; n < 8 && !screen.queryByText('Giờ nói cả hai từ nhé'); n++) {
    await listen()
    pick(played(n))
  }
}

it('opens phase 2 with a green summary chip, two word cards and a sample button — no more mic-less game', async () => {
  await reachMic()

  expect(screen.getByText('✓ Nghe & chọn xong: ship ✓ · sheep ✓')).toBeInTheDocument()
  expect(screen.getByText('Giờ nói cả hai từ nhé')).toBeInTheDocument()

  const shipCard = screen.getByTestId('pair-word-a')
  expect(shipCard.className).toContain('w-[150px]')
  expect(shipCard.className).toContain('md:w-[220px]')
  expect(within(shipCard).getByText('ship')).toBeInTheDocument()
  expect(within(screen.getByTestId('pair-word-b')).getByText('sheep')).toBeInTheDocument()

  expect(screen.getByText('Nói cả hai từ: ship, sheep')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /nghe mẫu/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()

  // The listening game is gone entirely, not merely hidden behind an old summary Card.
  expect(screen.queryByText('Bấm 🔊 trước nhé')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Nghe' })).not.toBeInTheDocument()
})

/** `docs/design/current/shoot.mjs`'s `pair-result3` lands on `?fixture=result3`, which
 * `useSpeakingAttempt` turns into a scored result with no listening game ever played — this mock
 * stands that in with `initialResult`. The screen must treat an already-scored attempt as "the
 * listening phase is done", not strand it showing the phase-1 game under a result nobody earned by
 * picking anything. */
it('treats an attempt that already has a result as phase 2 already done, backfilling the ticks', () => {
  mic.initialResult = result(85)
  renderPair()

  expect(screen.getByTestId('result-card')).toBeInTheDocument()
  const strip = screen.getByRole('button', { name: /mở/i })
  expect(strip).toHaveTextContent('ship, sheep')
  fireEvent.click(strip)
  expect(screen.getByText('✓ Nghe & chọn xong: ship ✓ · sheep ✓')).toBeInTheDocument()
})

it('plays both words back to back on the phase-2 sample button', async () => {
  await reachMic()
  playerControl.playUrl.mockClear()

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /nghe mẫu/i })) })

  expect(playerControl.playUrl).toHaveBeenNthCalledWith(1, '/audio/pairs/ship.mp3')
  expect(playerControl.playUrl).toHaveBeenNthCalledWith(2, '/audio/pairs/sheep.mp3')
})

it('says so when the phase-2 sample audio is missing', async () => {
  await reachMic()
  playerControl.playUrl.mockRejectedValue(new Error('audio failed'))

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /nghe mẫu/i })) })
  await screen.findByText('Chưa có audio mẫu')
})

/** Brief §0 Q3 / carrier: dimmed header, "● Đang ghi" chip, countdown row — same as every other
 * speaking screen, only reachable once phase 2 has opened the mic. */
it('dims the header and swaps the chip while recording', async () => {
  await reachMic()
  startRecording()

  const backCell = screen.getByRole('link', { name: 'Quay lại' }).closest('div')!
  expect(backCell).toHaveClass('opacity-40', 'pointer-events-none')
  expect(screen.getByTestId('header-right')).toHaveClass('opacity-40', 'pointer-events-none')

  const chip = screen.getByText('● Đang ghi')
  expect(chip).toHaveClass('bg-coral-50', 'text-coral-text')
  expect(screen.queryByText(/^Cặp \d/)).not.toBeInTheDocument()
  expect(screen.getByTestId('countdown-row')).toBeInTheDocument()
})

it('shows the speak error banner and lets the daily-limit dismiss send the child home', async () => {
  mic.error = { kind: 'limit' }
  await reachMic()

  expect(screen.getByRole('alert')).toHaveTextContent('Hôm nay bé học đủ rồi! Mai gặp lại nhé')
  fireEvent.click(screen.getByRole('button', { name: 'Về nhà' }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/')
})

/** Spec decision (brief R23 "Đang chấm"): `processing` reads as an idle mic with an hourglass and
 * nothing else may react to it — no dimmed header, no "Đang ghi" chip, no collapsed strip.
 * Rendered already in `processing` via `mic.initialMicState`, no post-mount `act()`. */
it('holds the teach column still while scoring — processing is not recording', async () => {
  mic.initialMicState = 'processing'
  await reachMic()

  expect(screen.getByText('Giờ nói cả hai từ nhé')).toBeInTheDocument()
  const backCell = screen.getByRole('link', { name: 'Quay lại' }).closest('div')!
  expect(backCell).not.toHaveClass('opacity-40')
  expect(screen.getByTestId('header-right')).not.toHaveClass('opacity-40')
  expect(screen.queryByText('● Đang ghi')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /đang chấm/i })).toBeInTheDocument()
})

// --- result: two chips, four bars, Foxy, CTA never gated ---------------------------------------

it('turns a good attempt into 3 stars, with both words as chips and Foxy after the listen row', async () => {
  await reachMic()
  score(result(85))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
  expect(screen.getByText('Tuyệt vời!')).toBeInTheDocument()
  expect(screen.getByTestId('confetti')).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')).toMatchObject({ 'pair:pair-ship-sheep': 3 })
  expect(JSON.parse(localStorage.getItem('speakup.activity') ?? '[]'))
    .toContainEqual(expect.objectContaining({ kind: 'speak', id: 'pair-ship-sheep' }))

  const card = screen.getByTestId('result-card')
  const chips = within(card).getAllByTestId('word-chip')
  expect(chips.find(c => c.textContent?.includes('ship'))).toHaveAttribute('aria-label', 'ship đúng')
  expect(chips.find(c => c.textContent?.includes('sheep'))).toHaveAttribute('aria-label', 'sheep đúng')

  expect(within(card).getByTestId('foxy')).toBeInTheDocument()
  expect(within(card).getByText('Foxy: "Nghe rõ cả hai từ luôn!"')).toBeInTheDocument()

  const rows = Array.from(card.children).map(c => c.getAttribute('data-row'))
  expect(rows).toEqual(['head', 'words', 'bars', 'listen', 'fox', 'cta'])
})

it('offers a hint and a retry when the attempt was weak, and never gates the CTA to retry-only', async () => {
  await reachMic()
  score(result(50))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(1)
  expect(screen.getByText(/Sửa từ này/)).toBeInTheDocument()
  expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()
  // Unlike Word Pop's PracticeCard, the pair's CTA is always both buttons — no attempts gate.
  expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /tiếp theo/i })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
  expect(screen.getByText('Giờ nói cả hai từ nhé')).toBeInTheDocument()
})

it('hands on to the next pair, and back to the level on the last one', async () => {
  await reachMic()
  score(result(85))
  expect(screen.getByRole('link', { name: /tiếp theo/i })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('link', { name: /tiếp theo/i }))
  expect(screen.getByText('Cặp 2/8')).toBeInTheDocument()
})

it('shows a not-found message for a pair that does not exist', () => {
  renderPair('nope')
  expect(screen.getByRole('heading')).toHaveTextContent('Ơ, không tìm thấy cặp từ này 🦊')
})

/** Brief §1 "Tầng dạy gập": once a result lands the teach column collapses to a tap-to-expand
 * strip (PageBody's `collapsed`) instead of the old `max-md:hidden`; tapping it reopens the full
 * column, and a real iPad landscape never loses it in the first place. */
it('collapses the teach column to a tap-to-expand strip once a result lands, and reopens on tap', async () => {
  await reachMic()
  score(result(92))

  const strip = screen.getByRole('button', { name: /mở/i })
  expect(strip).toHaveTextContent('ship, sheep')
  const hiddenWrap = ancestorWithClass(screen.getByTestId('pair-word-a'), 'hidden')
  expect(hiddenWrap).toHaveClass('ipad:flex')

  fireEvent.click(strip)
  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()
})

it('reopens the teach column on tap, and collapses again once a fresh result lands', async () => {
  await reachMic()
  score(result(40))
  expect(screen.getByRole('button', { name: /mở/i })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /mở/i }))
  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()

  score(result(95))
  expect(screen.getByRole('button', { name: /mở/i })).toBeInTheDocument()
})

// --- as a step of today's lesson (spec §3) ---------------------------------------------------

it('numbers itself inside the lesson and threads back to the mission', () => {
  seedLesson(PAIR_STEP, NEXT_STEP)
  renderPair('pair-ship-sheep', true)

  expect(screen.getByText('Thẻ 1/2')).toBeInTheDocument()
  // One counter, not two: the bậc's own position means nothing inside a lesson.
  expect(screen.queryByText('Cặp 1/8')).not.toBeInTheDocument()
  // The contrast is a fixed fact of the pair — it stays on the right even inside a lesson.
  expect(screen.getByText(SHIP_SHEEP.contrast)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nhiệm vụ' })).toHaveAttribute('href', '/mission')
})

/** Reached from the 🔁 group the number counts inside review, and the noun says which group. */
it('calls the step review when the lesson filed it under 🔁', () => {
  seedLesson({ ...PAIR_STEP, kind: 'review' }, NEXT_STEP)
  renderPair('pair-ship-sheep', true)

  expect(screen.getByText('Ôn tập 1/1')).toBeInTheDocument()
  expect(screen.queryByText(/^Thẻ \d/)).not.toBeInTheDocument()
})

it('hands on to the next step of the lesson, still carrying the flag', async () => {
  seedLesson(PAIR_STEP, NEXT_STEP)
  await reachMic(true)
  score(result(85))

  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/practice/sz-th-three {"mission":true}')
})

it('ends at the mission screen when it is the last step of the lesson', async () => {
  seedLesson(PAIR_STEP)
  await reachMic(true)
  score(result(85))

  fireEvent.click(screen.getByRole('button', { name: /hoàn thành/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/mission null')
})

/** Today's lesson may well list this very pair — but a child who walked in from the bậc did not
 * arrive carrying the flag, and nothing about the screen may change for them. */
it('stays a free-play card without the flag, lesson or no lesson', () => {
  seedLesson(PAIR_STEP, NEXT_STEP)
  renderPair()

  expect(screen.getByText('Cặp 1/8')).toBeInTheDocument()
  expect(screen.queryByText(/^Thẻ /)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/level/minimal-pairs')
})

/** The chain can end without the lesson ending: replaying a step whose group is behind an earlier,
 * still-open one. "Hoàn thành 🎉" would be congratulating the child for work they still owe. */
it('offers the way back, not a celebration, while an earlier step is owed', async () => {
  seedLesson(step('th', '/sound/th'), PAIR_STEP)
  await reachMic(true)
  score(result(85))

  expect(screen.queryByRole('button', { name: /hoàn thành/i })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /về nhiệm vụ/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/mission null')
})

/** Phase 10: this screen had no phone layout at all — no breakpoint rules and no `PAGE_SHELL`,
 * so at 390×844 the listening game measured 928 px with the "sheep" card cut off at 375×667, and
 * its content ran under the notch. jsdom cannot lay that out, so these guard the inputs. */
it('carries the safe-area shell at its own resting padding', () => {
  renderPair()

  const shell = document.querySelector('main')!.className
  expect(shell).toContain('pt-[max(var(--page-pad-top,1.5rem),calc(env(safe-area-inset-top)_+_8px))]')
  expect(shell).toContain('pb-[max(var(--page-pad-bottom,1.5rem),calc(env(safe-area-inset-bottom)_+_10px))]')
  expect(shell).toContain('[--page-pad-top:1.25rem]')
  expect(shell).toContain('px-5')
  expect(shell).toContain('md:px-6')
})

/** Brief §1: `PageBody`'s own frame, never a sticky panel painting over the teach column. */
it('carries the PageShell frame, never a sticky panel', () => {
  renderPair()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByTestId('page-body')).toHaveClass('ipad:flex-row')
  expect(document.querySelector('main')!.innerHTML).not.toContain('sticky')
})
