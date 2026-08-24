import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { SpeakingAttempt } from '../speaking/useSpeakingAttempt'
import type { PronunciationResult } from '../scoring/types'
import { findSentence } from '../content'
import { shuffleTiles } from '../content/shuffle'

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

import { SentenceBuilder } from './SentenceBuilder'

const result85: PronunciationResult = {
  overall: 85, accuracy: 85, fluency: 85, completeness: 85,
  words: [{ word: 'I', score: 85, errorType: 'None', phonemes: [{ phoneme: 'ai', score: 85 }] }],
  engine: 'azure',
}

function renderBuilder(id: string) {
  render(
    <MemoryRouter initialEntries={[`/sentence/${id}`]}>
      <Routes>
        <Route path="/sentence/:id" element={<SentenceBuilder />} />
        <Route path="/sentences" element={<div>Danh sách câu</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Tap every tile of `sentence` in the exact pool (shuffled) order — since shuffleTiles guarantees
 * the shuffled order never equals the original for 2+ tiles, this always lands on the wrong order. */
function tapInShuffledOrder(sentenceId: string) {
  const sentence = findSentence(sentenceId)!
  const order = shuffleTiles(sentence.words.map((_, i) => i), sentence.id)
  order.forEach(idx => fireEvent.click(screen.getByRole('button', { name: sentence.words[idx] })))
}

function tapInCorrectOrder(sentenceId: string) {
  const sentence = findSentence(sentenceId)!
  sentence.words.forEach(w => fireEvent.click(screen.getByRole('button', { name: w })))
}

beforeEach(() => {
  localStorage.clear()
  attemptControl.current = baseAttempt()
  attemptControl.onResult = null
  playerMock.playUrl.mockClear()
  recordingsMock.saveRecording.mockClear()
})

it('shows a not-found message for an unknown sentence id', () => {
  renderBuilder('nope')
  expect(screen.getByText('Không tìm thấy câu')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Ghép câu/ })).toHaveAttribute('href', '/sentences')
})

it('shows the Vietnamese cue and all word tiles in the pool', () => {
  renderBuilder('s1')
  const sentence = findSentence('s1')!
  expect(screen.getByText(sentence.vi)).toBeInTheDocument()
  sentence.words.forEach(w => expect(within(screen.getByTestId('pool')).getByRole('button', { name: w })).toBeInTheDocument())
})

it('tapping pool tiles in order appends them to the tray in that order', () => {
  renderBuilder('s1')
  const sentence = findSentence('s1')!
  const order = shuffleTiles(sentence.words.map((_, i) => i), sentence.id)

  fireEvent.click(screen.getByRole('button', { name: sentence.words[order[0]] }))
  fireEvent.click(screen.getByRole('button', { name: sentence.words[order[1]] }))

  const tray = within(screen.getByTestId('tray'))
  expect(tray.getAllByRole('button').map(b => b.textContent)).toEqual([
    sentence.words[order[0]],
    sentence.words[order[1]],
  ])
})

it('tapping a tray tile returns it to the pool', () => {
  renderBuilder('s1')
  const sentence = findSentence('s1')!
  const word = sentence.words[0]

  fireEvent.click(screen.getByRole('button', { name: word }))
  expect(within(screen.getByTestId('tray')).getByRole('button', { name: word })).toBeInTheDocument()

  fireEvent.click(within(screen.getByTestId('tray')).getByRole('button', { name: word }))
  expect(within(screen.getByTestId('tray')).queryByRole('button', { name: word })).not.toBeInTheDocument()
  expect(within(screen.getByTestId('pool')).getByRole('button', { name: word })).toBeInTheDocument()
})

it('a wrong order shakes the tray, shows "Thử lại nhé", and restores the pool after 500ms', () => {
  vi.useFakeTimers()
  try {
    renderBuilder('s1')
    const sentence = findSentence('s1')!
    tapInShuffledOrder('s1')

    expect(screen.getByText('Thử lại nhé')).toBeInTheDocument()
    expect(screen.getByTestId('tray')).toHaveClass('animate-shake')

    act(() => { vi.advanceTimersByTime(500) })

    expect(screen.getByTestId('tray')).not.toHaveClass('animate-shake')
    expect(within(screen.getByTestId('pool')).getAllByRole('button')).toHaveLength(sentence.words.length)
    expect(screen.getByTestId('tray').children).toHaveLength(0)
  } finally {
    vi.useRealTimers()
  }
})

it('clears the shake-restore timer on unmount without throwing', () => {
  vi.useFakeTimers()
  try {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/sentence/s1']}>
        <Routes>
          <Route path="/sentence/:id" element={<SentenceBuilder />} />
        </Routes>
      </MemoryRouter>,
    )
    tapInShuffledOrder('s1')
    expect(screen.getByText('Thử lại nhé')).toBeInTheDocument()
    unmount()
    expect(() => act(() => { vi.advanceTimersByTime(500) })).not.toThrow()
  } finally {
    vi.useRealTimers()
  }
})

