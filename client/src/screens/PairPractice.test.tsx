import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'

/** The hook is mocked, not the recorder + scorer: these tests are about what PairPractice does
 * with a result, and `useSpeakingAttempt` is covered by its own suite and PracticeCard.test. */
const mic = vi.hoisted(() => ({ push: (_r: PronunciationResult) => {} }))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    const [result, setResult] = useState<PronunciationResult | null>(null)
    useEffect(() => { setResult(null) }, [opts.resetKey])
    mic.push = (r: PronunciationResult) => { setResult(r); opts.onResult?.(r, null) }
    return {
      micState: 'idle' as const, level: 0, engine: 'azure' as const,
      result, error: null, lastBlob: null,
      onMic: () => {}, reset: () => setResult(null),
    }
  },
}))
const playerControl = vi.hoisted(() => ({ playUrl: vi.fn() }))
vi.mock('../audio/player', () => ({ playUrl: playerControl.playUrl, playBlob: vi.fn().mockResolvedValue(undefined) }))

import { PairPractice } from './PairPractice'

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

function score(r: PronunciationResult) {
  act(() => { mic.push(r) })
}

function renderPair(id = 'pair-ship-sheep') {
  render(
    <MemoryRouter initialEntries={[`/pair/${id}`]}>
      <Routes>
        <Route path="/pair/:id" element={<PairPractice />} />
        <Route path="/level/minimal-pairs" element={<p>các cặp từ</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const listen = () => fireEvent.click(screen.getByRole('button', { name: /nghe/i }))
const pick = (word: string) => fireEvent.click(screen.getByRole('button', { name: word }))

beforeEach(() => {
  localStorage.clear()
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
})

it('opens on the two options, locked until the child has listened', () => {
  renderPair()

  expect(screen.getByText('Cặp 1/8')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'ship' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'sheep' })).toBeDisabled()
  expect(screen.getByText('Bấm 🔊 trước nhé')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/level/minimal-pairs')
})

/** The order is seeded by the pair id (odd length → `b` first), so it is the same every run. */
it('plays one of the two words and unlocks the cards', () => {
  renderPair()
  listen()

  expect(playerControl.playUrl).toHaveBeenCalledWith('/audio/pairs/sheep.mp3')
  expect(screen.getByRole('button', { name: 'ship' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'sheep' })).toBeEnabled()
})

it('cheers the matching card and shrugs at the wrong one', () => {
  renderPair()

  listen()
  pick('ship') // "sheep" was played
  expect(screen.getByText('Nghe lại nhé')).toBeInTheDocument()
  expect(screen.getByText('Đúng 0/2')).toBeInTheDocument()

  pick('sheep')
  expect(screen.getByText('Đúng rồi! 🎉')).toBeInTheDocument()
  expect(screen.getByText('Đúng 1/2')).toBeInTheDocument()
  // A finished round locks the cards again until the next 🔊.
  expect(screen.getByRole('button', { name: 'ship' })).toBeDisabled()
})

it('alternates the played word between listens', () => {
  renderPair()
  listen()
  pick('sheep')
  listen()

  expect(playerControl.playUrl).toHaveBeenLastCalledWith('/audio/pairs/ship.mp3')
})

it('says so when the pair audio is missing', async () => {
  playerControl.playUrl.mockRejectedValue(new Error('audio failed'))
  renderPair()
  listen()

  await screen.findByText('Chưa có audio mẫu')
})

it('opens the mic step after two correct listens', () => {
  renderPair()

  listen(); pick('sheep')
  expect(screen.queryByRole('button', { name: /bấm để nói/i })).not.toBeInTheDocument()

  listen(); pick('ship')

  expect(screen.getByText('Giờ đọc cả hai từ nào!')).toBeInTheDocument()
  expect(screen.getByText('ship, sheep')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
  // The listening game collapses into a one-line summary.
  expect(screen.getByText('Nghe & chọn: 2/2 đúng ✅')).toBeInTheDocument()
  expect(screen.queryByText('Bấm 🔊 trước nhé')).not.toBeInTheDocument()
})

function reachMic() {
  renderPair()
  listen(); pick('sheep')
  listen(); pick('ship')
}

it('turns a good attempt into 3 stars stored on the pair key', () => {
  reachMic()
  score(result(85))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
  expect(screen.getByText('Tuyệt vời!')).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')).toMatchObject({ 'pair:pair-ship-sheep': 3 })
  expect(JSON.parse(localStorage.getItem('speakup.activity') ?? '[]'))
    .toContainEqual(expect.objectContaining({ kind: 'speak', id: 'pair-ship-sheep' }))
  // Both words are shown back with their own tone.
  expect(screen.getByRole('button', { name: 'ship tốt' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'sheep tốt' })).toBeInTheDocument()
})

it('offers a hint and a retry when the attempt was weak', () => {
  reachMic()
  score(result(50))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(1)
  expect(screen.getByText(/Sửa từ này/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
  expect(screen.getByText('Giờ đọc cả hai từ nào!')).toBeInTheDocument()
})

it('hands on to the next pair, and back to the level on the last one', () => {
  reachMic()
  score(result(85))
  expect(screen.getByRole('button', { name: /tiếp theo/i })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByText('Cặp 2/8')).toBeInTheDocument()
})

it('shows a not-found message for a pair that does not exist', () => {
  renderPair('nope')
  expect(screen.getByText('Không tìm thấy cặp từ')).toBeInTheDocument()
})
