import { fireEvent, render, screen, within } from '@testing-library/react'
import type { SyncStatus } from '../../cloud/sync'
import { AccountCard } from './AccountCard'
import type { AccountState } from './AccountCard'

const EMAIL61 = 'nguyenthiphuongthaonguyenvanphamlethihoangtranminhab@vidu.com'

const SYNCED: SyncStatus = { state: 'synced', pending: 0, lastSyncedAt: null, lastError: null, syncing: false }
const OFFLINE: SyncStatus = { state: 'offline', pending: 0, lastSyncedAt: null, lastError: null, syncing: false }
const PENDING12: SyncStatus = { state: 'pending', pending: 12, lastSyncedAt: null, lastError: null, syncing: false }
const SYNCED_AT: SyncStatus = {
  state: 'synced', pending: 0, lastSyncedAt: new Date('2026-09-04T09:41:00').getTime(), lastError: null, syncing: false,
}
const SYNC_ERROR: SyncStatus = { state: 'pending', pending: 3, lastSyncedAt: null, lastError: 'boom', syncing: false }
const SYNCING: SyncStatus = { state: 'pending', pending: 3, lastSyncedAt: null, lastError: null, syncing: true }

const noopHandlers = {
  onEmailChange: () => {},
  onOtpChange: () => {},
  onSendOtp: () => {},
  onVerifyOtp: () => {},
  onEditEmail: () => {},
  onSignOut: () => {},
  onRetryConnect: () => {},
  onRetrySync: () => {},
}

const base = { sync: SYNCED, hasSession: true, recoveryCode: null as string | null, ...noopHandlers }

const ALL_11_STATES: AccountState[] = [
  { kind: 'loading' },
  { kind: 'noSession', online: true },
  { kind: 'noSession', online: false },
  { kind: 'link', email: '' },
  { kind: 'link', email: 'me@ex.com', busy: true },
  { kind: 'otp', email: EMAIL61, otp: '4821' },
  { kind: 'otp', email: EMAIL61, otp: '48', error: 'Mã sai hoặc đã hết hạn — gửi lại mã mới nhé.' },
  { kind: 'link', email: '' },
  { kind: 'linked', email: EMAIL61 },
  { kind: 'syncError', email: EMAIL61, pending: 3 },
  { kind: 'linked', email: EMAIL61, signingOut: true, pending: 3 },
]

