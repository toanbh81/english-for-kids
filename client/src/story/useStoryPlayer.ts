import { useEffect, useMemo, useRef, useState } from 'react'
import type { Story } from '../content/stories/types'
import { activeWordIndex, estimateTimings, totalDuration } from './timing'
import { BackgroundMusic, getMusicPref, setMusicPref } from './music'

export type PlayerState = {
  sceneIndex: number
  playing: boolean
  rate: 0.75 | 1
  tMs: number
  wordIndex: number
  hasAudio: boolean
  musicOn: boolean
  subtitles: boolean
}

export type StoryPlayer = PlayerState & {
  play(): void
  pause(): void
  toggle(): void
  setRate(r: 0.75 | 1): void
  nextScene(): void
  prevScene(): void
  goScene(i: number): void
  replayWord(i: number): void
  toggleMusic(): void
  toggleSubtitles(): void
  timings: { start: number; end: number }[]
  ended: boolean
}

const ADVANCE_GRACE_MS = 400
const NOT_STARTED = -1 // always < any word's start, so activeWordIndex reads -1 before playback

/** Fallback (no-audio) clock: elapsed = base + (now - start) * rate. rebase()/setRate() keep it jump-free. */
function createClock(initialRate: 0.75 | 1 = 1) {
  let base = 0, start = performance.now(), rate = initialRate
  return {
    rebase(atMs: number) { base = atMs; start = performance.now() },
    setRate(r: 0.75 | 1) { base += (performance.now() - start) * rate; start = performance.now(); rate = r },
    elapsed() { return base + (performance.now() - start) * rate },
  }
}

function sceneTimings(scene: Story['scenes'][number]) {
  const complete = scene.words.length > 0 && scene.words.every(w => w.start !== undefined && w.end !== undefined)
  const timings = complete
    ? scene.words.map(w => ({ start: w.start as number, end: w.end as number }))
    : estimateTimings(scene.words.map(w => w.w))
  return { timings, complete }
}

