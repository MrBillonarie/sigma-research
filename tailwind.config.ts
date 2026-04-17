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
        bg: '#04050a',
        gold: '#d4af37',
        'gold-dim': '#a88c25',
        'gold-glow': '#f0cc5a',
        surface: '#0b0d14',
        border: '#1a1d2e',
        muted: '#3a3f55',
        text: '#e8e9f0',
        'text-dim': '#7a7f9a',
      },
      fontFamily: {
        display: ['var(--font-bebas)', 'Impact', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'Courier New', 'monospace'],
        sans: ['var(--font-dm-mono)', 'Courier New', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(212,175,55,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.05) 1px, transparent 1px)`,
        'gold-gradient': 'linear-gradient(135deg, #d4af37 0%, #f0cc5a 50%, #a88c25 100%)',
        'radial-gold': 'radial-gradient(ellipse at center, rgba(212,175,55,0.12) 0%, transparent 70%)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      boxShadow: {
        'gold': '0 0 20px rgba(212,175,55,0.15), 0 0 40px rgba(212,175,55,0.05)',
        'gold-lg': '0 0 40px rgba(212,175,55,0.3), 0 0 80px rgba(212,175,55,0.1)',
        'card': '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(212,175,55,0.1)',
      },
      animation: {
        'ticker': 'ticker 35s linear infinite',
        'blink': 'blink 1s step-end infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'scan-line': 'scan-line 4s linear infinite',
      },
      keyframes: {
        'ticker': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(212,175,55,0.2), 0 0 20px rgba(212,175,55,0.05)' },
          '50%': { boxShadow: '0 0 25px rgba(212,175,55,0.4), 0 0 50px rgba(212,175,55,0.15)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '20%': { opacity: '1' },
          '80%': { opacity: '1' },
          '100%': { transform: 'translateY(500%)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
export default config
