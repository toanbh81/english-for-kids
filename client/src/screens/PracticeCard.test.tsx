import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'

/** The hook is mocked, not the recorder + scorer: these tests are about what PracticeCard does
 * with a result, and `useSpeakingAttempt` is covered by its own suite
 * (`speaking/useSpeakingAttempt.test.tsx`, `.token.test.tsx`). `micState` is real state (not a
 * hardcoded `'idle'`) because round-2's carrier behaviours — dimmed header, "● Đang ghi" chip, the
 * collapsed strip, the shrunk emoji card — all key off `recording`/`processing`, matching the
 * approved `SoundPractice.test.tsx` pattern this file copies. */
type MicState = 'idle' | 'recording' | 'processing' | 'disabled' | 'locked'
const mic = vi.hoisted(() => ({
  push: (_r: PronunciationResult, _b: Blob | null = null) => {},
  engine: 'azure' as 'azure' | 'webspeech',
  error: null as { kind: string; detail?: string } | null,
  dismissError: () => {},
  setMicState: (_s: MicState) => {},
  // Read once, on mount/reset, by the effect below — set before `renderCard()` so a screen can be
  // rendered already mid-attempt (e.g. `processing`) with no post-render `act()` needed.
  initialMicState: 'idle' as MicState,
}))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    const [state, setState] = useState<{ result: PronunciationResult | null; blob: Blob | null }>({ result: null, blob: null })
    const [micState, setMicState] = useState<MicState>('idle')
    // The real hook drops the result whenever the reset key changes — here, on the next card.
    useEffect(() => { setState({ result: null, blob: null }); setMicState(mic.initialMicState) }, [opts.resetKey])
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

import { PracticeCard } from './PracticeCard'
import { LEVELS } from '../content'
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

const CARD_STEP = step('sz-th-three', '/practice/sz-th-three')
const NEXT_STEP = step('th', '/sound/th')

const soundZooCards = LEVELS.find(l => l.id === 'sound-zoo')!.cards
const wordPopCards = LEVELS.find(l => l.id === 'word-pop')!.cards

/** The level route is stubbed rather than pulling in LevelSelect: these tests only care that
 * "Hoàn thành 🎉" lands back on the level the card belongs to. */
function renderCard(cardId = 'sz-th-three', mission = false) {
  render(
    <MemoryRouter initialEntries={[{ pathname: `/practice/${cardId}`, state: mission ? { mission: true } : null }]}>
      <Routes>
        <Route path="/practice/:cardId" element={<PracticeCard />} />
        <Route path="/level/:levelId" element={<p>danh sách thẻ</p>} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

const score = (r: PronunciationResult, blob: Blob | null = null) => act(() => { mic.push(r, blob) })
const startRecording = () => act(() => { mic.setMicState('recording') })

function azureResult(overall: number, word = 'three'): PronunciationResult {
  return { overall, accuracy: overall, fluency: overall, completeness: 100, engine: 'azure', words: [{ word, score: overall, errorType: 'None', phonemes: [] }] }
}

const stored = () => JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')

/** Walks up from `el` to the nearest ancestor carrying `cls` — used where the class under test
 * sits on a wrapper `data-testid` doesn't reach (PageBody's own collapse wrapper). */
function ancestorWithClass(el: Element, cls: string): HTMLElement {
  let node: Element | null = el
  while (node && !node.classList.contains(cls)) node = node.parentElement
  if (!node) throw new Error(`no ancestor of ${el.outerHTML.slice(0, 80)} carries class "${cls}"`)
  return node as HTMLElement
}

/** Fix round 1 C1: `StreakDots` is shared by the header chip AND the line under the card, so both
 * now carry the same "Lần 1/2"/"Lần 2/2" labels at once — `screen.getByLabelText` alone is
 * ambiguous. These scope to one or the other explicitly. */
const headerStreak = () => within(screen.getByTestId('header-streak'))
const streakLine = () => within(screen.getByTestId('streak-line'))

beforeEach(() => {
  localStorage.clear()
  mic.engine = 'azure'
  mic.error = null
  mic.initialMicState = 'idle'
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
})

it('shows the word, records, and renders 3 stars', () => {
  renderCard()
  expect(screen.getByText('three')).toBeInTheDocument()

  score(azureResult(85))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
  expect(screen.getByText('Tuyệt vời!')).toBeInTheDocument()
  expect(screen.getAllByTestId('star-filled')[0]).toHaveClass('animate-star-drop') // the stars drop in
})

it('logs a speak activity event after a scored attempt', () => {
  renderCard()
  score(azureResult(85))

  const events = JSON.parse(localStorage.getItem('speakup.activity') ?? '[]')
  expect(events).toContainEqual(expect.objectContaining({ kind: 'speak', id: 'sz-th-three' }))
})

it('Tiếp theo goes to the next card of the same level', () => {
  renderCard()
  score(azureResult(85))

  fireEvent.click(screen.getByRole('link', { name: /tiếp theo/i }))

  expect(screen.getByText(soundZooCards[1].text)).toBeInTheDocument() // the 2nd Sound Zoo card
  expect(screen.getByText(`Thẻ 2/${soundZooCards.length}`)).toBeInTheDocument()
})

it('the last card of a level finishes back at the level instead of jumping to the next level', () => {
  const total = soundZooCards.length
  renderCard(soundZooCards.at(-1)!.id) // last Sound Zoo card
  score(azureResult(85))
  expect(screen.getByText(`Thẻ ${total}/${total}`)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /tiếp theo/i })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('link', { name: /hoàn thành/i }))

  expect(screen.getByText('danh sách thẻ')).toBeInTheDocument()
})

