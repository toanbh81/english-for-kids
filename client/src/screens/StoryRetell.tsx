import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import type { Story } from '../content/stories/types'
import type { PronunciationResult } from '../scoring/types'
import { findStory } from '../content/stories'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { MISSION_ROUTE, RETURN_LABEL, useMissionFlag, useMissionNext } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { playUrl, playBlob } from '../audio/player'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { useSpeakErrorAction } from '../speaking/useSpeakErrorAction'
import { MicButton, ResultCard, SpeakError } from '../components/speak'
import { BackButton, Card, NotFound } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { retellStars, RETELL_MESSAGE } from '../story/retellStars'
import { speakText } from '../story/speak'

/** A whole sentence takes a young child longer than a single word, so this gets the recorder's
 * full 8 s window instead of the 6 s default. */
const AUTO_STOP_MS = 8000

export function StoryRetell() {
  const { id = '' } = useParams()
  // Before the guard: a story that cannot be found has no lesson position, so `LessonChip`
  // suppresses itself here too and this arrow is the only way off the screen.
  const mission = useMissionFlag()
  const story = findStory(id)
  // A child mid-lesson who hits a dead story link must land back in the lesson, not out of it.
  if (!story) return <NotFound what="truyện" to={mission ? MISSION_ROUTE : '/stories'} />
  return <StoryRetellInner story={story} id={id} inMission={mission} />
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

/**
 * `inMission` is the flag; `mission` is the hand-off, and it is strictly narrower — `useMissionNext`
 * needs the flag too, so it can never resolve where `inMission` is false.
 *
 * They differ because `/story/:id/retell` is two things. It is a SUB-route of the 🎧 listen step's
 * `/story/:id`, and `missionNav` matches item routes whole on purpose (its `routeIs`), so a child
 * who walked the story chain here resolves nothing — the forwarded flag is all there is, and it is
 * enough to know where "back" goes. But the very same path is ALSO a 🔁 review step's own exact
 * route, and on a day whose lesson holds that step the hand-off *does* resolve.
 */
function StoryRetellInner({ story, id, inMission }: { story: Story; id: string; inMission: boolean }) {
  const mission = useMissionNext()

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    logActivity({ ts: Date.now(), kind: 'sentence', id: `retell:${id}`, score: result.overall })
    if (blob) saveRecording({ id: `retell:${id}:${Date.now()}`, ts: Date.now(), text: story.retell.text, blob }).catch(() => {})
  }

  const a = useSpeakingAttempt({ targetText: story.retell.text, resetKey: id, autoStopMs: AUTO_STOP_MS, onResult: handleResult })
  const stars = a.result ? retellStars(a.result.overall) : null

  useEffect(() => {
    if (a.result) setStars(`retell:${id}`, retellStars(a.result.overall))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.result])

  const onErrorAction = useSpeakErrorAction(a)

  return (
    <PageShell gutter="20">
      <PageHeader back={<BackButton to={inMission ? MISSION_ROUTE : '/stories'} label={inMission ? 'Nhiệm vụ' : 'Truyện'} />} engine={a.engine}>
        <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900 md:text-[28px]">Bé kể lại nhé</h1>
      </PageHeader>
      <PageBody split={{
        teach: (
          <Card className={`flex w-full max-w-2xl flex-col items-center gap-3 px-6 py-6 ${stars !== null ? 'max-md:hidden' : ''}`}>
            <p className="text-center font-display text-[32px] font-extrabold leading-tight text-ink-900 md:text-[36px]">{story.retell.text}</p>
            <p className="text-center text-lg font-bold text-ink-500">{story.retell.textVi}</p>
            <button
              type="button"
              aria-label="Nghe mẫu"
              onClick={() => playSample(story)}
              className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-teal-500 text-3xl text-white shadow-chunky-teal active:translate-y-[2px]"
            >
              <span aria-hidden="true">🔊</span>
            </button>
          </Card>
        ),
        act: stars !== null ? (
          <ResultCard
            stars={stars}
            praise={RETELL_MESSAGE[stars]}
            score={a.result?.overall}
            canReplay={!!a.lastBlob}
            onReplay={() => playBlob(a.lastBlob!).catch(() => {})}
            onRetry={() => a.reset()}
            primary={mission
              ? { label: mission.label, onClick: mission.go }
              : inMission
                ? { label: RETURN_LABEL, to: MISSION_ROUTE }
                : { label: 'Về danh sách truyện', to: '/stories' }}
            animate={stars === 3}
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            {a.error && <SpeakError error={a.error} onAction={onErrorAction} onDismiss={a.dismissError} />}
            <MicButton state={a.micState} level={a.level} onPress={a.onMic} />
          </div>
        ),
      }} />
    </PageShell>
  )
}
