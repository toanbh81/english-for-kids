import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { TopicId } from '../content/topics'
import { findTopic } from '../content/words'
import { dayKey, logActivity } from '../progress/activity'
import { getLesson } from '../progress/lesson'
import { Home } from './Home'

const NOW = new Date('2026-08-23T10:00:00').getTime()
const DAY_MS = 24 * 60 * 60 * 1000

/** Home is rendered inside a router that also serves a stub for the celebration screen, so the
 * once-a-day redirect can be observed without pulling in MissionComplete. */
function renderHome() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mission/done" element={<p>màn hình chúc mừng</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Logs a full day's worth of legacy counter activity so that day counts as done for the streak. */
function seedDoneDay(ts: number) {
  logActivity({ ts, kind: 'story', id: 'little-fox' })
  for (let i = 0; i < 5; i++) logActivity({ ts: ts + i, kind: 'speak', id: `sz-${i}` })
  for (let i = 0; i < 3; i++) logActivity({ ts: ts + i, kind: 'word', id: `w-${i}` })
}

/**
 * Generates today's lesson the way Home does on mount and logs a passing attempt for the first
 * `count` of its items, so the card's fraction and the celebration can be driven without knowing
 * which items the seeded generator picked.
 */
function completeLesson(ts: number, count = Number.MAX_SAFE_INTEGER) {
  const lesson = getLesson(ts)
  lesson.items.slice(0, count).forEach((item, i) => {
    logActivity({ ts: lesson.created + 1000 + i, kind: item.activity, id: item.id })
  })
  return lesson
}

/** Puts the first `n` words of a topic's deck in Leitner box 1 — the unlock and star currency. */
function unlockWords(topic: TopicId, n: number) {
  const deck = findTopic(topic)?.words ?? []
  const raw: Record<string, { box: number; due: number }> =
    JSON.parse(localStorage.getItem('speakup.leitner') ?? '{}')
  for (const w of deck.slice(0, n)) raw[w.id] = { box: 1, due: 0 }
  localStorage.setItem('speakup.leitner', JSON.stringify(raw))
}

/** Opens every island, so the map can be checked as a whole. The first four are open from the
 * start, so the chain only has to be walked from the fourth deck onwards. */
function unlockAllTopics() {
  for (const id of ['family', 'weather', 'colors', 'body'] as TopicId[]) unlockWords(id, 6)
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date(NOW) })
})

afterEach(() => {
  vi.useRealTimers()
})

it('shows how much of today lesson is done and a happy Foxy', () => {
  const lesson = completeLesson(NOW, 2)

  renderHome()

  expect(screen.getByText(`2/${lesson.items.length}`)).toBeInTheDocument()
  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'happy')
  expect(screen.getByText('Giỏi lắm, tiếp tục nhé!')).toBeInTheDocument()
  // Two items in: the card carries on rather than starting over (spec §2).
  expect(screen.getByRole('link', { name: 'Tiếp tục ▸' })).toHaveAttribute('href', '/mission')
})

// The lesson's `created` stamp gates every done-match, so it has to be set when the child opens
// the app — not when they first tap through to /mission. Free practice before that visit counts.
it('generates today lesson on mount so earlier practice still counts', () => {
  expect(localStorage.getItem(`speakup.lesson.${dayKey(NOW)}`)).toBeNull()

  renderHome()

  const raw = localStorage.getItem(`speakup.lesson.${dayKey(NOW)}`)
  expect(raw).not.toBeNull()
  expect(JSON.parse(raw!).created).toBe(NOW)
  expect(screen.getByText(`0/${JSON.parse(raw!).items.length}`)).toBeInTheDocument()
})

it('shows an idle Foxy greeting with no activity yet', () => {
  renderHome()

  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'idle')
  expect(screen.getByText('Chào bé! 👋')).toBeInTheDocument()
  expect(screen.getByText('Hôm nay mình luyện nói nhé!')).toBeInTheDocument()
})

