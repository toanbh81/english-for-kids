export type ProsodyTone = 'good' | 'ok' | 'fix' | 'none'

/** Written out per tone, never concatenated, so Tailwind keeps every class in the build. */
const TONE: Record<ProsodyTone, string> = {
  good: 'bg-good-50 text-good-700 border-good-300',
  ok: 'bg-ok-50 text-ok-700 border-ok-300',
  fix: 'bg-fix-50 text-fix-700 border-fix-300',
  none: 'bg-cream-50 text-ink-500 border-line-200',
}

/**
 * The headline of a Story Voice result: how the intonation itself scored. Web Speech cannot
 * judge prosody at all, so rather than dressing accuracy up as "feeling" the chip says plainly
 * that it could not be marked — the child still gets stars, just never 3 for something unmeasured.
 */
export function ProsodyChip({ score, engine }: { score: number | null; engine: 'azure' | 'webspeech' | null }) {
  const unscored = score === null || engine === 'webspeech'
  const tone: ProsodyTone = unscored ? 'none' : score >= 80 ? 'good' : score >= 60 ? 'ok' : 'fix'
  return (
    <div
      data-testid="prosody-chip"
      data-tone={tone}
      className={`flex min-h-[64px] items-center justify-center rounded-xl2 border-[3px] px-7 font-display text-[30px] font-extrabold leading-none ${TONE[tone]}`}
    >
      {unscored ? 'Chưa chấm được ngữ điệu' : `Ngữ điệu ${Math.round(score)}`}
    </div>
  )
}
