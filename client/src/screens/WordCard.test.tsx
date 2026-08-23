import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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
import { getBox, promote } from '../progress/leitner'

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

function renderCard(topic: string, wordId: string) {
  render(
    <MemoryRouter initialEntries={[`/words/${topic}/${wordId}`]}>
      <Routes>
        <Route path="/words/:topic/:wordId" element={<WordCard />} />
        <Route path="/words/:topic" element={<WordList />} />
      </Routes>
    </MemoryRouter>,
  )
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

it('shows the front face by default and flips to the Vietnamese/example face on tap', () => {
  renderCard('food', 'food-apple')
  expect(screen.getByText('apple')).toBeInTheDocument()
  expect(screen.getByText('/ˈæpəl/')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Lật thẻ' }))
  expect(screen.getByText('quả táo')).toBeInTheDocument()
  expect(screen.getByText('I eat an apple.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Lật thẻ' }))
  expect(screen.getByText('apple')).toBeInTheDocument()
})

it('plays the sample audio and clears the missing-audio notice on success', async () => {
  renderCard('food', 'food-apple')
  fireEvent.click(screen.getByRole('button', { name: '🔊' }))
  expect(playerMock.playUrl).toHaveBeenCalledWith('/audio/words/apple.mp3')
  await waitFor(() => expect(screen.queryByText('Chưa có audio mẫu')).not.toBeInTheDocument())
})

it('shows the missing-audio notice when sample playback fails', async () => {
  playerMock.playUrl.mockImplementationOnce(() => Promise.reject(new Error('no audio')))
  renderCard('food', 'food-apple')
  fireEvent.click(screen.getByRole('button', { name: '🔊' }))
  await waitFor(() => expect(screen.getByText('Chưa có audio mẫu')).toBeInTheDocument())
})

it('unlocks a locked word at score >= 60, logs the activity event, and saves the recording', () => {
  attemptControl.current = { ...baseAttempt(), result: resultHigh }
  renderCard('food', 'food-apple')
  const blob = new Blob(['x'])

  act(() => { attemptControl.onResult?.(resultHigh, blob) })

  expect(getBox('food-apple')).toBe(1)
  expect(screen.getByText('🔓 Mở khoá!')).toBeInTheDocument()

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

  act(() => { attemptControl.onResult?.(resultLow, null) })

  expect(getBox('food-apple')).toBe(0)
  expect(screen.getByText('Thử lại nhé')).toBeInTheDocument()
})

it('Thử lại clears the outcome so the child can record the word again', () => {
  attemptControl.current = { ...baseAttempt(), result: resultHigh }
  renderCard('food', 'food-apple')

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

  act(() => { attemptControl.onResult?.(resultHigh, null) })
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  expect(screen.getByText('banana')).toBeInTheDocument()
})

it('Tiếp theo goes back to the topic list from the last word', () => {
  attemptControl.current = { ...baseAttempt(), result: resultHigh }
  renderCard('food', 'food-cake')

  act(() => { attemptControl.onResult?.(resultHigh, null) })
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  expect(screen.getByText('Đồ ăn')).toBeInTheDocument()
})

it('shows a simple-mode label for the webspeech engine', () => {
  attemptControl.current = { ...baseAttempt(), engine: 'webspeech' }
  renderCard('food', 'food-apple')
  expect(screen.getByText('chế độ đơn giản')).toBeInTheDocument()
})
