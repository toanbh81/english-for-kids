import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useState } from 'react'

const recorderControl = vi.hoisted(() => ({ shouldFailStart: false, start: vi.fn() }))
/** Queue of results for successive createScorer() calls; empty falls back to the default Azure stub. */
const scorerControl = vi.hoisted(() => ({ queue: [] as { engine: string; scorer: unknown }[] }))

vi.mock('../audio/recorder', () => ({
  useRecorder: () => {
    const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle')
    return {
      state,
      level: 0,
      start: vi.fn(async () => {
        recorderControl.start()
        if (recorderControl.shouldFailStart) throw new Error('mic denied')
        setState('recording')
      }),
      stop: vi.fn(async () => { setState('idle'); return new Blob() }),
    }
  },
}))
const playerControl = vi.hoisted(() => ({ playUrl: vi.fn() }))
vi.mock('../audio/player', () => ({ playUrl: playerControl.playUrl, playBlob: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../scoring/createScorer', () => ({
  createScorer: async () => scorerControl.queue.shift() ?? ({
    engine: 'azure',
    scorer: {
      score: async () => ({
        overall: 85, accuracy: 85, fluency: 90, completeness: 100, engine: 'azure',
        words: [{ word: 'three', score: 85, errorType: 'None', phonemes: [] }],
      }),
    },
  }),
}))
import { PracticeCard } from './PracticeCard'
import { LEVELS } from '../content'
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

/** Today's lesson, written straight to storage, so the screen counts real steps. This file keeps
 * the activity log between tests (the scorer stubs are what it resets), and a lesson step counts
 * as done from any attempt logged after it — so the log is cleared with the lesson it belongs to,
 * or an earlier test's `three` would arrive having already finished today's /sound/th. */
function seedLesson(...items: LessonItem[]) {
  const now = Date.now()
  localStorage.removeItem('speakup.activity')
  saveLesson({ day: dayKey(now), created: now, band: 5, items })
}

const CARD_STEP = step('sz-th-three', '/practice/sz-th-three')
const NEXT_STEP = step('th', '/sound/th')

const soundZooCards = LEVELS.find(l => l.id === 'sound-zoo')!.cards
const wordPopCards = LEVELS.find(l => l.id === 'word-pop')!.cards

/** The level route is stubbed rather than pulling in LevelSelect: these tests only care that
 * "Hoàn thành 🎉" lands back on the level the card belongs to. */
function renderCard(cardId = 'sz-th-three', mission = false) {
  render(
    <MemoryRouter initialEntries={[{ pathname: `/practice/${cardId}`, state: mission ? { mission: true } : null }]}>
      <Routes>
        <Route path="/practice/:cardId" element={<PracticeCard />} />
        <Route path="/level/:levelId" element={<p>danh sách thẻ</p>} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** The card mints its scorer asynchronously, so an enabled mic is what "this card has settled"
 * looks like. Even a test that never records has to wait for it, or the state update lands after
 * the test body and React reports it as happening outside act(). */
const scorerReady = () => waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled())

/** Records one attempt and waits for the 3-star result, which is what reveals the next/finish CTA. */
async function scoreOnce() {
  await scorerReady()
  fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i }))
  await waitFor(() => expect(screen.getByRole('button', { name: /dừng/i })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /dừng/i }))
  await waitFor(() => expect(screen.getAllByTestId('star-filled')).toHaveLength(3))
}

/** Records one Word Pop attempt and waits for `expectedStreak` slots to be filled. The result
 * lands in one render (feedback becomes non-null) and the streak effect chained off it commits
 * a second, separate render — the streak-star count alone can coincidentally already match after
 * the first render (`Math.min(2, feedback.stars)` does not depend on the streak), so waiting on
 * both slots together is what actually pins down the settled, post-effect state. */
async function recordOnce(expectedStreak: 0 | 1 | 2) {
  await scorerReady()
  fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i }))
  await waitFor(() => expect(screen.getByRole('button', { name: /dừng/i })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /dừng/i }))
  await waitFor(() => {
    expect(screen.getByLabelText('Lần 1/2')).toHaveTextContent(expectedStreak >= 1 ? '●' : '○')
    expect(screen.getByLabelText('Lần 2/2')).toHaveTextContent(expectedStreak >= 2 ? '●' : '○')
  })
}

