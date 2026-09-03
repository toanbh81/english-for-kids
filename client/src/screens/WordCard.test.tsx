import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'

/** The hook is mocked, not the recorder + scorer: these tests are about what WordCard does with a
 * result, and `useSpeakingAttempt` is covered by its own suite. `micState` is real state (not a
 * hardcoded `'idle'`) because round-2's carrier behaviours — dimmed header, "● Đang ghi" chip, the
 * countdown row, `processing` — all key off it, matching the approved `PracticeCard.test.tsx` /
 * `PairPractice.test.tsx` pattern this file copies. */
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
  // Stands in for `?fixture=result3` landing a result before the meaning-guess step was ever
  // answered — the real fixture lives inside the real `useSpeakingAttempt` (speaking/fixture.ts),
  // out of reach of this mock, so the DEV-only "skip the guess step" wiring in WordCard is
  // exercised this way instead.
  initialResult: null as PronunciationResult | null,
}))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    const [state, setState] = useState<{ result: PronunciationResult | null; blob: Blob | null }>({ result: mic.initialResult, blob: null })
    const [micState, setMicState] = useState<MicState>('idle')
    // The real hook drops the result whenever the reset key changes — here, on the next word.
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
const playerMock = vi.hoisted(() => ({ playUrl: vi.fn(() => Promise.resolve()) }))
vi.mock('../audio/player', () => playerMock)

const recordingsMock = vi.hoisted(() => ({ saveRecording: vi.fn(() => Promise.resolve()) }))
vi.mock('../progress/recordings', () => recordingsMock)

import { WordCard } from './WordCard'
import { WordList } from './WordList'
import { findTopic } from '../content/words'
import { getBox, promote } from '../progress/leitner'
import { dayKey, logActivity } from '../progress/activity'
import { saveLesson } from '../progress/lessonStore'
import type { LessonItem } from '../progress/lesson'

/** Where a mission hand-off landed, and whether it was still carrying `{ mission: true }` — the
 * flag leaves no trace in the DOM, so the probe is the only way to see it. */
function Probe() {
  const location = useLocation()
  return <p data-testid="probe">{location.pathname} {JSON.stringify(location.state)}</p>
}

const step = (id: string, route: string): LessonItem =>
  ({ kind: 'word', activity: 'word', id, route, label: id, emoji: '🧩' })

/** Today's lesson, written straight to storage, so the screen counts real steps. */
function seedLesson(...items: LessonItem[]) {
  const now = Date.now()
  saveLesson({ day: dayKey(now), created: now, band: 5, items })
}

const WORD_STEP = step('food-apple', '/words/food/food-apple')
const NEXT_STEP = step('food-bread', '/words/food/food-bread')

const resultHigh: PronunciationResult = {
  overall: 70, accuracy: 70, fluency: 70, completeness: 70,
  words: [{ word: 'apple', score: 70, errorType: 'None', phonemes: [{ phoneme: 'a', score: 70 }] }],
  engine: 'azure',
}
const resultLow: PronunciationResult = {
  overall: 40, accuracy: 40, fluency: 40, completeness: 40,
  words: [{ word: 'apple', score: 40, errorType: 'Mispronunciation', phonemes: [{ phoneme: 'ae', score: 30 }] }],
  engine: 'azure',
}
/** Web Speech can come back without a usable number at all — the stars still land, the chip must
 * not print "Điểm: NaN". */
const resultNoScore: PronunciationResult = { ...resultLow, overall: Number.NaN, engine: 'webspeech' }

const score = (r: PronunciationResult, blob: Blob | null = null) => act(() => { mic.push(r, blob) })
const startRecording = () => act(() => { mic.setMicState('recording') })

/** Walks up from `el` to the nearest ancestor carrying `cls` — used where the class under test
 * sits on a wrapper `data-testid` doesn't reach (the `max-md:hidden` mic wrapper). */
function ancestorWithClass(el: Element, cls: string): HTMLElement {
  let node: Element | null = el
  while (node && !node.classList.contains(cls)) node = node.parentElement
  if (!node) throw new Error(`no ancestor of ${el.outerHTML.slice(0, 80)} carries class "${cls}"`)
  return node as HTMLElement
}

