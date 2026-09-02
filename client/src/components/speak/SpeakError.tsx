// SpeakError.tsx — brief §2.5
import { SPEAK_ERROR_COPY, type SpeakError as SpeakErrorValue, type SpeakErrorKind } from '../../speaking/speakError'
export function SpeakError({ error, onAction, onDismiss }: { error: SpeakErrorValue; onAction: (kind: SpeakErrorKind) => void; onDismiss: () => void }) {
  const c = SPEAK_ERROR_COPY[error.kind]
  return (
    <div role="alert" className="flex w-full max-w-[440px] items-center gap-3 rounded-r16 border-[3px] border-fix-300 bg-fix-50 py-2 pl-3.5 pr-2 min-h-[56px]">
      <span aria-hidden="true" className="text-[22px] leading-none">{c.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[15px] font-extrabold leading-tight text-fix-700">{c.title}</div>
        <div className="text-[12px] font-bold text-ink-500">{error.detail ? `${c.sub} · ${error.detail}` : c.sub}</div>
      </div>
      <button type="button" onClick={() => { onAction(error.kind); onDismiss() }} className="relative flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-r12 bg-white px-3.5 font-display text-[14px] font-extrabold text-fix-700 after:absolute after:-inset-2.5 after:content-['']">{c.action}</button>
    </div>
  )
}
