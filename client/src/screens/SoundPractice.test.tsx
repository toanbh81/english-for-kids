import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'

/** The hook is mocked, not the recorder + scorer: these tests are about what SoundPractice does
 * with a result, and `useSpeakingAttempt` is covered by its own suite and PracticeCard.test. */
const mic = vi.hoisted(() => ({ push: (_r: PronunciationResult) => {}, engine: 'azure' as 'azure' | 'webspeech' }))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    const [result, setResult] = useState<PronunciationResult | null>(null)
    // The real hook drops the result whenever the reset key changes — here, on the next word.
    useEffect(() => { setResult(null) }, [opts.resetKey])
    mic.push = (r: PronunciationResult) => { setResult(r); opts.onResult?.(r, null) }
    return {
      micState: 'idle' as const, level: 0, engine: mic.engine,
      result, error: null, lastBlob: null,
      onMic: () => {}, reset: () => setResult(null),
    }
  },
}))
const playerControl = vi.hoisted(() => ({ playUrl: vi.fn() }))
vi.mock('../audio/player', () => ({ playUrl: playerControl.playUrl, playBlob: vi.fn().mockResolvedValue(undefined) }))

import { SoundPractice } from './SoundPractice'
import { PHONEME_TIPS } from '../scoring/feedback'
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

const SOUND_STEP = step('th', '/sound/th')
const NEXT_STEP = step('sz-th-three', '/practice/sz-th-three')

/** One attempt on the word `three`: `ph` is the target phoneme's score, `null` = no detail at all. */
function result(ph: number | null, overall = 90): PronunciationResult {
  return {
    overall, accuracy: overall, fluency: overall, completeness: 100, engine: 'azure',
    words: [{ word: 'three', score: overall, errorType: 'None', phonemes: ph === null ? [] : [{ phoneme: 'th', score: ph }] }],
  }
}

/** The same word on the Web Speech engine: a word-level score and no phoneme detail at all. */
function ws(accuracy: number): PronunciationResult {
  return {
    overall: accuracy, accuracy, fluency: accuracy, completeness: 100, engine: 'webspeech',
    words: [{ word: 'three', score: accuracy, errorType: 'None', phonemes: [] }],
  }
}

function score(r: PronunciationResult) {
  act(() => { mic.push(r) })
}

function renderSound(ph = 'th', mission = false) {
  render(
    <MemoryRouter initialEntries={[{ pathname: `/sound/${ph}`, state: mission ? { mission: true } : null }]}>
      <Routes>
        <Route path="/sound/:ph" element={<SoundPractice />} />
        <Route path="/level/:levelId" element={<p>các âm</p>} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  mic.engine = 'azure'
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
})

const nextWord = () => fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))

it('leads with the sound itself and the first of its three words', () => {
  renderSound()
  expect(screen.getByText('/θ/')).toBeInTheDocument()
  expect(screen.getByText(PHONEME_TIPS.th)).toBeInTheDocument()
  expect(screen.getByText('three')).toBeInTheDocument()
  expect(screen.getByText('Từ 1/3')).toBeInTheDocument()
})

it('lays the sound and the word out as two rows sharing a tile column', () => {
  renderSound()

  const grid = screen.getByTestId('sound-word-grid')
  const soundA = screen.getByTestId('sound-cell-a')
  const soundB = screen.getByTestId('sound-cell-b')
  const wordA = screen.getByTestId('word-cell-a')
  const wordB = screen.getByTestId('word-cell-b')
  expect(grid).toContainElement(soundA)
  expect(grid).toContainElement(wordA)

  // Row 1 (sound): the IPA tile plus its own "Nghe âm lẻ" control.
  expect(soundA).toHaveTextContent('/θ/')
  expect(within(soundA).getByRole('button', { name: /nghe âm lẻ/i })).toBeInTheDocument()
  expect(soundB).toHaveTextContent(PHONEME_TIPS.th)

  // Row 2 (word): the word tile plus its own "Nghe mẫu" control, and the word's own text.
  expect(wordA).toHaveTextContent('🔊')
  expect(within(wordA).getByRole('button', { name: /nghe mẫu/i })).toBeInTheDocument()
  expect(wordB).toHaveTextContent('three')
  expect(wordB).toHaveTextContent('Từ 1/3')
})

