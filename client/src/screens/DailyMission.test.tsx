import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { dayKey, logActivity } from '../progress/activity'
import { getBand, setBandValue } from '../progress/band'
import { getLesson } from '../progress/lesson'
import type { Lesson, LessonItem, LessonItemKind } from '../progress/lesson'
import { DailyMission } from './DailyMission'

const NOW = new Date('2026-08-23T10:00:00').getTime()
const DAY_MS = 24 * 60 * 60 * 1000

/** Whatever a card or the CTA leads to, rendered so a test can read both the path and the router
 * state the link carried: `{ mission: true }` is what tells a practice screen it is running as a
 * lesson step (spec §3), and it leaves no trace in the DOM. */
function Probe() {
  const location = useLocation()
  return <p data-testid="probe">{location.pathname} {JSON.stringify(location.state)}</p>
}

/** The screen inside a router that also serves the celebration screen (as a stub, so the
 * once-a-day redirect can be observed without pulling in MissionComplete) and a probe on every
 * other route, standing in for the practice screens the cards point at. */
function renderMission() {
  return render(
    <MemoryRouter initialEntries={['/mission']}>
      <Routes>
        <Route path="/mission" element={<DailyMission />} />
        <Route path="/mission/done" element={<p>màn hình chúc mừng</p>} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Logs a passing attempt for each of `items`, marking them done for today's lesson. */
function complete(lesson: Lesson, items: LessonItem[]) {
  items.forEach((item, i) => {
    logActivity({ ts: lesson.created + 1000 + i, kind: item.activity, id: item.id })
  })
}

/** Today's items bucketed the way the screen buckets them — by kind, each kind in the order it
 * first appears — so the expectations follow the seeded generator instead of assuming a shape. */
function groupsOf(lesson: Lesson): { kind: LessonItemKind; items: LessonItem[] }[] {
  const kinds: LessonItemKind[] = []
  for (const item of lesson.items) if (!kinds.includes(item.kind)) kinds.push(item.kind)
  return kinds.map(kind => ({ kind, items: lesson.items.filter(i => i.kind === kind) }))
}

const TITLE: Record<LessonItemKind, (n: number) => string> = {
  listen: n => `Nghe ${n} truyện`,
  speak: n => `${n} thẻ phát âm`,
  word: n => `${n} từ mới`,
  sentence: n => `${n} câu ghép`,
  review: n => `${n} bài ôn tập`,
}

const MINUTES: Record<LessonItemKind, (n: number) => string> = {
  listen: n => `≈ ${4 * n} phút`,
  speak: n => `≈ ${n} phút`,
  word: n => `≈ ${n} phút`,
  sentence: n => `≈ ${n} phút`,
  review: n => `≈ ${n} phút`,
}

const card = (kind: LessonItemKind) => screen.getByTestId(`group-${kind}`)

/** The step caption of a card, read whole: the ringed card colours the invitation with a nested
 * span, which text matching would otherwise treat as a separate element. */
const caption = (kind: LessonItemKind) =>
  within(card(kind)).getByText(/^Bước/).textContent

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date(NOW) })
})

afterEach(() => {
  vi.useRealTimers()
})

it('shows one card per kind of step, in lesson order, titled with its real count', () => {
  const groups = groupsOf(getLesson(NOW))

  renderMission()

  expect(screen.getByRole('heading', { name: 'Nhiệm vụ hôm nay 🌞' })).toBeInTheDocument()
  expect(screen.getAllByTestId(/^group-/).map(el => el.getAttribute('data-testid')))
    .toEqual(groups.map(g => `group-${g.kind}`))

  groups.forEach((group, i) => {
    const el = card(group.kind)
    expect(within(el).getByText(TITLE[group.kind](group.items.length))).toBeInTheDocument()
    expect(within(el).getByText(`0/${group.items.length}`)).toBeInTheDocument()
    expect(within(el).getByText(MINUTES[group.kind](group.items.length))).toBeInTheDocument()
    // Every card is numbered; only the ringed one adds the invitation.
    expect(caption(group.kind)).toBe(i === 0 ? 'Bước 1 · bắt đầu ở đây!' : `Bước ${i + 1}`)
  })
})

