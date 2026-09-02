import { Link } from 'react-router-dom'
import { SOUNDS } from '../content'
import { soundStars } from '../progress/store'
import { BackButton, StarRow } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

/** Tập âm is organised by SOUND, not by word: one tile per phoneme, each holding its 3 words.
 * The stars are the sound's derived value — the WEAKEST of its words — so a tile only fills up
 * once the child has said all three of its words well, not once they have been lucky on one. */
export function SoundLevel() {
  return (
    <PageShell>
      {/* Tập âm is a bậc of the Speak Lab stairs, so back goes to the stairs. */}
      <PageHeader back={<BackButton to="/levels" label="Các bậc" />}>
        <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900 md:text-[32px]">Tập âm 🦁</h1>
      </PageHeader>
      <PageBody>
        <p className="text-center text-[15px] font-bold text-ink-500 md:text-lg">Mỗi ô là một âm — luyện đến khi cả 3 từ đều xanh!</p>

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
      </PageBody>
    </PageShell>
  )
}
