import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { SpeakingAttempt } from '../speaking/useSpeakingAttempt'

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

const attemptControl = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt: () => attemptControl.current,
}))

import { StoryRetell } from './StoryRetell'

function renderRetell(id = 'little-fox') {
  render(
    <MemoryRouter initialEntries={[`/story/${id}/retell`]}>
      <Routes>
        <Route path="/story/:id/retell" element={<StoryRetell />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  attemptControl.current = baseAttempt()
})

it('shows a not-found message for an unknown story id', () => {
  renderRetell('nope')
  expect(screen.getByText('Không tìm thấy truyện')).toBeInTheDocument()
})

it('shows the retell sentence and its translation', () => {
  renderRetell()
  expect(screen.getByText('Bé kể lại nhé')).toBeInTheDocument()
  expect(screen.getByText('He wants an apple.')).toBeInTheDocument()
  expect(screen.getByText('Cậu ấy muốn một quả táo.')).toBeInTheDocument()
})

it('shows a lenient pass of 2 stars and saves progress once', () => {
  attemptControl.current = {
    ...baseAttempt(),
    result: { overall: 40, accuracy: 40, fluency: 40, completeness: 40, words: [], engine: 'azure' },
  }
  renderRetell()

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.getByText('Hay lắm!')).toBeInTheDocument()
  const saved = JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')
  expect(saved['retell:little-fox']).toBe(2)
})

it('offers to play back the recording when a blob is available', () => {
  attemptControl.current = {
    ...baseAttempt(),
    result: { overall: 90, accuracy: 90, fluency: 90, completeness: 90, words: [], engine: 'azure' },
    lastBlob: new Blob(),
  }
  renderRetell()
  expect(screen.getByRole('button', { name: /nghe mình/i })).toBeInTheDocument()
})

it('shows the hook error in the fix color', () => {
  attemptControl.current = { ...baseAttempt(), error: 'Không nghe rõ, bé thử lại nhé!' }
  renderRetell()
  const err = screen.getByText('Không nghe rõ, bé thử lại nhé!')
  expect(err).toHaveClass('text-fix')
})

it('shows a simple-mode label for the webspeech engine', () => {
  attemptControl.current = { ...baseAttempt(), engine: 'webspeech' }
  renderRetell()
  expect(screen.getByText('chế độ đơn giản')).toBeInTheDocument()
})

describe('speech synthesis sample fallback', () => {
  const originalSpeechSynthesis = window.speechSynthesis
  const originalUtterance = (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance

  afterEach(() => {
    Object.defineProperty(window, 'speechSynthesis', { value: originalSpeechSynthesis, configurable: true, writable: true })
    ;(window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = originalUtterance
  })

  it('cancels any queued utterance before speaking again, so a double-tap restarts instead of queueing', () => {
    const synth = { cancel: vi.fn(), speak: vi.fn() }
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true, writable: true })
    // jsdom does not implement SpeechSynthesisUtterance either — stub a minimal constructor.
    ;(window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
      lang = ''
      text: string
      constructor(text: string) {
        this.text = text
      }
    }
    renderRetell()

    const playButton = screen.getByRole('button', { name: '🔊' })
    fireEvent.click(playButton)
    fireEvent.click(playButton)

    expect(synth.cancel).toHaveBeenCalledTimes(2)
    expect(synth.speak).toHaveBeenCalledTimes(2)
    for (const call of synth.speak.mock.calls) {
      const utterance = call[0] as SpeechSynthesisUtterance
      expect(utterance.lang).toBe('en-US')
    }
  })
})