// Phase 9 §2: the 🧱 step sits between 🧩 and 🔁, in the order the generator lays the lesson out.
it('shows the sentence card in lesson order, after the new words', () => {
  const lesson = getLesson(NOW)
  const sentences = lesson.items.filter(i => i.kind === 'sentence')
  expect(sentences.length).toBeGreaterThan(0)

  renderMission()

  const el = card('sentence')
  expect(within(el).getByText('🧱')).toBeInTheDocument()
  expect(within(el).getByText(`${sentences.length} câu ghép`)).toBeInTheDocument()
  expect(within(el).getByText(`≈ ${sentences.length} phút`)).toBeInTheDocument()
  expect(el).toHaveAttribute('href', sentences[0].route)

  const order = screen.getAllByTestId(/^group-/).map(el => el.getAttribute('data-testid'))
  expect(order).toEqual(['group-listen', 'group-speak', 'group-word', 'group-sentence', 'group-review'])
})

/** Five groups since 🧱 joined them, and the grid has to hold all five side by side: a row that
 * wrapped pushed the CTA off a 1194×834 iPad, which is the one thing the child came here to tap. */
it('keeps all five groups on a single row from lg up', () => {
  const groups = groupsOf(getLesson(NOW))
  expect(groups).toHaveLength(5)

  renderMission()

  const grid = card('listen').parentElement
  expect(grid).toHaveClass('grid', 'lg:grid-cols-5')
  expect(within(grid!).getAllByTestId(/^group-/)).toHaveLength(5)
})

// The child asked for a mission that mixes islands; naming the islands on the card would put the
// topic axis back on the mission screen, which is exactly what the mix is meant to dissolve.
it('names no topic anywhere on the mission', () => {
  getLesson(NOW)

  renderMission()

  const page = document.body.textContent ?? ''
  for (const name of ['Động vật', 'Đồ ăn', 'Trường học', 'Gia đình', 'Thời tiết', 'Màu sắc', 'Cơ thể', 'Đồ chơi']) {
    expect(page).not.toContain(name)
  }
})

it('counts the finished items inside each group', () => {
  const lesson = getLesson(NOW)
  const [first, second] = groupsOf(lesson)
  complete(lesson, [...first.items, second.items[0]])

  renderMission()

  expect(within(card(first.kind)).getByText(`${first.items.length}/${first.items.length}`))
    .toBeInTheDocument()
  expect(within(card(second.kind)).getByText(`1/${second.items.length}`)).toBeInTheDocument()
  // The header keeps the whole-lesson fraction.
  expect(screen.getByText(`${first.items.length + 1}/${lesson.items.length}`)).toBeInTheDocument()
})

it('rings the first group that still has something to do, and only that one', () => {
  const lesson = getLesson(NOW)
  const [first, second] = groupsOf(lesson)
  complete(lesson, first.items)

  renderMission()

  expect(caption(second.kind)).toBe('Bước 2 · bắt đầu ở đây!')
  expect(caption(first.kind)).toBe('Bước 1')
  expect(screen.getAllByText(/bắt đầu ở đây!/)).toHaveLength(1)
  expect(card(second.kind).className).toContain('border-teal-500')
  expect(card(first.kind).className).not.toContain('border-teal-500')
})

it('shows ✓ Xong instead of the minute chip on a finished group', () => {
  const lesson = getLesson(NOW)
  const [first] = groupsOf(lesson)
  complete(lesson, first.items)

  renderMission()

  const el = card(first.kind)
  expect(within(el).getByText('✓ Xong')).toBeInTheDocument()
  expect(within(el).queryByText(/phút/)).not.toBeInTheDocument()
  expect(screen.getAllByText('✓ Xong')).toHaveLength(1)
})

it('links each card to the first item of its group still to do', () => {
  const lesson = getLesson(NOW)
  const groups = groupsOf(lesson)
  const [first] = groups
  complete(lesson, [first.items[0]])

  renderMission()

  // The finished item is skipped, so the card resumes the group rather than restarting it.
  expect(card(first.kind)).toHaveAttribute('href', first.items[1]?.route ?? first.items[0].route)
  for (const group of groups.slice(1)) {
    expect(card(group.kind)).toHaveAttribute('href', group.items[0].route)
  }
})

// A group whose items are all done is still a place on the map: the ✓ says the work is finished,
// the card takes the child back for a replay.
it('links a finished group back to its first item', () => {
  const lesson = getLesson(NOW)
  const [first] = groupsOf(lesson)
  complete(lesson, first.items)

  renderMission()

  expect(card(first.kind)).toHaveAttribute('href', first.items[0].route)
})

it('carries the mission flag through a card tap, so the step knows it is part of the lesson', () => {
  const lesson = getLesson(NOW)
  const [, second] = groupsOf(lesson)

  renderMission()
  fireEvent.click(card(second.kind))

  expect(screen.getByTestId('probe')).toHaveTextContent(
    `${second.items[0].route} {"mission":true}`,
  )
})

