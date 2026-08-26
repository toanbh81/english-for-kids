import { Link } from 'react-router-dom'
import { SOUNDS } from '../content'
import { soundStars } from '../progress/store'
import { BackButton, PAGE_SHELL, StarRow } from '../components/ui'

/** Tập âm is organised by SOUND, not by word: one tile per phoneme, each holding its 3 words.
 * The stars are the sound's derived value — the WEAKEST of its words — so a tile only fills up
 * once the child has said all three of its words well, not once they have been lucky on one. */
export function SoundLevel() {
  return (
    <main className={`h-full overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        {/* Tập âm is a bậc of the Speak Lab stairs, so back goes to the stairs. */}
        <BackButton to="/levels" label="Các bậc" className="self-start" />

        <header className="text-center">
          <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">Tập âm 🦁</h1>
          <p className="mt-1 text-lg font-bold text-ink-500">Mỗi ô là một âm — luyện đến khi cả 3 từ đều xanh!</p>
        </header>

        <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
          {SOUNDS.map(s => (
            <Link
              key={s.ph}
              to={`/sound/${s.ph}`}
              aria-label={`Âm ${s.ipa}, ví dụ ${s.example}`}
              className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-xl3 bg-white p-5 shadow-card active:translate-y-[2px]"
            >
              <span className="font-display text-[56px] font-extrabold leading-none text-coral-text">/{s.ipa}/</span>
              <span className="font-display text-2xl font-extrabold text-ink-900">{s.example}</span>
              <StarRow value={soundStars(s.ph)} />
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