it('says the sample audio is missing instead of failing silently', async () => {
  playerControl.playUrl.mockRejectedValue(new Error('audio failed'))
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: /nghe mẫu/i }))
  await screen.findByText('Chưa có audio mẫu')
})

it('shows a friendly error when mic permission is denied', () => {
  mic.error = { kind: 'mic' }
  renderCard()
  expect(screen.getByText(/cho phép dùng mic/)).toBeInTheDocument()
})

it('Thử lại clears the result and re-enables the mic', () => {
  renderCard()
  score(azureResult(85))
  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))

  expect(screen.queryAllByTestId('star-filled')).toHaveLength(0)
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
})

/** Retry-only until 3★ or 3 attempts (task-7 brief): the CTA row holds "↻ Thử lại" alone until
 * the gate opens, never a bare "Thử lại" next to a premature "Tiếp theo". */
it('gates the CTA to retry-only until the card wins 3 stars', () => {
  renderCard()
  score(azureResult(65)) // 2 stars, 1st attempt: gate still closed

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.queryByRole('link', { name: /tiếp theo/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
  score(azureResult(65)) // 2nd attempt, still 2 stars
  expect(screen.queryByRole('link', { name: /tiếp theo/i })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
  score(azureResult(65)) // 3rd attempt: the attempt-count half of the gate opens
  expect(screen.getByRole('link', { name: /tiếp theo/i })).toBeInTheDocument()
})

describe('Word Pop: hidden IPA + two-in-a-row streak', () => {
  const card = wordPopCards[0] // wp-cat

  it('hides the IPA behind "Xem phiên âm" until tapped', () => {
    renderCard(card.id)
    expect(screen.queryByText(card.ipa)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /xem phiên âm/i }))

    expect(screen.getByText(card.ipa)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /xem phiên âm/i })).not.toBeInTheDocument()
  })

  it('two consecutive ≥80 results award 3 stars and fill both streak slots in the header chip', () => {
    renderCard(card.id)

    score(azureResult(85, 'cat'))
    expect(headerStreak().getByLabelText('Lần 1/2')).toHaveTextContent('●')
    expect(headerStreak().getByLabelText('Lần 2/2')).toHaveTextContent('○')
    expect(screen.getAllByTestId('star-filled')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
    score(azureResult(90, 'cat'))

    expect(headerStreak().getByLabelText('Lần 1/2')).toHaveTextContent('●')
    expect(headerStreak().getByLabelText('Lần 2/2')).toHaveTextContent('●')
    expect(screen.getByText('Nói đúng 2 lần liên tiếp! 🎉')).toBeInTheDocument()
    expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
    expect(stored()[card.id]).toBe(3)
  })

  /** C1 fix: the line under the card used to hardcode literal "● ○" characters that never read
   * `streak` — it could show a filled dot at streak 0 and stay stuck at "● ○" once the header
   * chip had already reached "●●". Both now render from the same `StreakDots`, so this asserts
   * on the LINE specifically (not the chip) at streak 0 and streak 1. */
  it('mirrors the live streak in the line under the card, not a static "● ○"', () => {
    renderCard(card.id)

    expect(streakLine().getByLabelText('Lần 1/2')).toHaveTextContent('○')
    expect(streakLine().getByLabelText('Lần 1/2')).toHaveClass('text-line-200')
    expect(streakLine().getByLabelText('Lần 2/2')).toHaveTextContent('○')
    expect(streakLine().getByLabelText('Lần 2/2')).toHaveClass('text-line-200')

    score(azureResult(85, 'cat'))

    expect(streakLine().getByLabelText('Lần 1/2')).toHaveTextContent('●')
    expect(streakLine().getByLabelText('Lần 1/2')).toHaveClass('text-coral-500')
    expect(streakLine().getByLabelText('Lần 2/2')).toHaveTextContent('○')
  })

  /** R24: the first ≥80 hit is one short of the win — the generic 2★ copy never mentions the
   * streak, so it is swapped for a line that names exactly what is left to do. */
  it('names the streak on the first ≥80 hit: "Nói đúng lần nữa để 3★!"', () => {
    renderCard(card.id)
    score(azureResult(85, 'cat'))

    expect(screen.getByText('Nói đúng lần nữa để 3★!')).toBeInTheDocument()
    expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  })

  it('an 80 then a 50 clears the streak and keeps stored stars capped at 2', () => {
    renderCard(card.id)

    score(azureResult(85, 'cat'))
    expect(headerStreak().getByLabelText('Lần 1/2')).toHaveTextContent('●')

    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
    score(azureResult(50, 'cat'))

    expect(headerStreak().getByLabelText('Lần 1/2')).toHaveTextContent('○')
    expect(headerStreak().getByLabelText('Lần 2/2')).toHaveTextContent('○')
    expect(streakLine().getByLabelText('Lần 1/2')).toHaveTextContent('○') // the line clears too
    expect(stored()[card.id] ?? 0).toBeLessThanOrEqual(2)
  })

  it('leaves Sound Zoo cards unchanged: IPA visible, no streak dots anywhere', () => {
    renderCard() // default sz-th-three
    expect(screen.getByText(soundZooCards[0].ipa)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /xem phiên âm/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('header-streak')).not.toBeInTheDocument()
    expect(screen.queryByTestId('streak-line')).not.toBeInTheDocument()
  })
})

