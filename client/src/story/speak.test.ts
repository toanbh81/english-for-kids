import { speakText } from './speak'

type SynthWindow = { SpeechSynthesisUtterance?: unknown }

const originalSynth = window.speechSynthesis
const originalUtterance = (window as unknown as SynthWindow).SpeechSynthesisUtterance

function stubUtterance() {
  ;(window as unknown as SynthWindow).SpeechSynthesisUtterance = class {
    lang = ''
    text: string
    constructor(text: string) {
      this.text = text
    }
  }
}

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(window, 'speechSynthesis', { value: originalSynth, configurable: true, writable: true })
  ;(window as unknown as SynthWindow).SpeechSynthesisUtterance = originalUtterance
})

it('cancels, then speaks the text in en-US on the next task', () => {
  vi.useFakeTimers()
  const synth = { cancel: vi.fn(), speak: vi.fn() }
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true, writable: true })
  stubUtterance()

  speakText('Foxy')
  expect(synth.cancel).toHaveBeenCalledTimes(1)
  // WebKit drops an utterance queued in the same task as cancel(), hence the deferral.
  expect(synth.speak).not.toHaveBeenCalled()

  vi.advanceTimersByTime(0)
  expect(synth.speak).toHaveBeenCalledTimes(1)
  const u = synth.speak.mock.calls[0][0] as SpeechSynthesisUtterance
  expect(u.text).toBe('Foxy')
  expect(u.lang).toBe('en-US')
})

it('is a no-op when the browser has no speech synthesis', () => {
  Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true, writable: true })
  stubUtterance()
  expect(() => speakText('Foxy')).not.toThrow()
})
