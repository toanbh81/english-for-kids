import { Stars as UiStars } from './ui/Stars'
export type StarsSize = 'md' | 'sm'
/** @deprecated Phase 12 alias; use `ui/Stars`. Removed in Phase 15. */
export function Stars({ value, animate, size = 'md' }: { value: 0 | 1 | 2 | 3; animate?: boolean; size?: StarsSize }) {
  return <UiStars value={value} animate={animate} size={size === 'md' ? 'lg' : 'md'} />
}