export function useStoryPlayer(story: Story): StoryPlayer {
  const [sceneIndex, setSceneIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRateState] = useState<0.75 | 1>(1)
  const [tMs, setTMs] = useState(NOT_STARTED)
  const [hasAudio, setHasAudio] = useState(false)
  const [musicOn, setMusicOn] = useState(getMusicPref)
  const [subtitles, setSubtitles] = useState(true)
  const [ended, setEnded] = useState(false)

  const scene = story.scenes[sceneIndex]
  const { timings, complete } = useMemo(() => sceneTimings(scene), [scene])
  const wordIndex = activeWordIndex(timings, tMs)

  // Refs mirror render state so the self-rescheduling rAF loop always reads current values.
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const clockRef = useRef(createClock())
  const musicRef = useRef<BackgroundMusic | null>(null)
  const replayUntilRef = useRef<number | null>(null)
  const hasAudioRef = useRef(false)
  const rateRef = useRef<0.75 | 1>(1)
  const timingsRef = useRef(timings)
  const sceneIndexRef = useRef(sceneIndex)
  const sceneCountRef = useRef(story.scenes.length)
  const playingRef = useRef(false)
  const metadataReadyRef = useRef(false) // 'loadedmetadata'/'canplaythrough' fired for the current audio
  const playResolvedRef = useRef(false) // audio.play() actually resolved (not blocked by iOS gesture rules)
  const advancedRef = useRef(false) // guards against tick() and the audio 'ended' event double-advancing
  if (!musicRef.current) musicRef.current = new BackgroundMusic()
  timingsRef.current = timings
  sceneIndexRef.current = sceneIndex
  sceneCountRef.current = story.scenes.length
  playingRef.current = playing

  function stopClock() { if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null } }
  function startClockLoop() { stopClock(); rafRef.current = requestAnimationFrame(tick) }
  function currentMs(): number {
    const audio = audioRef.current
    return hasAudioRef.current && audio ? audio.currentTime * 1000 : clockRef.current.elapsed()
  }
  function pause() {
    stopClock()
    audioRef.current?.pause()
    replayUntilRef.current = null // Fix 4: a manual pause cancels any pending one-shot replay stop
    setPlaying(false)
  }

  // hasAudio only flips true once BOTH the element has metadata AND play() actually resolved —
  // an iOS NotAllowedError on an unattended auto-advance must never be mistaken for real playback.
  function markReadyIfBoth(audio: HTMLAudioElement) {
    if (audioRef.current !== audio) return // scene moved on since this audio was created; ignore
    if (metadataReadyRef.current && playResolvedRef.current) {
      hasAudioRef.current = true
      setHasAudio(true)
    }
  }
  function attemptPlay(audio: HTMLAudioElement, atMs: number) {
    audio.play().then(() => {
      if (audioRef.current !== audio) return
      playResolvedRef.current = true
      markReadyIfBoth(audio)
    }).catch(() => {
      if (audioRef.current !== audio) return
      hasAudioRef.current = false
      setHasAudio(false)
      clockRef.current.rebase(atMs) // keep the fallback clock continuous from where we tried to start
    })
  }
  function beginPlayback(atMs: number) {
    clockRef.current.rebase(atMs)
    setPlaying(true)
    startClockLoop()
    const audio = audioRef.current
    if (audio) attemptPlay(audio, atMs)
  }

  // Shared by tick()'s total+400 check and the audio 'ended' event, guarded so only one fires.
  function finishScene(finalMs: number) {
    if (advancedRef.current) return
    advancedRef.current = true
    stopClock()
    if (sceneIndexRef.current + 1 < sceneCountRef.current) {
      setSceneIndex(i => i + 1) // scene-change effect below resumes the loop
    } else {
      setTMs(finalMs)
      setEnded(true)
      pause()
    }
  }

  function tick() {
    const ms = currentMs()
    const replayTarget = replayUntilRef.current
    if (replayTarget !== null && ms >= replayTarget) {
      replayUntilRef.current = null
      setTMs(replayTarget)
      pause()
      return
    }
    const total = totalDuration(timingsRef.current)
    if (ms >= total + ADVANCE_GRACE_MS) { finishScene(total); return }
    setTMs(ms)
    rafRef.current = requestAnimationFrame(tick)
  }

  // (Re)load audio on scene change; resume ticking if mid-auto-advance (playingRef is true here
  // only for that case — manual scene navigation pauses first). Timings that aren't complete never
  // get an Audio element at all: nothing to sync audio to, and no point fetching a 404.
  useEffect(() => {
    stopClock()
    replayUntilRef.current = null
    advancedRef.current = false
    metadataReadyRef.current = false
    playResolvedRef.current = false
    setTMs(NOT_STARTED)
    setEnded(false)
    setHasAudio(false)
    hasAudioRef.current = false
    clockRef.current = createClock(rateRef.current) // Fix 1: keep the selected rate across scenes

    if (!complete) {
      audioRef.current = null
      if (playingRef.current) startClockLoop()
      return () => stopClock()
    }

    const audio = new Audio(scene.audio)
    audio.playbackRate = rateRef.current
    audioRef.current = audio
    const onReady = () => { metadataReadyRef.current = true; markReadyIfBoth(audio) }
    const onError = () => { hasAudioRef.current = false; setHasAudio(false) }
    const onEnded = () => {
      if (replayUntilRef.current !== null) return // a word replay owns the current one-shot stop
      finishScene(totalDuration(timingsRef.current))
    }
    audio.addEventListener('loadedmetadata', onReady)
    audio.addEventListener('canplaythrough', onReady)
    audio.addEventListener('error', onError)
    audio.addEventListener('ended', onEnded)

    if (playingRef.current) {
      startClockLoop()
      attemptPlay(audio, 0)
    }
    return () => {
      audio.removeEventListener('loadedmetadata', onReady)
      audio.removeEventListener('canplaythrough', onReady)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      audio.src = ''
      audio.load()
      audioRef.current = null
      stopClock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, sceneIndex])

  // Stop music only on true unmount; the effect above already tears down audio/rAF per scene.
  useEffect(() => () => musicRef.current?.stop(), [])

  function play() {
    replayUntilRef.current = null
    if (musicOn) musicRef.current?.start() // only place that starts music (iOS gesture rule)
    if (ended) {
      // Fix 5: ▶ on a finished story replays it, rather than doing nothing at tMs === total.
      setEnded(false)
      if (sceneIndex !== 0) { setPlaying(true); setSceneIndex(0); return }
      if (audioRef.current) audioRef.current.currentTime = 0
      setTMs(0)
      beginPlayback(0)
      return
    }
    beginPlayback(tMs)
  }

  function toggle() { if (playing) pause(); else play() }

  function setRate(r: 0.75 | 1) {
    rateRef.current = r
    setRateState(r)
    clockRef.current.setRate(r)
    if (audioRef.current) audioRef.current.playbackRate = r
  }

  function goScene(i: number) {
    pause()
    setSceneIndex(Math.max(0, Math.min(story.scenes.length - 1, i)))
  }
  function nextScene() { goScene(sceneIndex + 1) }
  function prevScene() { goScene(sceneIndex - 1) }

  function replayWord(i: number) {
    const w = timings[i]
    if (!w) return
    pause()
    replayUntilRef.current = w.end
    setTMs(w.start)
    if (audioRef.current && hasAudioRef.current) audioRef.current.currentTime = w.start / 1000
    setEnded(false)
    beginPlayback(w.start)
  }

  function toggleMusic() {
    const next = !musicOn // computed outside the setter: no side effects inside a state updater
    setMusicOn(next)
    setMusicPref(next)
    if (!next) musicRef.current?.stop()
  }
  function toggleSubtitles() { setSubtitles(s => !s) }

  return {
    sceneIndex, playing, rate, tMs, wordIndex, hasAudio, musicOn, subtitles, ended, timings,
    play, pause, toggle, setRate, nextScene, prevScene, goScene, replayWord, toggleMusic, toggleSubtitles,
  }
}
