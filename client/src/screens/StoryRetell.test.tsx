import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'

/** The hook is mocked, not the recorder + scorer: these tests are about what StoryRetell does with
 * a result, and `useSpeakingAttempt` is covered by its own suite. `micState` is real state (not a
 * hardcoded `'idle'`) because round-2's carrier behaviours — dimmed header, "● Đang ghi" chip, the
 * collapsed strip, `processing` — all key off `recording`, and the "processing is not recording"
 * guard needs a screen already rendered mid-attempt. */
type MicState = 'idle' | 'recording' | 'processing' | 'disabled' | 'locked'
const mic = vi.hoisted(() => ({
  push: (_r: PronunciationResult, _b: Blob | null = null) => {},
  engine: 'azure' as 'azure' | 'webspeech',
  error: null as { kind: string; detail?: string } | null,
  dismissError: () => {},
  setMicState: (_s: MicState) => {},
  // Read once, on mount/reset, by the effect below — set before `renderRetell()` so a screen can
  // be rendered already mid-attempt (e.g. `processing`) with no post-render `act()` needed.
  initialMicState: 'idle' as MicState,
  initialResult: null as PronunciationResult | null,
}))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    const [state, setState] = useState<{ result: PronunciationResult | null; blob: Blob | null }>({ result: mic.initialResult, blob: null })
    const [micState, setMicState] = useState<MicState>('idle')
    useEffect(() => { setState({ result: mic.initialResult, blob: null }); setMicState(mic.initialMicState) }, [opts.resetKey])
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

import { StoryRetell } from './StoryRetell'
import { findStory } from '../content/stories'
import type { StoryWord } from '../content/stories/types'
import { dayKey } from '../progress/activity'
import { saveLesson } from '../progress/lessonStore'
import type { LessonItem } from '../progress/lesson'

const STORY = findStory('little-fox')!
const RETELL_SCENE = STORY.scenes.find(s => s.text.includes(STORY.retell.text))!
const SCENE_N = STORY.scenes.indexOf(RETELL_SCENE) + 1
const SCENE_M = STORY.scenes.length

/** Where a hand-off landed, and whether it was still carrying `{ mission: true }` — the flag leaves
 * no trace in the DOM, so the probe is the only way to see it. */
function Probe() {
  const location = useLocation()
  return <p data-testid="probe">{location.pathname} {JSON.stringify(location.state)}</p>
}

/** Today's lesson, written straight to storage, so the screen resolves real steps. */
function seedLesson(...items: LessonItem[]) {
  const now = Date.now()
  saveLesson({ day: dayKey(now), created: now, band: 5, items })
}

/** The 🔁 step the generator writes for a retell — this screen's own exact route. */
const RETELL_STEP: LessonItem = {
  kind: 'review', activity: 'sentence', id: 'retell:little-fox',
  route: '/story/little-fox/retell', label: 'Ôn lại: Chú cáo nhỏ', emoji: '🔁',
}
const NEXT_STEP: LessonItem =
  { kind: 'word', activity: 'word', id: 'w-apple', route: '/words/food/w-apple', label: 'Từ mới: apple', emoji: '🧩' }

/** One attempt at the retell sentence. */
function result(overall: number): PronunciationResult {
  return {
    overall, accuracy: overall, fluency: overall, completeness: overall, engine: 'azure',
    words: STORY.retell.text.split(' ').map(w => ({ word: w, score: overall, errorType: 'None' as const, phonemes: [] })),
  }
}

/** Strip generated timings from the retell scene so the speech-synthesis fallback path is exercised. */
function withoutRetellTimings<T>(fn: () => T): T {
  const saved: StoryWord[] = RETELL_SCENE.words
  RETELL_SCENE.words = saved.map(w => ({ w: w.w }))
  try {
    return fn()
  } finally {
    RETELL_SCENE.words = saved
  }
}

/** Swaps the retell sentence for one that appears in none of the story's scenes, the same way
 * `withoutRetellTimings` above mutates the loaded fixture in place, so `findRetellScene` returns
 * `undefined` and the screen's own "no scene matched" fallback is what's under test. */
function withRetellTextMatchingNoScene<T>(fn: () => T): T {
  const saved = STORY.retell.text
  STORY.retell.text = 'Zzyzx, an unrelated sentence no scene narrates.'
  try {
    return fn()
  } finally {
    STORY.retell.text = saved
  }
}

