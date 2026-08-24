import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
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
  expect(screen.getByTestId('mood-emoji')).toHaveClass('text-[56px]')

  cleanupAndRender('sv6') // 10 words — fits at the bigger size
  expect(screen.getByTestId('voice-passage')).not.toHaveClass('lg:text-[30px]')
  expect(screen.getByTestId('voice-passage')).toHaveClass('text-[34px]')
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
