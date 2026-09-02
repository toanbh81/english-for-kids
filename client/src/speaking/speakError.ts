export type SpeakErrorKind = 'mic' | 'noSpeech' | 'unsupported' | 'fallback' | 'limit' | 'notReady'
export type SpeakError = { kind: SpeakErrorKind; detail?: string }

/** Brief §2.5 — the child's line, the parent's line, the button. */
export const SPEAK_ERROR_COPY: Record<SpeakErrorKind, { icon: string; title: string; sub: string; action: string }> = {
  mic: { icon: '🎤', title: 'Bé cho phép dùng mic nhé!', sub: 'mic bị từ chối / không có thiết bị', action: 'Mở cài đặt' },
  noSpeech: { icon: '👂', title: 'Không nghe rõ, bé thử lại nhé!', sub: 'NoMatch · timeout 15s · payload lỗi', action: 'Thử lại' },
  unsupported: { icon: '🌐', title: 'Trình duyệt này chưa nghe được', sub: 'không có nhận dạng giọng nói', action: 'Mở Chrome' },
  fallback: { icon: '📡', title: 'Mất kết nối — dùng chế độ đơn giản', sub: 'offline / máy chấm hỏng / quota 429', action: 'Tiếp tục' },
  limit: { icon: '🌙', title: 'Hôm nay bé học đủ rồi! Mai gặp lại nhé', sub: 'hết giới hạn phút/ngày · mic khoá', action: 'Về nhà' },
  notReady: { icon: '👂', title: 'Máy chấm chưa sẵn', sub: 'máy chấm chưa trả lời sau 3 giây', action: 'Thử lại' },
}
