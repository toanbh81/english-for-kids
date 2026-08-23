import { Link } from 'react-router-dom'
import { SENTENCE_STARS } from '../content'
import { getStars } from '../progress/store'
import { BackButton, CARD_LINK, StarRow } from '../components/ui'

/** Sentence Stars is the whole-sentence bậc of the Speak Lab stairs: every card is one sentence,
 * shown in English with its Vietnamese meaning underneath. Stars live on `sstar:<id>`. */
export function StarLevel() {
  return (
    <main className="h-full overflow-y-auto bg-cream-50 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <BackButton to="/levels" label="Các bậc" className="self-start" />

        <header className="text-center">
          <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">Sentence Stars ⭐</h1>
          <p className="mt-1 text-lg font-bold text-ink-500">Nói cả câu — nhấn đúng chỗ, nối âm mượt!</p>
        </header>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SENTENCE_STARS.map((s, i) => (
            <Link
              key={s.id}
              to={`/star/${s.id}`}
              aria-label={`Câu ${i + 1}: ${s.text}`}
              className={CARD_LINK}
            >
              <span className="text-center font-display text-[26px] font-extrabold leading-tight text-ink-900">{s.text}</span>
              <span className="text-center text-base font-bold text-ink-500">{s.vi}</span>
              <StarRow value={getStars(`sstar:${s.id}`)} />
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
