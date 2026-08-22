import { splitWords, estimateTimings, activeWordIndex, totalDuration } from './timing'

it('splits on whitespace keeping punctuation', () => {
  expect(splitWords('Hi, little fox!')).toEqual(['Hi,', 'little', 'fox!'])
})

it('estimates monotonic timings scaled to wpm', () => {
  const t = estimateTimings(['cat', 'elephant', 'is', 'big'], 120)
  expect(t).toHaveLength(4)
  for (let i = 1; i < t.length; i++) expect(t[i].start).toBeGreaterThanOrEqual(t[i - 1].end)
  expect(t[1].end - t[1].start).toBeGreaterThan(t[0].end - t[0].start)
  const mean = t.reduce((s, x) => s + (x.end - x.start), 0) / 4
  expect(Math.round(mean)).toBe(500)
})

it('finds the active word', () => {
  const t = [{ start: 0, end: 200 }, { start: 260, end: 500 }, { start: 560, end: 900 }]
  expect(activeWordIndex(t, -5)).toBe(-1)
  expect(activeWordIndex(t, 100)).toBe(0)
  expect(activeWordIndex(t, 230)).toBe(0)
  expect(activeWordIndex(t, 600)).toBe(2)
  expect(activeWordIndex(t, 5000)).toBe(2)
  expect(totalDuration(t)).toBe(900)
})