// --- as a step of today's lesson (spec §3) ---------------------------------------------------

it('numbers itself inside the lesson and threads back to the mission', () => {
  const card = wordPopCards[0]
  seedLesson(step(card.id, `/practice/${card.id}`), NEXT_STEP)
  renderCard(card.id, true)

  expect(screen.getByText('Thẻ 1/2')).toBeInTheDocument()
  // One counter, not two: the level's own position means nothing inside a lesson.
  expect(screen.queryByText(`Thẻ 1/${wordPopCards.length}`)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nhiệm vụ' })).toHaveAttribute('href', '/mission')
})

/** Reached from the 🔁 group the number counts inside review, and the noun says which group. */
it('calls the step review when the lesson filed it under 🔁', () => {
  const card = wordPopCards[0]
  seedLesson({ ...step(card.id, `/practice/${card.id}`), kind: 'review' }, NEXT_STEP)
  renderCard(card.id, true)

  expect(screen.getByText('Ôn tập 1/1')).toBeInTheDocument()
  expect(screen.queryByText(/^Thẻ \d/)).not.toBeInTheDocument()
})

it('hands on to the next step of the lesson, still carrying the flag', () => {
  seedLesson(CARD_STEP, NEXT_STEP)
  renderCard('sz-th-three', true)
  score(azureResult(85))

  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/sound/th {"mission":true}')
})

it('ends at the mission screen when it is the last step of the lesson', () => {
  seedLesson(CARD_STEP)
  renderCard('sz-th-three', true)
  score(azureResult(85))

  fireEvent.click(screen.getByRole('button', { name: /hoàn thành/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/mission null')
})

/** Today's lesson may well list this very card — but a child who walked in from the level did not
 * arrive carrying the flag, and nothing about the screen may change for them. */
it('stays a free-play card without the flag, lesson or no lesson', () => {
  seedLesson(CARD_STEP, NEXT_STEP)
  renderCard()

  expect(screen.getByText(`Thẻ 1/${soundZooCards.length}`)).toBeInTheDocument()
  expect(screen.queryByText('Thẻ 1/2')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/level/sound-zoo')
})

/** Phase 10: this screen had no phone layout at all — no breakpoint rules and, worse, no
 * `PAGE_SHELL`, so at 390×844 it measured 1156 px with the mic at y938 and its content ran under
 * the notch. jsdom cannot lay that out, so these guard the inputs the measurement depends on. */
it('carries the safe-area shell and its own resting padding', () => {
  renderCard()

  const shell = document.querySelector('main')!.className
  expect(shell).toContain('pt-[max(var(--page-pad-top,1.5rem),calc(env(safe-area-inset-top)_+_8px))]')
  expect(shell).toContain('pb-[max(var(--page-pad-bottom,1.5rem),calc(env(safe-area-inset-bottom)_+_10px))]')
  expect(shell).toContain('[--page-pad-top:1.25rem]')
  expect(shell).toContain('[--page-pad-bottom:1.25rem]')
  expect(shell).toContain('px-5')
  expect(shell).toContain('md:px-6')
})

/** The frame is the shared `PageShell`: `overflow-hidden` on `main`, `page-body` the only
 * scroller, never a `sticky` panel painting over a word chip. */
it('carries the PageShell frame, never a sticky panel', () => {
  renderCard()
  score(azureResult(85))

  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
  expect(document.querySelector('main')!.innerHTML).not.toContain('sticky')
})

// --- round-2 carrier: header chip, emoji card, mouth panel, recording, result, processing -----

it('shows the "Thẻ n/N" chip at idle, with no per-level dot row', () => {
  renderCard()
  expect(screen.getByText(`Thẻ 1/${soundZooCards.length}`)).toBeInTheDocument()
  // The old per-card dot row (up to 12 spans) is gone — the chip alone carries the count now.
  expect(document.querySelectorAll('.h-4.w-4.rounded-full')).toHaveLength(0)
})

it('lays out the round-2 flashcard: emoji tile, word and IPA-reveal button at the briefed sizes', () => {
  const card = wordPopCards[0]
  renderCard(card.id)

  const tile = screen.getByTestId('emoji-card')
  expect(tile).toHaveClass('h-[140px]', 'w-[140px]', 'rounded-r26', 'md:h-[220px]', 'md:w-[220px]', 'md:rounded-[32px]')
  expect(within(tile).getByText(card.emoji)).toHaveClass('text-[76px]', 'md:text-[120px]')

  expect(screen.getByText(card.text)).toHaveClass('text-[44px]', 'md:text-[64px]')

  const reveal = screen.getByRole('button', { name: /xem phiên âm/i })
  expect(reveal).toHaveClass('h-9', 'bg-sand', 'text-sand-text', 'md:h-11')

  expect(screen.getByRole('button', { name: /nghe mẫu/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /khẩu hình/i })).toBeInTheDocument()
})

/** Design brief B1 bullet 1: "375×667: thẻ 110, ẩn dòng streak". jsdom doesn't evaluate media
 * queries, so this only asserts the `short:` classes exist — the real 375×667 render is checked
 * visually via `shots/short/practice-idle.png` (fix round 1 tooling addition). */
it('carries the 375×667 short-fold classes: the card shrinks, the emoji scales down', () => {
  renderCard()
  const tile = screen.getByTestId('emoji-card')
  expect(tile).toHaveClass('short:h-[110px]', 'short:w-[110px]')
  expect(within(tile).getByText('3️⃣')).toHaveClass('short:text-[60px]')
})

it('shows the Word Pop streak line under the card, hidden on the short fold', () => {
  renderCard(wordPopCards[0].id)
  const line = screen.getByTestId('streak-line')
  expect(line).toHaveClass('short:hidden')
  expect(within(line).getByText(/Nói đúng 2 lần liên tiếp → 3 sao/)).toBeInTheDocument()
})

it('never shows the streak line for a non-Word-Pop card', () => {
  renderCard(soundZooCards[0].id)
  expect(screen.queryByTestId('streak-line')).not.toBeInTheDocument()
})

it('shows the streak dots inside the centre chip for a Word Pop card, unlit at idle', () => {
  renderCard(wordPopCards[0].id)
  expect(screen.getByText(`Thẻ 1/${wordPopCards.length}`)).toBeInTheDocument()
  expect(headerStreak().getByLabelText('Lần 1/2')).toHaveTextContent('○')
  expect(headerStreak().getByLabelText('Lần 2/2')).toHaveTextContent('○')
})

it('never grows streak dots in the header chip for a non-Word-Pop card', () => {
  renderCard(soundZooCards[0].id)
  expect(screen.queryByTestId('header-streak')).not.toBeInTheDocument()
})

/** Ruling item 4: the design brief's B1 `say` already bakes in "trong 5 giây nhé!", so the
 * `SpeakPrompt` call drops `seconds` — a `seconds` prop would append a second, separately-colored
 * "5 giây" (`SpeakPrompt.tsx` appends `{seconds} giây` whenever the prop is passed at all). */
it('shows the 5-second prompt once, with no separate seconds badge doubling it', () => {
  renderCard()
  expect(screen.getByText('Nói to, rõ trong 5 giây nhé!')).toBeInTheDocument()
  expect(screen.queryByText('5 giây')).not.toBeInTheDocument()
})

it('toggles the mouth panel open and closed from the button row', () => {
  renderCard()
  expect(screen.queryByTestId('mouth-panel')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /khẩu hình/i }))
  expect(screen.getByTestId('mouth-panel')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /khẩu hình/i }))
  expect(screen.queryByTestId('mouth-panel')).not.toBeInTheDocument()
})

it('dims the header, swaps the chip, shrinks the card and hides the two buttons while recording', () => {
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: /khẩu hình/i })) // open it, so recording closing it is observable
  expect(screen.getByTestId('mouth-panel')).toBeInTheDocument()

  startRecording()

  const backCell = screen.getByRole('link', { name: 'Quay lại' }).closest('div')!
  expect(backCell).toHaveClass('opacity-40', 'pointer-events-none')
  expect(screen.getByTestId('header-right')).toHaveClass('opacity-40', 'pointer-events-none')

  const chip = screen.getByText('● Đang ghi')
  expect(chip).toHaveClass('bg-coral-50', 'text-coral-text')
  expect(screen.queryByText(/^Thẻ \d/)).not.toBeInTheDocument()

  expect(screen.getByTestId('emoji-card')).toHaveClass('h-[110px]')
  expect(screen.queryByRole('button', { name: /nghe mẫu/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /khẩu hình/i })).not.toBeInTheDocument()
  expect(screen.queryByTestId('mouth-panel')).not.toBeInTheDocument() // the panel closes too

  expect(screen.getByText('three')).toBeInTheDocument() // the word itself stays put
  expect(screen.getByTestId('countdown-row')).toBeInTheDocument()
})

