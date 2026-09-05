/**
 * The adult zone's ONE Vietnamese vocabulary for auth failures (spec decision 22 / R10).
 *
 * Final wave / I6: there used to be two `describeAuthError`s — this table, rewritten in round 4 for
 * `CloudStart`, and an older copy inside `ParentDashboard`. Same `AuthResult` codes, same OTP flow,
 * same zone, different sentences: a parent who mistyped an OTP at `/start` read "Mã sai hoặc đã hết
 * hạn — gửi lại mã mới nhé." and the identical failure in the Account card read "Mã chưa đúng hoặc
 * đã hết hạn, thử lại nhé.". The whole premise of the phase is "bốn màn người lớn nói một ngôn
 * ngữ", so the round-4 table is canonical and the dashboard imports it.
 *
 * It lives in its own module (not in `CloudStart.tsx`) for two reasons: `cloud/*` is read-only in
 * this phase, so it cannot go there; and a screen file that also exports a plain function trips
 * `react-refresh/only-export-components`, which is where two of this branch's lint warnings came
 * from.
 *
 * The signatures and the identifying branches are unchanged from before round 4 — only the sentence
 * each branch returns — so callers and tests that key off the CODE rather than the copy keep
 * working.
 */

/**
 * Vietnamese copy for an `AuthResult`'s error code.
 *
 * `invalid-email`, `invalid-token`, `cloud-unconfigured`, `anonymous-session-in-use` and
 * `email-not-linked` are this app's own codes (`cloud/auth.ts` never guesses at Supabase's wording
 * for those). Everything else is a raw Supabase message — never shown verbatim to a Vietnamese
 * parent, and a wrong or expired OTP is exactly the shape that lands here (Supabase's own wording
 * for both is some variant of "invalid/expired token").
 */
export function describeAuthError(code: string): string {
  const lower = code.toLowerCase()
  if (code === 'invalid-email') return 'Email chưa đúng định dạng.'
  if (code === 'cloud-unconfigured') return 'Tính năng tài khoản chưa bật trên bản này.'
  // Never "thử lại": a retry reproduces this exactly. The way out is the parent screen, where the
  // email is linked to the account this device already has instead of replacing it.
  if (code === 'anonymous-session-in-use') {
    return 'Máy này đang có hồ sơ của tài khoản khác — đăng xuất ở Góc phụ huynh trước.'
  }
  // The honest answer to "Tôi có email đã liên kết" when it turns out this one is not linked. It
  // must never read as a network hiccup: the parent has to try their other address, or the
  // recovery code, rather than the same email again.
  if (code === 'email-not-linked') {
    return 'Email này chưa liên kết với Speak Up — thử mã khôi phục.'
  }
  if (code === 'invalid-token' || /invalid|expired|not\s*found/.test(lower)) {
    return 'Mã sai hoặc đã hết hạn — gửi lại mã mới nhé.'
  }
  if (/network|fetch/.test(lower)) return 'Mất kết nối — kiểm tra mạng rồi thử lại.'
  return 'Có lỗi xảy ra — thử lại sau ít phút.'
}

/** `/api/recover`'s HTTP status → the one sentence that tells the parent what to do next. */
export function describeRecoverError(status: number): string {
  if (status === 400) return 'Mã phải đủ 8 chữ và số.'
  if (status === 401) return 'Mã không đúng — kiểm tra lại chữ O và số 0.'
  if (status === 403) return 'Mã này thuộc tài khoản khác đang dùng máy này.'
  if (status === 404) return 'Không tìm thấy mã — có thể đã được thay mã mới.'
  if (status === 409) return 'Mã đã dùng trên máy khác — tạo mã mới ở máy đó.'
  if (status === 429) return 'Thử quá nhiều lần — đợi 5 phút rồi thử lại.'
  return 'Không kết nối được máy chủ — thử lại sau.'
}
