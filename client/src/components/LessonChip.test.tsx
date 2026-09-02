import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { dayKey, logActivity } from '../progress/activity'
import { getLesson } from '../progress/lesson'
import { saveLesson } from '../progress/lessonStore'
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

/** An element's classes as exact tokens. */
const classes = (el: Element) => el.className.split(/\s+/).filter(Boolean)

it('shows the chip on a lesson item route, counting the steps done, sized for the header cell', () => {
  const lesson = lessonWith(2)

  renderAt(lesson.items[3].route)

  const chip = screen.getByRole('link', { name: `🌞 Nhiệm vụ 2/${lesson.items.length}` })
  expect(chip).toHaveAttribute('href', '/mission')
  // The header-cell box: 56/48 px, never `fixed` — it sits inside the header's own grid cell
  // rather than floating over the page.
  const tokens = classes(chip)
  expect(tokens).toEqual(expect.arrayContaining(['h-14', 'w-14', 'rounded-r18', 'md:h-12', 'md:px-4', 'md:rounded-r16']))
  expect(tokens).not.toContain('fixed')
})

/** The 56 px badge cannot fit the words beside the sun, so it stacks the sun over the count and
 * keeps the whole sentence for a screen reader. The name it is read out by is the same string at
 * every width — the tests above and below both look it up by that name. */
it('prints the count on the phone badge without changing the name it is announced by', () => {
  const lesson = lessonWith(2)

  renderAt(lesson.items[3].route)
  const [sun, spoken, count] = [...screen.getByRole('link', { name: /Nhiệm vụ/ }).children]

  expect(sun).toHaveAttribute('aria-hidden', 'true')
  expect(classes(sun)).toContain('md:hidden')
  expect(spoken).toHaveTextContent(`🌞 Nhiệm vụ 2/${lesson.items.length}`)
  expect(classes(spoken)).toContain('sr-only')
  expect(classes(spoken)).toContain('md:not-sr-only')
  expect(count).toHaveTextContent(`2/${lesson.items.length}`)
  expect(count).toHaveAttribute('aria-hidden', 'true')
  expect(classes(count)).toContain('md:hidden')
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

/** The listen step is one story worked through three screens — player, quiz, retell. The chip is
 * the only thread back through all of them, and dropping it at the quiz stranded the child in the
 * middle of their own lesson step. */
it.each(['/quiz', '/retell'])('follows the story step into its %s', sub => {
  const lesson = lessonWith(1)
  const story = lesson.items.find(i => i.route.startsWith('/story/'))!

  render(
    <MemoryRouter initialEntries={[{ pathname: `${story.route}${sub}`, state: { mission: true } }]}>
      <LessonChip />
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: `🌞 Nhiệm vụ 1/${lesson.items.length}` }))
    .toHaveAttribute('href', '/mission')
})

/** A sub-route is a whole extra segment, not any string that happens to start the same way: a
 * neighbouring card whose id merely extends today's is not today's step. */
it('does not mistake a longer sibling route for a step of the lesson', () => {
  const lesson = lessonWith(0)
  const word = lesson.items.find(i => i.route.startsWith('/words/'))!

  renderAt(`${word.route}-pie`)

  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

/**
 * The Phase-8 upgrade. Yesterday's persisted lesson still holds a whole-group `/sound/th` step, so
 * the word screen the child taps — `/sound/th/sz-th-three` — finds no mission of its own: no header
 * back, no CTA onward. The chip must not read the flag alone and vanish too, or the child is
 * stranded on a word card with nothing leading back to their lesson.
 */
const phase8Lesson = () => saveLesson({
  day: dayKey(NOW),
  created: NOW,
  band: 1,
  items: [
    { kind: 'speak', activity: 'speak', id: 'th', route: '/sound/th', label: 'Nói: âm th', emoji: '🗣️' },
    { kind: 'word', activity: 'word', id: 'apple', route: '/words/food/apple', label: 'Từ mới: apple', emoji: '🧩' },
  ],
})

const renderInMission = (pathname: string) => render(
  <MemoryRouter initialEntries={[{ pathname, state: { mission: true } }]}>
    <LessonChip />
  </MemoryRouter>,
)

it('still shows on a word the stored mission step does not name', () => {
  phase8Lesson()

  renderInMission('/sound/th/sz-th-three')

  expect(screen.getByRole('link', { name: '🌞 Nhiệm vụ 0/2' })).toHaveAttribute('href', '/mission')
})

/** The other half of the same rule: where the path IS today's step, the screen really does have
 * its own header and CTA, so the chip stays out of the corner. */
it('stays out of the way on the stored step route itself', () => {
  phase8Lesson()

  renderInMission('/sound/th')

  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

/** Free play is untouched by the rule above: no flag, no hiding. */
it('still shows on the same route reached without the mission flag', () => {
  const lesson = lessonWith(0)
  const speak = lesson.items.find(i => !i.route.startsWith('/story/'))!

  renderAt(speak.route)

  expect(screen.getByRole('link')).toHaveAttribute('href', '/mission')
})
