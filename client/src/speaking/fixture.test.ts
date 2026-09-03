import { readResultFixture } from './fixture'

afterEach(() => { vi.unstubAllEnvs() })

it('returns null in production and a scored result in dev', () => {
  vi.stubEnv('DEV', false)
  expect(readResultFixture('?fixture=result3')).toBeNull()
  vi.stubEnv('DEV', true)
  const r = readResultFixture('?fixture=result3&x=1')!
  expect(r.overall).toBe(86)
  expect(r.words.length).toBeGreaterThan(0)
  expect(r.prosody).toBe(84)
  expect(readResultFixture('?fixture=result1')!.prosody).toBeUndefined()
  expect(readResultFixture('?nope')).toBeNull()
})

describe('result3 (Azure-like)', () => {
  beforeEach(() => vi.stubEnv('DEV', true))

  it('carries the full Azure score set and engine', () => {
    const r = readResultFixture('?fixture=result3')!
    expect(r.accuracy).toBe(88)
    expect(r.fluency).toBe(81)
    expect(r.completeness).toBe(100)
    expect(r.engine).toBe('azure')
  })

  it('builds words from the target text, mostly good with a couple ok and one fix', () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve'
    const r = readResultFixture('?fixture=result3', text)!
    expect(r.words.map(w => w.word)).toEqual(text.split(' '))
    // 4th and 12th are "ok" (>=60, <80), 9th is "fix" (<60), the rest are "good" (>=80)
    const scores = r.words.map(w => w.score)
    expect(scores[3]).toBeGreaterThanOrEqual(60)
    expect(scores[3]).toBeLessThan(80)
    expect(scores[11]).toBeGreaterThanOrEqual(60)
    expect(scores[11]).toBeLessThan(80)
    expect(scores[8]).toBeLessThan(60)
    const others = scores.filter((_, i) => ![3, 8, 11].includes(i))
    for (const s of others) expect(s).toBeGreaterThanOrEqual(80)
  })

  it('falls back to a 14-word default sentence when no target text is given', () => {
    const r = readResultFixture('?fixture=result3')!
    expect(r.words.length).toBe(14)
  })

  it('stays mostly good on short target text without throwing', () => {
    const r = readResultFixture('?fixture=result3', 'cat')!
    expect(r.words.length).toBe(1)
    expect(r.words[0].score).toBeGreaterThanOrEqual(80)
  })
})

describe('result1 (Web-Speech-like)', () => {
  beforeEach(() => vi.stubEnv('DEV', true))

  it('is a flat 50 across the board with no prosody', () => {
    const r = readResultFixture('?fixture=result1')!
    expect(r.overall).toBe(50)
    expect(r.accuracy).toBe(50)
    expect(r.fluency).toBe(50)
    expect(r.completeness).toBe(50)
    expect(r.prosody).toBeUndefined()
    expect(r.engine).toBe('webspeech')
  })

  it('alternates good and fix word scores', () => {
    const text = 'alpha bravo charlie delta echo'
    const r = readResultFixture('?fixture=result1', text)!
    expect(r.words.map(w => w.score)).toEqual([100, 0, 100, 0, 100])
  })
})
