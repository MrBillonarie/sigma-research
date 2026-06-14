import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Core palette ──────────────────────────────
        bg:         '#04050a',
        surface:    '#0b0d14',
        'surface-2':'#0e1019',
        border:     '#1a1d2e',
        'border-2': '#252840',

        // ── Gold (signature accent) ───────────────────
        gold:       '#d4af37',
        'gold-dim': '#a88c25',
        'gold-glow':'#f0cc5a',

        // ── Text scale ────────────────────────────────
        text:       '#e8e9f0',
        'text-dim': '#7a7f9a',
        muted:      '#3a3f55',

        // ── Semantic ─────────────────────────────────
        green:      '#1D9E75',
        'green-dim':'#155f47',
        red:        '#f87171',
        'red-dim':  '#7f1d1d',
        amber:      '#f59e0b',
        blue:       '#378ADD',
      },
      fontFamily: {
        display: ['var(--font-bebas)', 'Impact', 'sans-serif'],
        mono:    ['var(--font-dm-mono)', 'Courier New', 'monospace'],
        sans:    ['var(--font-dm-mono)', 'Courier New', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
        xs:    ['0.75rem',  { lineHeight: '1.1rem' }],
        sm:    ['0.875rem', { lineHeight: '1.4rem' }],
        base:  ['1rem',     { lineHeight: '1.6rem' }],
      },
      letterSpacing: {
        label:  '0.2em',
        widest: '0.32em',
      },
      backgroundImage: {
        'grid-pattern':  `linear-gradient(rgba(212,175,55,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.04) 1px, transparent 1px)`,
        'gold-gradient': 'linear-gradient(135deg, #d4af37 0%, #f0cc5a 50%, #a88c25 100%)',
        'radial-gold':   'radial-gradient(ellipse at center, rgba(212,175,55,0.10) 0%, transparent 68%)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
      boxShadow: {
        gold:    '0 0 20px rgba(212,175,55,0.12), 0 0 40px rgba(212,175,55,0.04)',
        'gold-lg':'0 0 40px rgba(212,175,55,0.25), 0 0 80px rgba(212,175,55,0.08)',
        card:    '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(212,175,55,0.06)',
        inset:   'inset 0 1px 0 rgba(255,255,255,0.04)',
      },
      animation: {
        ticker:       'ticker 35s linear infinite',
        blink:        'blink 1s step-end infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        float:        'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'scan-line':  'scan-line 4s linear infinite',
        'fade-up':    'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'flash-green':'flash-green 0.5s ease',
        'flash-red':  'flash-red 0.5s ease',
      },
      keyframes: {
        ticker:       { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        blink:        { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
        float:        { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(212,175,55,0.15)' },
          '50%':      { boxShadow: '0 0 28px rgba(212,175,55,0.35)' },
        },
        'scan-line':  {
          '0%':   { transform: 'translateY(-100%)', opacity: '0' },
          '20%':  { opacity: '1' },
          '80%':  { opacity: '1' },
          '100%': { transform: 'translateY(500%)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
export default config
