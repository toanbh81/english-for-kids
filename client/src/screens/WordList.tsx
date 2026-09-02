import { Link, useParams } from 'react-router-dom'
import type { Word } from '../content/words/types'
import { findTopic, findWord } from '../content/words'
import { getBox, dueWords } from '../progress/leitner'
import { BackButton, CARD_LINK, Chip, EmptyState, NotFound } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

export function WordList() {
  const { topic = '' } = useParams()
  const isReview = topic === 'review'
  const t = isReview ? undefined : findTopic(topic)

  if (!isReview && !t) return <NotFound what="chủ đề" to="/words" />

  const words: Word[] = isReview
    ? dueWords().map(findWord).filter((w): w is Word => !!w)
    : t!.words
  const title = isReview ? 'Ôn tập hôm nay' : t!.title

  return (
    <PageShell>
      {/* A map topic was reached from its island, so back goes to the island — the flat word
        * index is only ever the review deck's home now. */}
      <PageHeader back={(
        <BackButton
          to={isReview ? '/words' : `/topic/${topic}`}
          label={isReview ? 'Từ vựng' : t!.title}
        />
      )}
      >
        <h1 className="flex items-center gap-2 font-display text-[22px] font-extrabold leading-tight text-ink-900 md:text-[32px]">
          <span aria-hidden="true">{isReview ? '📚' : t!.emoji}</span>
          <span>{title}</span>
        </h1>
      </PageHeader>
      <PageBody>
        {words.length === 0 ? (
          <EmptyState
            emoji="📚"
            title="Chưa có từ cần ôn hôm nay"
            sub="Học thêm từ mới, mai quay lại ôn nhé!"
            cta={{ label: 'Từ mới hôm nay →', to: '/words' }}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
            {words.map(w => {
              const unlocked = getBox(w.id) > 0
              return (
                <Link key={w.id} to={`/words/${topic}/${w.id}`} className={CARD_LINK}>
                  <span aria-hidden="true" className="text-[64px] leading-none">{w.emoji}</span>
                  <span className="font-display text-[24px] font-extrabold text-ink-900">{w.word}</span>
                  <Chip tone={unlocked ? 'sun' : 'neutral'}>{unlocked ? '🔓' : '🔒'}</Chip>
                </Link>
              )
            })}
          </div>
        )}
      </PageBody>
    </PageShell>
  )
}