it('offers a replay CTA once the lesson is done and already celebrated', () => {
  completeLesson(NOW)
  localStorage.setItem('speakup.celebrated', dayKey(NOW))

  renderHome()

  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'cheer')
  expect(screen.getByText('Hoàn thành nhiệm vụ rồi! 🎉')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Hoàn thành rồi! 🎉 Chơi lại?' })).toHaveAttribute('href', '/mission')
})

it('sends the child to the celebration screen when the lesson is finished', () => {
  completeLesson(NOW)

  renderHome()

  expect(screen.getByText('màn hình chúc mừng')).toBeInTheDocument()
  expect(localStorage.getItem('speakup.celebrated')).toBe(dayKey(NOW))
})

it('does not celebrate the same finished lesson twice in one day', () => {
  completeLesson(NOW)
  localStorage.setItem('speakup.celebrated', dayKey(NOW))

  renderHome()

  expect(screen.queryByText('màn hình chúc mừng')).not.toBeInTheDocument()
})

it('celebrates again on a new day even if yesterday was celebrated', () => {
  completeLesson(NOW)
  localStorage.setItem('speakup.celebrated', dayKey(NOW - DAY_MS))

  renderHome()

  expect(screen.getByText('màn hình chúc mừng')).toBeInTheDocument()
})

it('stays on the map while the lesson is unfinished', () => {
  completeLesson(NOW, 1)

  renderHome()

  expect(screen.queryByText('màn hình chúc mừng')).not.toBeInTheDocument()
  expect(localStorage.getItem('speakup.celebrated')).toBeNull()
})

it('shows a 3-day streak after three consecutive completed days', () => {
  seedDoneDay(NOW - 2 * DAY_MS)
  seedDoneDay(NOW - DAY_MS)
  seedDoneDay(NOW)

  renderHome()

  expect(screen.getByText('🔥 3 ngày')).toBeInTheDocument()
})

it('shows the time-limit banner once minutes today reach the configured limit', () => {
  localStorage.setItem('speakup.limit.minutes', '1')
  logActivity({ ts: NOW - 3 * 60 * 1000, kind: 'speak', id: 'sz-th-three' })
  logActivity({ ts: NOW, kind: 'speak', id: 'sz-th-thank' })

  renderHome()

  expect(screen.getByTestId('limit-banner')).toHaveTextContent('Hôm nay bé học đủ rồi 🦊 Mai gặp lại nhé!')
})

it('does not show the time-limit banner under the limit', () => {
  localStorage.setItem('speakup.limit.minutes', '20')
  logActivity({ ts: NOW, kind: 'speak', id: 'sz-th-three' })

  renderHome()

  expect(screen.queryByTestId('limit-banner')).not.toBeInTheDocument()
})

it('keeps the stacked layout scrollable so the mission CTA is never trapped below the fold', () => {
  renderHome()

  const root = screen.getByRole('main')
  // A fixed-height, clipped root is what hid the mission CTA and the parent link in portrait:
  // the stacked layout is taller than the viewport, so the root has to grow and the page scroll.
  expect(root).toHaveClass('min-h-full', 'overflow-y-auto')
  expect(root.classList.contains('h-full')).toBe(false)
  expect(root.classList.contains('overflow-hidden')).toBe(false)
  // Only the landscape map frame may clip, and only from `lg` up.
  expect(Array.from(root.classList).filter(c => c.includes('overflow-hidden'))).toEqual([])
})

it('puts the eight topic islands on the map, in unlock order, each linking to its hub', () => {
  unlockAllTopics()

  renderHome()

  const hrefs = screen.getAllByRole('link')
    .map(a => a.getAttribute('href'))
    .filter(href => href?.startsWith('/topic/'))
  expect(hrefs).toEqual([
    '/topic/animals', '/topic/food', '/topic/school', '/topic/family',
    '/topic/weather', '/topic/colors', '/topic/body', '/topic/toys',
  ])
  expect(screen.getByRole('link', { name: /Động vật/ })).toHaveAttribute('href', '/topic/animals')
  expect(screen.getByRole('link', { name: /Đồ chơi/ })).toHaveAttribute('href', '/topic/toys')
  expect(screen.getByRole('link', { name: /Phụ huynh/ })).toHaveAttribute('href', '/parent')
})

