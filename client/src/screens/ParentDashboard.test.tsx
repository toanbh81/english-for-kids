import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import type { ActivityEvent } from '../progress/activity'
import { getBand } from '../progress/band'
import { getLessonLength } from '../progress/lesson'
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

  it('returns to the gate when "Khoá lại" is clicked', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // a = 3, b = 3 -> product 9
    renderWithRouter(<ParentGate />)

    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
    await screen.findByText('Phút luyện mỗi ngày (14 ngày)')

    fireEvent.click(screen.getByRole('button', { name: /Khoá lại/ }))

    expect(screen.getByLabelText('Đáp án')).toBeInTheDocument()
    expect(screen.queryByText('Phút luyện mỗi ngày (14 ngày)')).not.toBeInTheDocument()
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

  it('renders the weekly summary line from minutesPerDay(7) and averageScoreByKind', async () => {
    vi.useFakeTimers({ now: NOW })
    seedActivity([{ ts: NOW, kind: 'speak', id: 'w1', score: 80 }])

    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Tuần này: 1 phút luyện · điểm phát âm trung bình 80/100')).toBeInTheDocument()
  })

  it('shows a dash for the average score in the summary line when there is no data', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Tuần này: 0 phút luyện · điểm phát âm trung bình —/100')).toBeInTheDocument()
  })

  it('shows the target line label at the current daily limit', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getByText('Mục tiêu 20 phút/ngày')).toBeInTheDocument()
  })

  it('persists a limit chip click', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: '30 phút' }))

    expect(localStorage.getItem('speakup.limit.minutes')).toBe('30')
    expect(screen.getByText('Mục tiêu 30 phút/ngày')).toBeInTheDocument()
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

  it('clears the lesson and band stores too, so nothing survives the reset', async () => {
    localStorage.setItem('speakup.lesson.2026-08-23', JSON.stringify({ v: 1, day: '2026-08-23', created: NOW, band: 4, items: [] }))
    localStorage.setItem('speakup.lesson.length', 'long')
    localStorage.setItem('speakup.band', JSON.stringify({ value: 4, mode: 'manual' }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại tiến trình' }))

    await waitFor(() => expect(localStorage.getItem('speakup.band')).toBeNull())
    expect(localStorage.getItem('speakup.lesson.2026-08-23')).toBeNull()
    expect(localStorage.getItem('speakup.lesson.length')).toBeNull()
    // …and the card shows what the next read will find, without writing the keys back.
    expect(screen.getByRole('button', { name: 'Bậc 1' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Tự động' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vừa ~12 phút' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('speakup.band')).toBeNull()
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

  it('renders the current band and lesson length highlighted on mount', async () => {
    localStorage.setItem('speakup.band', JSON.stringify({ value: 3, mode: 'manual' }))
    localStorage.setItem('speakup.lesson.length', 'long')

    renderWithRouter(<ParentDashboard />)
    await flush()

    expect(screen.getByRole('button', { name: 'Bậc 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bậc 1' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Tự động' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Dài ~18 phút' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vừa ~12 phút' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('pressing a band button persists the value and switches to manual mode', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Bậc 4' }))

    expect(getBand()).toEqual({ value: 4, mode: 'manual' })
    expect(screen.getByRole('button', { name: 'Bậc 4' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Tự động' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggling "Tự động" back on resumes auto mode from the current band value', async () => {
    localStorage.setItem('speakup.band', JSON.stringify({ value: 2, mode: 'manual' }))

    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Tự động' }))

    expect(getBand()).toEqual({ value: 2, mode: 'auto' })
    expect(screen.getByRole('button', { name: 'Tự động' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bậc 2' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('pressing a length chip persists the lesson length', async () => {
    renderWithRouter(<ParentDashboard />)
    await flush()

    fireEvent.click(screen.getByRole('button', { name: 'Ngắn ~8 phút' }))

    expect(getLessonLength()).toBe('short')
    expect(screen.getByRole('button', { name: 'Ngắn ~8 phút' })).toHaveAttribute('aria-pressed', 'true')
  })
})
