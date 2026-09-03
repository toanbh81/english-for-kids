import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PairLevel } from './PairLevel'
import { PAIRS } from '../content'

function renderLevel() {
  render(<MemoryRouter><PairLevel /></MemoryRouter>)
}

beforeEach(() => localStorage.clear())

it('sits in the shared page frame', () => {
  renderLevel()
  expect(screen.getByRole('main')).toHaveClass('overflow-hidden')
  expect(screen.getByRole('banner')).toHaveClass('grid')
  expect(screen.getByTestId('page-body')).toHaveClass('overflow-y-auto')
})

it('shows one card per pair, with both words and the contrast', () => {
  renderLevel()

  expect(screen.getByRole('heading', { name: /Nghe & chọn/ })).toBeInTheDocument()
  expect(screen.getByText('Nghe tinh, chọn đúng từ!')).toBeInTheDocument()
  expect(PAIRS).toHaveLength(8)

  const cards = screen.getAllByRole('link', { name: /^Cặp / })
  expect(cards).toHaveLength(8)
  for (const p of PAIRS) {
    const card = screen.getByRole('link', { name: `Cặp ${p.a.word} và ${p.b.word}` })
    expect(card).toHaveAttribute('href', `/pair/${p.id}`)
    expect(within(card).getByText(`${p.a.emoji} ${p.a.word} · ${p.b.emoji} ${p.b.word}`)).toBeInTheDocument()
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

it('8 large tiles, one line per pair, teal contrast chip, no lg:', () => {
  renderLevel()

  expect(screen.getByTestId('list-grid')).toHaveClass('grid-cols-2', 'md:grid-cols-3', 'ipad:grid-cols-4')
  expect(screen.getByTestId('list-grid').className).not.toMatch(/\blg:/)

  const tiles = screen.getAllByTestId('tile')
  expect(tiles).toHaveLength(8)
  expect(tiles[0]).toHaveClass('h-[128px]', 'md:h-[160px]')

  const first = PAIRS[0]
  expect(screen.getByText(`${first.a.emoji} ${first.a.word} · ${first.b.emoji} ${first.b.word}`)).toHaveClass('text-[17px]', 'md:text-[20px]')
  expect(within(tiles[0]).getByText(first.contrast)).toHaveClass('bg-teal-50', 'text-[11px]')
})
