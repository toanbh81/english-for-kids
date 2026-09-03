import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { PronunciationResult } from '../scoring/types'
import { findSentence, SENTENCES } from '../content'
import { shuffleTiles } from '../content/shuffle'

/** The hook is mocked, not the recorder + scorer — same shape as `PairPractice.test.tsx` /
 * `StarPractice.test.tsx`: `micState` is real state (not a hardcoded `'idle'`) because round-2's
 * carrier behaviours — dimmed header, "● Đang ghi" chip, `processing` — all key off it. (C9 never
 * collapses its teach column to a strip — see the "never a collapsed strip" test below.) */
type MicState = 'idle' | 'recording' | 'processing' | 'disabled' | 'locked'
const mic = vi.hoisted(() => ({
  push: (_r: PronunciationResult, _b: Blob | null = null) => {},
  engine: 'azure' as 'azure' | 'webspeech',
  error: null as { kind: string; detail?: string } | null,
  dismissError: () => {},
  setMicState: (_s: MicState) => {},
  // Read once, on mount/reset, by the effect below — set before `renderBuilder()` so a screen can
  // be rendered already mid-attempt (e.g. `processing`) with no post-render `act()` needed.
  initialMicState: 'idle' as MicState,
  // Stands in for `?fixture=result3` landing a result before the tray was ever built — the real
  // fixture lives inside the real `useSpeakingAttempt` (speaking/fixture.ts), out of reach of this
  // mock, so the "a fixture result also marks the tray correct" wiring is exercised this way.
  initialResult: null as PronunciationResult | null,
}))
vi.mock('../speaking/useSpeakingAttempt', () => ({
  useSpeakingAttempt(opts: { resetKey?: string; onResult?: (r: PronunciationResult, b: Blob | null) => void }) {
    const [state, setState] = useState<{ result: PronunciationResult | null; blob: Blob | null }>({ result: mic.initialResult, blob: null })
    const [micState, setMicState] = useState<MicState>(mic.initialMicState)
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

const playerMock = vi.hoisted(() => ({ playUrl: vi.fn(() => Promise.resolve()), playBlob: vi.fn(() => Promise.resolve()) }))
vi.mock('../audio/player', () => playerMock)

const recordingsMock = vi.hoisted(() => ({ saveRecording: vi.fn(() => Promise.resolve()) }))
vi.mock('../progress/recordings', () => recordingsMock)

import { SentenceBuilder } from './SentenceBuilder'
import { dayKey } from '../progress/activity'
import { saveLesson } from '../progress/lessonStore'
import type { LessonItem, LessonItemKind } from '../progress/lesson'

/** Where a mission hand-off landed, and whether it was still carrying `{ mission: true }` — the
 * flag leaves no trace in the DOM, so the probe is the only way to see it. */
function Probe() {
  const location = useLocation()
  return <p data-testid="probe">{location.pathname}{location.search} {JSON.stringify(location.state)}</p>
}

/** `kind` is the group the lesson filed this step under — which is what the screen's counter
 * counts inside, and what its noun has to agree with. */
const step = (id: string, route: string, kind: LessonItemKind = 'sentence'): LessonItem =>
  ({ kind, activity: 'sentence', id, route, label: id, emoji: kind === 'review' ? '🔁' : '🧱' })

/** Today's lesson, written straight to storage, so the screen counts real steps. */
function seedLesson(...items: LessonItem[]) {
  const now = Date.now()
  saveLesson({ day: dayKey(now), created: now, band: 5, items })
}

const SENTENCE_STEP = step('s1', '/sentence/s1')
const NEXT_STEP = step('food-apple', '/words/food/food-apple')

/** One attempt on a sentence — one word per token of `words`, all scored the same. */
function resultFor(words: string[], overall = 85): PronunciationResult {
  return {
    overall, accuracy: overall, fluency: overall, completeness: overall, engine: 'azure',
    words: words.map(w => ({ word: w, score: overall, errorType: 'None', phonemes: [{ phoneme: 'ai', score: overall }] })),
  }
}
const S1_WORDS = findSentence('s1')!.words // ['I', 'eat', 'an', 'apple.']
const result85 = resultFor(S1_WORDS, 85)

function renderBuilder(id: string, opts: { mission?: boolean; topic?: string } = {}) {
  const search = opts.topic ? `?topic=${opts.topic}` : ''
  render(
    <MemoryRouter initialEntries={[{ pathname: `/sentence/${id}`, search, state: opts.mission ? { mission: true } : null }]}>
      <Routes>
        <Route path="/sentence/:id" element={<SentenceBuilder />} />
        <Route path="/sentences" element={<div>Danh sách câu</div>} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Tap every tile of `sentence` in the exact pool (shuffled) order — since shuffleTiles guarantees
 * the shuffled order never equals the original for 2+ tiles, this always lands on the wrong order. */
function tapInShuffledOrder(sentenceId: string) {
  const sentence = findSentence(sentenceId)!
  const order = shuffleTiles(sentence.words.map((_, i) => i), sentence.id)
  order.forEach(idx => fireEvent.click(screen.getByRole('button', { name: sentence.words[idx] })))
}

/** The last tile completes the sentence, which starts a `playUrl` whose promise settles into
 * `setAudioMissing` — so the taps have to be awaited inside act(), or that state update lands
 * after the test body. */
async function tapInCorrectOrder(sentenceId: string) {
  const sentence = findSentence(sentenceId)!
  await act(async () => {
    sentence.words.forEach(w => fireEvent.click(screen.getByRole('button', { name: w })))
  })
}

const score = (r: PronunciationResult, blob: Blob | null = null) => act(() => { mic.push(r, blob) })
const startRecording = () => act(() => { mic.setMicState('recording') })

beforeEach(() => {
  localStorage.clear()
  mic.engine = 'azure'
  mic.error = null
  mic.initialMicState = 'idle'
  mic.initialResult = null
  playerMock.playUrl.mockClear().mockResolvedValue(undefined)
  playerMock.playBlob.mockClear().mockResolvedValue(undefined)
  recordingsMock.saveRecording.mockClear()
})

it('shows a not-found message for an unknown sentence id', () => {
  renderBuilder('nope')
  expect(screen.getByRole('heading')).toHaveTextContent('Ơ, không tìm thấy câu này 🦊')
  expect(screen.getByRole('link', { name: '← Về trang chủ' })).toHaveAttribute('href', '/sentences')
})

// The unfiltered list only shows unlocked topics now, so a back link that dropped the filter could
// land the child on a different topic's sentences than the one they came from.
it('keeps the sentence topic on the way back to the list', () => {
  renderBuilder('s1') // food
  expect(screen.getByRole('link', { name: /Ghép câu/ })).toHaveAttribute('href', '/sentences?topic=food')
})

it('shows the Vietnamese cue and all word tiles in the pool', () => {
  renderBuilder('s1')
  const sentence = findSentence('s1')!
  expect(screen.getByText(sentence.vi)).toBeInTheDocument()
  sentence.words.forEach(w => expect(within(screen.getByTestId('pool')).getByRole('button', { name: w })).toBeInTheDocument())
})

it('gives each tile the round-2 size and its role colour', () => {
  renderBuilder('s1')
  const tile = screen.getByRole('button', { name: 'I' }) // first third of a 4-word sentence: "who"
  expect(tile).toHaveClass('h-11', 'min-w-[44px]', 'rounded-r12', 'text-[17px]', 'md:h-14', 'md:text-[22px]', 'md:rounded-r14')
  expect(tile).toHaveClass('bg-[#DDF0FB]', 'border-[#7EC8F2]', 'text-[#2E6F9E]')
  const thing = screen.getByRole('button', { name: 'apple.' }) // last third: "thing"
  expect(thing).toHaveClass('bg-[#FFF1C9]', 'border-[#FFC533]', 'text-[#9A6B00]')
})

it('sizes the tray per the round-2 brief', () => {
  renderBuilder('s1')
  expect(screen.getByTestId('tray')).toHaveClass('min-h-[76px]', 'rounded-r18', 'md:min-h-[96px]', 'md:max-w-[640px]', 'md:rounded-r22')
})

it('shows an empty-tray placeholder, then "Còn N ô nữa" once building starts', () => {
  renderBuilder('s1')
  expect(screen.getByText('thả vào đây')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'I' }))
  expect(screen.queryByText('thả vào đây')).not.toBeInTheDocument()
  expect(screen.getByText('Còn 3 ô nữa')).toBeInTheDocument()
})

it('tapping pool tiles in order appends them to the tray in that order', () => {
  renderBuilder('s1')
  const sentence = findSentence('s1')!
  const order = shuffleTiles(sentence.words.map((_, i) => i), sentence.id)

  fireEvent.click(screen.getByRole('button', { name: sentence.words[order[0]] }))
  fireEvent.click(screen.getByRole('button', { name: sentence.words[order[1]] }))

  const tray = within(screen.getByTestId('tray'))
  expect(tray.getAllByRole('button').map(b => b.textContent)).toEqual([
    sentence.words[order[0]],
    sentence.words[order[1]],
  ])
})

it('tapping a tray tile returns it to the pool', () => {
  renderBuilder('s1')
  const sentence = findSentence('s1')!
  const word = sentence.words[0]

  fireEvent.click(screen.getByRole('button', { name: word }))
  expect(within(screen.getByTestId('tray')).getByRole('button', { name: word })).toBeInTheDocument()

  fireEvent.click(within(screen.getByTestId('tray')).getByRole('button', { name: word }))
  expect(within(screen.getByTestId('tray')).queryByRole('button', { name: word })).not.toBeInTheDocument()
  expect(within(screen.getByTestId('pool')).getByRole('button', { name: word })).toBeInTheDocument()
})

it('a wrong order shakes the tray, shows the fox retry message, and restores the pool after 400ms', () => {
  vi.useFakeTimers()
  try {
    renderBuilder('s1')
    const sentence = findSentence('s1')!
    tapInShuffledOrder('s1')

    expect(screen.getByText('🦊 Chưa đúng — thử lại nhé')).toBeInTheDocument()
    expect(screen.getByTestId('tray')).toHaveClass('animate-shake', 'border-fix-300')

    act(() => { vi.advanceTimersByTime(400) })

    expect(screen.getByTestId('tray')).not.toHaveClass('animate-shake')
    expect(within(screen.getByTestId('pool')).getAllByRole('button')).toHaveLength(sentence.words.length)
    expect(within(screen.getByTestId('tray')).queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText('thả vào đây')).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

it('clears the shake-restore timer on unmount without throwing', () => {
  vi.useFakeTimers()
  try {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/sentence/s1']}>
        <Routes>
          <Route path="/sentence/:id" element={<SentenceBuilder />} />
        </Routes>
      </MemoryRouter>,
    )
    tapInShuffledOrder('s1')
    expect(screen.getByText('🦊 Chưa đúng — thử lại nhé')).toBeInTheDocument()
    unmount()
    expect(() => act(() => { vi.advanceTimersByTime(400) })).not.toThrow()
  } finally {
    vi.useRealTimers()
  }
})

it('a correct order shows the green banner, plays the sample audio, and reveals the mic', async () => {
  renderBuilder('s1')
  const sentence = findSentence('s1')!
  await tapInCorrectOrder('s1')

  expect(screen.getByText('Đúng rồi! 🎉')).toBeInTheDocument()
  await waitFor(() => expect(playerMock.playUrl).toHaveBeenCalledWith(sentence.audio))
  expect(screen.getByRole('button', { name: 'Bấm để nói' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '🔊 Đọc câu cho bé nghe' })).toBeInTheDocument()
  // The building tools have done their job and are gone, not merely hidden on a phone.
  expect(screen.queryByTestId('pool')).not.toBeInTheDocument()
  expect(screen.queryByText('🟦 Ai?')).not.toBeInTheDocument()
})

it('shows the missing-audio notice when the sample fails to play', async () => {
  playerMock.playUrl.mockImplementationOnce(() => Promise.reject(new Error('no audio')))
  renderBuilder('s1')
  await tapInCorrectOrder('s1')
  await waitFor(() => expect(screen.getByText('Chưa có audio mẫu')).toBeInTheDocument())
})

// --- the iPad mic-from-the-start (R19) ---------------------------------------------------------

it('shows a disabled iPad mic with its own caption before the sentence is built, hidden on a phone', () => {
  renderBuilder('s1')
  const wrapper = screen.getByRole('button', { name: 'Bấm để nói' }).closest('.hidden')!
  expect(wrapper).toHaveClass('hidden', 'md:flex')
  expect(screen.getByRole('button', { name: 'Bấm để nói' })).toBeDisabled()
  expect(screen.getByText('Xếp đúng câu trước nhé')).toBeInTheDocument()
})

it('drops the disabled iPad mic the moment the sentence is built', async () => {
  renderBuilder('s1')
  await tapInCorrectOrder('s1')

  expect(screen.getByRole('button', { name: 'Bấm để nói' })).toBeEnabled()
  expect(screen.queryByText('Xếp đúng câu trước nhé')).not.toBeInTheDocument()
})

// --- recording, dimmed header, chip, countdown row (carrier) ------------------------------------

it('dims the header and swaps the chip while recording', async () => {
  renderBuilder('s1')
  await tapInCorrectOrder('s1')
  startRecording()

  const backCell = screen.getByRole('link', { name: 'Ghép câu' }).closest('div')!
  expect(backCell).toHaveClass('opacity-40', 'pointer-events-none')
  expect(screen.getByTestId('header-right')).toHaveClass('opacity-40', 'pointer-events-none')

  const chip = screen.getByText('● Đang ghi')
  expect(chip).toHaveClass('bg-coral-50', 'text-coral-text')
  expect(screen.queryByText(/^Câu \d/)).not.toBeInTheDocument()
  expect(screen.getByTestId('countdown-row')).toBeInTheDocument()
})

/** Spec decision (brief R23 "Đang chấm"): `processing` reads as an idle mic with an hourglass and
 * nothing else may react to it — no dimmed header, no "Đang ghi" chip, no collapsed strip.
 * Rendered already in `processing` via `mic.initialMicState`, so the tray still has to be built by
 * hand first (a mocked `processing` micState says nothing about the tray). */
it('holds the teach column still while scoring — processing is not recording', async () => {
  mic.initialMicState = 'processing'
  renderBuilder('s1')
  await tapInCorrectOrder('s1')

  expect(screen.getByText('Đúng rồi! 🎉')).toBeInTheDocument()
  const backCell = screen.getByRole('link', { name: 'Ghép câu' }).closest('div')!
  expect(backCell).not.toHaveClass('opacity-40')
  expect(screen.getByTestId('header-right')).not.toHaveClass('opacity-40')
  expect(screen.queryByText('● Đang ghi')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /đang chấm/i })).toBeInTheDocument()
})

// --- result: ScoredWords in the tray (never a strip), no words on ResultCard, four bars, hint ---

it('a spoken score of 85 shows 3 filled stars, stores sentence:s1 = 3, and logs a sentence activity event', async () => {
  renderBuilder('s1')
  await tapInCorrectOrder('s1')
  const blob = new Blob(['x'])
  score(result85, blob)

  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)

  const stars = JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')
  expect(stars['sentence:s1']).toBe(3)

  const events = JSON.parse(localStorage.getItem('speakup.activity') ?? '[]')
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({ kind: 'sentence', id: 's1', score: 85 })

  expect(recordingsMock.saveRecording).toHaveBeenCalledWith(
    expect.objectContaining({ id: expect.stringMatching(/^s1:\d+$/), text: 'I eat an apple.', blob }),
  )
})

it('does not save a recording when no blob is available (web speech engine)', async () => {
  renderBuilder('s1')
  await tapInCorrectOrder('s1')
  score(result85, null)

  expect(recordingsMock.saveRecording).not.toHaveBeenCalled()
})

/** R18: the tray region swaps its tiles for `ScoredWords`, in the same order, and the
 * `ResultCard` itself gets no `words` at all — the chips live at the tray's position, not a
 * second time inside the card. */
it('replaces the tray with ScoredWords in the same order, and never repeats the chips on the ResultCard', async () => {
  renderBuilder('s1')
  await tapInCorrectOrder('s1')
  score(result85, null)

  const tray = screen.getByTestId('tray')
  const chips = within(tray).getAllByTestId('word-chip')
  expect(chips.map(c => c.textContent?.replace(/^\W+/, ''))).toEqual(S1_WORDS)
  chips.forEach(c => expect(c).toHaveAttribute('aria-label', expect.stringContaining('đúng')))
  // No stray tile buttons left in the tray once it has become the scored read-out.
  expect(within(tray).queryAllByRole('button')).toHaveLength(0)

  const card = screen.getByTestId('result-card')
  expect(within(card).queryAllByTestId('word-chip')).toHaveLength(0)
  const rows = Array.from(card.children).map(c => c.getAttribute('data-row'))
  expect(rows).toEqual(['head', 'bars', 'listen', 'fox', 'cta'])
})

it('offers a hint when the attempt was weak', async () => {
  renderBuilder('s1')
  await tapInCorrectOrder('s1')
  score(resultFor(S1_WORDS, 40), null)

  expect(screen.getAllByTestId('star-filled')).toHaveLength(1)
  expect(screen.getByTestId('result-card').querySelector('[data-row="hint"]')).toBeInTheDocument()
})

/** `docs/design/current/shoot.mjs`'s `sentence-result3` lands on `?fixture=result3`, which
 * `useSpeakingAttempt` turns into a scored result before the tray was ever built by hand — the
 * screen has to treat that as "the tray is correct" too, or the result and an untouched tray would
 * contradict each other on screen. This mock stands that in with `initialResult`. */
it('treats an attempt that already has a result as the tray already built (DEV fixture)', () => {
  mic.initialResult = result85
  renderBuilder('s1')

  expect(screen.getByTestId('result-card')).toBeInTheDocument()
  const tray = screen.getByTestId('tray')
  expect(within(tray).getAllByTestId('word-chip')).toHaveLength(S1_WORDS.length)
  // The building tools must not sit next to a result nobody earned by building anything.
  expect(screen.queryByTestId('pool')).not.toBeInTheDocument()
  expect(screen.queryByText('🟦 Ai?')).not.toBeInTheDocument()
})

/** Fix round 1, D1: unlike every other round-2 screen, `ScoredWords` lives *inside* the teach
 * column (the tray), not `ResultCard` — so C9 must never collapse the teach column to a
 * tap-to-expand strip the way Pair/Star do, or the only place the scored words render would be
 * hidden behind a tap on phone/short/iPad-portrait. The correct-banner and the sample button are
 * the other half of the teach column and stay hidden once a result exists — the ResultCard's own
 * listen row covers listening from here on. */
it('keeps ScoredWords visible on the default render once a result lands — never a collapsed strip', async () => {
  renderBuilder('s1')
  await tapInCorrectOrder('s1')
  score(result85, null)

  const tray = screen.getByTestId('tray')
  expect(within(tray).getAllByTestId('word-chip')).toHaveLength(S1_WORDS.length)
  expect(screen.queryByRole('button', { name: /mở/i })).not.toBeInTheDocument()
  expect(screen.queryByText('Đúng rồi! 🎉')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '🔊 Đọc câu cho bé nghe' })).not.toBeInTheDocument()
})

it('"Thử lại" resets the spoken attempt and brings the correct tray, the banner and the sample button back', async () => {
  renderBuilder('s1')
  await tapInCorrectOrder('s1')
  score(result85, null)

  fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }))

  expect(screen.getByRole('button', { name: 'Bấm để nói' })).toBeInTheDocument()
  expect(screen.getByText('Đúng rồi! 🎉')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '🔊 Đọc câu cho bé nghe' })).toBeInTheDocument()
  const tray = screen.getByTestId('tray')
  expect(within(tray).getAllByRole('button')).toHaveLength(S1_WORDS.length)
  expect(within(tray).queryAllByTestId('word-chip')).toHaveLength(0)
})

