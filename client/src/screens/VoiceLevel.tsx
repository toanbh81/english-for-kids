import { Link } from 'react-router-dom'
import { STORY_VOICE } from '../content'
import { getStars } from '../progress/store'
import { BackButton, CARD_LINK, Chip, StarRow } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

/** The first sentence is enough to recognise a passage by, and keeps every card the same height. */
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s+/)[0] ?? text

/** Story Voice is the top bậc of the Speak Lab stairs: each card is a short passage to read with
 * a feeling, shown by its mood emoji. Stars live on `voice:<id>`. */
export function VoiceLevel() {
  return (
    <PageShell>
      <PageHeader back={<BackButton to="/levels" label="Các bậc" />}>
        <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900 md:text-[32px]">Story Voice 🎭</h1>
      </PageHeader>
      <PageBody>
        <p className="text-center text-[15px] font-bold text-ink-500 md:text-lg">Đọc có hồn — vui, buồn, ngạc nhiên!</p>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {STORY_VOICE.map((v, i) => (
            <Link
              key={v.id}
              to={`/voice/${v.id}`}
              aria-label={`Đoạn ${i + 1}: ${v.moodVi}`}
              className={CARD_LINK}
            >
              <span aria-hidden="true" className="text-[56px] leading-none">{v.emoji}</span>
              <Chip tone="coral" size="sm">{v.moodVi}</Chip>
              <span className="text-center font-display text-[22px] font-extrabold leading-tight text-ink-900">
                {firstSentence(v.text)}
              </span>
              <StarRow value={getStars(`voice:${v.id}`)} />
            </Link>
          ))}
        </div>
      </PageBody>
    </PageShell>
  )
}
