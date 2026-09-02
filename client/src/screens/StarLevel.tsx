import { Link } from 'react-router-dom'
import { SENTENCE_STARS } from '../content'
import { getStars } from '../progress/store'
import { BackButton, CARD_LINK, StarRow } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

/** Sentence Stars is the whole-sentence bậc of the Speak Lab stairs: every card is one sentence,
 * shown in English with its Vietnamese meaning underneath. Stars live on `sstar:<id>`. */
export function StarLevel() {
  return (
    <PageShell>
      <PageHeader back={<BackButton to="/levels" label="Các bậc" />}>
        <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900 md:text-[32px]">Sentence Stars ⭐</h1>
      </PageHeader>
      <PageBody>
        <p className="text-center text-[15px] font-bold text-ink-500 md:text-lg">Nói cả câu — nhấn đúng chỗ, nối âm mượt!</p>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
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
      </PageBody>
    </PageShell>
  )
}