/** The map is the free-choice library beside the daily mission (spec §4), and every open island
 * says so under its name. A locked one says "Chưa mở khóa" instead — there is nothing to practise
 * there yet, so promising extra practice would be a lie. */
it('labels every open island as free practice', () => {
  unlockAllTopics()

  renderHome()

  expect(screen.getAllByText('Luyện thêm')).toHaveLength(8)
  expect(within(screen.getByTestId('island-toys')).getByText('Luyện thêm')).toBeInTheDocument()
})

it('offers no free-practice subtitle on a locked island', () => {
  renderHome()

  expect(screen.getAllByText('Luyện thêm')).toHaveLength(4)
  const locked = screen.getByTestId('island-weather')
  expect(within(locked).queryByText('Luyện thêm')).not.toBeInTheDocument()
  expect(within(locked).getByText('Chưa mở khóa')).toBeInTheDocument()
})

it('opens the first four islands for a brand-new child and locks the rest', () => {
  renderHome()

  for (const id of ['animals', 'food', 'school', 'family']) {
    expect(screen.getByTestId(`island-${id}`)).toHaveAttribute('href', `/topic/${id}`)
  }
  for (const id of ['weather', 'colors', 'body', 'toys']) {
    const island = screen.getByTestId(`island-${id}`)
    expect(island.tagName).not.toBe('A')
    expect(island).toHaveAttribute('aria-disabled', 'true')
    expect(within(island).getByText('Chưa mở khóa')).toBeInTheDocument()
  }
  expect(screen.getAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/topic/')))
    .toHaveLength(4)
})

it('opens the fifth island only once six of the fourth deck are unlocked', () => {
  unlockWords('family', 5)

  const { unmount } = render(<MemoryRouter><Home /></MemoryRouter>)
  expect(screen.getByTestId('island-weather')).toHaveAttribute('aria-disabled', 'true')
  unmount()

  unlockWords('family', 6)

  renderHome()

  expect(screen.getByRole('link', { name: /Thời tiết/ })).toHaveAttribute('href', '/topic/weather')
  expect(screen.getByTestId('island-colors')).toHaveAttribute('aria-disabled', 'true')
})

/** Phases 1–6 let children learn any topic. The chain must never take that away: a single word
 * already unlocked in Đồ chơi opens that island even though Thời tiết is nowhere near six. */
it('keeps a topic with existing progress open even when the chain has not reached it', () => {
  unlockWords('toys', 1)

  renderHome()

  expect(screen.getByRole('link', { name: /Đồ chơi/ })).toHaveAttribute('href', '/topic/toys')
  expect(screen.getByTestId('island-weather')).toHaveAttribute('aria-disabled', 'true')
})

it('bands each island stars by how much of its deck is unlocked', () => {
  unlockWords('animals', 1)
  unlockWords('food', 6)
  unlockWords('school', 8)

  renderHome()

  const stars = (id: string) =>
    within(screen.getByTestId(`island-${id}`)).getAllByTestId('star-filled').length
  expect(stars('animals')).toBe(1)
  expect(stars('food')).toBe(2)
  expect(stars('school')).toBe(3)
  expect(within(screen.getByTestId('island-family')).queryAllByTestId('star-filled')).toHaveLength(0)
})

// The islands are topics now, so the staircase — Nghe & chọn, Sentence Stars, Story Voice — has
// no other way in from the map.
it('links the map to the Speak Lab staircase', () => {
  renderHome()

  expect(screen.getByRole('link', { name: /Các bậc luyện nói/ })).toHaveAttribute('href', '/levels')
})
