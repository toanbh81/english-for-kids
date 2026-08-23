export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

export function estimateTimings(words: string[], wpm = 110): { start: number; end: number }[] {
  const letters = words.map(w => Math.max(1, w.replace(/[^A-Za-z']/g, '').length))
  const meanLetters = letters.reduce((a, b) => a + b, 0) / Math.max(1, letters.length)
  const target = 60000 / wpm // desired mean word duration
  const GAP = 60
  let t = 0
  return letters.map(n => {
    const dur = Math.max(180, (n / meanLetters) * target)
    const s = t
    t = s + dur + GAP
    return { start: s, end: s + dur }
  })
}

export function activeWordIndex(t: { start: number; end: number }[], ms: number): number {
  if (!t.length || ms < t[0].start) return -1
  let i = 0
  while (i + 1 < t.length && t[i + 1].start <= ms) i++
  return i
}

export function totalDuration(t: { start: number; end: number }[]): number {
  return t.length ? t[t.length - 1].end : 0
}
