import 'dotenv/config'
import express from 'express'
import { fetchAzureToken } from './token.js'

const app = express()
const key = process.env.AZURE_SPEECH_KEY
const region = process.env.AZURE_SPEECH_REGION

app.get('/api/speech-token', async (_req, res) => {
  if (!key || !region) return res.status(500).json({ error: 'Azure not configured' })
  try {
    const token = await fetchAzureToken(key, region)
    res.json({ token, region })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

app.listen(8787, () => console.log('server on :8787'))
