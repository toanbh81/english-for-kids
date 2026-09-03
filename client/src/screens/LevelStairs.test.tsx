import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LevelStairs } from './LevelStairs'

function renderStairs() {
  return render(<MemoryRouter><LevelStairs /></MemoryRouter>)
}

beforeEach(() => localStorage.clear())

/** Scoped by step, because the phone CTA added below is a second link to the current step and
 * names it ("Luyện bậc 1: Tập âm 🦁"). */
function stepLink(key: string, name: RegExp) {
  return within(screen.getByTestId(`step-${key}`)).getByRole('link', { name })
}

it('sits in the shared page frame', () => {
  renderStairs()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByRole('banner')).toHaveClass('grid')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
})

it('links all five levels of the Speak Lab staircase', () => {
  renderStairs()
  expect(stepLink('sound-zoo', /Tập âm/)).toHaveAttribute('href', '/level/sound-zoo')
  expect(stepLink('word-pop', /Đọc từ/)).toHaveAttribute('href', '/level/word-pop')
  expect(stepLink('minimal-pairs', /Nghe & chọn/)).toHaveAttribute('href', '/level/minimal-pairs')
  expect(stepLink('sentence-stars', /Sentence Stars/)).toHaveAttribute('href', '/level/sentence-stars')
  expect(stepLink('story-voice', /Story Voice/)).toHaveAttribute('href', '/level/story-voice')

  expect(screen.queryByText('Sắp có')).not.toBeInTheDocument()
})

it('reads the Nghe & chọn stars off the pair keys, not off any word card', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'pair:pair-ship-sheep': 2, 'pair:pair-cap-cup': 1 }))
  renderStairs()

  // The best of the eight pairs is what the step shows.
  const step = within(screen.getByTestId('step-minimal-pairs'))
  expect(step.getAllByTestId('star-filled')).toHaveLength(2)
  // Tập âm is unaffected by a pair key.
  expect(within(screen.getByTestId('step-sound-zoo')).queryAllByTestId('star-filled')).toHaveLength(0)
})

it('reads the Sentence Stars stars off the sstar keys and Story Voice off the voice keys', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sstar:ss1': 1, 'sstar:ss9': 3, 'voice:sv2': 2 }))
  renderStairs()

  // The best of the ten sentences / eight passages is what each step shows.
  expect(within(screen.getByTestId('step-sentence-stars')).getAllByTestId('star-filled')).toHaveLength(3)
  expect(within(screen.getByTestId('step-story-voice')).getAllByTestId('star-filled')).toHaveLength(2)
})

/** Phase 9 moved the sound's stars onto its words: the step shows the best sound, and a sound is
 * only as good as its weakest word. */
it('reads the Tập âm stars off the words of each sound', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({
    'sword:sz-v-very': 3, 'sword:sz-v-van': 3, 'sword:sz-v-seven': 2,
    'sword:sz-th-three': 3, // one word of /θ/ only — that sound still counts for nothing
  }))
  renderStairs()

  expect(within(screen.getByTestId('step-sound-zoo')).getAllByTestId('star-filled')).toHaveLength(2)
})

it('stands Foxy on the first step that is not finished yet', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sound:th': 3 }))
  renderStairs()
  // Tập âm has 3 stars on its th sound, so it is done and Foxy moves on to Đọc từ.
  expect(within(screen.getByTestId('step-word-pop')).getByTestId('foxy')).toBeInTheDocument()
})

it('moves Foxy on to Nghe & chọn once the two word levels are done', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sound:th': 3, 'wp-cat': 3 }))
  renderStairs()
  expect(within(screen.getByTestId('step-minimal-pairs')).getByTestId('foxy')).toBeInTheDocument()
})

it('moves Foxy on to Sentence Stars and then Story Voice as each level finishes', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sound:th': 3, 'wp-cat': 3, 'pair:pair-ship-sheep': 3 }))
  renderStairs()
  expect(within(screen.getByTestId('step-sentence-stars')).getByTestId('foxy')).toBeInTheDocument()
})

