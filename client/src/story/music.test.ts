import { getMusicPref, setMusicPref, BackgroundMusic } from './music'

afterEach(() => {
  localStorage.clear()
  // @ts-expect-error test-only cleanup of a global stubbed per test
  delete globalThis.AudioContext
})

it('defaults to true when nothing is stored', () => {
  expect(getMusicPref()).toBe(true)
})

it('setMusicPref persists the preference', () => {
  setMusicPref(false)
  expect(getMusicPref()).toBe(false)
  expect(localStorage.getItem('speakup.music')).toBe('off')
  setMusicPref(true)
  expect(getMusicPref()).toBe(true)
})

it('start() is a no-op when AudioContext is unavailable', () => {
  // @ts-expect-error simulate a browser without Web Audio support
  delete globalThis.AudioContext
  const music = new BackgroundMusic()
  expect(() => music.start()).not.toThrow()
  expect(music.playing).toBe(false)
})

class FakeAudioParam {
  value = 0
}
class FakeNode {
  connect(): void {}
  start(): void {}
  stop(): void {}
}
class FakeOscillator extends FakeNode {
  type = ''
  frequency = new FakeAudioParam()
  detune = new FakeAudioParam()
}
class FakeGain extends FakeNode {
  gain = new FakeAudioParam()
}
class FakeFilter extends FakeNode {
  type = ''
  frequency = new FakeAudioParam()
}
class FakeAudioContext {
  static resumeSpy = vi.fn()
  state = 'running'
  destination = {}
  createOscillator(): FakeOscillator {
    return new FakeOscillator()
  }
  createGain(): FakeGain {
    return new FakeGain()
  }
  createBiquadFilter(): FakeFilter {
    return new FakeFilter()
  }
  resume(): Promise<void> {
    FakeAudioContext.resumeSpy()
    return Promise.resolve()
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
}

/** iOS suspends the AudioContext when the screen locks or the tab is backgrounded. */
class SuspendedAudioContext extends FakeAudioContext {
  state = 'suspended'
}

it('start()/stop() toggle playing with a fake AudioContext', () => {
  // @ts-expect-error stub the global Web Audio constructor for this test
  globalThis.AudioContext = FakeAudioContext
  const music = new BackgroundMusic()
  music.start()
  expect(music.playing).toBe(true)
  music.stop()
  expect(music.playing).toBe(false)
})

it('start() twice in a row is a no-op the second time', () => {
  // @ts-expect-error stub the global Web Audio constructor for this test
  globalThis.AudioContext = FakeAudioContext
  const music = new BackgroundMusic()
  music.start()
  expect(() => music.start()).not.toThrow()
  expect(music.playing).toBe(true)
  music.stop()
})

it('start() on an already-running context does not resume it again', () => {
  // @ts-expect-error stub the global Web Audio constructor for this test
  globalThis.AudioContext = FakeAudioContext
  const music = new BackgroundMusic()
  music.start()
  FakeAudioContext.resumeSpy.mockClear()
  music.start()
  expect(FakeAudioContext.resumeSpy).not.toHaveBeenCalled()
  music.stop()
})

it('start() resumes a suspended context (music comes back after lock/unlock)', () => {
  // @ts-expect-error stub the global Web Audio constructor for this test
  globalThis.AudioContext = SuspendedAudioContext
  const music = new BackgroundMusic()
  music.start() // builds the pad; the initial resume() happens here
  FakeAudioContext.resumeSpy.mockClear()
  music.start() // ctx exists but iOS suspended it: blindly returning leaves the pad silent forever
  expect(FakeAudioContext.resumeSpy).toHaveBeenCalledTimes(1)
  expect(music.playing).toBe(true)
  music.stop()
})
