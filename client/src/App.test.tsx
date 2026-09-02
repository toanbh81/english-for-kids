import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { dayKey } from './progress/activity'
import { saveLesson } from './progress/lessonStore'
import type { LessonItem } from './progress/lesson'

/** Today's lesson, written straight to storage, so the mission flag resolves against a real step. */
function seedLesson(...items: LessonItem[]) {
  const now = Date.now()
  saveLesson({ day: dayKey(now), created: now, band: 5, items })
}

const WP_CAT_STEP: LessonItem =
  { kind: 'speak', activity: 'speak', id: 'wp-cat', route: '/practice/wp-cat', label: 'Nói: cat', emoji: '🗣️' }

beforeEach(() => {
  localStorage.clear()
})

/**
 * Phase 12's transition is over: every screen now draws `PageHeader` itself, `LessonChip` has no
 * `global` variant left to float outside it, and `App.tsx` no longer renders one of its own. So the
 * lesson thread appears exactly once per screen — inside the header — never twice and never zero
 * times on a screen that owns a mission step.
 */
it('shows the lesson thread exactly once, inside the header, on a screen the child reached outside the mission', () => {
  seedLesson(WP_CAT_STEP)

  render(
    <MemoryRouter initialEntries={['/practice/wp-cat']}>
      <App />
    </MemoryRouter>,
  )

  // Without the mission flag, `LessonChip` is not redundant here — it is the one thread back to
  // the lesson — and `PracticeCard` itself is not mission-aware, so its own back button reads
  // "Quay lại" (out to the level) rather than "Nhiệm vụ" (back to the mission). Exactly one link
  // should carry the "Nhiệm vụ n/N" name: the chip.
  const banner = screen.getByRole('banner')
  const missionLinks = screen.getAllByRole('link', { name: /Nhiệm vụ \d+\/\d+/ })
  expect(missionLinks).toHaveLength(1)
  expect(banner).toContainElement(missionLinks[0])

  const backLink = screen.getByRole('link', { name: 'Quay lại' })
  expect(banner).toContainElement(backLink)
})

it('shows no lesson thread on Home, which is excluded from it entirely', () => {
  seedLesson(WP_CAT_STEP)

  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )

  expect(screen.queryByRole('link', { name: /Nhiệm vụ/ })).not.toBeInTheDocument()
})