it('plays the sound on its own, and says so when that sample is missing', async () => {
  playerControl.playUrl.mockReturnValue(new Promise<void>(() => {})) // still playing: no state change yet
  renderSound()
  fireEvent.click(screen.getByRole('button', { name: /nghe âm lẻ/i }))
  expect(playerControl.playUrl).toHaveBeenCalledWith('/audio/sounds/th.mp3')

  playerControl.playUrl.mockRejectedValue(new Error('audio failed'))
  fireEvent.click(screen.getByRole('button', { name: /nghe âm lẻ/i }))
  await screen.findByText('Chưa có audio âm này')
})

it('folds the word row away once a result lands, and keeps the "Từ n/3" count in the header instead', () => {
  renderSound()
  expect(screen.getByTestId('word-cell-a')).toBeInTheDocument()

  score(result(92))

  expect(screen.queryByTestId('word-cell-a')).not.toBeInTheDocument()
  expect(screen.queryByTestId('word-cell-b')).not.toBeInTheDocument()
  // Still on screen exactly once — relocated, never lost.
  expect(screen.getByText('Từ 1/3')).toBeInTheDocument()
})

it('scores only the target sound: a good phoneme needs no tip', () => {
  renderSound()
  score(result(92))

  const chip = screen.getByTestId('sound-chip')
  expect(chip).toHaveAttribute('data-tone', 'good')
  expect(chip).toHaveTextContent('92')
  expect(screen.queryByTestId('sound-tip')).not.toBeInTheDocument()
})

it('turns a weak target sound into a fix chip plus the mouth tip', () => {
  renderSound()
  score(result(55))

  expect(screen.getByTestId('sound-chip')).toHaveAttribute('data-tone', 'fix')
  expect(screen.getByTestId('sound-tip')).toHaveTextContent(PHONEME_TIPS.th)
  // The word is still shown, but small and only as context for the sound.
  expect(screen.getByText(/90 điểm/)).toBeInTheDocument()
})

/** The word's accuracy is not the sound's score: "three" said as "tree" can still be 90 % accurate
 * overall. Standing that number under a /θ/ chip told the child their θ was fine when nothing had
 * measured it, so a result with no phoneme detail now says so instead of borrowing a number. */
it('says the sound was not scored when the engine reports no phoneme detail', () => {
  renderSound()
  score(result(null, 70))

  const chip = screen.getByTestId('sound-chip')
  expect(chip).toHaveAttribute('data-tone', 'unknown')
  // Full scoring ran and simply missed the sound — saying it again really can fix that.
  expect(chip).toHaveTextContent('Chưa nghe rõ âm này — thử lại nhé!')
  expect(chip).toHaveAttribute('aria-label', 'Âm θ: Chưa nghe rõ âm này — thử lại nhé!')
  expect(chip.textContent).not.toMatch(/\d/)
  // The word's own score is still reported — that much was measured.
  expect(screen.getByText(/70 điểm/)).toBeInTheDocument()
})

/** The simple engine reports no phoneme detail at all, so "try again" is the whole truth there —
 * and the child never reads the name of a cloud service it has no way to act on. */
it('blames neither the connection nor the child when the simple engine cannot score a sound', () => {
  mic.engine = 'webspeech'
  renderSound()
  score(ws(70))

  const chip = screen.getByTestId('sound-chip')
  expect(chip).toHaveAttribute('data-tone', 'unknown')
  expect(chip).toHaveTextContent('Chế độ đơn giản chưa chấm được âm lẻ — bé thử lại nhé!')
  expect(chip).toHaveAttribute('aria-label', 'Âm θ: Chế độ đơn giản chưa chấm được âm lẻ — bé thử lại nhé!')
  expect(document.body.textContent).not.toMatch(/azure/i)
})

it('never fabricates a phoneme score on the Web Speech fallback, and caps such a run at 2 stars', () => {
  mic.engine = 'webspeech'
  renderSound()

  score(ws(100))
  const chip = screen.getByTestId('sound-chip')
  expect(chip).toHaveAttribute('data-tone', 'unknown')
  expect(chip.textContent).not.toMatch(/\d/)

  nextWord(); score(ws(100))
  nextWord(); score(ws(100))

  // A perfect Web Speech run proves the child said *something*, not that the θ was right.
  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')['sound:th']).toBe(2)
})

/** 2 stars is the CEILING of an unscored run, never its floor: with no phoneme detail to judge,
 * the word's own score is the only evidence there is, and a run the engine barely recognised must
 * not come out level with one it heard perfectly. */
