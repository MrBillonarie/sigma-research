import type { Position } from '@/app/types/hud'

// El motor tiene dos trackers paralelos (portfolio global + per-modelo) que
// pueden emitir la misma posicion abierta dos veces en /api/trades. Se
// prioriza siempre la entrada mode==='LIVE' (posicion real en Binance) sobre
// cualquier duplicado paper del mismo sym/tf/direccion/estrategia.
export function dedupePositions(open: Position[] | undefined | null): Position[] {
  const seen = new Map<string, Position>()

  for (const pos of open ?? []) {
    const key = `${pos.sym}::${pos.tf}::${pos.direction}::${pos.strategy}`
    const isLive = pos.mode === 'LIVE' && !!pos.live_contracts
    const prev = seen.get(key)

    if (!prev) {
      seen.set(key, pos)
      continue
    }
    const prevIsLive = prev.mode === 'LIVE' && !!prev.live_contracts
    if (isLive && !prevIsLive) seen.set(key, pos)
  }

  return Array.from(seen.values())
}

// Posicion nominal en USD: equity x (kelly% / sl_dist_pct_at_open). Para
// posiciones LIVE con contratos reales conocidos se usa contracts x entry
// como aproximacion (no tenemos un feed de precio en vivo independiente en
// esta primera version nativa del HUD — mismo espiritu que dashboard.py,
// que usa precio en vivo cuando lo tiene disponible).
export function computeNotional(pos: Position, equity: number): number {
  const isLiveReal = pos.mode === 'LIVE' && !!pos.live_contracts
  if (isLiveReal && pos.live_contracts) {
    return pos.live_contracts * pos.entry
  }
  const slDistPct = pos.sl_dist_pct_at_open ??
    (pos.entry > 0 ? Math.abs(pos.sl - pos.entry) / pos.entry * 100 : 0)
  const kelly = pos.kelly_pct ?? 3.3
  return slDistPct > 0 ? equity * (kelly / slDistPct) : 0
}
