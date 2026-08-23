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

/** The rhythm card loads the sample itself rather than going through `playUrl`, because the beat
 * of the dots comes from the file's own duration — which only an Audio element it holds can tell
 * it. jsdom has no media stack at all, so the element is faked outright. */
class FakeAudio {
  static instances: FakeAudio[] = []
  duration = NaN
  paused = true
  onloadedmetadata: (() => void) | null = null
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  src: string
  constructor(src: string) { this.src = src; FakeAudio.instances.push(this) }
  play() { this.paused = false; return Promise.resolve() }
  pause() { this.paused = true }
}
const lastAudio = () => FakeAudio.instances[FakeAudio.instances.length - 1]
const tapRhythm = () => fireEvent.click(screen.getByRole('button', { name: 'Nghe nhịp của câu' }))
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
  FakeAudio.instances.length = 0
  vi.stubGlobal('Audio', FakeAudio)
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
  playerControl.playBlob.mockReset().mockResolvedValue(undefined)
  store.saveRecording.mockReset().mockResolvedValue(undefined)
})

afterEach(() => { vi.unstubAllGlobals() })

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

it('beats the dots only while the sample is actually sounding', async () => {
  renderStar()

  expect(screen.getAllByTestId('rhythm-dot')[0]).not.toHaveClass('animate-beat')
  tapRhythm()
  expect(lastAudio().src).toBe(SS1.audio)
  expect(lastAudio().paused).toBe(false)
  expect(screen.getAllByTestId('rhythm-dot')[0]).toHaveClass('animate-beat')

  await act(async () => { lastAudio().onended?.() })
  expect(screen.getAllByTestId('rhythm-dot')[0]).not.toHaveClass('animate-beat')
})

/** The beat is the point: one pulse per word, spaced by the sample's *own* tempo, so the dots
 * march along with the voice instead of blinking at some invented rate. */
it('beats once per word at the tempo the sample itself reports', async () => {
  renderStar()
  tapRhythm()

  const audio = lastAudio()
  await act(async () => { audio.duration = 2; audio.onloadedmetadata?.() })

  // 2 s of audio across the 5 words of "I have a red apple." = one 400 ms beat per word…
  const card = screen.getByRole('button', { name: 'Nghe nhịp của câu' })
  expect(card.style.getPropertyValue('--beat')).toBe('400ms')
  // …and each dot starts one whole beat after the one before it.
  const dots = screen.getAllByTestId('rhythm-dot')
  expect(dots).toHaveLength(5)
  expect(dots.map(d => d.style.animationDelay)).toEqual(['0ms', '400ms', '800ms', '1200ms', '1600ms'])

  await act(async () => { audio.onended?.() })
  expect(screen.getAllByTestId('rhythm-dot')[0]).not.toHaveClass('animate-beat')
})

/** No metadata (file missing, decode blocked) must not freeze the dots mid-beat. */
it('falls back to an estimated tempo when the browser reports no duration', () => {
  renderStar()
  tapRhythm()

  const card = screen.getByRole('button', { name: 'Nghe nhịp của câu' })
  expect(card.style.getPropertyValue('--beat')).toBe('420ms')
  expect(screen.getAllByTestId('rhythm-dot')[0]).toHaveClass('animate-beat')
})

it('says so when the sample audio is missing', async () => {
  renderStar()

  fireEvent.click(screen.getByRole('button', { name: /nghe mẫu/i }))
  await act(async () => { lastAudio().onerror?.() })

  expect(screen.getByText('Chưa có audio mẫu')).toBeInTheDocument()
  expect(screen.getAllByTestId('rhythm-dot')[0]).not.toHaveClass('animate-beat')
})

/** Tapping twice must not leave the first sample sounding under the second. */
it('stops a sample already playing before starting another', () => {
  renderStar()
  tapRhythm()
  const first = lastAudio()
  tapRhythm()

  expect(first.paused).toBe(true)
  expect(lastAudio()).not.toBe(first)
  expect(lastAudio().paused).toBe(false)
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
