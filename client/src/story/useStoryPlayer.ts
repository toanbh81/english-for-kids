import { useEffect, useMemo, useRef, useState } from 'react'
import type { Story } from '../content/stories/types'
import { activeWordIndex, estimateTimings, totalDuration } from './timing'
import { speakText } from './speak'

export type PlayerState = {
  sceneIndex: number
  playing: boolean
  rate: 0.75 | 1
  tMs: number
  wordIndex: number
  /** The scene ships real per-word timings, i.e. narration exists to be played at all. */
  hasTimings: boolean
  hasAudio: boolean
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
  toggleSubtitles(): void
  retry(): void
  timings: { start: number; end: number }[]
  ended: boolean
}

const ADVANCE_GRACE_MS = 400
const NOT_STARTED = -1 // always < any word's start, so activeWordIndex reads -1 before playback
const MAX_FRAME_MS = 250 // a hidden tab freezes rAF; the catch-up frame must not skip whole scenes
const PUNCTUATION = /[^\p{L}\p{N}'’-]/gu // keeps letters, digits, apostrophes and hyphens

/**
 * Fallback (no-audio) clock. It accumulates per read instead of measuring wall-clock since the last
 * rebase, and clamps each step to MAX_FRAME_MS: backgrounding the tab for two minutes then coming
 * back used to hand tick() a 120 000 ms jump, which raced through every remaining scene at once.
 */
function createClock(initialRate: 0.75 | 1 = 1) {
  let acc = 0, last = performance.now(), rate = initialRate
  function step() {
    const now = performance.now()
    const raw = now - last
    last = now
    acc += Math.min(Math.max(raw, 0), MAX_FRAME_MS) * rate
  }
  return {
    rebase(atMs: number) { acc = atMs; last = performance.now() },
    setRate(r: 0.75 | 1) { step(); rate = r },
    elapsed() { step(); return acc },
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
  const [subtitles, setSubtitles] = useState(() => {
    // R29 / quyết định 28: đọc MỘT LẦN lúc mount, không nghe resize — xoay máy giữa chừng không
    // được tự tắt phụ đề dưới tay đứa trẻ.
    try { return window.innerHeight >= 700 } catch { return true }
  })
  const [ended, setEnded] = useState(false)

  const scene = story.scenes[sceneIndex]
  const { timings, complete } = useMemo(() => sceneTimings(scene), [scene])
  const wordIndex = activeWordIndex(timings, tMs)

  // Refs mirror render state so the self-rescheduling rAF loop always reads current values.
  const audioElRef = useRef<HTMLAudioElement | null>(null) // ONE element for the hook's lifetime
  const audioActiveRef = useRef(false) // the current scene has its narration wired to that element
  const loadTokenRef = useRef(0) // bumped per scene load; stale async callbacks compare against it
  const rafRef = useRef<number | null>(null)
  const clockRef = useRef(createClock())
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
  timingsRef.current = timings
  sceneIndexRef.current = sceneIndex
  sceneCountRef.current = story.scenes.length
  playingRef.current = playing

  function stopClock() { if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null } }
  function startClockLoop() { stopClock(); rafRef.current = requestAnimationFrame(tick) }
  /**
   * Critical fix: iOS unlocks media elements one-by-one, on a play() that originates from a user
   * gesture. A `new Audio()` per scene therefore leaves scenes 2..n as fresh, still-locked elements
   * that Safari refuses to play on an unattended auto-advance. One element, created once, swapped
   * via `src`, stays unlocked for the whole story.
   */
  function ensureAudio(): HTMLAudioElement {
    if (!audioElRef.current) audioElRef.current = new Audio()
    return audioElRef.current
  }
  function currentMs(): number {
    const audio = audioElRef.current
    return hasAudioRef.current && audio ? audio.currentTime * 1000 : clockRef.current.elapsed()
  }
  function pause() {
    stopClock()
    audioElRef.current?.pause()
    replayUntilRef.current = null // Fix 4: a manual pause cancels any pending one-shot replay stop
    setPlaying(false)
  }

  // hasAudio only flips true once BOTH the element has metadata AND play() actually resolved —
  // an iOS NotAllowedError on an unattended auto-advance must never be mistaken for real playback.
  // The shared element can no longer identify a scene, so every async callback carries the load
  // token it was registered with and bails once the scene has moved on.
  function markReadyIfBoth(token: number) {
    if (loadTokenRef.current !== token) return
    if (metadataReadyRef.current && playResolvedRef.current) {
      hasAudioRef.current = true
      setHasAudio(true)
    }
  }
  function attemptPlay(audio: HTMLAudioElement, atMs: number, token: number) {
    playResolvedRef.current = false // Low (a): a fresh attempt must re-earn "resolved" before hasAudio can flip true
    audio.play().then(() => {
      if (loadTokenRef.current !== token) return
      playResolvedRef.current = true
      markReadyIfBoth(token)
    }).catch(() => {
      if (loadTokenRef.current !== token) return
      hasAudioRef.current = false
      setHasAudio(false)
      clockRef.current.rebase(atMs) // keep the fallback clock continuous from where we tried to start
    })
  }
  function beginPlayback(atMs: number) {
    // New critical fix: advancedRef only reset by the scene-change effect, so any playback
    // resumed within the SAME scene after finishScene() latched it (replayWord()/play() on the
    // scene that just fired 'ended') would leave tick() returning early forever. Every path that
    // (re)starts ticking within a scene must clear the guard.
    advancedRef.current = false
    clockRef.current.rebase(atMs)
    setPlaying(true)
    startClockLoop()
    const audio = audioElRef.current
    if (audio && audioActiveRef.current) attemptPlay(audio, atMs, loadTokenRef.current)
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

  // Repoint the ONE shared element at this scene's narration; resume ticking if mid-auto-advance
  // (playingRef is true here only for that case — manual scene navigation pauses first). Scenes
  // whose timings aren't complete never touch `src`: nothing to sync audio to, no point fetching a
  // 404, and the element stays idle (and unlocked) for whichever later scene does have narration.
  useEffect(() => {
    stopClock()
    replayUntilRef.current = null
    advancedRef.current = false
    metadataReadyRef.current = false
    playResolvedRef.current = false
    const token = ++loadTokenRef.current
    setTMs(NOT_STARTED)
    setEnded(false)
    setHasAudio(false)
    hasAudioRef.current = false
    clockRef.current = createClock(rateRef.current) // Fix 1: keep the selected rate across scenes

    if (!complete) {
      audioActiveRef.current = false
      if (playingRef.current) startClockLoop()
      return () => stopClock()
    }

    const audio = ensureAudio()
    audioActiveRef.current = true
    audio.pause()
    audio.src = scene.audio
    audio.load()
    audio.playbackRate = rateRef.current // Fix 1 again: a reused element keeps the previous rate
    const onReady = () => {
      if (loadTokenRef.current !== token) return
      metadataReadyRef.current = true
      markReadyIfBoth(token)
    }
    const onError = () => {
      if (loadTokenRef.current !== token) return
      hasAudioRef.current = false
      setHasAudio(false)
    }
    const onEnded = () => {
      if (loadTokenRef.current !== token) return
      if (replayUntilRef.current !== null) return // a word replay owns the current one-shot stop
      finishScene(totalDuration(timingsRef.current))
    }
    audio.addEventListener('loadedmetadata', onReady)
    audio.addEventListener('canplaythrough', onReady)
    audio.addEventListener('error', onError)
    audio.addEventListener('ended', onEnded)

    if (playingRef.current) {
      startClockLoop()
      attemptPlay(audio, 0, token)
    }
    return () => {
      audio.removeEventListener('loadedmetadata', onReady)
      audio.removeEventListener('canplaythrough', onReady)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      stopClock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, sceneIndex])

  // True unmount only: release the shared element. Declared after the scene effect
  // so React runs that cleanup (listener removal + pause) first.
  useEffect(() => () => {
    const audio = audioElRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src') // Low (b): drop the reference cleanly instead of loading an empty ''
      audio.load()
    }
    audioElRef.current = null
    audioActiveRef.current = false
  }, [])

  function play() {
    // Not cleared here: pause() (and the scene-change effect) already own clearing
    // replayUntilRef, so this stays the single, testable source of truth for that reset.
    if (complete) ensureAudio() // gesture-time creation, in case the scene effect has not yet run
    if (ended) {
      // Fix 5: ▶ on a finished story replays it, rather than doing nothing at tMs === total.
      setEnded(false)
      if (sceneIndex !== 0) { setPlaying(true); setSceneIndex(0); return }
      if (audioActiveRef.current && audioElRef.current) audioElRef.current.currentTime = 0
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
    if (audioElRef.current) audioElRef.current.playbackRate = r
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
    if (audioElRef.current && hasAudioRef.current) audioElRef.current.currentTime = w.start / 1000
    setEnded(false)
    beginPlayback(w.start)
    // Without narration a tap only moves the highlight, which teaches nothing about pronunciation.
    // Speak the bare word instead (punctuation would be read out as "exclamation mark").
    if (!hasAudioRef.current) {
      const bare = (scene.words[i]?.w ?? '').replace(PUNCTUATION, '')
      if (bare) speakText(bare)
    }
  }

  function toggleSubtitles() { setSubtitles(s => !s) }

  /** R23: nút "Thử lại" của dòng lỗi. Nạp lại src của cảnh hiện tại và chơi lại từ vị trí đang
   * đứng — cùng đường đi mà effect đổi cảnh dùng, chỉ khác là nó không đổi `sceneIndex`. */
  function retry() {
    const audio = audioElRef.current
    if (!audio || !audioActiveRef.current) { beginPlayback(tMs === NOT_STARTED ? 0 : tMs); return }
    const token = ++loadTokenRef.current
    metadataReadyRef.current = false
    playResolvedRef.current = false
    hasAudioRef.current = false
    setHasAudio(false)
    audio.pause()
    audio.src = scene.audio
    audio.load()
    audio.playbackRate = rateRef.current
    beginPlayback(tMs === NOT_STARTED ? 0 : tMs)
    void token
  }

  return {
    sceneIndex, playing, rate, tMs, wordIndex, hasTimings: complete, hasAudio, subtitles, ended, timings,
    play, pause, toggle, setRate, nextScene, prevScene, goScene, replayWord, toggleSubtitles, retry,
  }
}
