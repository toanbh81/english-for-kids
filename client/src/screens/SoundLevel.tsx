import { SOUNDS } from '../content'
import { soundStars } from '../progress/store'
import { BackButton, ListGrid, Tile } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

/** Tập âm is organised by SOUND, not by word: one tile per phoneme, each holding its 3 words.
 * The stars are the sound's derived value — the WEAKEST of its words — so a tile only fills up
 * once the child has said all three of its words well, not once they have been lucky on one. */
export function SoundLevel() {
  return (
    <PageShell>
      {/* Tập âm is a bậc of the Speak Lab stairs, so back goes to the stairs. */}
      <PageHeader
        back={<BackButton to="/levels" label="Các bậc" />}
        title="Tập âm 🦁"
        sub="Mỗi ô là một âm — luyện đến khi cả 3 từ đều xanh!"
      />
      <PageBody fade gap={10}>
        <ListGrid size="sm">
          {SOUNDS.map(s => (
            <Tile
              key={s.ph}
              to={`/sound/${s.ph}`}
              ariaLabel={`Âm ${s.ipa}, ví dụ ${s.example}`}
              ipa={`/${s.ipa}/`}
              sub={s.example}
              stars={soundStars(s.ph)}
            />
          ))}
        </ListGrid>
      </PageBody>
    </PageShell>
  )
}
