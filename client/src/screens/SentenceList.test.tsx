import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SENTENCES } from '../content'
import { findTopic } from '../content/topics'
import { TOPICS as WORD_DECKS } from '../content/words'
import { promote } from '../progress/leitner'
import { setStars } from '../progress/store'
import { SentenceList } from './SentenceList'

/** Opens every island the way the map does — six of each deck's eight words in the Leitner box —
 * so the unfiltered list has all eight topics to show. */
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

it('unfiltered: sticky topic groups of 64px truncating rows, two columns on iPad', () => {
  openEveryTopic()
  setStars('sentence:s1', 2)
  renderList()

  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('🧱 Ghép câu')
  expect(screen.getByText(/^32 câu · \d+ chủ đề$/)).toBeInTheDocument()

  const groups = screen.getByTestId('sentence-groups')
  expect(groups).toHaveClass('md:grid', 'md:grid-cols-2', 'md:items-start', 'md:gap-3')

  const h2s = screen.getAllByTestId('sticky-group')
  expect(h2s.length).toBeGreaterThan(0)
  const h2 = h2s[0]
  expect(h2).toHaveClass('sticky', 'top-0', 'z-10', 'bg-cream-50', 'pt-1.5')
  // C8: no count tail on the sticky heading.
  expect(h2.textContent).not.toMatch(/·/)

  expect(rowLinks()).toHaveLength(SENTENCES.length)
  const row = screen.getAllByTestId('list-row')[0]
  expect(row).toHaveClass('min-h-[64px]', 'rounded-r16', 'shadow-card-xs')
  expect(row.querySelector('.truncate')).toHaveClass('text-[16px]')
  expect(within(row).getByTestId('stars')).toHaveClass('text-[13px]')

  const s1Link = screen.getByRole('link', { name: 'Con ăn một quả táo.' })
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

it('a valid ?topic= filter drops the H2s and names the topic in the subtitle', () => {
  renderList('/sentences?topic=family')

  expect(screen.queryAllByTestId('sticky-group')).toHaveLength(0)
  expect(screen.getByText('4 câu · Gia đình')).toBeInTheDocument()

  const family = SENTENCES.filter(s => s.topic === 'family')
  const rows = screen.getAllByTestId('list-row')
  expect(rows).toHaveLength(family.length)
  expect(rows[0]).toHaveAttribute('href', `/sentence/${family[0].id}?topic=family`)
  // Back to the hub the child came from, not all the way home.
  expect(screen.getByRole('link', { name: /Quay lại/ })).toHaveAttribute('href', '/topic/family')
  expect(screen.queryByText('Đồ ăn')).not.toBeInTheDocument()
})

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

it('an unknown ?topic= is no filter at all', () => {
  openEveryTopic()
  renderList('/sentences?topic=nope')

  expect(screen.getAllByTestId('sticky-group').length).toBeGreaterThan(0)
  expect(rowLinks()).toHaveLength(SENTENCES.length)
  expect(screen.getByText(/^32 câu · \d+ chủ đề$/)).toBeInTheDocument()
  expect(findTopic('nope')).toBeUndefined()
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

it('the right header cell keeps its default LessonChip slot', () => {
  renderList()
  expect(screen.getByTestId('header-right')).toBeInTheDocument()
})
