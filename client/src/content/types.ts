export type LessonCard = { id: string; text: string; ipa: string; emoji: string; audio: string; targetPhoneme?: string; tip?: string }
export type Level = { id: 'sound-zoo' | 'word-pop'; title: string; cards: LessonCard[] }

/** A Tập âm sound group: the 3 sound-zoo cards that share a `targetPhoneme`, plus the phoneme's
 * own IPA symbol and a headline example word for the sound-tile screen. */
export type SoundGroup = { ph: string; ipa: string; example: string; cards: LessonCard[] }

export type PairWord = { word: string; ipa: string; emoji: string; audio: string }
/** A minimal-pairs listening item: two words that differ by one contrasting sound. */
export type PairItem = { id: string; a: PairWord; b: PairWord; contrast: string }
