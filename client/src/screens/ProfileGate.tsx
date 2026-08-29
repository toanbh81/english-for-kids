import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { activeProfileId, listProfiles, switchProfile } from '../cloud/profileState'
import { ProfilePicker } from '../components/ProfilePicker'
import { Card, PAGE_SHELL } from '../components/ui'

/**
 * Spec flow 6: "tap your face — no password, per the research."
 *
 * Without it a second child picking up the iPad lands in whichever profile the app was last left
 * in — their sibling's — and WRITES to it. `bootstrapProfiles()` adopts whatever `speakup.profile`
 * already names, and nothing else switches profiles outside the parent gate. The damage is not
 * cosmetic and it has no undo: the sibling's stars and streak inflate, their Leitner boxes take in
 * words they have never seen (which is what decides what the app teaches them next), the dashboard
 * reports the merged pair as one child, and the outbox mirrors all of it to every other device and
 * past a cache wipe. Once logged, the two children's events are indistinguishable.
 *
 * The trade-off is the spec's, made deliberately: no math question and no password in front of a
 * child's own name. And the blast radius is bounded at the other end — this only ever appears once
 * a parent has deliberately made a second profile.
 *
 * **A one-profile family must never see it, and must never see it flash.** The decision is taken
 * synchronously in the `useState` initialiser, before the first paint, so there is no frame in
 * which the picker exists for them.
 *
 * **"App start" cannot mean "document mount".** An installed PWA on a family iPad is resumed from
 * the background far more often than it is cold-started: the child taps the icon, iOS restores the
 * same document, no module re-evaluates, and a mount-only gate hands them whoever was chosen this
 * morning. So a resume asks again — see `RE_ASK_AFTER_MS` for the threshold and why it is not zero.
 */
const CHOSEN_KEY = 'speakup.profileChosen'

/**
 * How long the app has to have been away before a resume asks again.
 *
 * Zero would be wrong in the other direction: a child switching apps for ten seconds — a
 * notification, a parent's message, the home screen by accident — would come back to a question
 * instead of their lesson, several times a session. Five minutes is longer than any of that and
 * far shorter than "the iPad was put down and somebody else picked it up", which is the handover
 * this exists to catch. It is also why the resume ask is an OVERLAY rather than a replacement: the
 * lesson underneath is still there, so the child who was already using it taps their own face and
 * carries on with nothing lost.
 */
const RE_ASK_AFTER_MS = 5 * 60 * 1000

/**
 * Which child this document has already been handed to.
 *
 * `switchProfile` reloads (deliberately — it is the only way to guarantee no module cache still
 * holds the previous child's numbers), which would land right back on this screen. The mark is in
 * sessionStorage, so it survives that reload and dies with the tab: the next real app start asks
 * again, which is what "app start shows an avatar picker" means.
 */
function alreadyChosen(): boolean {
  try {
    const chosen = sessionStorage.getItem(CHOSEN_KEY)
    return chosen !== null && chosen === activeProfileId()
  } catch {
    // Storage unavailable (private mode): asking once per mount is the safe direction — the wrong
    // answer here is writing to a sibling's profile, not one extra tap.
    return false
  }
}

function remember(id: string): void {
  try { sessionStorage.setItem(CHOSEN_KEY, id) } catch { /* ignore: storage unavailable */ }
}

export function ProfileGate({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState(listProfiles)
  const [chosen, setChosen] = useState(() => profiles.length < 2 || alreadyChosen())
  /** A resume after a long enough absence. Distinct from `chosen`, because the app stays mounted. */
  const [reasking, setReasking] = useState(false)

  useEffect(() => {
    // Subscribed even for a one-profile device: the parent can add a sibling from the dashboard and
    // hand the iPad over in the same minute, and the roster is re-read below rather than captured.
    let hiddenAt = 0
    function resume() {
      const away = hiddenAt === 0 ? 0 : Date.now() - hiddenAt
      hiddenAt = 0
      if (away < RE_ASK_AFTER_MS) return
      const roster = listProfiles()
      if (roster.length < 2) return
      setProfiles(roster)
      setReasking(true)
    }
    function onVisibility() {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return }
      resume()
    }
    // `pageshow` with `persisted` is the other way back in — a document restored from the
    // back/forward cache, which iOS uses freely. The same threshold applies to it.
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) resume()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  function handleSelect(id: string) {
    remember(id)
    // The child already using this iPad taps their own face: nothing to switch, nothing to reload,
    // and on a resume nothing of their lesson is lost either.
    if (id === activeProfileId()) { setChosen(true); setReasking(false); return }
    // Anyone else: the reload is the point (see `switchProfile`). The mark above survives it, so
    // this screen does not come back afterwards.
    switchProfile(id)
  }

  const picker = (
    <Card className="flex w-full max-w-md flex-col gap-4 p-6 text-center">
      <h1 className="font-display text-2xl font-extrabold text-ink-900">Ai đang học nào? 👋</h1>
      <p className="text-sm font-semibold text-ink-500">Chạm vào tên của con nhé.</p>
      <ProfilePicker profiles={profiles} activeId={activeProfileId()} onSelect={handleSelect} />
    </Card>
  )

  // Cold start: the app is not rendered behind the question at all. Nothing has read a star yet and
  // nothing may, until it is known whose stars they are.
  if (!chosen) {
    return (
      <main className={`flex h-full flex-col items-center justify-center gap-6 overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}>
        {picker}
      </main>
    )
  }

  return (
    <>
      {children}
      {/* A resume, over the top: the app underneath is already the previously chosen child's, so
        * there is nothing new to leak by leaving it mounted — and everything to lose by throwing
        * it away. The overlay takes every tap until somebody answers. */}
      {reasking && (
        <div
          data-testid="profile-reask"
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}
        >
          {picker}
        </div>
      )}
    </>
  )
}
