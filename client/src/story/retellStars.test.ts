import { retellStars, RETELL_MESSAGE } from './retellStars'

it('gives 3 stars at and above the lenient pass threshold', () => {
  expect(retellStars(70)).toBe(3)
  expect(retellStars(60)).toBe(3)
})

it('gives 2 stars between the two thresholds', () => {
  expect(retellStars(40)).toBe(2)
  expect(retellStars(35)).toBe(2)
  expect(retellStars(59)).toBe(2)
})

it('gives 1 star below the lower threshold', () => {
  expect(retellStars(10)).toBe(1)
  expect(retellStars(34)).toBe(1)
})

it('has a friendly Vietnamese message for every star count', () => {
  expect(RETELL_MESSAGE[3]).toBe('Tuyệt vời! 🦊')
  expect(RETELL_MESSAGE[2]).toBe('Hay lắm!')
  expect(RETELL_MESSAGE[1]).toBe('Bé kể tốt lắm, thử lại nhé!')
})
