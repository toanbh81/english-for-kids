import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { STORIES } from '../content/stories'
import { setStars } from '../progress/store'
import { StoryList } from './StoryList'

beforeEach(() => localStorage.clear())

it('sits in the shared page frame', () => {
  render(<MemoryRouter><StoryList /></MemoryRouter>)
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByRole('banner')).toHaveClass('grid')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
})

it('phone: three 96px rows with a coloured disc, then Foxy filling the slack', () => {
  setStars('story:little-fox', 2)
  render(<MemoryRouter><StoryList /></MemoryRouter>)

  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('🎧 Nghe kể chuyện')
  expect(screen.getByText(`${STORIES.length} truyện · nghe rồi làm quiz`)).toBeInTheDocument()

  const rows = screen.getAllByTestId('list-row')
  expect(rows).toHaveLength(STORIES.length)
  expect(rows[0]).toHaveClass('min-h-[96px]', 'rounded-r20', 'shadow-[0_6px_0_#EFE2CC]')
  expect(rows[0]).toHaveAttribute('href', '/story/little-fox')
  // The disc's background is the story's own colour, not a shared token.
  expect(within(rows[0]).getByText('🦊')).toHaveClass('bg-[#FFE7D2]')
  expect(within(rows[0]).getAllByTestId('star-filled')).toHaveLength(2)

  const filler = screen.getByTestId('story-filler')
  expect(filler).toHaveClass('flex-1', 'md:hidden')
  expect(within(filler).getByTestId('foxy')).toBeInTheDocument()
})

// Fix wave M2: the Vietnamese title leads (row title), the English name and the scene count are
// the sub — matching TopicHub's own story rows, which this fix wave rules the two screens agree on.
it('every row links to its story with the Vietnamese title, an English/scene-count sub, and stars', () => {
  render(<MemoryRouter><StoryList /></MemoryRouter>)
  const rows = screen.getAllByTestId('list-row')
  STORIES.forEach((s, i) => {
    expect(rows[i]).toHaveAttribute('href', `/story/${s.id}`)
    expect(within(rows[i]).getByText(s.titleVi)).toBeInTheDocument()
    expect(within(rows[i]).getByText(`${s.title} · ${s.scenes.length} cảnh`)).toBeInTheDocument()
  })
})

it('iPad: three centred small tiles instead of rows, never stretched', () => {
  render(<MemoryRouter><StoryList /></MemoryRouter>)

  const tiles = screen.getByTestId('story-tiles')
  expect(tiles).toHaveClass('hidden', 'md:grid', 'md:grid-cols-[repeat(3,200px)]', 'md:justify-center', 'md:gap-3')
  expect(screen.getAllByTestId('tile')).toHaveLength(STORIES.length)

  const rows = screen.getAllByTestId('list-row')
  expect(rows[0].parentElement).toHaveClass('md:hidden')
})

it('the right header cell keeps its default LessonChip slot', () => {
  render(<MemoryRouter><StoryList /></MemoryRouter>)
  expect(screen.getByTestId('header-right')).toBeInTheDocument()
})