it('stands Foxy on the last step once every earlier level is finished', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({
    'sound:th': 3, 'wp-cat': 3, 'pair:pair-ship-sheep': 3, 'sstar:ss1': 3,
  }))
  renderStairs()
  expect(within(screen.getByTestId('step-story-voice')).getByTestId('foxy')).toBeInTheDocument()
})

it('falls back to the last step once the whole staircase is finished', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({
    'sound:th': 3, 'wp-cat': 3, 'pair:pair-ship-sheep': 3, 'sstar:ss1': 3, 'voice:sv1': 3,
  }))
  renderStairs()
  expect(within(screen.getByTestId('step-story-voice')).getByTestId('foxy')).toBeInTheDocument()
})

/** Phase 5 moved Tập âm's stars from per-card `sz-*` keys to per-sound `sound:<ph>` keys, so a
 * child who practised before that has only the old keys — reading just the new ones emptied the
 * step and looked like lost progress. */
it('still counts the legacy per-card sz- key so returning children keep their stars', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sz-th-three': 2 }))
  renderStairs()
  expect(within(screen.getByTestId('step-sound-zoo')).getAllByTestId('star-filled')).toHaveLength(2)
})

it('takes the best of the new sound key and the legacy card key', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sz-th-three': 2, 'sound:v': 3 }))
  renderStairs()
  expect(within(screen.getByTestId('step-sound-zoo')).getAllByTestId('star-filled')).toHaveLength(3)
})

/* ---- Phase 14, design round 3 §2 A9 / R21 / R22 ---- */

it('one title at every frame, subtitle in the header, no "Speak Lab" branch', () => {
  renderStairs()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Các bậc luyện nói 🗣️')
  expect(screen.queryByText('Speak Lab 🗣️')).toBeNull()
  expect(screen.getByText('Leo từng bậc — mỗi bậc một trò mới!')).toBe(screen.getByRole('banner').querySelector('p'))
})

it('the CTA is no longer phone-only', () => {
  renderStairs()
  expect(screen.getByRole('contentinfo')).not.toHaveClass('md:hidden')
  expect(screen.getByRole('link', { name: /^Luyện bậc/ })).toHaveClass('ipad:w-[420px]', 'ipad:mx-auto')
})

it('landscape positions the five tiles by percentage, not by magic margins', () => {
  renderStairs()
  const step = screen.getByTestId('step-sound-zoo')
  expect(step.className).not.toMatch(/ipad:mt-/)
  expect(step).toHaveStyle({ left: '10%', top: '70%' })
  expect(screen.getByTestId('step-story-voice')).toHaveStyle({ left: '90%', top: '0%' })
  expect(step).toHaveClass('ipad:absolute', 'ipad:h-[176px]', 'ipad:w-[176px]')
})

it('iPad portrait reuses the phone zigzag at 300×96 — no md: grid', () => {
  renderStairs()
  expect(screen.getByTestId('stairs-region').className).not.toMatch(/md:grid/)
  expect(screen.getByTestId('step-word-pop').querySelector('a')).toHaveClass('md:h-[96px]', 'md:w-[300px]')
})

it('phone: the stair region is its own scroller, space-between, and scrolls to the bottom on mount', () => {
  renderStairs()
  const region = screen.getByTestId('stairs-region')
  expect(region).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto', 'justify-between')
  expect(region.scrollTop).toBe(region.scrollHeight - region.clientHeight)
  expect(screen.getByTestId('step-word-pop').querySelector('a')).toHaveClass('h-[84px]', 'w-[236px]', 'short:h-[72px]')
  expect(screen.getByTestId('foxy').parentElement).toHaveClass('h-[56px]', 'w-[58px]')
  expect(screen.getByText('ĐANG HỌC')).toHaveClass('text-[12px]')
})