function renderCard(topic: string, wordId: string, mission = false) {
  render(
    <MemoryRouter initialEntries={[{ pathname: `/words/${topic}/${wordId}`, state: mission ? { mission: true } : null }]}>
      <Routes>
        <Route path="/words/:topic/:wordId" element={<WordCard />} />
        <Route path="/words/:topic" element={<WordList />} />
        <Route path="/topic/:id" element={<div data-testid="topic-hub" />} />
        <Route path="/mission" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** A locked new word opens on the meaning-guess step now, not the flip card — tests that exercise
 * the card/mic directly answer the guess correctly first, exactly as a child tapping the right
 * Vietnamese meaning would, and then tap the "Tiếp theo →" that hands them over to the speaking
 * step (spec decision 3: the step no longer retires itself). */
function passGuess(vi: string) {
  fireEvent.click(screen.getByRole('button', { name: vi }))
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo →' }))
}

/** Which link element on screen goes back to the topic island. */
const topicBackLink = (topic: string) => screen.getAllByRole('link').find(a => a.getAttribute('href') === `/topic/${topic}`)!

beforeEach(() => {
  localStorage.clear()
  mic.engine = 'azure'
  mic.error = null
  mic.initialMicState = 'idle'
  mic.initialResult = null
  playerMock.playUrl.mockReset().mockResolvedValue(undefined)
  recordingsMock.saveRecording.mockClear()
})

it('shows a not-found message for an unknown word id', () => {
  renderCard('food', 'nope')
  expect(screen.getByRole('heading')).toHaveTextContent('Ơ, không tìm thấy từ này 🦊')
  expect(screen.getByRole('link', { name: '← Về trang chủ' })).toHaveAttribute('href', '/words')
})

it('heads the card with a free-play "Từ mới n/N" counter chip, and goes back to the topic island', () => {
  logActivity({ ts: Date.now(), kind: 'word', id: 'food-banana', score: 80 })
  renderCard('food', 'food-apple')

  const total = findTopic('food')!.words.length
  expect(screen.getByText(`Từ mới 1/${total}`)).toBeInTheDocument()
  expect(screen.queryByText('Từ mới hôm nay 🧩')).not.toBeInTheDocument()

  const back = topicBackLink('food')
  expect(back).toHaveAttribute('aria-label', findTopic('food')!.title)
})

it('shows the front face by default and flips to the Vietnamese/example face on tap', () => {
  renderCard('food', 'food-apple')
  passGuess('quả táo')
  expect(screen.getByText('apple')).toBeInTheDocument()
  expect(screen.getByText('/ˈæpəl/')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Lật thẻ' }))
  expect(screen.getByText('quả táo')).toBeInTheDocument()
  expect(screen.getByText('I eat an apple.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Lật thẻ' }))
  expect(screen.getByText('apple')).toBeInTheDocument()
})

it('flips on Enter/Space aimed at the card, but not on Enter aimed at an audio button on a face', () => {
  renderCard('food', 'food-apple')
  passGuess('quả táo')
  const shell = screen.getByTestId('flip-card')
  const FLIPPED = '[transform:rotateY(180deg)]'

  // A key press on a nested button bubbles to the card — it must not be swallowed as a flip,
  // or the button never gets to play its sound for a keyboard user.
  fireEvent.keyDown(screen.getByRole('button', { name: 'Nghe mẫu' }), { key: 'Enter' })
  expect(shell).not.toHaveClass(FLIPPED)

  // The card itself is the control now, so the keyboard path to the flip goes through it.
  fireEvent.keyDown(shell, { key: 'Enter' })
  expect(shell).toHaveClass(FLIPPED)

  fireEvent.keyDown(shell, { key: ' ' })
  expect(shell).not.toHaveClass(FLIPPED)
})

it('hides the face turned away from the accessibility tree and from the tab order', () => {
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  // Only the face the child is actually looking at is reachable: the other one is inert (no
  // focus, no clicks) and aria-hidden, so its buttons cannot be tabbed into through the card.
  expect(screen.getByTestId('face-front')).not.toHaveAttribute('aria-hidden')
  expect(screen.getByTestId('face-front')).not.toHaveAttribute('inert')
  expect(screen.getByTestId('face-back')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByTestId('face-back')).toHaveAttribute('inert')
  expect(screen.getAllByRole('button', { name: 'Lật thẻ' })).toHaveLength(1)

  fireEvent.click(screen.getByRole('button', { name: 'Lật thẻ' }))

  expect(screen.getByTestId('face-front')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByTestId('face-front')).toHaveAttribute('inert')
  expect(screen.getByTestId('face-back')).not.toHaveAttribute('aria-hidden')
  expect(screen.getByTestId('face-back')).not.toHaveAttribute('inert')
  expect(screen.getAllByRole('button', { name: 'Lật thẻ' })).toHaveLength(1)
})

/** The 🔄 buttons and the MẶT TRƯỚC/MẶT SAU chips asked a five-year-old to read labels before
 * touching anything; the whole card is the tap target now, announced as "Lật thẻ" (spec §6). */
it('drops the face chips and the 🔄 flip buttons, making the card itself the flip control', () => {
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  expect(screen.queryByText('MẶT TRƯỚC')).not.toBeInTheDocument()
  expect(screen.queryByText('MẶT SAU')).not.toBeInTheDocument()
  expect(within(screen.getByTestId('face-front')).queryByRole('button', { name: 'Lật thẻ' })).not.toBeInTheDocument()

  const shell = screen.getByTestId('flip-card')
  expect(shell).toHaveAttribute('role', 'button')
  expect(shell).toHaveAttribute('tabindex', '0')
  expect(shell).toHaveAttribute('aria-label', 'Lật thẻ')

  // Flipping does not grow a second flip control on the other face either.
  fireEvent.click(shell)
  expect(screen.queryByText('MẶT SAU')).not.toBeInTheDocument()
  expect(within(screen.getByTestId('face-back')).queryByText('Lật thẻ')).not.toBeInTheDocument()
})

/** A card that never moves does not say "turn me over". A slow, repeating peek does — until the
 * child flips it once, after which the lesson has landed and the movement is just noise. */
it('runs the peek hint only on an un-flipped card, and never again after the first flip', () => {
  promote('food-apple') // unlocked, so the card is on screen from the start
  renderCard('food', 'food-apple')
  const shell = screen.getByTestId('flip-card')
  expect(shell).toHaveClass('animate-peek')

  fireEvent.click(shell)
  expect(shell).not.toHaveClass('animate-peek')

  fireEvent.click(shell) // back to the front face — still no peek
  expect(shell).not.toHaveClass('animate-peek')
})

it('shows no peek hint while the meaning-guess step is up', () => {
  renderCard('food', 'food-apple')

  expect(screen.queryByTestId('flip-card')).not.toBeInTheDocument()
  expect(document.querySelector('.animate-peek')).toBeNull()

  passGuess('quả táo')
  expect(screen.getByTestId('flip-card')).toHaveClass('animate-peek')
})

/** Q9: three signals invite the flip — the peek, the corner icon, the hint line under the card —
 * and the icon is a one-time nudge: it disappears for good after the very first flip, home or
 * away. */
it('shows the 🔄 corner icon until the first flip, then retires it for good', () => {
  promote('food-apple')
  renderCard('food', 'food-apple')
  expect(screen.getByText('🔄')).toHaveClass('opacity-30')

  fireEvent.click(screen.getByTestId('flip-card'))
  expect(screen.queryByText('🔄')).not.toBeInTheDocument()

  fireEvent.click(screen.getByTestId('flip-card')) // flip home — the icon does not come back
  expect(screen.queryByText('🔄')).not.toBeInTheDocument()
})

/** Fix round 1: the mic and the flip are independent affordances — a child can speak without ever
 * tapping the card. A result is the same "stop nudging" signal as a flip or a recording, so the
 * peek animation and the 🔄 icon must not keep animating over an already-scored word. */
it('stops the peek animation and hides the 🔄 icon once a result exists, even if the card was never flipped', () => {
  promote('food-apple')
  renderCard('food', 'food-apple')
  expect(screen.getByTestId('flip-card')).toHaveClass('animate-peek')
  expect(screen.getByText('🔄')).toBeInTheDocument()

  score(resultHigh, null)

  expect(screen.getByTestId('flip-card')).not.toHaveClass('animate-peek')
  expect(screen.queryByText('🔄')).not.toBeInTheDocument()
})

/** Q9: "Mặt sau: nghĩa + câu ví dụ + 🔊" — no text label rides on the card faces themselves, this
 * line under the card is the only hint. It gives way to the compact result the moment there is
 * one, so it never sits stale under a card the child already answered for. */
it('shows the hint line under the card before a result, and drops it once a result lands', () => {
  promote('food-apple')
  renderCard('food', 'food-apple')
  expect(screen.getByText('Mặt sau: nghĩa + câu ví dụ + 🔊')).toBeInTheDocument()

  score(resultHigh, null)
  expect(screen.queryByText('Mặt sau: nghĩa + câu ví dụ + 🔊')).not.toBeInTheDocument()
})

it('plays the sample audio and clears the missing-audio notice on success', async () => {
  renderCard('food', 'food-apple')
  passGuess('quả táo')
  fireEvent.click(screen.getByRole('button', { name: 'Nghe mẫu' }))
  expect(playerMock.playUrl).toHaveBeenCalledWith('/audio/words/apple.mp3')
  await waitFor(() => expect(screen.queryByText('Chưa có audio mẫu')).not.toBeInTheDocument())
})

it('shows the missing-audio notice when sample playback fails', async () => {
  playerMock.playUrl.mockImplementationOnce(() => Promise.reject(new Error('no audio')))
  renderCard('food', 'food-apple')
  passGuess('quả táo')
  fireEvent.click(screen.getByRole('button', { name: 'Nghe mẫu' }))
  await waitFor(() => expect(screen.getByText('Chưa có audio mẫu')).toBeInTheDocument())
})

it('unlocks a locked word at score >= 60, logs the activity event, and saves the recording', () => {
  renderCard('food', 'food-apple')
  passGuess('quả táo')
  const blob = new Blob(['x'])

  score(resultHigh, blob)

  expect(getBox('food-apple')).toBe(1)
  expect(screen.getByText(/🔓 Đã mở khoá/)).toBeInTheDocument()
  expect(screen.getByText(/Điểm: 70/)).toBeInTheDocument()

  const events = JSON.parse(localStorage.getItem('speakup.activity') ?? '[]')
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({ kind: 'word', id: 'food-apple', score: 70 })
  expect(events[0].phonemes).toEqual([{ phoneme: 'a', score: 70 }])

  expect(recordingsMock.saveRecording).toHaveBeenCalledWith(
    expect.objectContaining({ id: expect.stringMatching(/^food-apple:\d+$/), text: 'apple', blob }),
  )
})

it('does not save a recording when no blob is available (web speech engine)', () => {
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  score(resultHigh, null)

  expect(recordingsMock.saveRecording).not.toHaveBeenCalled()
})

it('demotes an already-unlocked word (box 2) back to box 1 on a low score, and shows a retry hint', () => {
  promote('food-apple'); promote('food-apple') // box 2
  renderCard('food', 'food-apple')

  score(resultLow, null)

  expect(getBox('food-apple')).toBe(1)
  expect(screen.getByText('Thử lại nào!')).toBeInTheDocument()
  expect(screen.getByText(/Sửa từ này/)).toBeInTheDocument()
  expect(screen.getByText(/thử lại để mở khoá/)).toBeInTheDocument()

  const events = JSON.parse(localStorage.getItem('speakup.activity') ?? '[]')
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({ kind: 'word', id: 'food-apple', score: 40 })
})

it('a low score on a still-locked word stays locked (no box entry created)', () => {
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  score(resultLow, null)

  expect(getBox('food-apple')).toBe(0)
  expect(screen.getByText('Thử lại nào!')).toBeInTheDocument()
})

/** The attempt was scored all along — the screen simply never showed it, so a child who spoke saw
 * the 🔓 and nothing else (spec §7). */
it('shows the stars and the score of the attempt under the card', () => {
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  score(resultHigh, null)

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2) // 70 → 2 stars
  expect(screen.getAllByTestId('star-empty')).toHaveLength(1)
  expect(screen.getByText(/Điểm: 70/)).toBeInTheDocument()
})

/** The result reads as ONE card — stars, score, unlock line and the CTA row all inside
 * `ResultCard`, so nothing stacks into bands of its own that could push "Tiếp theo" off the fold. */
it('keeps the result in one compact ResultCard, stars and the unlock line on the head row', () => {
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  score(resultHigh, null)

  const card = screen.getByTestId('result-card')
  expect(within(card).getAllByTestId('star-filled')).toHaveLength(2)
  expect(within(card).getByText(/Điểm: 70/)).toBeInTheDocument()
  expect(within(card).getByText(/🔓 Đã mở khoá/)).toBeInTheDocument()
  expect(within(card).getByRole('button', { name: /Tiếp theo/ })).toBeInTheDocument()
})

it('shows the stars but no score chip when the engine returned no usable number', () => {
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  score(resultNoScore, null)

  expect(screen.getAllByTestId('star-filled')).toHaveLength(1)
  expect(screen.queryByText(/^Điểm:/)).not.toBeInTheDocument()
  // The retry hint still gets its say — the missing number costs the chip, nothing else.
  expect(screen.getByText(/Sửa từ này/)).toBeInTheDocument()
})

it('shows no stars before the first attempt', () => {
  promote('food-apple')
  renderCard('food', 'food-apple')

  expect(screen.queryByTestId('star-filled')).not.toBeInTheDocument()
  expect(screen.queryByTestId('star-empty')).not.toBeInTheDocument()
})

it('Thử lại clears the outcome so the child can record the word again', () => {
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  score(resultHigh, null)
  expect(screen.getByText(/🔓 Đã mở khoá/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }))

  expect(screen.queryByText(/🔓 Đã mở khoá/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Tiếp theo/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Bấm để nói' })).toBeInTheDocument()
})

it('Tiếp theo goes to the next word in topic order', () => {
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  score(resultHigh, null)
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  expect(screen.getByText('banana')).toBeInTheDocument()
})

it('Tiếp theo goes back to the topic island from the last word', () => {
  renderCard('food', 'food-cake')
  passGuess('bánh ngọt')

  score(resultHigh, null)
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  expect(screen.getByTestId('topic-hub')).toBeInTheDocument()
})

it('shows a simple-mode label for the webspeech engine', () => {
  mic.engine = 'webspeech'
  renderCard('food', 'food-apple')
  expect(screen.getByTestId('engine-badge')).toHaveTextContent('chế độ đơn giản')
})

it('a locked new word opens on a meaning-guess step: a wrong option shakes and invites another try, the right one praises and waits', () => {
  renderCard('food', 'food-apple')

  expect(screen.getByText('Từ này nghĩa là gì?')).toBeInTheDocument()
  expect(screen.getAllByRole('button')).toHaveLength(4) // 🔊 Nghe lại + the 3 meaning options, nothing else
  expect(screen.queryByRole('button', { name: 'Lật thẻ' })).not.toBeInTheDocument()
  expect(screen.queryByText('Đọc to từ trên thẻ nhé!')).not.toBeInTheDocument()

  const options = screen.getAllByRole('button').filter(b => b.textContent !== '🔊 Nghe lại')
  const correct = options.find(b => b.textContent?.includes('quả táo'))!
  const wrong = options.find(b => !b.textContent?.includes('quả táo'))!

  fireEvent.click(wrong)
  expect(screen.getByText('Thử lại nhé')).toBeInTheDocument()
  expect(wrong).toHaveClass('animate-shake')
  // Still on the guess step — a wrong pick does not skip ahead.
  expect(screen.getByText('Từ này nghĩa là gì?')).toBeInTheDocument()

  // The right one praises and stops there: the card and the mic are the *next* step, and the child
  // is the one who starts it (spec decision 3).
  fireEvent.click(correct)
  expect(screen.getByText('Đoán đúng rồi! 🎉')).toBeInTheDocument()
  expect(screen.getByText('Từ này nghĩa là gì?')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Lật thẻ' })).not.toBeInTheDocument()
  expect(screen.queryByText('Đọc to từ trên thẻ nhé!')).not.toBeInTheDocument()

  const cta = screen.getByRole('button', { name: 'Tiếp theo →' })
  // Q10: "CTA 56 ở footer" — the design's 56/64 px `md` size map, in the `PageFooter`.
  expect(cta).toHaveClass('min-h-[56px]', 'md:min-h-[64px]')

  fireEvent.click(cta)
  expect(screen.queryByText('Từ này nghĩa là gì?')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Lật thẻ' })).toBeInTheDocument()
  expect(screen.getByText('Đọc to từ trên thẻ nhé!')).toBeInTheDocument()
})

/** A bare "Đúng rồi! 🎉" sat exactly where the pronunciation score lands, so it read as praise for
 * a word the child had not spoken yet (spec §8). The praise now belongs to the step that earned it
 * and leaves with it, instead of being timed out on a screen it was never about. */
it('keeps the praise on the guess step, however long the child takes, and drops it on the way out', () => {
  vi.useFakeTimers()
  try {
    renderCard('food', 'food-apple')
    fireEvent.click(screen.getByRole('button', { name: 'quả táo' }))

    expect(screen.getByText('Đoán đúng rồi! 🎉')).toBeInTheDocument()

    // No timer retires the step any more: a child who looks away still finds the praise, the
    // answer they picked, and the button that moves on.
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByText('Đoán đúng rồi! 🎉')).toBeInTheDocument()
    expect(screen.queryByTestId('flip-card')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo →' }))

    // The speaking step opens on an un-flipped card, and with nothing said about a word the child
    // has not spoken yet.
    expect(screen.queryByText('Đoán đúng rồi! 🎉')).not.toBeInTheDocument()
    expect(screen.getByTestId('flip-card')).not.toHaveClass('[transform:rotateY(180deg)]')
  } finally {
    vi.useRealTimers()
  }
})

/** Once the meaning is settled, the options are a record of what the child chose — not three live
 * controls that can un-answer the step or shake at them while the praise is up. The other two are
 * dimmed and locked (Q10). */
it('locks the options after a correct guess, marks the one the child picked, and dims the other two', () => {
  renderCard('food', 'food-apple')
  const correct = screen.getByRole('button', { name: 'quả táo' })
  fireEvent.click(correct)

  expect(correct.className).toContain('shadow-[0_5px_0_#7ED99A,0_0_0_4px_#B9ECC8]')

  const wrong = screen.getAllByRole('button').find(b => !b.textContent?.includes('quả táo') && b.textContent !== '🔊 Nghe lại' && b.textContent !== 'Tiếp theo →')!
  expect(wrong).toBeDisabled()
  expect(wrong).toHaveClass('opacity-50')

  fireEvent.click(wrong)

  expect(wrong).not.toHaveClass('animate-shake')
  expect(screen.getByText('Đoán đúng rồi! 🎉')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tiếp theo →' })).toBeInTheDocument()
})

// --- phone layout (design §7 M5 / §8 M5b, round-2 Q9/R16) ------------------------------------
// jsdom has no layout engine, so these assert *which breakpoint each rule is written at* — the
// failure mode brief §15 is about. The geometry itself is measured in a real browser.

it('sizes the flip card to the screen on a phone and puts the fixed 320×360 back from md up', () => {
  promote('food-apple')
  renderCard('food', 'food-apple')

  const shell = screen.getByTestId('flip-card').parentElement!
  expect(shell).toHaveClass('w-[min(320px,82%)]', 'aspect-[16/17]', 'rounded-[30px]')
  expect(shell).toHaveClass('md:w-[320px]', 'md:aspect-auto', 'md:h-[360px]')
  // No unprefixed height at all: on a phone the ratio owns it.
  expect(shell.className).not.toMatch(/(^|\s)h-\[/)
})

/** R16: the card used to shrink to `md:h-[300px]` once a result landed — the design keeps it at
 * its full 360 so the child is never looking at a card that visibly changed shape underneath the
 * result it just earned. */
it('keeps the flip card at its full 360px size through the result — no shrink on a result', () => {
  promote('food-apple')
  renderCard('food', 'food-apple')

  score(resultHigh, null)

  const shell = screen.getByTestId('flip-card').parentElement!
  expect(shell).toHaveClass('w-[min(320px,82%)]', 'aspect-[16/17]', 'md:h-[360px]')
  expect(shell.className).not.toContain('md:h-[300px]')
  expect(shell.className).not.toMatch(/(^|\s)h-\[/)
})

it('shows the mic, and no ResultCard, before there is a result', () => {
  promote('food-apple')
  renderCard('food', 'food-apple')

  expect(screen.getByRole('button', { name: 'Bấm để nói' })).toBeInTheDocument()
  expect(screen.queryByTestId('result-card')).not.toBeInTheDocument()
})

/** R16: once a result lands the card holds `compact ResultCard` (no ScoredWords/bars rows) plus the
 * flip card, unmoved — the mic is redundant next to "Thử lại" on a phone but rides beside the CTA
 * from `md` up, so this only asserts *which breakpoint* hides it (jsdom has no layout engine). */
it('shows the compact ResultCard once a result exists, hides the mic at phone width, keeps it from md up, and leaves the flip card in place', () => {
  promote('food-apple')
  renderCard('food', 'food-apple')

  score(resultHigh, null)

  const card = screen.getByTestId('result-card')
  expect(within(card).getByRole('button', { name: /Thử lại/ })).toBeInTheDocument()
  expect(within(card).getByRole('button', { name: /Tiếp theo/ })).toBeInTheDocument()
  expect(card.querySelector('[data-row="words"]')).toBeNull()
  expect(card.querySelector('[data-row="bars"]')).toBeNull()

  const micButton = screen.getByRole('button', { name: 'Bấm để nói' })
  expect(ancestorWithClass(micButton, 'max-md:hidden')).toBeInTheDocument()

  // The flip card itself is untouched — this is the `teach` column, still on screen.
  expect(screen.getByTestId('flip-card')).toBeInTheDocument()
})

/** Nothing on this screen is `sticky` any more — the CTA row lives inside `ResultCard`, a sibling
 * of the scrolling `page-body`, never an opaque panel painted over the content behind it. */
it('carries the PageShell frame, never a sticky panel', () => {
  promote('food-apple')
  renderCard('food', 'food-apple')

  score(resultHigh, null)

  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
  expect(document.querySelector('main')!.innerHTML).not.toContain('sticky')
})

/** Q10/R17: the emoji hint stays visible at every width now (the code used to hide it behind
 * `md:hidden`, which iPad screenshots caught as a bare pill with no emoji at all). */
it('stacks the three meaning options as full-width 56px rows on a phone, keeps the pills from md up, and keeps the emoji at every width', () => {
  renderCard('food', 'food-apple')

  const option = screen.getByRole('button', { name: 'quả táo' })
  expect(option).toHaveClass('w-full', 'min-h-[56px]', 'md:w-auto', 'md:min-w-[160px]')
  expect(option.parentElement).toHaveClass('flex-col', 'md:flex-row', 'md:flex-wrap', 'md:justify-center')

  // The accessible name is still the Vietnamese meaning alone — the emoji stays `aria-hidden` at
  // every width, it just isn't `md:hidden` from the DOM any more (R17).
  const hint = option.querySelector('[aria-hidden="true"]')!
  expect(hint).not.toHaveClass('md:hidden')
  expect(hint.textContent).toBe(findTopic('food')!.words.find(w => w.id === 'food-apple')!.emoji)
})

it('sizes the "Nghe lại" replay button to 44 and replays the sample word from the guess step', () => {
  renderCard('food', 'food-apple')

  const replay = screen.getByRole('button', { name: '🔊 Nghe lại' })
  expect(replay).toHaveClass('min-h-[44px]')

  fireEvent.click(replay)
  expect(playerMock.playUrl).toHaveBeenCalledWith('/audio/words/apple.mp3')
})

it('an already-unlocked word skips the meaning-guess step', () => {
  promote('food-apple') // box 1 — no longer a brand-new word
  renderCard('food', 'food-apple')

  expect(screen.queryByText('Từ này nghĩa là gì?')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Lật thẻ' })).toBeInTheDocument()
  expect(screen.getByText('Đọc to từ trên thẻ nhé!')).toBeInTheDocument()
})

/** Headless screenshots (`docs/design/current/shoot.mjs`, `word-result3`) land straight on a
 * scored attempt via `?fixture=result3` — `useSpeakingAttempt` injects it on its own — with no
 * guess ever answered. The screen must not strand that shot behind an untouched guess step. */
it('skips the meaning-guess step when a DEV screenshot fixture already supplies a scored result', () => {
  mic.initialResult = resultHigh
  renderCard('food', 'food-apple') // still box 0 (locked) — would normally open on the guess step

  expect(screen.queryByText('Từ này nghĩa là gì?')).not.toBeInTheDocument()
  expect(screen.getByTestId('flip-card')).toBeInTheDocument()
  expect(screen.getByTestId('result-card')).toBeInTheDocument()
})

it('review mode hides the English word behind emoji + Vietnamese meaning until Gợi ý is pressed', () => {
  const past = Date.now() - 2 * 24 * 60 * 60 * 1000
  promote('food-apple', past) // due in the past, so it is a due review word
  renderCard('review', 'food-apple')

  // No guess step in review mode — recall is the point, not multiple choice.
  expect(screen.queryByText('Từ này nghĩa là gì?')).not.toBeInTheDocument()

  const front = within(screen.getByTestId('face-front'))
  expect(front.getByText('quả táo')).toBeInTheDocument()
  expect(front.getByText('?')).toBeInTheDocument()
  expect(screen.queryByText('apple')).not.toBeInTheDocument()

  fireEvent.click(front.getByRole('button', { name: 'Gợi ý' }))

  expect(front.getByText('apple')).toBeInTheDocument()
  expect(front.queryByText('?')).not.toBeInTheDocument()
})

/** 🔊 says the word out loud, so on a hidden review card it *is* the answer — leaving it on the
 * front face made "Gợi ý" pointless: one tap and the recall step is over. */
it('review mode withholds the front-face 🔊 until the hint is revealed', () => {
  const past = Date.now() - 2 * 24 * 60 * 60 * 1000
  promote('food-apple', past)
  renderCard('review', 'food-apple')

  const front = within(screen.getByTestId('face-front'))
  expect(front.queryByRole('button', { name: 'Nghe mẫu' })).not.toBeInTheDocument()

  fireEvent.click(front.getByRole('button', { name: 'Gợi ý' }))

  expect(front.getByRole('button', { name: 'Nghe mẫu' })).toBeInTheDocument()
})

it('keeps 🔊 on the front face outside the review deck', () => {
  promote('food-apple') // unlocked, so the card opens straight on the flip card
  renderCard('food', 'food-apple')

  expect(within(screen.getByTestId('face-front')).getByRole('button', { name: 'Nghe mẫu' })).toBeInTheDocument()
})

// --- as a step of today's lesson (spec §3) ---------------------------------------------------

it('numbers itself inside the lesson and threads back to the mission', () => {
  seedLesson(WORD_STEP, NEXT_STEP)
  renderCard('food', 'food-apple', true)

  expect(screen.getByText('Từ mới 1/2')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nhiệm vụ' })).toHaveAttribute('href', '/mission')
})

/** A word reached from the 🔁 group is numbered inside review, so "Từ mới 1/1" would name a group
 * this step is not in — and call a word the child is revisiting new. */
it('calls the step review when the lesson filed it under 🔁', () => {
  seedLesson({ ...WORD_STEP, kind: 'review' }, NEXT_STEP)
  renderCard('food', 'food-apple', true)

  expect(screen.getByText('Ôn tập 1/1')).toBeInTheDocument()
  expect(screen.queryByText(/^Từ mới \d/)).not.toBeInTheDocument()
})

/** The deck's own next word is banana; the lesson's next step is bread, and the lesson wins. */
it('follows the lesson rather than the deck on "Tiếp theo"', () => {
  seedLesson(WORD_STEP, NEXT_STEP)
  renderCard('food', 'food-apple', true)
  passGuess('quả táo')

  score(resultHigh, null)
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  expect(screen.getByText('bread')).toBeInTheDocument()
  expect(screen.queryByText('banana')).not.toBeInTheDocument()
  // …and the step it landed on is still numbered, so the flag travelled with it.
  expect(screen.getByText('Từ mới 2/2')).toBeInTheDocument()
})

it('ends at the mission screen when it is the last step of the lesson', () => {
  seedLesson(WORD_STEP)
  renderCard('food', 'food-apple', true)
  passGuess('quả táo')

  score(resultHigh, null)
  // The last step of the lesson says so — the CTA is not "Tiếp theo" any more.
  fireEvent.click(screen.getByRole('button', { name: /Hoàn thành/ }))

  expect(screen.getByTestId('probe')).toHaveTextContent('/mission null')
})

/** Today's lesson may well list this very word — but a child who walked in from the island did not
 * arrive carrying the flag, and nothing about the mission-specific parts of the screen may change
 * for them. The free-play deck counter still shows — it counts the topic deck, not the lesson. */
it('stays a free-play card without the flag, lesson or no lesson', () => {
  seedLesson(WORD_STEP, NEXT_STEP)
  renderCard('food', 'food-apple')

  const total = findTopic('food')!.words.length
  expect(screen.getByText(`Từ mới 1/${total}`)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Nhiệm vụ' })).not.toBeInTheDocument()
  expect(topicBackLink('food')).toHaveAttribute('href', '/topic/food')
})

// --- round-2 carrier: dimmed header, recording chip, processing, header stars badge ----------

it('dims the header, swaps the chip to "● Đang ghi", and shows the countdown row while recording', () => {
  promote('food-apple')
  renderCard('food', 'food-apple')

  startRecording()

  const back = topicBackLink('food').closest('div')!
  expect(back).toHaveClass('opacity-40', 'pointer-events-none')
  expect(screen.getByTestId('header-right')).toHaveClass('opacity-40', 'pointer-events-none')

  const chip = screen.getByText('● Đang ghi')
  expect(chip).toHaveClass('bg-coral-50', 'text-coral-text')
  const total = findTopic('food')!.words.length
  expect(screen.queryByText(`Từ mới 1/${total}`)).not.toBeInTheDocument()

  expect(screen.getByText('apple')).toBeInTheDocument() // the word itself stays put
  expect(screen.getByTestId('countdown-row')).toBeInTheDocument()
  expect(screen.getByText('Foxy đang lắng nghe…')).toBeInTheDocument()
})

it('hides the peek animation and the 🔄 corner icon while recording', () => {
  promote('food-apple')
  renderCard('food', 'food-apple')
  expect(screen.getByTestId('flip-card')).toHaveClass('animate-peek')
  expect(screen.getByText('🔄')).toBeInTheDocument()

  startRecording()

  expect(screen.getByTestId('flip-card')).not.toHaveClass('animate-peek')
  expect(screen.queryByText('🔄')).not.toBeInTheDocument()
})

/** Spec decision 17 (brief R23 "Đang chấm"): `processing` reads as an idle mic with an hourglass
 * and nothing else may react to it — no dimmed header, no "Đang ghi" chip, no shrunk card.
 * Rendered already in `processing` via `mic.initialMicState`, no post-mount `act()`. */
it('holds the teach column still while scoring — processing is not recording', () => {
  promote('food-apple')
  mic.initialMicState = 'processing'
  renderCard('food', 'food-apple')

  expect(screen.getByTestId('flip-card')).toBeInTheDocument()
  expect(screen.getByText('apple')).toBeInTheDocument()

  const back = topicBackLink('food').closest('div')!
  expect(back).not.toHaveClass('opacity-40')
  expect(screen.getByTestId('header-right')).not.toHaveClass('opacity-40')
  const total = findTopic('food')!.words.length
  expect(screen.getByText(`Từ mới 1/${total}`)).toBeInTheDocument()
  expect(screen.queryByText('● Đang ghi')).not.toBeInTheDocument()

  expect(screen.getByRole('button', { name: /đang chấm/i })).toBeInTheDocument()
})

// --- round-2 carrier: header right cell — total-stars badge vs LessonChip --------------------

it('shows a total-stars badge in the header when there is no lesson chip to show', () => {
  renderCard('food', 'food-apple')
  expect(screen.getByText(/^⭐ 0/)).toBeInTheDocument()
})

/** LessonChip only ever draws something when the exact route is one of today's items AND the
 * child did not already arrive carrying the mission flag (`isRedundant` in `components/LessonChip`)
 * — a free-play visit to a route that also happens to be today's step. That is the one case where
 * the header's right cell holds the lesson thread instead of the stars badge. */
it('shows the LessonChip instead of the stars badge when this exact route is a lesson step reached outside the mission flow', () => {
  seedLesson(WORD_STEP, NEXT_STEP)
  renderCard('food', 'food-apple') // no mission flag, but the route matches WORD_STEP

  expect(screen.getByRole('link', { name: /Nhiệm vụ/ })).toBeInTheDocument()
  expect(screen.queryByText(/^⭐/)).not.toBeInTheDocument()
})

/** Reached *through* the mission the chip is redundant with the screen's own controls (LessonChip
 * suppresses itself) — the header's right cell shows the stars badge there too. */
it('shows the stars badge, not the LessonChip, on a mission step (the chip would be redundant there)', () => {
  seedLesson(WORD_STEP, NEXT_STEP)
  renderCard('food', 'food-apple', true)

  expect(screen.queryByRole('link', { name: /^🌞/ })).not.toBeInTheDocument()
  expect(screen.getByText(/^⭐/)).toBeInTheDocument()
})
