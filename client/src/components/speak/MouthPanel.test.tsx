import { render, screen, fireEvent } from '@testing-library/react'
import { MouthPanel } from './MouthPanel'
import type { LessonCard } from '../../content/types'

const card: LessonCard = { id: 'wp-cat', text: 'cat', ipa: '/kæt/', emoji: '🐱', audio: '/audio/words/cat.mp3' }

it('shows the toggle button but no tile while closed', () => {
  render(<MouthPanel card={card} open={false} onToggle={() => {}} />)

  const button = screen.getByRole('button', { name: /khẩu hình/i })
  expect(button).toHaveClass('bg-peach-50', 'text-[#C08457]', 'shadow-[0_5px_0_#F2DFC9]')
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByTestId('mouth-panel')).not.toBeInTheDocument()
})

it('renders the mouth tile below the button once open, sized per the brief', () => {
  render(<MouthPanel card={card} open onToggle={() => {}} />)

  const button = screen.getByRole('button', { name: /khẩu hình/i })
  expect(button).toHaveAttribute('aria-expanded', 'true')

  const tile = screen.getByTestId('mouth-panel')
  expect(tile).toHaveClass('h-[140px]', 'w-[140px]', 'md:h-[220px]', 'md:w-[220px]')
  expect(tile).toHaveAccessibleName('Khẩu hình miệng của "cat"')
})

it('calls onToggle when the button is pressed', () => {
  const onToggle = vi.fn()
  render(<MouthPanel card={card} open={false} onToggle={onToggle} />)

  fireEvent.click(screen.getByRole('button', { name: /khẩu hình/i }))
  expect(onToggle).toHaveBeenCalledTimes(1)
})
