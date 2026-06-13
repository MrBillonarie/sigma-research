'use client'
import { useState, useEffect, useCallback } from 'react'
import { C } from '@/app/lib/constants'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Champion {
  slot?: string; sym?: string; ticker?: string; asset?: string
  tf?: string; timeframe?: string
  strategy?: string
  grade?: string; score?: number
  cagr?: number; wr?: number; max_dd?: number; sharpe?: number; n_trades?: number
  direction?: string
}

interface Portfolio {
  equity?: number; capital?: number
  return_pct?: number; total_return?: number
  cagr_weighted?: number; cagr?: number
  max_dd_pct?: number; max_dd?: number
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
  portfolio?: Portfolio
  open_trades?: Trade[]
  history?: Trade[]
  updated?: string
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const MONO  = 'var(--font-dm-mono, monospace)'
const BEBAS = "'Bebas Neue', Impact, sans-serif"
const GRN   = '#1D9E75'
const RED   = '#f87171'
const GOLD  = '#d4af37'
const SURF  = '#0b0d14'
const BDR   = '#1a1d2e'
const DIM   = '#7a7f9a'
const MUTED = '#3a3f55'

// ─── Helpers ───────────────────────────────────────────────────────────────────
function pct(n: number | undefined, d = 1) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`
}
function usd(n: number | undefined) {
  if (n === undefined || n === null) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function gradeClr(g?: string) {
  if (!g)         return MUTED
  if (g === 'A+') return '#ffd700'
  if (g === 'A')  return GRN
  if (g === 'B')  return '#378ADD'
  return MUTED
}
function regimeInfo(r?: string) {
  if (!r) return { label: 'DESCONOCIDO', color: MUTED }
  const v = r.toLowerCase()
  if (v.includes('bull') || v.includes('risk-on')) return { label: '▲ RISK-ON', color: GRN }
  if (v.includes('bear') || v.includes('risk-off')) return { label: '▼ RISK-OFF', color: RED }
  return { label: '◆ NEUTRAL', color: DIM }
}
function dirColor(d?: string) {
  const v = (d ?? '').toLowerCase()
  if (v === 'long') return GRN
  if (v === 'short') return RED
  return MUTED
}
function dirLabel(d?: string) {
  const v = (d ?? '').toLowerCase()
  if (v === 'long') return '▲ LONG'
  if (v === 'short') return '▼ SHORT'
  return '—'
}

function Th({ children }: { children: string }) {
  return (
    <th style={{ padding: '7px 14px', textAlign: 'left', fontSize: 9, color: MUTED, fontFamily: MONO, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `1px solid ${BDR}`, fontWeight: 400 }}>
      {children}
    </th>
  )
}
function Td({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <td style={{ padding: '9px 14px', fontFamily: MONO, fontSize: 12, color: color ?? '#e8e9f0' }}>
      {children}
    </td>
  )
}

// ─── Engine Overview ───────────────────────────────────────────────────────────
function EngineOverview({ data }: { data: PublicData | null }) {
  if (!data) return null
  const p = data.portfolio ?? {}
  const regime = regimeInfo(data.regime)
  const equity  = p.equity ?? p.capital
  const retPct  = p.return_pct ?? p.total_return
  const cagr    = p.cagr_weighted ?? p.cagr
  const wr      = p.wr !== undefined ? (p.wr <= 1 ? p.wr * 100 : p.wr) : undefined
  const maxDD   = p.max_dd_pct ?? p.max_dd
  const nTrades = p.n_trades ?? p.trades_total

  const stats = [
    { label: 'EQUITY',   value: usd(equity),                                      color: GOLD },
    { label: 'RETORNO',  value: pct(retPct),                                       color: retPct !== undefined && retPct >= 0 ? GRN : RED },
    { label: 'CAGR',     value: pct(cagr, 0),                                     color: GOLD },
    { label: 'WIN RATE', value: wr !== undefined ? `${wr.toFixed(1)}%` : '—',      color: wr !== undefined && wr >= 60 ? GRN : GOLD },
    { label: 'MAX DD',   value: maxDD !== undefined ? `${maxDD.toFixed(1)}%` : '—', color: RED },
    { label: 'TRADES',   value: nTrades?.toLocaleString() ?? '—',                 color: DIM },
    { label: 'RÉGIMEN',  value: regime.label,                                      color: regime.color },
    { label: 'PROFIT F', value: p.pf?.toFixed(2) ?? '—',                          color: GOLD },
  ]

  return (
    <div style={{ background: SURF, border: `1px solid ${BDR}`, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ padding: '10px 18px', borderBottom: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: GRN, boxShadow: `0 0 7px ${GRN}` }} />
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: MUTED }}>// SIGMA ENGINE · ESTADO REAL</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BDR }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#04050a', padding: '14px 16px' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.15em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: BEBAS, fontSize: 22, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Champions Table ───────────────────────────────────────────────────────────
function ChampionsTable() {
  const [champs,  setChamps]  = useState<Champion[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    fetch('/api/vps/champions')
      .then(r => r.json())
      .then(data => {
        const list: Champion[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.champions) ? data.champions
          : Array.isArray(data?.models)    ? data.models
          : typeof data === 'object' && data !== null && !data.error
            ? Object.entries(data).map(([slot, v]) => ({ slot, ...(v as object) }))
            : []
        setChamps(list.length > 0 ? list : null)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ background: SURF, border: `1px solid ${BDR}`, padding: '22px 20px', marginBottom: 20 }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>Cargando champions del motor…</span>
    </div>
  )
  if (error || !champs) return (
    <div style={{ background: SURF, border: `1px solid ${BDR}`, padding: '22px 20px', marginBottom: 20 }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>Motor no disponible en este momento.</span>
    </div>
  )

  const aPlus  = champs.filter(c => c.grade === 'A+')
  const aGrade = champs.filter(c => c.grade === 'A')
  const rest   = champs.filter(c => c.grade !== 'A+' && c.grade !== 'A')
  const sorted = [...aPlus, ...aGrade, ...rest]

  return (
    <div style={{ background: SURF, border: `1px solid ${BDR}`, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ padding: '11px 18px', borderBottom: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD, boxShadow: `0 0 7px ${GOLD}` }} />
        <span style={{ fontFamily: BEBAS, fontSize: 17, color: GOLD, letterSpacing: 1 }}>CHAMPIONS EN PRODUCCIÓN</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginLeft: 'auto' }}>
          {aPlus.length} A+ · {aGrade.length} A · {rest.length} otros · {sorted.length} total
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#04050a' }}>
              {['Activo', 'TF', 'Estrategia', 'Dirección', 'Grade', 'CAGR', 'Win Rate', 'Max DD', 'Sharpe', 'Trades'].map(h => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const label = c.slot ?? c.sym ?? c.ticker ?? c.asset ?? `model_${i}`
              const wrPct = c.wr !== undefined ? (c.wr <= 1 ? c.wr * 100 : c.wr) : undefined
              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(26,29,46,0.5)', borderLeft: `3px solid ${gradeClr(c.grade)}` }}>
                  <Td color="#e8e9f0">{label}</Td>
                  <Td color={GOLD}>{c.tf ?? c.timeframe ?? '—'}</Td>
                  <Td color={DIM}>{c.strategy ?? '—'}</Td>
                  <Td color={dirColor(c.direction)}>{dirLabel(c.direction)}</Td>
                  <td style={{ padding: '9px 14px' }}>
                    {c.grade
                      ? <span style={{ fontFamily: MONO, fontSize: 11, color: gradeClr(c.grade), border: `1px solid ${gradeClr(c.grade)}40`, padding: '2px 8px', borderRadius: 3 }}>{c.grade}</span>
                      : <span style={{ color: MUTED, fontFamily: MONO, fontSize: 11 }}>—</span>}
                  </td>
                  <Td color={c.cagr !== undefined ? (c.cagr >= 0 ? GRN : RED) : MUTED}>{pct(c.cagr)}</Td>
                  <Td color={wrPct !== undefined ? (wrPct >= 60 ? GRN : GOLD) : MUTED}>
                    {wrPct !== undefined ? `${wrPct.toFixed(1)}%` : '—'}
                  </Td>
                  <Td color={RED}>{c.max_dd !== undefined ? `${c.max_dd.toFixed(1)}%` : '—'}</Td>
                  <Td color={c.sharpe !== undefined ? (c.sharpe >= 1.5 ? GRN : GOLD) : MUTED}>
                    {c.sharpe?.toFixed(2) ?? '—'}
                  </Td>
                  <Td color={DIM}>{c.n_trades?.toString() ?? '—'}</Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Open Positions ────────────────────────────────────────────────────────────
function OpenPositions({ trades }: { trades: Trade[] }) {
  if (!trades.length) return (
    <div style={{ background: SURF, border: `1px solid ${BDR}`, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>// POSICIONES ABIERTAS · ninguna activa en este momento</span>
    </div>
  )

  return (
    <div style={{ background: SURF, border: `1px solid ${BDR}`, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ padding: '11px 18px', borderBottom: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 7px #f59e0b' }} />
        <span style={{ fontFamily: BEBAS, fontSize: 17, color: '#f59e0b', letterSpacing: 1 }}>POSICIONES ABIERTAS</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginLeft: 'auto' }}>{trades.length} activas</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#04050a' }}>
              {['Activo', 'TF', 'Dirección', 'Entry', 'SL', 'TP', 'Estrategia', 'Abierta'].map(h => <Th key={h}>{h}</Th>)}
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => {
              const dir = (t.direction ?? t.side ?? '').toLowerCase()
              const openedAt = t.opened_at
                ? new Date(t.opened_at).toLocaleString('es-CL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '—'
              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(26,29,46,0.5)', borderLeft: `3px solid ${dir === 'long' ? GRN : RED}` }}>
                  <Td color="#e8e9f0">{t.sym ?? t.ticker ?? '?'}</Td>
                  <Td color={GOLD}>{t.tf ?? '—'}</Td>
                  <Td color={dir === 'long' ? GRN : RED}>{dir === 'long' ? '▲ LONG' : '▼ SHORT'}</Td>
                  <Td>{(t.entry_price ?? t.entry)?.toFixed(2) ?? '—'}</Td>
                  <Td color={RED}>{(t.stop_loss ?? t.sl)?.toFixed(2) ?? '—'}</Td>
                  <Td color={GRN}>{(t.take_profit ?? t.tp)?.toFixed(2) ?? '—'}</Td>
                  <Td color={DIM}>{t.strategy ?? '—'}</Td>
                  <Td color={MUTED}>{openedAt}</Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Trade History ─────────────────────────────────────────────────────────────
function TradeHistory({ history }: { history: Trade[] }) {
  const last = [...history].reverse().slice(0, 25)
  if (!last.length) return null

  return (
    <div style={{ background: SURF, border: `1px solid ${BDR}`, overflow: 'hidden' }}>
      <div style={{ padding: '11px 18px', borderBottom: `1px solid ${BDR}` }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: '0.15em' }}>
          // HISTORIAL RECIENTE · ÚLTIMOS {last.length} TRADES
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#04050a' }}>
              {['Activo', 'TF', 'Dirección', 'Estrategia', 'P&L %', 'Resultado', 'Cierre'].map(h => <Th key={h}>{h}</Th>)}
            </tr>
          </thead>
          <tbody>
            {last.map((t, i) => {
              const dir = (t.direction ?? t.side ?? '').toLowerCase()
              const pnl = t.pnl_pct ?? t.pnl
              const res = t.result?.toLowerCase() ?? (pnl !== undefined && pnl >= 0 ? 'win' : 'loss')
              const closedAt = t.closed_at
                ? new Date(t.closed_at).toLocaleString('es-CL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '—'
              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(26,29,46,0.3)' }}>
                  <Td color="#e8e9f0">{t.sym ?? t.ticker ?? '?'}</Td>
                  <Td color={GOLD}>{t.tf ?? '—'}</Td>
                  <Td color={dir === 'long' ? GRN : RED}>{dir === 'long' ? '▲ LONG' : '▼ SHORT'}</Td>
                  <Td color={DIM}>{t.strategy ?? '—'}</Td>
                  <Td color={pnl !== undefined ? (pnl >= 0 ? GRN : RED) : MUTED}>{pct(pnl)}</Td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{
                      fontFamily: MONO, fontSize: 10,
                      color: res === 'win' ? GRN : RED,
                      border: `1px solid ${res === 'win' ? GRN : RED}40`,
                      padding: '2px 7px', borderRadius: 2,
                    }}>
                      {res === 'win' ? '✓ WIN' : '✗ LOSS'}
                    </span>
                  </td>
                  <Td color={MUTED}>{closedAt}</Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function ModelosPage() {
  const [pubData,    setPubData]    = useState<PublicData | null>(null)
  const [pubLoading, setPubLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/vps/signals')
      if (res.ok) {
        const d = await res.json()
        setPubData(d)
        setLastUpdate(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }))
      }
    } catch { /* motor offline */ }
    finally { setPubLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: MONO }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.28em', color: MUTED, marginBottom: 10, textTransform: 'uppercase' }}>
            // SQUANT DESK · SIGMA ENGINE · MODELOS EN PRODUCCIÓN
          </div>
          <h1 style={{ fontFamily: BEBAS, fontSize: 'clamp(44px, 6vw, 72px)', lineHeight: 0.93, margin: '0 0 6px' }}>
            <span style={{ color: C.text }}>CHAMPIONS</span>{' '}
            <span style={{ background: `linear-gradient(135deg,${GOLD},#f5c842,#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PRODUCCIÓN</span>
          </h1>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, display: 'flex', alignItems: 'center', gap: 12 }}>
            {pubLoading
              ? 'Conectando al motor…'
              : lastUpdate
                ? `Actualizado ${lastUpdate} · Auto-refresh 60s`
                : 'Motor offline'
            }
          </div>
        </div>

        {/* ── Engine Overview ─────────────────────────────────────────────────── */}
        {!pubLoading && <EngineOverview data={pubData} />}

        {/* ── Champions ──────────────────────────────────────────────────────── */}
        <ChampionsTable />

        {/* ── Open Positions ─────────────────────────────────────────────────── */}
        {!pubLoading && (
          <OpenPositions trades={pubData?.open_trades ?? []} />
        )}

        {/* ── Trade History ───────────────────────────────────────────────────── */}
        {!pubLoading && pubData?.history && pubData.history.length > 0 && (
          <TradeHistory history={pubData.history} />
        )}

      </div>
    </div>
  )
}
