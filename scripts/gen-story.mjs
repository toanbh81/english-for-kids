import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildSceneSsml, DEFAULT_VOICE } from './story-ssml.mjs'
// Everything resolves against the repo root, so the script behaves the same from any cwd.
const ROOT = new URL('../', import.meta.url)
const repoPath = p => fileURLToPath(new URL(p, ROOT))
const require = createRequire(new URL('client/package.json', ROOT))
const sdk = require('microsoft-cognitiveservices-speech-sdk')
const key = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION
if (!key || !region) { console.error('Usage: AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=… [STORY_VOICE=en-US-Emma:DragonHDLatestNeural] node scripts/gen-story.mjs <storyId> [...]'); process.exit(1) }
const ids = process.argv.slice(2); if (!ids.length) { console.error('no story ids'); process.exit(1) }
// Emma HD reads with natural, context-driven expression (see story-ssml.mjs); non-HD voices
// such as en-US-AriaNeural fall back to the styled/emphasis SSML path.
const VOICE = process.env.STORY_VOICE || DEFAULT_VOICE
// Azure's word boundaries carry no punctuation, so compare on letters/digits/apostrophes only.
const bare = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')

/** Synthesize one SSML document; resolves { audioData, bounds } or rejects. */
export async function synthesize(ssml) {
  const cfg = sdk.SpeechConfig.fromSubscription(key, region)
  cfg.speechSynthesisVoiceName = VOICE
  cfg.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
  const synth = new sdk.SpeechSynthesizer(cfg, null)
  const bounds = []
  synth.wordBoundary = (_s, e) => { if (e.boundaryType === sdk.SpeechSynthesisBoundaryType.Word) bounds.push({ text: e.text, start: e.audioOffset / 10000, end: (e.audioOffset + e.duration) / 10000 }) }
  // audioData must be read BEFORE close() — the SDK releases the result buffer on close.
  const audioData = await new Promise((res, rej) => synth.speakSsmlAsync(ssml, r => {
    const ok = r.reason === sdk.ResultReason.SynthesizingAudioCompleted
    const data = ok ? r.audioData : null
    const details = r.errorDetails
    synth.close()
    ok ? res(data) : rej(new Error(details || 'synthesis failed'))
  }, e => { synth.close(); rej(new Error(e)) }))
  return { audioData, bounds }
}

for (const id of ids) {
  const path = repoPath(`client/src/content/stories/${id}.json`)
  const story = JSON.parse(readFileSync(path, 'utf8'))
  mkdirSync(repoPath(`client/public/audio/stories/${id}`), { recursive: true })
  for (let i = 0; i < story.scenes.length; i++) {
    const scene = story.scenes[i]
    const { audioData, bounds } = await synthesize(buildSceneSsml(scene, { voice: VOICE }))
    // Boundaries are zipped onto scene.words positionally: one silent misalignment shifts every
    // later timing, so refuse to write anything rather than emit a subtly wrong karaoke track.
    if (bounds.length !== scene.words.length) {
      console.error(`${id} scene ${i + 1}: Azure returned ${bounds.length} word boundaries but the JSON has ${scene.words.length} words — make scene.words match scene.text and retry`)
      process.exit(1)
    }
    for (let j = 0; j < scene.words.length; j++) {
      if (bare(bounds[j].text) !== bare(scene.words[j].w)) {
        console.error(`${id} scene ${i + 1} word ${j + 1}: Azure said "${bounds[j].text}" but the JSON has "${scene.words[j].w}" — every timing from here on would be shifted`)
        process.exit(1)
      }
    }
    writeFileSync(repoPath(`client/public/audio/stories/${id}/scene-${i + 1}.mp3`), Buffer.from(audioData))
    scene.words = scene.words.map((w, j) => ({ w: w.w, start: Math.round(bounds[j].start), end: Math.round(bounds[j].end) }))
    console.log('ok', id, `scene-${i + 1}`, `${bounds.length} words`, scene.voice?.style ?? 'neutral')
  }
  writeFileSync(path, JSON.stringify(story, null, 2) + '\n')
}
