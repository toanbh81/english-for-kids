import { WordChip } from './speak/WordChip'
import type { WordTone } from '../scoring/types'

/** One chip per word, tinted by how it was said. Never a button (spec decision 3): the
 * result read-out is the one place a child's tap must not do anything at all. */
export function ScoredWords({ words }: { words: { word: string; tone: WordTone }[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {words.map((w, i) => <WordChip key={i} word={w.word} tone={w.tone} />)}
    </div>
  )
}
