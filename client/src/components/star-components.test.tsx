import { render, screen } from '@testing-library/react'
import { StressedSentence } from './StressedSentence'

const WORDS = ['I', 'have', 'a', 'red', 'apple.']

describe('StressedSentence', () => {
  // The sizes come in pairs now: the phone value unprefixed and the landscape one restored at
  // `md:`. Both halves are asserted, because dropping either is the bug — an unprefixed 48 px
  // wraps a five-word sentence to four lines on a phone, and a missing `md:` shrinks the iPad.
  it('makes the stressed words bigger and coral, and leaves the rest alone', () => {
    render(<StressedSentence words={WORDS} stress={[1, 3, 4]} />)

    expect(screen.getByText('have')).toHaveClass('text-coral-text', 'text-[32px]', 'md:text-[48px]')
    expect(screen.getByText('apple.')).toHaveClass('text-coral-text', 'text-[32px]', 'md:text-[48px]')
    expect(screen.getByText('I')).toHaveClass('text-ink-900', 'text-[26px]', 'md:text-[40px]')
    expect(screen.getByText('a')).toHaveClass('text-ink-900', 'text-[26px]', 'md:text-[40px]')
    expect(screen.getByText('I').closest('p')).toHaveClass('md:max-w-[560px]')
  })

  it('draws one ‿ between each linked pair, hidden from screen readers', () => {
    render(<StressedSentence words={WORDS} stress={[1, 3, 4]} link={[[3, 4]]} />)

    const marks = screen.getAllByTestId('link-mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]).toHaveTextContent('‿')
    expect(marks[0]).toHaveAttribute('aria-hidden', 'true')
    expect(marks[0]).toHaveClass('text-teal-600')
  })

  it('reads out as the plain sentence, without the marks', () => {
    render(<StressedSentence words={WORDS} stress={[1]} link={[[3, 4]]} />)

    expect(screen.getByLabelText('I have a red apple.')).toBeInTheDocument()
  })

  it('draws no connector for a pair that is not adjacent', () => {
    render(<StressedSentence words={WORDS} stress={[1]} link={[[0, 3]]} />)

    expect(screen.queryAllByTestId('link-mark')).toHaveLength(0)
  })
})
