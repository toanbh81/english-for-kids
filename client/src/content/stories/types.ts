import type { TopicId } from '../topics'

export type StoryWord = { w: string; start?: number; end?: number }
/** Acting hints for the narration generator (scripts/gen-story.mjs); ignored by the player. */
export type VoiceHints = {
  style?: string          // Azure mstts:express-as style, e.g. cheerful | excited | sad | whispering | friendly
  degree?: number         // styledegree 0.01–2 (1 = default intensity)
  rate?: string           // prosody rate, e.g. "-10%" | "+5%"
  pitch?: string          // prosody pitch, e.g. "+5%"
  emphasis?: number[]     // indexes into words[] to read with <emphasis level="strong">
  pauseMs?: number        // pause between sentences (default 350)
}
export type Scene = {
  text: string
  textVi: string
  emoji: string
  bg: string
  audio: string
  image?: string
  words: StoryWord[]
  voice?: VoiceHints
}
export type QuizQ = {
  q: string
  qVi: string
  // `image` is the Q14 branch (round-3 brief §3): a 16:9 picture in place of the emoji, same
  // layout. No story ships one yet — the field exists so the branch has something to type-check
  // against once art does.
  options: { emoji: string; label: string; image?: string }[]
  answer: 0 | 1 | 2
}
export type Story = {
  id: string
  title: string
  titleVi: string
  emoji: string
  topic: TopicId
  scenes: Scene[]
  quiz: QuizQ[]
  retell: { text: string; textVi: string }
}
