export type WordScore = { word: string; score: number; errorType: 'None' | 'Mispronunciation' | 'Omission' | 'Insertion'; phonemes: { phoneme: string; score: number }[] }
export type PronunciationResult = { overall: number; accuracy: number; fluency: number; completeness: number; prosody?: number; words: WordScore[]; engine: 'azure' | 'webspeech' }
export interface PronunciationScorer { score(audio: Blob, targetText: string): Promise<PronunciationResult> }
export type WordTone = 'good' | 'ok' | 'fix'
export type Feedback = { stars: 1 | 2 | 3; message: string; words: { word: string; tone: WordTone }[]; hint?: { word: string; phoneme?: string; tip: string } }
