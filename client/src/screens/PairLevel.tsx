import { Link } from 'react-router-dom'
import { PAIRS } from '../content'
import { getStars } from '../progress/store'
import { BackButton, CARD_LINK, Chip, PAGE_SHELL, StarRow } from '../components/ui'

/** "Nghe & chọn" is the listening bậc: every tile is a *pair* of near-identical words, so the
 * card shows both of them side by side — the child should see the choice they are about to make
 * before they open it. Stars live on the pair's own key (`pair:<id>`), never on a single word. */
export function PairLevel() {
  return (
    <main className={`h-full overflow-y-auto bg-cream-50 px-6 ${PAGE_SHELL}`}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        {/* Minimal Pairs is a bậc of the Speak Lab stairs, so back goes to the stairs. */}
        <BackButton to="/levels" label="Các bậc" className="self-start" />

        <header className="text-center">
          <h1 className="font-display text-[40px] font-extrabold leading-tight text-ink-900">Nghe &amp; chọn 👯</h1>
          <p className="mt-1 text-lg font-bold text-ink-500">Nghe rồi chọn từ đúng — tai tinh, miệng chuẩn!</p>
        </header>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PAIRS.map(p => (
            <Link
              key={p.id}
              to={`/pair/${p.id}`}
              aria-label={`Cặp ${p.a.word} và ${p.b.word}`}
              className={CARD_LINK}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="text-[34px] leading-none">{p.a.emoji}</span>
                <span className="font-display text-[26px] font-extrabold leading-none text-ink-900">{p.a.word}</span>
              </span>
              <span aria-hidden="true" className="font-display text-xl font-extrabold text-ink-300">/</span>
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="text-[34px] leading-none">{p.b.emoji}</span>
                <span className="font-display text-[26px] font-extrabold leading-none text-ink-900">{p.b.word}</span>
              </span>
              <Chip tone="teal" size="sm">{p.contrast}</Chip>
              <StarRow value={getStars(`pair:${p.id}`)} />
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
