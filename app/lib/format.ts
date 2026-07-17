export const fmt = (v: number): string =>
  v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`

export const fmtK = (v: number): string =>
  v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : `$${(v / 1_000).toFixed(1)}K`

// ── Set canónico (QUAL-2) ─────────────────────────────────────────────────────
// REGLA DE MONEDA: USD (dólares del motor) usa separador en-US ($1,234); CLP
// (pesos, mercado local) usa es-CL ($1.234). NO mezclar — cada moneda su locale.
export const fmtUSD = (v: number): string => '$' + Math.round(v).toLocaleString('en-US')
export const fmtCLP = (v: number): string => '$' + Math.round(v).toLocaleString('es-CL')

// Abreviado para labels de gráficos: $1.23M / $12K (sin decimales en K).
export const fmtAbbrev = (v: number): string =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1e3).toFixed(0)}K`

// Porcentaje con signo explícito.
export const fmtPct = (v: number, dp = 2): string => `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`

// Fecha corta local (es-CL): "5 jul 2026".
export const fmtDateCL = (iso: string | null): string | null =>
  iso ? new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : null
