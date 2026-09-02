import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** A text link that looks like one (brief §2.1): 14–15 px underlined, no background, no edge,
 * but still a 44 px tap target. Use it for every "secondary" action that used to be a 64 px
 * ghost button — "Bắt đầu mới cho bé", "Sửa lại email", "← Chọn cách khác". */
export function LinkText({ to, state, onClick, className = '', children }: {
  to?: string
  state?: unknown
  onClick?: () => void
  className?: string
  children: ReactNode
}) {
  const classes = `inline-flex min-h-[44px] items-center px-2 text-[15px] font-bold text-teal-600 underline underline-offset-2 active:opacity-70 ${className}`
  if (to !== undefined) return <Link to={to} state={state} className={classes}>{children}</Link>
  return <button type="button" onClick={onClick} className={classes}>{children}</button>
}
