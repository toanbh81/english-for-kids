import { getStars, setStars, totalStars } from './store'

beforeEach(() => localStorage.clear())

it('stores best stars per card and sums total', () => {
  expect(getStars('a')).toBe(0)
  setStars('a', 2); setStars('a', 1)
  expect(getStars('a')).toBe(2)
  setStars('b', 3)
  expect(totalStars()).toBe(5)
})

it('treats a corrupt stored value as empty progress', () => {
  localStorage.setItem('speakup.stars', '{not json')
  expect(getStars('a')).toBe(0)
  expect(totalStars()).toBe(0)
  setStars('a', 3)
  expect(getStars('a')).toBe(3)
})
