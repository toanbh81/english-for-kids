import type { LessonCard } from '../../content/types'

/**
 * Round-2 B1: the old "third tile" was an always-visible 👄 box that spent the same screen space
 * on every card whether the child ever looked at it or not. Now it is a toggle — the button lives
 * in the teach column's action row next to "🔊 Nghe mẫu", and the tile itself only exists in the
 * DOM while `open`, right below that row (task-7 decisions).
 *
 * `card` is the full card record, not just a word string, so a later per-card mouth shape has
 * somewhere to come from — every card still shows the same static 👄 today, but the panel already
 * names *whose* mouth shape it is via the tile's `aria-label`.
 */
export function MouthPanel({ card, open, onToggle }: { card: LessonCard; open: boolean; onToggle: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-[56px] items-center justify-center gap-2 rounded-r18 bg-peach-50 px-5 font-display text-[18px] font-extrabold text-[#C08457] shadow-[0_5px_0_#F2DFC9] transition-transform active:translate-y-[2px] md:min-h-[64px] md:rounded-r20 md:px-7 md:text-[22px]"
      >
        👄 Khẩu hình
      </button>
      {open && (
        <div
          data-testid="mouth-panel"
          role="img"
          aria-label={`Khẩu hình miệng của "${card.text}"`}
          className="flex h-[140px] w-[140px] shrink-0 basis-full items-center justify-center rounded-r26 bg-white text-[76px] leading-none shadow-card md:h-[220px] md:w-[220px] md:text-[120px]"
        >
          <span aria-hidden="true">👄</span>
        </div>
      )}
    </>
  )
}
