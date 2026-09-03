import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'

/** The hook is mocked, not the recorder + scorer: these tests are about what VoicePractice does
 * with a result. `engine` is part of the control surface here, because the whole prosody story
 * changes when the app falls back to Web Speech. */
type MicState = 'idle' | 'recording' | 'processing' | 'disabled' | 'locked'
const mic = vi.hoisted(() => ({
  push: (_r: PronunciationResult, _b: Blob | null = null) => {},
  engine: 'azure' as 'azure' | 'webspeech',
  autoStopMs: undefined as number | undefined,
  error: null as { kind: string; detail?: string } | null,
  dismissError: () => {},
  setMicState: (_s: 'idle' | 'recording' | 'processing' | 'disabled' | 'locked') => {},
  // Read once, on mount/reset, by the effect below — set before `renderVoice()` so a screen can be
  // rendered already mid-attempt (e.g. `processing`) with no post-render `act()` needed.
  initialMicState: 'idle' as MicState,
}))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; autoStopMs?: number; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    mic.autoStopMs = opts.autoStopMs
    const [state, setState] = useState<{ result: PronunciationResult | null; blob: Blob | null }>({ result: null, blob: null })
    const [micState, setMicState] = useState<MicState>('idle')
    useEffect(() => { setState({ result: null, blob: null }); setMicState(mic.initialMicState) }, [opts.resetKey])
    mic.push = (r: PronunciationResult, b: Blob | null = null) => {
      setState({ result: r, blob: b })
      opts.onResult?.(r, b)
    }
    mic.dismissError = () => {}
    mic.setMicState = setMicState
    return {
      micState, level: 0, engine: mic.engine,
      result: state.result, error: mic.error, lastBlob: state.blob,
      onMic: () => {}, reset: () => { setState({ result: null, blob: null }); setMicState('idle') }, dismissError: mic.dismissError,
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
const startRecording = () => act(() => { mic.setMicState('recording') })

/** Walks up from `el` to the nearest ancestor carrying `cls` — used where the class under test
 * sits on a wrapper `data-testid` doesn't reach (PageBody's own collapse wrapper). */
function ancestorWithClass(el: Element, cls: string): HTMLElement {
  let node: Element | null = el
  while (node && !node.classList.contains(cls)) node = node.parentElement
  if (!node) throw new Error(`no ancestor of ${el.outerHTML.slice(0, 80)} carries class "${cls}"`)
  return node as HTMLElement
}

/** RTL's `getByText` only matches an element's own direct text-node children, so it cannot see
 * "Đọc với giọng: {moodVi}" once the mood name moved into a nested `<span>` — this reads the
 * element's full (recursive) textContent instead. */
function byFullText(text: string) {
  return (_: string, node: Element | null) => node?.textContent === text
}

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
  mic.error = null
  mic.initialMicState = 'idle'
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
  playerControl.playBlob.mockReset().mockResolvedValue(undefined)
  store.saveRecording.mockReset().mockResolvedValue(undefined)
})

