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

  // Elevación — sistema de 3 niveles (base plana / card / hero)
  radiusSm:    8,
  radiusMd:    12,
  radiusLg:    18,
  shadowCard:  '0 4px 18px rgba(0,0,0,0.32)',
  shadowHero:  '0 14px 44px rgba(0,0,0,0.5)',
  glowGold:    '0 0 40px rgba(212,175,55,0.16)',
  glowGoldSm:  '0 0 18px rgba(212,175,55,0.22)',
} as const

// Fuentes como strings para inline styles
export const F = {
  display: "var(--font-bebas,'Bebas Neue',Impact,sans-serif)",
  mono:    "var(--font-dm-mono,'DM Mono','Courier New',monospace)",
} as const

// ─── Sistema de elevación compartido ─────────────────────────────────────────
// Cards con borde + radio + sombra + filo (grosor simulado), en vez de las
// grillas "gapless" con background:C.border haciendo de línea divisoria.
const EDGE = 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -2px 0 rgba(0,0,0,0.35)'
export const cardStyle = {
  border: `1px solid ${C.border}`,
  borderRadius: C.radiusMd,
  boxShadow: `${C.shadowCard}, ${EDGE}`,
}
export const heroCardStyle = {
  border: `1px solid ${C.gold}40`,
  borderRadius: C.radiusMd,
  boxShadow: `${C.shadowCard}, ${C.glowGoldSm}, ${EDGE}`,
  background: `linear-gradient(160deg,${C.gold}14,${C.surface} 60%)`,
}

// Sombra en capas para números grandes — efecto "grabado/en relieve" en vez
// de texto plano con color (funciona también sobre gradient-clip text).
export const numberEmboss = '0 2px 5px rgba(0,0,0,0.5), 0 -1px 0 rgba(255,255,255,0.1)'

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
