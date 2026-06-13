'use client'
import { useState, useEffect, useCallback } from 'react'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const GRN    = '#1D9E75'
const RED    = '#f87171'
const GOLD   = '#d4af37'
const BG     = '#04050a'
const SURF   = '#0b0d14'
const BORDER = '#1a1d2e'
const DIM    = '#7a7f9a'
const MUTED  = '#3a3f55'
const MONO   = 'var(--font-dm-mono, monospace)'
const BEBAS  = "'Bebas Neue', Impact, sans-serif"

// ─── Types (loose — handles partial VPS responses) ─────────────────────────────
interface Signal {
  sym?: string; ticker?: string; asset?: string
  tf?: string; timeframe?: string
  strategy?: string
  direction?: string; signal_type?: string; recommendation?: string
  score?: number; grade?: string
  cagr?: number; wr?: number
}

interface Portfolio {
  equity?: number; capital?: number
  return_pct?: number; total_return?: number
  cagr?: number; port_cagr?: number
  max_dd?: number; drawdown?: number
  wr?: number; win_rate?: number
  n_trades?: number; trades_total?: number
  pf?: number
}

interface Trade {
  sym?: string; ticker?: string
  tf?: string
  direction?: string; side?: string
  entry?: number; entry_price?: number
  sl?: number; stop_loss?: number
  tp?: number; take_profit?: number
  strategy?: string
  pnl_pct?: number; pnl?: number
  result?: string
  opened_at?: string; closed_at?: string
}

