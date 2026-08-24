export type Word = {
  id: string
  topic: 'animals' | 'food' | 'school' | 'family' | 'weather'
  word: string
  ipa: string
  emoji: string
  audio: string
  vi: string
  example: string
}

export type WordTopic = {
  id: 'animals' | 'food' | 'school' | 'family' | 'weather'
  title: string
  emoji: string
  words: Word[]
}