it('opens on the passage with the mood it has to be read in', () => {
  renderVoice()

  expect(screen.getByText('Đoạn 1/8')).toBeInTheDocument()
  expect(screen.getByText(byFullText(`Đọc với giọng: ${SV1.moodVi}`))).toBeInTheDocument()
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

/** Round 2 drops the `lg:` size step and the "long passage" branch entirely — every passage sizes
 * the same way, capped by `md:max-w-[560px]` instead of a smaller font. */
it('sizes every passage the same way, long or short, with no lg: step', () => {
  renderVoice('sv4') // 15 words — three lines, used to trigger the lg: branch
  expect(screen.getByTestId('voice-passage')).not.toHaveClass('lg:text-[30px]')
  expect(screen.getByTestId('voice-passage')).toHaveClass('text-[24px]', 'md:text-[34px]', 'md:max-w-[560px]')

  cleanupAndRender('sv6')
  expect(screen.getByTestId('voice-passage')).toHaveClass('text-[24px]', 'md:text-[34px]', 'md:max-w-[560px]')
})

/** Brief §1: mood row 34/48px emoji + 16/22px label, passage/gloss/tips sizes, sample button. */
it('lays out the round-2 teach column at idle', () => {
  renderVoice()

  expect(screen.getByTestId('mood-emoji')).toHaveClass('text-[34px]', 'md:text-[48px]')
  const moodLabel = screen.getByText(byFullText(`Đọc với giọng: ${SV1.moodVi}`))
  expect(moodLabel).toHaveClass('text-[16px]', 'md:text-[22px]')
  expect(moodLabel.querySelector('span')).toHaveClass('text-coral-text')

  expect(screen.getByTestId('voice-passage')).toHaveClass('text-[24px]', 'md:text-[34px]', 'md:max-w-[560px]')
  expect(screen.getByText(SV1.vi)).toHaveClass('text-[13px]', 'md:text-[17px]')

  expect(screen.getByRole('button', { name: /nghe mẫu/i })).toBeInTheDocument()

  const tipsCard = screen.getByTestId('mood-tips')
  expect(tipsCard).toHaveClass('text-[12px]', 'md:text-[14px]', 'short:hidden')
  expect(screen.getByText('🎭 Gợi ý giọng')).toHaveClass('text-ink-900')
})

/** Brief §1/§2 B6: the act column opens with Foxy's idle prompt naming the 13 s window, then the
 * mic — the standalone "Đọc cả đoạn thật có hồn nhé!" paragraph from Phase 12 is gone. */
it('prompts to read for 13 seconds with the mic ready, at idle', () => {
  renderVoice()

  expect(screen.getByText(/Đọc cả đoạn thật có hồn nhé!/)).toBeInTheDocument()
  expect(screen.getByText('13 giây')).toHaveClass('text-coral-text')
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
})

/** Brief §1 "Header không đè" + "Đang ghi": Back/LessonChip mute, the centre chip becomes
 * "● Đang ghi" coral, the passage grows to 26px (phone) and the tips card disappears — the mood
 * row stays put, no muting on it. */
it('dims the header, swaps the chip and grows the passage while recording', () => {
  renderVoice()
  startRecording()

  const backCell = screen.getByRole('link', { name: 'Quay lại' }).closest('div')!
  expect(backCell).toHaveClass('opacity-40', 'pointer-events-none')
  const rightCell = screen.getByTestId('header-right')
  expect(rightCell).toHaveClass('opacity-40', 'pointer-events-none')

  const chip = screen.getByText('● Đang ghi')
  expect(chip).toHaveClass('bg-coral-50', 'text-coral-text')
  expect(screen.queryByText(/^Đoạn \d/)).not.toBeInTheDocument()

  expect(screen.getByTestId('mood-emoji')).toBeInTheDocument()
  expect(screen.getByTestId('voice-passage')).toHaveClass('text-[26px]')
  expect(screen.queryByTestId('mood-tips')).not.toBeInTheDocument()
  expect(screen.getByTestId('countdown-row')).toBeInTheDocument()
})

/** Spec decision 17 (brief R23 "Đang chấm"): `processing` — the gap between the mic stopping and
 * a result landing — reads as an idle mic with an hourglass, and nothing else may react to it:
 * no dimmed header, no "Đang ghi" chip, no collapsed strip, no grown passage, tips still shown.
 * Rendered already in `processing` via `mic.initialMicState` rather than a post-mount `act()`. */
it('holds the teach column still while scoring — processing is not recording', () => {
  mic.initialMicState = 'processing'
  renderVoice()

  expect(screen.getByTestId('mood-emoji')).toHaveClass('text-[34px]', 'md:text-[48px]')
  const moodLabel = screen.getByText(byFullText(`Đọc với giọng: ${SV1.moodVi}`))
  expect(moodLabel).toHaveClass('text-[16px]', 'md:text-[22px]')
  expect(screen.getByTestId('voice-passage')).toHaveClass('text-[24px]', 'md:text-[34px]', 'md:max-w-[560px]')
  expect(screen.getByText(SV1.vi)).toHaveClass('text-[13px]', 'md:text-[17px]')

  const backCell = screen.getByRole('link', { name: 'Quay lại' }).closest('div')!
  expect(backCell).not.toHaveClass('opacity-40')
  expect(screen.getByTestId('header-right')).not.toHaveClass('opacity-40')
  expect(screen.getByText('Đoạn 1/8')).toBeInTheDocument()
  expect(screen.queryByText('● Đang ghi')).not.toBeInTheDocument()

  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()
  expect(screen.getByTestId('mood-tips')).toBeInTheDocument()

  expect(screen.getByRole('button', { name: /đang chấm/i })).toBeInTheDocument()
})

/** Brief §1 "Tầng dạy gập": once a result lands the teach column collapses to a tap-to-expand
 * strip (PageBody's `collapsed`) instead of Phase 12's `max-md:hidden`; tapping it reopens the
 * full column, tips included. */
it('collapses the teach column to a tap-to-expand strip once a result lands, and reopens on tap', () => {
  renderVoice()
  score(result({ prosody: 84, accuracy: 75 }), new Blob(['x']))

  const strip = screen.getByRole('button', { name: /mở/i })
  expect(strip).toHaveTextContent(SV1.text)
  const hiddenWrap = ancestorWithClass(screen.getByTestId('mood-emoji'), 'hidden')
  expect(hiddenWrap).toHaveClass('ipad:flex')

  const card = screen.getByTestId('result-card')
  expect(within(card).getByTestId('foxy')).toBeInTheDocument()
  expect(within(card).getByText('Foxy: "Giọng vui thật đấy!"')).toBeInTheDocument()

  fireEvent.click(strip)
  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()
  expect(screen.getAllByTestId('mood-tip').length).toBeGreaterThan(0)
})

/** I1: at 2★ — the most common outcome band — Foxy should not grin and say "try again"; he gets
 * his own middle line, matching the ladder every other screen already carries. */
it('gives 2★ its own happy-but-not-perfect fox line, not the 3★ or the retry copy', () => {
  renderVoice()
  score(result({ accuracy: 75, prosody: 65 }), new Blob(['x']))

  const card = screen.getByTestId('result-card')
  expect(within(card).getByText('Foxy: "Gần chuẩn rồi đó!"')).toBeInTheDocument()
})

/** Reviewer minor (also applied to StarPractice.test.tsx): a test that only retries and checks
 * the strip is gone would pass whether or not `setTeachOpen(true)` ever ran, since a null `result`
 * alone already makes the strip's condition false. This drives `teachOpen` itself — tap the strip
 * open (no retry, `result` is untouched) and confirm the full teach column is back, then push a
 * fresh result over top and confirm the strip collapses again, which only passes if the
 * `teachOpen` effect re-fires on a genuinely new `result` object, not merely on any result. */
it('reopens the teach column on tap, and collapses again once a fresh result lands', () => {
  renderVoice()
  score(result({ prosody: 30, accuracy: 40, fluency: 40, completeness: 40 }))
  expect(screen.getByRole('button', { name: /mở/i })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /mở/i }))
  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()
  expect(screen.getByTestId('mood-tips')).toBeInTheDocument()

  score(result({ prosody: 84, accuracy: 75 }))
  expect(screen.getByRole('button', { name: /mở/i })).toBeInTheDocument()
})

