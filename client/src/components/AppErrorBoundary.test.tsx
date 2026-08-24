import { render, screen, fireEvent } from '@testing-library/react'
import { AppErrorBoundary } from './AppErrorBoundary'

function Boom(): never {
  throw new Error('screen exploded')
}

const assign = vi.fn()

beforeEach(() => {
  localStorage.clear()
  assign.mockClear()
  // React logs the caught error itself; the boundary adds its own trace. Neither is a test failure.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // jsdom refuses a real navigation ("Not implemented") and its `location.assign` is a
  // non-writable own property, so the whole object is swapped out through its getter instead.
  vi.spyOn(window, 'location', 'get').mockReturnValue({ assign, href: '/' } as unknown as Location)
})

afterEach(() => vi.restoreAllMocks())

it('renders the children while nothing throws', () => {
  render(<AppErrorBoundary><p>màn hình bình thường</p></AppErrorBoundary>)
  expect(screen.getByText('màn hình bình thường')).toBeInTheDocument()
})

it('renders the Foxy fallback when a child throws', () => {
  render(<AppErrorBoundary><Boom /></AppErrorBoundary>)

  expect(screen.getByRole('heading', { name: 'Ôi, có lỗi rồi 🦊' })).toBeInTheDocument()
  const home = screen.getByRole('button', { name: 'Về nhà' })
  expect(home.className).toContain('min-h-[72px]') // the 64 px tap-target floor, with room to spare
})

it('the way home drops every lesson key and reloads the map', () => {
  localStorage.setItem('speakup.lesson.2026-08-24', '{"broken":true}')
  localStorage.setItem('speakup.lesson.length', 'long')
  localStorage.setItem('speakup.stars', JSON.stringify({ 'story:little-fox': 3 }))

  render(<AppErrorBoundary><Boom /></AppErrorBoundary>)
  fireEvent.click(screen.getByRole('button', { name: 'Về nhà' }))

  expect(localStorage.getItem('speakup.lesson.2026-08-24')).toBeNull()
  expect(localStorage.getItem('speakup.lesson.length')).toBeNull()
  // Nothing else the child earned is thrown away with it.
  expect(localStorage.getItem('speakup.stars')).not.toBeNull()
  expect(assign).toHaveBeenCalledWith('/')
})