function renderRetell(id = 'little-fox', mission = false) {
  render(
    <MemoryRouter initialEntries={[{ pathname: `/story/${id}/retell`, state: mission ? { mission: true } : null }]}>
      <Routes>
        <Route path="/story/:id/retell" element={<StoryRetell />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
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

beforeEach(() => {
  localStorage.clear()
  mic.engine = 'azure'
  mic.error = null
  mic.initialMicState = 'idle'
  mic.initialResult = null
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
  playerControl.playBlob.mockReset().mockResolvedValue(undefined)
  store.saveRecording.mockReset().mockResolvedValue(undefined)
})

it('shows a not-found message for an unknown story id', () => {
  renderRetell('nope')
  expect(screen.getByRole('heading')).toHaveTextContent('Ơ, không tìm thấy truyện này 🦊')
  expect(screen.getByRole('link', { name: '← Về trang chủ' })).toHaveAttribute('href', '/stories')
})

/** No story means no lesson position, so `LessonChip` suppresses itself here too and this arrow is
 * the only way off the screen. It may not point out of the lesson. */
it('leads a mission child home even when the story itself is missing', () => {
  renderRetell('nope', true)
  expect(screen.getByRole('link', { name: '← Về trang chủ' })).toHaveAttribute('href', '/mission')
})

it('shows the retell sentence, its translation and no more H1 — the chip replaces it', () => {
  renderRetell()
  expect(screen.queryByText('Bé kể lại nhé')).not.toBeInTheDocument()
  expect(screen.getByText(`Kể lại · cảnh ${SCENE_N}/${SCENE_M}`)).toBeInTheDocument()
  expect(screen.getByText('He wants an apple.')).toBeInTheDocument()
  expect(screen.getByText('Cậu ấy muốn một quả táo.')).toBeInTheDocument()
  expect(screen.getByText(`🦊 ${STORY.title} · cảnh ${SCENE_N}/${SCENE_M}`)).toBeInTheDocument()
})

it('falls back to a plain "Kể lại" chip and no scene number when no scene matches the retell sentence', () => {
  withRetellTextMatchingNoScene(() => {
    renderRetell()

    expect(screen.getByText('Kể lại')).toBeInTheDocument()
    expect(screen.queryByText(/^Kể lại ·/)).not.toBeInTheDocument()
    expect(screen.getByText(`🦊 ${STORY.title}`)).toBeInTheDocument()
    expect(screen.queryByText(/cảnh \d/)).not.toBeInTheDocument()
  })
})

it('shows a lenient pass of 2 stars and saves progress once', () => {
  renderRetell()
  score(result(40))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.getByText('Hay lắm!')).toBeInTheDocument()
  const saved = JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')
  expect(saved['retell:little-fox']).toBe(2)
  expect(JSON.parse(localStorage.getItem('speakup.activity') ?? '[]'))
    .toContainEqual(expect.objectContaining({ kind: 'sentence', id: 'retell:little-fox' }))
})

it('offers to play back the recording when a blob is available', () => {
  renderRetell()
  score(result(90), new Blob(['x']))
  expect(screen.getByRole('button', { name: /nghe mình/i })).toBeInTheDocument()
  expect(store.saveRecording).toHaveBeenCalledTimes(1)
})

it('shows the hook error in the fix color', () => {
  mic.error = { kind: 'noSpeech' }
  renderRetell()
  const err = screen.getByText('Không nghe rõ, bé thử lại nhé!')
  expect(err).toHaveClass('text-fix-700')
})

it('shows a simple-mode label for the webspeech engine', () => {
  mic.engine = 'webspeech'
  renderRetell()
  expect(screen.getByTestId('engine-badge')).toHaveTextContent('chế độ đơn giản')
})

it('plays the recorded scene narration when the retell scene has word timings', () => {
  renderRetell()
  fireEvent.click(screen.getByRole('button', { name: 'Nghe mẫu' }))
  expect(playerControl.playUrl).toHaveBeenCalledWith(RETELL_SCENE.audio)
})

describe('speech synthesis sample fallback', () => {
  const originalSpeechSynthesis = window.speechSynthesis
  const originalUtterance = (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance

  afterEach(() => {
    Object.defineProperty(window, 'speechSynthesis', { value: originalSpeechSynthesis, configurable: true, writable: true })
    ;(window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = originalUtterance
  })

  it('cancels any queued utterance before speaking again, so a double-tap restarts instead of queueing', async () => {
    const synth = { cancel: vi.fn(), speak: vi.fn() }
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true, writable: true })
    // jsdom does not implement SpeechSynthesisUtterance either — stub a minimal constructor.
    ;(window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
      lang = ''
      text: string
      constructor(text: string) {
        this.text = text
      }
    }
    withoutRetellTimings(() => {
      renderRetell()
      const playButton = screen.getByRole('button', { name: 'Nghe mẫu' })
      fireEvent.click(playButton)
      fireEvent.click(playButton)
    })

    expect(synth.cancel).toHaveBeenCalledTimes(2)
    // speakText() defers speak() one task past cancel() (WebKit drops same-task utterances).
    await new Promise(r => setTimeout(r, 0))
    expect(synth.speak).toHaveBeenCalledTimes(2)
    for (const call of synth.speak.mock.calls) {
      const utterance = call[0] as SpeechSynthesisUtterance
      expect(utterance.lang).toBe('en-US')
    }
  })
})

// --- as part of a lesson step (fix: the story chain keeps its thread back) ---------------------

/**
 * The lesson is SEEDED here, and holds this very retell as its 🔁 step — an empty store would let
 * every mission branch pass by never resolving anything, which is not the guarantee this guard is
 * for. What it pins is that a child who walked in from the story list sees free play even on a day
 * whose lesson names this exact route: the flag decides, never the lesson.
 */
it('ends free play back on the story list, even when the lesson holds this very retell', () => {
  seedLesson(RETELL_STEP, NEXT_STEP)
  renderRetell()
  score(result(90))

  expect(screen.getByRole('link', { name: 'Truyện' })).toHaveAttribute('href', '/stories')
  const card = screen.getByTestId('result-card')
  expect(within(card).getByRole('link', { name: 'Về danh sách truyện' })).toHaveAttribute('href', '/stories')
  expect(screen.queryByRole('link', { name: 'Nhiệm vụ' })).not.toBeInTheDocument()
  expect(within(card).queryByRole('button', { name: /Tiếp theo/ })).not.toBeInTheDocument()
})

it('leads back to the mission when the child arrived from a story step', () => {
  renderRetell('little-fox', true)
  score(result(90))

  expect(screen.getByRole('link', { name: 'Nhiệm vụ' })).toHaveAttribute('href', '/mission')
  expect(screen.queryByRole('link', { name: 'Truyện' })).not.toBeInTheDocument()
  // The way out of the chain is the lesson, not the story library the child never chose.
  const card = screen.getByTestId('result-card')
  expect(within(card).getByRole('link', { name: /Về nhiệm vụ/ })).toHaveAttribute('href', '/mission')
  expect(within(card).queryByRole('link', { name: 'Về danh sách truyện' })).not.toBeInTheDocument()
})

/** When the retell IS today's own step, the hand-off resolves on this exact route — so the child
 * gets the next lesson item rather than a bare trip back to the mission card. */
it('hands straight on to the next lesson step when the retell is the step itself', () => {
  seedLesson(RETELL_STEP, NEXT_STEP)
  renderRetell('little-fox', true)
  score(result(90))

  fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo →' }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/words/food/w-apple {"mission":true}')
})

it('celebrates back at the mission when the retell is the last step of the lesson', () => {
  seedLesson(RETELL_STEP)
  renderRetell('little-fox', true)
  score(result(90))

  fireEvent.click(screen.getByRole('button', { name: /Hoàn thành/ }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/mission null')
})

// --- round-2 carrier -----------------------------------------------------------------------

it('lays out the round-2 teach card at idle', () => {
  renderRetell()

  const card = screen.getByText('He wants an apple.').closest('div')!
  expect(card).toHaveClass('rounded-r22', 'px-[18px]', 'py-[22px]', 'md:max-w-[560px]', 'md:px-7', 'md:py-8')
  expect(screen.getByText(`🦊 ${STORY.title} · cảnh ${SCENE_N}/${SCENE_M}`)).toHaveClass('text-[12px]', 'md:text-[14px]')
  expect(screen.getByText('He wants an apple.')).toHaveClass('text-[32px]', 'md:text-[40px]')
  expect(screen.getByText('Cậu ấy muốn một quả táo.')).toHaveClass('text-[15px]', 'md:text-[20px]')

  const speaker = screen.getByRole('button', { name: 'Nghe mẫu' })
  expect(speaker).toHaveClass('h-14', 'w-14', 'md:h-16', 'md:w-16')
})

it('prompts to say the sentence with an 8-second badge, and no doubled number', () => {
  renderRetell()

  expect(screen.getByText('Bé kể lại câu này nhé')).toBeInTheDocument()
  expect(screen.getByText('8 giây')).toBeInTheDocument()
  expect(screen.getAllByText(/giây/)).toHaveLength(1)
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
})

it('dims the header, swaps the chip and keeps the card while recording', () => {
  renderRetell()
  startRecording()

  const backCell = screen.getByRole('link', { name: 'Truyện' }).closest('div')!
  expect(backCell).toHaveClass('opacity-40', 'pointer-events-none')
  expect(screen.getByTestId('header-right')).toHaveClass('opacity-40', 'pointer-events-none')

  const chip = screen.getByText('● Đang ghi')
  expect(chip).toHaveClass('bg-coral-50', 'text-coral-text')
  expect(screen.queryByText(/^Kể lại/)).not.toBeInTheDocument()

  expect(screen.getByText('He wants an apple.')).toBeInTheDocument()
  expect(screen.getByTestId('countdown-row')).toBeInTheDocument()
})

/** Spec decision (brief R23 "Đang chấm"): `processing` reads as an idle mic with an hourglass and
 * nothing else may react to it — no dimmed header, no "Đang ghi" chip, no collapsed strip.
 * Rendered already in `processing` via `mic.initialMicState`, no post-mount `act()` needed. */
it('holds the teach card still while scoring — processing is not recording', () => {
  mic.initialMicState = 'processing'
  renderRetell()

  expect(screen.getByText('He wants an apple.')).toBeInTheDocument()
  const backCell = screen.getByRole('link', { name: 'Truyện' }).closest('div')!
  expect(backCell).not.toHaveClass('opacity-40')
  expect(screen.getByTestId('header-right')).not.toHaveClass('opacity-40')
  expect(screen.getByText(`Kể lại · cảnh ${SCENE_N}/${SCENE_M}`)).toBeInTheDocument()
  expect(screen.queryByText('● Đang ghi')).not.toBeInTheDocument()

  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /đang chấm/i })).toBeInTheDocument()
})

