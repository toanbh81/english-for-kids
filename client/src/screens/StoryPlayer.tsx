import { Link, useParams } from 'react-router-dom'
import type { Story } from '../content/stories/types'
import { findStory } from '../content/stories'
import { useStoryPlayer } from '../story/useStoryPlayer'
import { SceneArt } from '../components/SceneArt'
import { Karaoke } from '../components/Karaoke'
import { PlayerControls } from '../components/PlayerControls'

export function StoryPlayer() {
  const { id = '' } = useParams()
  const story = findStory(id)
  if (!story) {
    return (
      <main className="p-8">
        <p className="text-2xl mb-4">Không tìm thấy truyện</p>
        <Link to="/stories" className="text-2xl inline-flex items-center min-h-[64px] px-4">← Truyện</Link>
      </main>
    )
  }
  return <StoryPlayerInner story={story} id={id} />
}

function StoryPlayerInner({ story, id }: { story: Story; id: string }) {
  const p = useStoryPlayer(story)
  const scene = story.scenes[p.sceneIndex]

  return (
    <main className="h-full flex flex-col p-4 gap-3">
      <div className="w-full flex items-center justify-between">
        <Link to="/stories" className="text-2xl inline-flex items-center min-h-[64px] px-4">← Truyện</Link>
        <div className="text-center">
          <div className="text-3xl font-extrabold">{story.title}</div>
          <div className="text-lg text-slate-500">{story.titleVi}</div>
        </div>
        <div className="min-w-[64px]" />
      </div>

      <div className="flex-1 max-h-[60vh] flex">
        <SceneArt emoji={scene.emoji} bg={scene.bg} image={scene.image} />
      </div>

      <Karaoke
        words={scene.words}
        activeIndex={p.wordIndex}
        subtitle={p.subtitles ? scene.textVi : undefined}
        onWordTap={p.replayWord}
      />

      {!p.hasAudio && (
        <p className="text-center text-sm text-slate-400">
          Chưa có giọng đọc — chữ chạy theo nhịp ước lượng
        </p>
      )}

      <PlayerControls
        playing={p.playing}
        rate={p.rate}
        musicOn={p.musicOn}
        subtitles={p.subtitles}
        sceneIndex={p.sceneIndex}
        sceneCount={story.scenes.length}
        onToggle={p.toggle}
        onRate={() => p.setRate(p.rate === 1 ? 0.75 : 1)}
        onPrev={p.prevScene}
        onNext={p.nextScene}
        onMusic={p.toggleMusic}
        onSubtitles={p.toggleSubtitles}
      />

      {p.ended && (
        <Link
          to={`/story/${id}/quiz`}
          className="mx-auto min-h-[64px] inline-flex items-center justify-center px-6 rounded-2xl bg-coral text-white text-2xl font-extrabold active:scale-95"
        >
          Trả lời câu hỏi →
        </Link>
      )}
    </main>
  )
}
