import { PAIRS } from '../content'
import { getStars } from '../progress/store'
import { BackButton, ListGrid, Tile } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

/** "Nghe & chọn" is the listening bậc: every tile is a *pair* of near-identical words, so the
 * card shows both of them side by side — the child should see the choice they are about to make
 * before they open it. Stars live on the pair's own key (`pair:<id>`), never on a single word. */
export function PairLevel() {
  return (
    <PageShell>
      {/* Minimal Pairs is a bậc of the Speak Lab stairs, so back goes to the stairs. */}
      <PageHeader
        back={<BackButton to="/levels" label="Các bậc" />}
        title="Nghe & chọn 👯"
        sub="Nghe tinh, chọn đúng từ!"
      />
      <PageBody fade gap={10}>
        <ListGrid size="lg">
          {PAIRS.map(p => (
            <Tile
              key={p.id}
              size="lg"
              title={`${p.a.emoji} ${p.a.word} · ${p.b.emoji} ${p.b.word}`}
              chip={{ tone: 'teal', label: p.contrast }}
              stars={getStars(`pair:${p.id}`)}
              ariaLabel={`Cặp ${p.a.word} và ${p.b.word}`}
              to={`/pair/${p.id}`}
            />
          ))}
        </ListGrid>
      </PageBody>
    </PageShell>
  )
}