function azureResult(overall: number, word = 'cat') {
  return { overall, accuracy: overall, fluency: overall, completeness: 100, engine: 'azure' as const, words: [{ word, score: overall, errorType: 'None' as const, phonemes: [] }] }
}

beforeEach(() => {
  playerControl.playUrl.mockReset().mockResolvedValue(undefined)
  localStorage.removeItem('speakup.stars')
})

afterEach(() => {
  recorderControl.shouldFailStart = false
  recorderControl.start.mockClear()
  scorerControl.queue.length = 0
  delete (window as any).webkitSpeechRecognition
  vi.useRealTimers()
})

it('shows the word, records, and renders 3 stars', async () => {
  renderCard()
  expect(screen.getByText('three')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled()) // scorer ready
  fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i })) // start
  await waitFor(() => expect(screen.getByRole('button', { name: /dừng/i })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /dừng/i })) // stop
  await waitFor(() => expect(screen.getAllByTestId('star-filled')).toHaveLength(3))
  expect(screen.getByText('Tuyệt vời!')).toBeInTheDocument()
  expect(screen.getAllByTestId('star-filled')[0]).toHaveClass('animate-star-drop') // the stars drop in
})

it('logs a speak activity event after a scored attempt', async () => {
  localStorage.removeItem('speakup.activity')
  renderCard()
  await waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i }))
  await waitFor(() => expect(screen.getByRole('button', { name: /dừng/i })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /dừng/i }))
  await waitFor(() => expect(screen.getAllByTestId('star-filled')).toHaveLength(3))

  const events = JSON.parse(localStorage.getItem('speakup.activity') ?? '[]')
  expect(events).toContainEqual(expect.objectContaining({ kind: 'speak', id: 'sz-th-three' }))
})

it('Tiếp theo goes to the next card of the same level', async () => {
  renderCard()
  await scoreOnce()

  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  await scorerReady() // the next card mints its own scorer

  expect(screen.getByText(soundZooCards[1].text)).toBeInTheDocument() // the 2nd Sound Zoo card
  expect(screen.getByText(`Thẻ 2/${soundZooCards.length}`)).toBeInTheDocument()
})

it('the last card of a level finishes back at the level instead of jumping to the next level', async () => {
  const total = soundZooCards.length
  renderCard(soundZooCards.at(-1)!.id) // last Sound Zoo card
  await scoreOnce()
  expect(screen.getByText(`Thẻ ${total}/${total}`)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /tiếp theo/i })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /hoàn thành/i }))

  // Not Word Pop's first card: the counter says total/total, so the run is over.
  expect(screen.getByText('danh sách thẻ')).toBeInTheDocument()
})

/** The legacy `/practice/sz-*` route still walks all 27 Sound Zoo cards. 27 dots at 16 px + gap
 * is ~640 px of header, which on a portrait iPad squeezed the 66 px back button below a thumb's
 * worth of tap target. Past a dozen cards the "Thẻ n/N" counter carries the position on its own. */
it('drops the per-card dots on a level too long to show them', async () => {
  renderCard() // sz-th-three: 27 cards
  await scorerReady()
  expect(soundZooCards.length).toBeGreaterThan(12)
  expect(screen.getByText(`Thẻ 1/${soundZooCards.length}`)).toBeInTheDocument()
  expect(screen.queryByTestId('card-dots')).not.toBeInTheDocument()
})

it('says the sample audio is missing instead of failing silently', async () => {
  playerControl.playUrl.mockRejectedValue(new Error('audio failed'))
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: /nghe mẫu/i }))
  await screen.findByText('Chưa có audio mẫu')
})

it('shows a friendly error when mic permission is denied', async () => {
  recorderControl.shouldFailStart = true
  renderCard()
  await waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i }))
  await screen.findByText(/cho phép dùng mic/)
})

it('Thử lại clears the result and re-enables the mic', async () => {
  renderCard()
  await waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i }))
  await waitFor(() => expect(screen.getByRole('button', { name: /dừng/i })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /dừng/i }))
  await waitFor(() => expect(screen.getAllByTestId('star-filled')).toHaveLength(3))

  fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))

  expect(screen.queryAllByTestId('star-filled')).toHaveLength(0)
  expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled()
})

