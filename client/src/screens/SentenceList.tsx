import { useSearchParams } from 'react-router-dom'
import { SENTENCES } from '../content'
import { TOPICS, findTopic } from '../content/topics'
import { getStars } from '../progress/store'
import { topicUnlocked } from '../progress/topicProgress'
import { BackButton, ListRow, StickyGroup } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

export function SentenceList() {
  const [params] = useSearchParams()
  // `?topic=<id>` comes from a topic hub. An unknown id is treated as no filter at all, so a stale
  // deep link still shows the child something to do.
  const topic = findTopic(params.get('topic') ?? '')
  // Unfiltered, this screen is a full index of the game's sentences — so it lists only the topics
  // the map has opened, or it would be a way around the island unlocks. A hub that links in with
  // its own `?topic=` has already made that decision.
  const shown = topic ? [topic] : TOPICS.filter(t => topicUnlocked(t.id))
  // One slice per shown topic, computed once and reused for both the header's rendered-row count
  // and the row list below (fix round 1: the header used to count every `SENTENCES` entry — 32 —
  // instead of the ones actually on screen once unlocked topics cut that down).
  const grouped = shown.map(t => ({ t, sentences: SENTENCES.filter(s => s.topic === t.id) }))
  const shownCount = grouped.reduce((n, g) => n + g.sentences.length, 0)

  return (
    <PageShell>
      <PageHeader
        back={(
          <BackButton
            to={topic ? `/topic/${topic.id}` : '/'}
            label={topic ? 'Quay lại' : 'Về nhà'}
          />
        )}
        title="🧱 Ghép câu"
        sub={topic ? `${shownCount} câu · ${topic.name}` : `${shownCount} câu · ${shown.length} chủ đề`}
      />
      <PageBody fade gap={8}>
        <div data-testid="sentence-groups" className="flex flex-col gap-3 md:grid md:grid-cols-2 md:items-start md:gap-3">
          {grouped.map(({ t, sentences }) => {
            const rows = sentences.map(s => (
              <ListRow
                key={s.id}
                to={topic ? `/sentence/${s.id}?topic=${topic.id}` : `/sentence/${s.id}`}
                h={64}
                title={s.vi}
                stars={getStars(`sentence:${s.id}`)}
              />
            ))
            // One topic on screen is already named by the header's subtitle above — a second sticky
            // H2 repeating the same name would only repeat itself.
            if (topic) return <div key={t.id} className="flex flex-col gap-2.5">{rows}</div>
            return (
              <StickyGroup key={t.id} emoji={t.emoji} name={t.name} pad="row">
                <div className="flex flex-col gap-2.5">{rows}</div>
              </StickyGroup>
            )
          })}
        </div>
      </PageBody>
    </PageShell>
  )
}
