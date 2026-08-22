const KEY = 'speakup.music'

export function getMusicPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setMusicPref(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* ignore */
  }
}

/** Procedural C-major pad, started only from a user gesture (iOS Web Audio rule). */
export class BackgroundMusic {
  private ctx: AudioContext | null = null
  private nodes: { stop(): void }[] = []

  get playing(): boolean {
    return this.ctx !== null
  }

  start(): void {
    if (this.ctx) {
      // iOS suspends the context on screen lock / backgrounding. Returning blindly here left the
      // pad silent for the rest of the session; a resume on the next gesture brings it back.
      if (this.ctx.state !== 'running') {
        void this.ctx.resume?.()?.catch(() => {
          /* still no gesture credit; music just stays silent */
        })
      }
      return
    }
    if (typeof AudioContext === 'undefined') return
    const ctx = new AudioContext()
    this.ctx = ctx
    const master = ctx.createGain()
    master.gain.value = 0.06
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    filter.connect(master)
    master.connect(ctx.destination)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.08
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 300
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)
    for (const f of [130.81, 196.0, 261.63, 329.63]) {
      // C major pad: C3 G3 C4 E4
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator()
        o.type = 'triangle'
        o.frequency.value = f
        o.detune.value = detune
        o.connect(filter)
        o.start()
        this.nodes.push(o)
      }
    }
    lfo.start()
    this.nodes.push(lfo)
    void ctx.resume?.()?.catch(() => {
      /* resume can reject (e.g. no user gesture yet); music just stays silent */
    })
  }

  stop(): void {
    this.nodes.forEach(n => {
      try {
        n.stop()
      } catch {
        /* already stopped */
      }
    })
    this.nodes = []
    void this.ctx?.close()?.catch(() => {
      /* already closed or closing; nothing to do */
    })
    this.ctx = null
  }
}
