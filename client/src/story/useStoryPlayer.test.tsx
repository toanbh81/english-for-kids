import { renderHook, act } from '@testing-library/react'
import type { Story } from '../content/stories/types'
import { useStoryPlayer } from './useStoryPlayer'

class FakeAudio {
  src: string
  currentTime = 0
  playbackRate = 1
  constructor(src?: string) {
    this.src = src ?? ''
  }
  addEventListener(): void {
    /* never fires load events -> fallback clock path */
  }
  removeEventListener(): void {}
  play(): Promise<void> {
    return Promise.resolve()
  }
  pause(): void {}
  removeAttribute(): void {}
  load(): void {}
}

function scene(words: { w: string; start: number; end: number }[], audio = '/a.mp3') {
  return {
    text: words.map(w => w.w).join(' '),
    textVi: '',
    emoji: '🦊',
    bg: '',
    audio,
    words,
  }
}

/** Records how many elements were constructed and every `src` assignment, so a test can prove the
 * hook reuses ONE element across scenes (iOS unlocks media elements per element, on a gesture). */
class TrackingAudio {
  static created = 0
  static srcHistory: string[] = []
  static loadSpy = vi.fn()
  static reset(): void {
    TrackingAudio.created = 0
    TrackingAudio.srcHistory = []
    TrackingAudio.loadSpy.mockClear()
  }
  currentTime = 0
  playbackRate = 1
  _src = ''
  constructor(src?: string) {
    TrackingAudio.created++
    if (src !== undefined) this.src = src
  }
  get src(): string {
    return this._src
  }
  set src(v: string) {
    this._src = v
    TrackingAudio.srcHistory.push(v)
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  play(): Promise<void> {
    return Promise.resolve()
  }
  pause(): void {}
  removeAttribute(): void {}
  load(): void {
    TrackingAudio.loadSpy()
  }
}

function makeStory(): Story {
  return {
    id: 'test-story',
    title: 'Test',
    titleVi: 'Test',
    emoji: '🦊',
    topic: 'animals',
    scenes: [
      scene([
        { w: 'One', start: 0, end: 200 },
        { w: 'Two', start: 260, end: 500 },
        { w: 'Three', start: 560, end: 900 },
        { w: 'Four', start: 960, end: 1300 },
      ]),
      scene([
        { w: 'Five', start: 0, end: 200 },
        { w: 'Six', start: 260, end: 500 },
      ]),
    ],
    quiz: [],
    retell: { text: '', textVi: '' },
  } as Story
}

/** Three scenes with complete timings and distinct audio urls, for the element-reuse test. */
function makeStory3(): Story {
  return {
    id: 'test-story-3',
    title: 'Test',
    titleVi: 'Test',
    emoji: '🦊',
    topic: 'animals',
    scenes: [
      scene([{ w: 'One', start: 0, end: 200 }, { w: 'Two', start: 260, end: 1300 }], '/s1.mp3'),
      scene([{ w: 'Three', start: 0, end: 200 }, { w: 'Four', start: 260, end: 500 }], '/s2.mp3'),
      scene([{ w: 'Five', start: 0, end: 200 }, { w: 'Six', start: 260, end: 500 }], '/s3.mp3'),
    ],
    quiz: [],
    retell: { text: '', textVi: '' },
  } as Story
}

let realAudio: typeof globalThis.Audio | undefined

beforeEach(() => {
  realAudio = globalThis.Audio
  // @ts-expect-error stubbing the DOM Audio constructor for a fallback-clock test
  globalThis.Audio = FakeAudio
  localStorage.clear()
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
  })
})

afterEach(() => {
  vi.useRealTimers()
  globalThis.Audio = realAudio as typeof globalThis.Audio
  // @ts-expect-error test-only cleanup of a global stubbed per test
  delete globalThis.AudioContext
  localStorage.clear()
})

