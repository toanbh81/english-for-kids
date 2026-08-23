import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'

/** The hook is mocked, not the recorder + scorer: these tests are about what VoicePractice does
 * with a result. `engine` is part of the control surface here, because the whole prosody story
 * changes when the app falls back to Web Speech. */
const mic = vi.hoisted(() => ({
  push: (_r: PronunciationResult, _b: Blob | null = null) => {},
  engine: 'azure' as 'azure' | 'webspeech',
}))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    const [state, setState] = useState<{ result: PronunciationResult | null; blob: Blob | null }>({ result: null, blob: null })
    useEffect(() => { setState({ result: null, blob: null }) }, [opts.resetKey])
    mic.push = (r: PronunciationResult, b: Blob | null = null) => {
      setState({ result: r, blob: b })
      opts.onResult?.(r, b)
    }
    return {
      micState: 'idle' as const, level: 0, engine: mic.engine,
      result: state.result, error: null, lastBlob: state.blob,
      onMic: () => {}, reset: () => setState({ result: null, blob: null }),
    }
  },
}))
const playerControl = vi.hoisted(() => ({ playUrl: vi.fn(), playBlob: vi.fn() }))
vi.mock('../audio/player', () => ({ playUrl: playerControl.playUrl, playBlob: playerControl.playBlob }))
const store = vi.hoisted(() => ({ saveRecording: vi.fn() }))
vi.mock('../progress/recordings', () => ({ saveRecording: store.saveRecording }))

import { VoicePractice } from './VoicePractice'
import { STORY_VOICE } from '../content'

const SV1 = STORY_VOICE[0]

/** One attempt on a passage. `prosody` is left off entirely for the Web Speech shape. */
function result(scores: { accuracy: number; prosody?: number; fluency?: number; completeness?: number }): PronunciationResult {
  const { accuracy, prosody, fluency = 85, completeness = 100 } = scores
  return {
    overall: accuracy, accuracy, fluency, completeness, prosody,
    engine: mic.engine,
    words: SV1.text.split(' ').map(w => ({ word: w, score: accuracy, errorType: 'None' as const, phonemes: [] })),
  }
}

const score = (r: PronunciationResult, blob: Blob | null = null) => act(() => { mic.push(r, blob) })

