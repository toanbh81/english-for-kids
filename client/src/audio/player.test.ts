import { playUrl } from './player'

/** jsdom has no media stack — `play()` is not implemented and no media event ever fires — so the
 * element is faked outright and the events are delivered by hand. */
class FakeAudio {
  static instances: FakeAudio[] = []
  static playRejects = false
  src: string
  paused = true
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(src: string) { this.src = src; FakeAudio.instances.push(this) }
  play() { this.paused = false; return FakeAudio.playRejects ? Promise.reject(new Error('blocked')) : Promise.resolve() }
  pause() { this.paused = true }
}
const last = () => FakeAudio.instances[FakeAudio.instances.length - 1]
const settled = (p: Promise<void>) => p.then(() => 'resolved' as const, () => 'rejected' as const)

beforeEach(() => {
  FakeAudio.instances.length = 0
  FakeAudio.playRejects = false
  vi.stubGlobal('Audio', FakeAudio)
})
afterEach(() => { vi.unstubAllGlobals() })

it('resolves when the clip reaches its end', async () => {
  const p = playUrl('/audio/cat.mp3')
  expect(last().src).toBe('/audio/cat.mp3')
  expect(last().paused).toBe(false)

  last().onended?.()
  await expect(p).resolves.toBeUndefined()
})

/** Every caller turns a rejection into "Chưa có audio mẫu" and clears its playing flag. A promise
 * that never settles leaves that flag stuck on forever, so both failure paths must settle. */
it('rejects when the element errors', async () => {
  const p = playUrl('/audio/missing.mp3')
  last().onerror?.()
  await expect(settled(p)).resolves.toBe('rejected')
})

/** Safari refuses autoplay by rejecting play() rather than firing `error`. */
it('rejects when play() itself is refused', async () => {
  FakeAudio.playRejects = true
  await expect(settled(playUrl('/audio/blocked.mp3'))).resolves.toBe('rejected')
})

/** Two overlapping clips would otherwise both sound, and the superseded one would never settle —
 * leaving whichever screen started it stuck showing "playing" for good. */
it('stops and settles the previous clip when a new one starts', async () => {
  const first = playUrl('/audio/one.mp3')
  const one = last()

  const second = playUrl('/audio/two.mp3')
  expect(one.paused).toBe(true)
  expect(last()).not.toBe(one)
  await expect(settled(first)).resolves.toBe('resolved')

  // …and the clip that superseded it still settles on its own events.
  last().onended?.()
  await expect(second).resolves.toBeUndefined()
})

/** A stopped element must be deaf: its late `ended` cannot settle a promise a second time, nor
 * reach back into a `current` slot that now belongs to another clip. */
it('ignores events from a clip it already stopped', async () => {
  const first = playUrl('/audio/one.mp3')
  const one = last()
  const second = playUrl('/audio/two.mp3')
  await settled(first)

  one.onerror?.()
  expect(last().paused).toBe(false)
  last().onended?.()
  await expect(second).resolves.toBeUndefined()
})
