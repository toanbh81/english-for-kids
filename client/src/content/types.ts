export type LessonCard = { id: string; text: string; ipa: string; emoji: string; audio: string; targetPhoneme?: string; tip?: string }
export type Level = { id: 'sound-zoo' | 'word-pop'; title: string; cards: LessonCard[] }

/** A Tập âm sound group: the 3 sound-zoo cards that share a `targetPhoneme`, plus the phoneme's
 * own IPA symbol and a headline example word for the sound-tile screen. */
export type SoundGroup = { ph: string; ipa: string; example: string; cards: LessonCard[] }

export type PairWord = { word: string; ipa: string; emoji: string; audio: string }
/** A minimal-pairs listening item: two words that differ by one contrasting sound. */
export type PairItem = { id: string; a: PairWord; b: PairWord; contrast: string }

/** A Sentence Stars item: a whole sentence with sentence-stress and linking marked up for the
 * rhythm card. `stress` and the indexes inside `link` are indexes into `words`. */
export type SentenceStar = {
  id: string
  text: string
  words: string[]
  stress: number[]
  link?: [number, number][]
  vi: string
  audio: string
}

/** A Story Voice passage: 2–3 sentences read with a target mood/intonation. `tips` overrides the
 * screen's shared mood tips: those are written for every passage of a mood at once and so cannot
 * name a word, while a passage that hinges on one ("Hạ giọng ở 'only the cat'") can name it. */
export type VoicePassage = {
  id: string
  mood: 'happy' | 'surprised' | 'question' | 'sad' | 'excited' | 'calm'
  moodVi: string
  emoji: string
  text: string
  vi: string
  tips?: string[]
  audio: string
}
