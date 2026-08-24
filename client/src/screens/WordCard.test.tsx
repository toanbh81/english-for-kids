import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { SpeakingAttempt } from '../speaking/useSpeakingAttempt'
import type { PronunciationResult } from '../scoring/types'

function baseAttempt(): SpeakingAttempt {
  return {
    micState: 'idle',
    level: 0,
    engine: 'azure',
    result: null,
    error: null,
    lastBlob: null,
    onMic: vi.fn(),
    reset: vi.fn(),
  }
}

type OnResult = (r: PronunciationResult, blob: Blob | null) => void

const attemptControl = vi.hoisted(() => ({ current: null as unknown, onResult: null as OnResult | null }))

vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt: (opts: { onResult?: OnResult }) => {
    attemptControl.onResult = opts.onResult ?? null
    return attemptControl.current
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
 * Vietnamese meaning would. */
function passGuess(vi: string) {
  fireEvent.click(screen.getByRole('button', { name: vi }))
}

beforeEach(() => {
  localStorage.clear()
  attemptControl.current = baseAttempt()
  attemptControl.onResult = null
  playerMock.playUrl.mockClear()
  recordingsMock.saveRecording.mockClear()
})

it('shows a not-found message for an unknown word id', () => {
  renderCard('food', 'nope')
  expect(screen.getByText('Không tìm thấy từ')).toBeInTheDocument()
})

// The header used to carry an "x/3" counter left over from the legacy word mission. The daily
// lesson owns that count now, and a second copy here only argued with the mission screen.
it('heads the card without a mission counter, and goes back to the topic island', () => {
  logActivity({ ts: Date.now(), kind: 'word', id: 'food-banana', score: 80 })
  renderCard('food', 'food-apple')

  expect(screen.getByText('Từ mới hôm nay 🧩')).toBeInTheDocument()
  expect(screen.getByText('Chạm thẻ để lật — nói đúng để mở khoá!')).toBeInTheDocument()
  expect(screen.queryByText('1/3')).not.toBeInTheDocument()

  const back = screen.getAllByRole('link').find(a => a.getAttribute('href') === '/topic/food')
  expect(back).toBeDefined()
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
  attemptControl.current = { ...baseAttempt(), result: resultHigh }
  renderCard('food', 'food-apple')
  passGuess('quả táo')
  const blob = new Blob(['x'])

  act(() => { attemptControl.onResult?.(resultHigh, blob) })

  expect(getBox('food-apple')).toBe(1)
  expect(screen.getByText('🔓 Mở khoá!')).toBeInTheDocument()
  expect(screen.getByText('Điểm: 70')).toBeInTheDocument()

  const events = JSON.parse(localStorage.getItem('speakup.activity') ?? '[]')
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({ kind: 'word', id: 'food-apple', score: 70 })
  expect(events[0].phonemes).toEqual([{ phoneme: 'a', score: 70 }])

  expect(recordingsMock.saveRecording).toHaveBeenCalledWith(
    expect.objectContaining({ id: expect.stringMatching(/^food-apple:\d+$/), text: 'apple', blob }),
  )
})

it('does not save a recording when no blob is available (web speech engine)', () => {
  attemptControl.current = { ...baseAttempt(), result: resultHigh }
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  act(() => { attemptControl.onResult?.(resultHigh, null) })

  expect(recordingsMock.saveRecording).not.toHaveBeenCalled()
})

it('demotes an already-unlocked word (box 2) back to box 1 on a low score, and shows a retry hint', () => {
  promote('food-apple'); promote('food-apple') // box 2
  attemptControl.current = { ...baseAttempt(), result: resultLow }
  renderCard('food', 'food-apple')

  act(() => { attemptControl.onResult?.(resultLow, null) })

  expect(getBox('food-apple')).toBe(1)
  expect(screen.getByText('Thử lại nhé')).toBeInTheDocument()
  expect(screen.getByText(/Sửa từ này/)).toBeInTheDocument()

  const events = JSON.parse(localStorage.getItem('speakup.activity') ?? '[]')
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({ kind: 'word', id: 'food-apple', score: 40 })
})

it('a low score on a still-locked word stays locked (no box entry created)', () => {
  attemptControl.current = { ...baseAttempt(), result: resultLow }
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  act(() => { attemptControl.onResult?.(resultLow, null) })

  expect(getBox('food-apple')).toBe(0)
  expect(screen.getByText('Thử lại nhé')).toBeInTheDocument()
})

/** The attempt was scored all along — the screen simply never showed it, so a child who spoke saw
 * the 🔓 and nothing else (spec §7). */
it('shows the stars and the score of the attempt under the card', () => {
  attemptControl.current = { ...baseAttempt(), result: resultHigh }
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  act(() => { attemptControl.onResult?.(resultHigh, null) })

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2) // 70 → 2 stars
  expect(screen.getAllByTestId('star-empty')).toHaveLength(1)
  expect(screen.getByText('Điểm: 70')).toBeInTheDocument()
})

it('shows the stars but no score chip when the engine returned no usable number', () => {
  attemptControl.current = { ...baseAttempt(), result: resultNoScore }
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  act(() => { attemptControl.onResult?.(resultNoScore, null) })

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
  attemptControl.current = { ...baseAttempt(), result: resultHigh }
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  act(() => { attemptControl.onResult?.(resultHigh, null) })
  expect(screen.getByText('🔓 Mở khoá!')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))

  expect(screen.queryByText('🔓 Mở khoá!')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Tiếp theo/ })).not.toBeInTheDocument()
  expect((attemptControl.current as SpeakingAttempt).reset).toHaveBeenCalled()
})

