import { useParams } from 'react-router-dom'
import type { Story } from '../content/stories/types'
import { findStory } from '../content/stories'
import { MISSION_STATE, useMissionNext } from '../progress/missionNav'
import { useStoryPlayer } from '../story/useStoryPlayer'
import { SceneArt } from '../components/SceneArt'
import { Karaoke } from '../components/Karaoke'
import { PlayerControls } from '../components/PlayerControls'
import { BackButton, Button, Chip, PAGE_SHELL, SceneDots } from '../components/ui'

export function StoryPlayer() {
  const { id = '' } = useParams()
  const story = findStory(id)
  if (!story) {
    return (
      <main className={`flex h-full flex-col items-center justify-center gap-6 bg-cream-50 px-8 [--page-pad-bottom:2rem] [--page-pad-top:2rem] ${PAGE_SHELL}`}>
        <p className="font-display text-3xl font-extrabold text-ink-900">Không tìm thấy truyện</p>
        <Button to="/stories" variant="outline">← Truyện</Button>
      </main>
    )
  }
  return <StoryPlayerInner story={story} id={id} />
}

function StoryPlayerInner({ story, id }: { story: Story; id: string }) {
  const p = useStoryPlayer(story)
  /**
   * Null unless the child arrived from today's lesson. The 🎧 step's route is exactly this one, so
   * the hand-off resolves here and the story can behave like every other practice screen: the
   * arrow leads back to the mission rather than out of the lesson into the story library.
   *
   * The chain past this screen is the reason the flag is also forwarded below. `/story/:id/quiz`
   * and `/story/:id/retell` are SUB-routes, and `missionNav` matches item routes whole on purpose
   * (see its `routeIs`), so nothing downstream can rediscover the lesson for itself — if this link
   * drops the flag, the mission dies at the first question.
   */
  const mission = useMissionNext()
  const scene = story.scenes[p.sceneIndex]

  const scenePct = ((p.sceneIndex + 1) / story.scenes.length) * 100

  return (
    // 14 px of side frame on a phone — the narrowest in the design, "để tranh rộng" (§1) — and the
    // 16 px `p-4` this screen has always had from 768 up. The safe-area shell rests on that same
    // 1 rem, so with no notch to clear the vertical padding is unchanged too.
    <main className={`flex h-full flex-col gap-3 overflow-y-auto bg-cream-50 px-3.5 [--page-pad-bottom:1rem] [--page-pad-top:1rem] [@media(max-width:767px)_and_(max-height:700px)]:gap-2 md:px-4 ${PAGE_SHELL}`}>
      {/* Design M6 has no text header at all: the picture is the whole top of the frame. The
          title stays in the DOM (and in the landscape layout) — it is only the 50 px it costs
          that the phone cannot afford. */}
      <header className="hidden text-center md:block">
        <h1 className="font-display text-2xl font-extrabold leading-tight text-ink-900">{story.title}</h1>
        <p className="text-sm font-bold text-ink-500">{story.titleVi}</p>
      </header>

      {/* The picture is the stage: back button, scene pills and the tap hint ride on top of it
          so the words below never lose room on a short landscape screen.
          On a phone it is the design's fixed `16/9` frame instead of a stretchy `flex-1` block:
          at 375×667 the flexible version had squeezed itself down to 129 px, and a fixed ratio
          means the artwork is the same shape on every phone rather than whatever is left over. */}
      <div className="relative flex aspect-[16/9] flex-none justify-center md:aspect-auto md:max-h-[52vh] md:min-h-0 md:flex-1">
        <SceneArt emoji={scene.emoji} bg={scene.bg} image={scene.image} />
        {/* 64 px, not 48: the spec's binding rules put the tap-target floor at 64 with no
            exception, and this arrow rides on the artwork where it is easiest to miss. */}
        <BackButton
          to={mission ? '/mission' : '/stories'}
          label={mission ? 'Nhiệm vụ' : 'Truyện'}
          className="absolute left-2.5 top-2.5 max-md:h-16 max-md:w-16 max-md:text-2xl md:left-4 md:top-4"
        />
        <div className="absolute right-2.5 top-2.5 flex items-center gap-2 md:right-4 md:top-4">
          {/* The dots beside it are decorative, so the chip carries the position in words — and
              once the dots are gone below 768 the chip prints that position instead of only
              spelling it out, which is the design's "Cảnh 2/4" pill. */}
          <Chip tone="neutral" className="bg-white/95 shadow-card-sm max-md:px-3 max-md:py-1.5 max-md:text-[13px]">
            Cảnh<span className="md:sr-only"> {p.sceneIndex + 1}/{story.scenes.length}</span>
          </Chip>
          <SceneDots count={story.scenes.length} active={p.sceneIndex} className="!bg-white/95 max-md:hidden" />
        </div>
        <span className="absolute bottom-4 right-4 rounded-full bg-white/95 px-4 py-2 font-display text-[17px] font-extrabold text-teal-600 shadow-card-sm max-md:hidden">
          👆 Chạm vào 1 từ để nghe lại
        </span>
      </div>

      {/* Where the child is in the story, as a bar rather than seven dots (design M6). Solid teal,
          not `ProgressBar tone="teal"`, which is a gradient the design does not use here — and
          decorative, because the chip on the picture already says "Cảnh 2/4" in words. */}
      <div aria-hidden="true" className="h-[11px] w-full shrink-0 overflow-hidden rounded-full bg-[#F1E7D4] md:hidden">
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

      {/* The quiz is always one tap away; once the story ends the same link stops whispering
          and starts pulsing. */}
      {p.ended ? (
        <Button to={`/story/${id}/quiz`} state={mission ? MISSION_STATE : undefined} pulse className="mx-auto">Tiếp tục ▸</Button>
      ) : (
        <Button to={`/story/${id}/quiz`} state={mission ? MISSION_STATE : undefined} variant="ghost" className="mx-auto">Bỏ qua ▸</Button>
      )}
    </main>
  )
}