// --- "Tiếp theo" — flat list vs. inside a topic (R20) -------------------------------------------

it('"Tiếp theo" goes to the next sentence in SENTENCES order without a topic in the URL', async () => {
  renderBuilder('s1')
  await tapInCorrectOrder('s1')
  score(result85, null)
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  const sentence2 = findSentence('s2')!
  expect(screen.getByText(sentence2.vi)).toBeInTheDocument()
})

it('"Tiếp theo" goes back to the sentence list from the last sentence, without a topic in the URL', async () => {
  const lastId = SENTENCES[SENTENCES.length - 1].id
  renderBuilder(lastId)
  await tapInCorrectOrder(lastId)
  score(resultFor(findSentence(lastId)!.words), null)
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  expect(screen.getByText('Danh sách câu')).toBeInTheDocument()
})

it('numbers itself and steps to the next sentence inside the topic when the route carries ?topic=', async () => {
  renderBuilder('s1', { topic: 'food' }) // food has s1..s4
  expect(screen.getByText('Câu 1/4')).toBeInTheDocument()

  await tapInCorrectOrder('s1')
  score(result85, null)
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  expect(screen.getByText('Câu 2/4')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Ghép câu/ })).toHaveAttribute('href', '/sentences?topic=food')
})

it('lands on the topic list, not the flat one, after the last sentence of the topic', async () => {
  renderBuilder('s4', { topic: 'food' }) // last of food
  await tapInCorrectOrder('s4')
  score(resultFor(findSentence('s4')!.words), null)
  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))

  expect(screen.getByText('Danh sách câu')).toBeInTheDocument()
})

