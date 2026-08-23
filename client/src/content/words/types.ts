export type Word = {
  id: string
  topic: 'food' | 'school' | 'family'
  word: string
  ipa: string
  emoji: string
  audio: string
  vi: string
  example: string
}

export type WordTopic = {
  id: 'food' | 'school' | 'family'
  title: string
  emoji: string
  words: Word[]
}
