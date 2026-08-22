export async function fetchAzureToken(key: string, region: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const res = await fetchFn(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
  })
  if (!res.ok) throw new Error(`Azure token request failed: ${res.status}`)
  return res.text()
}
