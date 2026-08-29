import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { bootstrapProfiles } from './cloud/profileState'
import './styles.css'

// Before the first render, and synchronously: this settles which child's storage namespace every
// screen is about to read (and, on the launch after an update, moves the pre-Phase-11 keys into
// it). The cloud half — the silent anonymous sign-in — is fired off inside and awaited by nobody.
bootstrapProfiles()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outside the router on purpose: a screen that throws takes the router down with it, so the
      * fallback cannot live inside the tree it is catching. */}
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
)
