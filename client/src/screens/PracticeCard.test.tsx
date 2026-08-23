import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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

const soundZooCards = LEVELS.find(l => l.id === 'sound-zoo')!.cards
const wordPopCards = LEVELS.find(l => l.id === 'word-pop')!.cards

/** The level route is stubbed rather than pulling in LevelSelect: these tests only care that
 * "Hoàn thành 🎉" lands back on the level the card belongs to. */
function renderCard(cardId = 'sz-th-three') {
  render(
    <MemoryRouter initialEntries={[`/practice/${cardId}`]}>
      <Routes>
        <Route path="/practice/:cardId" element={<PracticeCard />} />
        <Route path="/level/:levelId" element={<p>danh sách thẻ</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Records one attempt and waits for the 3-star result, which is what reveals the next/finish CTA. */
async function scoreOnce() {
  await waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled())
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
  await waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled())
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
it('drops the per-card dots on a level too long to show them', () => {
  renderCard() // sz-th-three: 27 cards
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
    scorerControl.queue.push({ engine: 'webspeech', scorer })
    renderCard()
    await waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled())
    expect(screen.getByText('chế độ đơn giản')).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i }))
    expect(scorer.start).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /dừng/i })).toBeInTheDocument() // wsRecording drives the mic button
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })

    expect(screen.getAllByTestId('star-filled')).toHaveLength(3)
    expect(recorderControl.start).not.toHaveBeenCalled()
    expect(scorer.score).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /nghe mình/i })).not.toBeInTheDocument()
  })

  it('explains that the browser lacks speech recognition instead of blaming the mic', async () => {
    scorerControl.queue.push({ engine: 'webspeech', scorer: webSpeechScorer() })
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
    fireEvent.click(screen.getByRole('button', { name: /dừng/i }))
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

  it('keeps the per-card dots for a 12-card level', () => {
    renderCard(card.id)
    const dots = screen.getByTestId('card-dots')
    expect(wordPopCards.length).toBeLessThanOrEqual(12)
    expect(dots.children).toHaveLength(wordPopCards.length)
  })

  it('leaves Sound Zoo cards unchanged: IPA visible, no streak slots', async () => {
    renderCard() // default sz-th-three
    expect(screen.getByText(soundZooCards[0].ipa)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xem phiên âm' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Lần 1/2')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Lần 2/2')).not.toBeInTheDocument()
  })
})
