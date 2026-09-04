import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { activeProfileId, listProfiles, switchProfile } from '../cloud/profileState'
import { Foxy } from '../components/Foxy'
import { ProfilePicker } from '../components/ProfilePicker'
import { GateBlobs, GateCard, Notice } from '../components/ui'
import { PageShell, PageBody } from '../components/ui/page'

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
 *
 * **Two shapes, one card (round 4 R5 / decisions 18, 19).** A cold open with ≥2 profiles is a
 * FULL SCREEN — the card centred over cream + `GateBlobs`, nothing of the app rendered behind it,
 * and no Back (decision 17: this gate has no way out by design). A resume after `RE_ASK_AFTER_MS`
 * is an OVERLAY instead — a scrim over the app, blurred rather than hidden, because the app
 * underneath is already the previously-chosen child's and there is nothing new to leak by leaving
 * it mounted. The overlay's z-index is part of a shared scale, recorded here because this is the
 * one place asking "what wins" actually matters: `profile-reask` **40** < `Toast.tsx:9` **50** <
 * `Dialog.tsx:83` **60** — a toast must still read over a re-ask, and a confirm dialog opened from
 * behind an already-answered re-ask must still win over both.
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
 * Which child this document has been handed to, and WHEN it was last actively in use.
 *
 * The timestamp lives on the mark rather than in the component's closure, and that is the whole
 * difference between "asks after a resume" and "asks after a resume, unless iOS threw the document
 * away first". A closure variable dies with the JS context: an iPad that terminates the app under
 * memory pressure and relaunches it hours later — the common way a PWA comes back — starts with an
 * empty closure and a sessionStorage that iOS restored, so the mark said "already answered" and
 * nothing asked. Persisted with the answer, the staleness survives exactly as long as the answer
 * does, and both `alreadyChosen()` (cold start) and `resume()` read the same clock.
 *
 * sessionStorage, not localStorage, is still right: the mark must not outlive the browsing session.
 */
type Mark = { id: string; at: number }

