import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SENTENCES } from '../content'
import { TOPICS as WORD_DECKS } from '../content/words'
import { promote } from '../progress/leitner'
import { setStars } from '../progress/store'
import { SentenceList } from './SentenceList'

/** Opens every island the way the map does — six of each deck's eight words in the Leitner box —
 * so the unfiltered list has all five topics to show. */
function openEveryTopic() {
  for (const deck of WORD_DECKS) deck.words.slice(0, 6).forEach(w => promote(w.id))
}

const renderList = (path = '/sentences') =>
  render(<MemoryRouter initialEntries={[path]}><SentenceList /></MemoryRouter>)

const rowLinks = () =>
  screen.getAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/sentence/'))

beforeEach(() => localStorage.clear())

it('sits in the shared page frame', () => {
  renderList()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByRole('banner')).toHaveClass('grid')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
})

it('renders a row for every sentence, grouped by topic, linking to /sentence/<id> with Stars', () => {
  openEveryTopic()
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
  openEveryTopic()
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

/** Fix round 1, D2: SentenceBuilder's "Tiếp theo" only stays inside a topic when the route it
 * lands on already carries `?topic=` — so a row reached through a topic-filtered list has to hand
 * that topic on, or R20's in-topic navigation is dead code with nothing in the real app that ever
 * triggers it. */
it('carries ?topic= on each row link when the list is topic-filtered', () => {
  renderList('/sentences?topic=animals')
  const animals = SENTENCES.filter(s => s.topic === 'animals')
  rowLinks().forEach(link => {
    const id = animals.find(s => link.getAttribute('href') === `/sentence/${s.id}?topic=animals`)?.id
    expect(id, `${link.getAttribute('href')} should carry ?topic=animals`).toBeDefined()
  })
})

// An unfiltered row has no topic of its own to carry — this is the existing behaviour the test
// above ("renders a row for every sentence… linking to /sentence/<id>") already pins with exact
// hrefs; this just names the contrast explicitly.
it('drops ?topic= from every row link when the list is not filtered', () => {
  openEveryTopic()
  renderList()
  rowLinks().forEach(link => expect(link.getAttribute('href')).not.toContain('?topic='))
})

it('falls back to the full list for a topic id that no longer exists', () => {
  openEveryTopic()
  renderList('/sentences?topic=dinosaurs')

  expect(rowLinks()).toHaveLength(SENTENCES.length)
  expect(screen.getByText('🧱 Ghép câu')).toBeInTheDocument()
})

// The unfiltered list is a full index of the game's sentences, so it must not be a way around the
// island unlocks — a hub linking in with its own `?topic=` has already made that call.
it('lists only unlocked topics when it is not filtered', () => {
  renderList()

  // The first four islands are open from the start (Phase 9 §3); everything past them is not.
  const open = SENTENCES.filter(s => ['animals', 'food', 'school', 'family'].includes(s.topic))
  expect(rowLinks()).toHaveLength(open.length)
  for (const name of ['Động vật', 'Đồ ăn', 'Trường học', 'Gia đình']) {
    expect(screen.getByText(name)).toBeInTheDocument()
  }
  for (const name of ['Thời tiết', 'Màu sắc', 'Cơ thể', 'Đồ chơi']) {
    expect(screen.queryByText(name)).not.toBeInTheDocument()
  }
})
