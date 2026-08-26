/**
 * The safe-area page shell: the vertical padding of a screen's `<main>`.
 *
 * `index.html` has always carried `viewport-fit=cover`, so on an iPhone the page runs *under* the
 * notch and the home indicator. The design frames its screens with 56 px of top padding and 44 px
 * of bottom padding, and those numbers already contain the phone's 47/34 px insets — they are the
 * inset plus roughly nine or ten pixels of breathing room, not a fixed frame. So that is how this
 * is built: `env(safe-area-inset-*)` plus the breathing room.
 *
 * The `max()` is what keeps it a no-op away from a notch. On an iPad, a desktop browser or a test
 * renderer every inset is 0, so the shell would otherwise *shrink* a screen's padding to 9 px; the
 * `max()` hands the screen's own padding back instead. `--page-pad-top` / `--page-pad-bottom`
 * default to 1.5rem, which is exactly the `p-6` almost every screen already uses. A screen that
 * wants a different resting value sets the variable next to the shell class, e.g.
 * `[--page-pad-top:1rem]` for the old `py-4`.
 *
 * Horizontal padding is **not** here: the design gives each frame family its own (16 px on Home
 * and Daily Mission, 20 px on the speak frames, 14 px on the story player, 18 px on the parent
 * dashboard), so it stays on the screen, as `px-*`.
 *
 * Usage: replace a `<main>`'s `p-6` with `px-6 ${PAGE_SHELL}`.
 */
export const PAGE_SHELL
  = 'pt-[max(var(--page-pad-top,1.5rem),calc(env(safe-area-inset-top)_+_9px))]'
  + ' pb-[max(var(--page-pad-bottom,1.5rem),calc(env(safe-area-inset-bottom)_+_10px))]'
