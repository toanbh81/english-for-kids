import { useParams } from 'react-router-dom'
import type { Story } from '../content/stories/types'
import { findStory } from '../content/stories'
import { useStoryPlayer } from '../story/useStoryPlayer'
import { SceneArt } from '../components/SceneArt'
import { Karaoke } from '../components/Karaoke'
import { PlayerControls } from '../components/PlayerControls'
import { BackButton, Button, Chip, SceneDots } from '../components/ui'

export function StoryPlayer() {
  const { id = '' } = useParams()
  const story = findStory(id)
  if (!story) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-6 bg-cream-50 p-8">
        <p className="font-display text-3xl font-extrabold text-ink-900">Không tìm thấy truyện</p>
        <Button to="/stories" variant="outline">← Truyện</Button>
      </main>
    )
  }
  return <StoryPlayerInner story={story} id={id} />
}

function StoryPlayerInner({ story, id }: { story: Story; id: string }) {
  const p = useStoryPlayer(story)
  const scene = story.scenes[p.sceneIndex]

  return (
    <main className="flex h-full flex-col gap-3 overflow-y-auto bg-cream-50 p-4">
      <header className="text-center">
        <h1 className="font-display text-2xl font-extrabold leading-tight text-ink-900">{story.title}</h1>
        <p className="text-sm font-bold text-ink-500">{story.titleVi}</p>
      </header>

      {/* The picture is the stage: back button, scene pills and the tap hint ride on top of it
          so the words below never lose room on a short landscape screen. */}
      <div className="relative flex max-h-[52vh] min-h-0 flex-1 justify-center">
        <SceneArt emoji={scene.emoji} bg={scene.bg} image={scene.image} />
        <BackButton to="/stories" label="Truyện" className="absolute left-4 top-4" />
        <div className="absolute right-4 top-4 flex items-center gap-2">
          {/* The dots beside it are decorative, so the chip carries the position in words. */}
          <Chip tone="neutral" className="bg-white/95 shadow-card-sm">
            Cảnh<span className="sr-only"> {p.sceneIndex + 1}/{story.scenes.length}</span>
          </Chip>
          <SceneDots count={story.scenes.length} active={p.sceneIndex} className="!bg-white/95" />
        </div>
        <span className="absolute bottom-4 right-4 rounded-full bg-white/95 px-4 py-2 font-display text-[17px] font-extrabold text-teal-600 shadow-card-sm">
          👆 Chạm vào 1 từ để nghe lại
        </span>
      </div>

      <Karaoke
        words={scene.words}
        activeIndex={p.wordIndex}
        subtitle={p.subtitles ? scene.textVi : undefined}
        onWordTap={p.replayWord}
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
        musicOn={p.musicOn}
        subtitles={p.subtitles}
        sceneIndex={p.sceneIndex}
        sceneCount={story.scenes.length}
        dots={false}
        onToggle={p.toggle}
        onRate={() => p.setRate(p.rate === 1 ? 0.75 : 1)}
        onPrev={p.prevScene}
        onNext={p.nextScene}
        onMusic={p.toggleMusic}
        onSubtitles={p.toggleSubtitles}
      />

      {/* The quiz is always one tap away; once the story ends the same link stops whispering
          and starts pulsing. */}
      {p.ended ? (
        <Button to={`/story/${id}/quiz`} pulse className="mx-auto">Tiếp tục ▸</Button>
      ) : (
        <Button to={`/story/${id}/quiz`} variant="ghost" className="mx-auto">Bỏ qua ▸</Button>
      )}
    </main>
  )
}
