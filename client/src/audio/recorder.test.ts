import { renderHook, act } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { pickMimeType, useRecorder } from './recorder'

it('prefers audio/mp4 when supported, else webm', () => {
  const orig = globalThis.MediaRecorder
  ;(globalThis as any).MediaRecorder = { isTypeSupported: (t: string) => t === 'audio/mp4' }
  expect(pickMimeType()).toBe('audio/mp4')
  ;(globalThis as any).MediaRecorder = { isTypeSupported: (t: string) => t === 'audio/webm' }
  expect(pickMimeType()).toBe('audio/webm')
  ;(globalThis as any).MediaRecorder = orig
})

describe('useRecorder start() re-entrancy', () => {
  const origMediaRecorder = globalThis.MediaRecorder
  const origAudioContext = (globalThis as any).AudioContext
  const origMediaDevices = (navigator as any).mediaDevices
  const origRAF = globalThis.requestAnimationFrame
  const origCAF = globalThis.cancelAnimationFrame

  class FakeMediaRecorder {
    state: 'inactive' | 'recording' = 'inactive'
    mimeType = 'audio/webm'
    ondataavailable: ((e: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null
    static isTypeSupported() { return true }
    start() { this.state = 'recording' }
    stop() { this.state = 'inactive'; this.onstop?.() }
  }
  const contexts: FakeAudioContext[] = []
  class FakeAudioContext {
    close = vi.fn().mockResolvedValue(undefined)
    resume = vi.fn().mockResolvedValue(undefined)
    constructor() { contexts.push(this) }
    createMediaStreamSource() { return { connect: () => {} } }
    createAnalyser() {
      return { fftSize: 0, connect: () => {}, frequencyBinCount: 32, getByteTimeDomainData: () => {} }
    }
  }

  function install(getUserMedia: ReturnType<typeof vi.fn>) {
    ;(globalThis as any).MediaRecorder = FakeMediaRecorder
    ;(globalThis as any).AudioContext = FakeAudioContext
    ;(navigator as any).mediaDevices = { getUserMedia }
    globalThis.requestAnimationFrame = vi.fn(() => 0) as unknown as typeof requestAnimationFrame
    globalThis.cancelAnimationFrame = vi.fn() as unknown as typeof cancelAnimationFrame
  }

  afterEach(() => {
    ;(globalThis as any).MediaRecorder = origMediaRecorder
    ;(globalThis as any).AudioContext = origAudioContext
    ;(navigator as any).mediaDevices = origMediaDevices
    globalThis.requestAnimationFrame = origRAF
    globalThis.cancelAnimationFrame = origCAF
  })

  it('ignores a second start() call while already recording', async () => {
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] })
    install(getUserMedia)

    const { result } = renderHook(() => useRecorder({ maxMs: 999999 }))

    await act(async () => {
      await result.current.start()
      await result.current.start()
    })

    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('ignores a second start() issued while the first is still awaiting getUserMedia', async () => {
    // Double-tap: both taps land before the permission promise settles, so rec.current is
    // still null when the second start() runs — only the `starting` guard can stop it.
    let release: ((s: unknown) => void) | null = null
    const getUserMedia = vi.fn(() => new Promise(res => { release = res }))
    install(getUserMedia)

    const { result } = renderHook(() => useRecorder({ maxMs: 999999 }))

    await act(async () => {
      const first = result.current.start()
      const second = result.current.start()
      expect(release).not.toBeNull()
      release!({ getTracks: () => [] })
      await Promise.all([first, second])
    })

    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('stops the stream, the level meter and the recorder on unmount', async () => {
    const track = { stop: vi.fn() }
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [track] })
    install(getUserMedia)
    contexts.length = 0

    const { result, unmount } = renderHook(() => useRecorder({ maxMs: 999999 }))
    await act(async () => { await result.current.start() })

    expect(track.stop).not.toHaveBeenCalled()
    unmount()

    expect(track.stop).toHaveBeenCalled()
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled()
    expect(contexts).toHaveLength(1)
    expect(contexts[0].close).toHaveBeenCalled()
  })
})
