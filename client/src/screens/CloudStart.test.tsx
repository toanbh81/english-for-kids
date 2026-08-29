import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Profile } from '../cloud/profileState'

const cloud = vi.hoisted(() => ({ configured: true }))
vi.mock('../cloud/supabase', () => ({
  isCloudConfigured: () => cloud.configured,
}))

type AuthOk = { ok: true; userId: string | null }
type AuthFail = { ok: false; error: string }
const auth = vi.hoisted(() => ({
  currentAccessToken: vi.fn<() => Promise<string | null>>(async () => 'token-abc'),
  signInWithEmail: vi.fn<(email: string, options?: unknown) => Promise<AuthOk | AuthFail>>(async () => ({ ok: true, userId: 'u1' })),
  verifyEmailOtp: vi.fn<(email: string, token: string) => Promise<AuthOk | AuthFail>>(async () => ({ ok: true, userId: 'u1' })),
}))
vi.mock('../cloud/auth', () => auth)

const profileState = vi.hoisted(() => ({
  adoptProfiles: vi.fn((remote: Profile[]) => remote),
  fetchRemoteProfiles: vi.fn(async (): Promise<Profile[]> => []),
  switchProfile: vi.fn(() => true),
}))
vi.mock('../cloud/profileState', () => profileState)

const sync = vi.hoisted(() => ({ pullProfile: vi.fn(async () => true) }))
vi.mock('../cloud/sync', () => sync)

import { CloudStart } from './CloudStart'

function renderStart() {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="/start" element={<CloudStart />} />
        <Route path="/" element={<p>trang chủ</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const profile = (id: string, name = 'Bé', avatar = '🦊'): Profile => ({ id, name, avatar, created: 0 })

beforeEach(() => {
  vi.clearAllMocks()
  cloud.configured = true
  auth.currentAccessToken.mockResolvedValue('token-abc')
  auth.signInWithEmail.mockResolvedValue({ ok: true, userId: 'u1' })
  auth.verifyEmailOtp.mockResolvedValue({ ok: true, userId: 'u1' })
  profileState.adoptProfiles.mockImplementation((remote: Profile[]) => remote)
  profileState.fetchRemoteProfiles.mockResolvedValue([])
  sync.pullProfile.mockResolvedValue(true)
  vi.stubGlobal('fetch', vi.fn())
})

describe('with no cloud configured', () => {
  it('redirects home instead of showing a form that can never succeed', () => {
    cloud.configured = false
    renderStart()
    expect(screen.getByText('trang chủ')).toBeInTheDocument()
  })
})

describe('the menu', () => {
  it('offers both doors and an honest fresh start', () => {
    renderStart()
    expect(screen.getByText('Tôi có email đã liên kết')).toBeInTheDocument()
    expect(screen.getByText('Tôi có mã khôi phục')).toBeInTheDocument()
    expect(screen.getByText('Bắt đầu mới cho bé')).toBeInTheDocument()
  })
})

describe('the email door', () => {
  async function goToEmail() {
    renderStart()
    fireEvent.click(screen.getByText('Tôi có email đã liên kết'))
    fireEvent.change(screen.getByLabelText('Email của bố/mẹ'), { target: { value: 'bome@example.com' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Email của bố/mẹ').closest('form')!) })
  }

  it('sends the OTP with abandonAnonymous — only this screen is allowed to', async () => {
    await goToEmail()
    expect(auth.signInWithEmail).toHaveBeenCalledWith('bome@example.com', { abandonAnonymous: true })
    expect(screen.getByText(/Nhập mã 6 số vừa gửi tới bome@example.com/)).toBeInTheDocument()
  })

  it('shows a Vietnamese error and lets the parent retry on an offline failure', async () => {
    auth.signInWithEmail.mockResolvedValue({ ok: false, error: 'Failed to fetch' })
    await goToEmail()
    expect(screen.getByRole('alert')).toHaveTextContent('Không có kết nối mạng')
    // still on the email form, ready to retry
    expect(screen.getByLabelText('Email của bố/mẹ')).toBeInTheDocument()
  })

  it('reports a wrong or expired OTP without losing the typed email', async () => {
    await goToEmail()
    auth.verifyEmailOtp.mockResolvedValue({ ok: false, error: 'Token has expired or is invalid' })
    fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '000000' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!) })
    expect(screen.getByRole('alert')).toHaveTextContent('hết hạn')
    expect(screen.getByText(/vừa gửi tới bome@example.com/)).toBeInTheDocument()
  })

  it('lets the parent go back and correct a typo\'d email', async () => {
    await goToEmail()
    fireEvent.click(screen.getByText('Sửa lại email'))
    const input = screen.getByLabelText('Email của bố/mẹ') as HTMLInputElement
    expect(input.value).toBe('bome@example.com')
    fireEvent.change(input, { target: { value: 'fixed@example.com' } })
    await act(async () => { fireEvent.submit(input.closest('form')!) })
    expect(auth.signInWithEmail).toHaveBeenLastCalledWith('fixed@example.com', { abandonAnonymous: true })
  })

  it('restores straight to the one profile the account owns', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue([profile('p1', 'Sóc')])
    profileState.adoptProfiles.mockImplementation((remote: Profile[]) => remote)
    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
    })
    await waitFor(() => expect(sync.pullProfile).toHaveBeenCalledWith('p1'))
    expect(profileState.switchProfile).toHaveBeenCalledWith('p1')
  })

  it('shows a picker when the account owns more than one profile', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue([profile('p1', 'Sóc'), profile('p2', 'Cáo')])
    profileState.adoptProfiles.mockImplementation((remote: Profile[]) => remote)
    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
    })
    expect(await screen.findByText('Sóc')).toBeInTheDocument()
    expect(screen.getByText('Cáo')).toBeInTheDocument()
    expect(sync.pullProfile).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Cáo'))
    await waitFor(() => expect(sync.pullProfile).toHaveBeenCalledWith('p2'))
    expect(profileState.switchProfile).toHaveBeenCalledWith('p2')
  })

  it('is honest when the account has no profiles at all', async () => {
    profileState.fetchRemoteProfiles.mockResolvedValue([])
    profileState.adoptProfiles.mockImplementation(() => [])
    await goToEmail()
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Mã xác nhận'), { target: { value: '123456' } })
      fireEvent.submit(screen.getByLabelText('Mã xác nhận').closest('form')!)
    })
    expect(await screen.findByText(/chưa có hồ sơ nào/)).toBeInTheDocument()
    expect(sync.pullProfile).not.toHaveBeenCalled()
  })
})