async function tickMs(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** Drains pending microtasks (e.g. an audio.play() promise settling) without advancing fake time. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** Metadata loads synchronously but play() always rejects, simulating an iOS NotAllowedError. */
class RejectingAudio {
  src: string
  currentTime = 0
  playbackRate = 1
  constructor(src?: string) {
    this.src = src ?? ''
  }
  addEventListener(type: string, cb: () => void): void {
    if (type === 'loadedmetadata') cb()
  }
  removeEventListener(): void {}
  play(): Promise<void> {
    return Promise.reject(new Error('NotAllowedError'))
  }
  pause(): void {}
  removeAttribute(): void {}
  load(): void {}
}

/** Metadata loads and play() resolves, and the test can fire 'ended' itself to simulate short trailing silence. */
class EndableAudio {
  static instances: EndableAudio[] = []
  src: string
  currentTime = 0
  playbackRate = 1
  private endedCb: (() => void) | null = null
  constructor(src?: string) {
    this.src = src ?? ''
    EndableAudio.instances.push(this)
  }
  addEventListener(type: string, cb: () => void): void {
    if (type === 'loadedmetadata') cb()
    if (type === 'ended') this.endedCb = cb
  }
  removeEventListener(type: string): void {
    if (type === 'ended') this.endedCb = null
  }
  play(): Promise<void> {
    return Promise.resolve()
  }
  pause(): void {}
  removeAttribute(): void {}
  load(): void {}
  dispatchEnded(): void {
    this.endedCb?.()
  }
}

it('1. initial state', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))
  expect(result.current.sceneIndex).toBe(0)
  expect(result.current.playing).toBe(false)
  expect(result.current.wordIndex).toBe(-1)
  expect(result.current.hasAudio).toBe(false)
  expect(result.current.hasTimings).toBe(true) // makeStory ships real start/end per word
  expect(result.current.timings).toHaveLength(story.scenes[0].words.length)
  unmount()
})

it('2. play() advances tMs/wordIndex; pause() freezes tMs', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))

  act(() => result.current.play())
  await tickMs(1200)
  expect(result.current.playing).toBe(true)
  expect(result.current.wordIndex).toBeGreaterThanOrEqual(1)

  act(() => result.current.pause())
  const frozen = result.current.tMs
  await tickMs(500)
  expect(result.current.tMs).toBe(frozen)
  expect(result.current.playing).toBe(false)
  unmount()
})

it('3. auto-advances to the next scene when a scene finishes, keeps playing', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))

  act(() => result.current.play())
  // scene 0 totalDuration = 1300, so 1300+400+buffer must elapse
  await tickMs(1800)
  expect(result.current.sceneIndex).toBe(1)
  expect(result.current.playing).toBe(true)
  unmount()
})

it('4. setRate(0.75) keeps the clock continuous at the new rate', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))

  act(() => result.current.play())
  act(() => result.current.setRate(0.75))
  await tickMs(1000)
  expect(result.current.rate).toBe(0.75)
  expect(result.current.tMs).toBeGreaterThan(700)
  expect(result.current.tMs).toBeLessThan(800)
  unmount()
})

it('5. replayWord(i) plays just that word then auto-pauses', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))
  const timings = result.current.timings

  act(() => result.current.replayWord(2))
  expect(result.current.tMs).toBe(timings[2].start)
  expect(result.current.playing).toBe(true)

  await tickMs(timings[2].end - timings[2].start + 100)
  expect(result.current.playing).toBe(false)
  unmount()
})

it('review: tapping a word speaks it when the story has no narration', async () => {
  const synth = { cancel: vi.fn(), speak: vi.fn() }
  const original = window.speechSynthesis
  type SynthWindow = { SpeechSynthesisUtterance?: unknown }
  const originalUtterance = (window as unknown as SynthWindow).SpeechSynthesisUtterance
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true, writable: true })
  ;(window as unknown as SynthWindow).SpeechSynthesisUtterance = class {
    lang = ''
    text: string
    constructor(text: string) {
      this.text = text
    }
  }

  try {
    const story = makeStory()
    story.scenes[0] = scene([
      { w: 'Hello,', start: 0, end: 200 },
      { w: 'Foxy!', start: 260, end: 500 },
    ])
    const { result, unmount } = renderHook(() => useStoryPlayer(story))
    expect(result.current.hasAudio).toBe(false) // FakeAudio never reports metadata

    act(() => result.current.replayWord(1))
    await tickMs(1) // speakText defers speak() one task past cancel()

    expect(synth.cancel).toHaveBeenCalled()
    expect(synth.speak).toHaveBeenCalledTimes(1)
    const u = synth.speak.mock.calls[0][0] as SpeechSynthesisUtterance
    expect(u.text).toBe('Foxy') // punctuation stripped, or the voice reads "Foxy exclamation mark"
    expect(u.lang).toBe('en-US')
    unmount()
  } finally {
    Object.defineProperty(window, 'speechSynthesis', { value: original, configurable: true, writable: true })
    ;(window as unknown as SynthWindow).SpeechSynthesisUtterance = originalUtterance
  }
})

