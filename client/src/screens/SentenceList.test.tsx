import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SENTENCES } from '../content'
import { setStars } from '../progress/store'
import { SentenceList } from './SentenceList'

beforeEach(() => localStorage.clear())

it('renders a row for every sentence, grouped by topic, linking to /sentence/<id> with Stars', () => {
  setStars('sentence:s1', 2)
  render(<MemoryRouter><SentenceList /></MemoryRouter>)

  expect(screen.getByText('🧱 Ghép câu')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Về nhà/ })).toHaveAttribute('href', '/')

  const rowLinks = screen.getAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/sentence/'))
  expect(rowLinks).toHaveLength(SENTENCES.length)

  SENTENCES.forEach(s => {
    const link = screen.getByRole('link', { name: new RegExp(s.vi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
    expect(link).toHaveAttribute('href', `/sentence/${s.id}`)
  })

  const s1 = SENTENCES.find(s => s.id === 's1')!
  const s1Link = screen.getByRole('link', { name: new RegExp(s1.vi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
  expect(within(s1Link).getAllByTestId('star-filled')).toHaveLength(2)
})

it('groups sentences under food, school and family headings', () => {
  render(<MemoryRouter><SentenceList /></MemoryRouter>)
  expect(screen.getByText('Đồ ăn')).toBeInTheDocument()
  expect(screen.getByText('Trường học')).toBeInTheDocument()
  expect(screen.getByText('Gia đình')).toBeInTheDocument()
})