it('auto-stops the recording after 6s and still scores', async () => {
  renderCard()
  await waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled()) // scorer ready (real timers)
  vi.useFakeTimers()
  fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i })) // start
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) }) // auto-stop fires and scoring completes
  expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
})

it('counts the recording down from the 6s auto-stop', async () => {
  renderCard()
  await waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled()) // scorer ready (real timers)
  vi.useFakeTimers()
  fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i }))
  await act(async () => { await vi.advanceTimersByTimeAsync(1) }) // recorder.start() resolves -> recording
  expect(screen.getByText('6')).toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(screen.getByText('5')).toBeInTheDocument()
})

describe('Web Speech engine', () => {
  const webSpeechScorer = () => ({
    start: vi.fn(),
    score: vi.fn(async () => ({
      overall: 100, accuracy: 100, fluency: 100, completeness: 100, engine: 'webspeech' as const,
      words: [{ word: 'three', score: 100, errorType: 'None' as const, phonemes: [] }],
    })),
  })

  it('scores via the recognizer without ever starting MediaRecorder', async () => {
    ;(window as any).webkitSpeechRecognition = class {}
    const scorer = webSpeechScorer()
    // Twice: every attempt re-checks Azure first, and the token endpoint is still down here.
    scorerControl.queue.push({ engine: 'webspeech', scorer }, { engine: 'webspeech', scorer })
    renderCard()
    await waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled())
    expect(screen.getByText('chế độ đơn giản')).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i }))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) }) // the re-check resolves
    expect(scorer.start).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /dừng/i })).toBeInTheDocument() // wsRecording drives the mic button
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })

    expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
    expect(recorderControl.start).not.toHaveBeenCalled()
    expect(scorer.score).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /nghe mình/i })).not.toBeInTheDocument()
  })

  it('explains that the browser lacks speech recognition instead of blaming the mic', async () => {
    scorerControl.queue.push({ engine: 'webspeech', scorer: webSpeechScorer() }, { engine: 'webspeech', scorer: webSpeechScorer() })
    renderCard() // no window.webkitSpeechRecognition installed
    await waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i }))
    await screen.findByText('Trình duyệt này chưa hỗ trợ nhận dạng giọng nói')
    expect(screen.queryByText(/cho phép dùng mic/)).not.toBeInTheDocument()
  })
})

describe('expired Azure token', () => {
  const okResult = {
    overall: 85, accuracy: 85, fluency: 90, completeness: 100, engine: 'azure' as const,
    words: [{ word: 'three', score: 85, errorType: 'None' as const, phonemes: [] }],
  }

  async function recordAndStop() {
    await waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /dừng/i })).toBeInTheDocument())
    // Scoring runs entirely on microtasks (stop → score → refresh the token → score again), so
    // the click is awaited inside act(): otherwise the tail of that chain commits between two
    // awaits in the test body, where React cannot see it.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /dừng/i })) })
  }

  it('mints a fresh scorer and retries the score exactly once', async () => {
    const stale = vi.fn().mockRejectedValue(new Error('token expired'))
    const fresh = vi.fn(async () => okResult)
    scorerControl.queue.push({ engine: 'azure', scorer: { score: stale } }, { engine: 'azure', scorer: { score: fresh } })
    renderCard()
    await recordAndStop()
    await waitFor(() => expect(screen.getAllByTestId('star-filled')).toHaveLength(3))
    expect(stale).toHaveBeenCalledTimes(1)
    expect(fresh).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Không nghe rõ/)).not.toBeInTheDocument()
  })

  it('surfaces the friendly error after the single retry also fails, without looping', async () => {
    const stale = vi.fn().mockRejectedValue(new Error('token expired'))
    const fresh = vi.fn().mockRejectedValue(new Error('still expired'))
    scorerControl.queue.push({ engine: 'azure', scorer: { score: stale } }, { engine: 'azure', scorer: { score: fresh } })
    renderCard()
    await recordAndStop()
    await screen.findByText('Không nghe rõ, bé thử lại nhé!')
    expect(stale).toHaveBeenCalledTimes(1)
    expect(fresh).toHaveBeenCalledTimes(1)
  })

  it('does not retry when the refreshed engine is no longer Azure', async () => {
    const stale = vi.fn().mockRejectedValue(new Error('token expired'))
    const wsScore = vi.fn()
    scorerControl.queue.push({ engine: 'azure', scorer: { score: stale } }, { engine: 'webspeech', scorer: { start: vi.fn(), score: wsScore } })
    renderCard()
    await recordAndStop()
    await screen.findByText('Không nghe rõ, bé thử lại nhé!')
    expect(wsScore).not.toHaveBeenCalled()
  })
})

