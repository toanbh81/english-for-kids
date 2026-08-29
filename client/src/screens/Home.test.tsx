import { act, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { TopicId } from '../content/topics'
import { findTopic } from '../content/words'
import { dayKey, logActivity } from '../progress/activity'
import { getLesson } from '../progress/lesson'

// Every existing test in this file predates Phase 11 and expects the byte-identical, no-cloud
// app — so the default here is "unconfigured", exactly like a contributor's clone with no
// Supabase env vars. `client/.env` in THIS sandbox carries real project keys (they are
// public-by-design, safe to commit to a working copy, but not to lean on in a unit test), so the
// mock is what keeps these tests hermetic regardless of what is on disk. Only the describe blocks
// below that are actually about the cloud UI flip `cloud.configured`.
const cloud = vi.hoisted(() => ({ configured: false }))
vi.mock('../cloud/supabase', () => ({ isCloudConfigured: () => cloud.configured }))

const auth = vi.hoisted(() => ({ isAnonymous: vi.fn(async () => true) }))
vi.mock('../cloud/auth', () => auth)

import { Home } from './Home'

const NOW = new Date('2026-08-23T10:00:00').getTime()
const DAY_MS = 24 * 60 * 60 * 1000

/** Home is rendered inside a router that also serves a stub for the celebration screen, so the
 * once-a-day redirect can be observed without pulling in MissionComplete. */
function renderHome() {
  return render(
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
  cloud.configured = false
  auth.isAnonymous.mockResolvedValue(true)
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

// Design §3: M1b prints the greeting as plain text — the speech bubble is M1a's. Only the chrome
// is dropped, so both lines are still one element at every width; the panel comes back at `md`.
it('drops the speech-bubble chrome from the greeting on a phone', () => {
  renderHome()

  const bubble = screen.getByText('Chào bé! 👋').closest('div')!.parentElement!
  expect(bubble).toHaveClass('max-md:bg-transparent', 'max-md:shadow-none', 'max-md:px-0', 'max-md:py-0')
  // The panel itself is untouched from `md` up — every override above is invisible there.
  expect(bubble).toHaveClass('rounded-[22px]', 'bg-white', 'shadow-card-sm')
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

describe('Phase 11: the milestone banner', () => {
  function seedThreeDayStreak() {
    seedDoneDay(NOW - 2 * DAY_MS)
    seedDoneDay(NOW - DAY_MS)
    seedDoneDay(NOW)
  }

  it('stays hidden with no cloud configured, however long the streak', async () => {
    cloud.configured = false
    seedThreeDayStreak()

    renderHome()
    await act(async () => { await Promise.resolve() })

    expect(screen.queryByTestId('milestone-banner')).not.toBeInTheDocument()
  })

  it('appears after a 3-day streak on a device nobody has linked yet, and can be dismissed', async () => {
    cloud.configured = true
    auth.isAnonymous.mockResolvedValue(true)
    seedThreeDayStreak()

    renderHome()
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('milestone-banner')).toHaveTextContent('Tiến độ mới lưu trên máy này')
    expect(screen.getByRole('link', { name: 'liên kết email' })).toHaveAttribute('href', '/parent')

    act(() => { screen.getByLabelText('Đóng thông báo liên kết email').click() })
    expect(screen.queryByTestId('milestone-banner')).not.toBeInTheDocument()
  })

  it('does not claim more safety than exists once the parent has already linked', async () => {
    cloud.configured = true
    auth.isAnonymous.mockResolvedValue(false)
    seedThreeDayStreak()

    renderHome()
    await act(async () => { await Promise.resolve() })

    expect(screen.queryByTestId('milestone-banner')).not.toBeInTheDocument()
  })

  it('stays dismissed across a remount', async () => {
    cloud.configured = true
    auth.isAnonymous.mockResolvedValue(true)
    seedThreeDayStreak()
    localStorage.setItem('speakup.cloud.bannerDismissed', '1')

    renderHome()
    await act(async () => { await Promise.resolve() })

    expect(screen.queryByTestId('milestone-banner')).not.toBeInTheDocument()
  })
})

describe('Phase 11: the Add-to-Home-Screen nudge', () => {
  const originalUA = window.navigator.userAgent

  function setUserAgent(ua: string) {
    Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
  }

  afterEach(() => {
    setUserAgent(originalUA)
    delete (window.navigator as Navigator & { standalone?: boolean }).standalone
  })

  it('nudges an un-installed iPad Safari, independent of the cloud', () => {
    cloud.configured = false
    setUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')

    renderHome()

    expect(screen.getByTestId('a2hs-banner')).toHaveTextContent('Thêm Speak Up! vào Màn hình chính')
  })

  it('stays quiet once the app is already installed', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')
    ;(window.navigator as Navigator & { standalone?: boolean }).standalone = true

    renderHome()

    expect(screen.queryByTestId('a2hs-banner')).not.toBeInTheDocument()
  })

  it('says nothing on a platform the WebKit 7-day wipe does not apply to', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0')

    renderHome()

    expect(screen.queryByTestId('a2hs-banner')).not.toBeInTheDocument()
  })

  it('is dismissible, once, for good', () => {
    setUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')

    renderHome()
    act(() => { screen.getByTestId('a2hs-banner').querySelector('button')!.click() })
    expect(screen.queryByTestId('a2hs-banner')).not.toBeInTheDocument()

    renderHome()
    expect(screen.queryByTestId('a2hs-banner')).not.toBeInTheDocument()
  })
})

describe('Phase 11: "Đã dùng Speak Up rồi?"', () => {
  it('offers the restore door on a fresh device with cloud configured', () => {
    cloud.configured = true

    renderHome()

    expect(screen.getByRole('link', { name: 'Đã dùng Speak Up rồi?' })).toHaveAttribute('href', '/start')
  })

  it('stays hidden with no cloud configured', () => {
    cloud.configured = false

    renderHome()

    expect(screen.queryByRole('link', { name: 'Đã dùng Speak Up rồi?' })).not.toBeInTheDocument()
  })

  it('disappears once the child has made any progress', () => {
    cloud.configured = true
    completeLesson(NOW, 1)

    renderHome()

    expect(screen.queryByRole('link', { name: 'Đã dùng Speak Up rồi?' })).not.toBeInTheDocument()
  })

  /**
   * The bug this link had: `hasProgress` was built from `missionStatus` and `lessonStatus`, and
   * BOTH filter the log to today. So the door that can hand this iPad to another account came back
   * every single morning, in front of the child, on top of however much history existed — and the
   * comment above it claimed the opposite. The old guard only ever completed a lesson *today*,
   * which is the one case where the two readings agree.
   */
  it('stays away on a device with history but nothing done yet today', () => {
    cloud.configured = true
    seedDoneDay(NOW - 2 * DAY_MS)
    seedDoneDay(NOW - DAY_MS)

    renderHome()

    expect(screen.queryByRole('link', { name: 'Đã dùng Speak Up rồi?' })).not.toBeInTheDocument()
  })

  it('stays away for a child whose stars are the only thing left on the device', () => {
    cloud.configured = true
    // An activity log that has rotated out, or a partial restore: the stars are still progress,
    // and this device is still not the fresh one this link is for.
    localStorage.setItem('speakup.stars', JSON.stringify({ 'sword:cat': 3 }))

    renderHome()

    expect(screen.queryByRole('link', { name: 'Đã dùng Speak Up rồi?' })).not.toBeInTheDocument()
  })

  it('keeps Foxy today-scoped even so', () => {
    cloud.configured = true
    seedDoneDay(NOW - DAY_MS)

    renderHome()

    // Yesterday's work is history, not this morning's greeting: the mood question and the
    // restore-door question are different questions and no longer share an answer.
    expect(screen.getByTestId('foxy')).toHaveAttribute('data-mood', 'idle')
    expect(screen.getByText('Hôm nay mình luyện nói nhé!')).toBeInTheDocument()
  })
})

/** §Rules puts the tap floor at 64 px on every child-reachable screen; the only exemption the
 * design grants is the adult dashboard behind the math gate. Both banner close buttons were 32. */
describe('Phase 11: the banners meet the child tap floor', () => {
  it('gives both dismiss buttons a 64 px hit area', async () => {
    cloud.configured = true
    auth.isAnonymous.mockResolvedValue(true)
    seedDoneDay(NOW - 2 * DAY_MS)
    seedDoneDay(NOW - DAY_MS)
    seedDoneDay(NOW)
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
      configurable: true,
    })

    renderHome()
    await act(async () => { await Promise.resolve() })

    expect(screen.getByLabelText('Đóng thông báo liên kết email')).toHaveClass('h-16', 'w-16')
    expect(screen.getByLabelText('Đóng thông báo cài vào Màn hình chính')).toHaveClass('h-16', 'w-16')
  })
})

