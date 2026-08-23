import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PairLevel } from './PairLevel'
import { PAIRS } from '../content'

function renderLevel() {
  render(<MemoryRouter><PairLevel /></MemoryRouter>)
}

beforeEach(() => localStorage.clear())

it('shows one card per pair, with both words and the contrast', () => {
  renderLevel()

  expect(screen.getByRole('heading', { name: /Nghe & chọn/ })).toBeInTheDocument()
  expect(screen.getByText('Nghe rồi chọn từ đúng — tai tinh, miệng chuẩn!')).toBeInTheDocument()
  expect(PAIRS).toHaveLength(8)

  const cards = screen.getAllByRole('link', { name: /^Cặp / })
  expect(cards).toHaveLength(8)
  for (const p of PAIRS) {
    const card = screen.getByRole('link', { name: `Cặp ${p.a.word} và ${p.b.word}` })
    expect(card).toHaveAttribute('href', `/pair/${p.id}`)
    expect(within(card).getByText(p.a.word)).toBeInTheDocument()
    expect(within(card).getByText(p.b.word)).toBeInTheDocument()
    expect(within(card).getByText(p.contrast)).toBeInTheDocument()
  }
})

it('reads the stars off the pair key, not off a single word', () => {
  localStorage.setItem('speakup.stars', JSON.stringify({ 'pair:pair-ship-sheep': 3, ship: 2 }))

  renderLevel()

  const shipSheep = screen.getByRole('link', { name: 'Cặp ship và sheep' })
  expect(within(shipSheep).getAllByTestId('star-filled')).toHaveLength(3)
  const batBad = screen.getByRole('link', { name: 'Cặp bat và bad' })
  expect(within(batBad).queryAllByTestId('star-filled')).toHaveLength(0)
})

it('goes back to the stairs, the bậc Nghe & chọn belongs to', () => {
  renderLevel()
  expect(screen.getByRole('link', { name: 'Các bậc' })).toHaveAttribute('href', '/levels')
})
