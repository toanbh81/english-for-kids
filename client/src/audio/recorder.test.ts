import { pickMimeType } from './recorder'

it('prefers audio/mp4 when supported, else webm', () => {
  const orig = globalThis.MediaRecorder
  ;(globalThis as any).MediaRecorder = { isTypeSupported: (t: string) => t === 'audio/mp4' }
  expect(pickMimeType()).toBe('audio/mp4')
  ;(globalThis as any).MediaRecorder = { isTypeSupported: (t: string) => t === 'audio/webm' }
  expect(pickMimeType()).toBe('audio/webm')
  ;(globalThis as any).MediaRecorder = orig
})
