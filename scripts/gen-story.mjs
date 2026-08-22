import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const require = createRequire(new URL('../client/package.json', import.meta.url))
const sdk = require('microsoft-cognitiveservices-speech-sdk')
const key = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION
if (!key || !region) { console.error('Usage: AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=… node scripts/gen-story.mjs <storyId> [...]'); process.exit(1) }
const ids = process.argv.slice(2); if (!ids.length) { console.error('no story ids'); process.exit(1) }
for (const id of ids) {
  const path = `client/src/content/stories/${id}.json`
  const story = JSON.parse(readFileSync(path, 'utf8'))
  mkdirSync(`client/public/audio/stories/${id}`, { recursive: true })
  for (let i = 0; i < story.scenes.length; i++) {
    const scene = story.scenes[i]
    const cfg = sdk.SpeechConfig.fromSubscription(key, region)
    cfg.speechSynthesisVoiceName = 'en-US-JennyNeural'
    cfg.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
    const synth = new sdk.SpeechSynthesizer(cfg, null)
    const bounds = []
    synth.wordBoundary = (_s, e) => { if (e.boundaryType === sdk.SpeechSynthesisBoundaryType.Word) bounds.push({ text: e.text, start: e.audioOffset / 10000, end: (e.audioOffset + e.duration) / 10000 }) }
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="en-US-JennyNeural"><prosody rate="-10%">${scene.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</prosody></voice></speak>`
    const result = await new Promise((res, rej) => synth.speakSsmlAsync(ssml, r => { synth.close(); r.reason === sdk.ResultReason.SynthesizingAudioCompleted ? res(r) : rej(new Error(r.errorDetails || 'synthesis failed')) }, e => { synth.close(); rej(new Error(e)) }))
    writeFileSync(`client/public/audio/stories/${id}/scene-${i + 1}.mp3`, Buffer.from(result.audioData))
    // Align boundaries to scene.words (same order; boundaries exclude punctuation).
    let b = 0
    scene.words = scene.words.map(w => { const m = bounds[b++]; return m ? { w: w.w, start: Math.round(m.start), end: Math.round(m.end) } : { w: w.w } })
    if (b !== bounds.length) console.warn(`${id} scene ${i + 1}: ${bounds.length} boundaries vs ${scene.words.length} words`)
    console.log('ok', id, `scene-${i + 1}`, `${bounds.length} words`)
  }
  writeFileSync(path, JSON.stringify(story, null, 2) + '\n')
}
