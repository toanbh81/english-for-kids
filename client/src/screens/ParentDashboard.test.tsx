import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import type { ActivityEvent } from '../progress/activity'
import type { Recording } from '../progress/recordings'

// The recordings store round-trips Blobs through IndexedDB via structuredClone, which jsdom's
// Blob implementation does not survive (see recordings.test.ts, which runs under the node
// environment for that reason). ParentDashboard needs jsdom for React rendering, so the
// recordings module is mocked here instead of seeding real IndexedDB data.
const playerMock = vi.hoisted(() => ({ playBlob: vi.fn(() => Promise.resolve()) }))
vi.mock('../audio/player', () => playerMock)

const recordingsMock = vi.hoisted(() => ({
  listRecordings: vi.fn<() => Promise<Recording[]>>(() => Promise.resolve([])),
  clearRecordings: vi.fn(() => Promise.resolve()),
}))
vi.mock('../progress/recordings', () => recordingsMock)

import { ParentGate } from './ParentGate'
import { ParentDashboard } from './ParentDashboard'

const FLAG_KEY = 'speakup.parent'

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

/** Flush the microtask queue (e.g. the mocked listRecordings promise) inside act so the
 * resulting state update doesn't trigger an "update not wrapped in act" warning later. */
async function flush() {
  await act(async () => { await Promise.resolve() })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  playerMock.playBlob.mockClear()
  recordingsMock.listRecordings.mockReset()
  recordingsMock.listRecordings.mockResolvedValue([])
  recordingsMock.clearRecordings.mockReset()
  recordingsMock.clearRecordings.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('ParentGate', () => {
  it('rejects a wrong product and accepts the right one', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // a = 3, b = 3 -> product 9
    renderWithRouter(<ParentGate />)

    expect(screen.getByText('3 × 3 = ?')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
    expect(screen.getByText('Chưa đúng, thử lại')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))

    await screen.findByText('Phút luyện mỗi ngày (14 ngày)')
    expect(Number(sessionStorage.getItem(FLAG_KEY))).toBeGreaterThan(Date.now() - 1000)
  })

  it('submits and opens the dashboard when Enter is pressed with the right answer', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // a = 3, b = 3 -> product 9
    renderWithRouter(<ParentGate />)

    const input = screen.getByLabelText('Đáp án')
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.submit(input.closest('form')!)

    await screen.findByText('Phút luyện mỗi ngày (14 ngày)')
    expect(Number(sessionStorage.getItem(FLAG_KEY))).toBeGreaterThan(Date.now() - 1000)
  })

  it('skips the gate and shows the dashboard when the session flag is fresh', async () => {
    sessionStorage.setItem(FLAG_KEY, String(Date.now()))
    renderWithRouter(<ParentGate />)

    await screen.findByText('Phút luyện mỗi ngày (14 ngày)')
    expect(screen.queryByLabelText('Đáp án')).not.toBeInTheDocument()
  })

  it('asks the question again when the session flag is older than 10 minutes', () => {
    sessionStorage.setItem(FLAG_KEY, String(Date.now() - 10 * 60 * 1000 - 1))
    renderWithRouter(<ParentGate />)

    expect(screen.getByLabelText('Đáp án')).toBeInTheDocument()
    expect(screen.queryByText('Phút luyện mỗi ngày (14 ngày)')).not.toBeInTheDocument()
  })

  it('asks the question again when the session flag is not a timestamp', () => {
    sessionStorage.setItem(FLAG_KEY, '1')
    renderWithRouter(<ParentGate />)

    expect(screen.getByLabelText('Đáp án')).toBeInTheDocument()
  })

  it('clears the session flag on unmount so leaving /parent re-locks the gate', async () => {
    sessionStorage.setItem(FLAG_KEY, String(Date.now()))
    const { unmount } = renderWithRouter(<ParentGate />)
    await screen.findByText('Phút luyện mỗi ngày (14 ngày)')

    unmount()

    expect(sessionStorage.getItem(FLAG_KEY)).toBeNull()
  })
})

describe('ParentDashboard', () => {
  const NOW = new Date('2026-08-23T10:00:00').getTime()

  function seedActivity(events: ActivityEvent[]) {
    localStorage.setItem('speakup.activity', JSON.stringify(events))
  }

  it('renders exactly 14 minute bars and lists the weakest phoneme first', async () => {
    vi.useFakeTimers({ now: NOW })
    seedActivity([
      { ts: NOW, kind: 'speak', id: 'w1', score: 80, phonemes: [{ phoneme: 'th', score: 30 }] },
      { ts: NOW, kind: 'speak', id: 'w2', score: 80, phonemes: [{ phoneme: 'th', score: 40 }] },
      { ts: NOW, kind: 'speak', id: 'w3', score: 80, phonemes: [{ phoneme: 'r', score: 70 }] },
      { ts: NOW, kind: 'speak', id: 'w4', score: 80, phonemes: [{ phoneme: 'r', score: 80 }] },
    ])

    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getAllByTestId('minute-bar')).toHaveLength(14)

    const phonemeRows = screen.getAllByText(/— trung bình/)
    expect(phonemeRows[0]).toHaveTextContent('/th/')
    expect(phonemeRows[0]).toHaveTextContent('trung bình 35 (2 lần)')
  })

  it('shows the "chưa đủ dữ liệu" empty state when there is no phoneme data', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Chưa đủ dữ liệu')).toBeInTheDocument()
  })

  it('a recording row plays through the mocked playBlob when tapped', async () => {
    const blob = new Blob(['x'])
    recordingsMock.listRecordings.mockResolvedValue([
      { id: 'r1', ts: new Date('2026-08-20T09:05:00').getTime(), text: 'apple', blob },
    ])

    renderWithRouter(<ParentDashboard />)

    const playButton = await screen.findByRole('button', { name: 'Phát' })
    fireEvent.click(playButton)

    expect(playerMock.playBlob).toHaveBeenCalledWith(blob)
  })

  it('persists a daily limit change to localStorage, clamped to the 5-60 range', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '999' } })

    expect(localStorage.getItem('speakup.limit.minutes')).toBe('60')
  })

  it('re-syncs the displayed limit to the clamped stored value on blur', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '999' } })
    expect(input).toHaveValue(999)

    fireEvent.blur(input)
    expect(input).toHaveValue(60)
  })

  it('resets progress and clears speakup.stars after the confirm dialog is accepted', async () => {
    localStorage.setItem('speakup.stars', JSON.stringify({ a: 3 }))
    localStorage.setItem('speakup.activity', JSON.stringify([{ ts: NOW, kind: 'speak', id: 'w1', score: 80 }]))
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))

    await waitFor(() => expect(localStorage.getItem('speakup.stars')).toBeNull())
    expect(localStorage.getItem('speakup.activity')).toBeNull()
    expect(recordingsMock.clearRecordings).toHaveBeenCalled()
  })

  it('does not reset progress when the confirm dialog is dismissed', async () => {
    localStorage.setItem('speakup.stars', JSON.stringify({ a: 3 }))
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))

    expect(localStorage.getItem('speakup.stars')).not.toBeNull()
    expect(recordingsMock.clearRecordings).not.toHaveBeenCalled()
  })
})
