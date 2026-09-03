import type { Band } from '../progress/band'

/**
 * The single band/level-name table (fix wave, P1). The five bậc names used to live in three
 * separate places — `DailyMission.tsx`'s own `BAND_NAME`, `LevelStairs.tsx`'s `STEPS[].name`, and
 * a third, hand-copied one in `DailyMission.test.tsx` — plus a fourth, already-DIVERGENT source:
 * `LevelSelect` titled its own header from `content/word-pop.json`'s `"title": "Word Pop"`, so bậc
 * 2 read "Đọc từ" everywhere else and "Word Pop" on its own screen. One table now, in band order
 * 1 → 5 (`progress/band.ts`'s own doc comment: "1 sounds → 2 word cards → 3 minimal pairs →
 * 4 sentence stars → 5 story voice").
 *
 * Lives here, not in `progress/band.ts`: `band.ts` already imports `content` (for `LEVELS` etc.),
 * so a level *name* table living there would close an import loop back into content — and the
 * names are content, not progress state, anyway.
 */
export type BandStep = { band: Band; key: string; emoji: string; name: string; to: string }

export const BAND_STEPS: readonly BandStep[] = [
  { band: 1, key: 'sound-zoo', emoji: '🦁', name: 'Tập âm', to: '/level/sound-zoo' },
  { band: 2, key: 'word-pop', emoji: '🎈', name: 'Đọc từ', to: '/level/word-pop' },
  { band: 3, key: 'minimal-pairs', emoji: '👯', name: 'Nghe & chọn', to: '/level/minimal-pairs' },
  { band: 4, key: 'sentence-stars', emoji: '⭐', name: 'Sentence Stars', to: '/level/sentence-stars' },
  { band: 5, key: 'story-voice', emoji: '🎭', name: 'Story Voice', to: '/level/story-voice' },
] as const

/** The band's own display name, read from the one table above. Takes a plain `number`, not `Band`
 * — `Lesson.band` (`progress/lessonStore.ts`) is stored as a bare `number`, and that stored value,
 * not a freshly-validated `Band`, is what every call site actually has in hand. Falls back to the
 * table's own last entry for a stray out-of-range value rather than throwing, matching how the
 * three replaced call sites' plain `Record<number, string>` lookups already behaved (Phase 5's
 * `initialBand`/`clamp` keep real values inside `BAND_STEPS`, so this only ever matters for
 * corrupt or hand-edited storage). */
export function bandName(band: number): string {
  return (BAND_STEPS[band - 1] ?? BAND_STEPS[BAND_STEPS.length - 1]).name
}
