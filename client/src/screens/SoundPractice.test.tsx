import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'

/** The hook is mocked, not the recorder + scorer: these tests are about what SoundPractice does
 * with a result, and `useSpeakingAttempt` is covered by its own suite and PracticeCard.test. */
const mic = vi.hoisted(() => ({
  push: (_r: PronunciationResult) => {},
  engine: 'azure' as 'azure' | 'webspeech',
  error: null as { kind: string; detail?: string } | null,
}))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    const [result, setResult] = useState<PronunciationResult | null>(null)
    // The real hook drops the result whenever the reset key changes — here, on the next word.
    useEffect(() => { setResult(null) }, [opts.resetKey])
    mic.push = (r: PronunciationResult) => { setResult(r); opts.onResult?.(r, null) }
    return {
      micState: 'idle' as const, level: 0, engine: mic.engine,
      result, error: mic.error, lastBlob: null,
      onMic: () => {}, reset: () => setResult(null), dismissError: () => {},
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

/** One word of a sound is one step of the lesson now (Phase 9 §1). */
const WORD_STEP = step('sz-th-three', '/sound/th/sz-th-three')
const NEXT_STEP = step('wp-cat', '/practice/wp-cat')

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

/** One word of one sound — the screen's whole job now. */
function renderWord(ph = 'th', cardId = 'sz-th-three', mission = false) {
  render(
    <MemoryRouter initialEntries={[{ pathname: `/sound/${ph}/${cardId}`, state: mission ? { mission: true } : null }]}>
      <Routes>
        <Route path="/sound/:ph/:cardId" element={<SoundPractice />} />
        <Route path="/sound/:ph" element={<p>danh sách từ</p>} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

const stored = () => JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')

const wordChip = () => screen.getByTestId('word-chip')

beforeEach(() => {
  localStorage.clear()
  mic.engine = 'azure'
  mic.error = null
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
})

it('leads with the sound itself and the one word being drilled', () => {
  renderWord()
  expect(screen.getByText('/θ/')).toBeInTheDocument()
  expect(screen.getByText(PHONEME_TIPS.th)).toBeInTheDocument()
  expect(screen.getByText('three')).toBeInTheDocument()
  expect(screen.getByText('Từ 1/3')).toBeInTheDocument()
})

it('numbers the word by its place in the sound, not from 1', () => {
  renderWord('th', 'sz-th-think')
  expect(screen.getByText('think')).toBeInTheDocument()
  expect(screen.getByText('Từ 3/3')).toBeInTheDocument()
})

it('lays the sound and the word tile out with their own listening buttons', () => {
  renderWord()

  const wordTile = screen.getByTestId('word-tile')
  expect(within(wordTile).getByRole('button', { name: /nghe mẫu/i })).toBeInTheDocument()
  expect(wordTile).toHaveTextContent('three')

  expect(screen.getByRole('button', { name: /nghe âm lẻ/i })).toBeInTheDocument()
})

/** Both counters still exist on a phone; only the teach column folds away. */
it('folds the teach column away on a phone once a result lands, and only on a phone', () => {
  renderWord()
  const teach = screen.getByTestId('word-tile').parentElement!
  expect(teach.className).not.toContain('max-md:hidden')

  score(result(55))

  expect(teach.className).toContain('max-md:hidden')
  // The sound and its tip are not lost with it — the result card reprints the IPA chip and the tip.
  expect(wordChip()).toHaveTextContent('/θ/')
  expect(screen.getByText(PHONEME_TIPS.th)).toBeInTheDocument()
})

/** The frame is the shared `PageShell`: `overflow-hidden` on `main`, `page-body` the only
 * scroller, never a `sticky` panel painting over a word chip. */
it('carries the PageShell frame, never a sticky panel', () => {
  renderWord()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByTestId('page-body')).toHaveClass('ipad:flex-row')
  expect(document.querySelector('main')!.innerHTML).not.toContain('sticky')
})

/** Regression: a hand-copied `onErrorAction` here used to drop the `'limit'` branch outright
 * (`if (kind === 'limit') return`, no `useNavigate` in the file at all) — a child who hit the
 * daily limit on a Sound Practice drill got a "Về nhà" button that did nothing. Now wired through
 * the shared `useSpeakErrorAction`, same as every other speaking screen. */
it('sends the child home when the daily limit error is dismissed', () => {
  mic.error = { kind: 'limit' }
  renderWord()

  fireEvent.click(screen.getByRole('button', { name: 'Về nhà' }))

  expect(screen.getByTestId('probe')).toHaveTextContent('/')
})

it('puts the teaching tiles on the left and the mic on the right, only from `ipad` up', () => {
  renderWord()
  expect(screen.getByTestId('page-body')).toHaveClass('ipad:flex-row', 'ipad:gap-6')
})

it('plays the sound on its own, and says so when that sample is missing', async () => {
  playerControl.playUrl.mockReturnValue(new Promise<void>(() => {})) // still playing: no state change yet
  renderWord()
  fireEvent.click(screen.getByRole('button', { name: /nghe âm lẻ/i }))
  expect(playerControl.playUrl).toHaveBeenCalledWith('/audio/sounds/th.mp3')

  playerControl.playUrl.mockRejectedValue(new Error('audio failed'))
  fireEvent.click(screen.getByRole('button', { name: /nghe âm lẻ/i }))
  await screen.findByText('Chưa có audio âm này')
})

it('folds the word tile away once a result lands, and keeps the "Từ n/3" count in the header instead', () => {
  renderWord()
  expect(screen.getByTestId('word-tile')).toBeInTheDocument()

  score(result(92))

  expect(screen.queryByTestId('word-tile')).not.toBeInTheDocument()
  // Still on screen exactly once — relocated, never lost.
  expect(screen.getByText('Từ 1/3')).toBeInTheDocument()
})

it('scores only the target sound: a good phoneme needs no tip', () => {
  renderWord()
  score(result(92))

  const chip = wordChip()
  expect(chip).toHaveAttribute('data-tone', 'good')
  expect(screen.getByText(/90 điểm/)).toBeInTheDocument()
  // The result card itself carries no hint at 3 stars — the teach column's own copy of the tip
  // (now off-screen behind `max-md:hidden`, not removed) is a different element.
  expect(within(screen.getByTestId('result-card')).queryByText(PHONEME_TIPS.th)).not.toBeInTheDocument()
})

it('turns a weak target sound into a fix chip plus the mouth tip', () => {
  renderWord()
  score(result(55))

  expect(wordChip()).toHaveAttribute('data-tone', 'fix')
  expect(screen.getByText(PHONEME_TIPS.th)).toBeInTheDocument()
  // The word is still shown, but small and only as context for the sound.
  expect(screen.getByText(/90 điểm/)).toBeInTheDocument()
})

/** The word's accuracy is not the sound's score: "three" said as "tree" can still be 90 % accurate
 * overall. Standing that number under a /θ/ chip told the child their θ was fine when nothing had
 * measured it, so a result with no phoneme detail now says so instead of borrowing a number. */
it('says the sound was not scored when the engine reports no phoneme detail', () => {
  renderWord()
  score(result(null, 70))

  const chip = wordChip()
  expect(chip).toHaveAttribute('data-tone', 'unknown')
  // Full scoring ran and simply missed the sound — saying it again really can fix that.
  expect(screen.getByText('Chưa nghe rõ âm này — thử lại nhé!')).toBeInTheDocument()
  // The word's own score is still reported — that much was measured.
  expect(screen.getByText(/70 điểm/)).toBeInTheDocument()
})

/** The simple engine reports no phoneme detail at all, so "try again" is the whole truth there —
 * and the child never reads the name of a cloud service it has no way to act on. */
it('blames neither the connection nor the child when the simple engine cannot score a sound', () => {
  mic.engine = 'webspeech'
  renderWord()
  score(ws(70))

  const chip = wordChip()
  expect(chip).toHaveAttribute('data-tone', 'unknown')
  expect(screen.getByText('Chế độ đơn giản chưa chấm được âm lẻ — bé thử lại nhé!')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/azure/i)
})

it('never fabricates a phoneme score on the Web Speech fallback, and caps such a word at 2 stars', () => {
  mic.engine = 'webspeech'
  renderWord()

  score(ws(100))
  expect(wordChip()).toHaveAttribute('data-tone', 'unknown')

  // A perfect Web Speech attempt proves the child said *something*, not that the θ was right.
  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(stored()['sword:sz-th-three']).toBe(2)
})

/** 2 stars is the CEILING of an unscored attempt, never its floor: with no phoneme detail to judge,
 * the word's own score is the only evidence there is, and an attempt the engine barely recognised
 * must not come out level with one it heard perfectly. */
it('still separates 1 from 2 stars on an unscored attempt, using the word score', () => {
  mic.engine = 'webspeech'
  renderWord()
  score(ws(30))

  expect(screen.getAllByTestId('star-filled')).toHaveLength(1)
  expect(stored()['sword:sz-th-three']).toBe(1)
})

it('caps the word at 2 stars when the attempt never got phoneme detail', () => {
  renderWord()
  score(result(null, 95)) // Azure dropped the sound in this word

  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
  expect(stored()['sword:sz-th-three']).toBe(2)
})

it('takes the worst occurrence of the sound, not the average', () => {
  renderWord()
  score({
    ...result(90),
    words: [{ word: 'three', score: 90, errorType: 'None', phonemes: [{ phoneme: 'th', score: 90 }, { phoneme: 'th', score: 40 }] }],
  })
  expect(wordChip()).toHaveAttribute('data-tone', 'fix')
})

it('logs a speak event for every scored attempt', () => {
  renderWord()
  score(result(92))
  const events = JSON.parse(localStorage.getItem('speakup.activity') ?? '[]')
  expect(events).toContainEqual(expect.objectContaining({ kind: 'speak', id: 'sz-th-three' }))
})

// --- one word, one set of stars (spec §1) ----------------------------------------------------

it('stores this word’s stars under its own key, and never the sound’s', () => {
  renderWord()
  score(result(92))

  expect(stored()).toMatchObject({ 'sword:sz-th-three': 3 })
  expect(stored()['sound:th']).toBeUndefined()
  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
})

it('gives 2 stars when the sound was only passable in this word', () => {
  renderWord('th', 'sz-th-thank')
  score(result(65))

  expect(stored()).toMatchObject({ 'sword:sz-th-thank': 2 })
  expect(screen.getAllByTestId('star-filled')).toHaveLength(2)
})

it('leaves the other words of the sound untouched', () => {
  renderWord()
  score(result(92))

  expect(stored()['sword:sz-th-thank']).toBeUndefined()
  expect(stored()['sword:sz-th-think']).toBeUndefined()
})

it('lets a retry raise the word’s stars', () => {
  renderWord()
  score(result(40))
  expect(stored()).toMatchObject({ 'sword:sz-th-three': 1 })

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
  score(result(95))

  expect(stored()).toMatchObject({ 'sword:sz-th-three': 3 })
})

// --- walking the sound in free play -----------------------------------------------------------

it('hands on to the next word of the sound', () => {
  renderWord()
  score(result(92))

  const next = screen.getByRole('link', { name: /tiếp theo/i })
  expect(next).toHaveAttribute('href', '/sound/th/sz-th-thank')

  fireEvent.click(next)
  expect(screen.getByText('thank')).toBeInTheDocument()
  expect(screen.getByText('Từ 2/3')).toBeInTheDocument()
  // A fresh word starts with a fresh attempt, not the previous word's result.
  expect(screen.queryByTestId('result-card')).not.toBeInTheDocument()
})

it('ends the last word back on the sound’s word list', () => {
  renderWord('th', 'sz-th-think')
  score(result(92))

  expect(screen.queryByRole('link', { name: /tiếp theo/i })).not.toBeInTheDocument()
  const done = screen.getByRole('link', { name: /hoàn thành/i })
  expect(done).toHaveAttribute('href', '/sound/th')

  fireEvent.click(done)
  expect(screen.getByText('danh sách từ')).toBeInTheDocument()
})

it('goes back to the sound’s word list, not to the bậc', () => {
  renderWord()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/sound/th')
})

it('shows a not-found message for a phoneme that has no group', () => {
  renderWord('nope', 'sz-th-three')
  expect(screen.getByText('Không tìm thấy âm')).toBeInTheDocument()
})

it('shows a not-found message for a word that does not belong to the sound', () => {
  renderWord('th', 'sz-dh-this')
  expect(screen.getByText('Không tìm thấy âm')).toBeInTheDocument()
})

// --- as a step of today's lesson (spec §3) ---------------------------------------------------

it('numbers the word inside the lesson and keeps its place in the sound', () => {
  seedLesson(WORD_STEP, NEXT_STEP)
  renderWord('th', 'sz-th-three', true)

  expect(screen.getByText('Âm 1/2')).toBeInTheDocument()
  // Two different facts, so both chips stay.
  expect(screen.getByText('Từ 1/3')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nhiệm vụ' })).toHaveAttribute('href', '/mission')
})

/** Reached from the 🔁 group the number counts inside review, so "Âm 1/1" would name a group this
 * step is not in. The sound's own "Từ n/3" is a different fact and stays as it is. */
it('calls the step review when the lesson filed it under 🔁', () => {
  seedLesson({ ...WORD_STEP, kind: 'review' }, NEXT_STEP)
  renderWord('th', 'sz-th-three', true)

  expect(screen.getByText('Ôn tập 1/1')).toBeInTheDocument()
  expect(screen.queryByText(/^Âm \d/)).not.toBeInTheDocument()
})

it('hands on to the next step of the lesson instead of the sound’s next word', () => {
  seedLesson(WORD_STEP, NEXT_STEP)
  renderWord('th', 'sz-th-three', true)
  score(result(92))

  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/practice/wp-cat {"mission":true}')
})

it('ends at the mission screen when it is the last step of the lesson', () => {
  seedLesson(WORD_STEP)
  renderWord('th', 'sz-th-three', true)
  score(result(92))

  fireEvent.click(screen.getByRole('button', { name: /hoàn thành/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/mission null')
})

/** Today's lesson may well list this very word — but a child who walked in from the word list did
 * not arrive carrying the flag, and nothing about the screen may change for them. */
it('stays free play without the flag, lesson or no lesson', () => {
  seedLesson(WORD_STEP, NEXT_STEP)
  renderWord()

  expect(screen.queryByText(/^Âm \d/)).not.toBeInTheDocument()
  expect(screen.getByText('Từ 1/3')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/sound/th')
})
