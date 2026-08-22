import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useState } from 'react'

vi.mock('../audio/recorder', () => ({
  useRecorder: () => {
    const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle')
    return {
      state,
      level: 0,
      start: vi.fn(async () => { setState('recording') }),
      stop: vi.fn(async () => { setState('idle'); return new Blob() }),
    }
  },
}))
vi.mock('../audio/player', () => ({ playUrl: vi.fn().mockResolvedValue(undefined), playBlob: vi.fn() }))
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

it('shows the word, records, and renders 3 stars', async () => {
  render(<MemoryRouter initialEntries={['/practice/sz-th-three']}><Routes><Route path="/practice/:cardId" element={<PracticeCard />} /></Routes></MemoryRouter>)
  expect(screen.getByText('three')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: /bấm để nói/i })).toBeEnabled()) // scorer ready
  fireEvent.click(screen.getByRole('button', { name: /bấm để nói/i })) // start
  await waitFor(() => expect(screen.getByRole('button', { name: /dừng/i })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /dừng/i })) // stop
  await waitFor(() => expect(screen.getAllByTestId('star-filled')).toHaveLength(3))
  expect(screen.getByText('Tuyệt vời!')).toBeInTheDocument()
})
