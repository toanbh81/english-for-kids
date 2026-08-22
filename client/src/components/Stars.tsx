export function Stars({ value, animate }: { value: 0 | 1 | 2 | 3; animate?: boolean }) {
  return <div className="flex gap-2 text-5xl">{[1, 2, 3].map(i =>
    <span key={i} data-testid={i <= value ? 'star-filled' : 'star-empty'}
      className={`${i <= value ? 'text-star' : 'text-slate-300'} ${animate && i <= value ? 'animate-bounce' : ''}`}>★</span>)}</div>
}
