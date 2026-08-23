/** Retell scoring is deliberately lenient — a kid retelling a whole sentence from memory
 * will never match a repeat-after-me score, so the bar for 3 stars sits much lower. */
export function retellStars(overall: number): 1 | 2 | 3 {
  if (overall >= 60) return 3
  if (overall >= 35) return 2
  return 1
}

export const RETELL_MESSAGE: Record<1 | 2 | 3, string> = {
  3: 'Tuyệt vời! 🦊',
  2: 'Hay lắm!',
  1: 'Bé kể tốt lắm, thử lại nhé!',
}
