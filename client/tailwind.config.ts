import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

/** Tokens from the Claude Design handoff (docs/design/README.md). The single-word keys
 * (`cream`, `coral`, `teal`, `star`, `good`, `ok`, `fix`) are the Phase-1 aliases: they keep
 * working as `bg-coral` / `text-good` via `DEFAULT` while the numbered shades carry the scale. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: [
    // Tone classes built from a `WordTone` value at runtime (ScoredWords, chips, banners).
    'text-good', 'text-ok', 'text-fix',
    'bg-good-50', 'text-good-700', 'border-good-300',
    'bg-ok-50', 'text-ok-700', 'border-ok-300',
    'bg-fix-50', 'text-fix-700', 'border-fix-300',
  ],
  theme: {
    extend: {
      // (The `ipad` breakpoint is a PLUGIN VARIANT, not a screen — see `plugins` at the bottom of
      // this file for what it means and why it cannot live here.)
      colors: {
        cream: { DEFAULT: '#FFF7EA', 50: '#FFF7EA' },
        canvas: '#EFE5D6',
        ink: { 900: '#4A3B33', 500: '#8A7A6D', 300: '#B0A18E' },
        line: { 200: '#EFE2CC' },
        coral: { DEFAULT: '#FF7A59', 500: '#FF7A59', 600: '#E05A3A', 50: '#FFE9DF', text: '#F2603D' },
        teal: { DEFAULT: '#2EC4B6', 500: '#2EC4B6', 600: '#1FA396', 50: '#E2F6F1' },
        star: { DEFAULT: '#FFB020', empty: '#E2D5C0' },   // replaces `star: '#FFC533'`
        sun: { 400: '#FFC533', 50: '#FFF1C9', 700: '#9A6B00' },
        good: { DEFAULT: '#2E8B4A', 700: '#2E8B4A', 50: '#E3F6E8', 300: '#7ED99A' },
        ok: { DEFAULT: '#9A6B00', 700: '#9A6B00', 50: '#FFF3D6', 300: '#FFD97E' },
        fix: { DEFAULT: '#C2354B', 700: '#C2354B', 50: '#FFE3E6', 300: '#F8A3AE' },
        sky: { 400: '#7EC8F2' },
        peach: { 400: '#FF9A62', 50: '#FFF1E6' },
        track: '#F1E7D4',
        'bar-low': '#FF9A8A',
        today: '#FFE9A8',
        'teal-line': '#C4E8E1',
        sand: { DEFAULT: '#F3EADA', text: '#A79781', edge: '#E2D5C0' },
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        display: ['"Baloo 2"', 'Nunito', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: '20px', xl3: '28px', xl4: '34px',   // kept until Phase 15
        r10: '10px', r12: '12px', r14: '14px', r16: '16px', r18: '18px',
        r20: '20px', r22: '22px', r24: '24px', r28: '28px',
      },
      // Hard offset shadows, no blur: the "chunky" press-down look of the handoff.
      boxShadow: {
        card: '0 8px 0 #EFE2CC',
        'card-sm': '0 5px 0 #EFE2CC',
        'card-xs': '0 4px 0 #EFE2CC',
        'chunky-coral': '0 5px 0 #E05A3A',
        'chunky-teal': '0 5px 0 #1FA396',
        'chunky-sun': '0 4px 0 #EFDDA8',
        'chunky-line': '0 5px 0 #EFE2CC',
        'edge-outline': '0 5px 0 #C4E8E1',
        mic: '0 8px 0 #E05A3A, 0 0 0 10px #FFE3D7',
        toast: '0 8px 24px rgba(43,35,32,.25)',
        dialog: '0 16px 40px rgba(43,35,32,.3)',
      },
      keyframes: {
        'pulse-soft': { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.07)' } },
        'pulse-coral': {
          '0%, 100%': { boxShadow: '0 5px 0 #E05A3A, 0 0 0 0 rgba(255,122,89,.55)' },
          '60%': { boxShadow: '0 5px 0 #E05A3A, 0 0 0 14px rgba(255,122,89,0)' },
        },
        ring: { '0%': { transform: 'scale(1)', opacity: '.5' }, '100%': { transform: 'scale(2)', opacity: '0' } },
        halo: { '0%': { transform: 'scale(1)', opacity: '.55' }, '100%': { transform: 'scale(1.35)', opacity: '0' } },
        spin: { to: { transform: 'rotate(360deg)' } },
        shimmer: { '0%': { backgroundPosition: '-200px 0' }, '100%': { backgroundPosition: '200px 0' } },
        level: { '0%, 100%': { transform: 'scaleY(.4)' }, '50%': { transform: 'scaleY(1)' } },
        fall: {
          '0%': { transform: 'translateY(-60px) rotate(0deg)' },
          '100%': { transform: 'translateY(920px) rotate(560deg)' },
        },
        'star-drop': {
          '0%': { transform: 'scale(0) rotate(-40deg)', opacity: '0' },
          '60%': { transform: 'scale(1.15) rotate(8deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        // One pulse per beat, all the way up and back down inside the beat: the dots of Sentence
        // Stars' rhythm card land *on* the words rather than drifting across them.
        beat: { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.35)' } },
        bob: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-9px)' } },
        wiggle: { '0%, 100%': { transform: 'rotate(0deg)' }, '25%': { transform: 'rotate(-8deg)' }, '75%': { transform: 'rotate(8deg)' } },
        // A word card lifting its own corner: "there is something on the back, tap me." The nudge
        // takes ~0.9 s but the keyframe runs 4 s, with the rotation packed into the first 22 % and
        // the card sitting still after it — that is what spaces the repeats out, so one infinite
        // CSS animation gives a periodic hint with no JS timer keeping time.
        peek: {
          '0%, 22%, 100%': { transform: 'rotateY(0deg)' },
          '11%': { transform: 'rotateY(-18deg)' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
        'pulse-coral': 'pulse-coral 1.6s ease-out infinite',
        ring: 'ring 1.4s ease-out infinite',
        halo: 'halo 1.4s ease-out infinite',
        spin: 'spin 3s linear infinite',
        shimmer: 'shimmer 1.4s linear infinite',
        level: 'level .8s ease-in-out infinite',
        fall: 'fall 3.2s linear forwards',
        'star-drop': 'star-drop .6s ease-out both',
        // One shot, never repeating: the beat has to *travel* along the dots, and a repeating
        // animation would put them all back in phase after the first pass. StarPractice writes
        // each dot's own duration and delay; `--beat` (sample length ÷ word count) is the fallback.
        beat: 'beat var(--beat) ease-out 1',
        bob: 'bob 3s ease-in-out infinite',
        wiggle: 'wiggle 1.8s ease-in-out infinite',
        // 2.5 s of grace first: the hint is for a child who has stopped and is looking at the card,
        // not for one who is already tapping it.
        peek: 'peek 4s ease-in-out 2.5s infinite',
      },
    },
  },
  plugins: [
    // The iPad-landscape breakpoint: the curved map, the diagonal stairs, the five-across mission
    // row and the two-column practice screens.
    //
    // It asks about ORIENTATION and HEIGHT, not a width alone, because a width alone cannot answer
    // the question. 1194 — the width of the design's own frame — silently took the map away from
    // every iPad narrower than an 11" Pro (a 10.2" is 1080 pt across in landscape, a mini 1133, an
    // Air 1180). A plain 1024 would not do either: a 12.9" iPad is exactly 1024 pt wide in
    // PORTRAIT, the squeezed-map case this exists to prevent. And the height floor is real: below
    // ~692 pt — which is what a mini in landscape has left once Safari takes its bars — two rows of
    // islands and the control strip stop fitting, and the stacked grid is the honest answer.
    //
    // It is a variant rather than an entry in `theme.extend.screens` because a `raw` screen makes
    // Tailwind 3 stop emitting EVERY `max-*` variant in the project. That is not a warning: it
    // silently deleted all 276 `max-md:` rules — the phone-only overrides of Phase 10 — from the
    // build, and nothing failed. A variant registered here has no such side effect.
    plugin(({ addVariant }) => {
      addVariant('ipad', '@media (min-width: 1024px) and (orientation: landscape) and (min-height: 692px)')
    }),
  ],
} satisfies Config
