import { useNavigate } from 'react-router-dom'
import type { SpeakErrorKind } from './speakError'

/**
 * The one action every speaking screen wires to `SpeakError`'s `onAction`: `'limit'` sends the
 * child home (the mic is locked for the rest of the day, so there is nothing left to do here),
 * `'noSpeech'`/`'notReady'` clear the attempt so the child can simply try again, and every other
 * kind (`'mic'`, `'unsupported'`, `'fallback'`) does nothing — dismissing the banner is the whole
 * action for those (spec decision 11).
 *
 * Extracted after a hand-copied version of this in `SoundPractice.tsx` silently dropped the
 * `'limit'` branch (no `useNavigate`, no `nav('/')`): a child hitting the daily limit there saw a
 * "Về nhà" button that did nothing. One shared implementation is the fix that cannot re-diverge.
 */
export function useSpeakErrorAction(attempt: { reset(): void }): (kind: SpeakErrorKind) => void {
  const navigate = useNavigate()
  return (kind: SpeakErrorKind) => {
    if (kind === 'limit') navigate('/')
    else if (kind === 'noSpeech' || kind === 'notReady') attempt.reset()
  }
}