it('review: a long background pause cannot skip a scene in one frame', async () => {
  // Browsers freeze rAF for a hidden tab, so the first frame after unhiding arrives with a huge
  // wall-clock gap. Drive the frames by hand (fake timers still own performance.now) to reproduce it.
  const pending = new Map<number, FrameRequestCallback>()
  let nextFrameId = 1
  const realRaf = globalThis.requestAnimationFrame
  const realCaf = globalThis.cancelAnimationFrame
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = nextFrameId++
    pending.set(id, cb)
    return id
  }
  globalThis.cancelAnimationFrame = (id: number) => {
    pending.delete(id)
  }
  async function runFrame() {
    const cbs = [...pending.values()]
    pending.clear()
    await act(async () => {
      cbs.forEach(cb => cb(performance.now()))
    })
  }

  try {
    const story = makeStory() // scene 0 totalDuration = 1300
    const { result, unmount } = renderHook(() => useStoryPlayer(story))

    act(() => result.current.play())
    vi.advanceTimersByTime(120_000) // two minutes hidden; no frames ran
    await runFrame()

    expect(result.current.sceneIndex).toBe(0) // one frame may never advance more than 250ms
    expect(result.current.tMs).toBeLessThanOrEqual(250)
    unmount()
  } finally {
    globalThis.requestAnimationFrame = realRaf
    globalThis.cancelAnimationFrame = realCaf
  }
})

it('marks ended and stops playing after the last scene finishes', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))

  act(() => result.current.goScene(1))
  act(() => result.current.play())
  await tickMs(1000) // scene 1 totalDuration = 500, +400 buffer
  expect(result.current.ended).toBe(true)
  expect(result.current.playing).toBe(false)
  expect(result.current.sceneIndex).toBe(1)
  unmount()
})

it('toggleSubtitles() flips the subtitles flag', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))
  const initial = result.current.subtitles
  act(() => result.current.toggleSubtitles())
  expect(result.current.subtitles).toBe(!initial)
  unmount()
})

it('nextScene/prevScene navigate and reset tMs', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))

  act(() => result.current.nextScene())
  expect(result.current.sceneIndex).toBe(1)
  expect(result.current.wordIndex).toBe(-1)

  act(() => result.current.prevScene())
  expect(result.current.sceneIndex).toBe(0)
  unmount()
})

it('review fix 1: setRate() survives an auto-advance into the next scene', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))

  act(() => result.current.play())
  act(() => result.current.setRate(0.75))
  // scene 0 totalDuration = 1300, so real elapsed must reach 1700 / 0.75 ≈ 2267ms to cross over
  await tickMs(2300)
  expect(result.current.sceneIndex).toBe(1)
  expect(result.current.rate).toBe(0.75)

  const before = result.current.tMs
  await tickMs(1000)
  // without the fix the new scene's clock silently resets to rate 1, giving ~1000ms instead of ~750ms
  expect(result.current.tMs - before).toBeGreaterThan(650)
  expect(result.current.tMs - before).toBeLessThan(850)
  unmount()
})

it('review fix 2: falls back to the clock when audio.play() rejects (iOS NotAllowedError)', async () => {
  // @ts-expect-error stub Audio whose metadata loads but play() always rejects
  globalThis.Audio = RejectingAudio
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))

  act(() => result.current.play())
  await flush() // let the rejected play() promise settle
  expect(result.current.hasAudio).toBe(false)
  expect(result.current.playing).toBe(true)

  await tickMs(1000)
  expect(result.current.wordIndex).toBeGreaterThanOrEqual(1)
  expect(result.current.tMs).toBeGreaterThan(0)
  unmount()
})