function readMark(): Mark | null {
  try {
    const raw = sessionStorage.getItem(CHOSEN_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { id, at } = parsed as Partial<Mark>
    if (typeof id !== 'string' || !id) return null
    // A mark with no usable stamp reads as infinitely old, which asks. That covers a value written
    // by the previous build (a bare id string, which does not parse as an object anyway) and any
    // hand-edited nonsense: the safe direction here is one extra tap.
    return { id, at: typeof at === 'number' && Number.isFinite(at) ? at : 0 }
  } catch {
    return null
  }
}

/**
 * R7 / decision 19: a `sessionStorage` that cannot write is something to SAY, not swallow.
 *
 * The behaviour stays the same either way — asking again on every open remains the safe direction
 * (a child writing into a sibling's profile costs far more than one extra tap) — but a parent who
 * sees the gate every single time deserves to know why, rather than quietly assuming the app is
 * broken. The boolean lets the caller surface that without touching what happens next.
 */
function writeMark(id: string, at: number): boolean {
  try { sessionStorage.setItem(CHOSEN_KEY, JSON.stringify({ id, at })); return true }
  catch { return false }
}

/**
 * Answered, for this child, recently enough that nobody can have swapped seats since.
 *
 * The `age >= 0` half is not defensive noise. A NEGATIVE age — a mark stamped while the device's
 * clock read later than it does now — passed the "less than five minutes" test for ever, so the
 * gate never asked again for the rest of the session: straight back to the pre-picker behaviour,
 * where the next child lands in their sibling's profile and writes to it. It is reachable by
 * something this codebase already plans for elsewhere (`clamp_client_ts` exists because children
 * move the iPad's date forward): stamp the mark while the clock is ahead, correct the date, and
 * every later comparison is against a timestamp from the future. An age that is not a real
 * duration is not evidence of anything, so it asks.
 */
function markIsFresh(mark: Mark | null): boolean {
  if (mark === null || mark.id !== activeProfileId()) return false
  const age = Date.now() - mark.at
  return age >= 0 && age < RE_ASK_AFTER_MS
}

function alreadyChosen(): boolean {
  // Storage unavailable (private mode) reads as "nobody has answered": asking once per mount is the
  // safe direction — the wrong answer here is writing to a sibling's profile, not one extra tap.
  return markIsFresh(readMark())
}

const remember = (id: string): boolean => writeMark(id, Date.now())

export function ProfileGate({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState(listProfiles)
  const [chosen, setChosen] = useState(() => profiles.length < 2 || alreadyChosen())
  /** A resume after a long enough absence. Distinct from `chosen`, because the app stays mounted. */
  const [reasking, setReasking] = useState(false)
  /** R7: `sessionStorage` threw on the last `remember()`. Shown once inside the card; never clears
   * itself, since the underlying storage does not get any less broken this session. */
  const [storageBroken, setStorageBroken] = useState(false)
  /** The id being switched to: its cell spins in place of the avatar and the whole grid dims (see
   * `ProfilePicker`'s `pendingId`) until the reload `switchProfile` triggers actually lands. */
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    // Subscribed even for a one-profile device: the parent can add a sibling from the dashboard and
    // hand the iPad over in the same minute, and the roster is re-read below rather than captured.
    function resume() {
      const roster = listProfiles()
      if (roster.length < 2) return
      // The mark carries its own age, so this asks the same question the cold start asks and gets
      // the same answer whether or not the document survived the trip.
      if (markIsFresh(readMark())) return
      setProfiles(roster)
      setReasking(true)
    }
    function goingAway() {
      // Stamp the answer as it stops being watched: the absence is measured from the moment the
      // iPad went into somebody's bag, not from whenever the child last tapped a card. Only an
      // existing answer is re-stamped — writing one here would wave a question through that nobody
      // has answered yet.
      const mark = readMark()
      if (mark) writeMark(mark.id, Date.now())
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') goingAway()
      else resume()
    }
    // `pageshow` with `persisted` is the other way back in — a document restored from the
    // back/forward cache, which iOS uses freely. It stands on its own now: the age it reads is on
    // the mark, so this fires the ask whether or not a `visibilitychange` came first.
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
    // Checked before either branch below: whether the choice can be switched to at all does not
    // depend on whether it could also be REMEMBERED — a parent should learn their storage is
    // broken, not get stuck on a gate that otherwise works.
    if (!remember(id)) setStorageBroken(true)
    // The child already using this iPad taps their own face: nothing to switch, nothing to reload,
    // and on a resume nothing of their lesson is lost either.
    if (id === activeProfileId()) { setChosen(true); setReasking(false); return }
    // Anyone else: the reload is the point (see `switchProfile`), and it is the destination — the
    // spinner below only needs to live until the page actually goes.
    setPendingId(id)
    switchProfile(id)
  }

  // The same card either shape uses (round 4 R5): a full-screen open and a resume overlay ask the
  // identical question, so there is exactly one place this markup can drift from the other.
  const card = (
    <GateCard>
      <div className="flex items-center gap-3">
        <Foxy mood="idle" size="sm" className="[&_svg]:h-[42px] [&_svg]:w-11" />
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-[18px] font-extrabold text-ink-900">Ai đang học nào? 👋</h1>
          <p className="text-[13px] font-bold text-ink-500">Chạm vào tên của con nhé.</p>
        </div>
      </div>
      {/* Fix round 1, Important #3: spec decision 19 / brief §2 call this "một dòng 12px" — `Notice`'s
        * `title` slot is 14px extrabold (`Notice.tsx:57`), so the copy goes through `sub` (12px,
        * `Notice.tsx:58`) instead, with an empty `title` (a childless block, so it takes no line of
        * its own) rather than inventing a second, unreviewed line of copy above it. */}
      {storageBroken && (
        <Notice kind="info" adult testId="storage-broken" title="" sub="Không nhớ được lựa chọn — sẽ hỏi lại lần sau" />
      )}
      <ProfilePicker profiles={profiles} activeId={activeProfileId()} pendingId={pendingId} onSelect={handleSelect} />
    </GateCard>
  )

  // Cold start (decision 18): a full screen, not an overlay — the app is not rendered behind the
  // question at all, so nothing may read a star until it is known whose stars they are. No
  // `PageHeader`, no Back (decision 17: this gate has no way out by design).
  if (!chosen) {
    return (
      <PageShell className="relative isolate">
        <GateBlobs />
        <PageBody center>{card}</PageBody>
      </PageShell>
    )
  }

  return (
    <>
      {/* A resume, over the top: the app underneath is already the previously chosen child's, so
        * there is nothing new to leak by leaving it mounted — and everything to lose by throwing it
        * away. Blurred rather than hidden (decision 19) — dimmed enough to read as "not now"
        * without hiding that the lesson is still there underneath. */}
      <div data-testid="app-behind" className={reasking ? 'h-full blur-[2px] opacity-60' : 'h-full'}>{children}</div>
      {reasking && (
        <div data-testid="profile-reask" className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(74,59,51,.45)] p-4">
          <div className="shadow-dialog">{card}</div>
        </div>
      )}
    </>
  )
}
