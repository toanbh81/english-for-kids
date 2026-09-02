import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'

/** The hook is mocked, not the recorder + scorer: these tests are about what StarPractice does
 * with a result, and `useSpeakingAttempt` is covered by its own suite and PracticeCard.test. */
const mic = vi.hoisted(() => ({ push: (_r: PronunciationResult, _b: Blob | null = null) => {} }))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    const [state, setState] = useState<{ result: PronunciationResult | null; blob: Blob | null }>({ result: null, blob: null })
    useEffect(() => { setState({ result: null, blob: null }) }, [opts.resetKey])
    mic.push = (r: PronunciationResult, b: Blob | null = null) => {
      setState({ result: r, blob: b })
      opts.onResult?.(r, b)
    }
    return {
      micState: 'idle' as const, level: 0, engine: 'azure' as const,
      result: state.result, error: null, lastBlob: state.blob,
      onMic: () => {}, reset: () => setState({ result: null, blob: null }),
    }
  },
}))
const playerControl = vi.hoisted(() => ({ playUrl: vi.fn(), playBlob: vi.fn(), stopCurrentAudio: vi.fn(), trackAudio: vi.fn() }))
vi.mock('../audio/player', () => ({
  playUrl: playerControl.playUrl,
  playBlob: playerControl.playBlob,
  stopCurrentAudio: playerControl.stopCurrentAudio,
  trackAudio: playerControl.trackAudio,
}))

/** The rhythm card loads the sample itself rather than going through `playUrl`, because the beat
 * of the dots comes from the file's own duration — which only an Audio element it holds can tell
 * it. jsdom has no media stack at all, so the element is faked outright. */
class FakeAudio {
  static instances: FakeAudio[] = []
  duration = NaN
  paused = true
  onloadedmetadata: (() => void) | null = null
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  src: string
  constructor(src: string) { this.src = src; FakeAudio.instances.push(this) }
  play() { this.paused = false; return Promise.resolve() }
  pause() { this.paused = true }
}
const lastAudio = () => FakeAudio.instances[FakeAudio.instances.length - 1]
const tapRhythm = () => fireEvent.click(screen.getByRole('button', { name: 'Nghe nhịp của câu' }))
const store = vi.hoisted(() => ({ saveRecording: vi.fn() }))
vi.mock('../progress/recordings', () => ({ saveRecording: store.saveRecording }))

import { StarPractice } from './StarPractice'
import { SENTENCE_STARS } from '../content'
import { dayKey } from '../progress/activity'
import { saveLesson } from '../progress/lessonStore'
import type { LessonItem } from '../progress/lesson'

/** Where a mission hand-off landed, and whether it was still carrying `{ mission: true }` — the
 * flag leaves no trace in the DOM, so the probe is the only way to see it. */
function Probe() {
  const location = useLocation()
  return <p data-testid="probe">{location.pathname} {JSON.stringify(location.state)}</p>
}

const step = (id: string, route: string): LessonItem =>
  ({ kind: 'speak', activity: 'speak', id, route, label: id, emoji: '🗣️' })

/** Today's lesson, written straight to storage, so the screen counts real steps. */
function seedLesson(...items: LessonItem[]) {
  const now = Date.now()
  saveLesson({ day: dayKey(now), created: now, band: 5, items })
}

const SS1 = SENTENCE_STARS[0]
const STAR_STEP = step('ss1', '/star/ss1')
const NEXT_STEP = step('sz-th-three', '/practice/sz-th-three')

/** One attempt on the sentence; the three numbers the star rule actually reads are explicit. */
function result(accuracy: number, fluency: number, completeness = 100): PronunciationResult {
  return {
    overall: accuracy, accuracy, fluency, completeness, engine: 'azure',
    words: SS1.words.map(w => ({ word: w, score: accuracy, errorType: 'None' as const, phonemes: [] })),
  }
}

const score = (r: PronunciationResult, blob: Blob | null = null) => act(() => { mic.push(r, blob) })

function renderStar(id = SS1.id, mission = false) {
  render(
    <MemoryRouter initialEntries={[{ pathname: `/star/${id}`, state: mission ? { mission: true } : null }]}>
      <Routes>
        <Route path="/star/:id" element={<StarPractice />} />
        <Route path="/level/sentence-stars" element={<p>các câu</p>} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  FakeAudio.instances.length = 0
  vi.stubGlobal('Audio', FakeAudio)
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
  playerControl.playBlob.mockReset().mockResolvedValue(undefined)
  playerControl.stopCurrentAudio.mockReset()
  playerControl.trackAudio.mockReset()
  store.saveRecording.mockReset().mockResolvedValue(undefined)
})

