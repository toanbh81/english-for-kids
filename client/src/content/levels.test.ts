import { BAND_STEPS, bandName } from './levels'

it('holds exactly the five bậc, in band order 1 → 5', () => {
  expect(BAND_STEPS).toHaveLength(5)
  expect(BAND_STEPS.map(s => s.band)).toEqual([1, 2, 3, 4, 5])
})

it('every step has a route and the app-wide 1→5 names', () => {
  expect(BAND_STEPS.map(s => s.name)).toEqual([
    'Tập âm', 'Đọc từ', 'Nghe & chọn', 'Sentence Stars', 'Story Voice',
  ])
  for (const step of BAND_STEPS) expect(step.to).toBe(`/level/${step.key}`)
})

it('bandName reads the same table by band number', () => {
  expect(bandName(1)).toBe('Tập âm')
  expect(bandName(2)).toBe('Đọc từ')
  expect(bandName(5)).toBe('Story Voice')
})

// `Lesson.band` is stored as a bare `number`, not a freshly-validated `Band` — `bandName` takes
// that plain number and falls back rather than throwing on a stray out-of-range value.
it('bandName falls back to the last step for an out-of-range number', () => {
  expect(bandName(6)).toBe('Story Voice')
  expect(bandName(0)).toBe('Story Voice')
})
