// Vercel serverless function — same contract as server/src/index.ts (GET /api/speech-token → { token, region }).
// The Azure key lives only in Vercel project environment variables; the browser only ever receives a 10-minute token.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const key = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION
  if (!key || !region) return res.status(500).json({ error: 'Azure not configured' })
  try {
    const r = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
    })
    if (!r.ok) return res.status(500).json({ error: `Azure token request failed: ${r.status}` })
    const token = await r.text()
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ token, region })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'token error' })
  }
}