it('keeps the stacked layout scrollable so the mission CTA is never trapped below the fold', () => {
  renderHome()

  const root = screen.getByRole('main')
  // A fixed-height, clipped root is what hid the mission CTA and the parent link in portrait:
  // the stacked layout is taller than the viewport, so the root has to grow and the page scroll.
  expect(root).toHaveClass('min-h-full', 'overflow-y-auto')
  expect(root.classList.contains('h-full')).toBe(false)
  expect(root.classList.contains('overflow-hidden')).toBe(false)
  // Only the landscape map frame may clip, and only from `ipad` up.
  expect(Array.from(root.classList).filter(c => c.includes('overflow-hidden'))).toEqual([])
})

/**
 * Phase 10 / design M1b: a phone gets no curved map. The islands are a plain 2-column grid of
 * cards, and the classes say so — nothing positions them until `ipad`. Asserting the classes is the
 * only way to see a breakpoint in jsdom, which has no stylesheet and so no layout to measure; the
 * geometry itself is checked in a real browser at 390×844 and 1194×834.
 */
it('lays the islands out as a grid on a phone, with nothing positioned until the iPad', () => {
  renderHome()

  for (const id of ['animals', 'weather']) {
    const classes = Array.from(screen.getByTestId(`island-${id}`).classList)
    // A card of the grid: sized, not placed.
    expect(classes).toContain('h-32')
    expect(classes).toContain('rounded-xl3')
    // `absolute` only ever appears behind the `ipad:` prefix — never on its own.
    expect(classes.filter(c => c.endsWith('absolute'))).toEqual(['ipad:absolute'])
  }
})

