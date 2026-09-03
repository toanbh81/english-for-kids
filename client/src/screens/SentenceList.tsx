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
  const list = topic ? SENTENCES.filter(s => s.topic === topic.id) : []

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
        sub={topic ? `${list.length} câu · ${topic.name}` : `${SENTENCES.length} câu · ${shown.length} chủ đề`}
      />
      <PageBody fade gap={8}>
        <div data-testid="sentence-groups" className="flex flex-col gap-3 md:grid md:grid-cols-2 md:items-start md:gap-3">
          {shown.map(t => {
            // Unfiltered, `t` ranges over every shown topic and needs its own slice; filtered,
            // `shown` is just `[topic]` so `t` is always `topic` and `list` already is that slice.
            const rows = (topic ? list : SENTENCES.filter(s => s.topic === t.id)).map(s => (
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