describe('the recovery-code door', () => {
  function jsonResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body }
  }

  async function goToCode() {
    renderStart()
    fireEvent.click(screen.getByText('Tôi có mã khôi phục'))
  }

  it('sends the current device\'s own bearer token, never a stored email', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(200, { profiles: 1 }))
    profileState.fetchRemoteProfiles.mockResolvedValue([profile('p1')])
    await goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'abc23xyz' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.headers.authorization).toBe('Bearer token-abc')
    expect(JSON.parse(init.body)).toEqual({ code: 'ABC23XYZ' })
    await waitFor(() => expect(sync.pullProfile).toHaveBeenCalledWith('p1'))
  })

  it('shows the honest reason an already-linked account\'s code is refused', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(403, { error: 'Code belongs to a linked account' }))
    await goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'ABC23XYZ' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    expect(screen.getByRole('alert')).toHaveTextContent('đã liên kết email')
    expect(sync.pullProfile).not.toHaveBeenCalled()
  })

  it('reports an unknown code without pulling anything', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(404, { error: 'Unknown code' }))
    await goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'ZZZZZZZZ' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    expect(screen.getByRole('alert')).toHaveTextContent('Không tìm thấy mã này')
  })

  it('is honest about a dropped connection rather than blaming the code', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'))
    await goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'ABC23XYZ' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    expect(screen.getByRole('alert')).toHaveTextContent('Không có kết nối mạng')
  })

  it('refuses to call the API at all with no session token to present', async () => {
    auth.currentAccessToken.mockResolvedValue(null)
    await goToCode()
    fireEvent.change(screen.getByLabelText(/Mã khôi phục/), { target: { value: 'ABC23XYZ' } })
    await act(async () => { fireEvent.submit(screen.getByLabelText(/Mã khôi phục/).closest('form')!) })
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('goes back to the menu', async () => {
    await goToCode()
    fireEvent.click(screen.getByText('← Chọn cách khác'))
    expect(screen.getByText('Tôi có email đã liên kết')).toBeInTheDocument()
  })
})
