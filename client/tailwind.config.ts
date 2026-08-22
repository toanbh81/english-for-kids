import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: ['text-good', 'text-ok', 'text-fix'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF8EE', coral: '#FF7A59', teal: '#2BB3A3', star: '#FFC43D',
        good: '#3CB371', ok: '#F5B700', fix: '#E8506A',
      },
      fontFamily: { sans: ['Nunito', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config