it('numbers itself inside the flat list when the URL carries no ?topic=, even for a sentence that has one', () => {
  renderBuilder('s5')
  const flatIndex = SENTENCES.findIndex(s => s.id === 's5')
  expect(screen.getByText(`Câu ${flatIndex + 1}/${SENTENCES.length}`)).toBeInTheDocument()
})

// --- the phone frame (phase 10 final review, C2) ----------------------------------------------
//
// jsdom has no layout, so these assert the one thing that decides the layout: which breakpoint
// each rule is written at.

const main = () => document.querySelector('main')!

it('frames itself with the safe-area page shell, resting on the padding it always had', () => {
  renderBuilder('s1')

  const shell = main().className
  expect(shell).toContain('pt-[max(var(--page-pad-top,1.5rem),calc(env(safe-area-inset-top)_+_8px))]')
  expect(shell).toContain('pb-[max(var(--page-pad-bottom,1.5rem),calc(env(safe-area-inset-bottom)_+_10px))]')
  expect(shell).toContain('[--page-pad-top:1.25rem]')
  expect(shell).toContain('[--page-pad-bottom:1.25rem]')
  expect(shell).toContain('px-5')
  expect(shell).toContain('md:px-6')
})

/** The CTAs live inside `ResultCard`, never a pinned overlay that would paint over whatever sits
 * at its y — `ResultCard`'s own suite covers the row's own layout, so this only has to guard that
 * nothing on this screen resurrects a sticky panel. */
