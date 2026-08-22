import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const state = vi.hoisted(() => ({
  sceneIndex: 0,
  playing: false,
  rate: 1 as 0.75 | 1,
  tMs: 0,
  wordIndex: 1,
  hasAudio: false,
  musicOn: true,
  subtitles: false,
  ended: false,
  timings: [] as { start: number; end: number }[],
}))
const actions = vi.hoisted(() => ({
  play: vi.fn(),
  pause: vi.fn(),
  toggle: vi.fn(),
  setRate: vi.fn(),
  nextScene: vi.fn(),
  prevScene: vi.fn(),
  goScene: vi.fn(),
  replayWord: vi.fn(),
  toggleMusic: vi.fn(),
  toggleSubtitles: vi.fn(),
}))

vi.mock('../story/useStoryPlayer', () => ({
  useStoryPlayer: () => ({ ...state, ...actions }),
}))

import { StoryPlayer } from './StoryPlayer'

function renderPlayer(id = 'little-fox') {
  render(
    <MemoryRouter initialEntries={[`/story/${id}`]}>
      <Routes>
        <Route path="/story/:id" element={<StoryPlayer />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  Object.assign(state, {
    sceneIndex: 0, playing: false, rate: 1, tMs: 0, wordIndex: 1,
    hasAudio: false, musicOn: true, subtitles: false, ended: false, timings: [],
  })
  Object.values(actions).forEach(fn => fn.mockClear())
})

it('shows the story title and titleVi', () => {
  renderPlayer()
  expect(screen.getByText('The Little Fox')).toBeInTheDocument()
  expect(screen.getByText('Chú cáo nhỏ')).toBeInTheDocument()
})

it('shows the scene 0 emoji', () => {
  renderPlayer()
  expect(screen.getByText('🦊')).toBeInTheDocument()
})

it('renders the words of scene 0 with wordIndex 1 active', () => {
  renderPlayer()
  const isButtons = screen.getAllByText('is') // scene 0 words: This is Foxy. Foxy is a little fox.
  expect(isButtons[0]).toHaveClass('text-coral', 'scale-110') // index 1
  expect(screen.getByText('This')).toHaveClass('text-slate-400') // index 0, already passed
  expect(screen.getByText('little')).toHaveClass('text-slate-800') // index 6, not yet reached
})

it('clicking Phát calls toggle', () => {
  renderPlayer()
  fireEvent.click(screen.getByRole('button', { name: 'Phát' }))
  expect(actions.toggle).toHaveBeenCalledTimes(1)
})

it('clicking a word calls replayWord with its index', () => {
  renderPlayer()
  fireEvent.click(screen.getByText('This')) // index 0
  expect(actions.replayWord).toHaveBeenCalledWith(0)
})

it('shows the Vietnamese subtitle when subtitles is true', () => {
  state.subtitles = true
  renderPlayer()
  expect(screen.getByText('Đây là Foxy. Foxy là một chú cáo nhỏ.')).toBeInTheDocument()
})

it('hides the Vietnamese subtitle when subtitles is false', () => {
  renderPlayer()
  expect(screen.queryByText('Đây là Foxy. Foxy là một chú cáo nhỏ.')).not.toBeInTheDocument()
})

it('shows the no-audio note when hasAudio is false', () => {
  renderPlayer()
  expect(screen.getByText(/Chưa có giọng đọc/)).toBeInTheDocument()
})

it('hides the no-audio note when hasAudio is true', () => {
  state.hasAudio = true
  renderPlayer()
  expect(screen.queryByText(/Chưa có giọng đọc/)).not.toBeInTheDocument()
})

it('shows a "Trả lời câu hỏi →" link to the quiz when ended', () => {
  state.ended = true
  renderPlayer()
  const link = screen.getByRole('link', { name: /Trả lời câu hỏi/ })
  expect(link).toHaveAttribute('href', '/story/little-fox/quiz')
})

it('does not show the quiz link when not ended', () => {
  renderPlayer()
  expect(screen.queryByRole('link', { name: /Trả lời câu hỏi/ })).not.toBeInTheDocument()
})

it('shows a not-found message for an unknown story id', () => {
  renderPlayer('nope')
  expect(screen.getByText('Không tìm thấy truyện')).toBeInTheDocument()
})