it('renders the result through ResultCard: scored word chips, no bars, fox, and a single primary + retry CTA', () => {
  renderRetell()
  score(result(90), new Blob(['x']))

  const card = screen.getByTestId('result-card')
  expect(within(card).getAllByTestId('word-chip')).toHaveLength(STORY.retell.text.split(' ').length)
  expect(card.querySelectorAll('[data-testid="score-bar"]')).toHaveLength(0)
  expect(within(card).getByTestId('foxy')).toBeInTheDocument()
  expect(within(card).getByText('Foxy: "Kể chuyện hay quá!"')).toBeInTheDocument()

  const rows = Array.from(card.children).map(c => c.getAttribute('data-row'))
  expect(rows).toEqual(['head', 'words', 'listen', 'fox', 'cta'])
  expect(within(card).getByRole('button', { name: /thử lại/i })).toBeInTheDocument()
})

it('picks the idle fox mood for the weakest, 1-star band', () => {
  renderRetell()
  score(result(10))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(1)
  expect(screen.getByText('Bé kể tốt lắm, thử lại nhé!')).toBeInTheDocument()
  const card = screen.getByTestId('result-card')
  expect(within(card).getByText('Foxy: "Kể lại lần nữa nhé!"')).toBeInTheDocument()
})

/** Brief §1 "Tầng dạy gập": once a result lands the teach card collapses to a tap-to-expand strip
 * (PageBody's `collapsed`) instead of the old `max-md:hidden`; tapping it reopens the full card. */
