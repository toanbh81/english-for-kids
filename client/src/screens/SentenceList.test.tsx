import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SENTENCES } from '../content'
import { setStars } from '../progress/store'
import { SentenceList } from './SentenceList'

const renderList = (path = '/sentences') =>
  render(<MemoryRouter initialEntries={[path]}><SentenceList /></MemoryRouter>)

const rowLinks = () =>
  screen.getAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/sentence/'))

beforeEach(() => localStorage.clear())

it('renders a row for every sentence, grouped by topic, linking to /sentence/<id> with Stars', () => {
  setStars('sentence:s1', 2)
  renderList()

  expect(screen.getByText('🧱 Ghép câu')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Về nhà/ })).toHaveAttribute('href', '/')

  expect(rowLinks()).toHaveLength(SENTENCES.length)

  SENTENCES.forEach(s => {
    const link = screen.getByRole('link', { name: new RegExp(s.vi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
    expect(link).toHaveAttribute('href', `/sentence/${s.id}`)
  })

  const s1 = SENTENCES.find(s => s.id === 's1')!
  const s1Link = screen.getByRole('link', { name: new RegExp(s1.vi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
  expect(within(s1Link).getAllByTestId('star-filled')).toHaveLength(2)
})

it('groups sentences under all topic headings', () => {
  renderList()
  expect(screen.getByText('Động vật')).toBeInTheDocument()
  expect(screen.getByText('Đồ ăn')).toBeInTheDocument()
  expect(screen.getByText('Trường học')).toBeInTheDocument()
  expect(screen.getByText('Gia đình')).toBeInTheDocument()
  expect(screen.getByText('Thời tiết')).toBeInTheDocument()
})

it('shows only one topic — and names it — when the topic hub links in with ?topic=', () => {
  renderList('/sentences?topic=animals')

  const animals = SENTENCES.filter(s => s.topic === 'animals')
  expect(animals.length).toBeGreaterThan(0)
  expect(rowLinks()).toHaveLength(animals.length)
  expect(screen.getByText('🧱 Ghép câu — Động vật')).toBeInTheDocument()
  // Back to the hub the child came from, not all the way home.
  expect(screen.getByRole('link', { name: /Quay lại/ })).toHaveAttribute('href', '/topic/animals')
  expect(screen.queryByText('Đồ ăn')).not.toBeInTheDocument()
})

it('falls back to the full list for a topic id that no longer exists', () => {
  renderList('/sentences?topic=dinosaurs')

  expect(rowLinks()).toHaveLength(SENTENCES.length)
  expect(screen.getByText('🧱 Ghép câu')).toBeInTheDocument()
})
