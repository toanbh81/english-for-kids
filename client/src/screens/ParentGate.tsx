import { useEffect, useState } from 'react'
import { ParentDashboard } from './ParentDashboard'
import { ParentQuestion } from '../components/ParentQuestion'
import { BackButton, GateBlobs, GateCard } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

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
    <PageShell className="relative">
      <GateBlobs />
      <PageHeader right={null} back={<BackButton to="/" label="Về nhà" mdLabel="Về bản đồ 🏝️" variant="adult" />} />
      <PageBody center>
        <GateCard>
          <ParentQuestion key={attempt} onPass={handlePass} sub="Trả lời phép tính để vào Góc phụ huynh." />
        </GateCard>
      </PageBody>
    </PageShell>
  )
}
