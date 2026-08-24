import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { logActivity } from '../progress/activity'
import { getLesson } from '../progress/lesson'
import { LessonChip } from './LessonChip'

const NOW = new Date('2026-08-23T10:00:00').getTime()

const renderAt = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><LessonChip /></MemoryRouter>)

/** Today's lesson, with a passing attempt logged for the first `count` items — the same helper
 * shape DailyMission.test.tsx uses. */
function lessonWith(count: number) {
  const lesson = getLesson(NOW)
  lesson.items.slice(0, count).forEach((item, i) => {
    logActivity({ ts: lesson.created + 1000 + i, kind: item.activity, id: item.id })
  })
  return lesson
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date(NOW) })
})

afterEach(() => vi.useRealTimers())

it('shows the chip on a lesson item route, counting the steps done', () => {
  const lesson = lessonWith(2)

  renderAt(lesson.items[3].route)

  const chip = screen.getByRole('link', { name: `🌞 Nhiệm vụ 2/${lesson.items.length}` })
  expect(chip).toHaveAttribute('href', '/mission')
  expect(chip.className).toContain('min-h-[64px]')
  expect(chip.className).toContain('z-40')
})

it('stays away from screens the child did not reach through the lesson', () => {
  const lesson = lessonWith(0)
  expect(lesson.items.some(i => i.route === '/levels')).toBe(false)

  renderAt('/levels')

  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

it.each(['/', '/mission', '/mission/done', '/parent'])('is hidden on %s', path => {
  lessonWith(0)

  renderAt(path)

  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

it('disappears once the whole lesson is done', () => {
  const lesson = getLesson(NOW)
  const done = lessonWith(lesson.items.length)

  renderAt(done.items[0].route)

  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

/** A screen opened as a mission step already carries the lesson — its header goes back to
 * /mission, its CTA hands on to the next step — so a third control in the corner is noise. */
it('stays out of the way on a screen the child opened as a mission step', () => {
  const lesson = lessonWith(0)
  const speak = lesson.items.find(i => !i.route.startsWith('/story/'))!

  render(
    <MemoryRouter initialEntries={[{ pathname: speak.route, state: { mission: true } }]}>
      <LessonChip />
    </MemoryRouter>,
  )

  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

/** Stories keep their own player flow and know nothing about the lesson (spec §3 excludes them),
 * so on a story the chip is the only thread back — mission step or not. */
it('still shows on a story, which has no way back of its own', () => {
  const lesson = lessonWith(0)
  const story = lesson.items.find(i => i.route.startsWith('/story/'))!

  render(
    <MemoryRouter initialEntries={[{ pathname: story.route, state: { mission: true } }]}>
      <LessonChip />
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: `🌞 Nhiệm vụ 0/${lesson.items.length}` }))
    .toHaveAttribute('href', '/mission')
})

/** Free play is untouched by the rule above: no flag, no hiding. */
it('still shows on the same route reached without the mission flag', () => {
  const lesson = lessonWith(0)
  const speak = lesson.items.find(i => !i.route.startsWith('/story/'))!

  renderAt(speak.route)

  expect(screen.getByRole('link')).toHaveAttribute('href', '/mission')
})
