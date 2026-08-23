// Renders one scene with several candidate voices so a parent can listen and pick.
// Output: client/public/audio/audition/<voice>.mp3 (git-ignored). Open https://localhost:5173/audio/audition/<voice>.mp3
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildSceneSsml } from './story-ssml.mjs'
const ROOT = new URL('../', import.meta.url)
const repoPath = p => fileURLToPath(new URL(p, ROOT))
const require = createRequire(new URL('client/package.json', ROOT))
const sdk = require('microsoft-cognitiveservices-speech-sdk')
const key = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION
if (!key || !region) { console.error('Usage: AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=… node scripts/audition-voices.mjs [storyId] [sceneIndex]'); process.exit(1) }
const [storyId = 'little-fox', sceneArg = '3'] = process.argv.slice(2)
const story = JSON.parse(readFileSync(repoPath(`client/src/content/stories/${storyId}.json`), 'utf8'))
const scene = story.scenes[Number(sceneArg)]
const VOICES = ['en-US-AriaNeural', 'en-US-JennyNeural', 'en-US-AnaNeural', 'en-US-SaraNeural', 'en-US-DavisNeural', 'en-US-GuyNeural']
mkdirSync(repoPath('client/public/audio/audition'), { recursive: true })
for (const voice of VOICES) {
  const cfg = sdk.SpeechConfig.fromSubscription(key, region)
  cfg.speechSynthesisVoiceName = voice
  cfg.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
  const synth = new sdk.SpeechSynthesizer(cfg, null)
  try {
    const data = await new Promise((res, rej) => synth.speakSsmlAsync(buildSceneSsml(scene, { voice }), r => {
      const ok = r.reason === sdk.ResultReason.SynthesizingAudioCompleted; const d = ok ? r.audioData : null; const err = r.errorDetails; synth.close(); ok ? res(d) : rej(new Error(err))
    }, e => { synth.close(); rej(new Error(e)) }))
    writeFileSync(repoPath(`client/public/audio/audition/${voice}.mp3`), Buffer.from(data))
    console.log('ok', voice)
  } catch (e) { console.log('skip', voice, String(e.message).slice(0, 80)) }
}
