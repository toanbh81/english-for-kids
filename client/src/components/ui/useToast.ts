import { useCallback, useEffect, useRef, useState } from 'react'

/** Long enough for a parent to read a short Vietnamese line, short enough not to sit over the game. */
const TOAST_MS = 1400

/** Drives `<Toast>`: one toast at a time, so a second `show` replaces the first and restarts
 * the 1.4 s timer. The timer is cleared on unmount, never firing into a dead component. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef(0)

  const show = useCallback((next: string) => {
    window.clearTimeout(timer.current)
    setMessage(next)
    timer.current = window.setTimeout(() => setMessage(null), TOAST_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return { message, show }
}