it('Tiếp theo goes to the next word in topic order', () => {
  attemptControl.current = { ...baseAttempt(), result: resultHigh }
  renderCard('food', 'food-apple')
  passGuess('quả táo')

  act(() => { attemptControl.onResult?.(resultHigh, null) })
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  expect(screen.getByText('banana')).toBeInTheDocument()
})

it('Tiếp theo goes back to the topic island from the last word', () => {
  attemptControl.current = { ...baseAttempt(), result: resultHigh }
  renderCard('food', 'food-cake')
  passGuess('bánh ngọt')

  act(() => { attemptControl.onResult?.(resultHigh, null) })
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  expect(screen.getByTestId('topic-hub')).toBeInTheDocument()
})

it('shows a simple-mode label for the webspeech engine', () => {
  attemptControl.current = { ...baseAttempt(), engine: 'webspeech' }
  renderCard('food', 'food-apple')
  expect(screen.getByText('chế độ đơn giản')).toBeInTheDocument()
})

it('a locked new word opens on a meaning-guess step: a wrong option shakes and invites another try, the right one reveals the card and mic', () => {
  renderCard('food', 'food-apple')

  expect(screen.getByText('Từ này nghĩa là gì?')).toBeInTheDocument()
  expect(screen.getAllByRole('button')).toHaveLength(3) // the 3 meaning options, nothing else
  expect(screen.queryByRole('button', { name: 'Lật thẻ' })).not.toBeInTheDocument()
  expect(screen.queryByText('🎤 Nói để mở khoá')).not.toBeInTheDocument()

  const options = screen.getAllByRole('button')
  const correct = options.find(b => b.textContent === 'quả táo')!
  const wrong = options.find(b => b.textContent !== 'quả táo')!

  fireEvent.click(wrong)
  expect(screen.getByText('Thử lại nhé')).toBeInTheDocument()
  expect(wrong).toHaveClass('animate-shake')
  // Still on the guess step — a wrong pick does not skip ahead.
  expect(screen.getByText('Từ này nghĩa là gì?')).toBeInTheDocument()

  fireEvent.click(correct)
  expect(screen.queryByText('Từ này nghĩa là gì?')).not.toBeInTheDocument()
  expect(screen.getByText('Đoán đúng rồi! 🎉')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Lật thẻ' })).toBeInTheDocument()
  expect(screen.getByText('🎤 Nói để mở khoá')).toBeInTheDocument()
})

/** A bare "Đúng rồi! 🎉" sat exactly where the pronunciation score lands and stayed until the first
 * flip, so it read as praise for a word the child had not spoken yet (spec §8). */
it('praises the guess as a guess, and clears the praise on its own after 1.5 s', () => {
  vi.useFakeTimers()
  try {
    renderCard('food', 'food-apple')
    passGuess('quả táo')

    expect(screen.getByText('Đoán đúng rồi! 🎉')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(1500) })

    expect(screen.queryByText('Đoán đúng rồi! 🎉')).not.toBeInTheDocument()
    // …and it is gone without the child having touched the card.
    expect(screen.getByTestId('flip-card')).not.toHaveClass('[transform:rotateY(180deg)]')
  } finally {
    vi.useRealTimers()
  }
})

it('an already-unlocked word skips the meaning-guess step', () => {
  promote('food-apple') // box 1 — no longer a brand-new word
  renderCard('food', 'food-apple')

  expect(screen.queryByText('Từ này nghĩa là gì?')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Lật thẻ' })).toBeInTheDocument()
  expect(screen.getByText('🎤 Nói để mở khoá')).toBeInTheDocument()
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

/** The deck's own next word is banana; the lesson's next step is bread, and the lesson wins. */
it('follows the lesson rather than the deck on "Tiếp theo"', () => {
  attemptControl.current = { ...baseAttempt(), result: resultHigh }
  seedLesson(WORD_STEP, NEXT_STEP)
  renderCard('food', 'food-apple', true)
  passGuess('quả táo')

  act(() => { attemptControl.onResult?.(resultHigh, null) })
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  expect(screen.getByText('bread')).toBeInTheDocument()
  expect(screen.queryByText('banana')).not.toBeInTheDocument()
  // …and the step it landed on is still numbered, so the flag travelled with it.
  expect(screen.getByText('Từ mới 2/2')).toBeInTheDocument()
})

it('ends at the mission screen when it is the last step of the lesson', () => {
  attemptControl.current = { ...baseAttempt(), result: resultHigh }
  seedLesson(WORD_STEP)
  renderCard('food', 'food-apple', true)
  passGuess('quả táo')

  act(() => { attemptControl.onResult?.(resultHigh, null) })
  // The last step of the lesson says so — the CTA is not "Tiếp theo" any more.
  fireEvent.click(screen.getByRole('button', { name: /Hoàn thành/ }))

  expect(screen.getByTestId('probe')).toHaveTextContent('/mission null')
})

/** Today's lesson may well list this very word — but a child who walked in from the island did not
 * arrive carrying the flag, and nothing about the screen may change for them. */
it('stays a free-play card without the flag, lesson or no lesson', () => {
  seedLesson(WORD_STEP, NEXT_STEP)
  renderCard('food', 'food-apple')

  expect(screen.queryByText(/^Từ mới \d/)).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Nhiệm vụ' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: findTopic('food')!.title })).toHaveAttribute('href', '/topic/food')
})
