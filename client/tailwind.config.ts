import type { Config } from 'tailwindcss'

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
      // The iPad-landscape breakpoint: the curved map, the diagonal stairs and the five-across
      // mission row.
      //
      // It asks about ORIENTATION, not a width alone, because the width alone cannot answer the
      // question. Phase 10 first set this to 1194 — the width of the design's own frame — and that
      // silently took the map away from every iPad narrower than an 11" Pro: a 10.2" is 1080 pt
      // across in landscape, a mini 1133, an Air 1180. They landed in the tablet band and lost the
      // layout they had had all along.
      //
      // A plain 1024 would not do either: a 12.9" iPad is exactly 1024 pt wide in PORTRAIT, which
      // is the squeezed-map case this breakpoint exists to prevent. Landscape-and-wide is the real
      // condition — every iPad is ≥ 1080 across in landscape, every phone is < 1024 in either
      // orientation, and every iPad in portrait is ≤ 1024.
      // The height floor is the second half of the same lesson. The map needs two rows of islands
      // AND the control strip inside one screen: below ~692 pt — an iPad mini in landscape once Safari
      // takes its tab and bookmark bars leaves 634 — the two rows and the control strip stop fitting and the
      // rows collide. Below the floor the stacked card grid is the honest answer: everything is
      // reachable, it just scrolls.
      screens: {
        ipad: { raw: '(min-width: 1024px) and (orientation: landscape) and (min-height: 692px)' },
      },
      colors: {
        cream: { DEFAULT: '#FFF7EA', 50: '#FFF7EA' },
        canvas: '#EFE5D6',
        ink: { 900: '#4A3B33', 500: '#8A7A6D', 300: '#B0A18E' },
        line: { 200: '#EFE2CC' },
        coral: { DEFAULT: '#FF7A59', 500: '#FF7A59', 600: '#E05A3A', 50: '#FFE9DF', text: '#F2603D' },
        teal: { DEFAULT: '#2EC4B6', 500: '#2EC4B6', 600: '#1FA396', 50: '#E2F6F1' },
        star: '#FFC533',
        sun: { 400: '#FFC533', 50: '#FFF1C9', 700: '#9A6B00' },
        good: { DEFAULT: '#2E8B4A', 700: '#2E8B4A', 50: '#E3F6E8', 300: '#7ED99A' },
        ok: { DEFAULT: '#9A6B00', 700: '#9A6B00', 50: '#FFF3D6', 300: '#FFD97E' },
        fix: { DEFAULT: '#C2354B', 700: '#C2354B', 50: '#FFE3E6', 300: '#F8A3AE' },
        sky: { 400: '#7EC8F2' },
        peach: { 400: '#FF9A62' },
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        display: ['"Baloo 2"', 'Nunito', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl2: '20px', xl3: '28px', xl4: '34px' },
      // Hard offset shadows, no blur: the "chunky" press-down look of the handoff.
      boxShadow: {
        card: '0 8px 0 #EFE2CC',
        'card-sm': '0 5px 0 #EFE2CC',
        'chunky-coral': '0 6px 0 #E05A3A',
        'chunky-teal': '0 6px 0 #1FA396',
        'chunky-sun': '0 5px 0 #EFDDA8',
        'chunky-line': '0 6px 0 #EFE2CC',
      },
      keyframes: {
        'pulse-soft': { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.07)' } },
        ring: { '0%': { transform: 'scale(1)', opacity: '.5' }, '100%': { transform: 'scale(2)', opacity: '0' } },
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
        ring: 'ring 1.4s ease-out infinite',
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
  plugins: [],
} satisfies Config
