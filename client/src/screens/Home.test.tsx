import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { dayKey, logActivity } from '../progress/activity'
import { setStars } from '../progress/store'
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

/** Logs a full day's worth of mission activity so that day counts as done. */
function seedDoneDay(ts: number) {
  logActivity({ ts, kind: 'story', id: 'little-fox' })
  for (let i = 0; i < 5; i++) logActivity({ ts: ts + i, kind: 'speak', id: `sz-${i}` })
  for (let i = 0; i < 3; i++) logActivity({ ts: ts + i, kind: 'word', id: `w-${i}` })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date(NOW) })
})

afterEach(() => {
  vi.useRealTimers()
})

it('shows mission progress from seeded activity and a happy Foxy', () => {
  logActivity({ ts: NOW - 5000, kind: 'story', id: 'little-fox' })
  logActivity({ ts: NOW - 4000, kind: 'speak', id: 'sz-th-three' })
  logActivity({ ts: NOW - 3000, kind: 'speak', id: 'sz-th-thank' })

  renderHome()

  expect(screen.getByText('1 truyện 1/1')).toBeInTheDocument()
  expect(screen.getByText('5 thẻ 2/5')).toBeInTheDocument()
  expect(screen.getByText('3 từ 0/3')).toBeInTheDocument()
  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'happy')
  expect(screen.getByText('Giỏi lắm, tiếp tục nhé!')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Bắt đầu ▸' })).toHaveAttribute('href', '/mission')
})

it('shows an idle Foxy greeting with no activity yet', () => {
  renderHome()

  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'idle')
  expect(screen.getByText('Chào bé! 👋')).toBeInTheDocument()
  expect(screen.getByText('Hôm nay mình luyện nói nhé!')).toBeInTheDocument()
})

it('offers a replay CTA once the mission is done and already celebrated', () => {
  seedDoneDay(NOW - 1000)
  localStorage.setItem('speakup.celebrated', dayKey(NOW))

  renderHome()

  expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'cheer')
  expect(screen.getByText('Hoàn thành nhiệm vụ rồi! 🎉')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Hoàn thành rồi! 🎉 Chơi lại?' })).toHaveAttribute('href', '/mission')
})

it('sends the child to the celebration screen when the mission is finished', () => {
  seedDoneDay(NOW - 1000)

  renderHome()

  expect(screen.getByText('màn hình chúc mừng')).toBeInTheDocument()
  expect(localStorage.getItem('speakup.celebrated')).toBe(dayKey(NOW))
})

it('does not celebrate the same finished mission twice in one day', () => {
  seedDoneDay(NOW - 1000)
  localStorage.setItem('speakup.celebrated', dayKey(NOW))

  renderHome()

  expect(screen.queryByText('màn hình chúc mừng')).not.toBeInTheDocument()
})

it('celebrates again on a new day even if yesterday was celebrated', () => {
  seedDoneDay(NOW - 1000)
  localStorage.setItem('speakup.celebrated', dayKey(NOW - DAY_MS))

  renderHome()

  expect(screen.getByText('màn hình chúc mừng')).toBeInTheDocument()
})

it('stays on the map while the mission is unfinished', () => {
  logActivity({ ts: NOW, kind: 'story', id: 'little-fox' })

  renderHome()

  expect(screen.queryByText('màn hình chúc mừng')).not.toBeInTheDocument()
  expect(localStorage.getItem('speakup.celebrated')).toBeNull()
})

it('shows a 3-day streak after three consecutive completed days', () => {
  seedDoneDay(NOW - 2 * DAY_MS)
  seedDoneDay(NOW - DAY_MS)
  seedDoneDay(NOW)
  localStorage.setItem('speakup.celebrated', dayKey(NOW))

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

it('puts the five islands on the map and links each to its module', () => {
  renderHome()

  expect(screen.getByRole('link', { name: /Nghe kể chuyện/ })).toHaveAttribute('href', '/stories')
  expect(screen.getByRole('link', { name: /Tập âm/ })).toHaveAttribute('href', '/level/sound-zoo')
  expect(screen.getByRole('link', { name: /Đọc từ/ })).toHaveAttribute('href', '/level/word-pop')
  expect(screen.getByRole('link', { name: /Học từ mới/ })).toHaveAttribute('href', '/words')
  expect(screen.getByRole('link', { name: /Ghép câu/ })).toHaveAttribute('href', '/sentences')
  expect(screen.getByRole('link', { name: /Phụ huynh/ })).toHaveAttribute('href', '/parent')
})

// The islands stop at bậc 2, so Home is the only place the staircase can be found from. Without
// this link Sentence Stars and Story Voice had no route in at all from the map.
it('links the map to the Speak Lab staircase', () => {
  renderHome()

  expect(screen.getByRole('link', { name: /Các bậc luyện nói/ })).toHaveAttribute('href', '/levels')
})

it('shows each island the best stars earned inside that module', () => {
  setStars('story:little-fox', 2)
  setStars('sound:th', 3)

  renderHome()

  const stories = screen.getByRole('link', { name: /Nghe kể chuyện/ })
  expect(within(stories).getAllByTestId('star-filled')).toHaveLength(2)
  const soundZoo = screen.getByRole('link', { name: /Tập âm/ })
  expect(within(soundZoo).getAllByTestId('star-filled')).toHaveLength(3)
  const wordPop = screen.getByRole('link', { name: /Đọc từ/ })
  expect(within(wordPop).queryAllByTestId('star-filled')).toHaveLength(0)
})

/** Phase 5 moved Tập âm's stars from per-card `sz-*` keys to per-sound `sound:<ph>` keys. A child
 * who practised before that still has only the old keys in storage, and reading just the new ones
 * showed them an empty island — as if the app had wiped what they had earned. */
it('still counts the legacy per-card sz- keys so returning children keep their stars', () => {
  setStars('sz-th-three', 2)

  renderHome()

  const soundZoo = screen.getByRole('link', { name: /Tập âm/ })
  expect(within(soundZoo).getAllByTestId('star-filled')).toHaveLength(2)
})

it('shows the best of the new sound key and the legacy card key', () => {
  setStars('sz-th-three', 2)
  setStars('sound:v', 3)

  renderHome()

  const soundZoo = screen.getByRole('link', { name: /Tập âm/ })
  expect(within(soundZoo).getAllByTestId('star-filled')).toHaveLength(3)
})

it('turns unlocked vocabulary cards into stars on the Học từ mới island', () => {
  localStorage.setItem('speakup.leitner', JSON.stringify(
    Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`w-${i}`, { box: 1, due: 0 }])),
  ))

  renderHome()

  const words = screen.getByRole('link', { name: /Học từ mới/ })
  expect(within(words).getAllByTestId('star-filled')).toHaveLength(2)
})
