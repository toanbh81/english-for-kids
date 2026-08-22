import { writeFileSync, mkdirSync } from 'node:fs'

const words = process.argv.slice(2)
const key = process.env.AZURE_SPEECH_KEY
const region = process.env.AZURE_SPEECH_REGION

if (!key || !region) {
  console.error('Usage: AZURE_SPEECH_KEY=<key> AZURE_SPEECH_REGION=<region> node scripts/gen-audio.mjs <word> [<word> ...]')
  console.error('Missing AZURE_SPEECH_KEY and/or AZURE_SPEECH_REGION environment variable(s).')
  process.exit(1)
}

if (words.length === 0) {
  console.error('Usage: AZURE_SPEECH_KEY=<key> AZURE_SPEECH_REGION=<region> node scripts/gen-audio.mjs <word> [<word> ...]')
  console.error('No words provided.')
  process.exit(1)
}

const tokRes = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key } })
const token = await tokRes.text()
mkdirSync('client/public/audio', { recursive: true })
for (const w of words) {
  const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="en-US-JennyNeural"><prosody rate="-15%">${w}</prosody></voice></speak>`
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3' }, body: ssml })
  writeFileSync(`client/public/audio/${w}.mp3`, Buffer.from(await res.arrayBuffer()))
  console.log('ok', w)
}