afterEach(() => { vi.unstubAllGlobals() })

it('opens on the sentence with its stress, linking and legend', () => {
  renderStar()

  expect(screen.getByText('Câu 1/10')).toBeInTheDocument()
  // "have", "red" and "apple." carry the beat of "I have a red apple."
  expect(screen.getByText('have')).toHaveClass('text-coral-text', 'text-[32px]', 'md:text-[48px]')
  expect(screen.getByText('I')).toHaveClass('text-ink-900')
  // …and "red apple" links, so a ‿ sits between them.
  expect(screen.getAllByTestId('link-mark')).toHaveLength(1)
  expect(screen.getByText(SS1.vi)).toBeInTheDocument()
  expect(screen.getByText('Chữ cam = nhấn mạnh · ‿ = nối âm')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/level/sentence-stars')
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
})

/** The dots ARE the rhythm: one per word, and the big ones mark where the stress falls. */
it('draws one rhythm dot per word, big on the stressed ones', () => {
  renderStar()

  const dots = screen.getAllByTestId('rhythm-dot')
  expect(dots).toHaveLength(SS1.words.length)
  expect(dots.filter(d => d.getAttribute('data-stress') === 'on')).toHaveLength(SS1.stress.length)
  for (const d of dots) {
    expect(d).toHaveClass(d.getAttribute('data-stress') === 'on' ? 'h-6' : 'h-3')
  }
})

it('beats the dots only while the sample is actually sounding', async () => {
  renderStar()

  expect(screen.getAllByTestId('rhythm-dot')[0]).not.toHaveClass('animate-beat')
  tapRhythm()
  expect(lastAudio().src).toBe(SS1.audio)
  expect(lastAudio().paused).toBe(false)
  expect(screen.getAllByTestId('rhythm-dot')[0]).toHaveClass('animate-beat')

  await act(async () => { lastAudio().onended?.() })
  expect(screen.getAllByTestId('rhythm-dot')[0]).not.toHaveClass('animate-beat')
})

/** The beat travels: each dot pops ONCE, exactly when its word is spoken, and then holds still.
 * A repeating animation would put every dot back in phase after the first pass and they would all
 * pulse in unison — the opposite of a rhythm. */
it('pops each dot once, in turn, at the tempo the sample itself reports', async () => {
  renderStar()
  tapRhythm()

  const audio = lastAudio()
  await act(async () => { audio.duration = 2; audio.onloadedmetadata?.() })

  // 2 s of audio across the 5 words of "I have a red apple." = one 400 ms beat per word…
  const card = screen.getByRole('button', { name: 'Nghe nhịp của câu' })
  expect(card.style.getPropertyValue('--beat')).toBe('400ms')
  // …each dot starting one whole beat after the one before it…
  const dots = screen.getAllByTestId('rhythm-dot')
  expect(dots).toHaveLength(5)
  expect(dots.map(d => d.style.animationDelay)).toEqual(['0ms', '400ms', '800ms', '1200ms', '1600ms'])
  // …popping for 60% of its beat, exactly once.
  expect(dots.map(d => d.style.animationDuration)).toEqual(['240ms', '240ms', '240ms', '240ms', '240ms'])
  expect(dots.map(d => d.style.animationIterationCount)).toEqual(['1', '1', '1', '1', '1'])

  await act(async () => { audio.onended?.() })
  expect(screen.getAllByTestId('rhythm-dot')[0]).not.toHaveClass('animate-beat')
})

/** A one-shot animation has already finished by the second play, so the dots must be re-armed
 * (fresh nodes) or the rhythm would only ever play through once. */
it('re-arms the beat on every play', async () => {
  renderStar()
  tapRhythm()
  await act(async () => { lastAudio().duration = 2; lastAudio().onloadedmetadata?.() })
  const first = screen.getAllByTestId('rhythm-dot')

  await act(async () => { lastAudio().onended?.() })
  tapRhythm()
  await act(async () => { lastAudio().duration = 2; lastAudio().onloadedmetadata?.() })

  const second = screen.getAllByTestId('rhythm-dot')
  expect(second[0]).not.toBe(first[0])
  expect(second[0]).toHaveClass('animate-beat')
  expect(second.map(d => d.style.animationDelay)).toEqual(['0ms', '400ms', '800ms', '1200ms', '1600ms'])
})

/** No metadata (file missing, decode blocked) must not freeze the dots mid-beat. */
it('falls back to an estimated tempo when the browser reports no duration', () => {
  renderStar()
  tapRhythm()

  const card = screen.getByRole('button', { name: 'Nghe nhịp của câu' })
  expect(card.style.getPropertyValue('--beat')).toBe('420ms')
  const dots = screen.getAllByTestId('rhythm-dot')
  expect(dots[0]).toHaveClass('animate-beat')
  expect(dots.map(d => d.style.animationDelay)).toEqual(['0ms', '420ms', '840ms', '1260ms', '1680ms'])
  expect(dots[0].style.animationDuration).toBe('252ms')
})

it('says so when the sample audio is missing', async () => {
  renderStar()

  fireEvent.click(screen.getByRole('button', { name: /nghe mẫu/i }))
  await act(async () => { lastAudio().onerror?.() })

  expect(screen.getByText('Chưa có audio mẫu')).toBeInTheDocument()
  expect(screen.getAllByTestId('rhythm-dot')[0]).not.toHaveClass('animate-beat')
})

/** Tapping twice must not leave the first sample sounding under the second. */
it('stops a sample already playing before starting another', () => {
  renderStar()
  tapRhythm()
  const first = lastAudio()
  tapRhythm()

  expect(first.paused).toBe(true)
  expect(lastAudio()).not.toBe(first)
  expect(lastAudio().paused).toBe(false)
})

/** The rhythm card owns its element, but the app still only ever sounds one clip: it silences
 * whatever else is playing before it starts, and hands its own element over so the next `playUrl`
 * (a "Nghe mình" playback, say) silences this one in turn. */
it('silences any other clip before starting, and hands its own element to the player', () => {
  renderStar()
  playerControl.stopCurrentAudio.mockImplementation(() => {
    // Called before the card's own element exists, so nothing of ours is stopped by it.
    expect(FakeAudio.instances).toHaveLength(0)
  })

  tapRhythm()

  expect(playerControl.stopCurrentAudio).toHaveBeenCalledTimes(1)
  expect(playerControl.trackAudio).toHaveBeenCalledWith(lastAudio(), expect.any(Function))
})

it('turns an accurate, fluent, complete attempt into 3 stars on the sentence key', () => {
  renderStar()
  score(result(85, 85, 100), new Blob(['x']))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
  expect(screen.getByText('Tuyệt vời!')).toBeInTheDocument()
  expect(screen.getByText('Nhịp: 🎵 tốt')).toBeInTheDocument()
  expect(screen.getByTestId('confetti')).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')['sstar:ss1']).toBe(3)
  expect(JSON.parse(localStorage.getItem('speakup.activity') ?? '[]'))
    .toContainEqual(expect.objectContaining({ kind: 'speak', id: 'ss1' }))
  expect(store.saveRecording).toHaveBeenCalledTimes(1)
  // The words come back with their own tone, and the four bars are all there.
  expect(screen.getByRole('button', { name: 'have tốt' })).toBeInTheDocument()
  expect(screen.getAllByTestId('score-bar')).toHaveLength(4)
  expect(screen.getByRole('button', { name: /nghe mình/i })).toBeInTheDocument()
})

/** Every word right but read one-word-at-a-time: 2 stars, and the child is told it was the rhythm. */
it('drops to 2 stars and names the slow rhythm when fluency is low', () => {
  renderStar()
  score(result(65, 40, 100))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.getByText('Hay lắm!')).toBeInTheDocument()
  expect(screen.getByText('Nhịp: 🐢 chậm')).toBeInTheDocument()
  expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')['sstar:ss1']).toBe(2)
  // No recording button when the attempt produced no blob.
  expect(screen.queryByRole('button', { name: /nghe mình/i })).not.toBeInTheDocument()
})

