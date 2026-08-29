import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getSupabase, isCloudConfigured, resetSupabaseClient } from './supabase'

// The contract this file defends: an app built with NO Supabase env vars is a
// working app. Every cloud caller in later phases asks getSupabase() first, so
// if this returns null the whole feature disappears instead of crashing a
// six-year-old's practice screen.
//
// The answer arrives as a promise because supabase-js is loaded on demand — a
// device with no cloud never downloads it — which changes how these tests ask
// the question and nothing about the answers they expect.
describe('the cloud client', () => {
  beforeEach(() => resetSupabaseClient())
  afterEach(() => {
    vi.unstubAllEnvs()
    resetSupabaseClient()
  })

  it('is null when the app is built without a project', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isCloudConfigured()).toBe(false)
    expect(await getSupabase()).toBeNull()
  })

  it('is null when only half of the configuration is there', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isCloudConfigured()).toBe(false)
    expect(await getSupabase()).toBeNull()

    resetSupabaseClient()
    vi.stubEnv('VITE_SUPABASE_URL', '   ')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-value')
    expect(isCloudConfigured()).toBe(false)
    expect(await getSupabase()).toBeNull()
  })

  it('builds one client when configured, and keeps returning that same one', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-value')
    expect(isCloudConfigured()).toBe(true)

    // Asked twice before the first answer lands — the way a launch asks it — and
    // still one client: two would be two token refresh timers racing.
    const [first, second] = await Promise.all([getSupabase(), getSupabase()])
    expect(first).not.toBeNull()
    expect(second).toBe(first)
    expect(await getSupabase()).toBe(first)
    expect(typeof first?.from).toBe('function')
    expect(typeof first?.auth?.signInAnonymously).toBe('function')
  })

  it('degrades to null rather than throwing on a malformed URL', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'not a url')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-value')
    await expect(getSupabase()).resolves.toBeNull()
    expect(await getSupabase()).toBeNull()
  })
})
