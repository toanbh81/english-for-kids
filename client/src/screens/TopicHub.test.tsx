import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { STORIES } from '../content/stories'
import type { TopicId } from '../content/topics'
import { findTopic } from '../content/words'
import { dayKey } from '../progress/activity'
import { saveLesson } from '../progress/lessonStore'
import type { LessonItem } from '../progress/lessonStore'
import { setStars } from '../progress/store'
import { TopicHub } from './TopicHub'

const NOW = new Date('2026-08-25T10:00:00').getTime()
const TODAY = 'Có trong nhiệm vụ hôm nay'
/** Same figure the screen itself computes (R20): never hard-code the "n đảo khác" count. */
const TOPICS_WITH_STORY = new Set(STORIES.map(s => s.topic)).size

function renderHub(id: string) {
  render(
    <MemoryRouter initialEntries={[`/topic/${id}`]}>
      <Routes>
        <Route path="/topic/:id" element={<TopicHub />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** The scrolling body only — excludes the pinned footer, whose "Học tiếp: <label>" CTA can name
 * the very same section a row does (e.g. both say "Từ mới 3/8" while that section is unfinished),
 * which would otherwise make a plain `getByRole('link', { name: /Từ mới/ })` ambiguous. */
function body() {
  return screen.getByTestId('page-body')
}

/** Puts the first `n` words of a topic's deck in Leitner box 1 — the unlock and star currency. */
function unlockWords(topic: TopicId, n: number) {
  const deck = findTopic(topic)?.words ?? []
  const raw: Record<string, { box: number; due: number }> =
    JSON.parse(localStorage.getItem('speakup.leitner') ?? '{}')
  for (const w of deck.slice(0, n)) raw[w.id] = { box: 1, due: 0 }
  localStorage.setItem('speakup.leitner', JSON.stringify(raw))
}

/**
 * Freezes today's lesson to exactly these routes, so what the hub chips against is a fixture and
 * not whatever the seeded generator happens to pick. The rest of an item is filler: the hub only
 * ever reads `route`.
 */
function seedLesson(routes: string[]) {
  const item = (route: string): LessonItem => {
    const kind = route.startsWith('/story/') ? 'listen' : route.startsWith('/sentence/') ? 'sentence' : 'word'
    return {
      kind,
      activity: kind === 'listen' ? 'story' : kind,
      id: route.split('/').pop() ?? '',
      route,
      label: route,
      emoji: '🧩',
    }
  }
  saveLesson({ day: dayKey(NOW), created: NOW, band: 1, items: routes.map(item) })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date(NOW) })
})

afterEach(() => {
  vi.useRealTimers()
})

it('sits in the shared page frame', () => {
  unlockWords('animals', 6)
  renderHub('animals')
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByRole('banner')).toHaveClass('grid')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
})

it('shows the topic header, its stars and the three sections', () => {
  unlockWords('animals', 6)
  setStars('sentence:s13', 2)

  renderHub('animals')

  expect(screen.getByRole('heading', { name: 'Động vật' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Về nhà/ })).toHaveAttribute('href', '/')

  const words = within(body()).getByRole('link', { name: /Từ mới/ })
  expect(words).toHaveAttribute('href', '/words/animals')
  expect(within(words).getByText('6/8')).toBeInTheDocument()

  const sentences = within(body()).getByRole('link', { name: /Ghép câu/ })
  expect(sentences).toHaveAttribute('href', '/sentences?topic=animals')
  expect(within(sentences).getByText('1/4')).toBeInTheDocument()
})

it('lists the topic stories with their stars', () => {
  setStars('story:little-fox', 3)

  renderHub('animals')

  const story = screen.getByRole('link', { name: /Chú cáo nhỏ/ })
  expect(story).toHaveAttribute('href', '/story/little-fox')
  expect(within(story).getAllByTestId('star-filled')).toHaveLength(3)
  expect(screen.getByRole('link', { name: /Ở sở thú/ })).toHaveAttribute('href', '/story/at-the-zoo')
  expect(screen.queryByText('Sắp có 📖')).not.toBeInTheDocument()
})

