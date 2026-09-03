import { useParams } from 'react-router-dom'
import type { Story } from '../content/stories/types'
import { findStory } from '../content/stories'
import { MISSION_ROUTE, MISSION_STATE, useMissionFlag } from '../progress/missionNav'
import { useStoryPlayer } from '../story/useStoryPlayer'
import { SceneArt } from '../components/SceneArt'
import { Karaoke } from '../components/Karaoke'
import { PlayerControls } from '../components/PlayerControls'
import { BackButton, Button, Chip, NotFound, Notice, SceneDots } from '../components/ui'
import { PageShell, PageHeader, PageBody, PageFooter } from '../components/ui/page'

export function StoryPlayer() {
  const { id = '' } = useParams()
  // Read before the guard, because the guard is exactly where it matters most: a story that cannot
  // be found has no lesson position, so `LessonChip` suppresses itself too, and an unconditional
  // "← Truyện" would leave a child mid-lesson on a dead end with no thread back at all.
  const mission = useMissionFlag()
  const story = findStory(id)
  // A child mid-lesson who hits a dead story link must land back in the lesson, not out of it.
  if (!story) return <NotFound what="truyện" to={mission ? MISSION_ROUTE : '/stories'} />
  return <StoryPlayerInner story={story} id={id} mission={mission} />
}

/**
 * `mission` is the flag the child arrived carrying — not whether today's lesson still lists this
 * story.
 *
 * The story chain names no next step of its own: the player hands on to the quiz, the quiz to the
 * retell, and only the retell (which can be a 🔁 step's own exact route) ever needs
 * `useMissionNext()` to say what comes after. So there is nothing here that has to resolve against
 * today's items, and asking anyway would be a second, weaker rule for the same fact: a lesson
 * regenerated mid-session, or persisted in an older shape, would answer "no mission" for a child
 * who is plainly in one — and drop them back in the story library, which is the very bug this chain
 * was fixed for. `SoundWordList` settled this precedent: honour the flag.
 *
 * That is also why it travels on below. `/story/:id/quiz` and `/story/:id/retell` are SUB-routes,
 * and `missionNav` matches item routes whole on purpose (see its `routeIs`), so nothing downstream
 * can rediscover the lesson for itself — if this link drops the flag, the mission dies at the first
 * question.
 */
function StoryPlayerInner({ story, id, mission }: { story: Story; id: string; mission: boolean }) {
  const p = useStoryPlayer(story)
  const scene = story.scenes[p.sceneIndex]

  const scenePct = ((p.sceneIndex + 1) / story.scenes.length) * 100

  return (
    <PageShell gutter="16">
      <PageHeader back={<BackButton to={mission ? MISSION_ROUTE : '/stories'} label={mission ? 'Nhiệm vụ' : 'Truyện'} variant="child" />}>
        {/* R23/decision 24-25: the centre cell is a two-line stack now — the scene chip on top,
            the story's own name underneath it, both inside the header. There is no longer a
            separate title block in the body, so the name has exactly one home. */}
        <div className="flex flex-col items-center">
          <Chip tone="teal" className="rounded-r12 px-3.5 py-[7px] text-[15px]">Cảnh {p.sceneIndex + 1}/{story.scenes.length}</Chip>
          <span className="text-[11px] font-bold text-ink-300">{story.emoji} {story.title}</span>
        </div>
        {/* Decorative, and it disappears below `md` — the chip above already spells the position
            out in words at every width. */}
        <SceneDots count={story.scenes.length} active={p.sceneIndex} className="hidden md:inline-flex" />
      </PageHeader>
      <PageBody className="gap-3">
        {/* The picture is the stage. The back arrow, the scene chip and the story's name now all
            live in the header — no overlay rides on the artwork any more (decision 24/25).
            On a phone it is the design's fixed `16/9` frame instead of a stretchy `flex-1` block:
            at 375×667 the flexible version had squeezed itself down to 129 px, and a fixed ratio
            means the artwork is the same shape on every phone rather than whatever is left over. */}
        <div data-testid="story-art" className="relative flex aspect-[16/9] flex-none justify-center md:aspect-auto md:max-h-[52vh] md:min-h-0 md:flex-1">
          <SceneArt emoji={scene.emoji} bg={scene.bg} image={scene.image} />
        </div>

        {/* Where the child is in the story, as a bar rather than seven dots (design M6). Solid teal,
            not `ProgressBar tone="teal"`, which is a gradient the design does not use here — and
            decorative, because the chip in the header already says "Cảnh 2/4" in words. */}
        <div data-testid="scene-progress" aria-hidden="true" className="h-[11px] w-full shrink-0 overflow-hidden rounded-full bg-[#F1E7D4] md:hidden">
          <div className="h-full rounded-full bg-teal-500 transition-[width] duration-300" style={{ width: `${scenePct}%` }} />
        </div>

        {/* The tap hint used to float as a pill over the artwork on the landscape frame; decision
            25 lifts it out to a plain line above the karaoke on EVERY frame — one rule instead of
            two, and nothing sits on top of the picture any more.
            It still drops at 375×667 (`short:`), the one thing this screen gives up when the
            fixed-ratio picture costs 66 px more than the old stretchy one: the words below are
            visibly buttons, so the hint is the least load-bearing line on the frame. It also
            steps aside for either audio-state `Notice` below — one line of "how to use this
            screen" beats two competing for the same spot between the bar and the karaoke. */}
        {!p.hasTimings || (!p.hasAudio && p.playing) ? null : (
          <p className="text-center text-[13px] font-extrabold text-teal-600 short:hidden">👆 Chạm 1 từ để nghe lại</p>
        )}

        {/* No timings at all means gen-story.mjs has not run: the karaoke is on the estimated clock.
            Timings but no playing audio is a different problem (missing mp3, blocked autoplay) —
            R23: both become a 44px `Notice`, sitting between the progress bar and the karaoke in
            place of the tap hint, the error one carrying a "Thử lại" action into `retry()`. */}
        {!p.hasTimings ? (
          <Notice kind="info" title="Chưa có giọng đọc — chữ chạy theo nhịp ước lượng" />
        ) : !p.hasAudio && p.playing ? (
          <Notice kind="error" title="🔇 Không phát được giọng đọc" action={{ label: 'Thử lại', onClick: p.retry }} />
        ) : null}

        <Karaoke
          words={scene.words}
          activeIndex={p.wordIndex}
          subtitle={p.subtitles ? scene.textVi : undefined}
          onWordTap={p.replayWord}
          className="max-md:flex-1 max-md:justify-center"
        />

        <PlayerControls
          playing={p.playing}
          rate={p.rate}
          subtitles={p.subtitles}
          sceneIndex={p.sceneIndex}
          sceneCount={story.scenes.length}
          dots={false}
          onToggle={p.toggle}
          onRate={() => p.setRate(p.rate === 1 ? 0.75 : 1)}
          onPrev={p.prevScene}
          onNext={p.nextScene}
          onSubtitles={p.toggleSubtitles}
        />
      </PageBody>

      <PageFooter>
        {/* The quiz is always one tap away; once the story ends the same link stops whispering
            and starts pulsing. */}
        {p.ended ? (
          <Button to={`/story/${id}/quiz`} state={mission ? MISSION_STATE : undefined} pulse className="mx-auto">Tiếp tục ▸</Button>
        ) : (
          <Button to={`/story/${id}/quiz`} state={mission ? MISSION_STATE : undefined} variant="ghost" className="mx-auto">Bỏ qua ▸</Button>
        )}
      </PageFooter>
    </PageShell>
  )
}
