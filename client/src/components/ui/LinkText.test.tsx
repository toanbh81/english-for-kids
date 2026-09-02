import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LinkText } from './LinkText'

describe('LinkText', () => {
  it('is a 44px underlined text link, not a button', () => {
    render(<MemoryRouter><LinkText to="/">Bắt đầu mới cho bé</LinkText></MemoryRouter>)
    const a = screen.getByRole('link', { name: 'Bắt đầu mới cho bé' })
    expect(a).toHaveClass('min-h-[44px]', 'underline', 'text-[15px]')
    expect(a.className).not.toMatch(/bg-|shadow-/)
  })

  it('renders a button when given onClick instead of to', () => {
    render(<LinkText onClick={() => {}}>Sửa lại email</LinkText>)
    expect(screen.getByRole('button', { name: 'Sửa lại email' })).toHaveClass('min-h-[44px]')
  })
})
