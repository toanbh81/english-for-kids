// Builds expressive SSML for one story scene. Pure: no SDK, no IO — so it can be unit-checked with plain node.
// Word boundaries from Azure are unaffected by <emphasis>/<break>/<prosody> wrappers, so karaoke timings stay aligned.

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Split "Foxy is hungry. He wants an apple!" into sentences, keeping the end punctuation. */
export function splitSentences(words) {
  const out = []
  let cur = []
  for (const w of words) {
    cur.push(w)
    if (/[.!?]["']?$/.test(w.w)) { out.push(cur); cur = [] }
  }
  if (cur.length) out.push(cur)
  return out
}

/**
 * @param {{ text: string, words: {w:string}[], voice?: {style?, degree?, rate?, pitch?, emphasis?: number[], pauseMs?} }} scene
 * @param {{ voice?: string, rate?: string }} opts  default voice name and base rate
 */
export const DEFAULT_VOICE = 'en-US-Emma:DragonHDLatestNeural'
export const isHdVoice = v => /:DragonHD/i.test(v)

/**
 * HD ("Dragon") voices act the text out from context on their own and ignore express-as styles,
 * emphasis and contours — measured against samples/, Emma HD matched the reference narrator's
 * register (~205 Hz) and pitch range (13–19 st) with plain text. They do honour rate and break,
 * and they barely pause at full stops (~40 ms), so sentence breaks are added explicitly.
 */
function buildHdSsml(scene, voice, hints) {
  const pause = hints.pauseMs ?? 400
  const rate = hints.rate ?? '-15%'
  const sentences = splitSentences(scene.words)
  const body = sentences.map((sentence, si) => {
    const tokens = sentence.map(w => esc(w.w) + (/,$/.test(w.w) ? '<break time="150ms"/>' : '')).join(' ')
    return tokens + (si < sentences.length - 1 ? `<break time="${pause}ms"/>` : '')
  }).join(' ')
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${voice}"><prosody rate="${rate}">${body}</prosody></voice></speak>`
}

export function buildSceneSsml(scene, opts = {}) {
  const voice = opts.voice ?? DEFAULT_VOICE
  const hints = scene.voice ?? {}
  if (isHdVoice(voice)) return buildHdSsml(scene, voice, hints)
  const emphasis = new Set(hints.emphasis ?? [])
  // Azure already leaves ~900 ms after a full stop; the reference narration pauses 350–500 ms,
  // so add only a hair rather than stacking another long break on top.
  const pause = hints.pauseMs ?? 80
  const sentences = splitSentences(scene.words)
  let idx = 0
  const body = sentences.map((sentence, si) => {
    const last = sentence[sentence.length - 1].w
    // Questions lift, exclamations brighten; statements stay at the scene's base prosody.
    const tone = /\?$/.test(last) ? ' pitch="+10%"' : /!$/.test(last) ? ' pitch="+8%" rate="+6%"' : ''
    const tokens = sentence.map(w => {
      const i = idx++
      let t = esc(w.w)
      // Key words in the reference are stretched to ~1.7× and clearly louder, not just stressed.
      // Measured against samples/: a rise-fall contour + x-slow stretches key words to 500–1000 ms
      // and widens the pitch range; <emphasis> alone barely changed duration.
      if (emphasis.has(i)) t = `<prosody rate="x-slow" volume="+20%" contour="(0%,-4%) (40%,+22%) (100%,-16%)">${t}</prosody>`
      // A short breath after a comma makes "Foxy jumps, but…" read like a storyteller, not a ticker.
      if (/,$/.test(w.w)) t += '<break time="200ms"/>'
      return t
    }).join(' ')
    const sep = si < sentences.length - 1 ? `<break time="${pause}ms"/>` : ''
    return (tone ? `<prosody${tone}>${tokens}</prosody>` : tokens) + sep
  }).join(' ')
  // Base pace matches the reference (~130 wpm incl. stretched key words); the scene-level pitch
  // drop brings Aria's ~280 Hz mean closer to the warmer ~215 Hz storyteller register.
  const rate = hints.rate ?? opts.rate ?? '-4%'
  const pitch = ` pitch="${hints.pitch ?? opts.pitch ?? '-14%'}"`
  let inner = `<prosody rate="${rate}"${pitch}>${body}</prosody>`
  if (hints.style) {
    const degree = hints.degree !== undefined ? ` styledegree="${hints.degree}"` : ''
    inner = `<mstts:express-as style="${hints.style}"${degree}>${inner}</mstts:express-as>`
  }
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US"><voice name="${voice}">${inner}</voice></speak>`
}
