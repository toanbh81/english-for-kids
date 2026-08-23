import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Story } from '../content/stories/types'
import type { PronunciationResult } from '../scoring/types'
import { findStory } from '../content/stories'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { saveRecording } from '../progress/recordings'
import { playUrl, playBlob } from '../audio/player'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { retellStars, RETELL_MESSAGE } from '../story/retellStars'
import { speakText } from '../story/speak'

const TAP_TARGET = 'min-h-[64px] min-w-[64px] flex items-center'

export function StoryRetell() {
  const { id = '' } = useParams()
  const story = findStory(id)
  if (!story) {
    return (
      <main className="p-8">
        <p className="text-2xl mb-4">Không tìm thấy truyện</p>
        <Link to="/stories" className={`text-2xl px-4 ${TAP_TARGET}`}>← Truyện</Link>
      </main>
    )
  }
  return <StoryRetellInner story={story} id={id} />
}

/** The scene whose narration matches the retell sentence, if any — used to reuse its recorded
 * audio instead of falling back to the robot voice. */
function findRetellScene(story: Story) {
  return story.scenes.find(s => s.text.includes(story.retell.text))
}

function hasCompleteTimings(scene: Story['scenes'][number] | undefined): boolean {
  return !!scene && scene.words.length > 0 && scene.words.every(w => w.start !== undefined && w.end !== undefined)
}

/** Prefer the story's own recorded narration; fall back to the browser's TTS voice; else stay silent
 * rather than throw, since neither audio nor speech synthesis is guaranteed to be available. */
function playSample(story: Story) {
  const scene = findRetellScene(story)
  if (hasCompleteTimings(scene)) {
    playUrl(scene!.audio).catch(() => {})
  } else {
    speakText(story.retell.text) // no-op without speech synthesis; cancels any queued utterance
  }
}

function StoryRetellInner({ story, id }: { story: Story; id: string }) {
  function handleResult(result: PronunciationResult, blob: Blob | null) {
    logActivity({ ts: Date.now(), kind: 'sentence', id: `retell:${id}`, score: result.overall })
    if (blob) saveRecording({ id: `retell:${id}:${Date.now()}`, ts: Date.now(), text: story.retell.text, blob }).catch(() => {})
  }

  // A whole sentence takes a young child longer than a single word, so give the retell the
  // recorder's full 8 s window instead of the 6 s default.
  const a = useSpeakingAttempt({ targetText: story.retell.text, resetKey: id, autoStopMs: 8000, onResult: handleResult })
  const stars = a.result ? retellStars(a.result.overall) : null

  useEffect(() => {
    if (a.result) setStars(`retell:${id}`, retellStars(a.result.overall))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.result])

  const mood: FoxyMood = a.micState === 'recording'
    ? 'listening'
    : stars === 3 ? 'cheer' : stars === 2 ? 'happy' : 'idle'

  return (
    <main className="h-full overflow-y-auto flex flex-col items-center p-6 gap-4">
      <div className="w-full flex justify-between text-xl">
        <Link to="/stories" className={`${TAP_TARGET} px-4`}>← Truyện</Link>
        <span className="text-slate-400">{a.engine === 'webspeech' ? 'chế độ đơn giản' : ''}</span>
      </div>

      <p className="text-3xl font-extrabold text-center">Bé kể lại nhé</p>

      <div className="flex flex-col items-center gap-3">
        <p className="text-5xl font-extrabold text-center">{story.retell.text}</p>
        <p className="text-2xl text-slate-500 text-center">{story.retell.textVi}</p>
        <button
          type="button"
          onClick={() => playSample(story)}
          className="w-16 h-16 rounded-full bg-teal text-white text-3xl active:scale-95"
        >
          🔊
        </button>
      </div>

      {a.error && <p className="text-2xl text-fix">{a.error}</p>}

      {stars !== null && (
        <section className="flex flex-col items-center gap-4">
          <Stars value={stars} animate={stars === 3} />
          <p className="text-3xl font-extrabold">{RETELL_MESSAGE[stars]}</p>
          <div className="flex gap-4 text-xl flex-wrap justify-center">
            {a.lastBlob && (
              <button
                onClick={() => playBlob(a.lastBlob!).catch(() => {})}
                className={`px-6 rounded-2xl bg-white shadow ${TAP_TARGET}`}
              >
                🎧 Nghe mình
              </button>
            )}
            <button onClick={a.reset} className={`px-6 rounded-2xl bg-white shadow ${TAP_TARGET}`}>
              Thử lại
            </button>
            <Link
              to="/stories"
              className={`px-6 rounded-2xl bg-coral text-white font-extrabold justify-center ${TAP_TARGET}`}
            >
              Về danh sách truyện
            </Link>
          </div>
        </section>
      )}

      <Foxy mood={mood} />
      <MicButton state={a.micState} level={a.level} onPress={a.onMic} />
    </main>
  )
}
