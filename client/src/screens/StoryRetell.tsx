import { useEffect } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import type { Story } from '../content/stories/types'
import type { PronunciationResult } from '../scoring/types'
import { findStory } from '../content/stories'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { useMissionNext } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { playUrl, playBlob } from '../audio/player'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { MicButton } from '../components/MicButton'
import { Stars } from '../components/Stars'
import { Foxy } from '../components/Foxy'
import type { FoxyMood } from '../components/Foxy'
import { BackButton, Button, Card, PAGE_SHELL } from '../components/ui'
import { retellStars, RETELL_MESSAGE } from '../story/retellStars'
import { speakText } from '../story/speak'

export function StoryRetell() {
  const { id = '' } = useParams()
  const story = findStory(id)
  if (!story) {
    return (
      <main className={`h-full overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}>
        <p className="mb-4 font-display text-2xl font-extrabold text-ink-900">Không tìm thấy truyện</p>
        <BackButton to="/stories" label="Truyện" />
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
  /**
   * Two different ways this screen can be inside a lesson, and they are not the same fact.
   *
   * `/story/:id/retell` is a SUB-route of the 🎧 listen step's `/story/:id`, and `missionNav`
   * matches item routes whole on purpose (its `routeIs`), so a child who walked the story chain
   * from the mission resolves nothing here — the flag forwarded down the chain is all there is.
   *
   * The very same path is ALSO a 🔁 review step's own exact route, and on a day whose lesson holds
   * that step the hand-off *does* resolve: it knows which item comes next and what to call the
   * button. That is worth more to the child than a bare trip back to the mission card, so it is
   * preferred wherever it exists, exactly as on every other practice screen.
   */
  const mission = useMissionNext()
  const { state } = useLocation()
  const inMission = mission !== null || (state as { mission?: unknown } | null)?.mission === true

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
    // The safe-area shell, resting at this screen's own `py-5`: the not-found fallback above got
    // it in task 7 and the screen itself was missed, so on an iPhone the header ran under the
    // notch. With no inset to clear it is the same 20 px it has always been.
    <main className={`h-full overflow-y-auto bg-cream-50 px-6 [--page-pad-bottom:1.25rem] [--page-pad-top:1.25rem] ${PAGE_SHELL}`}>
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center gap-4">
        <header className="flex w-full items-center justify-between gap-4">
          <BackButton to={inMission ? '/mission' : '/stories'} label={inMission ? 'Nhiệm vụ' : 'Truyện'} />
          <h1 className="font-display text-[36px] font-extrabold leading-tight text-ink-900">Bé kể lại nhé</h1>
          <span className="min-w-[66px] text-right text-base font-bold text-ink-300">
            {a.engine === 'webspeech' ? 'chế độ đơn giản' : ''}
          </span>
        </header>

        <Card className="flex w-full max-w-2xl flex-col items-center gap-3 px-8 py-7">
          <p className="text-center font-display text-[40px] font-extrabold leading-tight text-ink-900">{story.retell.text}</p>
          <p className="text-center text-xl font-bold text-ink-500">{story.retell.textVi}</p>
          <button
            type="button"
            aria-label="Nghe mẫu"
            onClick={() => playSample(story)}
            className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-teal-500 text-3xl text-white shadow-chunky-teal active:translate-y-[2px]"
          >
            <span aria-hidden="true">🔊</span>
          </button>
        </Card>

        {a.error && <p className="font-display text-2xl font-extrabold text-fix-700">{a.error}</p>}

        {stars !== null && (
          <section className="flex flex-col items-center gap-4">
            <Stars value={stars} animate={stars === 3} />
            <p className="font-display text-3xl font-extrabold text-ink-900">{RETELL_MESSAGE[stars]}</p>
            <div className="flex flex-wrap justify-center gap-4">
              {a.lastBlob && (
                <Button variant="outline" onClick={() => playBlob(a.lastBlob!).catch(() => {})}>🎧 Nghe mình</Button>
              )}
              <Button variant="outline" onClick={a.reset}>Thử lại</Button>
              {/* The end of the story chain. In a lesson it hands the child on rather than out:
                  the next step when this route is the lesson's own (so the hand-off knows one),
                  the mission card otherwise. Free play still ends back on the story list. */}
              {mission
                ? <Button size="lg" pulse onClick={mission.go}>{mission.label}</Button>
                : inMission
                  ? <Button size="lg" pulse to="/mission">Về nhiệm vụ →</Button>
                  : <Button size="lg" pulse to="/stories">Về danh sách truyện</Button>}
            </div>
          </section>
        )}

        <div className="flex items-end gap-6 pb-2">
          <Foxy mood={mood} size="sm" />
          <MicButton state={a.micState} level={a.level} onPress={a.onMic} />
        </div>
      </div>
    </main>
  )
}