describe('Word Pop: hidden IPA + two-in-a-row streak', () => {
  const card = wordPopCards[0] // wp-cat

  it('hides the IPA behind "Xem phiên âm" until tapped', async () => {
    renderCard(card.id)
    await scorerReady()
    expect(screen.queryByText(card.ipa)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Xem phiên âm' }))

    expect(screen.getByText(card.ipa)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xem phiên âm' })).not.toBeInTheDocument()
  })

  it('two consecutive ≥80 results award 3 stars and fill both streak slots', async () => {
    const score = vi.fn().mockResolvedValueOnce(azureResult(85)).mockResolvedValueOnce(azureResult(90))
    scorerControl.queue.push({ engine: 'azure', scorer: { score } })
    renderCard(card.id)

    await recordOnce(1) // first hit: streak 1/2, capped at 2 stars
    expect(screen.getByLabelText('Lần 1/2')).toHaveTextContent('●')
    expect(screen.getByLabelText('Lần 2/2')).toHaveTextContent('○')
    expect(screen.getAllByTestId('star-filled')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
    await recordOnce(2) // second hit: streak 2/2, wins 3 stars

    expect(screen.getByLabelText('Lần 1/2')).toHaveTextContent('●')
    expect(screen.getByLabelText('Lần 2/2')).toHaveTextContent('●')
    expect(screen.getByText('Nói đúng 2 lần liên tiếp! 🎉')).toBeInTheDocument()
    expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
    const stars = JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')
    expect(stars[card.id]).toBe(3)
  })

  it('an 80 then a 50 clears the streak and keeps stored stars capped at 2', async () => {
    const score = vi.fn().mockResolvedValueOnce(azureResult(85)).mockResolvedValueOnce(azureResult(50))
    scorerControl.queue.push({ engine: 'azure', scorer: { score } })
    renderCard(card.id)

    await recordOnce(1) // first hit: streak 1/2, capped at 2 stars
    expect(screen.getByLabelText('Lần 1/2')).toHaveTextContent('●')

    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }))
    await recordOnce(0) // sub-80: streak clears, single-attempt stars (1) are stored

    expect(screen.getByLabelText('Lần 1/2')).toHaveTextContent('○')
    expect(screen.getByLabelText('Lần 2/2')).toHaveTextContent('○')
    const stars = JSON.parse(localStorage.getItem('speakup.stars') ?? '{}')
    expect(stars[card.id] ?? 0).toBeLessThanOrEqual(2)
  })

  it('keeps the per-card dots for a 12-card level', async () => {
    renderCard(card.id)
    await scorerReady()
    const dots = screen.getByTestId('card-dots')
    expect(wordPopCards.length).toBeLessThanOrEqual(12)
    expect(dots.children).toHaveLength(wordPopCards.length)
  })

  it('leaves Sound Zoo cards unchanged: IPA visible, no streak slots', async () => {
    renderCard() // default sz-th-three
    await scorerReady()
    expect(screen.getByText(soundZooCards[0].ipa)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xem phiên âm' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Lần 1/2')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Lần 2/2')).not.toBeInTheDocument()
  })
})

// --- as a step of today's lesson (spec §3) ---------------------------------------------------

