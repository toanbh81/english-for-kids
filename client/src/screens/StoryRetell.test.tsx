import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { SpeakingAttempt } from '../speaking/useSpeakingAttempt'

function baseAttempt(): SpeakingAttempt {
  return {
    micState: 'idle',
    level: 0,
    engine: 'azure',
    result: null,
    error: null,
    lastBlob: null,
    onMic: vi.fn(),
    reset: vi.fn(),
    dismissError: vi.fn(),
  }
}

const attemptControl = vi.hoisted(() => ({ current: null as unknown }))

vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt: () => attemptControl.current,
}))

const playerMock = vi.hoisted(() => ({ playUrl: vi.fn(() => Promise.resolve()), playBlob: vi.fn(() => Promise.resolve()) }))
vi.mock('../audio/player', () => playerMock)

import { StoryRetell } from './StoryRetell'
import { findStory } from '../content/stories'
import type { StoryWord } from '../content/stories/types'
import { dayKey } from '../progress/activity'
import { saveLesson } from '../progress/lessonStore'
import type { LessonItem } from '../progress/lesson'

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

/** A finished attempt, so the stars section — and with it the finish CTA — is on screen. */
function scored(): SpeakingAttempt {
  return {
    ...baseAttempt(),
    result: { overall: 90, accuracy: 90, fluency: 90, completeness: 90, words: [], engine: 'azure' },
  }
}

/** Strip generated timings from the retell scene so the speech-synthesis fallback path is exercised. */
function withoutRetellTimings<T>(fn: () => T): T {
  const story = findStory('little-fox')!
  const scene = story.scenes.find(s => s.text.includes(story.retell.text))!
  const saved: StoryWord[] = scene.words
  scene.words = saved.map(w => ({ w: w.w }))
  try {
    return fn()
  } finally {
    scene.words = saved
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

beforeEach(() => {
  localStorage.clear()
  attemptControl.current = baseAttempt()
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

it('shows the retell sentence and its translation', () => {
  renderRetell()
  expect(screen.getByText('Bé kể lại nhé')).toBeInTheDocument()
  expect(screen.getByText('He wants an apple.')).toBeInTheDocument()
  expect(screen.getByText('Cậu ấy muốn một quả táo.')).toBeInTheDocument()
})

it('shows a lenient pass of 2 stars and saves progress once', () => {
  attemptControl.current = {
    ...baseAttempt(),
    result: { overall: 40, accuracy: 40, fluency: 40, completeness: 40, words: [], engine: 'azure' },
  }
  renderRetell()

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(screen.getByText('Hay lắm!')).toBeInTheDocument()
  const saved = JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')
  expect(saved['retell:little-fox']).toBe(2)
})

it('offers to play back the recording when a blob is available', () => {
  attemptControl.current = {
    ...baseAttempt(),
    result: { overall: 90, accuracy: 90, fluency: 90, completeness: 90, words: [], engine: 'azure' },
    lastBlob: new Blob(),
  }
  renderRetell()
  expect(screen.getByRole('button', { name: /nghe mình/i })).toBeInTheDocument()
})

it('shows the hook error in the fix color', () => {
  attemptControl.current = { ...baseAttempt(), error: { kind: 'noSpeech' } }
  renderRetell()
  const err = screen.getByText('Không nghe rõ, bé thử lại nhé!')
  expect(err).toHaveClass('text-fix-700')
})

it('shows a simple-mode label for the webspeech engine', () => {
  attemptControl.current = { ...baseAttempt(), engine: 'webspeech' }
  renderRetell()
  expect(screen.getByTestId('engine-badge')).toHaveTextContent('chế độ đơn giản')
})

it('plays the recorded scene narration when the retell scene has word timings', () => {
  playerMock.playUrl.mockClear()
  renderRetell()
  fireEvent.click(screen.getByRole('button', { name: 'Nghe mẫu' }))
  const story = findStory('little-fox')!
  const scene = story.scenes.find(s => s.text.includes(story.retell.text))!
  expect(playerMock.playUrl).toHaveBeenCalledWith(scene.audio)
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
    await waitFor(() => expect(synth.speak).toHaveBeenCalledTimes(2))
    for (const call of synth.speak.mock.calls) {
      const utterance = call[0] as SpeechSynthesisUtterance
      expect(utterance.lang).toBe('en-US')
    }
  })
})

// --- as part of a lesson step (fix: the story chain keeps its thread back) ---------------------
//
// Two different ways this screen can be inside a lesson, and they are not the same fact:
// `/story/:id/retell` is a SUB-route of the 🎧 step (only the forwarded flag says so), and it is
// ALSO a 🔁 review step's own exact route (where the hand-off resolves and knows what comes next).

/**
 * The lesson is SEEDED here, and holds this very retell as its 🔁 step — an empty store would let
 * every mission branch pass by never resolving anything, which is not the guarantee this guard is
 * for. What it pins is that a child who walked in from the story list sees free play even on a day
 * whose lesson names this exact route: the flag decides, never the lesson.
 */
it('ends free play back on the story list, even when the lesson holds this very retell', () => {
  seedLesson(RETELL_STEP, NEXT_STEP)
  attemptControl.current = scored()
  renderRetell()

  expect(screen.getByRole('link', { name: 'Truyện' })).toHaveAttribute('href', '/stories')
  expect(screen.getByRole('link', { name: 'Về danh sách truyện' })).toHaveAttribute('href', '/stories')
  expect(screen.queryByRole('link', { name: 'Nhiệm vụ' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Tiếp theo/ })).not.toBeInTheDocument()
})

it('leads back to the mission when the child arrived from a story step', () => {
  attemptControl.current = scored()
  renderRetell('little-fox', true)

  expect(screen.getByRole('link', { name: 'Nhiệm vụ' })).toHaveAttribute('href', '/mission')
  expect(screen.queryByRole('link', { name: 'Truyện' })).not.toBeInTheDocument()
  // The way out of the chain is the lesson, not the story library the child never chose.
  expect(screen.getByRole('link', { name: /Về nhiệm vụ/ })).toHaveAttribute('href', '/mission')
  expect(screen.queryByRole('link', { name: 'Về danh sách truyện' })).not.toBeInTheDocument()
})

/** When the retell IS today's own step, the hand-off resolves on this exact route — so the child
 * gets the next lesson item rather than a bare trip back to the mission card. */
it('hands straight on to the next lesson step when the retell is the step itself', () => {
  seedLesson(RETELL_STEP, NEXT_STEP)
  attemptControl.current = scored()
  renderRetell('little-fox', true)

  fireEvent.click(screen.getByRole('button', { name: 'Tiếp theo →' }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/words/food/w-apple {"mission":true}')
})

it('celebrates back at the mission when the retell is the last step of the lesson', () => {
  seedLesson(RETELL_STEP)
  attemptControl.current = scored()
  renderRetell('little-fox', true)

  fireEvent.click(screen.getByRole('button', { name: /Hoàn thành/ }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/mission null')
})
