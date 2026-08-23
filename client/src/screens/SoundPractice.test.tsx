import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'

/** The hook is mocked, not the recorder + scorer: these tests are about what SoundPractice does
 * with a result, and `useSpeakingAttempt` is covered by its own suite and PracticeCard.test. */
const mic = vi.hoisted(() => ({ push: (_r: PronunciationResult) => {} }))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    const [result, setResult] = useState<PronunciationResult | null>(null)
    // The real hook drops the result whenever the reset key changes — here, on the next word.
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

import { SoundPractice } from './SoundPractice'
import { PHONEME_TIPS } from '../scoring/feedback'

/** One attempt on the word `three`: `ph` is the target phoneme's score, `null` = no detail at all. */
function result(ph: number | null, overall = 90): PronunciationResult {
  return {
    overall, accuracy: overall, fluency: overall, completeness: 100, engine: 'azure',
    words: [{ word: 'three', score: overall, errorType: 'None', phonemes: ph === null ? [] : [{ phoneme: 'th', score: ph }] }],
  }
}

function score(r: PronunciationResult) {
  act(() => { mic.push(r) })
}

function renderSound(ph = 'th') {
  render(
    <MemoryRouter initialEntries={[`/sound/${ph}`]}>
      <Routes>
        <Route path="/sound/:ph" element={<SoundPractice />} />
        <Route path="/level/:levelId" element={<p>các âm</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
})

it('leads with the sound itself and the first of its three words', () => {
  renderSound()
  expect(screen.getByText('/θ/')).toBeInTheDocument()
  expect(screen.getByText(PHONEME_TIPS.th)).toBeInTheDocument()
  expect(screen.getByText('three')).toBeInTheDocument()
  expect(screen.getByText('Từ 1/3')).toBeInTheDocument()
})

it('plays the sound on its own, and says so when that sample is missing', async () => {
  playerControl.playUrl.mockReturnValue(new Promise<void>(() => {})) // still playing: no state change yet
  renderSound()
  fireEvent.click(screen.getByRole('button', { name: /nghe âm lẻ/i }))
  expect(playerControl.playUrl).toHaveBeenCalledWith('/audio/sounds/th.mp3')

  playerControl.playUrl.mockRejectedValue(new Error('audio failed'))
  fireEvent.click(screen.getByRole('button', { name: /nghe âm lẻ/i }))
  await screen.findByText('Chưa có audio âm này')
})

it('scores only the target sound: a good phoneme needs no tip', () => {
  renderSound()
  score(result(92))

  const chip = screen.getByTestId('sound-chip')
  expect(chip).toHaveAttribute('data-tone', 'good')
  expect(chip).toHaveTextContent('92')
  expect(screen.queryByTestId('sound-tip')).not.toBeInTheDocument()
})

it('turns a weak target sound into a fix chip plus the mouth tip', () => {
  renderSound()
  score(result(55))

  expect(screen.getByTestId('sound-chip')).toHaveAttribute('data-tone', 'fix')
  expect(screen.getByTestId('sound-tip')).toHaveTextContent(PHONEME_TIPS.th)
  // The word is still shown, but small and only as context for the sound.
  expect(screen.getByText(/90 điểm/)).toBeInTheDocument()
})

it('falls back to the word accuracy when the engine reports no phoneme detail', () => {
  renderSound()
  score(result(null, 70))

  const chip = screen.getByTestId('sound-chip')
  expect(chip).toHaveAttribute('data-tone', 'ok')
  expect(chip).toHaveTextContent('70')
})

it('takes the worst occurrence of the sound, not the average', () => {
  renderSound()
  score({
    ...result(90),
    words: [{ word: 'three', score: 90, errorType: 'None', phonemes: [{ phoneme: 'th', score: 90 }, { phoneme: 'th', score: 40 }] }],
  })
  expect(screen.getByTestId('sound-chip')).toHaveAttribute('data-tone', 'fix')
})

it('logs a speak event for every scored attempt', () => {
  renderSound()
  score(result(92))
  const events = JSON.parse(localStorage.getItem('speakup.activity') ?? '[]')
  expect(events).toContainEqual(expect.objectContaining({ kind: 'speak', id: 'sz-th-three' }))
})

it('gives 3 stars once the sound is good in all three words', () => {
  renderSound()

  score(result(92))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByText('Từ 2/3')).toBeInTheDocument()
  expect(screen.getByText('thank')).toBeInTheDocument()

  score(result(88))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByText('Từ 3/3')).toBeInTheDocument()

  score(result(85))

  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')).toMatchObject({ 'sound:th': 3 })
  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
  expect(screen.getByRole('link', { name: /hoàn thành/i })).toHaveAttribute('href', '/level/sound-zoo')
})

it('gives 2 stars when every word was only passable', () => {
  renderSound()
  score(result(65))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  score(result(92))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  score(result(70))

  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')).toMatchObject({ 'sound:th': 2 })
  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
})

it('lets a retry on the last word raise the stars', () => {
  renderSound()
  score(result(92))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  score(result(92))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  score(result(40))
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')).toMatchObject({ 'sound:th': 1 })

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
  score(result(95))

  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')).toMatchObject({ 'sound:th': 3 })
})

it('shows a not-found message for a phoneme that has no group', () => {
  renderSound('nope')
  expect(screen.getByText('Không tìm thấy âm')).toBeInTheDocument()
})
