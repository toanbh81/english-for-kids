import { TOPICS, ALL_WORDS } from '../content/words'
import { getBox, dueWords } from '../progress/leitner'
import { topicUnlocked } from '../progress/topicProgress'
import { BackButton, ListGrid, Tile } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

/**
 * The flat vocabulary index, kept from phases 1–6 as the way into the review deck. Since Phase 7
 * the map decides what a child may open, so this screen shows only the topics the map has already
 * unlocked — otherwise it was a side door straight into locked content. Spec decision 12: a locked
 * topic is simply absent here (no locked-tile branch), same as before.
 */
export function WordTopics() {
  const dueCount = dueWords().filter(id => ALL_WORDS.some(w => w.id === id)).length
  const topics = TOPICS.filter(t => topicUnlocked(t.id))

  return (
    <PageShell>
      <PageHeader
        back={<BackButton to="/" label="Về nhà" />}
        title="Từ mới hôm nay 🧩"
        sub={`${topics.length} chủ đề đã mở · chạm để học`}
      />
      <PageBody fade gap={10}>
        <ListGrid size="sm">
          <Tile
            to="/words/review"
            variant="accent"
            emoji="📚"
            title="Ôn tập"
            ariaLabel="Ôn tập hôm nay"
            chip={dueCount > 0
              ? { tone: 'coralSolid', label: `${dueCount} từ hôm nay` }
              : { tone: 'neutral', label: 'Chưa có từ ôn' }}
          />
          {topics.map(t => {
            const unlocked = t.words.filter(w => getBox(w.id) > 0).length
            return (
              <Tile
                key={t.id}
                to={`/words/${t.id}`}
                emoji={t.emoji}
                title={t.title}
                chip={{ tone: 'sun', label: `${unlocked}/${t.words.length} mở` }}
              />
            )
          })}
        </ListGrid>
      </PageBody>
    </PageShell>
  )
}
