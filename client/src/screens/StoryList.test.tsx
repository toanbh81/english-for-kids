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

it('renders a card for every story linking to /story/<id> with Stars', () => {
  setStars('story:little-fox', 2)
  render(<MemoryRouter><StoryList /></MemoryRouter>)

  expect(screen.getByText('🎧 Nghe kể chuyện')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Về nhà/ })).toHaveAttribute('href', '/')

  const cardLinks = screen.getAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/story/'))
  expect(cardLinks).toHaveLength(STORIES.length)

  STORIES.forEach(s => {
    const link = screen.getByRole('link', { name: new RegExp(s.title) })
    expect(link).toHaveAttribute('href', `/story/${s.id}`)
    expect(within(link).getByText(s.titleVi)).toBeInTheDocument()
  })

  const foxLink = screen.getByRole('link', { name: /The Little Fox/ })
  expect(within(foxLink).getAllByTestId('star-filled')).toHaveLength(2)
})
