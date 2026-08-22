export type StoryWord = { w: string; start?: number; end?: number }
export type Scene = {
  text: string
  textVi: string
  emoji: string
  bg: string
  audio: string
  image?: string
  words: StoryWord[]
}
export type QuizQ = {
  q: string
  qVi: string
  options: { emoji: string; label: string }[]
  answer: 0 | 1 | 2
}
export type Story = {
  id: string
  title: string
  titleVi: string
  emoji: string
  scenes: Scene[]
  quiz: QuizQ[]
  retell: { text: string; textVi: string }
}