it('carries the PageShell frame, never a sticky panel', async () => {
  renderBuilder('s1')
  await tapInCorrectOrder('s1')
  score(result85, null)

  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
  expect(document.querySelector('main')!.innerHTML).not.toContain('sticky')
})

/** The mic block and the `ResultCard` occupy the same `act` slot of the split body, so a score
 * swaps one for the other outright — never a phone-only `max-md:hidden` sibling. */
it('swaps the speaking row for the ResultCard once a score is in', async () => {
  renderBuilder('s1')
  await tapInCorrectOrder('s1')

  expect(screen.getByRole('button', { name: 'Bấm để nói' })).toBeInTheDocument()
  expect(screen.queryByTestId('result-card')).not.toBeInTheDocument()
})

// --- as a step of today's lesson (spec §3) ---------------------------------------------------

it('numbers itself inside the lesson and threads back to the mission', () => {
  seedLesson(SENTENCE_STEP, NEXT_STEP)
  renderBuilder('s1', { mission: true })

  expect(screen.getByText('Câu 1/2')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nhiệm vụ' })).toHaveAttribute('href', '/mission')
})

/** Reached from the 🔁 group the number counts inside review, so "Câu 1/1" would name a group this
 * step is not in. */
it('calls itself a review when the lesson filed it under 🔁', () => {
  seedLesson(step('s1', '/sentence/s1', 'review'), NEXT_STEP)
  renderBuilder('s1', { mission: true })

  expect(screen.getByText('Ôn tập 1/1')).toBeInTheDocument()
  expect(screen.queryByText(/^Câu \d/)).not.toBeInTheDocument()
})

it('hands on to the next step of the lesson, still carrying the flag', async () => {
  seedLesson(SENTENCE_STEP, NEXT_STEP)
  renderBuilder('s1', { mission: true })
  await tapInCorrectOrder('s1')
  score(result85, null)

  fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/words/food/food-apple {"mission":true}')
})

it('ends at the mission screen when it is the last step of the lesson', async () => {
  seedLesson(SENTENCE_STEP)
  renderBuilder('s1', { mission: true })
  await tapInCorrectOrder('s1')
  score(result85, null)

  // The last step of the lesson says so — the CTA is not "Tiếp theo" any more.
  fireEvent.click(screen.getByRole('button', { name: /Hoàn thành/ }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/mission null')
})

/** Today's lesson may well list this very sentence — but a child who walked in from the list did
 * not arrive carrying the flag, and nothing about the screen may change for them: the chip counts
 * inside the flat list (or the topic), never inside today's 2-step lesson. */
it('stays a free-play sentence without the flag, lesson or no lesson', () => {
  seedLesson(SENTENCE_STEP, NEXT_STEP)
  renderBuilder('s1')

  expect(screen.queryByText('Câu 1/2')).not.toBeInTheDocument()
  const flatIndex = SENTENCES.findIndex(s => s.id === 's1')
  expect(screen.getByText(`Câu ${flatIndex + 1}/${SENTENCES.length}`)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Ghép câu/ })).toHaveAttribute('href', '/sentences?topic=food')
})