/**
 * The same rule for the other three blocks of the M1b column. Everything the phone lays out has to
 * stay in flow: an `absolute` that escaped its `ipad:` prefix would take a block out of the column
 * and drop it on top of the grid, and — unlike the islands — the mission card, the stairs link and
 * the parent link have no `data-testid` of their own, so nothing else here would notice.
 */
it('keeps the mission card, the stairs link and the parent link in flow on a phone', () => {
  renderHome()

  const wrappers = {
    mission: screen.getByRole('link', { name: 'Bắt đầu ▸' }).closest('div.col-span-2')!,
    stairs: screen.getByRole('link', { name: /Các bậc luyện nói/ }).parentElement!,
    parent: screen.getByRole('link', { name: 'Phụ huynh' }).parentElement!,
  }

  for (const [name, wrapper] of Object.entries(wrappers)) {
    const classes = Array.from(wrapper.classList)
    // `absolute` only ever appears behind the `ipad:` prefix — never on its own.
    expect(classes.filter(c => c.endsWith('absolute')), name).toEqual(['ipad:absolute'])
  }
})

it('keeps the mission CTA above the islands in the DOM, where a phone can reach it', () => {
  renderHome()

  const cta = screen.getByRole('link', { name: 'Bắt đầu ▸' })
  const firstIsland = screen.getByTestId('island-animals')
  // Node.DOCUMENT_POSITION_FOLLOWING: the first island comes *after* the CTA.
  expect(cta.compareDocumentPosition(firstIsland) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

// Dropping the map on the phone must not delete it: from `ipad` up the trail, the slot offsets and
// the absolute island band are still the layout, exactly as in phase 9.
it('still emits the curved map for the iPad breakpoint', () => {
  const { container } = renderHome()

  // The trail is drawn in the map's own 1194×834 frame coordinates — Foxy is the other svg here.
  const trail = Array.from(container.querySelectorAll('svg'))
    .find(svg => svg.getAttribute('viewBox') === '0 0 1194 834')
  expect(trail).toBeDefined()
  expect(Array.from(trail!.classList)).toEqual(expect.arrayContaining(['hidden', 'ipad:block']))
  expect(trail!.querySelector('path')?.getAttribute('d')).toMatch(/^M125 103 C/)

  const island = screen.getByTestId('island-animals')
  expect(Array.from(island.classList)).toEqual(expect.arrayContaining(['ipad:absolute', 'ipad:w-[15%]']))
  expect(island).toHaveStyle({ left: '3%', top: '0%' })
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

/**
 * Every island stands on a hand-placed slot, and there is no ninth one. A topic added without a
 * slot used to render an unpositioned, colourless disc over the first island — a silent bug on the
 * one screen the child starts from — so the map now refuses to load at all and says why.
 */
it('refuses to build a map with more topics than island slots', async () => {
  vi.resetModules()
  vi.doMock('../content/topics', () => ({
    TOPICS: Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, name: `Đảo ${i}`, emoji: '🏝️' })),
  }))

  await expect(import('./Home')).rejects.toThrow(/9 topics but only 8 island slots/)

  vi.doUnmock('../content/topics')
  vi.resetModules()
})

/**
 * `text-lg` sets a 28 px line-height as well as an 18 px size, and the phone pass restored only
 * the size — so at 1194×834 the star pill came out 52 px tall instead of the map's 57 and dragged
 * the row 3 px down. jsdom cannot lay that out, so the guard is on the class list: any
 * `ipad:text-[...]` restore of a `text-<scale>` phone value has to restate the leading too.
 */
it('restores the iPad leading, not just the size, on the star pill', () => {
  renderHome()

  const pill = screen.getByText(/^⭐/)
  expect(pill).toHaveClass('text-lg', 'ipad:text-[22px]', 'ipad:leading-normal')
})

/**
 * Two whole spellings, `HomeLabel`-style, rather than one emoji plus an `ipad:`-revealed word next
 * to it: a flex `gap` between two items is 8 px where the map's single text run had a 4-ish px
 * space, and the corner button measured 157 px wide instead of the 153 it has always been.
 */
it('spells the parent link out twice rather than growing the map corner by a gap', () => {
  renderHome()

  const parent = screen.getByRole('link', { name: 'Phụ huynh' })
  expect(parent.className).not.toContain('ipad:gap-')
  expect(parent.className).toContain('ipad:min-w-[64px]')
  expect(within(parent).getByText('👨‍👩‍👧')).toHaveClass('ipad:hidden')
  expect(within(parent).getByText('👨‍👩‍👧 Phụ huynh')).toHaveClass('hidden', 'ipad:inline')
})