/** Brief §1 "Tầng dạy gập": once a result lands the teach column collapses to a tap-to-expand
 * strip (PageBody's `collapsed`) with Foxy reacting in the result card; tapping the strip reopens
 * the full column, and a fresh result collapses it again. */
it('collapses the teach column to a tap-to-expand strip on a result, and reopens on tap', () => {
  renderCard()
  score(azureResult(85))

  const strip = screen.getByRole('button', { name: /mở/i })
  expect(strip).toHaveTextContent('three')
  const hiddenWrap = ancestorWithClass(screen.getByTestId('emoji-card'), 'hidden')
  expect(hiddenWrap).toHaveClass('ipad:flex')

  const card = screen.getByTestId('result-card')
  expect(within(card).getByTestId('foxy')).toBeInTheDocument()
  expect(within(card).getByText('Foxy: "Đọc chuẩn quá đi!"')).toBeInTheDocument()

  fireEvent.click(strip)
  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()
})

/** Reviewer-precedent test (StarPractice/SoundPractice): scoring via "Thử lại" nulls `result` on
 * its own, so a test that only clicks retry and checks the strip is gone would pass whether or not
 * `setTeachOpen(true)` ever ran. Tap the strip open with no retry, confirm the full column is
 * back, then push a fresh result over top and confirm the strip collapses again. */
