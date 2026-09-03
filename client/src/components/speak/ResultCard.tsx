import { Button } from '../ui/Button'
import { Stars } from '../ui/Stars'
import { ScoreBars } from '../ScoreBars'
import { ScoredWords } from '../ScoredWords'
import { HintCard } from '../HintCard'
import { Foxy } from '../Foxy'
import type { FoxyMood } from '../Foxy'
import type { PronunciationResult } from '../../scoring/types'
import type { WordTone } from './WordChip'

type Primary = { label: string; onClick?: () => void; to?: string; state?: unknown }
export type ResultCardProps = {
  stars: 0 | 1 | 2 | 3
  praise: string
  score?: number
  sub?: string
  prosody?: { score: number | null; engine: 'azure' | 'webspeech' | null }
  words?: { word: string; tone: Exclude<WordTone, 'unknown'> }[]
  bars?: PronunciationResult
  hint?: { word: string; phoneme?: string; tip: string }
  /** Whether the child's own recording can be replayed — omitted (falsy) hides that button
   * the same way `false` does. */
  canReplay?: boolean
  onReplay?: () => void
  onSample?: () => void
  onRetry: () => void
  /** Omitted while PracticeCard's retry gate is closed (<3★ and <3 attempts): the CTA row then holds "↻ Thử lại" alone. */
  primary?: Primary
  animate?: boolean
  /** Extra rows a screen slots between the head and the words (SoundPractice's SoundChip). */
  extra?: React.ReactNode
  /** Foxy reacting to the result, rendered after the listen row. */
  fox?: { mood: FoxyMood; say: string }
  /** Drops the words, bars and listen rows — just head, hint and cta. */
  compact?: boolean
  /** Shows the hint row regardless of star count. */
  forceHint?: boolean
}

function ProsodyPill({ score, engine }: NonNullable<ResultCardProps['prosody']>) {
  const none = score === null || engine === 'webspeech'
  const tone = none ? 'none' : score >= 80 ? 'good' : score >= 60 ? 'ok' : 'fix'
  const cls = { good: 'bg-good-50 text-good-700', ok: 'bg-ok-50 text-ok-700', fix: 'bg-fix-50 text-fix-700', none: 'bg-sand text-sand-text' }[tone]
  return <span data-testid="prosody-chip" data-tone={tone} className={`flex h-8 shrink-0 items-center rounded-r10 px-2.5 text-[12px] font-extrabold ${cls}`}>{none ? '— ngữ điệu' : `🎭 Ngữ điệu ${score >= 80 ? 'tốt' : score >= 60 ? 'khá' : 'chưa tốt'}`}</span>
}

/** Brief §2.4 — the one result read-out. Rows ①–⑥ in a fixed order; ① and ⑥ are pinned on a
 * phone while ②–⑤ scroll (the `min-h-0 overflow-y-auto` middle). */
export function ResultCard(p: ResultCardProps) {
  const listen = !p.compact && ((p.canReplay && p.onReplay) || p.onSample)
  const showHint = Boolean(p.hint) && (p.forceHint || p.stars < 2)
  return (
    <div data-testid="result-card" className="flex w-full max-w-[440px] flex-col gap-3 rounded-r22 bg-cream-50 p-4">
      <div data-row="head" className="flex items-center gap-3 rounded-r18 bg-white px-3.5 py-3 shadow-card-sm">
        <Stars value={p.stars} size="md" animate={p.animate} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[18px] font-extrabold leading-tight text-ink-900">{p.praise}</div>
          {(p.score !== undefined || p.sub) && <div className="text-[12px] font-bold text-ink-500">{p.score !== undefined ? `Điểm: ${Math.round(p.score)}` : ''}{p.score !== undefined && p.sub ? ' · ' : ''}{p.sub ?? ''}</div>}
        </div>
        {p.prosody && <ProsodyPill {...p.prosody} />}
      </div>
      {p.extra && <div data-row="extra">{p.extra}</div>}
      {!p.compact && p.words && <div data-row="words" className="min-h-0 overflow-y-auto"><ScoredWords words={p.words} /></div>}
      {!p.compact && p.bars && <div data-row="bars"><ScoreBars result={p.bars} /></div>}
      {showHint && p.hint && <div data-row="hint"><HintCard hint={p.hint} /></div>}
      {listen && (
        <div data-row="listen" className="flex gap-2">
          {p.canReplay && p.onReplay && <button type="button" onClick={p.onReplay} className="relative flex h-12 flex-1 items-center justify-center gap-1.5 rounded-r14 border-[3px] border-teal-line bg-white font-display text-[15px] font-extrabold text-teal-600 after:absolute after:-inset-2 after:content-['']">🎧 Nghe mình</button>}
          {p.onSample && <button type="button" onClick={p.onSample} className="relative flex h-12 flex-1 items-center justify-center gap-1.5 rounded-r14 border-[3px] border-teal-line bg-white font-display text-[15px] font-extrabold text-teal-600 after:absolute after:-inset-2 after:content-['']">🔊 Nghe mẫu</button>}
        </div>
      )}
      {p.fox && (
        <div data-row="fox" className="flex items-center justify-center gap-2 ipad:mt-auto md:gap-2.5">
          <div className="h-[42px] w-[44px] md:h-[93px] md:w-[96px] ipad:h-[50px] ipad:w-[52px]"><Foxy mood={p.fox.mood} size="sm" /></div>
          <p className="text-[13px] font-bold text-ink-500 md:rounded-r16 md:rounded-bl-[6px] md:bg-white md:px-4 md:py-2.5 md:font-display md:text-[17px] md:font-extrabold md:text-ink-900 md:shadow-card-xs ipad:bg-transparent ipad:p-0 ipad:font-sans ipad:text-[14px] ipad:font-bold ipad:text-ink-500 ipad:shadow-none">{p.fox.say}</p>
        </div>
      )}
      <div data-row="cta" className="flex gap-2.5">
        <Button variant="outline" className="flex-1" onClick={p.onRetry}>↻ Thử lại</Button>
        {p.primary && (p.primary.to !== undefined
          ? <Button className="flex-[1.35]" to={p.primary.to} state={p.primary.state}>{p.primary.label}</Button>
          : <Button className="flex-[1.35]" onClick={p.primary.onClick}>{p.primary.label}</Button>)}
      </div>
    </div>
  )
}
