import { useId, useState } from 'react'
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
  /** An optional second line under the title, for a door that needs to say more (e.g. A2's
   * restore gate explaining *why* it is asking). */
  sub?: string
}

export function ParentQuestion({ onPass, title = 'Dành cho phụ huynh', sub }: Props) {
  // Referenced by the input's `aria-describedby` below, so a screen reader hears which
  // multiplication it is answering. Kept out of the input's accessible NAME (which stays the
  // static "Đáp án") because several screen tests key off `getByLabelText('Đáp án')` — a
  // description adds the equation without moving that target.
  const equationId = useId()
  const [question, setQuestion] = useState(newQuestion)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)

  function handleAnswer(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value)
    // The error band turns off the moment typing starts (round 4 / P1): the message was about the
    // SUBMIT that just failed, not about the box as it stands now.
    if (error) { setError(null); setShake(false) }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // An empty submit is not a wrong answer: keep the same question, just nudge. Previously an
    // empty box counted as wrong and rolled a new question — a parent who fat-fingered "Vào" had
    // to read a fresh multiplication for no reason.
    if (value.trim() === '') {
      setError('Nhập kết quả trước nhé')
      return
    }
    if (Number(value.trim()) === question.a * question.b) {
      onPass()
      return
    }
    setError('⛔ Chưa đúng — câu hỏi đã đổi, thử lại nhé.')
    setShake(true)
    // A new question on every miss, so guessing cannot be done by repetition.
    setQuestion(newQuestion())
    setValue('')
  }

  return (
    <>
      <h1 className="font-display text-[18px] font-extrabold text-ink-900">{title}</h1>
      {sub && <p className="text-[13px] font-bold leading-[1.4] text-ink-500">{sub}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex items-center gap-3 py-2">
          <span id={equationId} className="font-display text-[32px] font-extrabold text-ink-900">
            {question.a} × {question.b} =
          </span>
          <input
            aria-label="Đáp án"
            aria-describedby={equationId}
            inputMode="numeric"
            type="text"
            value={value}
            onChange={handleAnswer}
            onAnimationEnd={() => setShake(false)}
            className={`h-11 w-24 rounded-r12 border-2 text-center font-display text-[18px] font-extrabold text-ink-900 outline-none ${
              error ? 'border-fix-700' : 'border-sand-edge'
            } ${shake ? 'animate-shake' : ''}`}
          />
        </div>

        <p data-testid="question-error" className="min-h-[18px] text-[12px] font-extrabold leading-[1.4] text-fix-700">
          {error}
        </p>

        <div className="flex justify-end">
          <Button type="submit" size="adult">Vào</Button>
        </div>
      </form>
    </>
  )
}
