import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ParentDashboard } from './ParentDashboard'
import { ParentQuestion } from '../components/ParentQuestion'
import { Card, PAGE_SHELL } from '../components/ui'

const FLAG_KEY = 'speakup.parent'
const MAX_AGE_MS = 10 * 60 * 1000

/** The flag stores when the gate was passed; anything older than 10 minutes asks again, so a
 * tab left open on /parent does not stay unlocked for the rest of the session. */
function isUnlocked(): boolean {
  try {
    const ts = Number(sessionStorage.getItem(FLAG_KEY))
    return Number.isFinite(ts) && ts > 0 && Date.now() - ts < MAX_AGE_MS
  } catch { return false }
}

function clearFlag() {
  try { sessionStorage.removeItem(FLAG_KEY) } catch { /* ignore: storage unavailable */ }
}

export function ParentGate() {
  const [unlocked, setUnlocked] = useState(isUnlocked)
  // Bumped on every lock, so the question component is thrown away and remounted with a fresh
  // question rather than keeping the one the parent just answered.
  const [attempt, setAttempt] = useState(0)

  // Leaving /parent re-locks: the flag never outlives the screen that owns it.
  useEffect(() => clearFlag, [])

  // ParentDashboard owns none of the unlocked state — "Khoá lại" just hands control back here.
  function handleLock() {
    clearFlag()
    setAttempt(n => n + 1)
    setUnlocked(false)
  }

  if (unlocked) return <ParentDashboard onLock={handleLock} />

  function handlePass() {
    try { sessionStorage.setItem(FLAG_KEY, String(Date.now())) } catch { /* ignore: storage unavailable */ }
    setUnlocked(true)
  }

  return (
    <main className={`flex h-full flex-col items-center justify-center gap-6 overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}>
      <Link
        to="/"
        className="inline-flex min-h-[64px] items-center gap-2 self-start rounded-full bg-white px-6 font-display text-xl font-extrabold text-ink-900 shadow-card-sm active:translate-y-[2px]"
      >
        ← Về nhà
      </Link>

      <Card className="flex w-full max-w-md flex-col items-center gap-6 p-8 text-center">
        <ParentQuestion key={attempt} onPass={handlePass} />
      </Card>
    </main>
  )
}
