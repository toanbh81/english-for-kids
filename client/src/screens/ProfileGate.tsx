import { useState } from 'react'
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
 */
const CHOSEN_KEY = 'speakup.profileChosen'

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
  const [profiles] = useState(listProfiles)
  const [chosen, setChosen] = useState(() => profiles.length < 2 || alreadyChosen())

  if (chosen) return <>{children}</>

  function handleSelect(id: string) {
    remember(id)
    // The child already using this iPad taps their own face: nothing to switch, nothing to reload.
    if (id === activeProfileId()) { setChosen(true); return }
    // Anyone else: the reload is the point (see `switchProfile`). The mark above survives it, so
    // this screen does not come back afterwards.
    switchProfile(id)
  }

  return (
    <main className={`flex h-full flex-col items-center justify-center gap-6 overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}>
      <Card className="flex w-full max-w-md flex-col gap-4 p-6 text-center">
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Ai đang học nào? 👋</h1>
        <p className="text-sm font-semibold text-ink-500">Chạm vào tên của con nhé.</p>
        <ProfilePicker profiles={profiles} activeId={activeProfileId()} onSelect={handleSelect} />
      </Card>
    </main>
  )
}
