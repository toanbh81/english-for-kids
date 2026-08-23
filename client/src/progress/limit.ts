const KEY = 'speakup.limit.minutes'
export const DEFAULT_LIMIT_MINUTES = 20
const MIN = 5
const MAX = 60
const STEP = 5

/** Corrupt or missing storage (private mode, hand-edited value) must not crash the app — fall back to the default. */
export function getLimitMinutes(): number {
  try {
    const raw = localStorage.getItem(KEY)
    const n = raw != null ? Number(raw) : NaN
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_LIMIT_MINUTES
  } catch {
    return DEFAULT_LIMIT_MINUTES
  }
}

function clamp(n: number): number {
  const rounded = Math.round(n / STEP) * STEP
  return Math.min(MAX, Math.max(MIN, rounded))
}

export function setLimitMinutes(n: number): number {
  const clamped = clamp(Number.isFinite(n) ? n : DEFAULT_LIMIT_MINUTES)
  try { localStorage.setItem(KEY, String(clamped)) }
  catch { /* ignore: storage unavailable */ }
  return clamped
}
