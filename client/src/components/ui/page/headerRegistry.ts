import { useSyncExternalStore } from 'react'

/**
 * How the global `<LessonChip />` in `App.tsx` knows to step aside once a screen mounts its own
 * `<PageHeader>` — which draws its own header-cell chip. Phase 12 migrates screens onto
 * `PageShell` one task at a time, so both have to work at once: a screen not yet migrated still
 * needs the floating chip, and a migrated one must not show it twice.
 *
 * A plain module-level counter, not a boolean: nested or transitional renders (a header
 * unmounting while another mounts, e.g. during a route change) must never let a stray unmount
 * flip "some header is mounted" back to false while a header is still on screen.
 */
let mounted = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

/** Called from `PageHeader`'s effect. Returns the cleanup the effect returns it as. */
export function registerHeader(): () => void {
  mounted++
  emit()
  return () => { mounted--; emit() }
}

/** Whether any `PageHeader` is currently mounted anywhere in the tree. Server snapshot is always
 * `false`: there is no header before hydration/first paint. */
export function useHeaderMounted(): boolean {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l) }, () => mounted > 0, () => false)
}