/** A ! that closes a quote inside a sentence is not an instruction to the voice — the sentence
 * keeps going. Only a mark with a space (or nothing) after it ends a line. */
it('tints only the marks that actually end a sentence', () => {
  render(<Passage text={'Wow, look! He said "stop!" and ran. Is it here?'} />)

  const marks = screen.getAllByTestId('voice-punct')
  expect(marks.map(m => m.textContent)).toEqual(['!', '?'])
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
  renderVoice('sv7')
  const tips = screen.getAllByTestId('mood-tip').map(t => t.textContent)
  expect(tips).toHaveLength(3)
  expect(tips.join(' ')).toContain('did it')

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

  const card = screen.getByTestId('result-card')
  expect(screen.getByTestId('prosody-chip')).toHaveAttribute('data-tone', 'good')
  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
  expect(within(card).getByText('Đọc có hồn quá!')).toBeInTheDocument()
  expect(screen.getByTestId('confetti')).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')['voice:sv1']).toBe(3)
  expect(JSON.parse(localStorage.getItem('speakup.activity') ?? '[]'))
    .toContainEqual(expect.objectContaining({ kind: 'speak', id: 'sv1' }))
  expect(store.saveRecording).toHaveBeenCalledTimes(1)
  expect(card.querySelectorAll('[data-testid="word-chip"]')).toHaveLength(SV1.text.split(' ').length)
  expect(screen.getAllByTestId('score-bar')).toHaveLength(4)
  expect(screen.getByRole('button', { name: /nghe mình/i })).toBeInTheDocument()
})

