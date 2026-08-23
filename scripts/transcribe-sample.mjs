// Transcribe a 16 kHz mono WAV with Azure STT and print word-level timings as JSON.
// Usage: AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=… node scripts/transcribe-sample.mjs path/to.wav > out.json
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(new URL('../client/package.json', import.meta.url))
const sdk = require('microsoft-cognitiveservices-speech-sdk')
const key = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION
const file = process.argv[2]
if (!key || !region || !file) { console.error('usage: AZURE_SPEECH_KEY/REGION + wav path'); process.exit(1) }
const cfg = sdk.SpeechConfig.fromSubscription(key, region)
cfg.speechRecognitionLanguage = 'en-US'
cfg.requestWordLevelTimestamps()
cfg.outputFormat = sdk.OutputFormat.Detailed
const wav = readFileSync(file)
const push = sdk.AudioInputStream.createPushStream(sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1))
push.write(wav.buffer.slice(wav.byteOffset + 44, wav.byteOffset + wav.length)); push.close()
const rec = new sdk.SpeechRecognizer(cfg, sdk.AudioConfig.fromStreamInput(push))
const segments = []
rec.recognized = (_s, e) => {
  if (e.result.reason !== sdk.ResultReason.RecognizedSpeech) return
  const json = JSON.parse(e.result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult))
  const best = json.NBest?.[0]
  segments.push({ text: best?.Display ?? e.result.text, words: (best?.Words ?? []).map(w => ({ w: w.Word, start: w.Offset / 10000, end: (w.Offset + w.Duration) / 10000 })) })
}
await new Promise((res, rej) => {
  rec.sessionStopped = () => { rec.stopContinuousRecognitionAsync(() => res(), rej) }
  rec.canceled = (_s, e) => { if (e.reason === sdk.CancellationReason.Error) rej(new Error(e.errorDetails)); else res() }
  rec.startContinuousRecognitionAsync(undefined, rej)
})
rec.close()
console.log(JSON.stringify(segments, null, 1))
