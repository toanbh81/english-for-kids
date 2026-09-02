import { Link } from 'react-router-dom'
import { PAIRS } from '../content'
import { getStars } from '../progress/store'
import { BackButton, CARD_LINK, Chip, StarRow } from '../components/ui'
import { PageShell, PageHeader, PageBody } from '../components/ui/page'

/** "Nghe & chọn" is the listening bậc: every tile is a *pair* of near-identical words, so the
 * card shows both of them side by side — the child should see the choice they are about to make
 * before they open it. Stars live on the pair's own key (`pair:<id>`), never on a single word. */
export function PairLevel() {
  return (
    <PageShell>
      {/* Minimal Pairs is a bậc of the Speak Lab stairs, so back goes to the stairs. */}
      <PageHeader back={<BackButton to="/levels" label="Các bậc" />}>
        <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink-900 md:text-[32px]">Nghe &amp; chọn 👯</h1>
      </PageHeader>
      <PageBody>
        <p className="text-center text-[15px] font-bold text-ink-500 md:text-lg">Nghe rồi chọn từ đúng — tai tinh, miệng chuẩn!</p>

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
      </PageBody>
    </PageShell>
  )
}
