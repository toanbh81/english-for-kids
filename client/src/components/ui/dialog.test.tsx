import { useEffect } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { DialogProvider } from './DialogProvider'
import { useDialog } from './useDialog'
import type { DialogContextValue } from './DialogContext'

function Harness({ onDone, delOnConfirm }: { onDone: (v: unknown) => void; delOnConfirm?: () => Promise<unknown> }) {
  const d = useDialog()
  return <>
    <button onClick={() => void d.destructive({ title: 'Xoá toàn bộ tiến trình của bé?', body: 'Không khôi phục được.', confirmLabel: 'Xoá tiến trình', onConfirm: delOnConfirm }).then(onDone)}>del</button>
    <button onClick={() => void d.confirm({ title: 'Đăng xuất khỏi tài khoản này?', body: 'Bé vẫn học được, tiến độ sẽ không đồng bộ.', confirmLabel: 'Đăng xuất' }).then(onDone)}>out</button>
    <button onClick={() => void d.prompt({ title: 'Đổi tên hồ sơ', label: 'Tên của bé', initial: 'Bé', maxLength: 40 }).then(onDone)}>ren</button>
  </>
}

/** A promise the test controls, standing in for a slow `resetRemoteProgress`/`signOut`. */
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

/** A ref-style harness for tests that need to call `prompt`/`confirm`/`destructive` directly
 * (rather than through a button in the DOM), e.g. to exercise options `Harness` above doesn't
 * take, such as `placeholder`. */
const dialogRef: { current: DialogContextValue | null } = { current: null }
function DialogRefHarness() {
  const d = useDialog()
  useEffect(() => { dialogRef.current = d }, [d])
  return null
}
function renderWithProvider() {
  dialogRef.current = null
  render(<DialogProvider><DialogRefHarness /></DialogProvider>)
}

it('throws a clear error when useDialog is used outside the provider', () => {
  function Bare() { useDialog(); return null }
  expect(() => render(<Bare />)).toThrow(/DialogProvider/)
})

it('destructive dialog resolves true on the red button and false on cancel', async () => {
  const onDone = vi.fn()
  render(<DialogProvider><Harness onDone={onDone} /></DialogProvider>)
  fireEvent.click(screen.getByText('del'))
  const dlg = screen.getByRole('dialog')
  expect(dlg).toHaveClass('w-[min(420px,calc(100%-32px))]', 'rounded-r20')
  expect(screen.getByRole('button', { name: 'Xoá tiến trình' })).toHaveClass('bg-fix-700', 'min-h-[44px]')
  fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
  await act(async () => {})
  expect(onDone).toHaveBeenCalledWith(false)
})

it('destructive dialog resolves true when the confirm button is clicked', async () => {
  const onDone = vi.fn()
  render(<DialogProvider><Harness onDone={onDone} /></DialogProvider>)
  fireEvent.click(screen.getByText('del'))
  fireEvent.click(screen.getByRole('button', { name: 'Xoá tiến trình' }))
  await act(async () => {})
  expect(onDone).toHaveBeenCalledWith(true)
})

it('a regular confirm dialog resolves false on scrim click', async () => {
  const onDone = vi.fn()
  render(<DialogProvider><Harness onDone={onDone} /></DialogProvider>)
  fireEvent.click(screen.getByText('out'))
  const dlg = screen.getByRole('dialog')
  fireEvent.click(dlg.parentElement!)
  await act(async () => {})
  expect(onDone).toHaveBeenCalledWith(false)
})

it('a second request while one is open rejects the previous with false and replaces it', async () => {
  const onDone = vi.fn()
  render(<DialogProvider><Harness onDone={onDone} /></DialogProvider>)
  fireEvent.click(screen.getByText('del'))
  fireEvent.click(screen.getByText('out'))
  await act(async () => {})
  expect(onDone).toHaveBeenCalledWith(false)
  expect(screen.getByText('Đăng xuất khỏi tài khoản này?')).toBeInTheDocument()
})

