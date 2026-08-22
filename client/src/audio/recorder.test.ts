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

  afterEach(() => {
    ;(globalThis as any).MediaRecorder = origMediaRecorder
    ;(globalThis as any).AudioContext = origAudioContext
    ;(navigator as any).mediaDevices = origMediaDevices
    globalThis.requestAnimationFrame = origRAF
    globalThis.cancelAnimationFrame = origCAF
  })

  it('ignores a second start() call while already recording', async () => {
    class FakeMediaRecorder {
      state: 'inactive' | 'recording' = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable: ((e: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      static isTypeSupported() { return true }
      start() { this.state = 'recording' }
      stop() { this.state = 'inactive'; this.onstop?.() }
    }
    class FakeAudioContext {
      close = vi.fn().mockResolvedValue(undefined)
      createMediaStreamSource() { return { connect: () => {} } }
      createAnalyser() {
        return { fftSize: 0, connect: () => {}, frequencyBinCount: 32, getByteTimeDomainData: () => {} }
      }
    }
    const fakeStream = { getTracks: () => [] }
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream)

    ;(globalThis as any).MediaRecorder = FakeMediaRecorder
    ;(globalThis as any).AudioContext = FakeAudioContext
    ;(navigator as any).mediaDevices = { getUserMedia }
    globalThis.requestAnimationFrame = vi.fn(() => 0) as unknown as typeof requestAnimationFrame
    globalThis.cancelAnimationFrame = vi.fn() as unknown as typeof cancelAnimationFrame

    const { result } = renderHook(() => useRecorder({ maxMs: 999999 }))

    await act(async () => {
      await result.current.start()
      await result.current.start()
    })

    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })
})