it('a correct order shows "Đúng rồi!", plays the sample audio, and reveals the mic', async () => {
  renderBuilder('s1')
  const sentence = findSentence('s1')!
  tapInCorrectOrder('s1')

  expect(screen.getByText('Đúng rồi! 🎉')).toBeInTheDocument()
  await waitFor(() => expect(playerMock.playUrl).toHaveBeenCalledWith(sentence.audio))
  expect(screen.getByRole('button', { name: 'Bấm để nói' })).toBeInTheDocument()
})

it('shows the missing-audio notice when the sample fails to play', async () => {
  playerMock.playUrl.mockImplementationOnce(() => Promise.reject(new Error('no audio')))
  renderBuilder('s1')
  tapInCorrectOrder('s1')
  await waitFor(() => expect(screen.getByText('Chưa có audio mẫu')).toBeInTheDocument())
})

it('a spoken score of 85 shows 3 filled stars, stores sentence:s1 = 3, and logs a sentence activity event', () => {
  attemptControl.current = { ...baseAttempt(), result: result85 }
  renderBuilder('s1')
  tapInCorrectOrder('s1')
  expect(screen.getByText('Đúng rồi! 🎉')).toBeInTheDocument()

  const blob = new Blob(['x'])
  act(() => { attemptControl.onResult?.(result85, blob) })

  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)

  const stars = JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')
  expect(stars['sentence:s1']).toBe(3)

  const events = JSON.parse(localStorage.getItem('speakup.activity') ?? '[]')
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({ kind: 'sentence', id: 's1', score: 85 })

  expect(recordingsMock.saveRecording).toHaveBeenCalledWith(
    expect.objectContaining({ id: expect.stringMatching(/^s1:\d+$/), text: 'I eat an apple.', blob }),
  )
})

it('does not save a recording when no blob is available (web speech engine)', () => {
  attemptControl.current = { ...baseAttempt(), result: result85 }
  renderBuilder('s1')
  tapInCorrectOrder('s1')

  act(() => { attemptControl.onResult?.(result85, null) })

  expect(recordingsMock.saveRecording).not.toHaveBeenCalled()
})

it('"Tiếp theo" goes to the next sentence in SENTENCES order', () => {
  attemptControl.current = { ...baseAttempt(), result: result85 }
  renderBuilder('s1')
  tapInCorrectOrder('s1')

  act(() => { attemptControl.onResult?.(result85, null) })
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  const sentence2 = findSentence('s2')!
  expect(screen.getByText(sentence2.vi)).toBeInTheDocument()
})

it('"Tiếp theo" goes back to the sentence list from the last sentence', () => {
  attemptControl.current = { ...baseAttempt(), result: result85 }
  renderBuilder('s20')
  tapInCorrectOrder('s20')

  act(() => { attemptControl.onResult?.(result85, null) })
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  expect(screen.getByText('Danh sách câu')).toBeInTheDocument()
})

it('"Thử lại" resets the spoken attempt', () => {
  attemptControl.current = { ...baseAttempt(), result: result85 }
  renderBuilder('s1')
  tapInCorrectOrder('s1')

  act(() => { attemptControl.onResult?.(result85, null) })
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))

  expect((attemptControl.current as SpeakingAttempt).reset).toHaveBeenCalled()
})