it('numbers itself inside the lesson, drops the level dots, and threads back to the mission', async () => {
  const card = wordPopCards[0]
  seedLesson(step(card.id, `/practice/${card.id}`), NEXT_STEP)
  renderCard(card.id, true)
  await scorerReady()

  expect(screen.getByText('Thẻ 1/2')).toBeInTheDocument()
  // One counter, not two: the level's own position means nothing inside a lesson, dots included.
  expect(screen.queryByText(`Thẻ 1/${wordPopCards.length}`)).not.toBeInTheDocument()
  expect(screen.queryByTestId('card-dots')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nhiệm vụ' })).toHaveAttribute('href', '/mission')
})

/** Reached from the 🔁 group the number counts inside review, and the noun says which group. */
it('calls the step review when the lesson filed it under 🔁', async () => {
  const card = wordPopCards[0]
  seedLesson({ ...step(card.id, `/practice/${card.id}`), kind: 'review' }, NEXT_STEP)
  renderCard(card.id, true)
  await scorerReady()

  expect(screen.getByText('Ôn tập 1/1')).toBeInTheDocument()
  expect(screen.queryByText(/^Thẻ \d/)).not.toBeInTheDocument()
})

it('hands on to the next step of the lesson, still carrying the flag', async () => {
  seedLesson(CARD_STEP, NEXT_STEP)
  renderCard('sz-th-three', true)
  await scoreOnce()

  fireEvent.click(screen.getByRole('button', { name: /tiếp theo/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/sound/th {"mission":true}')
})

it('ends at the mission screen when it is the last step of the lesson', async () => {
  seedLesson(CARD_STEP)
  renderCard('sz-th-three', true)
  await scoreOnce()

  fireEvent.click(screen.getByRole('button', { name: /hoàn thành/i }))
  expect(screen.getByTestId('probe')).toHaveTextContent('/mission null')
})

/** Today's lesson may well list this very card — but a child who walked in from the level did not
 * arrive carrying the flag, and nothing about the screen may change for them. */
it('stays a free-play card without the flag, lesson or no lesson', async () => {
  seedLesson(CARD_STEP, NEXT_STEP)
  renderCard()
  await scorerReady()

  expect(screen.getByText(`Thẻ 1/${soundZooCards.length}`)).toBeInTheDocument()
  expect(screen.queryByText('Thẻ 1/2')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/level/sound-zoo')
})

/** Phase 10: this screen had no phone layout at all — no breakpoint rules and, worse, no
 * `PAGE_SHELL`, so at 390×844 it measured 1156 px with the mic at y938 and its content ran under
 * the notch. jsdom cannot lay that out, so these guard the inputs the measurement depends on. */
it('carries the safe-area shell and its own resting padding', async () => {
  renderCard()
  await scorerReady()

  const shell = document.querySelector('main')!.className
  expect(shell).toContain('pt-[max(var(--page-pad-top,1.5rem),calc(env(safe-area-inset-top)_+_9px))]')
  expect(shell).toContain('pb-[max(var(--page-pad-bottom,1.5rem),calc(env(safe-area-inset-bottom)_+_10px))]')
  // The resting value is the `py-5` this screen has always had, so the iPad is untouched.
  expect(shell).toContain('[--page-pad-top:1.25rem]')
  expect(shell).toContain('[--page-pad-bottom:1.25rem]')
  // …and 20 px of side frame on a phone, the 24 px of the landscape frame from `md` up.
  expect(shell).toContain('px-5')
  expect(shell).toContain('md:px-6')
})

/** The 220 px meaning tile and the 220 px mouth tile are what wrapped to three rows at 390 px and
 * pushed the mic below the fold. Both come down on a phone and both are restored at `md:`. */
it('stacks the deck on a phone and restores the landscape tiles from md up', async () => {
  renderCard()
  await scorerReady()

  const meaning = screen.getByText('nghĩa của từ').closest('div')!
  expect(meaning.className).toContain('h-[96px]')
  expect(meaning.className).toContain('md:h-[220px]')
  expect(meaning.className).toContain('md:w-[220px]')

  const mouth = screen.getByText('Khẩu hình miệng').closest('div')!
  expect(mouth.className).toContain('h-16')
  expect(mouth.className).toContain('md:h-[220px]')
})

/** The result read-out scrolls *inside* a bounded region on a phone, with the CTA row as its
 * sibling underneath — never a `sticky` panel, which would paint over a word chip. `md:contents`
 * is what makes the landscape frame the same flat column it has always been. */
it('gives the phone result a bounded scroller and never a sticky', async () => {
  renderCard()
  await scoreOnce()

  const region = document.querySelector('[class*="md:contents"]')!
  expect(region.className).toContain('max-md:flex-1')
  expect(region.className).toContain('max-md:min-h-0')
  expect(region.className).toContain('max-md:overflow-y-auto')
  expect(document.querySelector('main')!.innerHTML).not.toContain('sticky')
})
