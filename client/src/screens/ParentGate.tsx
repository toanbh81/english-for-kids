import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ParentDashboard } from './ParentDashboard'

const FLAG_KEY = 'speakup.parent'

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function newQuestion(): { a: number; b: number } {
  return { a: randInt(3, 9), b: randInt(3, 9) }
}

function isUnlocked(): boolean {
  try { return sessionStorage.getItem(FLAG_KEY) === '1' }
  catch { return false }
}

export function ParentGate() {
  const [unlocked, setUnlocked] = useState(isUnlocked)
  const [question, setQuestion] = useState(newQuestion)
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)

  if (unlocked) return <ParentDashboard />

  function handleAnswer(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value)
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (Number(value.trim()) === question.a * question.b) {
      try { sessionStorage.setItem(FLAG_KEY, '1') } catch { /* ignore: storage unavailable */ }
      setUnlocked(true)
      return
    }
    setWrong(true)
    setQuestion(newQuestion())
    setValue('')
  }

  return (
    <main className="h-full overflow-y-auto flex flex-col items-center justify-center gap-6 p-6 text-base text-slate-700">
      <Link to="/" className="min-h-[64px] self-start inline-flex items-center font-semibold">← Về nhà</Link>

      <h1 className="text-xl font-bold">Dành cho phụ huynh</h1>
      <p className="text-2xl font-bold">{question.a} × {question.b} = ?</p>

      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6">
        <input
          aria-label="Đáp án"
          inputMode="numeric"
          type="text"
          value={value}
          onChange={handleAnswer}
          className="min-h-[64px] w-32 text-center text-2xl rounded-2xl border-2 border-slate-300"
        />

        {wrong && <p className="text-fix font-semibold">Chưa đúng, thử lại</p>}

        <button
          type="submit"
          className="min-h-[64px] min-w-[64px] px-6 rounded-2xl bg-teal text-white font-bold"
        >
          Vào
        </button>
      </form>
    </main>
  )
}