it('points the CTA at the ringed group first undone item, and flags it too', () => {
  const lesson = getLesson(NOW)
  const [first] = groupsOf(lesson)
  complete(lesson, [first.items[0]])
  const next = first.items[1] ?? groupsOf(lesson)[1].items[0]

  renderMission()

  const cta = screen.getByRole('link', { name: 'Tiếp tục ▸' })
  expect(cta).toHaveAttribute('href', next.route)

  fireEvent.click(cta)
  expect(screen.getByTestId('probe')).toHaveTextContent(`${next.route} {"mission":true}`)
})

it('says Bắt đầu on an untouched lesson and Tiếp tục once a step is done', () => {
  const lesson = getLesson(NOW)

  const { unmount } = renderMission()
  expect(screen.getByRole('link', { name: 'Bắt đầu ▸' }))
    .toHaveAttribute('href', lesson.items[0].route)
  unmount()

  complete(lesson, [lesson.items[0]])
  renderMission()
  expect(screen.getByRole('link', { name: 'Tiếp tục ▸' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Bắt đầu ▸' })).not.toBeInTheDocument()
})

it('shows the band chip and the done count', () => {
  const lesson = getLesson(NOW)
  complete(lesson, lesson.items.slice(0, 2))

  renderMission()

  expect(screen.getByText(`Bậc ⭐ ${getBand().value}`)).toBeInTheDocument()
  expect(screen.getByText(`2/${lesson.items.length}`)).toBeInTheDocument()
})

// The cards label the items on screen, and those were chosen when the lesson was generated. A
// parent raising the difficulty at lunchtime changes tomorrow's lesson, not today's.
it('shows the band the lesson was built at, not a parent override made since', () => {
  setBandValue(2)
  expect(getLesson(NOW).band).toBe(2)

  setBandValue(5)
  renderMission()

  expect(screen.getByText('Bậc ⭐ 2')).toBeInTheDocument()
  expect(screen.queryByText('Bậc ⭐ 5')).not.toBeInTheDocument()
})

// A long lesson is taller than an iPad screen, so a CTA that scrolled with the cards sat below the
// fold on load — the one thing the child came here to tap.
it('keeps the CTA in a block stuck to the bottom of the scroller', () => {
  renderMission()

  const cta = screen.getByRole('link', { name: 'Bắt đầu ▸' })
  expect(cta.parentElement?.className).toContain('sticky')
  expect(cta.parentElement?.className).toContain('bottom-0')
})

it('shows the finish state on a revisit once every step is done', () => {
  const lesson = getLesson(NOW)
  complete(lesson, lesson.items)
  // Already celebrated earlier today, so this visit stays on the screen.
  localStorage.setItem('speakup.celebrated', dayKey(NOW))

  renderMission()

  expect(screen.queryByText(/bắt đầu ở đây!/)).not.toBeInTheDocument()
  expect(screen.getAllByText('✓ Xong')).toHaveLength(groupsOf(lesson).length)
  expect(screen.getByRole('link', { name: 'Về bản đồ 🏝️' })).toHaveAttribute('href', '/')
})

it('sends the child to the celebration screen when the last step lands here', () => {
  const lesson = getLesson(NOW)
  complete(lesson, lesson.items)

  renderMission()

  expect(screen.getByText('màn hình chúc mừng')).toBeInTheDocument()
  expect(localStorage.getItem('speakup.celebrated')).toBe(dayKey(NOW))
})

it('does not celebrate the same finished lesson twice in one day', () => {
  const lesson = getLesson(NOW)
  complete(lesson, lesson.items)
  localStorage.setItem('speakup.celebrated', dayKey(NOW))

  renderMission()

  expect(screen.queryByText('màn hình chúc mừng')).not.toBeInTheDocument()
})

it('celebrates again on a new day even if yesterday was celebrated', () => {
  const lesson = getLesson(NOW)
  complete(lesson, lesson.items)
  localStorage.setItem('speakup.celebrated', dayKey(NOW - DAY_MS))

  renderMission()

  expect(screen.getByText('màn hình chúc mừng')).toBeInTheDocument()
})

it('stays on the mission while a step is still open', () => {
  const lesson = getLesson(NOW)
  complete(lesson, lesson.items.slice(0, 1))

  renderMission()

  expect(screen.queryByText('màn hình chúc mừng')).not.toBeInTheDocument()
  expect(localStorage.getItem('speakup.celebrated')).toBeNull()
})
