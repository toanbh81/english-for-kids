import { STORIES, findStory } from './index'
import { splitWords } from '../../story/timing'
import { TOPICS } from '../topics'

it('exposes all three stories in order', () => {
  expect(STORIES.map(s => s.id)).toEqual(['little-fox', 'at-the-zoo', 'my-breakfast'])
})

it('finds a story by id and returns undefined for unknown ids', () => {
  expect(findStory('little-fox')?.title).toBe('The Little Fox')
  expect(findStory('nope')).toBeUndefined()
})

it('every story has at least 6 scenes', () => {
  for (const story of STORIES) expect(story.scenes.length).toBeGreaterThanOrEqual(6)
})

it('every scene words array matches splitWords(text)', () => {
  for (const story of STORIES) {
    for (const scene of story.scenes) {
      // Generated timings add start/end per word; the word list itself must still mirror the text.
      expect(scene.words.map(x => x.w)).toEqual(splitWords(scene.text))
    }
  }
})

it('every quiz has exactly 3 questions with 3 options and a valid answer index', () => {
  for (const story of STORIES) {
    expect(story.quiz).toHaveLength(3)
    for (const q of story.quiz) {
      expect(q.options).toHaveLength(3)
      expect(q.answer).toBeGreaterThanOrEqual(0)
      expect(q.answer).toBeLessThanOrEqual(2)
    }
  }
})

it('every retell sentence appears verbatim in some scene, so its narration can be reused', () => {
  for (const story of STORIES) {
    expect(story.scenes.some(scene => scene.text.includes(story.retell.text))).toBe(true)
  }
})

it('every story has a topic from TOPICS', () => {
  const topicIds = TOPICS.map(t => t.id)
  for (const story of STORIES) expect(topicIds).toContain(story.topic)
})

it('quiz answers are not all at the same index within a story', () => {
  for (const story of STORIES) {
    const answers = story.quiz.map(q => q.answer)
    expect(new Set(answers).size).toBeGreaterThan(1)
  }
})