function renderVoice(id = SV1.id) {
  render(
    <MemoryRouter initialEntries={[`/voice/${id}`]}>
      <Routes>
        <Route path="/voice/:id" element={<VoicePractice />} />
        <Route path="/level/story-voice" element={<p>các đoạn</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** A second passage inside one test needs the first screen gone, or queries see both. */
function cleanupAndRender(id: string) {
  cleanup()
  renderVoice(id)
}

beforeEach(() => {
  localStorage.clear()
  mic.engine = 'azure'
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
  playerControl.playBlob.mockReset().mockResolvedValue(undefined)
  store.saveRecording.mockReset().mockResolvedValue(undefined)
})

it('opens on the passage with the mood it has to be read in', () => {
  renderVoice()

  expect(screen.getByText('Đoạn 1/8')).toBeInTheDocument()
  expect(screen.getByText(`Đọc với giọng: ${SV1.moodVi}`)).toBeInTheDocument()
  expect(screen.getByLabelText(SV1.text)).toBeInTheDocument()
  expect(screen.getByText(SV1.vi)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/level/story-voice')
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
})

/** "I love my dog!" — the ❗ is what the voice actually has to do, so it is the coral bit. */
it('tints the sentence-final ❗❓ and leaves the words alone', () => {
  renderVoice()

  const marks = screen.getAllByTestId('voice-punct')
  expect(marks).toHaveLength(1)
  expect(marks[0]).toHaveTextContent('!')
  expect(marks[0]).toHaveClass('text-coral-text')

  cleanupAndRender('sv3')
  const qs = screen.getAllByTestId('voice-punct')
  expect(qs.map(q => q.textContent)).toEqual(['?', '?', '!'])
})

it('coaches the mood with three tips, different per mood', () => {
  renderVoice()

  expect(screen.getByText('🎭 Gợi ý giọng')).toBeInTheDocument()
  expect(screen.getAllByTestId('mood-tip')).toHaveLength(3)
  expect(screen.getByText(/Mỉm cười khi đọc/)).toBeInTheDocument()

  cleanupAndRender('sv3')
  expect(screen.getAllByTestId('mood-tip')).toHaveLength(3)
  expect(screen.getByText(/Lên giọng ở cuối câu hỏi/)).toBeInTheDocument()
  expect(screen.getByText(/Nhấn vào từ để hỏi/)).toBeInTheDocument()
})

it('plays the sample, and says so when it is missing', async () => {
  renderVoice()
  fireEvent.click(screen.getByRole('button', { name: /nghe mẫu/i }))
  expect(playerControl.playUrl).toHaveBeenCalledWith(SV1.audio)

  playerControl.playUrl.mockRejectedValue(new Error('audio failed'))
  fireEvent.click(screen.getByRole('button', { name: /nghe mẫu/i }))
  await screen.findByText('Chưa có audio mẫu')
})

it('turns strong intonation into 3 stars on the passage key', () => {
  renderVoice()
  score(result({ prosody: 84, accuracy: 75 }), new Blob(['x']))

  expect(screen.getByTestId('prosody-chip')).toHaveTextContent('Ngữ điệu 84')
  expect(screen.getByTestId('prosody-chip')).toHaveAttribute('data-tone', 'good')
  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
  expect(screen.getByText('Đọc có hồn quá!')).toBeInTheDocument()
  expect(screen.getByTestId('confetti')).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')['voice:sv1']).toBe(3)
  expect(JSON.parse(localStorage.getItem('speakup.activity') ?? '[]'))
    .toContainEqual(expect.objectContaining({ kind: 'speak', id: 'sv1' }))
  expect(store.saveRecording).toHaveBeenCalledTimes(1)
  expect(screen.getAllByTestId('score-bar')).toHaveLength(4)
  expect(screen.getByRole('button', { name: /nghe mình/i })).toBeInTheDocument()
})

it('gives 2 stars for middling intonation', () => {
  renderVoice()
  score(result({ prosody: 65, accuracy: 80 }))

  expect(screen.getByTestId('prosody-chip')).toHaveTextContent('Ngữ điệu 65')
  expect(screen.getByTestId('prosody-chip')).toHaveAttribute('data-tone', 'ok')
  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.getByText('Hay lắm!')).toBeInTheDocument()
  expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')['voice:sv1']).toBe(2)
  expect(screen.queryByRole('button', { name: /nghe mình/i })).not.toBeInTheDocument()
})

/** Web Speech cannot hear feeling, so it must neither show a number nor hand out 3 stars. */
it('says the intonation was not marked on the simple engine, and caps the stars', () => {
  mic.engine = 'webspeech'
  renderVoice()

  score(result({ accuracy: 95 }))

  expect(screen.getByTestId('prosody-chip')).toHaveTextContent('Chưa chấm được ngữ điệu')
  expect(screen.getByTestId('prosody-chip')).toHaveAttribute('data-tone', 'none')
  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')['voice:sv1']).toBe(2)
})

it('offers a hint and a retry when the attempt was weak', () => {
  renderVoice()
  score(result({ prosody: 30, accuracy: 40, fluency: 40, completeness: 40 }))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(1)
  expect(screen.getByTestId('prosody-chip')).toHaveAttribute('data-tone', 'fix')
  expect(screen.getByText('Thử lại nhé')).toBeInTheDocument()
  expect(screen.getByText(/Sửa từ này/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
})

it('hands on to the next passage, and finishes the level on the last one', () => {
  renderVoice()
  score(result({ prosody: 84, accuracy: 75 }))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByText('Đoạn 2/8')).toBeInTheDocument()

  cleanupAndRender(STORY_VOICE[STORY_VOICE.length - 1].id)
  expect(screen.getByText('Đoạn 8/8')).toBeInTheDocument()
  score(result({ prosody: 84, accuracy: 75 }))
  fireEvent.click(screen.getByRole('button', { name: /hoàn thành/i }))
  expect(screen.getByText('các đoạn')).toBeInTheDocument()
})

it('shows a not-found message for a passage that does not exist', () => {
  renderVoice('nope')
  expect(screen.getByText('Không tìm thấy đoạn')).toBeInTheDocument()
})
