import { SENTENCE_STARS } from '../content'
import { getStars } from '../progress/store'
import { BackButton, ListGrid, Tile } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

/** Sentence Stars is the whole-sentence bậc of the Speak Lab stairs: every card is one sentence,
 * shown in English with its Vietnamese meaning underneath. Stars live on `sstar:<id>`. */
export function StarLevel() {
  return (
    <PageShell>
      <PageHeader
        back={<BackButton to="/levels" label="Các bậc" />}
        title="Sentence Stars ⭐"
        sub="Nói cả câu — nhấn đúng chỗ, nối âm mượt!"
      />
      <PageBody fade gap={10}>
        <ListGrid size="lg">
          {SENTENCE_STARS.map((s, i) => (
            <Tile
              key={s.id}
              size="lg"
              title={s.text}
              sub={s.vi}
              subTone="sand"
              stars={getStars(`sstar:${s.id}`)}
              ariaLabel={`Câu ${i + 1}: ${s.text}`}
              to={`/star/${s.id}`}
            />
          ))}
        </ListGrid>
      </PageBody>
    </PageShell>
  )
}