it('draws a dotted trail behind the zigzag at every frame below ipad, and a second one for the landscape diagonal', () => {
  const { container } = renderStairs()
  // Direct children only — Foxy draws its own `<svg>` nested inside one of the steps.
  const svgs = screen.getByTestId('stairs-region').querySelectorAll(':scope > svg')
  expect(svgs).toHaveLength(2)

  const zigzag = svgs[0]
  expect(zigzag).toHaveClass('ipad:hidden')
  expect(zigzag).toHaveAttribute('viewBox', '0 0 350 560')
  expect(zigzag).toHaveAttribute('preserveAspectRatio', 'none')
  // Five corners, bottom-left up, alternating x — the same shape as the five rows above it.
  expect(zigzag.querySelector('path')).toHaveAttribute('d', 'M118 504 L232 392 L118 280 L232 168 L118 56')

  const diagonal = svgs[1]
  expect(diagonal).toHaveClass('hidden', 'ipad:block')
  expect(diagonal).toHaveAttribute('viewBox', '0 0 1080 600')
  expect(diagonal).toHaveAttribute('preserveAspectRatio', 'none')
  // Same five centres the steps are positioned at, in the 1080×600 landscape viewBox.
  expect(diagonal.querySelector('path')).toHaveAttribute('d', 'M108 420 L324 315 L540 210 L756 105 L972 0')

  // The teal blob is landscape-only from this phase: portrait now fills that corner with the
  // (bigger) zigzag itself.
  expect(container.querySelector('.bg-teal-50')).toHaveClass('hidden', 'ipad:block')
})

it('pins a CTA for the step Foxy is standing on, as a sibling of the scroll area', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sound:th': 3 }))
  renderStairs()
  // Tập âm is finished, so Foxy — and the CTA — are on Đọc từ, bậc 2.
  const cta = screen.getByRole('link', { name: /Luyện bậc 2/ })
  expect(cta).toHaveAttribute('href', '/level/word-pop')
  expect(cta).toHaveTextContent('Luyện bậc 2: Đọc từ 🎈')
  expect(cta).toHaveClass('min-h-[64px]', 'w-full')
  // Not a sticky overlay, and no longer clipped off by the old root: it is a sibling of the
  // scrolling body, inside the shared page footer.
  expect(cta).not.toHaveClass('sticky', 'fixed', 'absolute')
  expect(screen.getByRole('contentinfo')).toContainElement(cta)
  expect(screen.getByRole('main').className).not.toContain('max-md:overflow-hidden')
})

it('tags the current step and the finished ones at every frame, and keeps Foxy beside it below ipad', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'sound:th': 3 }))
  renderStairs()
  const done = within(screen.getByTestId('step-sound-zoo'))
  const learning = within(screen.getByTestId('step-word-pop'))
  expect(done.getByText('✓')).toHaveClass('text-[12px]')
  expect(learning.getByText('ĐANG HỌC')).toHaveClass('text-[12px]')
  // Foxy sits after the tile below `ipad` (`order-2`) and back above it on iPad landscape.
  expect(learning.getByTestId('foxy').parentElement!.parentElement).toHaveClass('order-2', 'ipad:order-none')
  // A step that is neither current nor finished carries an empty tag, not a missing one.
  expect(within(screen.getByTestId('step-story-voice')).queryByText('ĐANG HỌC')).not.toBeInTheDocument()
})

/** The spec's binding rules put the tap-target floor at 64 px with no exception, and the first
 * pass had shipped this arrow at the design's 56. It is 64 on a phone now, and nothing measured
 * broke: /levels still fits 844 and 667 exactly with the CTA on the bottom edge. */
it('holds the back arrow to the 64 px tap floor on a phone', () => {
  renderStairs()

  const back = screen.getByRole('link', { name: /Về trang chủ|Về bản đồ/ })
  expect(back).toHaveClass('h-14', 'w-14')
  // …and the landscape 64 px circle is `BackButton`'s own `child` variant, untouched from `md` up.
  expect(back).toHaveClass('md:h-16', 'md:w-16')
})
