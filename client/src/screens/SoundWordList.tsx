import { useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { findSound, SOUNDS } from '../content'
import type { SoundGroup } from '../content/types'
import { playUrl } from '../audio/player'
import { PHONEME_TIPS } from '../scoring/feedback'
import { getStars } from '../progress/store'
import { MISSION_STATE } from '../progress/missionNav'
import { BackButton, Chip, NotFound, Tile } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { SoundTier, SpeakPrompt } from '../components/speak'

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
  const soundIndex = SOUNDS.findIndex(s => s.ph === ph)
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

  return (
    <PageShell>
      {/* One sound is a sub-level of the bậc Tập âm, and Tập âm hangs off the stairs — unless
          the child got here from a stale mission step, which has its own way home. */}
      <PageHeader back={mission
        ? <BackButton to="/mission" label="Nhiệm vụ" />
        : <BackButton to="/levels" label="Các bậc" />}
      >
        <Chip tone="teal">Âm {soundIndex + 1}/{SOUNDS.length}</Chip>
      </PageHeader>
      {/* No mic on this screen (brief §2 B2) — a plain `PageBody`, one column even on iPad. */}
      <PageBody>
        <div className="flex w-full flex-col items-center gap-3 md:gap-5">
          <SoundTier ph={ph} ipa={ipa} tip={tip} onPlay={playIsolated} audioMissing={soundMissing} mdWide />

          <p className="text-base font-bold text-ink-500 md:text-center md:text-lg">Chọn một từ để luyện nhé!</p>

          {/* Always 3 columns — on a phone the tiles simply size to the track; on iPad the track
              itself is 3 fixed 200px columns (not a stretched `md:grid-cols-3`), so the deck reads
              as a small centred group rather than three tiles pulled apart across 640px. */}
          <div className="grid w-full grid-cols-3 gap-2.5 md:w-auto md:grid-cols-[repeat(3,200px)] md:justify-center md:gap-5">
            {cards.map(c => (
              <Tile
                key={c.id}
                to={`/sound/${ph}/${c.id}`}
                state={mission ? MISSION_STATE : undefined}
                ariaLabel={`Từ ${c.text}`}
                emoji={c.emoji}
                title={c.text}
                sub={c.ipa}
                subTone="sand"
                stars={getStars(`sword:${c.id}`)}
                className="md:h-[180px] md:w-[200px]"
              />
            ))}
          </div>

          {/* Foxy fills the empty space below the grid rather than the tiles being stretched to
              reach it (brief §2 B2 "Foxy … lấp chỗ trống thay vì kéo ô"). */}
          <SpeakPrompt mood="idle" say="Luyện đủ 3 từ để xanh cả âm!" />
        </div>
      </PageBody>
    </PageShell>
  )
}
