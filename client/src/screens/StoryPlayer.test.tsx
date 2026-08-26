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
  return render(
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
  // Phase 10: the dots only exist from `md` up, so that is exactly where the number goes back to
  // being screen-reader-only. On a phone it is the design's printed "Cảnh 3/7" pill.
  expect(position).toHaveClass('md:sr-only')
  expect(position).not.toHaveClass('sr-only')
  expect(screen.getByTestId('scene-dots')).toHaveClass('max-md:hidden')
  expect(position.parentElement).toHaveTextContent(`Cảnh 3/${story.scenes.length}`)
})

it('renders the words of scene 0 with wordIndex 1 active', () => {
  renderPlayer()
  const isButtons = screen.getAllByText('is') // scene 0 words: This is Foxy. Foxy is a little fox.
  expect(isButtons[0]).toHaveClass('text-coral-text', 'text-[28px]', 'md:text-[44px]') // index 1
  expect(screen.getByText('This')).toHaveClass('text-[#CDBFA9]') // index 0, already passed
  expect(screen.getByText('little')).toHaveClass('text-ink-900') // index 6, not yet reached
})

/** Design §9 M6: the picture is a fixed 16/9 frame on a phone (362×204 at 390 px) instead of the
 * stretchy `flex-1` block, which had squeezed itself to 129 px at 375×667. From `md` up the
 * stretchy block is exactly what it was. */
it('gives the picture a fixed 16/9 frame on a phone and the flexible one from md up', () => {
  const { container } = renderPlayer()
  const frame = container.querySelector('main > div.relative')!
  expect(frame).toHaveClass('aspect-[16/9]', 'flex-none')
  expect(frame).toHaveClass('md:aspect-auto', 'md:max-h-[52vh]', 'md:min-h-0', 'md:flex-1')
})

it('drops the text header and draws a scene progress bar only on a phone', () => {
  const { container } = renderPlayer()
  // The title is still rendered — it is only hidden below the tablet breakpoint (design M6 has
  // no text header at all), so the landscape frame keeps it.
  expect(container.querySelector('header')).toHaveClass('hidden', 'md:block')
  expect(screen.getByText('The Little Fox')).toBeInTheDocument()

  const bar = container.querySelector('main > div[aria-hidden="true"]')!
  expect(bar).toHaveClass('h-[11px]', 'md:hidden')
  // 7 scenes, showing the first: the solid teal fill is 1/7 wide, not a gradient.
  const fill = bar.firstElementChild as HTMLElement
  expect(fill).toHaveClass('bg-teal-500')
  expect(fill.style.width).toMatch(/^14\.28/)
})

it('moves the tap hint out of the picture on a phone and keeps the floating pill from md up', () => {
  renderPlayer()
  expect(screen.getByText('👆 Chạm 1 từ để nghe lại')).toHaveClass('md:hidden')
  expect(screen.getByText('👆 Chạm vào 1 từ để nghe lại')).toHaveClass('max-md:hidden')
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
