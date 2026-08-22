import { useCallback, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'processing'

export function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return ['audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function useRecorder(opts: { maxMs?: number } = {}) {
  const maxMs = opts.maxMs ?? 8000
  const [state, setState] = useState<RecorderState>('idle')
  const [level, setLevel] = useState(0)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const stream = useRef<MediaStream | null>(null)
  const raf = useRef(0)
  const stopResolve = useRef<((b: Blob) => void) | null>(null)
  const timer = useRef(0)
  const audioCtx = useRef<AudioContext | null>(null)

  const stop = useCallback((): Promise<Blob> => new Promise(resolve => {
    if (!rec.current || rec.current.state === 'inactive') return resolve(new Blob())
    stopResolve.current = resolve
    setState('processing')
    rec.current.stop()
  }), [])

  const start = useCallback(async () => {
    if (rec.current && rec.current.state !== 'inactive') return
    stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime = pickMimeType()
    rec.current = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined)
    chunks.current = []
    rec.current.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data) }
    rec.current.onstop = () => {
      cancelAnimationFrame(raf.current); clearTimeout(timer.current)
      stream.current?.getTracks().forEach(t => t.stop())
      void audioCtx.current?.close(); audioCtx.current = null
      const blob = new Blob(chunks.current, { type: rec.current?.mimeType })
      setState('idle'); setLevel(0)
      stopResolve.current?.(blob)
    }
    // level meter
    const ctx = new AudioContext(); audioCtx.current = ctx
    const src = ctx.createMediaStreamSource(stream.current)
    const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an)
    const data = new Uint8Array(an.frequencyBinCount)
    const tick = () => { an.getByteTimeDomainData(data)
      setLevel(Math.min(1, data.reduce((m, v) => Math.max(m, Math.abs(v - 128)), 0) / 64)); raf.current = requestAnimationFrame(tick) }
    tick()
    rec.current.start()
    setState('recording')
    timer.current = window.setTimeout(() => void stop(), maxMs)
  }, [maxMs, stop])

  return { state, start, stop, level }
}
