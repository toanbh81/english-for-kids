export type TopicId = 'animals' | 'food' | 'school' | 'family' | 'weather'

export type Topic = { id: TopicId; emoji: string; name: string }

/** Canonical topic list, in unlock order. */
export const TOPICS: Topic[] = [
  { id: 'animals', emoji: '🐘', name: 'Động vật' },
  { id: 'food', emoji: '🍎', name: 'Đồ ăn' },
  { id: 'school', emoji: '🏫', name: 'Trường học' },
  { id: 'family', emoji: '👨‍👩‍👧', name: 'Gia đình' },
  { id: 'weather', emoji: '☀️', name: 'Thời tiết' },
]

export const findTopic = (id: string): Topic | undefined => TOPICS.find(t => t.id === id)
