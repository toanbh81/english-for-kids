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

function makeStory(): Story {
  return {
    id: 'test-story',
    title: 'Test',
    titleVi: 'Test',
    emoji: '🦊',
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
  localStorage.clear()
})

async function tickMs(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

it('1. initial state', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))
  expect(result.current.sceneIndex).toBe(0)
  expect(result.current.playing).toBe(false)
  expect(result.current.wordIndex).toBe(-1)
  expect(result.current.hasAudio).toBe(false)
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

it('6. toggleMusic() flips musicOn and persists to localStorage', async () => {
  const story = makeStory()
  const { result, unmount } = renderHook(() => useStoryPlayer(story))
  const initial = result.current.musicOn

  act(() => result.current.toggleMusic())
  expect(result.current.musicOn).toBe(!initial)
  expect(localStorage.getItem('speakup.music')).toBe(!initial ? 'on' : 'off')
  unmount()
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