it('reopens the teach column on tap, and collapses again once a fresh result lands', () => {
  renderCard()
  score(azureResult(40))
  expect(screen.getByRole('button', { name: /mở/i })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /mở/i }))
  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
  score(azureResult(95))
  expect(screen.getByRole('button', { name: /mở/i })).toBeInTheDocument()
})

/** Spec decision 17 (brief R23 "Đang chấm"): `processing` reads as an idle mic with an hourglass
 * and nothing else may react to it — no dimmed header, no "Đang ghi" chip, no collapsed strip, no
 * shrunk card. Rendered already in `processing` via `mic.initialMicState`, no post-mount `act()`. */
it('holds the teach column still while scoring — processing is not recording', () => {
  mic.initialMicState = 'processing'
  renderCard()

  expect(screen.getByTestId('emoji-card')).toHaveClass('h-[140px]')
  expect(screen.getByText('three')).toBeInTheDocument()

  const backCell = screen.getByRole('link', { name: 'Quay lại' }).closest('div')!
  expect(backCell).not.toHaveClass('opacity-40')
  expect(screen.getByTestId('header-right')).not.toHaveClass('opacity-40')
  expect(screen.getByText(`Thẻ 1/${soundZooCards.length}`)).toBeInTheDocument()
  expect(screen.queryByText('● Đang ghi')).not.toBeInTheDocument()

  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /đang chấm/i })).toBeInTheDocument()
})