it('prompt clamps to maxLength, shows the counter and resolves the text', async () => {
  const onDone = vi.fn()
  render(<DialogProvider><Harness onDone={onDone} /></DialogProvider>)
  fireEvent.click(screen.getByText('ren'))
  const input = screen.getByLabelText('Tên của bé')
  fireEvent.change(input, { target: { value: 'Nguyễn Hoàng Bảo Ngọc Anh Thư' } })
  expect(screen.getByText('29/40')).toBeInTheDocument()
  expect(screen.getByText(/dưới dạng "Anh Thư"/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
  await act(async () => {})
  expect(onDone).toHaveBeenCalledWith('Nguyễn Hoàng Bảo Ngọc Anh Thư')
})

it('prompt resolves null when cancelled', async () => {
  const onDone = vi.fn()
  render(<DialogProvider><Harness onDone={onDone} /></DialogProvider>)
  fireEvent.click(screen.getByText('ren'))
  fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
  await act(async () => {})
  expect(onDone).toHaveBeenCalledWith(null)
})

/**
 * Fix round 1, finding 1: `onConfirm` must keep the dialog on screen and busy — buttons disabled,
 * the confirm label swapped for "…", scrim and Escape ignored — for exactly as long as the
 * callback takes, closing and resolving `true` only once it settles. Before this fix `resolve`
 * fired (and the dialog unmounted) the instant the button was clicked, so a caller's own
 * `setBusy` ran against nothing on screen.
 */
it('stays open and busy while onConfirm is pending, then closes and resolves true once it settles', async () => {
  const onDone = vi.fn()
  const work = deferred<void>()
  render(<DialogProvider><Harness onDone={onDone} delOnConfirm={() => work.promise} /></DialogProvider>)
  fireEvent.click(screen.getByText('del'))
  fireEvent.click(screen.getByRole('button', { name: 'Xoá tiến trình' }))
  await act(async () => {})

  // Still open and busy: the confirm button's own label is now "…", both buttons are disabled,
  // and neither the scrim nor Escape can dismiss it.
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  const busyButton = screen.getByRole('button', { name: '…' })
  expect(busyButton).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Huỷ' })).toBeDisabled()
  expect(onDone).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('dialog').parentElement!)
  fireEvent.keyDown(window, { key: 'Escape' })
  await act(async () => {})
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(onDone).not.toHaveBeenCalled()

  await act(async () => { work.resolve(); await Promise.resolve() })

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(onDone).toHaveBeenCalledWith(true)
})

it('a thrown onConfirm still closes the dialog and resolves true — the caller owns its own errors', async () => {
  const onDone = vi.fn()
  render(<DialogProvider><Harness onDone={onDone} delOnConfirm={() => Promise.reject(new Error('boom'))} /></DialogProvider>)
  fireEvent.click(screen.getByText('del'))
  fireEvent.click(screen.getByRole('button', { name: 'Xoá tiến trình' }))
  await act(async () => {})

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(onDone).toHaveBeenCalledWith(true)
})

it('moves focus to the confirm button when a confirm/destructive dialog opens', async () => {
  const onDone = vi.fn()
  render(<DialogProvider><Harness onDone={onDone} /></DialogProvider>)
  fireEvent.click(screen.getByText('out'))
  expect(screen.getByRole('button', { name: 'Đăng xuất' })).toHaveFocus()
})

it('Escape cancels a dialog when it is not busy, resolving false', async () => {
  const onDone = vi.fn()
  render(<DialogProvider><Harness onDone={onDone} /></DialogProvider>)
  fireEvent.click(screen.getByText('out'))
  fireEvent.keyDown(window, { key: 'Escape' })
  await act(async () => {})
  expect(onDone).toHaveBeenCalledWith(false)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

/**
 * Fix round 2: a busy dialog used to be replaceable, because `open()` had no notion of "busy" at
 * all — it would resolve the busy request's promise `false` and hand its DOM node's props to a
 * brand-new request (no `key`, so React reused the component instance instead of remounting),
 * which meant the new dialog inherited the old one's `busy=true` local state and rendered
 * permanently stuck (both controls disabled, confirm frozen on "…", focus effect never re-run).
 * Reachable because every control INSIDE a busy dialog is disabled, so Tab escapes it and can
 * land on a background trigger the screen forgot to disable.
 */
it('refuses to replace a busy dialog: the new request resolves false immediately, the busy one stays put', async () => {
  const onDone = vi.fn()
  const work = deferred<void>()
  render(<DialogProvider><Harness onDone={onDone} delOnConfirm={() => work.promise} /></DialogProvider>)
  fireEvent.click(screen.getByText('del'))
  fireEvent.click(screen.getByRole('button', { name: 'Xoá tiến trình' }))
  await act(async () => {})

  expect(screen.getByRole('button', { name: '…' })).toBeDisabled()

  // A different trigger the screen left enabled — as if Tab had escaped the disabled dialog.
  fireEvent.click(screen.getByText('out'))
  await act(async () => {})

  // Refused immediately: `false`, with no wait for the busy dialog's own work.
  expect(onDone).toHaveBeenCalledTimes(1)
  expect(onDone).toHaveBeenLastCalledWith(false)
  // Still the ORIGINAL (destructive) dialog on screen, still busy — not replaced by a sign-out one.
  expect(screen.getByText('Xoá toàn bộ tiến trình của bé?')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '…' })).toBeDisabled()

  await act(async () => { work.resolve(); await Promise.resolve() })

  expect(onDone).toHaveBeenCalledTimes(2)
  expect(onDone).toHaveBeenLastCalledWith(true)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

/** Fix round 2: a genuinely replaced (non-busy) request must remount fresh — not disabled, and
 * focused on its own confirm button — rather than inheriting whatever the PREVIOUS request's
 * component instance last rendered. */
it('a fresh dialog opened after the previous one closes is not disabled and is focused', async () => {
  const onDone = vi.fn()
  render(<DialogProvider><Harness onDone={onDone} /></DialogProvider>)
  fireEvent.click(screen.getByText('del'))
  fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
  await act(async () => {})
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  fireEvent.click(screen.getByText('out'))
  const confirmButton = screen.getByRole('button', { name: 'Đăng xuất' })
  expect(confirmButton).not.toBeDisabled()
  expect(confirmButton).toHaveFocus()
})

it('a prompt renders its placeholder and nothing else about the dialog changes', async () => {
  renderWithProvider()
  act(() => { void dialogRef.current!.prompt({ title: 'Thêm hồ sơ mới', label: 'Tên của bé', maxLength: 40, placeholder: 'Ví dụ: Bé Su' }) })
  const input = await screen.findByLabelText('Tên của bé')
  expect(input).toHaveAttribute('placeholder', 'Ví dụ: Bé Su')
  expect(input).toHaveClass('h-11', 'rounded-r12', 'border-2', 'border-teal-500')
  expect(screen.getByText('0/40')).toBeInTheDocument()
})

it('a prompt without a placeholder has none', async () => {
  renderWithProvider()
  act(() => { void dialogRef.current!.prompt({ title: 'Đổi tên hồ sơ', label: 'Tên của bé', maxLength: 40 }) })
  const input = await screen.findByLabelText('Tên của bé')
  expect(input).not.toHaveAttribute('placeholder')
})
