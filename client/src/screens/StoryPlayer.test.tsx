import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const state = vi.hoisted(() => ({
  sceneIndex: 0,
  playing: false,
  rate: 1 as 0.75 | 1,
  tMs: 0,
  wordIndex: 1,
  hasTimings: false,
  hasAudio: false,
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
  toggleSubtitles: vi.fn(),
}))

vi.mock('../story/useStoryPlayer', () => ({
  useStoryPlayer: () => ({ ...state, ...actions }),
}))

import { StoryPlayer } from './StoryPlayer'
import { findStory } from '../content/stories'

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
    sceneIndex: 0, playing: false, rate: 1, tMs: 0, wordIndex: 1, hasTimings: false,
    hasAudio: false, subtitles: false, ended: false, timings: [],
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

it('spells the scene position out for a screen reader, since the dots beside it are decorative', () => {
  state.sceneIndex = 2
  renderPlayer()
  const story = findStory('little-fox')!
  const position = screen.getByText(`3/${story.scenes.length}`)
  expect(position).toHaveClass('sr-only')
  expect(position.parentElement).toHaveTextContent(`Cảnh 3/${story.scenes.length}`)
})

it('renders the words of scene 0 with wordIndex 1 active', () => {
  renderPlayer()
  const isButtons = screen.getAllByText('is') // scene 0 words: This is Foxy. Foxy is a little fox.
  expect(isButtons[0]).toHaveClass('text-coral-text', 'text-[44px]') // index 1
  expect(screen.getByText('This')).toHaveClass('text-[#CDBFA9]') // index 0, already passed
  expect(screen.getByText('little')).toHaveClass('text-ink-900') // index 6, not yet reached
})

it('clicking Phát calls toggle', () => {
  renderPlayer()
  fireEvent.click(screen.getByRole('button', { name: 'Phát' }))
  expect(actions.toggle).toHaveBeenCalledTimes(1)
})

it('the 🐢/🐇 button toggles the rate between 1 and 0.75', () => {
  renderPlayer()
  fireEvent.click(screen.getByRole('button', { name: 'Tốc độ 0.75' }))
  expect(actions.setRate).toHaveBeenCalledWith(0.75)

  cleanup()
  state.rate = 0.75
  renderPlayer()
  fireEvent.click(screen.getByRole('button', { name: 'Tốc độ 1' }))
  expect(actions.setRate).toHaveBeenLastCalledWith(1)
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

it('shows the estimated-clock note when the scene has no timings', () => {
  renderPlayer()
  expect(screen.getByText(/Chưa có giọng đọc/)).toBeInTheDocument()
})

it('hides the estimated-clock note once the scene has timings', () => {
  state.hasTimings = true
  state.hasAudio = true
  renderPlayer()
  expect(screen.queryByText(/Chưa có giọng đọc/)).not.toBeInTheDocument()
  expect(screen.queryByText('Không phát được giọng đọc')).not.toBeInTheDocument()
})

it('shows a playback-failed note when a timed scene is playing without audio', () => {
  state.hasTimings = true
  state.hasAudio = false
  state.playing = true
  renderPlayer()
  // The narration exists but is not coming out (missing mp3 / blocked autoplay) — a different
  // problem from "gen-story.mjs was never run", so it gets its own wording.
  expect(screen.getByText('Không phát được giọng đọc')).toBeInTheDocument()
  expect(screen.queryByText(/Chưa có giọng đọc/)).not.toBeInTheDocument()
})

it('stays quiet about audio on a timed scene that is not playing yet', () => {
  state.hasTimings = true
  renderPlayer()
  expect(screen.queryByText('Không phát được giọng đọc')).not.toBeInTheDocument()
})

it('pulses a "Tiếp tục ▸" link to the quiz when the story has ended', () => {
  state.ended = true
  renderPlayer()
  const link = screen.getByRole('link', { name: /Tiếp tục/ })
  expect(link).toHaveAttribute('href', '/story/little-fox/quiz')
  expect(link).toHaveClass('animate-pulse-soft')
  expect(screen.queryByRole('link', { name: /Bỏ qua/ })).not.toBeInTheDocument()
})

it('offers a quiet "Bỏ qua ▸" to the same quiz before the story ends', () => {
  renderPlayer()
  // The child may already know the story: skipping ahead stays possible, it just does not shout.
  const link = screen.getByRole('link', { name: /Bỏ qua/ })
  expect(link).toHaveAttribute('href', '/story/little-fox/quiz')
  expect(link).not.toHaveClass('animate-pulse-soft')
  expect(screen.queryByRole('link', { name: /Tiếp tục/ })).not.toBeInTheDocument()
})

it('shows a not-found message for an unknown story id', () => {
  renderPlayer('nope')
  expect(screen.getByText('Không tìm thấy truyện')).toBeInTheDocument()
})
