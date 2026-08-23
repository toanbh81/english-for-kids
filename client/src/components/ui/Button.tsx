import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
export type ButtonSize = 'md' | 'lg'

// The press sinks the button into its own shadow: the offset halves as the face moves down 2 px,
// so the button looks pushed rather than just nudged. Shadowless variants only move.
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-coral-500 text-white shadow-chunky-coral active:shadow-[0_3px_0_#E05A3A]',
  secondary: 'bg-teal-500 text-white shadow-chunky-teal active:shadow-[0_3px_0_#1FA396]',
  outline: 'bg-white text-teal-600 border-[3px] border-teal-500/30',
  ghost: 'bg-transparent text-ink-300 border-[3px] border-dashed border-line-200',
}

const SIZE: Record<ButtonSize, string> = {
  md: 'min-h-[64px] px-8 text-[22px] rounded-xl3',
  lg: 'min-h-[72px] px-10 text-[26px] rounded-xl4',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Draws attention to the one action the child should take next. */
  pulse?: boolean
  /** Renders a react-router `Link` styled as a button instead of a `<button>`. */
  to?: string
}

/** The chunky handoff button: hard offset shadow that the press sinks into
 * (`active:translate-y-[2px]`), Baloo display type and a ≥64 px tap target. */
export function Button({ variant = 'primary', size = 'md', pulse, to, className = '', children, ...rest }: Props) {
  const classes = [
    'inline-flex items-center justify-center gap-2 font-display font-extrabold',
    'transition-transform active:translate-y-[2px] disabled:opacity-60 disabled:active:translate-y-0',
    SIZE[size],
    VARIANT[variant],
    pulse ? 'animate-pulse-soft' : '',
    className,
  ].filter(Boolean).join(' ')

  if (to !== undefined) {
    // A link never takes `disabled`/`type`, so the button attributes that survive are anchor-safe.
    const anchorProps = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>
    return <Link to={to} className={classes} {...anchorProps}>{children}</Link>
  }

  return <button type="button" className={classes} {...rest}>{children}</button>
}