/** A read that was nearly joined-up is not "chậm" — calling it that contradicts the 2 stars it
 * just earned. The middle band names what is left to do instead of grading it down. */
it('names the middle rhythm band instead of calling a near-fluent read slow', () => {
  renderStar()
  score(result(85, 70, 100))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.getByText('Nhịp: 🙂 khá — nói liền hơi hơn nhé')).toBeInTheDocument()
  expect(screen.queryByText('Nhịp: 🐢 chậm')).not.toBeInTheDocument()
  expect(screen.queryByText('Nhịp: 🎵 tốt')).not.toBeInTheDocument()
})

it('offers a hint and a retry when the attempt was weak', () => {
  renderStar()
  score(result(40, 40, 40))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(1)
  expect(screen.getByText('Thử lại nhé')).toBeInTheDocument()
  expect(screen.getByText(/Sửa từ này/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
})

it('hands on to the next sentence, and back to the level on the last one', () => {
  renderStar()
  score(result(85, 85))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByText('Câu 2/10')).toBeInTheDocument()

  score(result(85, 85))
  expect(screen.getByRole('button', { name: /tiếp theo/i })).toBeInTheDocument()
})

it('finishes the level from the last sentence', () => {
  renderStar(SENTENCE_STARS[SENTENCE_STARS.length - 1].id)
  expect(screen.getByText('Câu 10/10')).toBeInTheDocument()

  score(result(85, 85))
  fireEvent.click(screen.getByRole('button', { name: /hoàn thành/i }))
  expect(screen.getByText('các câu')).toBeInTheDocument()
})

it('shows a not-found message for a sentence that does not exist', () => {
  renderStar('nope')
  expect(screen.getByText('Không tìm thấy câu')).toBeInTheDocument()
})

// --- as a step of today's lesson (spec §3) ---------------------------------------------------

it('numbers itself inside the lesson and threads back to the mission', () => {
  seedLesson(STAR_STEP, NEXT_STEP)
  renderStar(SS1.id, true)

  expect(screen.getByText('Thẻ 1/2')).toBeInTheDocument()
  // One counter, not two: the bậc's own position means nothing inside a lesson.
  expect(screen.queryByText('Câu 1/10')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nhiệm vụ' })).toHaveAttribute('href', '/mission')
})

/** Reached from the 🔁 group the number counts inside review, and the noun says which group. */
it('calls the step review when the lesson filed it under 🔁', () => {
  seedLesson({ ...STAR_STEP, kind: 'review' }, NEXT_STEP)
  renderStar(SS1.id, true)

  expect(screen.getByText('Ôn tập 1/1')).toBeInTheDocument()
  expect(screen.queryByText(/^Thẻ \d/)).not.toBeInTheDocument()
})

it('hands on to the next step of the lesson, still carrying the flag', () => {
  seedLesson(STAR_STEP, NEXT_STEP)
  renderStar(SS1.id, true)
  score(result(85, 85))

  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/practice/sz-th-three {"mission":true}')
})

it('ends at the mission screen when it is the last step of the lesson', () => {
  seedLesson(STAR_STEP)
  renderStar(SS1.id, true)
  score(result(85, 85))

  fireEvent.click(screen.getByRole('button', { name: /hoàn thành/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/mission null')
})

/** Today's lesson may well list this very sentence — but a child who walked in from the bậc did
 * not arrive carrying the flag, and nothing about the screen may change for them. */
it('stays a free-play sentence without the flag, lesson or no lesson', () => {
  seedLesson(STAR_STEP, NEXT_STEP)
  renderStar()

  expect(screen.getByText('Câu 1/10')).toBeInTheDocument()
  expect(screen.queryByText(/^Thẻ /)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/level/sentence-stars')
})

/** Phase 10: this screen had no phone layout at all — no breakpoint rules and no `PAGE_SHELL`,
 * so at 390×844 it measured 864 idle and 1282 scored (with "Tiếp theo →" at y1182), and its
 * content ran under the notch. jsdom cannot lay that out, so these guard the inputs. */
it('carries the safe-area shell at its own resting padding', () => {
  renderStar()

  const shell = document.querySelector('main')!.className
  expect(shell).toContain('pt-[max(var(--page-pad-top,1.5rem),calc(env(safe-area-inset-top)_+_9px))]')
  expect(shell).toContain('pb-[max(var(--page-pad-bottom,1.5rem),calc(env(safe-area-inset-bottom)_+_10px))]')
  expect(shell).toContain('[--page-pad-top:1.25rem]')
  expect(shell).toContain('px-5')
  expect(shell).toContain('md:px-6')
})

/** The sentence and its rhythm card fold away on a phone once a result lands: `ScoredWords`
 * reprints every word with its own score, so the pair would only repeat itself over the room the
 * CTA row needs. From `md` up both stay exactly where they were. */
it('folds the sentence and the rhythm card away on a phone result only', () => {
  renderStar()
  const legend = () => screen.getByText('Chữ cam = nhấn mạnh · ‿ = nối âm').closest('section')!
  expect(legend().className).not.toContain('max-md:hidden')

  score(result(85, 85, 100), new Blob(['x']))
  expect(legend().className).toContain('max-md:hidden')
  expect(screen.getByText('Nhịp của câu — chạm để nghe lại').closest('div')!.className).toContain('max-md:hidden')
})

/** The result read-out scrolls inside a bounded region on a phone with the CTA row as its sibling
 * underneath — never a `sticky` panel, which would paint over a word chip. */
it('gives the phone result a bounded scroller and never a sticky', () => {
  renderStar()
  score(result(85, 85, 100), new Blob(['x']))

  const region = document.querySelector('[class*="md:contents"]')!
  expect(region.className).toContain('max-md:flex-1')
  expect(region.className).toContain('max-md:min-h-0')
  expect(region.className).toContain('max-md:overflow-y-auto')
  expect(document.querySelector('main')!.innerHTML).not.toContain('sticky')
})

// --- the iPad frame: two columns, not a taller one -------------------------------------------
//
// jsdom has no layout, so — as with the phone rules above — these assert the thing that decides
// the layout: which breakpoint each rule is written at, and which column each block sits in. The
// geometry is measured in a browser (.superpowers/fix/ipad-practice-report.md).

/** Exact tokens, never substrings: `md:flex-1` must not satisfy an `ipad:flex-1` assertion. */
const classes = (el: Element) => el.className.split(/\s+/).filter(Boolean)

it('splits the frame into a learning column and a doing column, and only from `ipad` up', () => {
  renderStar()

  const teach = screen.getByTestId('teach-col')
  const doing = screen.getByTestId('do-col')
  for (const col of [teach, doing]) {
    // `contents` below the breakpoint: the phone frame keeps the single flow it always had.
    expect(classes(col)).toContain('contents')
    expect(classes(col)).toContain('ipad:flex')
    expect(classes(col)).toContain('ipad:min-h-0')
    for (const bad of ['sticky', 'fixed', 'absolute']) expect(classes(col)).not.toContain(bad)
  }
  expect(classes(teach)).toContain('ipad:flex-1')
  expect(classes(doing)).toContain('ipad:w-[400px]')

  // The sentence and its rhythm card are what the child is learning; the mic is what they do.
  expect(teach).toContainElement(screen.getByText('Chữ cam = nhấn mạnh · ‿ = nối âm'))
  expect(teach).toContainElement(screen.getByRole('button', { name: 'Nghe nhịp của câu' }))
  expect(doing).toContainElement(screen.getByRole('button', { name: /bấm để nói/i }))
})

/** `min-h-full` is a floor, not a height. Without a definite one the split's `flex-1`/`min-h-0`
 * bound nothing and the column grows past the screen exactly as it did before. */
it('gives the iPad column a definite height to divide', () => {
  renderStar()

  const column = classes(document.querySelector('main > div')!)
  expect(column).toContain('ipad:h-full')
  expect(column).toContain('min-h-full')
})

it('keeps the read-out and the CTA row in the doing column, the row outside the scroller', () => {
  renderStar()
  score(result(85, 85, 100), new Blob(['x']))

  const doing = screen.getByTestId('do-col')
  const readout = screen.getByTestId('result-readout')
  const cta = screen.getByRole('button', { name: /tiếp theo/i }).parentElement!
  expect(doing).toContainElement(readout)
  expect(doing).toContainElement(cta)
  // The sentence stays on the left through the result — this is the iPad, not the phone.
  expect(screen.getByTestId('teach-col')).toContainElement(screen.getByRole('button', { name: 'Nghe nhịp của câu' }))

  // A 400 px column cannot hold seven word chips, four bars and a hint card, so the read-out
  // scrolls inside its own bounds — and the way on is its SIBLING, never inside it.
  expect(classes(readout)).toContain('ipad:overflow-y-auto')
  expect(classes(readout)).toContain('ipad:min-h-0')
  expect(classes(readout)).toContain('ipad:flex-1')
  expect(readout).not.toContainElement(cta)
  expect(classes(cta)).toContain('ipad:shrink-0')
})

/** Three ways back plus one way on only fit a 400 px column at the phone's own button size, so
 * the iPad borrows that shape. `ipad:` overrides `Button`'s own `px-5`/`px-7` the way `max-md:`
 * does — a variant is emitted after the plain utilities — and the size map itself is untouched. */
it('gives the result CTAs an iPad-only size, and never touches the button primitive', () => {
  renderStar()
  score(result(85, 85, 100), new Blob(['x']))

  const cta = screen.getByRole('button', { name: /tiếp theo/i }).parentElement!
  for (const name of [/nghe mình/i, /nghe mẫu/i, /thử lại/i]) {
    const b = classes(within(cta).getByRole('button', { name }))
    expect(b).toContain('ipad:px-4')
    expect(b).toContain('ipad:flex-1')
    expect(b).toContain('px-5')
  }
  const on = classes(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(on).toContain('ipad:w-full')
  expect(on).toContain('px-7')
})
