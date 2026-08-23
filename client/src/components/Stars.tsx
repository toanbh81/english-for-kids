/** Result stars. `animate` drops them in one after another (.22 s apart) so the child watches
 * them land instead of finding them already there. */
export function Stars({ value, animate }: { value: 0 | 1 | 2 | 3; animate?: boolean }) {
  return (
    <div className="flex gap-3 text-[58px] leading-none">
      {[1, 2, 3].map(i => (
        <span
          key={i}
          data-testid={i <= value ? 'star-filled' : 'star-empty'}
          className={`${i <= value ? 'text-sun-400' : 'text-[#E2D5C0]'} ${animate && i <= value ? 'animate-star-drop' : ''}`}
          style={animate && i <= value ? { animationDelay: `${(i - 1) * 0.22}s` } : undefined}
        >
          ★
        </span>
      ))}
    </div>
  )
}
