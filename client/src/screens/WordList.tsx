import { useParams } from 'react-router-dom'
import type { Word } from '../content/words/types'
import { TOPICS, findTopic, findWord } from '../content/words'
import { getBox, dueWords } from '../progress/leitner'
import { BackButton, EmptyState, ListGrid, NotFound, StickyGroup, Tile } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

export function WordList() {
  const { topic = '' } = useParams()
  const isReview = topic === 'review'
  const t = isReview ? undefined : findTopic(topic)

  if (!isReview && !t) return <NotFound what="chủ đề" to="/words" />

  const words: Word[] = isReview
    ? dueWords().map(findWord).filter((w): w is Word => !!w)
    : t!.words

  // R6 / decision 9: the review deck groups its due words by topic, in `TOPICS` order — not by
  // when each word became due — so the sticky H2s always read top-to-bottom the same as every
  // other topic-ordered list in the app.
  const grouped = isReview
    ? TOPICS.map(g => ({ t: g, words: words.filter(w => w.topic === g.id) })).filter(g => g.words.length > 0)
    : []

  return (
    <PageShell>
      {/* A map topic was reached from its island, so back goes to the island — the flat word
        * index is only ever the review deck's home now. */}
      <PageHeader
        back={(
          <BackButton
            to={isReview ? '/words' : `/topic/${topic}`}
            label={isReview ? 'Từ vựng' : t!.title}
          />
        )}
        title={isReview ? '📚 Ôn tập hôm nay' : `${t!.emoji} ${t!.title}`}
        sub={`${words.length} từ · ${isReview ? 'chạm để ôn' : 'chạm để học'}`}
      />
      <PageBody fade gap={10}>
        {isReview && words.length === 0 ? (
          <EmptyState
            emoji="📚"
            title="Chưa có từ cần ôn hôm nay"
            sub="Học thêm từ mới, mai quay lại ôn nhé!"
            cta={{ label: 'Từ mới hôm nay →', to: '/words' }}
          />
        ) : isReview ? (
          <div className="flex flex-col gap-3 md:gap-4">
            {grouped.map(g => (
              <StickyGroup key={g.t.id} emoji={g.t.emoji} name={g.t.title} count={`${g.words.length} từ`}>
                <ListGrid size="sm">
                  {g.words.map(w => {
                    const unlocked = getBox(w.id) > 0
                    return (
                      <Tile
                        key={w.id}
                        to={`/words/${topic}/${w.id}`}
                        ariaLabel={w.word}
                        emoji={w.emoji}
                        title={w.word}
                        chip={{ tone: unlocked ? 'sun' : 'neutral', label: unlocked ? '🔓' : '🔒' }}
                      />
                    )
                  })}
                </ListGrid>
              </StickyGroup>
            ))}
          </div>
        ) : (
          <ListGrid size="sm">
            {words.map(w => {
              const unlocked = getBox(w.id) > 0
              return (
                <Tile
                  key={w.id}
                  to={`/words/${topic}/${w.id}`}
                  ariaLabel={w.word}
                  emoji={w.emoji}
                  title={w.word}
                  chip={{ tone: unlocked ? 'sun' : 'neutral', label: unlocked ? '🔓' : '🔒' }}
                />
              )
            })}
          </ListGrid>
        )}
      </PageBody>
    </PageShell>
  )
}
