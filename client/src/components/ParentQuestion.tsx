import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Button } from './ui'

/**
 * The one thing standing between a child and a grown-up's controls: a two-digit product.
 *
 * It lives here, not in `ParentGate`, because there is a second door that needs it — `/start`'s
 * restore actions, which can hand this iPad to a different account (spec flows 3 and 4). One
 * question, one wording, one place to change it.
 *
 * It is deliberately weak. It is not a password and never pretends to be: a nine-year-old who
 * really wants past it can multiply. What it stops is the accidental tap, which is the whole of
 * the threat model here.
 */
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function newQuestion(): { a: number; b: number } {
  return { a: randInt(3, 9), b: randInt(3, 9) }
}

type Props = {
  /** Called once the answer is right. The caller owns whatever "unlocked" means for it. */
  onPass: () => void
  /** The line above the question, so each door can say what it is asking for. */
  title?: string
}

export function ParentQuestion({ onPass, title = 'Dành cho phụ huynh' }: Props) {
  const [question, setQuestion] = useState(newQuestion)
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)

  function handleAnswer(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value)
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (Number(value.trim()) === question.a * question.b) {
      onPass()
      return
    }
    setWrong(true)
    // A new question on every miss, so guessing cannot be done by repetition.
    setQuestion(newQuestion())
    setValue('')
  }

  return (
    <>
      <h1 className="text-base font-bold text-ink-500">{title}</h1>
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
    </>
  )
}
