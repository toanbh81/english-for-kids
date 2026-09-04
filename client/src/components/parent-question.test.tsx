import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ParentQuestion } from './ParentQuestion'

const noop = () => undefined

describe('ParentQuestion', () => {
  it('is a 32px sum, a 96×44 box and one 44px "Vào" on the right', () => {
    render(<ParentQuestion onPass={noop} sub="Trả lời phép tính để vào Góc phụ huynh." />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('font-display', 'text-[18px]')
    expect(screen.getByText('Trả lời phép tính để vào Góc phụ huynh.')).toHaveClass('text-[13px]', 'text-ink-500')
    expect(screen.getByText(/× \d+ =/)).toHaveClass('font-display', 'text-[32px]')
    expect(screen.getByLabelText('Đáp án')).toHaveClass('h-11', 'w-24', 'rounded-r12', 'border-2', 'text-center')
    const submit = screen.getByRole('button', { name: 'Vào' })
    expect(submit).toHaveClass('min-h-[44px]')
    expect(submit.className).not.toMatch(/min-h-\[56px\]|md:min-h-\[64px\]/)
    expect(submit.parentElement).toHaveClass('justify-end')
  })

  it('the error gutter is always 18px tall and empty until a wrong answer', () => {
    render(<ParentQuestion onPass={noop} />)
    const gutter = screen.getByTestId('question-error')
    expect(gutter).toHaveClass('min-h-[18px]', 'text-[12px]', 'text-fix-700')
    expect(gutter).toBeEmptyDOMElement()
  })

  it('a wrong answer changes the question, reddens and shakes the box', () => {
    // `newQuestion()` draws `a` and `b` independently from 3..9 (7 values each), so leaving
    // `Math.random` unmocked gives the reroll a ~1/49 chance of landing back on the same pair and
    // flaking the "changed" assertion below. Pin two distinct pairs the same way the sibling
    // screen suites do (`CloudStart.test.tsx`, `ParentDashboard.test.tsx`): first question 3 × 3,
    // reroll 9 × 9.
    const random = vi.spyOn(Math, 'random')
    random.mockReturnValueOnce(0).mockReturnValueOnce(0) // first question: 3 × 3
    render(<ParentQuestion onPass={noop} />)
    const before = screen.getByText(/× \d+ =/).textContent
    random.mockReturnValueOnce(0.99).mockReturnValueOnce(0.99) // reroll: 9 × 9
    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
    expect(screen.getByTestId('question-error')).toHaveTextContent('⛔ Chưa đúng — câu hỏi đã đổi, thử lại nhé.')
    expect(screen.getByLabelText('Đáp án')).toHaveClass('border-fix-700', 'animate-shake')
    expect(screen.getByText(/× \d+ =/).textContent).not.toBe(before)
    random.mockRestore()
  })

  it('an empty submit keeps the question and says so in its own words', () => {
    render(<ParentQuestion onPass={noop} />)
    const before = screen.getByText(/× \d+ =/).textContent
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
    expect(screen.getByTestId('question-error')).toHaveTextContent('Nhập kết quả trước nhé')
    expect(screen.getByText(/× \d+ =/).textContent).toBe(before)
  })

  it('typing clears the error band without moving anything', () => {
    render(<ParentQuestion onPass={noop} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: '2' } })
    expect(screen.getByTestId('question-error')).toBeEmptyDOMElement()
    expect(screen.getByLabelText('Đáp án').className).not.toMatch(/animate-shake|border-fix-700/)
  })

  it('names the input "Đáp án" and describes it with the equation, for screen readers', () => {
    render(<ParentQuestion onPass={noop} />)
    const input = screen.getByLabelText('Đáp án')
    expect(input).toHaveAccessibleName('Đáp án')
    expect(input).toHaveAccessibleDescription(/^\d+ × \d+ =$/)
  })

  it('the right answer passes exactly once', () => {
    const onPass = vi.fn()
    render(<ParentQuestion onPass={onPass} />)
    const [a, b] = Array.from(screen.getByText(/× \d+ =/).textContent!.matchAll(/\d+/g)).map(m => Number(m[0]))
    fireEvent.change(screen.getByLabelText('Đáp án'), { target: { value: String(a * b) } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào' }))
    expect(onPass).toHaveBeenCalledTimes(1)
  })
})
