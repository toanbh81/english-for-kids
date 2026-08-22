import { getStars, setStars, totalStars } from './store'

beforeEach(() => localStorage.clear())

it('stores best stars per card and sums total', () => {
  expect(getStars('a')).toBe(0)
  setStars('a', 2); setStars('a', 1)
  expect(getStars('a')).toBe(2)
  setStars('b', 3)
  expect(totalStars()).toBe(5)
})