it('shows a muted "Sắp có" card, not a link, for a topic with no story yet', () => {
  unlockWords('animals', 6)
  unlockWords('food', 6)

  renderHub('school')

  expect(screen.getByText('Sắp có 📖')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Truyện/ })).not.toBeInTheDocument()
  // The pinned footer is a real 4th link now (R19) — it repeats the words row's own href here
  // because "school" has no unlocked words yet, so "Từ mới" is still the first unfinished section.
  expect(screen.getAllByRole('link').map(a => a.getAttribute('href')))
    .toEqual(['/', '/words/school', '/sentences?topic=school', '/words/school'])
})

it('counts only the unlocked words of the topic', () => {
  unlockWords('animals', 3)

  renderHub('animals')

  expect(screen.getByText('3/8')).toBeInTheDocument()
  expect(screen.getAllByTestId('star-filled')).toHaveLength(1)
})

/** The map and the mission are separate axes, and the hub is where the child can see they overlap
 * (spec §4): a section holding one of today's items says so, the others stay quiet. */
it('marks the sections that hold an item of today lesson', () => {
  seedLesson(['/words/animals/animals-tiger', '/sentence/s13', '/story/at-the-zoo'])

  renderHub('animals')

  expect(within(within(body()).getByRole('link', { name: /Từ mới/ })).getByText(TODAY)).toBeInTheDocument()
  expect(within(within(body()).getByRole('link', { name: /Ghép câu/ })).getByText(TODAY)).toBeInTheDocument()
  expect(within(screen.getByRole('link', { name: /Ở sở thú/ })).getByText(TODAY)).toBeInTheDocument()
  // The other story of the same island is not today's listen step, so it stays unmarked.
  expect(within(screen.getByRole('link', { name: /Chú cáo nhỏ/ })).queryByText(TODAY)).not.toBeInTheDocument()
  expect(screen.getAllByText(TODAY)).toHaveLength(3)
})

/** A review step is still today's work, so the word section is marked by one just as it is by a
 * fresh 🧩 step — both land on `/words/<topic>/<id>`. */
it('marks the word section for a review step of this island', () => {
  seedLesson(['/words/animals/animals-duck'])

  renderHub('animals')

  expect(within(within(body()).getByRole('link', { name: /Từ mới/ })).getByText(TODAY)).toBeInTheDocument()
  expect(screen.getAllByText(TODAY)).toHaveLength(1)
})

it('marks nothing when today lesson is drawn from other islands', () => {
  seedLesson(['/words/food/food-egg', '/sentence/s5', '/story/my-breakfast'])

  renderHub('animals')

  expect(screen.queryByText(TODAY)).not.toBeInTheDocument()
})

/* ---- Task 12 (R19/R20): the banded header, the star chip, the pinned CTA ---- */

it('the header sits inside the teal band, centred on the island-star chip', () => {
  renderHub('animals')
  expect(screen.getByRole('banner')).toHaveClass('bg-transparent')
  expect(screen.getByText(/^⭐ \d+\/\d+ sao đảo$/)).toHaveClass('bg-white/[.92]', 'text-teal-600', 'rounded-r12', 'text-[15px]')
  expect(screen.getByTestId('island-header')).toHaveClass('bg-teal-500')
  expect(screen.getByText('Động vật')).toHaveClass('text-[28px]', 'text-white')
})

it('the star chip denominator is 3 × the number of scored sections', () => {
  renderHub('animals') // words + sentences + (2) stories, collapsed to one scored section each
  expect(screen.getByText(/sao đảo$/)).toHaveTextContent('/9 sao đảo')
  cleanup()
  renderHub('school') // words + sentences only — this island has no story yet
  expect(screen.getByText(/sao đảo$/)).toHaveTextContent('/6 sao đảo')
})

it('counts move into the row titles and the sentence row shows stars', () => {
  unlockWords('animals', 3)
  renderHub('animals')
  expect(screen.getByText('Từ mới').nextSibling).toHaveTextContent('3/8')
  expect(screen.queryByText(/câu có sao$/)).toBeNull()
  expect(within(within(body()).getByRole('link', { name: /Ghép câu/ })).getByTestId('stars')).toHaveClass('text-[13px]')
})

it('an island with no story greys the row out and names how many other islands have one', () => {
  renderHub('school')
  const row = screen.getByText('Truyện').closest('div')
  expect(row).not.toBeNull()
  expect(row).toHaveClass('bg-[#F6EFE2]', 'opacity-80')
  expect(within(row!).getByText('🎧')).toHaveClass('grayscale')
  expect(screen.getByText(`Đảo này chưa có truyện — nghe truyện ở ${TOPICS_WITH_STORY} đảo khác nhé`)).toHaveClass('text-[12px]')
  expect(screen.getByText('Sắp có 📖')).toBeInTheDocument()
  expect(row!.tagName).toBe('DIV') // không bấm được
})

