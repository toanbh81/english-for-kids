import { act, renderHook, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useSpeakErrorAction } from './useSpeakErrorAction'

/** Where navigation landed — `useNavigate` leaves no return value to assert on, so a probe route
 * is the only way to see it. */
function Probe() {
  const location = useLocation()
  return <p data-testid="probe">{location.pathname}</p>
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/practice/wp-cat']}>
      <Routes>
        <Route path="/practice/:cardId" element={<>{children}</>} />
        <Route path="/" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  )
}

it('resets the attempt on noSpeech and notReady, so the child can simply try again', () => {
  const reset = vi.fn()
  const { result } = renderHook(() => useSpeakErrorAction({ reset }), { wrapper })

  act(() => result.current('noSpeech'))
  expect(reset).toHaveBeenCalledTimes(1)

  act(() => result.current('notReady'))
  expect(reset).toHaveBeenCalledTimes(2)
})

it('does nothing for mic, unsupported or fallback — dismissing the banner is the whole action', () => {
  const reset = vi.fn()
  const { result } = renderHook(() => useSpeakErrorAction({ reset }), { wrapper })

  for (const kind of ['mic', 'unsupported', 'fallback'] as const) act(() => result.current(kind))

  expect(reset).not.toHaveBeenCalled()
})

it('sends the child home on the daily limit, without touching the attempt', () => {
  const reset = vi.fn()
  const { result } = renderHook(() => useSpeakErrorAction({ reset }), { wrapper })

  act(() => result.current('limit'))

  expect(reset).not.toHaveBeenCalled()
  expect(screen.getByTestId('probe')).toHaveTextContent('/')
})
