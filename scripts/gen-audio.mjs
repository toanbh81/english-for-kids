import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Everything resolves against the repo root, so the script behaves the same from any cwd.
const ROOT = new URL('../', import.meta.url)
const repoPath = p => fileURLToPath(new URL(p, ROOT))

const key = process.env.AZURE_SPEECH_KEY
const region = process.env.AZURE_SPEECH_REGION

const USAGE = 'Usage: AZURE_SPEECH_KEY=<key> AZURE_SPEECH_REGION=<region> node scripts/gen-audio.mjs [--out <dir>] [--voice <name>] <word> [<word> ...]'

if (!key || !region) {
  console.error(USAGE)
  console.error('Missing AZURE_SPEECH_KEY and/or AZURE_SPEECH_REGION environment variable(s).')
  process.exit(1)
}

const args = process.argv.slice(2)
let out = 'client/public/audio'
let voice = 'en-US-JennyNeural'
const words = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') { out = args[++i]; continue }
  if (args[i] === '--voice') { voice = args[++i]; continue }
  words.push(args[i])
}

if (words.length === 0) {
  console.error(USAGE)
  console.error('No words provided.')
  process.exit(1)
}

const tokRes = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key } })
if (!tokRes.ok) {
  console.error(`Could not get an Azure token (HTTP ${tokRes.status} ${tokRes.statusText}). Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.`)
  process.exit(1)
}
const token = await tokRes.text()
const outDir = repoPath(out)
mkdirSync(outDir, { recursive: true })
for (const w of words) {
  const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="${voice}"><prosody rate="-15%">${w}</prosody></voice></speak>`
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3' }, body: ssml })
  if (!res.ok) {
    console.error(`Text-to-speech failed for "${w}" (HTTP ${res.status} ${res.statusText}). Nothing was written for it.`)
    process.exit(1)
  }
  writeFileSync(`${outDir}/${w}.mp3`, Buffer.from(await res.arrayBuffer()))
  console.log('ok', w)
}
