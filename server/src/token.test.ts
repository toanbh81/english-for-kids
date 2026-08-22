import { describe, it, expect, vi } from 'vitest'
import { fetchAzureToken } from './token.js'

describe('fetchAzureToken', () => {
  it('posts key to the region token endpoint and returns the text token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => 'abc.token' })
    const token = await fetchAzureToken('KEY', 'southeastasia', fetchMock as unknown as typeof fetch)
    expect(token).toBe('abc.token')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://southeastasia.api.cognitive.microsoft.com/sts/v1.0/issueToken',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'Ocp-Apim-Subscription-Key': 'KEY' }) }),
    )
  })
  it('throws when Azure responds non-ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'bad' })
    await expect(fetchAzureToken('K', 'r', fetchMock as unknown as typeof fetch)).rejects.toThrow('401')
  })
})
