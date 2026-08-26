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

/** An element's classes as exact tokens. `className.includes('mt-auto')` also matches
 * `sm:mt-auto` and `md:mt-auto` — which is the whole thing these tests exist to catch — so every
 * breakpoint assertion below compares tokens, never substrings. */
const classes = (el: Element) => el.className.split(/\s+/).filter(Boolean)

beforeEach(() => {
  localStorage.clear()
  mic.engine = 'azure'
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

it('lays the sound and the word out as two rows sharing a tile column', () => {
  renderWord()

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

// --- the phone frame (phase 10, brief §5 M3/M3b + §6 M4) -------------------------------------
//
// jsdom has no layout, so these assert the one thing that decides the layout: which breakpoint
// each rule is written at. The geometry itself is measured in a browser (see the phase-10 task
// report) — what these guard is that nobody ever moves a phone rule up to where an iPad sees it,
// which is the failure mode brief §15 is entirely about.

it('reads the sound and word cells as two stacked tiers on a phone and as grid cells from `md` up', () => {
  renderWord()

  // The tier wrappers ARE the cards below 768 and stop being boxes at all from 768 up, which is
  // what lets one DOM be both layouts: `md:contents` takes them out of the grid.
  for (const id of ['sound-tier', 'word-tier']) {
    const tier = screen.getByTestId(id)
    expect(classes(tier)).toContain('md:contents')
    expect(classes(tier).some(c => c.startsWith('rounded-'))).toBe(true)
  }
  // The two-column grid is still the tablet/iPad layout and still starts at 768.
  expect(classes(screen.getByTestId('sound-word-grid'))).toContain('md:grid-cols-[minmax(180px,auto)_1fr]')
})

/** The 168×200 tile is the one element the design cuts outright: it is what pushed the mic under
 * the fold. The mouth shape itself is not lost — it moves into the sound row at 64 px. */
it('swaps the big mouth tile for a 64 px one in the sound row, below `md` only', () => {
  renderWord()

  const small = screen.getByTestId('mouth-tile')
  expect(screen.getByTestId('sound-cell-a')).toContainElement(small)
  expect(classes(small)).toContain('md:hidden')

  const big = classes(screen.getByText('Khẩu hình miệng').closest('section')!)
  expect(big).toContain('hidden')
  expect(big).toContain('md:flex')
})

/** Both counters still exist on a phone; only the deck they sit in folds away. */
it('folds the whole deck away on a phone once a result lands, and only on a phone', () => {
  renderWord()
  expect(classes(screen.getByTestId('sound-word-grid'))).not.toContain('max-md:hidden')

  score(result(55))

  expect(classes(screen.getByTestId('sound-word-grid'))).toContain('max-md:hidden')
  // The sound and its tip are not lost with it — the result state reprints both.
  expect(screen.getByTestId('sound-chip')).toHaveTextContent('/θ/')
  expect(screen.getByTestId('sound-tip')).toHaveTextContent(PHONEME_TIPS.th)
})

/** Every phone override on a shared primitive has to be `max-md:`, because an unprefixed one
 * would be a coin-toss against the class the primitive writes for itself — and, unlike a plain
 * rule, `max-md:` provably cannot reach the iPad. */
it('keeps the result CTAs a phone-only size, and never touches the button primitive above it', () => {
  renderWord()
  score(result(55))

  // "Tiếp theo" is a link in free play and a button under the mission, so ask for either.
  for (const name of [/thử lại/i, /tiếp theo/i]) {
    const cta = classes(screen.getByRole(/thử lại/.test(name.source) ? 'button' : 'link', { name }))
    expect(cta).toContain('max-md:min-h-[64px]')
    expect(cta.some(c => c === 'max-md:flex-1' || c === 'max-md:flex-[1.35]')).toBe(true)
    // The landscape size map is untouched: 72 px and 64 px are still what `Button` hands out.
    expect(cta.some(c => c === 'min-h-[64px]' || c === 'min-h-[72px]')).toBe(true)
  }
})

/** The mic takes the free space at the bottom of the phone frame and gives it straight back from
 * `md` up, where the mouth tile is holding the column open again.
 *
 * It must NOT be `sticky`: a bottom-pinned panel paints over whatever sits at its y, and at
 * 375×667 that hid the tail of the word card *inside* the viewport. The frame is trimmed to fit
 * instead. `classes()` is exact-token, not substring — `sm:mt-auto` is a different rule and has to
 * fail this. */
it('pins the mic with layout, never with an overlay, and leaves the landscape column alone', () => {
  renderWord()

  const micBlock = classes(screen.getByRole('button', { name: /bấm để nói/i }).parentElement!)
  expect(micBlock).toContain('mt-auto')
  expect(micBlock).toContain('md:mt-0')
  // No panel floats over the deck at any width.
  expect(micBlock).not.toContain('sticky')
  expect(micBlock).not.toContain('fixed')
  expect(micBlock).not.toContain('absolute')
  expect(micBlock).not.toContain('bg-cream-50')
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

it('folds the word row away once a result lands, and keeps the "Từ n/3" count in the header instead', () => {
  renderWord()
  expect(screen.getByTestId('word-cell-a')).toBeInTheDocument()

  score(result(92))

  expect(screen.queryByTestId('word-cell-a')).not.toBeInTheDocument()
  expect(screen.queryByTestId('word-cell-b')).not.toBeInTheDocument()
  // Still on screen exactly once — relocated, never lost.
  expect(screen.getByText('Từ 1/3')).toBeInTheDocument()
})

it('scores only the target sound: a good phoneme needs no tip', () => {
  renderWord()
  score(result(92))

  const chip = screen.getByTestId('sound-chip')
  expect(chip).toHaveAttribute('data-tone', 'good')
  expect(chip).toHaveTextContent('92')
  expect(screen.queryByTestId('sound-tip')).not.toBeInTheDocument()
})

it('turns a weak target sound into a fix chip plus the mouth tip', () => {
  renderWord()
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
  renderWord()
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
  renderWord()
  score(ws(70))

  const chip = screen.getByTestId('sound-chip')
  expect(chip).toHaveAttribute('data-tone', 'unknown')
  expect(chip).toHaveTextContent('Chế độ đơn giản chưa chấm được âm lẻ — bé thử lại nhé!')
  expect(chip).toHaveAttribute('aria-label', 'Âm θ: Chế độ đơn giản chưa chấm được âm lẻ — bé thử lại nhé!')
  expect(document.body.textContent).not.toMatch(/azure/i)
})

it('never fabricates a phoneme score on the Web Speech fallback, and caps such a word at 2 stars', () => {
  mic.engine = 'webspeech'
  renderWord()

  score(ws(100))
  const chip = screen.getByTestId('sound-chip')
  expect(chip).toHaveAttribute('data-tone', 'unknown')
  expect(chip.textContent).not.toMatch(/\d/)

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
  expect(screen.getByTestId('sound-chip')).toHaveAttribute('data-tone', 'fix')
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
  expect(screen.queryByTestId('sound-chip')).not.toBeInTheDocument()
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
