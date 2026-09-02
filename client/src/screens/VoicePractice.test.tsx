import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'

/** The hook is mocked, not the recorder + scorer: these tests are about what VoicePractice does
 * with a result. `engine` is part of the control surface here, because the whole prosody story
 * changes when the app falls back to Web Speech. */
const mic = vi.hoisted(() => ({
  push: (_r: PronunciationResult, _b: Blob | null = null) => {},
  engine: 'azure' as 'azure' | 'webspeech',
  autoStopMs: undefined as number | undefined,
}))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; autoStopMs?: number; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    mic.autoStopMs = opts.autoStopMs
    const [state, setState] = useState<{ result: PronunciationResult | null; blob: Blob | null }>({ result: null, blob: null })
    useEffect(() => { setState({ result: null, blob: null }) }, [opts.resetKey])
    mic.push = (r: PronunciationResult, b: Blob | null = null) => {
      setState({ result: r, blob: b })
      opts.onResult?.(r, b)
    }
    return {
      micState: 'idle' as const, level: 0, engine: mic.engine,
      result: state.result, error: null, lastBlob: state.blob,
      onMic: () => {}, reset: () => setState({ result: null, blob: null }),
    }
  },
}))
const playerControl = vi.hoisted(() => ({ playUrl: vi.fn(), playBlob: vi.fn() }))
vi.mock('../audio/player', () => ({ playUrl: playerControl.playUrl, playBlob: playerControl.playBlob }))
const store = vi.hoisted(() => ({ saveRecording: vi.fn() }))
vi.mock('../progress/recordings', () => ({ saveRecording: store.saveRecording }))

import { VoicePractice, Passage } from './VoicePractice'
import { STORY_VOICE } from '../content'
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

const SV1 = STORY_VOICE[0]
const VOICE_STEP = step('sv1', '/voice/sv1')
const NEXT_STEP = step('sz-th-three', '/practice/sz-th-three')

/** One attempt on a passage. `prosody` is left off entirely for the Web Speech shape. */
function result(scores: { accuracy: number; prosody?: number; fluency?: number; completeness?: number }): PronunciationResult {
  const { accuracy, prosody, fluency = 85, completeness = 100 } = scores
  return {
    overall: accuracy, accuracy, fluency, completeness, prosody,
    engine: mic.engine,
    words: SV1.text.split(' ').map(w => ({ word: w, score: accuracy, errorType: 'None' as const, phonemes: [] })),
  }
}

const score = (r: PronunciationResult, blob: Blob | null = null) => act(() => { mic.push(r, blob) })

