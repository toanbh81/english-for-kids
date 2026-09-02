import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { DialogProvider } from './components/ui/DialogProvider'
import { bootstrapProfiles } from './cloud/profileState'
import { startSync } from './cloud/sync'
import { ProfileGate } from './screens/ProfileGate'
import './styles.css'

// Before the first render, and synchronously: this settles which child's storage namespace every
// screen is about to read (and, on the launch after an update, moves the pre-Phase-11 keys into
// it). The cloud half — the silent anonymous sign-in — is fired off inside and awaited by nobody.
bootstrapProfiles()

// After it, never before: the mirror needs the namespace to already be settled, and it must not be
// what decides which child is active. With no Supabase env vars this attaches nothing at all.
startSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outside the router on purpose: a screen that throws takes the router down with it, so the
      * fallback cannot live inside the tree it is catching. */}
    <AppErrorBoundary>
      {/* Spec flow 6, and it has to be here rather than on a route: the question "whose iPad is
        * this right now" is asked before any screen reads a star, and there is no URL a second
        * child would ever type. On a one-profile device it renders its children and nothing
        * else — no picker, no flash, no extra tap. */}
      <ProfileGate>
        <BrowserRouter>
          {/* Real `<Dialog>`s replace the browser's native confirm/prompt globals app-wide (Phase
            * 12 task 12) — inside the router because `useDialog` has no need to survive a route
            * change, and outside `App` so every screen can reach it via `useDialog()`. */}
          <DialogProvider>
            <App />
          </DialogProvider>
        </BrowserRouter>
      </ProfileGate>
    </AppErrorBoundary>
  </StrictMode>,
)
