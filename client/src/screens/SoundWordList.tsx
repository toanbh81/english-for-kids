import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { findSound } from '../content'
import type { SoundGroup } from '../content/types'
import { playUrl } from '../audio/player'
import { PHONEME_TIPS } from '../scoring/feedback'
import { getStars } from '../progress/store'
import { BackButton, Button, CARD_LINK, StarRow } from '../components/ui'

/**
 * The sound's own sub-level (Phase 9 §1): the sound at the top, then one card per word of it.
 *
 * Tập âm used to run all three words of a sound as one unbroken sequence, so a child who only
 * needed `think` still had to sit through `three` and `thank` first. The words are now separate
 * cards with separate stars, and this screen is where the child picks the one to drill.
 */
export function SoundWordList() {
  const { ph = '' } = useParams()
  const sound = findSound(ph)
  // The hooks live in the inner component so an unknown phoneme never renders half of them.
  if (!sound || sound.cards.length === 0) return <p>Không tìm thấy âm</p>
  return <WordList key={sound.ph} sound={sound} />
}

function WordList({ sound }: { sound: SoundGroup }) {
  const { ph, ipa, cards } = sound
  const [soundMissing, setSoundMissing] = useState(false)
  const tip = PHONEME_TIPS[ph]

  /** Generated locally and possibly not there yet — say so, never throw. */
  function playIsolated() {
    playUrl(`/audio/sounds/${ph}.mp3`).then(() => setSoundMissing(false), () => setSoundMissing(true))
  }

  return (
    <main className="h-full overflow-y-auto bg-cream-50 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        {/* One sound is a sub-level of the bậc Tập âm, and Tập âm hangs off the stairs. */}
        <BackButton to="/levels" label="Các bậc" className="self-start" />

        <header className="flex flex-col items-center gap-2 text-center">
          <div className="font-display text-[72px] font-extrabold leading-none text-coral-text">/{ipa}/</div>
          {tip && <p className="max-w-xl text-lg font-bold text-ink-500">{tip}</p>}
          <Button variant="secondary" onClick={playIsolated}>🔊 Nghe âm lẻ</Button>
          {soundMissing && <p className="text-lg font-bold text-ink-300">Chưa có audio âm này</p>}
        </header>

        <p className="text-center text-lg font-bold text-ink-500">Chọn một từ để luyện nhé!</p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {cards.map(c => (
            <Link
              key={c.id}
              to={`/sound/${ph}/${c.id}`}
              aria-label={`Từ ${c.text}`}
              className={`${CARD_LINK} min-h-[184px] justify-center`}
            >
              <span aria-hidden="true" className="text-[64px] leading-none">{c.emoji}</span>
              <span className="font-display text-[28px] font-extrabold text-ink-900">{c.text}</span>
              <span className="text-lg font-bold text-ink-300">{c.ipa}</span>
              <StarRow value={getStars(`sword:${c.id}`)} />
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
