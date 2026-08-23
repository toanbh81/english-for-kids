import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'

/** The hook is mocked, not the recorder + scorer: these tests are about what StarPractice does
 * with a result, and `useSpeakingAttempt` is covered by its own suite and PracticeCard.test. */
const mic = vi.hoisted(() => ({ push: (_r: PronunciationResult, _b: Blob | null = null) => {} }))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    const [state, setState] = useState<{ result: PronunciationResult | null; blob: Blob | null }>({ result: null, blob: null })
    useEffect(() => { setState({ result: null, blob: null }) }, [opts.resetKey])
    mic.push = (r: PronunciationResult, b: Blob | null = null) => {
      setState({ result: r, blob: b })
      opts.onResult?.(r, b)
    }
    return {
      micState: 'idle' as const, level: 0, engine: 'azure' as const,
      result: state.result, error: null, lastBlob: state.blob,
      onMic: () => {}, reset: () => setState({ result: null, blob: null }),
    }
  },
}))
const playerControl = vi.hoisted(() => ({ playUrl: vi.fn(), playBlob: vi.fn() }))
vi.mock('../audio/player', () => ({ playUrl: playerControl.playUrl, playBlob: playerControl.playBlob }))
const store = vi.hoisted(() => ({ saveRecording: vi.fn() }))
vi.mock('../progress/recordings', () => ({ saveRecording: store.saveRecording }))

import { StarPractice } from './StarPractice'
import { SENTENCE_STARS } from '../content'

const SS1 = SENTENCE_STARS[0]

/** One attempt on the sentence; the three numbers the star rule actually reads are explicit. */
function result(accuracy: number, fluency: number, completeness = 100): PronunciationResult {
  return {
    overall: accuracy, accuracy, fluency, completeness, engine: 'azure',
    words: SS1.words.map(w => ({ word: w, score: accuracy, errorType: 'None' as const, phonemes: [] })),
  }
}

const score = (r: PronunciationResult, blob: Blob | null = null) => act(() => { mic.push(r, blob) })

