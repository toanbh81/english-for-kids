export type TopicId = 'animals' | 'food' | 'school' | 'family' | 'weather' | 'colors' | 'body' | 'toys'

export type Topic = { id: TopicId; emoji: string; name: string }

/** Canonical topic list, in unlock order. */
export const TOPICS: Topic[] = [
  { id: 'animals', emoji: '🐘', name: 'Động vật' },
  { id: 'food', emoji: '🍎', name: 'Đồ ăn' },
  { id: 'school', emoji: '🏫', name: 'Trường học' },
  { id: 'family', emoji: '👨‍👩‍👧', name: 'Gia đình' },
  { id: 'weather', emoji: '☀️', name: 'Thời tiết' },
  { id: 'colors', emoji: '🎨', name: 'Màu sắc' },
  { id: 'body', emoji: '🧍', name: 'Cơ thể' },
  { id: 'toys', emoji: '🧸', name: 'Đồ chơi' },
]

export const findTopic = (id: string): Topic | undefined => TOPICS.find(t => t.id === id)
