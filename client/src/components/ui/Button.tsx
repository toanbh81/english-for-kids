import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
/** `md` and `lg` are responsive (brief §1: phone 56, iPad 64; lg one step up). `adult` is the
 * parent area's fixed 44 (brief §2.1). `sm` is the 48px mission CTA — 48 already clears the 44px
 * tap-target floor and the MissionCard it lives in has no room for the usual 4px hit band, so it
 * skips `HIT` unlike `md`. */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'adult'

// The press sinks the button into its own shadow: the offset halves as the face moves down 2 px,
// so the button looks pushed rather than just nudged. Shadowless variants only move.
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-coral-500 text-white shadow-chunky-coral active:shadow-none',
  secondary: 'bg-teal-500 text-white shadow-chunky-teal active:shadow-none',
  outline: 'bg-white text-teal-600 border-[3px] border-teal-line shadow-edge-outline active:shadow-none',
  ghost: 'bg-transparent text-ink-500 border-[3px] border-dashed border-sand-edge',
  // R14 / quyết định 11: hàng "Đặt lại tiến trình" của dashboard. Viền 2px (không 3 như outline —
  // brief §1.2 vẽ `2px #F8A3AE`), chữ #C2354B, nền trắng, không bóng: một nút phá huỷ không được
  // trông "bấm được cho vui" như primary. Là VARIANT THẬT vì base class luôn thắng className đè.
  danger: 'bg-white text-fix-700 border-2 border-fix-300',
}

// The phone button is 56 tall but its tap target is 64: an invisible 4 px band above and below,
// drawn by the pseudo-element, catches the finger without changing the layout (brief §2.1).
const HIT = "relative after:absolute after:-top-1 after:-bottom-1 after:left-0 after:right-0 after:content-['']"

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-[48px] px-4 text-[17px] rounded-r16',
  md: `min-h-[56px] px-5 text-[18px] rounded-r18 md:min-h-[64px] md:px-7 md:text-[22px] md:rounded-r20 ${HIT} md:after:hidden`,
  lg: `min-h-[64px] px-7 text-[22px] rounded-r20 md:min-h-[72px] md:px-9 md:text-[26px] md:rounded-r24`,
  adult: 'min-h-[44px] px-4 text-[14px] rounded-r12',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Draws attention to the one action the child should take next. */
  pulse?: boolean
  /** Renders a react-router `Link` styled as a button instead of a `<button>`. */
  to?: string
  /** Router state to carry along with `to` — in practice `MISSION_STATE`, the flag that has to
   * travel with the navigation because the destination screen is the same screen either way
   * (`progress/missionNav`). Ignored without `to`: a `<button>` navigates nowhere. */
  state?: unknown
}

/** The chunky handoff button: hard offset shadow that the press sinks into
 * (`active:translate-y-[2px]`), Baloo display type and a ≥44 px tap target (56/64/72 for the
 * responsive `md`/`lg` sizes, a fixed 44 for `adult`). */
export function Button({ variant = 'primary', size = 'md', pulse, to, state, className = '', children, ...rest }: Props) {
  const classes = [
    'inline-flex items-center justify-center gap-2 font-display font-extrabold whitespace-nowrap',
    'transition-transform active:translate-y-[2px] disabled:opacity-45 disabled:shadow-none disabled:active:translate-y-0',
    SIZE[size],
    VARIANT[variant],
    pulse && variant === 'primary' ? 'animate-pulse-coral' : '',
    className,
  ].filter(Boolean).join(' ')

  if (to !== undefined) {
    // A link never takes `disabled`/`type`, so the button attributes that survive are anchor-safe.
    const anchorProps = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>
    return <Link to={to} state={state} className={classes} {...anchorProps}>{children}</Link>
  }

  return <button type="button" className={classes} {...rest}>{children}</button>
}