interface PublicData {
  regime?: string
  signals?: Signal[]
  top_models?: Signal[]
  portfolio?: Portfolio
  open_trades?: Trade[]
  history?: Trade[]
  updated?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function pct(n: number | undefined, decimals = 1) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`
}

function usd(n: number | undefined) {
  if (!n) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function num(n: number | undefined, d = 2) {
  if (n === undefined || n === null) return '—'
  return n.toFixed(d)
}

function regimeColor(r?: string) {
  if (!r) return DIM
  if (r.includes('risk-on') || r.includes('bull'))  return GRN
  if (r.includes('risk-off') || r.includes('bear')) return RED
  return DIM
}

function regimeBadge(r?: string) {
  if (!r) return '◆ DESCONOCIDO'
  if (r.includes('risk-on') || r.includes('bull'))  return '▲ RISK-ON'
  if (r.includes('risk-off') || r.includes('bear')) return '▼ RISK-OFF'
  return '◆ NEUTRAL'
}

function gradeColor(g?: string) {
  if (!g) return DIM
  if (g === 'A+') return '#ffd700'
  if (g === 'A')  return GRN
  if (g === 'B')  return '#378ADD'
  return DIM
}

function dirColor(d?: string) {
  if (!d) return DIM
  const v = d.toLowerCase()
  if (v === 'long' || v === 'buy' || v === 'comprar') return GRN
  if (v === 'short' || v === 'sell' || v === 'reducir' || v === 'vender') return RED
  return DIM
}

function dirLabel(d?: string) {
  if (!d) return '◆ HOLD'
  const v = d.toLowerCase()
  if (v === 'long' || v === 'buy' || v === 'comprar') return '▲ LONG'
  if (v === 'short' || v === 'sell' || v === 'reducir' || v === 'vender') return '▼ SHORT'
  return '◆ HOLD'
}

function sym(s: Signal | Trade) {
  return (s as Signal).sym ?? (s as Signal).ticker ?? (s as Signal).asset ?? '?'
}

function tf(s: Signal) {
  return s.tf ?? s.timeframe ?? '?'
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 10, fontSize: 10, color: DIM, fontFamily: MONO,
      letterSpacing: 1.5, textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ height: 1, width: 20, background: BORDER }} />
      {children}
      <div style={{ height: 1, flex: 1, background: BORDER }} />
    </div>
  )
}

function Th({ children }: { children: string }) {
  return (
    <th style={{
      padding: '8px 14px', textAlign: 'left', fontSize: 9,
      color: MUTED, fontFamily: MONO, letterSpacing: '0.15em',
      textTransform: 'uppercase', borderBottom: `1px solid ${BORDER}`,
      fontWeight: 400,
    }}>
      {children}
    </th>
  )
}

function Td({ children, color, mono = true }: { children: React.ReactNode; color?: string; mono?: boolean }) {
  return (
    <td style={{ padding: '10px 14px', fontFamily: mono ? MONO : undefined, fontSize: 12, color: color ?? '#e8e9f0' }}>
      {children}
    </td>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function SigmaLivePage() {
  const [data,      setData]      = useState<PublicData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/vps/signals')
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      setData(await res.json())
      setFetchedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh each 2 min
  useEffect(() => {
    const t = setInterval(load, 2 * 60 * 1000)
    return () => clearInterval(t)
  }, [load])

  const port       = data?.portfolio
  const regime     = data?.regime
  const signals    = data?.signals    ?? []
  const topModels  = data?.top_models ?? []
  const openTrades = data?.open_trades ?? []
  const history    = data?.history    ?? []

  const equity    = port?.equity    ?? port?.capital
  const retPct    = port?.return_pct ?? port?.total_return
  const cagr      = port?.cagr      ?? port?.port_cagr
  const maxDD     = port?.max_dd    ?? port?.drawdown
  const wr        = port?.wr        ?? port?.win_rate
  const nTrades   = port?.n_trades  ?? port?.trades_total
  // WR may be 0–1 or 0–100
  const wrPct     = wr !== undefined ? (wr <= 1 ? wr * 100 : wr) : undefined

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '88px 24px 64px', maxWidth: 1280, margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: GRN, boxShadow: `0 0 8px ${GRN}` }} className="sigma-blink" />
          <span style={{ fontSize: 10, color: GRN, fontFamily: MONO, letterSpacing: 1 }}>
            LIVE — SIGMA ENGINE · BTC / ETH / SOL / BNB / XAU
          </span>
          {regime && (
            <span style={{
              fontSize: 10, fontFamily: MONO, letterSpacing: 1,
              padding: '2px 10px', borderRadius: 4,
              background: `${regimeColor(regime)}18`,
              color: regimeColor(regime),
              border: `1px solid ${regimeColor(regime)}40`,
            }}>
              {regimeBadge(regime)}
            </span>
          )}
          {fetchedAt && (
            <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>
              {fetchedAt.toLocaleTimeString('es-CL')}
            </span>
          )}
        </div>

        <h1 style={{ margin: '0 0 4px', fontSize: 32, fontFamily: BEBAS, letterSpacing: 2, color: '#e8e9f0' }}>
          SIGMA ENGINE · SEÑALES EN VIVO
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: DIM, fontFamily: MONO }}>
          Paper trading · Champions cuantitativos · Futuros Binance BTC/ETH/SOL/BNB/XAU
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={load} disabled={loading} style={{
            background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 7,
            padding: '8px 14px', color: DIM, fontSize: 11, fontFamily: MONO,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '⏳ Cargando...' : '↻ Actualizar'}
          </button>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: 'rgba(248,113,113,0.1)', border: `1px solid ${RED}`,
          borderRadius: 8, padding: '12px 16px', marginBottom: 24,
          color: RED, fontSize: 12, fontFamily: MONO,
        }}>
          ⚠ Motor no disponible: {error}. Verifica que el VPS esté corriendo.
        </div>
      )}

      {/* ── Portfolio KPIs ─────────────────────────────────────────────── */}
      <SectionLabel>PORTAFOLIO PAPER TRADING</SectionLabel>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
        gap: 1, background: BORDER, marginBottom: 24,
        borderRadius: 10, overflow: 'hidden',
      }}>
        {[
          { label: 'EQUITY',   value: equity !== undefined ? usd(equity) : (loading ? '...' : '—'),   color: equity && equity > 10000 ? GRN : '#e8e9f0' },
          { label: 'RETORNO',  value: retPct !== undefined ? pct(retPct)  : (loading ? '...' : '—'),  color: retPct !== undefined ? (retPct >= 0 ? GRN : RED) : DIM },
          { label: 'CAGR',     value: cagr   !== undefined ? pct(cagr)   : (loading ? '...' : '—'),   color: cagr   !== undefined ? (cagr   >= 0 ? GRN : RED) : DIM },
          { label: 'MAX DD',   value: maxDD  !== undefined ? `${maxDD.toFixed(1)}%` : (loading ? '...' : '—'), color: RED },
          { label: 'WIN RATE', value: wrPct  !== undefined ? `${wrPct.toFixed(1)}%` : (loading ? '...' : '—'), color: wrPct !== undefined && wrPct > 55 ? GRN : GOLD },
          { label: 'TRADES',   value: nTrades !== undefined ? String(nTrades) : (loading ? '...' : '—'), color: '#e8e9f0' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: SURF, padding: '18px 20px' }}>
            <div style={{ fontSize: 9, color: MUTED, fontFamily: MONO, letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 26, fontFamily: BEBAS, letterSpacing: 1, color, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Active Signals ─────────────────────────────────────────────── */}
      <SectionLabel>SEÑALES ACTIVAS {signals.length > 0 ? `(${signals.length})` : ''}</SectionLabel>
      {!loading && signals.length === 0 ? (
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24, marginBottom: 24, textAlign: 'center', color: MUTED, fontFamily: MONO, fontSize: 12 }}>
          Sin señales activas en este momento — todos los modelos en espera de setup técnico.
        </div>
      ) : signals.length > 0 && (
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 24, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: BG }}>
              {['ACTIVO', 'TF', 'ESTRATEGIA', 'DIRECCIÓN', 'GRADE', 'SCORE'].map(h => <Th key={h}>{h}</Th>)}
            </tr></thead>
            <tbody>
              {signals.map((s, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${BORDER}20` }}>
                  <Td color="#e8e9f0">{sym(s)}</Td>
                  <Td color={GOLD}>{tf(s)}</Td>
                  <Td color={DIM}>{s.strategy ?? '—'}</Td>
                  <Td color={dirColor(s.direction ?? s.signal_type)}>{dirLabel(s.direction ?? s.signal_type)}</Td>
                  <Td>
                    {s.grade
                      ? <span style={{ color: gradeColor(s.grade), border: `1px solid ${gradeColor(s.grade)}40`, padding: '2px 8px', borderRadius: 3, fontSize: 11 }}>{s.grade}</span>
                      : '—'}
                  </Td>
                  <Td color={GRN}>{s.score !== undefined ? s.score.toFixed(0) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Top Models ─────────────────────────────────────────────────── */}
      {(topModels.length > 0 || loading) && (
        <>
          <SectionLabel>CHAMPIONS ACTIVOS {topModels.length > 0 ? `(${topModels.length})` : ''}</SectionLabel>
          {loading && topModels.length === 0 ? (
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24, marginBottom: 24, color: MUTED, fontFamily: MONO, fontSize: 12 }}>Cargando...</div>
          ) : topModels.length > 0 && (
            <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 24, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: BG }}>
                  {['ACTIVO', 'TF', 'ESTRATEGIA', 'GRADE', 'SCORE', 'CAGR', 'WR'].map(h => <Th key={h}>{h}</Th>)}
                </tr></thead>
                <tbody>
                  {topModels.slice(0, 15).map((m, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${BORDER}20` }}>
                      <Td color="#e8e9f0">{sym(m)}</Td>
                      <Td color={GOLD}>{tf(m)}</Td>
                      <Td color={DIM}>{m.strategy ?? '—'}</Td>
                      <Td>
                        {m.grade
                          ? <span style={{ color: gradeColor(m.grade), border: `1px solid ${gradeColor(m.grade)}40`, padding: '2px 8px', borderRadius: 3, fontSize: 11 }}>{m.grade}</span>
                          : '—'}
                      </Td>
                      <Td color={GRN}>{m.score !== undefined ? m.score.toFixed(0) : '—'}</Td>
                      <Td color={m.cagr !== undefined ? (m.cagr >= 0 ? GRN : RED) : DIM}>{m.cagr !== undefined ? pct(m.cagr) : '—'}</Td>
                      <Td color={m.wr !== undefined ? ((m.wr <= 1 ? m.wr * 100 : m.wr) > 55 ? GRN : GOLD) : DIM}>
                        {m.wr !== undefined ? `${(m.wr <= 1 ? m.wr * 100 : m.wr).toFixed(1)}%` : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Open Trades ────────────────────────────────────────────────── */}
      <SectionLabel>TRADES ABIERTOS ({openTrades.length})</SectionLabel>
      {openTrades.length === 0 ? (
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 24, marginBottom: 24, textAlign: 'center', color: MUTED, fontFamily: MONO, fontSize: 12 }}>
          {loading ? 'Cargando...' : 'Sin trades abiertos en este momento.'}
        </div>
      ) : (
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 24, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: BG }}>
              {['ACTIVO', 'TF', 'DIRECCIÓN', 'ENTRY', 'SL', 'TP', 'ESTRATEGIA'].map(h => <Th key={h}>{h}</Th>)}
            </tr></thead>
            <tbody>
              {openTrades.map((t, i) => {
                const entry = t.entry ?? t.entry_price
                const sl    = t.sl    ?? t.stop_loss
                const tp    = t.tp    ?? t.take_profit
                const dir   = t.direction ?? t.side
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${BORDER}20`, borderLeft: `3px solid ${dirColor(dir)}` }}>
                    <Td color="#e8e9f0">{t.sym ?? t.ticker ?? '?'}</Td>
                    <Td color={GOLD}>{t.tf ?? '?'}</Td>
                    <Td color={dirColor(dir)}>{dirLabel(dir)}</Td>
                    <Td>{entry ? entry.toLocaleString() : '—'}</Td>
                    <Td color={RED}>{sl ? sl.toLocaleString() : '—'}</Td>
                    <Td color={GRN}>{tp ? tp.toLocaleString() : '—'}</Td>
                    <Td color={DIM}>{t.strategy ?? '—'}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Trade History ──────────────────────────────────────────────── */}
      {history.length > 0 && (
        <>
          <SectionLabel>HISTORIAL RECIENTE ({Math.min(history.length, 20)})</SectionLabel>
          <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 24, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: BG }}>
                {['ACTIVO', 'TF', 'DIRECCIÓN', 'ESTRATEGIA', 'PNL %', 'RESULTADO'].map(h => <Th key={h}>{h}</Th>)}
              </tr></thead>
              <tbody>
                {history.slice(0, 20).map((t, i) => {
                  const pnl = t.pnl_pct ?? t.pnl
                  const won = pnl !== undefined ? pnl > 0 : (t.result === 'win' || t.result === 'TP' || t.result === 'WIN')
                  const dir = t.direction ?? t.side
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${BORDER}20` }}>
                      <Td color="#e8e9f0">{t.sym ?? t.ticker ?? '?'}</Td>
                      <Td color={GOLD}>{t.tf ?? '?'}</Td>
                      <Td color={dirColor(dir)}>{dirLabel(dir)}</Td>
                      <Td color={DIM}>{t.strategy ?? '—'}</Td>
                      <Td color={pnl !== undefined ? (pnl >= 0 ? GRN : RED) : DIM}>
                        {pnl !== undefined ? pct(pnl, 2) : '—'}
                      </Td>
                      <Td>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 3,
                          color: won ? GRN : RED,
                          background: won ? 'rgba(29,158,117,0.1)' : 'rgba(248,113,113,0.1)',
                          border: `1px solid ${won ? GRN : RED}40`,
                          fontFamily: MONO,
                        }}>
                          {t.result ?? (won ? '✓ WIN' : '✗ LOSS')}
                        </span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!loading && !error && !data && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: MUTED, fontFamily: MONO, fontSize: 12 }}>
          Sin datos disponibles del motor SIGMA.
        </div>
      )}

      {/* ── Footer note ────────────────────────────────────────────────── */}
      {data && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: MUTED, fontFamily: MONO, fontSize: 10, borderTop: `1px solid ${BORDER}` }}>
          Motor SIGMA ENGINE · {openTrades.length} trades abiertos · Auto-refresh cada 2 min
          {data.updated && ` · VPS: ${new Date(data.updated).toLocaleString('es-CL')}`}
        </div>
      )}
    </div>
  )
}
