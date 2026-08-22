import { render, screen } from '@testing-library/react'
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
  expect(screen.getByText('Foxy wants a big red apple.')).toBeInTheDocument()
  expect(screen.getByText('Foxy muốn một quả táo đỏ to.')).toBeInTheDocument()
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
