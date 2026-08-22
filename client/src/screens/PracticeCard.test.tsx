import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useState } from 'react'

const recorderControl = vi.hoisted(() => ({ shouldFailStart: false }))

vi.mock('../audio/recorder', () => ({
  useRecorder: () => {
    const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle')
    return {
      state,
      level: 0,
      start: vi.fn(async () => {
        if (recorderControl.shouldFailStart) throw new Error('mic denied')
        setState('recording')
      }),
      stop: vi.fn(async () => { setState('idle'); return new Blob() }),
    }
  },
}))
vi.mock('../audio/player', () => ({ playUrl: vi.fn().mockResolvedValue(undefined), playBlob: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../scoring/createScorer', () => ({
  createScorer: async () => ({
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

function renderCard() {
  render(<MemoryRouter initialEntries={['/practice/sz-th-three']}><Routes><Route path="/practice/:cardId" element={<PracticeCard />} /></Routes></MemoryRouter>)
}

afterEach(() => {
  recorderControl.shouldFailStart = false
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