it('still separates 1 from 2 stars on an unscored run, using the word scores', () => {
  mic.engine = 'webspeech'
  renderSound()

  score(ws(100)); nextWord()
  score(ws(30)); nextWord()
  score(ws(100))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(1)
})

it('gives an unscored run 2 stars when every word was at least passable', () => {
  mic.engine = 'webspeech'
  renderSound()

  score(ws(100)); nextWord()
  score(ws(70)); nextWord()
  score(ws(100))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
})

it('caps the run at 2 stars when a single word never got phoneme detail', () => {
  renderSound()
  score(result(95))
  nextWord()
  score(result(null, 95)) // Azure dropped the sound in this word
  nextWord()
  score(result(95))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
})

it('takes the worst occurrence of the sound, not the average', () => {
  renderSound()
  score({
    ...result(90),
    words: [{ word: 'three', score: 90, errorType: 'None', phonemes: [{ phoneme: 'th', score: 90 }, { phoneme: 'th', score: 40 }] }],
  })
  expect(screen.getByTestId('sound-chip')).toHaveAttribute('data-tone', 'fix')
})

it('logs a speak event for every scored attempt', () => {
  renderSound()
  score(result(92))
  const events = JSON.parse(localStorage.getItem('speakup.activity') ?? '[]')
  expect(events).toContainEqual(expect.objectContaining({ kind: 'speak', id: 'sz-th-three' }))
})

it('gives 3 stars once the sound is good in all three words', () => {
  renderSound()

  score(result(92))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByText('Từ 2/3')).toBeInTheDocument()
  expect(screen.getByText('thank')).toBeInTheDocument()

  score(result(88))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByText('Từ 3/3')).toBeInTheDocument()

  score(result(85))

  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')).toMatchObject({ 'sound:th': 3 })
  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
  expect(screen.getByRole('link', { name: /hoàn thành/i })).toHaveAttribute('href', '/level/sound-zoo')
})

it('gives 2 stars when every word was only passable', () => {
  renderSound()
  score(result(65))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  score(result(92))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  score(result(70))

  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')).toMatchObject({ 'sound:th': 2 })
  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
})

it('lets a retry on the last word raise the stars', () => {
  renderSound()
  score(result(92))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  score(result(92))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  score(result(40))
  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')).toMatchObject({ 'sound:th': 1 })

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
  score(result(95))

  expect(JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')).toMatchObject({ 'sound:th': 3 })
})

it('shows a not-found message for a phoneme that has no group', () => {
  renderSound('nope')
  expect(screen.getByText('Không tìm thấy âm')).toBeInTheDocument()
})

// --- as a step of today's lesson (spec §3) ---------------------------------------------------

/** All three words of the sound, scored well — the run the lesson counts as one step. */
function runThreeWords() {
  score(result(92))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  score(result(92))
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  score(result(92))
}

it('numbers the sound inside the lesson and keeps its own three-word run', () => {
  seedLesson(SOUND_STEP, NEXT_STEP)
  renderSound('th', true)

  expect(screen.getByText('Âm 1/2')).toBeInTheDocument()
  // The three words are one lesson step, so the run keeps its own counter alongside.
  expect(screen.getByText('Từ 1/3')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nhiệm vụ' })).toHaveAttribute('href', '/mission')
})

it('walks its own words first, then hands on to the next step of the lesson', () => {
  seedLesson(SOUND_STEP, NEXT_STEP)
  renderSound('th', true)
  runThreeWords()

  expect(screen.getByText('Từ 3/3')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/practice/sz-th-three {"mission":true}')
})

it('ends at the mission screen when it is the last step of the lesson', () => {
  seedLesson(SOUND_STEP)
  renderSound('th', true)
  runThreeWords()

  fireEvent.click(screen.getByRole('button', { name: /hoàn thành/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/mission')
})

/** Today's lesson may well list this very sound — but a child who walked in from the bậc did not
 * arrive carrying the flag, and nothing about the screen may change for them. */
it('stays a free-play sound without the flag, lesson or no lesson', () => {
  seedLesson(SOUND_STEP, NEXT_STEP)
  renderSound()

  expect(screen.queryByText(/^Âm \d/)).not.toBeInTheDocument()
  expect(screen.getByText('Từ 1/3')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/level/sound-zoo')
})
