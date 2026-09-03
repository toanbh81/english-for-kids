import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Story } from '../content/stories/types'
import type { PronunciationResult } from '../scoring/types'
import { findStory } from '../content/stories'
import { toFeedback } from '../scoring/feedback'
import { setStars } from '../progress/store'
import { logActivity } from '../progress/activity'
import { MISSION_ROUTE, RETURN_LABEL, useMissionFlag, useMissionNext } from '../progress/missionNav'
import { saveRecording } from '../progress/recordings'
import { playUrl, playBlob } from '../audio/player'
import { useSpeakingAttempt } from '../speaking/useSpeakingAttempt'
import { useSpeakErrorAction } from '../speaking/useSpeakErrorAction'
import { MicButton, ResultCard, SpeakError, SpeakPrompt } from '../components/speak'
import { BackButton, Chip, NotFound } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'
import { retellStars, RETELL_MESSAGE } from '../story/retellStars'
import { speakText } from '../story/speak'

/** A whole sentence takes a young child longer than a single word, so this gets the recorder's
 * full 8 s window instead of the 6 s default. */
const AUTO_STOP_MS = 8000
const COUNTDOWN_FROM = AUTO_STOP_MS / 1000

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
 * audio instead of falling back to the robot voice, and to number the "cảnh n/m" chip/card line. */
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
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_FROM)

  function handleResult(result: PronunciationResult, blob: Blob | null) {
    logActivity({ ts: Date.now(), kind: 'sentence', id: `retell:${id}`, score: result.overall })
    if (blob) saveRecording({ id: `retell:${id}:${Date.now()}`, ts: Date.now(), text: story.retell.text, blob }).catch(() => {})
  }

  const a = useSpeakingAttempt({ targetText: story.retell.text, resetKey: id, autoStopMs: AUTO_STOP_MS, onResult: handleResult })
  const feedback = useMemo(() => (a.result ? toFeedback(a.result) : null), [a.result])
  const stars = a.result ? retellStars(a.result.overall) : null

  useEffect(() => {
    if (a.result) setStars(`retell:${id}`, retellStars(a.result.overall))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.result])

  // The countdown only exists while the mic is open: it restarts on every recording and the
  // interval is cleared the moment the state changes (or the screen unmounts).
  const recording = a.micState === 'recording'
  useEffect(() => {
    if (!recording) return
    setSecondsLeft(COUNTDOWN_FROM)
    const timer = window.setInterval(() => setSecondsLeft(s => (s > 1 ? s - 1 : 1)), 1000)
    return () => clearInterval(timer)
  }, [recording])

  // Brief §1 "Tầng dạy gập": the teach column collapses to a tap-to-expand strip once a result
  // lands, and reopens either on tap or on a fresh attempt (`a.reset()`) — a retry should not
  // leave the child staring at yesterday's collapsed strip once they start reading again.
  const [teachOpen, setTeachOpen] = useState(true)
  useEffect(() => {
    if (a.result) setTeachOpen(false)
  }, [a.result])

  const onErrorAction = useSpeakErrorAction(a)

  // "cảnh n/m" — 1-based position of the retell sentence's own scene among the story's scenes, or
  // -1 when nothing matches (no story in the deck currently hits this, but a story authored without
  // a matching scene must still render, just without the scene number).
  const retellScene = findRetellScene(story)
  const sceneIndex = retellScene ? story.scenes.indexOf(retellScene) : -1
  const sceneLabel = sceneIndex >= 0 ? `cảnh ${sceneIndex + 1}/${story.scenes.length}` : null

  const primary = mission
    ? { label: mission.label, onClick: mission.go }
    : inMission
      ? { label: RETURN_LABEL, to: MISSION_ROUTE }
      : { label: 'Về danh sách truyện', to: '/stories' }

  return (
    <PageShell gutter="20">
      <PageHeader
        back={<BackButton to={inMission ? MISSION_ROUTE : '/stories'} label={inMission ? 'Nhiệm vụ' : 'Truyện'} />}
        engine={a.engine}
        dimmed={recording}
      >
        {recording
          ? <Chip tone="coral">● Đang ghi</Chip>
          : <Chip tone="teal">{sceneLabel ? `Kể lại · ${sceneLabel}` : 'Kể lại'}</Chip>}
      </PageHeader>
      <PageBody
        actGrow={!!a.result}
        split={{
          teach: (
            <div className="flex w-full flex-col items-center gap-2 rounded-r22 bg-white px-[18px] py-[22px] shadow-card md:max-w-[560px] md:px-7 md:py-8">
              <p className="text-center text-[12px] font-bold text-ink-300 md:text-[14px]">
                {`🦊 ${story.title}${sceneLabel ? ` · ${sceneLabel}` : ''}`}
              </p>
              <p className="text-center font-display text-[32px] font-extrabold leading-tight text-ink-900 md:text-[40px]">{story.retell.text}</p>
              <p className="text-center text-[15px] font-bold text-ink-500 md:text-[20px]">{story.retell.textVi}</p>
              <button
                type="button"
                aria-label="Nghe mẫu"
                onClick={() => playSample(story)}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-500 text-3xl text-white shadow-chunky-teal active:translate-y-[2px] md:h-16 md:w-16"
              >
                <span aria-hidden="true">🔊</span>
              </button>
            </div>
          ),
          collapsed: a.result && !teachOpen ? { emoji: '🦊', label: story.retell.text, onExpand: () => setTeachOpen(true) } : undefined,
          act: a.result && stars !== null ? (
            <ResultCard
              stars={stars}
              praise={RETELL_MESSAGE[stars]}
              score={a.result.overall}
              words={feedback?.words}
              hint={feedback?.hint}
              canReplay={!!a.lastBlob}
              onReplay={() => playBlob(a.lastBlob!).catch(() => {})}
              onSample={() => playSample(story)}
              onRetry={() => { a.reset(); setTeachOpen(true) }}
              primary={primary}
              animate={stars === 3}
              fox={{
                mood: stars === 3 ? 'cheer' : stars === 2 ? 'happy' : 'idle',
                say: stars === 3 ? 'Foxy: "Kể chuyện hay quá!"' : stars === 2 ? 'Foxy: "Gần đúng rồi đó!"' : 'Foxy: "Kể lại lần nữa nhé!"',
              }}
            />
          ) : (
            <>
              {recording
                ? <SpeakPrompt mood="listening" say="Foxy đang lắng nghe…" />
                : <SpeakPrompt mood="idle" say="Bé kể lại câu này nhé" seconds={COUNTDOWN_FROM} />}
              {a.error && <SpeakError error={a.error} onAction={onErrorAction} onDismiss={a.dismissError} />}
              <MicButton state={a.micState} level={a.level} onPress={a.onMic} secondsLeft={recording ? secondsLeft : undefined} />
            </>
          ),
        }}
      />
    </PageShell>
  )
}
