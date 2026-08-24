import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { clearLessons } from '../progress/lessonStore'
import { Foxy } from './Foxy'
import { Button } from './ui'

/**
 * The last line of defence: anything a screen throws during render lands here instead of leaving
 * the child on a white page they cannot get out of. The only stored state a render is allowed to
 * be this dependent on is today's lesson (every screen reads it), so the way out throws that away
 * and hard-reloads Home — a fresh lesson is generated on the next read, and no other progress is
 * touched.
 *
 * A class component because that is the only thing React offers: hooks have no error-boundary
 * equivalent.
 */
type Props = { children: ReactNode }
type State = { failed: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Nothing is shipped anywhere — this is the one trace a parent can read off the console if the
    // screen ever does this again.
    console.error('Speak Up! đã gặp lỗi:', error, info.componentStack)
  }

  handleHome = (): void => {
    clearLessons()
    // A full navigation, not a router push: the component tree that just threw is discarded with
    // the document, so a re-render of the same broken state cannot follow the child home.
    location.assign('/')
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children

    return (
      <main className="flex h-full flex-col items-center justify-center gap-7 bg-cream-50 p-8 text-center">
        <Foxy mood="surprised" size="lg" />
        <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">Ôi, có lỗi rồi 🦊</h1>
        <p className="text-xl font-bold text-ink-500">Con bấm nút bên dưới để về nhà nhé!</p>
        {/* No `to`: the fallback renders outside the router (it wraps it), so the way home is a
            handler and a real <button>, never a <Link>. */}
        <Button size="lg" onClick={this.handleHome}>Về nhà</Button>
      </main>
    )
  }
}