describe('AccountCard', () => {
  it('① loading is the 150px skeleton under a "…" pill', () => {
    render(<AccountCard {...base} state={{ kind: 'loading' }} />)
    expect(screen.getByTestId('skeleton-account')).toHaveClass('h-[150px]')
    expect(screen.getByTestId('account-card-body')).toHaveClass('min-h-[150px]')
  })

  /** Fix round 1 (decision 14): the h32 pill moved to the `Panel` header via `right` in
   * `ParentDashboard`; `showPill={false}` lets that caller opt out of the card's own copy so only
   * one `data-testid="sync-status"` renders per panel. Default stays `true` for every other test
   * in this file. */
  it('showPill={false} renders the card with no pill of its own', () => {
    render(<AccountCard {...base} showPill={false} state={{ kind: 'linked', email: EMAIL61 }} />)
    expect(screen.queryByTestId('sync-status')).not.toBeInTheDocument()
    expect(screen.getByTestId('linked-email')).toBeInTheDocument()
  })

  it('② no session online: info notice + "Thử kết nối", pill "⚡ Chưa kết nối"', () => {
    render(<AccountCard {...base} hasSession={false} state={{ kind: 'noSession', online: true }} />)
    const n = screen.getByTestId('no-session')
    expect(n).toHaveClass('bg-teal-50', 'text-teal-600')
    expect(n).toHaveTextContent('Chưa kết nối được tài khoản. Bé vẫn học bình thường, tiến độ lưu trên máy.')
    expect(screen.getByTestId('sync-status')).toHaveTextContent('⚡ Chưa kết nối')
    expect(screen.getByRole('button', { name: 'Thử kết nối' })).toHaveClass('min-h-[44px]')
  })

  it('③ no session offline is its own state: warn tone with the 📡 icon and no button', () => {
    render(<AccountCard {...base} hasSession={false} sync={OFFLINE} state={{ kind: 'noSession', online: false }} />)
    const n = screen.getByTestId('no-session')
    expect(n).toHaveClass('bg-sun-50', 'text-sun-700')
    expect(n).toHaveTextContent('Đang ngoại tuyến — sẽ tự kết nối khi có mạng.')
    expect(within(n).getByText('📡')).toBeInTheDocument()
    expect(screen.getByTestId('sync-status')).toHaveTextContent('⚡ Ngoại tuyến')
    expect(screen.queryByRole('button', { name: 'Thử kết nối' })).toBeNull()
  })

  it('④ the link form is one sentence, a 44px field and a "Liên kết" button', () => {
    render(<AccountCard {...base} sync={PENDING12} state={{ kind: 'link', email: '' }} />)
    expect(screen.getByText('Liên kết email để giữ tiến độ và xem trên máy khác.')).toHaveClass('text-[12px]')
    expect(screen.getByLabelText('Email của bố mẹ')).toHaveClass('h-11', 'rounded-r12', 'border-2', 'border-sand-edge')
    expect(screen.getByPlaceholderText('email@vidu.com')).toBeInTheDocument()
    expect(screen.getByTestId('sync-status')).toHaveTextContent('● Chưa đồng bộ 12 mục')
  })

  it('⑤ busy dims the button via `disabled` (Button owns the opacity), spins a 16px ring inside it and keeps the typed email', () => {
    render(<AccountCard {...base} state={{ kind: 'link', email: 'me@ex.com', busy: true }} />)
    const btn = screen.getByRole('button', { name: /Đang gửi…/ })
    expect(btn).toBeDisabled()
    expect(within(btn).getByTestId('button-spinner')).toHaveClass('h-4', 'w-4')
    expect(screen.getByLabelText('Email của bố mẹ')).toHaveValue('me@ex.com')
  })

  it('⑥ OTP: the 61-char email sits inside the sentence, the code box is Baloo 20 tracking 6 with exactly one font-size token, "Sửa lại email" is 44', () => {
    render(<AccountCard {...base} state={{ kind: 'otp', email: EMAIL61, otp: '4821' }} />)
    expect(screen.getByTestId('otp-sentence')).toHaveClass('truncate')
    expect(screen.getByTestId('otp-sentence')).toHaveAttribute('title', EMAIL61)
    const otpInput = screen.getByLabelText('Mã 6 số')
    expect(otpInput).toHaveClass('text-center', 'font-display', 'text-[20px]', 'tracking-[6px]', 'border-teal-500')
    // Fix round 1: `text-[20px]` must be the ONLY font-size utility on the box — a second one
    // (e.g. a stacked `text-[22px]` from the shared A2 code-input style) makes the rendered size a
    // stylesheet-order coin flip instead of a guarantee.
    const sizeTokens = otpInput.className.split(/\s+/).filter(c => /^text-\[\d+px\]$/.test(c))
    expect(sizeTokens).toEqual(['text-[20px]'])
    const edit = screen.getByRole('button', { name: 'Sửa lại email' })
    expect(edit).toHaveClass('min-h-[44px]')
    expect(edit.className).not.toMatch(/min-h-\[36px\]/)
  })

  it('⑦ an error reddens the field and puts the sentence in the field gutter, not after the form', () => {
    render(<AccountCard {...base} state={{ kind: 'otp', email: EMAIL61, otp: '48', error: 'Mã sai hoặc đã hết hạn — gửi lại mã mới nhé.' }} />)
    const box = screen.getByLabelText('Mã 6 số')
    expect(box).toHaveClass('border-fix-700')
    // Final wave / C1: `toHaveClass('border-fix-700')` on its own CANNOT FAIL — it passed for the
    // whole branch while the box rendered teal, because the error class was appended to a string
    // that already named a border colour and the winner is stylesheet order, not JSX order. The
    // absence check is what makes this test able to fail.
    expect(box.className).not.toMatch(/border-(sand-edge|teal-500)/)
    expect(screen.getByTestId('field-error')).toHaveTextContent('Mã sai hoặc đã hết hạn — gửi lại mã mới nhé.')
    expect(screen.getByRole('button', { name: 'Gửi lại mã' })).toBeInTheDocument()
  })

  it('⑧ the recovery code keeps the Phase 12 credential Notice', () => {
    render(<AccountCard {...base} recoveryCode="QZQJ7MFC" state={{ kind: 'link', email: '' }} />)
    expect(screen.getByText('QZQJ7MFC')).toHaveClass('tracking-[4px]')
    expect(screen.getByText(/Chỉ hiện 1 lần/)).toBeInTheDocument()
  })

  it('⑨ linked: a 61-char email in a 44px read-only box, one line, ellipsised, with a title', () => {
    render(<AccountCard {...base} sync={SYNCED_AT} state={{ kind: 'linked', email: EMAIL61 }} />)
    const box = screen.getByTestId('linked-email')
    expect(box).toHaveClass('h-11', 'min-w-0', 'rounded-r12', 'border-2', 'border-line-200')
    expect(box).toHaveAttribute('title', EMAIL61)
    // Fix round 1: `truncate` lives on a nested non-flex span, not on `box` itself — Chromium never
    // paints the ellipsis for a flex container's own direct text-node child.
    expect(box.querySelector('span')).toHaveClass('block', 'truncate')
    expect(screen.getByTestId('sync-status')).toHaveTextContent('✓ Đã đồng bộ · 09:41')
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toHaveClass('min-h-[44px]')
  })

  it('⑩ sync error: the ⚠ pill, the count sentence and a "Thử lại" that calls onRetrySync', () => {
    const onRetrySync = vi.fn()
    render(<AccountCard {...base} onRetrySync={onRetrySync} sync={SYNC_ERROR} state={{ kind: 'syncError', email: EMAIL61, pending: 3 }} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('⚠ Không đồng bộ được')
    expect(screen.getByText('3 mục chưa lên máy chủ. Sẽ thử lại khi có mạng.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); expect(onRetrySync).toHaveBeenCalled()
  })

  it('⑪ signing out: the syncing pill, the "đang lưu" sentence and a disabled button', () => {
    render(<AccountCard {...base} sync={SYNCING} state={{ kind: 'linked', email: EMAIL61, signingOut: true, pending: 3 }} />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('◌ Đang đồng bộ…')
    expect(screen.getByText('Đang lưu 3 mục còn lại trước khi đăng xuất…')).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: 'Đăng xuất' })
    expect(btn).toBeDisabled()
  })

  it('no control in any of the eleven states is a 56/64 child button', () => {
    for (const state of ALL_11_STATES) {
      const { unmount } = render(<AccountCard {...base} state={state} />)
      for (const b of screen.queryAllByRole('button')) {
        expect(b.className).not.toMatch(/min-h-\[56px\]|min-h-\[64px\]|md:h-16|md:min-h-\[64px\]/)
      }
      unmount()
    }
  })
})
