import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
// Everything resolves against the repo root, so the script behaves the same from any cwd.
const ROOT = new URL('../', import.meta.url)
const repoPath = p => fileURLToPath(new URL(p, ROOT))
const require = createRequire(new URL('client/package.json', ROOT))
const sdk = require('microsoft-cognitiveservices-speech-sdk')
// Sentence text is interpolated straight into the SSML document below, so escape the characters
// XML treats specially before it gets there (same helper as story-ssml.mjs).
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const key = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION
if (!key || !region) { console.error('Usage: AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=… [SENTENCE_VOICE=en-US-Emma:DragonHDLatestNeural] node scripts/gen-sentences.mjs [<sentenceId> ...]'); process.exit(1) }
// Emma HD reads with natural, context-driven expression, same voice as the story narration.
const VOICE = process.env.SENTENCE_VOICE || 'en-US-Emma:DragonHDLatestNeural'

const sentencesPath = repoPath('client/src/content/sentences.json')
const sentences = JSON.parse(readFileSync(sentencesPath, 'utf8'))
const requested = process.argv.slice(2)
const targets = requested.length ? sentences.filter(s => requested.includes(s.id)) : sentences
if (!targets.length) { console.error('No matching sentence ids in client/src/content/sentences.json'); process.exit(1) }

/** Synthesize one plain-text sentence; resolves the mp3 audio buffer or rejects. */
async function synthesize(text) {
  const cfg = sdk.SpeechConfig.fromSubscription(key, region)
  cfg.speechSynthesisVoiceName = VOICE
  cfg.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
  const synth = new sdk.SpeechSynthesizer(cfg, null)
  const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="${VOICE}"><prosody rate="-10%">${esc(text)}</prosody></voice></speak>`
  // audioData must be read BEFORE close() — the SDK releases the result buffer on close.
  const audioData = await new Promise((res, rej) => synth.speakSsmlAsync(ssml, r => {
    const ok = r.reason === sdk.ResultReason.SynthesizingAudioCompleted
    const data = ok ? r.audioData : null
    const details = r.errorDetails
    synth.close()
    ok ? res(data) : rej(new Error(details || 'synthesis failed'))
  }, e => { synth.close(); rej(new Error(e)) }))
  return audioData
}

mkdirSync(repoPath('client/public/audio/sentences'), { recursive: true })
for (const s of targets) {
  const text = s.words.join(' ')
  const audioData = await synthesize(text)
  writeFileSync(repoPath(`client/public/audio/sentences/${s.id}.mp3`), Buffer.from(audioData))
  console.log('ok', s.id, text)
}