function renderVoice(id = SV1.id, mission = false) {
  render(
    <MemoryRouter initialEntries={[{ pathname: `/voice/${id}`, state: mission ? { mission: true } : null }]}>
      <Routes>
        <Route path="/voice/:id" element={<VoicePractice />} />
        <Route path="/level/story-voice" element={<p>các đoạn</p>} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** A second passage inside one test needs the first screen gone, or queries see both. */
function cleanupAndRender(id: string) {
  cleanup()
  renderVoice(id)
}

beforeEach(() => {
  localStorage.clear()
  mic.engine = 'azure'
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
  playerControl.playBlob.mockReset().mockResolvedValue(undefined)
  store.saveRecording.mockReset().mockResolvedValue(undefined)
})

it('opens on the passage with the mood it has to be read in', () => {
  renderVoice()

  expect(screen.getByText('Đoạn 1/8')).toBeInTheDocument()
  expect(screen.getByText(`Đọc với giọng: ${SV1.moodVi}`)).toBeInTheDocument()
  expect(screen.getByLabelText(SV1.text)).toBeInTheDocument()
  expect(screen.getByText(SV1.vi)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/level/story-voice')
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
})

/** Three sentences read *slowly, with feeling* do not fit in the 6 s every other bậc uses — and a
 * mic that shuts mid-sentence scores the missing half as incomplete. 13 s is the measured room. */
it('opens the mic for 13 seconds, long enough for a whole passage read with feeling', () => {
  renderVoice()
  expect(mic.autoStopMs).toBe(13000)
})

/** "I love my dog!" — the ❗ is what the voice actually has to do, so it is the coral bit. */
it('tints the sentence-final ❗❓ and leaves the words alone', () => {
  renderVoice()

  const marks = screen.getAllByTestId('voice-punct')
  expect(marks).toHaveLength(1)
  expect(marks[0]).toHaveTextContent('!')
  expect(marks[0]).toHaveClass('text-coral-text')

  cleanupAndRender('sv3')
  const qs = screen.getAllByTestId('voice-punct')
  expect(qs.map(q => q.textContent)).toEqual(['?', '?', '!'])
})

/** Measured on a landscape iPad (1194×834): with these sizes the mic ends 68 px above the fold on
 * all 8 passages and nothing scrolls. jsdom cannot lay that out, so it guards the inputs. */
it('keeps the long passages at the smaller size a landscape iPad has room for', () => {
  renderVoice('sv4') // 15 words — three lines at 34 px
  expect(screen.getByTestId('voice-passage')).toHaveClass('lg:text-[30px]')
  // The landscape sizes are the `md:` half of each pair now; the unprefixed value is the phone's.
  expect(screen.getByTestId('mood-emoji')).toHaveClass('text-[38px]', 'md:text-[56px]')

  cleanupAndRender('sv6') // 10 words — fits at the bigger size
  expect(screen.getByTestId('voice-passage')).not.toHaveClass('lg:text-[30px]')
  expect(screen.getByTestId('voice-passage')).toHaveClass('text-[24px]', 'md:text-[34px]')
})

/** A ! that closes a quote inside a sentence is not an instruction to the voice — the sentence
 * keeps going. Only a mark with a space (or nothing) after it ends a line. */
it('tints only the marks that actually end a sentence', () => {
  render(<Passage text={'Wow, look! He said "stop!" and ran. Is it here?'} />)

  const marks = screen.getAllByTestId('voice-punct')
  expect(marks.map(m => m.textContent)).toEqual(['!', '?'])
  // The whole passage still reads as one line to a screen reader, mid-sentence ! included.
  expect(screen.getByLabelText('Wow, look! He said "stop!" and ran. Is it here?')).toHaveTextContent(
    'Wow, look! He said "stop!" and ran. Is it here?',
  )
})

it('coaches the mood with three tips, different per mood', () => {
  renderVoice()

  expect(screen.getByText('🎭 Gợi ý giọng')).toBeInTheDocument()
  expect(screen.getAllByTestId('mood-tip')).toHaveLength(3)
  expect(screen.getByText(/Mỉm cười khi đọc/)).toBeInTheDocument()

  cleanupAndRender('sv3')
  expect(screen.getAllByTestId('mood-tip')).toHaveLength(3)
  expect(screen.getByText(/Lên giọng ở cuối câu hỏi/)).toBeInTheDocument()
  expect(screen.getByText(/Nhấn vào từ để hỏi/)).toBeInTheDocument()
})

/** The shared tips are used by several passages at once, so they can only talk about *how* to
 * read; a passage that needs a word named brings its own tips and those win outright. */
it('prefers the passage’s own tips over the shared mood tips when it has them', () => {
  // sv7 and sv5 are both "excited": the shared tips cannot name a word that fits both.
  renderVoice('sv7')
  const tips = screen.getAllByTestId('mood-tip').map(t => t.textContent)
  expect(tips).toHaveLength(3)
  expect(tips.join(' ')).toContain('did it')

  // sv5 has no tips of its own, so the mood's generic ones still show — and name no words.
  cleanupAndRender('sv5')
  const shared = screen.getAllByTestId('mood-tip').map(t => t.textContent ?? '')
  expect(shared).toHaveLength(3)
  expect(shared.join(' ')).not.toMatch(/birthday|big/)
})

it('plays the sample, and says so when it is missing', async () => {
  renderVoice()
  fireEvent.click(screen.getByRole('button', { name: /nghe mẫu/i }))
  expect(playerControl.playUrl).toHaveBeenCalledWith(SV1.audio)

  playerControl.playUrl.mockRejectedValue(new Error('audio failed'))
  fireEvent.click(screen.getByRole('button', { name: /nghe mẫu/i }))
  await screen.findByText('Chưa có audio mẫu')
})

it('turns strong intonation into 3 stars on the passage key', () => {
  renderVoice()
  score(result({ prosody: 84, accuracy: 75 }), new Blob(['x']))

  expect(screen.getByTestId('prosody-chip')).toHaveTextContent('Ngữ điệu 84')
  expect(screen.getByTestId('prosody-chip')).toHaveAttribute('data-tone', 'good')
  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
  expect(screen.getByText('Đọc có hồn quá!')).toBeInTheDocument()
  expect(screen.getByTestId('confetti')).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')['voice:sv1']).toBe(3)
  expect(JSON.parse(localStorage.getItem('speakup.activity') ?? '[]'))
    .toContainEqual(expect.objectContaining({ kind: 'speak', id: 'sv1' }))
  expect(store.saveRecording).toHaveBeenCalledTimes(1)
  expect(screen.getAllByTestId('score-bar')).toHaveLength(4)
  expect(screen.getByRole('button', { name: /nghe mình/i })).toBeInTheDocument()
})

it('gives 2 stars for middling intonation', () => {
  renderVoice()
  score(result({ prosody: 65, accuracy: 80 }))

  expect(screen.getByTestId('prosody-chip')).toHaveTextContent('Ngữ điệu 65')
  expect(screen.getByTestId('prosody-chip')).toHaveAttribute('data-tone', 'ok')
  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.getByText('Hay lắm!')).toBeInTheDocument()
  expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')['voice:sv1']).toBe(2)
  expect(screen.queryByRole('button', { name: /nghe mình/i })).not.toBeInTheDocument()
})

/** Web Speech cannot hear feeling, so it must neither show a number nor hand out 3 stars. */
it('says the intonation was not marked on the simple engine, and caps the stars', () => {
  mic.engine = 'webspeech'
  renderVoice()

  score(result({ accuracy: 95 }))

  expect(screen.getByTestId('prosody-chip')).toHaveTextContent('Chưa chấm được ngữ điệu')
  expect(screen.getByTestId('prosody-chip')).toHaveAttribute('data-tone', 'none')
  // …and the bar under it must not quietly paint accuracy in the prosody slot.
  const bars = screen.getAllByTestId('score-bar')
  expect(bars[3]).toHaveAttribute('data-value', 'none')
  expect(bars[3].style.width).toBe('0%')
  expect(screen.getByText('Ngữ điệu —')).toBeInTheDocument()
  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')['voice:sv1']).toBe(2)
})

it('offers a hint and a retry when the attempt was weak', () => {
  renderVoice()
  score(result({ prosody: 30, accuracy: 40, fluency: 40, completeness: 40 }))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(1)
  expect(screen.getByTestId('prosody-chip')).toHaveAttribute('data-tone', 'fix')
  expect(screen.getByText('Thử lại nhé')).toBeInTheDocument()
  expect(screen.getByText(/Sửa từ này/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
})

it('hands on to the next passage, and finishes the level on the last one', () => {
  renderVoice()
  score(result({ prosody: 84, accuracy: 75 }))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByText('Đoạn 2/8')).toBeInTheDocument()

  cleanupAndRender(STORY_VOICE[STORY_VOICE.length - 1].id)
  expect(screen.getByText('Đoạn 8/8')).toBeInTheDocument()
  score(result({ prosody: 84, accuracy: 75 }))
  fireEvent.click(screen.getByRole('button', { name: /hoàn thành/i }))
  expect(screen.getByText('các đoạn')).toBeInTheDocument()
})

it('shows a not-found message for a passage that does not exist', () => {
  renderVoice('nope')
  expect(screen.getByText('Không tìm thấy đoạn')).toBeInTheDocument()
})

// --- as a step of today's lesson (spec §3) ---------------------------------------------------

it('numbers itself inside the lesson and threads back to the mission', () => {
  seedLesson(VOICE_STEP, NEXT_STEP)
  renderVoice(SV1.id, true)

  expect(screen.getByText('Thẻ 1/2')).toBeInTheDocument()
  // One counter, not two: the bậc's own position means nothing inside a lesson.
  expect(screen.queryByText('Đoạn 1/8')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nhiệm vụ' })).toHaveAttribute('href', '/mission')
})

/** Reached from the 🔁 group the number counts inside review, and the noun says which group. */
it('calls the step review when the lesson filed it under 🔁', () => {
  seedLesson({ ...VOICE_STEP, kind: 'review' }, NEXT_STEP)
  renderVoice(SV1.id, true)

  expect(screen.getByText('Ôn tập 1/1')).toBeInTheDocument()
  expect(screen.queryByText(/^Thẻ \d/)).not.toBeInTheDocument()
})

it('hands on to the next step of the lesson, still carrying the flag', () => {
  seedLesson(VOICE_STEP, NEXT_STEP)
  renderVoice(SV1.id, true)
  score(result({ prosody: 84, accuracy: 75 }))

  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/practice/sz-th-three {"mission":true}')
})

it('ends at the mission screen when it is the last step of the lesson', () => {
  seedLesson(VOICE_STEP)
  renderVoice(SV1.id, true)
  score(result({ prosody: 84, accuracy: 75 }))

  fireEvent.click(screen.getByRole('button', { name: /hoàn thành/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/mission null')
})

/** Today's lesson may well list this very passage — but a child who walked in from the bậc did
 * not arrive carrying the flag, and nothing about the screen may change for them. */
it('stays a free-play passage without the flag, lesson or no lesson', () => {
  seedLesson(VOICE_STEP, NEXT_STEP)
  renderVoice()

  expect(screen.getByText('Đoạn 1/8')).toBeInTheDocument()
  expect(screen.queryByText(/^Thẻ /)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/level/story-voice')
})

/** Phase 10: this screen had no phone layout at all — no breakpoint rules and no `PAGE_SHELL`,
 * so at 390×844 it measured 940 idle (the mic clipped at the fold) and 1742 scored, with
 * "Tiếp theo →" at y1642. jsdom cannot lay that out, so these guard the inputs. */
it('carries the safe-area shell at its own resting padding', () => {
  renderVoice()

  const shell = document.querySelector('main')!.className
  expect(shell).toContain('pt-[max(var(--page-pad-top,1.5rem),calc(env(safe-area-inset-top)_+_8px))]')
  expect(shell).toContain('pb-[max(var(--page-pad-bottom,1.5rem),calc(env(safe-area-inset-bottom)_+_10px))]')
  expect(shell).toContain('[--page-pad-top:1.25rem]')
  expect(shell).toContain('px-5')
  expect(shell).toContain('md:px-6')
})

/** The mood, the passage and the tips fold away on a phone once a result lands: the word chips
 * below reprint every word of the passage and the mood has already been read. From `md` up all
 * three stay exactly where they were. */
it('folds the brief away on a phone result only', () => {
  renderVoice()
  const mood = () => screen.getByTestId('mood-emoji').closest('section')!
  const tips = () => screen.getAllByTestId('mood-tip')[0].closest('div')!
  expect(mood().className).not.toContain('max-md:hidden')

  score(result({ prosody: 84, accuracy: 75 }), new Blob(['x']))
  expect(mood().className).toContain('max-md:hidden')
  expect(screen.getByTestId('voice-passage').closest('section')!.className).toContain('max-md:hidden')
  expect(tips().className).toContain('max-md:hidden')
})

/** The result read-out scrolls inside a bounded region on a phone with the CTA row as its sibling
 * underneath — never a `sticky` panel, which would paint over a word chip. And the bounded height
 * is switched on for the result *only*: a definite height would also let the recording section be
 * squeezed below its content and paint the countdown over the mic. */
it('bounds the column for the result only, and never with a sticky', () => {
  renderVoice()
  const column = () => document.querySelector('main > div')!
  expect(column().className).not.toContain('max-md:h-full')

  score(result({ prosody: 84, accuracy: 75 }), new Blob(['x']))
  expect(column().className).toContain('max-md:h-full')

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
  renderVoice()

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

  // The mood, the passage and the tips are what the child is learning; the mic is what they do.
  expect(teach).toContainElement(screen.getByTestId('mood-emoji'))
  expect(teach).toContainElement(screen.getByTestId('voice-passage'))
  expect(teach).toContainElement(screen.getAllByTestId('mood-tip')[0])
  expect(doing).toContainElement(screen.getByRole('button', { name: /bấm để nói/i }))
})

/** `min-h-full` is a floor, not a height. Without a definite one the split's `flex-1`/`min-h-0`
 * bound nothing and the column grows past the screen exactly as it did before. */
it('gives the iPad column a definite height to divide', () => {
  renderVoice()

  const column = classes(document.querySelector('main > div')!)
  expect(column).toContain('ipad:h-full')
  expect(column).toContain('min-h-full')
})

it('keeps the read-out and the CTA row in the doing column, the row outside the scroller', () => {
  renderVoice()
  score(result({ prosody: 84, accuracy: 75 }), new Blob(['x']))

  const doing = screen.getByTestId('do-col')
  const readout = screen.getByTestId('result-readout')
  const cta = screen.getByRole('button', { name: /tiếp theo/i }).parentElement!
  expect(doing).toContainElement(readout)
  expect(doing).toContainElement(cta)
  // The passage stays on the left through the result — this is the iPad, not the phone.
  expect(screen.getByTestId('teach-col')).toContainElement(screen.getByTestId('voice-passage'))

  // A 400 px column cannot hold fourteen word chips, four bars and a hint card, so the read-out
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
  renderVoice()
  score(result({ prosody: 84, accuracy: 75 }), new Blob(['x']))

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
