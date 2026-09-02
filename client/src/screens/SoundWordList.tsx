import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { findSound } from '../content'
import type { SoundGroup } from '../content/types'
import { playUrl } from '../audio/player'
import { PHONEME_TIPS } from '../scoring/feedback'
import { getStars } from '../progress/store'
import { MISSION_STATE } from '../progress/missionNav'
import { BackButton, Button, CARD_LINK, NotFound, StarRow } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

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
  if (!sound || sound.cards.length === 0) return <NotFound what="âm" />
  return <WordList key={sound.ph} sound={sound} />
}

function WordList({ sound }: { sound: SoundGroup }) {
  const { ph, ipa, cards } = sound
  const { state } = useLocation()
  /**
   * The list is not a step of any lesson — but a lesson persisted YESTERDAY still holds
   * `/sound/<ph>` items, and tapping one lands the child here still carrying the flag. Without
   * this the screen offers only "Các bậc", `LessonChip` suppresses itself as redundant, and the
   * child is stranded in the middle of that day's mission. So the flag is honoured where it
   * matters: the way out goes back to the mission, and it travels on into the word the child
   * picks, which IS a step and knows what to do with it.
   */
  const mission = (state as { mission?: unknown } | null)?.mission === true
  const [soundMissing, setSoundMissing] = useState(false)
  const tip = PHONEME_TIPS[ph]

  /** Generated locally and possibly not there yet — say so, never throw. */
  function playIsolated() {
    playUrl(`/audio/sounds/${ph}.mp3`).then(() => setSoundMissing(false), () => setSoundMissing(true))
  }

  // The design draws no frame for this screen (brief §14 Q19), so it follows the speak family it
  // belongs to: everything the drill next door does — the sound tier's warm card, its 40 px
  // symbol, its round speaker button — so the two screens read as one place. From 768 up every
  // one of those is handed back to what it was.
  return (
    <PageShell>
      {/* One sound is a sub-level of the bậc Tập âm, and Tập âm hangs off the stairs — unless
          the child got here from a stale mission step, which has its own way home. */}
      <PageHeader back={mission
        ? <BackButton to="/mission" label="Nhiệm vụ" />
        : <BackButton to="/levels" label="Các bậc" />}
      />
      <PageBody>
        <div className="flex w-full flex-col items-start gap-2 rounded-[24px] bg-[#FFF1E6] px-4 py-3.5 text-left shadow-[0_6px_0_#F2DFC9] md:items-center md:rounded-none md:bg-transparent md:p-0 md:text-center md:shadow-none">
          {/* The symbol and its speaker share a line on a phone, with the tip under them. From 768
              up the wrapper stops being a box at all (`md:contents`) and all four go back to being
              children of the header — in the header's own order, which puts the tip between the
              symbol and the button. That is what the `md:order-*` are for: they restore the
              reading order the stacked layout had, not a new one. */}
          <div className="flex w-full flex-wrap items-center gap-3.5 md:contents">
            <div className="flex-1 font-display text-[40px] font-extrabold leading-none text-[#C08457] md:order-1 md:flex-initial md:text-[72px] md:text-coral-text">/{ipa}/</div>
            <Button
              variant="secondary"
              aria-label="Nghe âm lẻ"
              onClick={playIsolated}
              className="shrink-0 max-md:h-16 max-md:w-16 max-md:rounded-full max-md:px-0 max-md:text-[26px] md:order-3 md:shrink"
            >
              <span aria-hidden="true" className="md:hidden">🔊</span>
              <span aria-hidden="true" className="hidden md:inline">🔊 Nghe âm lẻ</span>
            </Button>
            {soundMissing && <p className="w-full text-sm font-bold text-ink-300 md:order-4 md:w-auto md:text-lg">Chưa có audio âm này</p>}
          </div>
          {tip && <p className="max-w-xl text-sm font-bold leading-relaxed text-sun-700 md:order-2 md:text-lg md:leading-7 md:text-ink-500">{tip}</p>}
        </div>

        <p className="mt-3 text-base font-bold text-ink-500 md:mt-5 md:text-center md:text-lg">Chọn một từ để luyện nhé!</p>

        {/* A row per word on a phone — the emoji, the word and its stars read across in 96 px
            instead of down in 184, which is what puts all three cards plus the sound above the
            fold on an 844 px screen. The three-column deck of tiles is untouched from 768 up. */}
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:mt-5 md:grid-cols-3 md:gap-5">
          {cards.map(c => (
            <Link
              key={c.id}
              to={`/sound/${ph}/${c.id}`}
              state={mission ? MISSION_STATE : undefined}
              aria-label={`Từ ${c.text}`}
              // `max-md:flex-row` and `max-md:py-3`, not plain `flex-row`/`py-3`: `CARD_LINK`
              // writes `flex-col` and `p-6` into the same unprefixed layer, and which of two
              // unprefixed utilities wins is Tailwind's ordering, not ours. A `max-md:` rule is
              // emitted after every plain utility, so it wins — and it cannot reach 768 up.
              className={`${CARD_LINK} min-h-[96px] justify-start gap-3.5 px-4 max-md:flex-row max-md:py-3 md:min-h-[184px] md:justify-center md:gap-2 md:px-6`}
            >
              <span aria-hidden="true" className="text-[40px] leading-none md:text-[64px]">{c.emoji}</span>
              <span className="flex flex-1 flex-col items-start md:flex-initial md:items-center md:gap-2">
                <span className="font-display text-[22px] font-extrabold text-ink-900 md:text-[28px]">{c.text}</span>
                <span className="text-sm font-bold text-ink-300 md:text-lg">{c.ipa}</span>
              </span>
              <StarRow value={getStars(`sword:${c.id}`)} />
            </Link>
          ))}
        </div>
      </PageBody>
    </PageShell>
  )
}
