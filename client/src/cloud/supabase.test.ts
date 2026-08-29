import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getSupabase, isCloudConfigured, resetSupabaseClient } from './supabase'

// The contract this file defends: an app built with NO Supabase env vars is a
// working app. Every cloud caller in later phases asks getSupabase() first, so
// if this returns null the whole feature disappears instead of crashing a
// six-year-old's practice screen.
describe('the cloud client', () => {
  beforeEach(() => resetSupabaseClient())
  afterEach(() => {
    vi.unstubAllEnvs()
    resetSupabaseClient()
  })

  it('is null when the app is built without a project', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isCloudConfigured()).toBe(false)
    expect(getSupabase()).toBeNull()
  })

  it('is null when only half of the configuration is there', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    expect(isCloudConfigured()).toBe(false)
    expect(getSupabase()).toBeNull()

    resetSupabaseClient()
    vi.stubEnv('VITE_SUPABASE_URL', '   ')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-value')
    expect(isCloudConfigured()).toBe(false)
    expect(getSupabase()).toBeNull()
  })

  it('builds one client when configured, and keeps returning that same one', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-value')
    expect(isCloudConfigured()).toBe(true)

    const first = getSupabase()
    expect(first).not.toBeNull()
    expect(getSupabase()).toBe(first)
    expect(typeof first?.from).toBe('function')
    expect(typeof first?.auth?.signInAnonymously).toBe('function')
  })

  it('degrades to null rather than throwing on a malformed URL', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'not a url')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-value')
    expect(() => getSupabase()).not.toThrow()
    expect(getSupabase()).toBeNull()
  })
})