function renderStar(id = SS1.id) {
  render(
    <MemoryRouter initialEntries={[`/star/${id}`]}>
      <Routes>
        <Route path="/star/:id" element={<StarPractice />} />
        <Route path="/level/sentence-stars" element={<p>các câu</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
  playerControl.playBlob.mockReset().mockResolvedValue(undefined)
  store.saveRecording.mockReset().mockResolvedValue(undefined)
})

it('opens on the sentence with its stress, linking and legend', () => {
  renderStar()

  expect(screen.getByText('Câu 1/10')).toBeInTheDocument()
  // "have", "red" and "apple." carry the beat of "I have a red apple."
  expect(screen.getByText('have')).toHaveClass('text-coral-text', 'text-[48px]')
  expect(screen.getByText('I')).toHaveClass('text-ink-900')
  // …and "red apple" links, so a ‿ sits between them.
  expect(screen.getAllByTestId('link-mark')).toHaveLength(1)
  expect(screen.getByText(SS1.vi)).toBeInTheDocument()
  expect(screen.getByText('Chữ cam = nhấn mạnh · ‿ = nối âm')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/level/sentence-stars')
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
})

/** The dots ARE the rhythm: one per word, and the big ones mark where the stress falls. */
it('draws one rhythm dot per word, big on the stressed ones', () => {
  renderStar()

  const dots = screen.getAllByTestId('rhythm-dot')
  expect(dots).toHaveLength(SS1.words.length)
  expect(dots.filter(d => d.getAttribute('data-stress') === 'on')).toHaveLength(SS1.stress.length)
  for (const d of dots) {
    expect(d).toHaveClass(d.getAttribute('data-stress') === 'on' ? 'h-6' : 'h-3')
  }
})

it('pulses the dots only while the sample is actually sounding', async () => {
  let finish = () => {}
  playerControl.playUrl.mockReturnValue(new Promise<void>(res => { finish = () => res() }))
  renderStar()

  expect(screen.getAllByTestId('rhythm-dot')[0]).not.toHaveClass('animate-pulse-soft')
  fireEvent.click(screen.getByRole('button', { name: 'Nghe nhịp của câu' }))
  expect(playerControl.playUrl).toHaveBeenCalledWith(SS1.audio)
  expect(screen.getAllByTestId('rhythm-dot')[0]).toHaveClass('animate-pulse-soft')

  await act(async () => { finish() })
  expect(screen.getAllByTestId('rhythm-dot')[0]).not.toHaveClass('animate-pulse-soft')
})

it('says so when the sample audio is missing', async () => {
  playerControl.playUrl.mockRejectedValue(new Error('audio failed'))
  renderStar()

  fireEvent.click(screen.getByRole('button', { name: /nghe mẫu/i }))
  await screen.findByText('Chưa có audio mẫu')
  expect(screen.getAllByTestId('rhythm-dot')[0]).not.toHaveClass('animate-pulse-soft')
})

it('turns an accurate, fluent, complete attempt into 3 stars on the sentence key', () => {
  renderStar()
  score(result(85, 85, 100), new Blob(['x']))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
  expect(screen.getByText('Tuyệt vời!')).toBeInTheDocument()
  expect(screen.getByText('Nhịp: 🎵 tốt')).toBeInTheDocument()
  expect(screen.getByTestId('confetti')).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')['sstar:ss1']).toBe(3)
  expect(JSON.parse(localStorage.getItem('speakup.activity') ?? '[]'))
    .toContainEqual(expect.objectContaining({ kind: 'speak', id: 'ss1' }))
  expect(store.saveRecording).toHaveBeenCalledTimes(1)
  // The words come back with their own tone, and the four bars are all there.
  expect(screen.getByRole('button', { name: 'have tốt' })).toBeInTheDocument()
  expect(screen.getAllByTestId('score-bar')).toHaveLength(4)
  expect(screen.getByRole('button', { name: /nghe mình/i })).toBeInTheDocument()
})

/** Every word right but read one-word-at-a-time: 2 stars, and the child is told it was the rhythm. */
it('drops to 2 stars and names the slow rhythm when fluency is low', () => {
  renderStar()
  score(result(65, 40, 100))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.getByText('Hay lắm!')).toBeInTheDocument()
  expect(screen.getByText('Nhịp: 🐢 chậm')).toBeInTheDocument()
  expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')['sstar:ss1']).toBe(2)
  // No recording button when the attempt produced no blob.
  expect(screen.queryByRole('button', { name: /nghe mình/i })).not.toBeInTheDocument()
})

/** A read that was nearly joined-up is not "chậm" — calling it that contradicts the 2 stars it
 * just earned. The middle band names what is left to do instead of grading it down. */
it('names the middle rhythm band instead of calling a near-fluent read slow', () => {
  renderStar()
  score(result(85, 70, 100))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.getByText('Nhịp: 🙂 khá — nói liền hơi hơn nhé')).toBeInTheDocument()
  expect(screen.queryByText('Nhịp: 🐢 chậm')).not.toBeInTheDocument()
  expect(screen.queryByText('Nhịp: 🎵 tốt')).not.toBeInTheDocument()
})

it('offers a hint and a retry when the attempt was weak', () => {
  renderStar()
  score(result(40, 40, 40))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(1)
  expect(screen.getByText('Thử lại nhé')).toBeInTheDocument()
  expect(screen.getByText(/Sửa từ này/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
})

it('hands on to the next sentence, and back to the level on the last one', () => {
  renderStar()
  score(result(85, 85))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByText('Câu 2/10')).toBeInTheDocument()

  score(result(85, 85))
  expect(screen.getByRole('button', { name: /tiếp theo/i })).toBeInTheDocument()
})

it('finishes the level from the last sentence', () => {
  renderStar(SENTENCE_STARS[SENTENCE_STARS.length - 1].id)
  expect(screen.getByText('Câu 10/10')).toBeInTheDocument()

  score(result(85, 85))
  fireEvent.click(screen.getByRole('button', { name: /hoàn thành/i }))
  expect(screen.getByText('các câu')).toBeInTheDocument()
})

it('shows a not-found message for a sentence that does not exist', () => {
  renderStar('nope')
  expect(screen.getByText('Không tìm thấy câu')).toBeInTheDocument()
})
