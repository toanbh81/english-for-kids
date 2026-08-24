import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { logActivity } from '../progress/activity'
import { getBand } from '../progress/band'
import { getLesson } from '../progress/lesson'
import { DailyMission } from './DailyMission'

const NOW = new Date('2026-08-23T10:00:00').getTime()

function renderMission() {
  return render(<MemoryRouter><DailyMission /></MemoryRouter>)
}

/** Generates today's lesson the way the screen does on mount and logs a passing attempt for the
 * first `count` of its items, so the ticks and the highlighted step can be driven without knowing
 * which items the seeded generator picked (same helper style as Home.test.tsx's completeLesson). */
function completeLesson(ts: number, count = 0) {
  const lesson = getLesson(ts)
  lesson.items.slice(0, count).forEach((item, i) => {
    logActivity({ ts: lesson.created + 1000 + i, kind: item.activity, id: item.id })
  })
  return lesson
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date(NOW) })
})

afterEach(() => {
  vi.useRealTimers()
})

it('lists every item of today lesson in order, with its label', () => {
  const lesson = completeLesson(NOW)

  const { container } = renderMission()

  expect(screen.getByRole('heading', { name: 'Nhiệm vụ hôm nay 🌞' })).toBeInTheDocument()
  const labels = Array.from(container.querySelectorAll('.font-display.text-2xl'))
    .map(el => el.textContent)
  expect(labels).toEqual(lesson.items.map(item => item.label))
})

it('shows the band chip and the done count', () => {
  const lesson = completeLesson(NOW, 2)

  renderMission()

  expect(screen.getByText(`Bậc ⭐ ${getBand().value}`)).toBeInTheDocument()
  expect(screen.getByText(`2/${lesson.items.length}`)).toBeInTheDocument()
})

it('ticks off the items already done and rings the first undone one', () => {
  const lesson = completeLesson(NOW, 2)

  renderMission()

  expect(screen.getAllByText('✓ Xong')).toHaveLength(2)
  expect(screen.getByText('bắt đầu ở đây!')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: `Bắt đầu ${lesson.items[2].emoji}` }))
    .toHaveAttribute('href', lesson.items[2].route)
})

it('links the CTA to the first undone item route when nothing is done yet', () => {
  const lesson = completeLesson(NOW)

  renderMission()

  expect(screen.getByRole('link', { name: `Bắt đầu ${lesson.items[0].emoji}` }))
    .toHaveAttribute('href', lesson.items[0].route)
})

// Done state must be read per item, not inferred from a count of completed events — logging item
// 1 alone (skipping item 0) must not be mistaken for "the first item is done".
it('ticks the item actually completed even when it is not the first, and CTA still points at item 0', () => {
  const lesson = getLesson(NOW)
  logActivity({ ts: lesson.created + 1000, kind: lesson.items[1].activity, id: lesson.items[1].id })

  renderMission()

  expect(screen.getAllByText('✓ Xong')).toHaveLength(1)

  const item0Card = screen.getByText(lesson.items[0].label).closest('.rounded-xl3') as HTMLElement
  const item1Card = screen.getByText(lesson.items[1].label).closest('.rounded-xl3') as HTMLElement
  expect(within(item0Card).queryByText('✓ Xong')).not.toBeInTheDocument()
  expect(within(item1Card).getByText('✓ Xong')).toBeInTheDocument()

  expect(screen.getByRole('link', { name: `Bắt đầu ${lesson.items[0].emoji}` }))
    .toHaveAttribute('href', lesson.items[0].route)
})

it('makes every undone item its own link, and leaves the done ones inert', () => {
  const lesson = completeLesson(NOW, 2)

  renderMission()

  lesson.items.forEach((item, i) => {
    const anchor = screen.getByText(item.label).closest('a')
    if (i < 2) expect(anchor, `item ${i} is done and must not be a link`).toBeNull()
    else expect(anchor).toHaveAttribute('href', item.route)
  })
})

// A ten-item lesson is taller than an iPad screen, so a CTA that scrolled with the list sat below
// the fold on load — the one thing the child came here to tap.
it('keeps the CTA in a block stuck to the bottom of the scroller', () => {
  completeLesson(NOW)

  renderMission()

  const cta = screen.getByRole('link', { name: /^Bắt đầu/ })
  expect(cta.parentElement?.className).toContain('sticky')
  expect(cta.parentElement?.className).toContain('bottom-0')
})

it('shows the finish state once every item is done', () => {
  const all = getLesson(NOW)
  const lesson = completeLesson(NOW, all.items.length)

  renderMission()

  expect(screen.queryByText('bắt đầu ở đây!')).not.toBeInTheDocument()
  expect(screen.getAllByText('✓ Xong')).toHaveLength(lesson.items.length)
  expect(screen.getByRole('link', { name: 'Về bản đồ 🏝️' })).toHaveAttribute('href', '/')
})
