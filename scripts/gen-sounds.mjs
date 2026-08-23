import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Everything resolves against the repo root, so the script behaves the same from any cwd.
const ROOT = new URL('../', import.meta.url)
const repoPath = p => fileURLToPath(new URL(p, ROOT))

const key = process.env.AZURE_SPEECH_KEY
const region = process.env.AZURE_SPEECH_REGION

const USAGE = 'Usage: AZURE_SPEECH_KEY=<key> AZURE_SPEECH_REGION=<region> node scripts/gen-sounds.mjs'
const VOICE = 'en-US-JennyNeural'
const OUT_DIR = 'client/public/audio/sounds'

// Tập âm's 9 target sounds, keyed the same way as LessonCard.targetPhoneme / SoundGroup.ph
// (client/src/content/sounds.ts). The SSML <phoneme> value is the bare IPA symbol plus a trailing
// schwa (ə): most single consonants render oddly in isolation on their own, but Jenny articulates
// them clearly when followed by a light schwa, which still reads to a child as "just the sound".
const SOUNDS = {
  th: 'θə',
  dh: 'ðə',
  v: 'və',
  f: 'fə',
  z: 'zə',
  sh: 'ʃə',
  ch: 'tʃə',
  r: 'rə',
  l: 'lə',
}

if (!key || !region) {
  console.error(USAGE)
  console.error('Missing AZURE_SPEECH_KEY and/or AZURE_SPEECH_REGION environment variable(s).')
  process.exit(1)
}

const tokRes = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key } })
if (!tokRes.ok) {
  console.error(`Could not get an Azure token (HTTP ${tokRes.status} ${tokRes.statusText}). Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.`)
  process.exit(1)
}
const token = await tokRes.text()
const outDir = repoPath(OUT_DIR)
mkdirSync(outDir, { recursive: true })

for (const [ph, ipa] of Object.entries(SOUNDS)) {
  const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="${VOICE}"><prosody rate="-20%"><phoneme alphabet="ipa" ph="${ipa}">${ph}</phoneme></prosody></voice></speak>`
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3' }, body: ssml })
  if (!res.ok) {
    console.error(`Text-to-speech failed for "${ph}" (HTTP ${res.status} ${res.statusText}). Nothing was written for it.`)
    process.exit(1)
  }
  writeFileSync(`${outDir}/${ph}.mp3`, Buffer.from(await res.arrayBuffer()))
  console.log('ok', ph)
}
