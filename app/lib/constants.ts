// ─── SQuant Desk — Design Tokens ────────────────────────────────────────────
// Única fuente de verdad para componentes con inline styles.
// Alineado con globals.css variables y tailwind.config.ts

export const C = {
  // Core
  bg:       '#04050a',
  surface:  '#0b0d14',
  surface2: '#0e1019',
  border:   '#1a1d2e',
  border2:  '#252840',

  // Gold (firma visual)
  gold:     '#d4af37',
  goldDim:  '#a88c25',
  glow:     '#f0cc5a',

  // Texto
  text:     '#e8e9f0',
  textDim:  '#7a7f9a',   // era dimText — renombrado para consistencia
  dimText:  '#7a7f9a',   // alias legacy
  muted:    '#3a3f55',

  // Semánticos
  green:    '#1D9E75',   // era #34d399 — unificado con motor
  greenDim: '#155f47',
  red:      '#f87171',
  redDim:   '#7f1d1d',
  amber:    '#f59e0b',
  blue:     '#378ADD',   // era #60a5fa
  purple:   '#a78bfa',
  violet:   '#a78bfa',

  // Legacy aliases (mantener compatibilidad)
  yellow:   '#f59e0b',
} as const

// Fuentes como strings para inline styles
export const F = {
  display: "var(--font-bebas,'Bebas Neue',Impact,sans-serif)",
  mono:    "var(--font-dm-mono,'DM Mono','Courier New',monospace)",
} as const

// Color de grado champion
export function gradeColor(g?: string): string {
  if (g === 'A+') return '#ffd700'
  if (g === 'A')  return C.green
  if (g === 'B')  return C.blue
  return C.muted
}

// Color de régimen de mercado
export function regimeColor(r?: string): string {
  const v = (r ?? '').toLowerCase()
  if (v.includes('bull') || v.includes('risk-on'))  return C.green
  if (v.includes('bear') || v.includes('risk-off')) return C.red
  return C.textDim
}
