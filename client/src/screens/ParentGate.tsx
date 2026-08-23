import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ParentDashboard } from './ParentDashboard'
import { Button, Card } from '../components/ui'

const FLAG_KEY = 'speakup.parent'
const MAX_AGE_MS = 10 * 60 * 1000

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function newQuestion(): { a: number; b: number } {
  return { a: randInt(3, 9), b: randInt(3, 9) }
}

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
  const [question, setQuestion] = useState(newQuestion)
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)

  // Leaving /parent re-locks: the flag never outlives the screen that owns it.
  useEffect(() => clearFlag, [])

  // ParentDashboard owns none of the unlocked state — "Khoá lại" just hands control back here.
  function handleLock() {
    clearFlag()
    setQuestion(newQuestion())
    setValue('')
    setWrong(false)
    setUnlocked(false)
  }

  if (unlocked) return <ParentDashboard onLock={handleLock} />

  function handleAnswer(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value)
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (Number(value.trim()) === question.a * question.b) {
      try { sessionStorage.setItem(FLAG_KEY, String(Date.now())) } catch { /* ignore: storage unavailable */ }
      setUnlocked(true)
      return
    }
    setWrong(true)
    setQuestion(newQuestion())
    setValue('')
  }

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 overflow-y-auto bg-cream-50 p-6">
      <Link
        to="/"
        className="inline-flex min-h-[64px] items-center gap-2 self-start rounded-full bg-white px-6 font-display text-xl font-extrabold text-ink-900 shadow-card-sm active:translate-y-[2px]"
      >
        ← Về nhà
      </Link>

      <Card className="flex w-full max-w-md flex-col items-center gap-6 p-8 text-center">
        <h1 className="text-base font-bold text-ink-500">Dành cho phụ huynh</h1>
        <p className="font-display text-[44px] font-extrabold text-ink-900">{question.a} × {question.b} = ?</p>

        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6">
          <input
            aria-label="Đáp án"
            inputMode="numeric"
            type="text"
            value={value}
            onChange={handleAnswer}
            className="h-16 w-32 rounded-2xl border-2 border-line-200 text-center font-display text-2xl font-extrabold text-ink-900"
          />

          {wrong && <p className="font-bold text-fix">Chưa đúng, thử lại</p>}

          <Button type="submit">Vào</Button>
        </form>
      </Card>
    </main>
  )
}