it('review fix 3: an audio "ended" event advances the scene (short trailing silence)', async () => {
  EndableAudio.instances.length = 0
  // @ts-expect-error stub Audio that loads, plays, and lets the test dispatch 'ended'
  globalThis.Audio = EndableAudio
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))

  act(() => result.current.play())
  await flush() // let play() resolve so hasAudio flips true
  expect(result.current.hasAudio).toBe(true)
  expect(result.current.sceneIndex).toBe(0)

  const lastAudio = EndableAudio.instances.at(-1)
  act(() => lastAudio?.dispatchEnded())
  expect(result.current.sceneIndex).toBe(1)
  expect(result.current.playing).toBe(true)
  unmount()
})

it('review fix 4: a manual pause cancels a pending replayWord one-shot stop', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))
  const timings = result.current.timings

  act(() => result.current.replayWord(2))
  act(() => result.current.pause())
  // setRate(1) is a no-op change between pause() and play() — it only rules out setRate() being
  // an accidental second place that happens to clear replayUntilRef, so pause() is the sole thing
  // under test. play() itself no longer clears replayUntilRef (see useStoryPlayer.ts), so this
  // genuinely fails if the `replayUntilRef.current = null` line is removed from pause().
  act(() => result.current.setRate(1))
  act(() => result.current.play())
  // if replayUntilRef survived the pause, tick() would stop playback again at timings[2].end
  await tickMs(timings[2].end - timings[2].start + 300)
  expect(result.current.playing).toBe(true)
  unmount()
})

it('review fix round 2: advancedRef does not latch across a replay within the last scene', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))
  const lastIndex = story.scenes.length - 1

  act(() => result.current.goScene(lastIndex))
  act(() => result.current.play())
  await tickMs(1000) // scene 1 totalDuration = 500, +400 buffer -> ended, advancedRef latched true
  expect(result.current.ended).toBe(true)
  expect(result.current.playing).toBe(false)

  const lastTimings = result.current.timings
  act(() => result.current.replayWord(0))
  // The one-shot fires at timings[0].end and pauses (play() no longer clears replayUntilRef —
  // see the finding-4 test above), so reaching total+400 again needs a second play() afterward.
  await tickMs(lastTimings[0].end - lastTimings[0].start + 100)
  expect(result.current.playing).toBe(false) // one-shot replay completed
  expect(result.current.ended).toBe(false) // did not (mis)trigger scene-end

  act(() => result.current.play())
  // Without resetting advancedRef inside beginPlayback(), finishScene() would see it still latched
  // from the very first advance above and return early: tick() stops rescheduling, playing stays
  // true, tMs freezes, and ended never re-fires.
  await tickMs(1000)
  expect(result.current.ended).toBe(true)
  expect(result.current.playing).toBe(false)
  unmount()
})

it('review fix 5: play() after the story ends restarts from scene 0', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))

  act(() => result.current.goScene(1))
  act(() => result.current.play())
  await tickMs(1000) // scene 1 totalDuration = 500, +400 buffer -> ended
  expect(result.current.ended).toBe(true)
  expect(result.current.playing).toBe(false)

  act(() => result.current.play())
  expect(result.current.ended).toBe(false)
  expect(result.current.sceneIndex).toBe(0)
  expect(result.current.playing).toBe(true)

  await tickMs(200)
  expect(result.current.wordIndex).toBeGreaterThanOrEqual(0)
  unmount()
})

it('critical fix: one Audio element is reused across every scene (iOS per-element unlock)', async () => {
  TrackingAudio.reset()
  // @ts-expect-error stub Audio to count constructions and record every src assignment
  globalThis.Audio = TrackingAudio
  const story = makeStory3()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))

  act(() => result.current.play())
  await tickMs(1800) // scene 0 total 1300 + 400 grace
  expect(result.current.sceneIndex).toBe(1)
  await tickMs(1000) // scene 1 total 500 + 400 grace
  expect(result.current.sceneIndex).toBe(2)

  // A `new Audio()` per scene is exactly the bug: scenes 2..n would be fresh, still-locked
  // elements that iOS refuses to play on an unattended auto-advance.
  expect(TrackingAudio.created).toBe(1)
  expect(TrackingAudio.srcHistory).toEqual(['/s1.mp3', '/s2.mp3', '/s3.mp3'])
  expect(TrackingAudio.loadSpy).toHaveBeenCalledTimes(3)
  unmount()
})

