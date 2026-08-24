import { render, screen } from '@testing-library/react'
import { ProsodyChip } from './ProsodyChip'

const chip = () => screen.getByTestId('prosody-chip')

describe('ProsodyChip', () => {
  it('reads the score out loud and goes green from 80', () => {
    render(<ProsodyChip score={84} engine="azure" />)

    expect(chip()).toHaveTextContent('Ngữ điệu 84')
    expect(chip()).toHaveAttribute('data-tone', 'good')
    expect(chip()).toHaveClass('bg-good-50', 'text-good-700', 'border-good-300')
  })

  it('is amber in the middle and red below 60', () => {
    const { rerender } = render(<ProsodyChip score={65} engine="azure" />)
    expect(chip()).toHaveAttribute('data-tone', 'ok')
    expect(chip()).toHaveClass('bg-ok-50', 'text-ok-700', 'border-ok-300')

    rerender(<ProsodyChip score={59} engine="azure" />)
    expect(chip()).toHaveAttribute('data-tone', 'fix')
    expect(chip()).toHaveClass('bg-fix-50', 'text-fix-700', 'border-fix-300')
  })

  it('keeps 80 and 60 on the good and ok side of the line', () => {
    const { rerender } = render(<ProsodyChip score={80} engine="azure" />)
    expect(chip()).toHaveAttribute('data-tone', 'good')

    rerender(<ProsodyChip score={60} engine="azure" />)
    expect(chip()).toHaveAttribute('data-tone', 'ok')
  })

  it('rounds the number the child sees', () => {
    render(<ProsodyChip score={83.6} engine="azure" />)
    expect(chip()).toHaveTextContent('Ngữ điệu 84')
  })

  it('says plainly that there is no score when there is none', () => {
    render(<ProsodyChip score={null} engine="azure" />)

    expect(chip()).toHaveTextContent('Chưa chấm được ngữ điệu')
    expect(chip()).toHaveAttribute('data-tone', 'none')
    expect(chip()).toHaveClass('bg-cream-50', 'text-ink-500')
  })

  /** Web Speech never measures intonation, so even a number handed to it must not be shown. */
  it('never dresses a Web Speech attempt up as a prosody score', () => {
    render(<ProsodyChip score={92} engine="webspeech" />)

    expect(chip()).toHaveTextContent('Chưa chấm được ngữ điệu')
    expect(chip()).toHaveAttribute('data-tone', 'none')
  })
})
