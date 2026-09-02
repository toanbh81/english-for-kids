import { act, fireEvent, render, screen } from '@testing-library/react'
import { DialogProvider } from './DialogProvider'
import { useDialog } from './useDialog'

function Harness({ onDone }: { onDone: (v: unknown) => void }) {
  const d = useDialog()
  return <>
    <button onClick={() => void d.destructive({ title: 'Xoá toàn bộ tiến trình của bé?', body: 'Không khôi phục được.', confirmLabel: 'Xoá tiến trình' }).then(onDone)}>del</button>
    <button onClick={() => void d.confirm({ title: 'Đăng xuất khỏi tài khoản này?', body: 'Bé vẫn học được, tiến độ sẽ không đồng bộ.', confirmLabel: 'Đăng xuất' }).then(onDone)}>out</button>
    <button onClick={() => void d.prompt({ title: 'Đổi tên hồ sơ', label: 'Tên của bé', initial: 'Bé', maxLength: 40 }).then(onDone)}>ren</button>
  </>
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
