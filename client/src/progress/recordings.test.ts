// @vitest-environment node
// jsdom's Blob is not recognized by Node's structuredClone (which fake-indexeddb
// uses to clone stored values), so it silently loses its content. Node's own
// Blob round-trips correctly, so this suite runs outside jsdom.
import 'fake-indexeddb/auto'
import { saveRecording, listRecordings, clearRecordings } from './recordings'

const BASE = new Date('2026-08-23T10:00:00').getTime()

beforeEach(async () => {
  await clearRecordings()
})

it('keeps only the newest 20 recordings, newest first, with blobs intact', async () => {
  for (let i = 0; i < 21; i++) {
    await saveRecording({ id: `r${i}`, ts: BASE + i, text: `hello ${i}`, blob: new Blob([`data${i}`]) })
  }
  const list = await listRecordings()
  expect(list.length).toBe(20)
  expect(list[0].id).toBe('r20')
  expect(list[19].id).toBe('r1')
  expect(list[0].text).toBe('hello 20')
  expect(await list[0].blob.text()).toBe('data20')
})

it('clearRecordings empties the store', async () => {
  await saveRecording({ id: 'x', ts: BASE, text: 'hi', blob: new Blob(['x']) })
  await clearRecordings()
  expect(await listRecordings()).toEqual([])
})

it('reads back a recording with no score (old records) and one with a score (new writer)', async () => {
  await saveRecording({ id: 'old', ts: BASE, text: 'hi', blob: new Blob(['x']) })
  await saveRecording({ id: 'new', ts: BASE + 1, text: 'hi', blob: new Blob(['y']), score: 86 })
  const list = await listRecordings()
  expect(list.find(r => r.id === 'old')?.score).toBeUndefined()
  expect(list.find(r => r.id === 'new')?.score).toBe(86)
})
