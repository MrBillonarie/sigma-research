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
        // ── Core palette — Cyan Deck (near-black frío + acento cian) ─
        bg:         '#080a0f',
        surface:    '#0e1119',
        'surface-2':'#12161f',
        border:     '#202634',
        'border-2': '#2c3444',

        // ── "Gold" token → cian (acento). El logo también pasa a cian
        //    en el sitio público (Navbar/Footer).
        gold:       '#39e2e6',
        'gold-dim': '#2f6bd6',
        'gold-glow':'#5eeaf0',

        // ── Text scale ────────────────────────────────
        text:       '#eef1f7',
        'text-dim': '#9aa4b6',
        muted:      '#5f6a7d',

        // ── Semantic (ajustado a fondo oscuro) ─────────
        green:      '#2fd39a',
        'green-dim':'#17a578',
        red:        '#ff5d6c',
        'red-dim':  '#b23842',
        amber:      '#ffb454',
        blue:       '#4f92ff',

        // ── Admin panel palette (Mission Control) ──────────────────────
        'admin-bg':      '#08060f',
        'admin-surface': '#0f0c1a',
        'admin-surface2':'#140f22',
        'admin-border':  '#1e1633',
        'admin-violet':  '#7c3aed',
        'admin-violet2': '#8b5cf6',
        'admin-violet3': '#6d28d9',
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
        'grid-pattern':  `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`,
        'gold-gradient': 'linear-gradient(135deg, #4f92ff 0%, #39e2e6 50%, #4f92ff 100%)',
        'radial-gold':   'radial-gradient(ellipse at center, rgba(57,226,230,0.10) 0%, transparent 68%)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
      boxShadow: {
        gold:    '0 1px 2px rgba(30,20,10,0.06), 0 8px 24px rgba(60,45,20,0.07)',
        'gold-lg':'0 8px 30px rgba(60,45,20,0.12), 0 2px 6px rgba(30,20,10,0.06)',
        card:    '0 1px 2px rgba(30,20,10,0.05), 0 10px 28px rgba(60,45,20,0.06)',
        inset:   'inset 0 1px 0 rgba(255,255,255,0.08)',
        // ── Admin Neon Grid glows ──────────────────────────────────────────
        'admin-glow':        '0 0 0 1px rgba(139,92,246,0.13), 0 0 24px rgba(124,58,237,0.08)',
        'admin-glow-lg':     '0 0 0 1px rgba(139,92,246,0.25), 0 0 40px rgba(124,58,237,0.15)',
        'admin-glow-active': '0 0 0 1px rgba(139,92,246,0.45), 0 0 20px rgba(124,58,237,0.22)',
        'admin-header':      '0 1px 0 rgba(139,92,246,0.28), 0 4px 24px rgba(124,58,237,0.08)',
        'admin-sidebar':     '1px 0 0 rgba(139,92,246,0.18), 4px 0 24px rgba(124,58,237,0.06)',
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
