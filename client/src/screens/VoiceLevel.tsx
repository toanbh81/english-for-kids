import { Link } from 'react-router-dom'
import { STORY_VOICE } from '../content'
import { getStars } from '../progress/store'
import { BackButton, CARD_LINK, Chip, StarRow } from '../components/ui'

/** The first sentence is enough to recognise a passage by, and keeps every card the same height. */
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s+/)[0] ?? text

/** Story Voice is the top bậc of the Speak Lab stairs: each card is a short passage to read with
 * a feeling, shown by its mood emoji. Stars live on `voice:<id>`. */
export function VoiceLevel() {
  return (
    <main className="h-full overflow-y-auto bg-cream-50 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <BackButton to="/levels" label="Các bậc" className="self-start" />

        <header className="text-center">
          <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">Story Voice 🎭</h1>
          <p className="mt-1 text-lg font-bold text-ink-500">Đọc có hồn — vui, buồn, ngạc nhiên!</p>
        </header>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>
    </main>
  )
}