it('gives 2 stars for middling intonation', () => {
  renderVoice()
  score(result({ prosody: 65, accuracy: 80 }))

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

  expect(screen.getByTestId('prosody-chip')).toHaveAttribute('data-tone', 'none')
  // …and the bar under it must not quietly paint accuracy in the prosody slot.
  const bars = screen.getAllByTestId('score-bar')
  expect(bars[3]).toHaveAttribute('data-value', 'none')
  expect(bars[3].style.width).toBe('0%')
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
  fireEvent.click(screen.getByRole('link', { name: /tiếp theo/i }))
  expect(screen.getByText('Đoạn 2/8')).toBeInTheDocument()

  cleanupAndRender(STORY_VOICE[STORY_VOICE.length - 1].id)
  expect(screen.getByText('Đoạn 8/8')).toBeInTheDocument()
  score(result({ prosody: 84, accuracy: 75 }))
  fireEvent.click(screen.getByRole('link', { name: /hoàn thành/i }))
  expect(screen.getByText('các đoạn')).toBeInTheDocument()
})

it('shows a not-found message for a passage that does not exist', () => {
  renderVoice('nope')
  expect(screen.getByRole('heading')).toHaveTextContent('Ơ, không tìm thấy đoạn này 🦊')
})

/** SpeakError renders the alert; a `noSpeech` action resets the attempt back to idle. */
it('renders the error through SpeakError and lets the child reset from it', () => {
  mic.error = { kind: 'noSpeech' }
  renderVoice()

  expect(screen.getByRole('alert')).toHaveTextContent('Không nghe rõ, bé thử lại nhé!')
  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
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

/** The frame is the shared `PageShell`: `overflow-hidden` on `main`, the body the only scroller. */
it('carries the PageShell frame, never a sticky panel', () => {
  renderVoice()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
  expect(document.querySelector('main')!.innerHTML).not.toContain('sticky')
})

// --- the iPad frame: two columns via PageBody's split, not a taller single column -------------

it('renders the result through ResultCard inside the split body and the error through SpeakError', () => {
  renderVoice()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByTestId('page-body')).toHaveClass('ipad:flex-row')

  score(result({ prosody: 84, accuracy: 75 }), new Blob(['x']))
  const card = screen.getByTestId('result-card')
  expect(card.querySelectorAll('[data-testid="word-chip"]')).toHaveLength(SV1.text.split(' ').length)
  expect(screen.getByTestId('prosody-chip')).toBeInTheDocument()
  expect(screen.queryByText('Ngữ điệu 84')).toBeNull() // old ProsodyChip gone

  mic.error = { kind: 'mic' }
  cleanupAndRender(SV1.id)
  expect(screen.getByRole('alert')).toHaveTextContent('Bé cho phép dùng mic nhé!')
})
