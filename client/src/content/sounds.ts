import soundZoo from './sound-zoo.json'
import type { Level, LessonCard, SoundGroup } from './types'

/** Sound-tile order for the Tập âm level screen: matches the spec's teaching order, not the
 * alphabetical order the IPA symbols would otherwise sort into. */
const ORDER = ['th', 'dh', 'v', 'f', 'z', 'sh', 'ch', 'r', 'l'] as const

const IPA: Record<(typeof ORDER)[number], string> = {
  th: 'θ', dh: 'ð', v: 'v', f: 'f', z: 'z', sh: 'ʃ', ch: 'tʃ', r: 'r', l: 'l',
}

const cards: LessonCard[] = (soundZoo as Level).cards

export const SOUNDS: SoundGroup[] = ORDER.map(ph => {
  const group = cards.filter(c => c.targetPhoneme === ph)
  return { ph, ipa: IPA[ph], example: group[0]?.text ?? '', cards: group }
})

export const findSound = (ph: string): SoundGroup | undefined => SOUNDS.find(s => s.ph === ph)