it('the pinned CTA points at the first unfinished section, or offers a replay when all are 3★', () => {
  unlockWords('animals', 3)
  renderHub('animals')
  expect(screen.getByRole('link', { name: 'Học tiếp: Từ mới 3/8 ▸' })).toHaveAttribute('href', '/words/animals')

  cleanup()
  unlockWords('animals', 8)
  setStars('sentence:s13', 3)
  setStars('story:little-fox', 3)
  renderHub('animals')
  expect(screen.getByRole('link', { name: /^Luyện lại: / })).toBeInTheDocument()
})

/* ---- Phase 10, design §12 M8 / Task 12, design §A8: the phone layout ---- */

/** jsdom has no stylesheet and so no layout: these pin *which breakpoint each rule is written at*.
 * The geometry itself (nothing under a pinned element at 390×844 and 375×667, and 1194×834
 * unchanged) is measured in a real browser. */
it('draws the island band behind the whole shell, header included', () => {
  unlockWords('animals', 6)

  renderHub('animals')

  const band = screen.getByTestId('island-header')
  // Decorative: it is a background, so it never reaches the accessibility tree at any width.
  expect(band).toHaveAttribute('aria-hidden', 'true')
  // Absolute and `pointer-events-none`, so it neither displaces the header/sections nor swallows a
  // tap; `-z-10` so it paints *behind* the normal-flow header and body it now sits under (R19).
  expect(band).toHaveClass('absolute', 'pointer-events-none', 'bg-teal-500', '-z-10')
  // Its height follows the same safe-area shell the page padding does, rather than fixing the
  // design's 236 px — which is only the right number on a phone with a notch to clear.
  expect(Array.from(band.classList).some(c => c.startsWith('h-[calc(180px'))).toBe(true)

  // `BackButton`'s own `child` variant already meets the 64 px tap-target floor on a phone (a 56
  // px circle with an invisible 64 px hit band).
  expect(screen.getByRole('link', { name: /Về nhà/ })).toHaveClass('h-14', 'w-14', 'md:h-16', 'md:w-16')
})

it('sizes the section rows for a phone and restores the landscape card from md up', () => {
  unlockWords('animals', 6)

  renderHub('animals')

  const words = within(body()).getByRole('link', { name: /Từ mới/ })
  // 84 px on a phone (§12 M8) — still well above the 64 px tap floor — and the 96 px row from 768.
  expect(words).toHaveClass('min-h-[84px]', 'gap-3.5', 'rounded-[24px]', 'px-[18px]')
  expect(words).toHaveClass('md:min-h-[96px]', 'md:gap-5', 'md:rounded-xl3', 'md:px-6')
  // The wrap is the phone's safety valve only: the landscape row never wrapped and still does not.
  expect(words).toHaveClass('flex-wrap', 'md:flex-nowrap')
})

/** The design outlines a section that holds one of today's items as well as chipping it, because
 * the chip shrinks to 11 px there. The landscape card has no border and does not gain one. */
it('outlines a section of today lesson on a phone only', () => {
  seedLesson(['/words/animals/animals-tiger'])

  renderHub('animals')

  const words = within(body()).getByRole('link', { name: /Từ mới/ })
  expect(words).toHaveClass('border-[3px]', 'border-teal-500', 'md:border-0')
  expect(within(body()).getByRole('link', { name: /Ghép câu/ })).not.toHaveClass('border-[3px]')
  // The chip is still the thing that says it, in words, at both sizes.
  expect(within(words).getByText(TODAY)).toHaveClass('max-md:text-[11px]')
})

it('shows the locked screen for a topic the child has not reached', () => {
  renderHub('weather')

  expect(screen.getByRole('heading', { name: 'Chưa mở khóa' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Về nhà/ })).toHaveAttribute('href', '/')
  expect(screen.queryByRole('link', { name: /Từ mới/ })).not.toBeInTheDocument()
})

it('shows the locked screen for an unknown topic id', () => {
  renderHub('dinosaurs')

  expect(screen.getByRole('heading', { name: 'Chưa mở khóa' })).toBeInTheDocument()
})
