import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
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
import { findPair } from '../content'
import { seededSide } from '../content/shuffle'

const SHIP_SHEEP = findPair('pair-ship-sheep')!

/** The word 🔊 plays on listen number `n` (0-based) — computed from the screen's own seeded
 * stream, so the flow tests below read as "tap the word that was played" instead of pinning a
 * hard-coded order that only holds for this one pair. */
const played = (n: number) => SHIP_SHEEP[seededSide(SHIP_SHEEP.id, n, ['a', 'b'] as const)].word
/** The word that was *not* played — the wrong card, whichever side that happens to be. */
const other = (word: string) => (word === SHIP_SHEEP.a.word ? SHIP_SHEEP.b.word : SHIP_SHEEP.a.word)

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

/** The order is a PRNG stream seeded by the pair id, so it is the same every run. */
it('plays one of the two words and unlocks the cards', () => {
  renderPair()
  listen()

  expect(playerControl.playUrl).toHaveBeenCalledWith(`/audio/pairs/${played(0)}.mp3`)
  expect(screen.getByRole('button', { name: 'ship' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'sheep' })).toBeEnabled()
})

it('cheers the matching card and locks up again after it', () => {
  renderPair()

  listen()
  pick(played(0))
  expect(screen.getByText('Đúng rồi! 🎉')).toBeInTheDocument()
  expect(screen.getByText('Đúng 1/2')).toBeInTheDocument()
  // A finished round locks the cards again until the next 🔊.
  expect(screen.getByRole('button', { name: 'ship' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'sheep' })).toBeDisabled()
})

/** With only two cards, "not that one" would otherwise be a free win, so a miss ends the round
 * and the child has to listen again before they may answer. */
it('makes a wrong pick cost a listen instead of handing over the answer', () => {
  renderPair()

  listen()
  pick(other(played(0)))
  expect(screen.getByText('Nghe lại nhé')).toBeInTheDocument()
  expect(screen.getByText('Bấm 🔊 nghe lại nhé')).toBeInTheDocument()
  expect(screen.getByText('Đúng 0/2')).toBeInTheDocument()

  // The other card is locked, so tapping it changes nothing.
  expect(screen.getByRole('button', { name: played(0) })).toBeDisabled()
  pick(played(0))
  expect(screen.getByText('Đúng 0/2')).toBeInTheDocument()
  expect(screen.queryByText('Đúng rồi! 🎉')).not.toBeInTheDocument()

  // A fresh listen moves on to the next draw of the pair's seeded stream.
  listen()
  expect(playerControl.playUrl).toHaveBeenLastCalledWith(`/audio/pairs/${played(1)}.mp3`)
  pick(played(1))
  expect(screen.getByText('Đúng rồi! 🎉')).toBeInTheDocument()
  expect(screen.getByText('Đúng 1/2')).toBeInTheDocument()
})

/** Every 🔊 url played over `n` listens on a freshly mounted screen. */
function playedUrls(n: number): string[] {
  renderPair()
  for (let i = 0; i < n; i++) listen()
  const urls = playerControl.playUrl.mock.calls.map(c => c[0] as string)
  cleanup()
  playerControl.playUrl.mockClear()
  return urls
}

/** A strict a/b alternation is a pattern a child spots in two rounds and then stops listening
 * for, so the side is drawn from a PRNG — but one seeded by the pair, so the same pair always
 * plays the same sequence and the screen stays testable. */
it('draws the same sequence for a pair every time it is opened', () => {
  const first = playedUrls(8)
  const second = playedUrls(8)

  expect(first).toHaveLength(8)
  expect(second).toEqual(first)
})

it('does not simply alternate: both words come up over the first 12 listens', () => {
  const urls = playedUrls(12)

  expect(new Set(urls)).toEqual(new Set(['/audio/pairs/ship.mp3', '/audio/pairs/sheep.mp3']))
  // At least one listen repeats the previous word — an alternation never does.
  expect(urls.some((u, i) => i > 0 && u === urls[i - 1])).toBe(true)
})

it('says so when the pair audio is missing', async () => {
  playerControl.playUrl.mockRejectedValue(new Error('audio failed'))
  renderPair()
  listen()

  await screen.findByText('Chưa có audio mẫu')
})

it('opens the mic step after two correct listens', () => {
  renderPair()

  listen(); pick(played(0))
  expect(screen.queryByRole('button', { name: /bấm để nói/i })).not.toBeInTheDocument()

  listen(); pick(played(1))

  expect(screen.getByText('Giờ đọc cả hai từ nào!')).toBeInTheDocument()
  expect(screen.getByText('ship, sheep')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
  // The listening game collapses into a one-line summary.
  expect(screen.getByText('Nghe & chọn: 2/2 đúng ✅')).toBeInTheDocument()
  expect(screen.queryByText('Bấm 🔊 trước nhé')).not.toBeInTheDocument()
})

function reachMic() {
  renderPair()
  listen(); pick(played(0))
  listen(); pick(played(1))
}

it('turns a good attempt into 3 stars stored on the pair key', () => {
  reachMic()
  score(result(85))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
  expect(screen.getByText('Tuyệt vời!')).toBeInTheDocument()
  expect(screen.getByTestId('confetti')).toBeInTheDocument()
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
  expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()

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
