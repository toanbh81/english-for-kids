import { TOPICS, findTopic } from './topics'

it('has 5 topics in unlock order: animals, food, school, family, weather', () => {
  expect(TOPICS).toHaveLength(5)
  expect(TOPICS.map(t => t.id)).toEqual(['animals', 'food', 'school', 'family', 'weather'])
})

it('every topic has an emoji and a Vietnamese name', () => {
  for (const t of TOPICS) {
    expect(t.emoji.length).toBeGreaterThan(0)
    expect(t.name.length).toBeGreaterThan(0)
  }
})

it('findTopic resolves a known id and returns undefined for an unknown one', () => {
  expect(findTopic('animals')?.name).toBe('Động vật')
  expect(findTopic('weather')?.name).toBe('Thời tiết')
  expect(findTopic('nope')).toBeUndefined()
})
