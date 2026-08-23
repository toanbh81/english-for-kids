import { DEFAULT_LIMIT_MINUTES, getLimitMinutes, setLimitMinutes } from './limit'

beforeEach(() => localStorage.clear())

it('defaults to 20 minutes when nothing is stored', () => {
  expect(DEFAULT_LIMIT_MINUTES).toBe(20)
  expect(getLimitMinutes()).toBe(20)
})

it('clamps a value above the max down to 60', () => {
  setLimitMinutes(999)
  expect(getLimitMinutes()).toBe(60)
})

it('clamps a value below the min up to 5', () => {
  setLimitMinutes(1)
  expect(getLimitMinutes()).toBe(5)
})

it('rounds to the nearest step of 5', () => {
  setLimitMinutes(23)
  expect(getLimitMinutes()).toBe(25)
})

it('treats a corrupt stored value as the default', () => {
  localStorage.setItem('speakup.limit.minutes', 'not a number')
  expect(getLimitMinutes()).toBe(DEFAULT_LIMIT_MINUTES)
})