it('collapses the teach card to a tap-to-expand strip once a result lands, and reopens on tap', () => {
  renderRetell()
  score(result(90), new Blob(['x']))

  const strip = screen.getByRole('button', { name: /mở/i })
  expect(strip).toHaveTextContent('He wants an apple.')
  const hiddenWrap = ancestorWithClass(screen.getByRole('button', { name: 'Nghe mẫu' }), 'hidden')
  expect(hiddenWrap).toHaveClass('ipad:flex')

  fireEvent.click(strip)
  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()
  expect(screen.getAllByText('He wants an apple.')).toHaveLength(1)
})

it('reopens the teach card on tap, and collapses again once a fresh result lands', () => {
  renderRetell()
  score(result(10))
  expect(screen.getByRole('button', { name: /mở/i })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /mở/i }))
  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()

  score(result(90))
  expect(screen.getByRole('button', { name: /mở/i })).toBeInTheDocument()
})

/** A retry must reopen the strip too — the child is about to speak again, not stare at a folded
 * teach card that no longer matches what they are doing. */
it('reopens the teach card on retry', () => {
  renderRetell()
  score(result(10))

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()
  expect(screen.getByText('He wants an apple.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeInTheDocument()
})

it('carries the PageShell frame, never a sticky panel', () => {
  renderRetell()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto', 'ipad:flex-row')
  expect(document.querySelector('main')!.innerHTML).not.toContain('sticky')
})
