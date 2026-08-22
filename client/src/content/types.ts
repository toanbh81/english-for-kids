export type LessonCard = { id: string; text: string; ipa: string; emoji: string; audio: string; targetPhoneme?: string; tip?: string }
export type Level = { id: 'sound-zoo' | 'word-pop'; title: string; cards: LessonCard[] }