it('retry() reloads the scene audio and plays again', async () => {
  class Spy {
    static loadCount = 0
    static playCount = 0
    src = ''
    currentTime = 0
    playbackRate = 1
    addEventListener(type: string, cb: () => void): void {
      if (type === 'loadedmetadata') cb()
    }
    removeEventListener(): void {}
    play(): Promise<void> {
      Spy.playCount++
      return Promise.resolve()
    }
    pause(): void {}
    removeAttribute(): void {}
    load(): void {
      Spy.loadCount++
    }
  }
  // @ts-expect-error stub Audio to count load()/play() calls across the initial play and retry()
  globalThis.Audio = Spy
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))

  act(() => result.current.play())
  await flush()
  const loadsBefore = Spy.loadCount
  const playsBefore = Spy.playCount

  act(() => result.current.retry())
  await flush()
  expect(Spy.loadCount).toBe(loadsBefore + 1) // audio.load() called one more time
  expect(Spy.playCount).toBe(playsBefore + 1) // play() called again
  unmount()
})

it('retry() reruns the scene load so hasAudio recovers once the second attempt succeeds', async () => {
  // Fires events by hand instead of resolving synchronously, so the test can prove retry() binds
  // FRESH `loadedmetadata`/`canplaythrough`/`error` listeners (to the new load token) rather than
  // leaving the mount's listeners — bound to the old token — as the only ones ever registered.
  class FlakyAudio {
    static instances: FlakyAudio[] = []
    src = ''
    currentTime = 0
    playbackRate = 1
    private listeners: Record<string, Array<() => void>> = {}
    constructor() {
      FlakyAudio.instances.push(this)
    }
    addEventListener(type: string, cb: () => void): void {
      ;(this.listeners[type] ??= []).push(cb)
    }
    removeEventListener(type: string, cb: () => void): void {
      this.listeners[type] = (this.listeners[type] ?? []).filter(l => l !== cb)
    }
    play(): Promise<void> {
      return Promise.resolve()
    }
    pause(): void {}
    removeAttribute(): void {}
    load(): void {}
    fire(type: string): void {
      ;(this.listeners[type] ?? []).slice().forEach(cb => cb())
    }
  }
  FlakyAudio.instances.length = 0
  // @ts-expect-error stub Audio whose events this test fires by hand
  globalThis.Audio = FlakyAudio
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))
  const audio = FlakyAudio.instances[0]

  act(() => result.current.play())
  await flush() // let the first play() promise resolve (playResolvedRef true, metadata still not ready)
  act(() => audio.fire('error')) // the element's own failure, not a rejected play() promise
  expect(result.current.hasAudio).toBe(false)

  act(() => result.current.retry())
  await flush() // let the second attempt's play() promise resolve

  // One shared element throughout — retry() must not construct a fresh Audio().
  expect(FlakyAudio.instances).toHaveLength(1)

  act(() => audio.fire('canplaythrough')) // the second attempt's own metadata event
  expect(result.current.hasAudio).toBe(true) // a stale-token listener would leave this false forever
  unmount()
})

it('subtitles default off under a 700px viewport, on at or above', () => {
  const story = makeStory()
  const original = Object.getOwnPropertyDescriptor(window, 'innerHeight')

  Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true })
  const { result: short, unmount: unmountShort } = renderHook(() => useStoryPlayer(story))
  expect(short.current.subtitles).toBe(false)
  unmountShort()

  Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true })
  const { result: tall, unmount: unmountTall } = renderHook(() => useStoryPlayer(story))
  expect(tall.current.subtitles).toBe(true)
  unmountTall()

  if (original) Object.defineProperty(window, 'innerHeight', original)
})

it('minor fix: an incomplete-timings scene never creates an Audio element', async () => {
  let created = 0
  class CountingAudio extends FakeAudio {
    constructor(src?: string) {
      super(src)
      created++
    }
  }
  // @ts-expect-error stub Audio to count construction attempts
  globalThis.Audio = CountingAudio
  const story = makeStory()
  story.scenes[0] = { ...story.scenes[0], words: story.scenes[0].words.map(w => ({ w: w.w })) } // no start/end
  const { result, unmount } = renderHook(() => useStoryPlayer(story))
  expect(result.current.hasAudio).toBe(false)
  expect(result.current.hasTimings).toBe(false)
  expect(created).toBe(0)
  act(() => result.current.play())
  await tickMs(500)
  expect(result.current.wordIndex).toBeGreaterThanOrEqual(0) // fallback clock still advances
  expect(created).toBe(0)
  unmount()
})
