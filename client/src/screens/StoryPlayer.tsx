import { useParams } from 'react-router-dom'
import type { Story } from '../content/stories/types'
import { findStory } from '../content/stories'
import { MISSION_ROUTE, MISSION_STATE, useMissionFlag } from '../progress/missionNav'
import { useStoryPlayer } from '../story/useStoryPlayer'
import { SceneArt } from '../components/SceneArt'
import { Karaoke } from '../components/Karaoke'
import { PlayerControls } from '../components/PlayerControls'
import { BackButton, Button, Chip, NotFound, SceneDots } from '../components/ui'
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
        {/* Visible at every width — the dots beside it are decorative and disappear below `md`, so
            the chip is the one thing that always spells out where the child is. */}
        <Chip tone="neutral">Cảnh {p.sceneIndex + 1}/{story.scenes.length}</Chip>
        <SceneDots count={story.scenes.length} active={p.sceneIndex} className="hidden md:inline-flex" />
      </PageHeader>
      <PageBody className="gap-3">
        {/* Design M6 has no text header at all: the picture is the whole top of the frame. The
            title stays in the DOM (and in the landscape layout) — it is only the 50 px it costs
            that the phone cannot afford. */}
        <div data-testid="story-title" className="hidden text-center md:block">
          <h1 className="font-display text-2xl font-extrabold leading-tight text-ink-900">{story.title}</h1>
          <p className="text-sm font-bold text-ink-500">{story.titleVi}</p>
        </div>

        {/* The picture is the stage. The back arrow and the scene chip now live in the header —
            only the tap hint still rides on the artwork.
            On a phone it is the design's fixed `16/9` frame instead of a stretchy `flex-1` block:
            at 375×667 the flexible version had squeezed itself down to 129 px, and a fixed ratio
            means the artwork is the same shape on every phone rather than whatever is left over. */}
        <div data-testid="story-art" className="relative flex aspect-[16/9] flex-none justify-center md:aspect-auto md:max-h-[52vh] md:min-h-0 md:flex-1">
          <SceneArt emoji={scene.emoji} bg={scene.bg} image={scene.image} />
          <span className="absolute bottom-4 right-4 rounded-full bg-white/95 px-4 py-2 font-display text-[17px] font-extrabold text-teal-600 shadow-card-sm max-md:hidden">
            👆 Chạm vào 1 từ để nghe lại
          </span>
        </div>

        {/* Where the child is in the story, as a bar rather than seven dots (design M6). Solid teal,
            not `ProgressBar tone="teal"`, which is a gradient the design does not use here — and
            decorative, because the chip in the header already says "Cảnh 2/4" in words. */}
        <div data-testid="scene-progress" aria-hidden="true" className="h-[11px] w-full shrink-0 overflow-hidden rounded-full bg-[#F1E7D4] md:hidden">
          <div className="h-full rounded-full bg-teal-500 transition-[width] duration-300" style={{ width: `${scenePct}%` }} />
        </div>

        {/* The hint the landscape frame floats over the picture: on a phone the picture is 204 px
            tall and a pill in its corner would sit on the artwork, so the design lifts it out as a
            line above the words. One of the two always has `display:none`.
            It is also the one thing this screen drops at 375×667, where a fixed-ratio picture costs
            66 px more than the stretchy one did: the words below are visibly buttons and each is a
            64 px target, so the hint is the least load-bearing line on the frame. The query names
            its own width bound, because a height query alone would also catch a short laptop
            window — where the landscape layout is the one being rendered. */}
        <p className="text-center text-[13px] font-extrabold text-teal-600 [@media(max-width:767px)_and_(max-height:700px)]:hidden md:hidden">👆 Chạm 1 từ để nghe lại</p>

        <Karaoke
          words={scene.words}
          activeIndex={p.wordIndex}
          subtitle={p.subtitles ? scene.textVi : undefined}
          onWordTap={p.replayWord}
          className="max-md:flex-1 max-md:justify-center"
        />

        {/* No timings at all means gen-story.mjs has not run: the karaoke is on the estimated clock.
            Timings but no playing audio is a different problem (missing mp3, blocked autoplay). */}
        {!p.hasTimings ? (
          <p className="text-center text-sm font-bold text-ink-300">
            Chưa có giọng đọc — chữ chạy theo nhịp ước lượng
          </p>
        ) : !p.hasAudio && p.playing ? (
          <p className="text-center text-sm font-bold text-ink-300">Không phát được giọng đọc</p>
        ) : null}

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
