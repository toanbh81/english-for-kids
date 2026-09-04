import { useId } from 'react'

// R23 / quyết định 6. Bỏ `<input type="number">` hiện (`ParentDashboard.tsx:947`): bàn phím số
// của iOS che nửa màn ngay dưới ô. −/+ bước 5 là đủ; input ẩn giữ đường a11y.
const BTN = "flex h-9 w-9 items-center justify-center rounded-r10 bg-sand font-display text-[18px] font-extrabold text-ink-500 relative after:absolute after:-inset-1 after:content-['']"
// `width=64` (mặc định) tự co xuống 56 trên phone qua `max-md:w-14`; `width=56` khoá cứng 56 ở mọi
// bề rộng — dùng khi ngữ cảnh gọi đã hẹp sẵn.
const WIDTH: Record<64 | 56, string> = { 64: 'w-16 max-md:w-14', 56: 'w-14' }

/**
 * A ±5 stepper for minute limits (brief §1.1, decision 6): 36×36 −/+ buttons inside a 44px hit
 * band (`after:-inset-1`, the `Button`/`Notice` pattern), a 64×36 teal value box, and a hidden
 * `<input type="number">` that carries the a11y name/value/step without ever taking focus.
 */
export function Stepper({
  value,
  onChange,
  min = 5,
  max = 60,
  step = 5,
  label = 'Phút mỗi ngày',
  width = 64,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  width?: 64 | 56
}) {
  const inputId = useId()

  function apply(next: number) {
    if (next < min || next > max) return
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[12px] font-extrabold text-ink-500">{label}</label>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Giảm" onClick={() => apply(value - step)} className={BTN}>−</button>
        <span data-testid="stepper-value" className={`flex h-9 items-center justify-center rounded-r10 border-2 border-teal-500 font-display text-[16px] font-extrabold text-teal-600 ${WIDTH[width]}`}>{value}</span>
        <button type="button" aria-label="Tăng" onClick={() => apply(value + step)} className={BTN}>+</button>
      </div>
      <span className="text-[11px] font-bold text-ink-300">{min}–{max}, bước {step}</span>
      <input id={inputId} type="number" className="sr-only" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => apply(Number(e.target.value))} />
    </div>
  )
}
