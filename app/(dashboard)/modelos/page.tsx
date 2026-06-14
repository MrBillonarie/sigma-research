'use client'
import { useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { C } from '@/app/lib/constants'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface MetricsOOS {
  cagr?: number; wr?: number; dd?: number; pf?: number; trades?: number
}
interface Champion {
  slot?: string; sym?: string; ticker?: string; asset?: string
  tf?: string; timeframe?: string
  strategy?: string
  grade?: string; score?: number
  cagr?: number; wr?: number; max_dd?: number; sharpe?: number; n_trades?: number
  direction?: string
  metrics_oos?: MetricsOOS
  wft?: { verdict?: string; oos_win_rate?: number; n_windows?: number }
  mc?: { confidence?: number; cagr_p05?: number; cagr_p50?: number; cagr_p95?: number; dd_p95?: number }
  bayesian?: { edge_confirmed?: boolean; n_trades?: number; live_wr?: number }
  red_flags?: string[]
  risk_pct?: number
  saved_at?: string
}
interface Portfolio {
  equity?: number; capital?: number
  return_pct?: number; total_return?: number
  wr?: number; n_trades?: number; trades_total?: number; pf?: number
  max_dd_pct?: number; max_dd?: number
}
interface Trade {
  sym?: string; ticker?: string; tf?: string
  direction?: string; side?: string
  entry?: number; entry_price?: number
  sl?: number; stop_loss?: number
  tp?: number; take_profit?: number
  strategy?: string
  pnl_pct?: number; pnl?: number
  result?: string; opened_at?: string; closed_at?: string
}
interface PublicData {
  regime?: string; portfolio?: Portfolio
  open_trades?: Trade[]; history?: Trade[]; updated?: string
}

// ─── Motor definitions ─────────────────────────────────────────────────────────
interface MotorDef {
  id: number; name: string; subtitle: string
  status: 'ACTIVO' | 'PRÓXIMAMENTE'
  syms: string[]; color: string; desc: string
}
const MOTORS: MotorDef[] = [
  {
    id: 1, name: 'MOTOR 1', subtitle: 'CRYPTO',
    status: 'ACTIVO' as const,
    syms: ['BTC', 'ETH', 'SOL', 'BNB', 'LTC'],
    color: '#d4af37',
    desc: '5 activos · Futures perpetuos Binance · Bayesian Search + walk-forward OOS',
  },
  {
    id: 2, name: 'MOTOR 2', subtitle: 'COMMODITIES',
    status: 'ACTIVO' as const,
    syms: ['XAU', 'XAG', 'WTI', 'HG', 'NG', 'PL'],
    color: '#1D9E75',
    desc: '6 activos · Oro, Plata, Petróleo, Cobre, Gas, Platino · yfinance GC=F',
  },
  {
    id: 3, name: 'MOTOR 3', subtitle: 'STOCKS US',
    status: 'PRÓXIMAMENTE' as const,
    syms: [],
    color: '#7a7f9a',
    desc: 'S&P 500 + Russell 1000 · Acciones individuales + ETFs sectoriales · ETA 12-18 meses',
  },
  {
    id: 4, name: 'MOTOR 4', subtitle: 'LATAM',
    status: 'PRÓXIMAMENTE' as const,
    syms: [],
    color: '#7a7f9a',
    desc: 'Acciones Chile, Brasil y México · Integración con brokers locales · ETA 12-18 meses',
  },
  {
    id: 5, name: 'MOTOR 5', subtitle: 'FOREX',
    status: 'PRÓXIMAMENTE' as const,
    syms: [],
    color: '#7a7f9a',
    desc: 'Pares mayores y menores · EUR/USD, GBP/JPY, USD/JPY · ETA 12-18 meses',
  },
]

const TF_ORDER = ['1d', '4h', '1h', '15m', '5m']

// ─── Design tokens ─────────────────────────────────────────────────────────────
const MONO  = 'var(--font-dm-mono, monospace)'
const BEBAS = "'Bebas Neue', Impact, sans-serif"
const GRN   = '#1D9E75'
const RED   = '#f87171'
const GOLD  = '#d4af37'
const SURF  = '#0b0d14'
const BG    = '#04050a'
const BDR   = '#1a1d2e'
const DIM   = '#7a7f9a'
const MUTED = '#3a3f55'

// ─── Helpers ───────────────────────────────────────────────────────────────────
function pct(n: number | undefined, d = 1) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`
}
function usd(n: number | undefined) {
  if (!n) return '—'
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
function fmtStrategy(s?: string) {
  if (!s) return '—'
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
function gradeClr(g?: string) {
  if (g === 'A+') return '#ffd700'
  if (g === 'A')  return GRN
  if (g === 'B')  return '#378ADD'
  return MUTED
}
function wftClr(v?: string) {
  if (v === 'PASS') return GRN
  if (v === 'FAIL') return RED
  return MUTED
}
function regimeInfo(r?: string) {
  const v = (r ?? '').toLowerCase()
  if (v.includes('bull') || v.includes('risk-on')) return { label: '▲ RISK-ON', color: GRN }
  if (v.includes('bear') || v.includes('risk-off')) return { label: '▼ RISK-OFF', color: RED }
  return { label: '◆ NEUTRAL', color: DIM }
}
function Th({ children }: { children: string }) {
  return (
    <th style={{ padding: '7px 14px', fontSize: 9, color: MUTED, fontFamily: MONO, letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `1px solid ${BDR}`, fontWeight: 400, textAlign: 'left' }}>
      {children}
    </th>
  )
}
function Td({ children, color }: { children: ReactNode; color?: string }) {
  return <td style={{ padding: '9px 14px', fontFamily: MONO, fontSize: 12, color: color ?? '#e8e9f0' }}>{children}</td>
}

// ─── Portfolio Overview ────────────────────────────────────────────────────────
function EngineOverview({ data }: { data: PublicData | null }) {
  if (!data) return null
  const p = data.portfolio ?? {}
  const regime = regimeInfo(data.regime)
  const wr = p.wr !== undefined ? (p.wr <= 1 ? p.wr * 100 : p.wr) : undefined
  const stats = [
    { label: 'EQUITY',    value: usd(p.equity ?? p.capital),                               color: GOLD },
    { label: 'RETORNO',   value: pct(p.return_pct ?? p.total_return),                       color: (p.return_pct ?? 0) >= 0 ? GRN : RED },
    { label: 'WIN RATE',  value: wr !== undefined ? `${wr.toFixed(1)}%` : '—',              color: wr !== undefined && wr >= 60 ? GRN : GOLD },
    { label: 'MAX DD',    value: (p.max_dd_pct ?? p.max_dd) !== undefined ? `${(p.max_dd_pct ?? p.max_dd)!.toFixed(1)}%` : '—', color: RED },
    { label: 'TRADES',    value: (p.n_trades ?? p.trades_total)?.toLocaleString() ?? '—',   color: DIM },
    { label: 'RÉGIMEN',   value: regime.label,                                               color: regime.color },
    { label: 'PROFIT F.', value: p.pf?.toFixed(2) ?? '—',                                   color: GOLD },
    { label: 'ACTIVOS',   value: `M1+M2`,                                                   color: DIM },
  ]
  return (
    <div style={{ background: SURF, border: `1px solid ${BDR}`, marginBottom: 28, overflow: 'hidden' }}>
      <div style={{ padding: '10px 18px', borderBottom: `1px solid ${BDR}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: GRN, boxShadow: `0 0 7px ${GRN}` }} />
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: MUTED }}>{'// PAPER TRADING · ESTADO REAL · DESDE 11 MAY 2026'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: BDR }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: BG, padding: '14px 16px' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.15em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: BEBAS, fontSize: 22, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Individual Champion Card ──────────────────────────────────────────────────
function ModelCard({ c }: { c: Champion }) {
  const oos     = c.metrics_oos ?? {}
  const cagr    = oos.cagr    ?? c.cagr
  const rawWr   = oos.wr      ?? c.wr
  const wr      = rawWr !== undefined ? (rawWr <= 1 ? rawWr * 100 : rawWr) : undefined
  const dd      = oos.dd      ?? c.max_dd
  const pf      = oos.pf
  const trades  = oos.trades  ?? c.n_trades
  const isShort = (c.direction ?? '').toLowerCase() === 'short'
  const dirClr  = isShort ? RED : GRN
  const gc      = gradeClr(c.grade)
  const wft     = c.wft    ?? {}
  const mc      = c.mc     ?? {}
  const bay     = c.bayesian ?? {}
  const flags   = c.red_flags ?? []
  const mcValid = (mc.confidence ?? 0) > 0

  const savedDate = c.saved_at
    ? new Date(c.saved_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' })
    : null

  return (
    <div style={{ background: SURF, border: `1px solid ${BDR}`, borderTop: `3px solid ${gc}`, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '13px 16px 10px', borderBottom: `1px solid ${BDR}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: gc, border: `1px solid ${gc}40`, padding: '1px 7px', letterSpacing: '0.08em' }}>{c.grade ?? '?'}</span>
          <span style={{ fontFamily: BEBAS, fontSize: 22, color: '#e8e9f0', letterSpacing: '0.04em', lineHeight: 1 }}>
            {c.sym ?? c.ticker ?? c.asset ?? '—'}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: isShort ? RED : GRN, background: `${dirClr}14`, padding: '2px 7px' }}>
            {isShort ? '▼ SHORT' : '▲ LONG'}
          </span>
          {savedDate && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginLeft: 'auto' }}>{savedDate}</span>
          )}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: DIM }}>{fmtStrategy(c.strategy)}</div>
      </div>

      {/* ── Sub-barra 1: OOS Backtest ── */}
      <div style={{ borderBottom: `1px solid ${BDR}` }}>
        <div style={{ padding: '4px 16px 2px', fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: '0.2em' }}>OOS BACKTEST</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: BDR }}>
          {[
            { label: 'CAGR',      value: cagr !== undefined ? `${cagr >= 0 ? '+' : ''}${cagr.toFixed(0)}%` : '—', color: cagr !== undefined ? (cagr >= 50 ? GRN : cagr >= 0 ? GOLD : RED) : MUTED },
            { label: 'WIN RATE',  value: wr !== undefined ? `${wr.toFixed(1)}%` : '—',                             color: wr !== undefined ? (wr >= 65 ? GRN : wr >= 50 ? GOLD : RED) : MUTED },
            { label: 'MAX DD',    value: dd !== undefined ? `${dd.toFixed(1)}%` : '—',                             color: dd !== undefined ? (dd > -20 ? GOLD : RED) : MUTED },
            { label: 'PROFIT F.', value: pf !== undefined ? `${pf.toFixed(2)}x` : '—',                             color: pf !== undefined ? (pf >= 1.5 ? GRN : GOLD) : MUTED },
            { label: 'TRADES',    value: trades?.toLocaleString() ?? '—',                                           color: trades !== undefined ? (trades >= 30 ? GRN : GOLD) : MUTED },
          ].map(s => (
            <div key={s.label} style={{ background: BG, padding: '9px 10px 7px' }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: '0.1em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: BEBAS, fontSize: 19, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sub-barra 2: Validación ── */}
      <div style={{ borderBottom: flags.length > 0 ? `1px solid ${BDR}` : undefined }}>
        <div style={{ padding: '4px 16px 2px', fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: '0.2em' }}>VALIDACIÓN</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: BDR }}>
          <div style={{ background: BG, padding: '8px 10px' }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: '0.1em', marginBottom: 3 }}>WALK-FWD</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: wftClr(wft.verdict) }}>{wft.verdict ?? 'N/A'}</div>
            {wft.verdict === 'PASS' && wft.n_windows ? (
              <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginTop: 2 }}>{wft.n_windows}w · {wft.oos_win_rate?.toFixed(0)}%</div>
            ) : null}
          </div>
          <div style={{ background: BG, padding: '8px 10px' }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: '0.1em', marginBottom: 3 }}>MONTE CARLO</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: mcValid ? (mc.confidence! >= 70 ? GRN : GOLD) : MUTED }}>
              {mcValid ? `${mc.confidence!.toFixed(0)}%` : 'N/A'}
            </div>
            {mcValid && mc.cagr_p50 ? (
              <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginTop: 2 }}>p50 {pct(mc.cagr_p50, 0)}</div>
            ) : null}
          </div>
          <div style={{ background: BG, padding: '8px 10px' }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: '0.1em', marginBottom: 3 }}>KELLY %</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: GOLD }}>
              {c.risk_pct !== undefined ? `${c.risk_pct.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div style={{ background: BG, padding: '8px 10px' }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: '0.1em', marginBottom: 3 }}>BAYESIAN</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: bay.edge_confirmed ? GRN : MUTED }}>
              {bay.edge_confirmed ? 'CONFIRMED' : `${bay.n_trades ?? 0} live`}
            </div>
          </div>
        </div>
      </div>

      {/* ── Red Flags ── */}
      {flags.length > 0 && (
        <div style={{ padding: '5px 12px', background: '#0c0900', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {flags.map(f => (
            <span key={f} style={{ fontFamily: MONO, fontSize: 9, color: '#f59e0b', padding: '1px 5px', border: '1px solid #f59e0b25' }}>
              ⚠ {f.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TF Section within a motor ────────────────────────────────────────────────
function TFSection({ tf, champions }: { tf: string; champions: Champion[] }) {
  const aPlus = champions.filter(c => c.grade === 'A+').length
  const aGrade = champions.filter(c => c.grade === 'A').length
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '7px 14px', background: SURF, border: `1px solid ${BDR}` }}>
        <span style={{ fontFamily: BEBAS, fontSize: 15, color: GOLD, letterSpacing: '0.12em' }}>{tf.toUpperCase()}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>
          {champions.length} champion{champions.length !== 1 ? 's' : ''}
          {aPlus > 0 ? ` · ${aPlus} A+` : ''}
          {aGrade > 0 ? ` · ${aGrade} A` : ''}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 1, background: BDR }}>
        {champions.map((c, i) => <ModelCard key={c.slot ?? i} c={c} />)}
      </div>
    </div>
  )
}

// ─── Motor Section ─────────────────────────────────────────────────────────────
function MotorSection({
  motor,
  champions,
}: {
  motor: MotorDef
  champions: Champion[]
}) {
  const [open, setOpen] = useState(true)
  const isActive = motor.status === 'ACTIVO'

  // Group by TF in canonical order
  const byTF: Record<string, Champion[]> = {}
  for (const c of champions) {
    const tf = (c.tf ?? c.timeframe ?? 'unknown').toLowerCase()
    if (!byTF[tf]) byTF[tf] = []
    byTF[tf].push(c)
  }
  const tfKeys = TF_ORDER.filter(tf => byTF[tf]?.length > 0)

  const totalChamps = champions.length
  const gradeAPlus  = champions.filter(c => c.grade === 'A+').length
  const gradeA      = champions.filter(c => c.grade === 'A').length

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Motor header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none',
          background: 'transparent', padding: 0, marginBottom: open ? 16 : 0,
        }}
      >
        <div style={{
          padding: '14px 20px',
          background: SURF,
          border: `1px solid ${motor.color}40`,
          borderLeft: `4px solid ${motor.color}`,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {/* Number */}
          <span style={{ fontFamily: BEBAS, fontSize: 32, color: `${motor.color}55`, lineHeight: 1, flexShrink: 0 }}>
            {motor.id}
          </span>
          {/* Name + subtitle */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
              <span style={{ fontFamily: BEBAS, fontSize: 20, color: motor.color, letterSpacing: '0.08em' }}>{motor.subtitle}</span>
              <span style={{
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.15em',
                color: isActive ? GRN : MUTED,
                border: `1px solid ${isActive ? GRN : MUTED}40`,
                padding: '1px 8px',
              }}>
                {motor.status}
              </span>
              {isActive && totalChamps > 0 && (
                <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>
                  {totalChamps} champions
                  {gradeAPlus > 0 ? ` · ${gradeAPlus} A+` : ''}
                  {gradeA > 0 ? ` · ${gradeA} A` : ''}
                </span>
              )}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>{motor.desc}</div>
          </div>
          {/* Chevron */}
          <span style={{ fontFamily: MONO, fontSize: 14, color: MUTED, flexShrink: 0 }}>
            {open ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Content */}
      {open && (
        <div>
          {!isActive ? (
            /* Placeholder for future motors */
            <div style={{
              padding: '32px 24px',
              background: SURF, border: `1px solid ${BDR}`,
              textAlign: 'center', borderTop: 'none',
            }}>
              <div style={{ fontFamily: BEBAS, fontSize: 28, color: MUTED, letterSpacing: '0.1em', marginBottom: 8 }}>
                EN DESARROLLO
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, maxWidth: 480, margin: '0 auto' }}>
                {motor.desc}
              </div>
              <div style={{ marginTop: 16, display: 'inline-flex', gap: 6 }}>
                {['ARQUITECTURA', 'DATOS', 'ESTRATEGIAS', 'BACKTESTING'].map((step, i) => (
                  <span key={step} style={{
                    fontFamily: MONO, fontSize: 9, color: MUTED,
                    border: `1px solid ${MUTED}30`, padding: '3px 8px',
                    opacity: 0.5 + i * 0.1,
                  }}>
                    {step}
                  </span>
                ))}
              </div>
            </div>
          ) : totalChamps === 0 ? (
            <div style={{ padding: '20px 24px', background: SURF, border: `1px solid ${BDR}`, borderTop: 'none' }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>
                Sin champions activos — el trainer está buscando modelos.
              </span>
            </div>
          ) : (
            /* Champions grouped by TF */
            <div>
              {tfKeys.map(tf => (
                <TFSection key={tf} tf={tf} champions={byTF[tf]} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Open Positions ────────────────────────────────────────────────────────────
function OpenPositions({ trades }: { trades: Trade[] }) {
  if (!trades.length) return (
    <div style={{ background: SURF, border: `1px solid ${BDR}`, padding: '14px 20px', marginBottom: 20 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>{'// POSICIONES ABIERTAS · ninguna activa'}</span>
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
          <thead><tr style={{ background: BG }}>{['Activo','TF','Dirección','Entry','SL','TP','Estrategia','Abierta'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>
            {trades.map((t, i) => {
              const d = (t.direction ?? t.side ?? '').toLowerCase()
              const openedAt = t.opened_at
                ? new Date(t.opened_at).toLocaleString('es-CL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '—'
              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(26,29,46,0.5)', borderLeft: `3px solid ${d === 'long' ? GRN : RED}` }}>
                  <Td color="#e8e9f0">{t.sym ?? '?'}</Td>
                  <Td color={GOLD}>{t.tf ?? '—'}</Td>
                  <Td color={d === 'long' ? GRN : RED}>{d === 'long' ? '▲ LONG' : '▼ SHORT'}</Td>
                  <Td>{(t.entry_price ?? t.entry)?.toFixed(2) ?? '—'}</Td>
                  <Td color={RED}>{(t.stop_loss ?? t.sl)?.toFixed(2) ?? '—'}</Td>
                  <Td color={GRN}>{(t.take_profit ?? t.tp)?.toFixed(2) ?? '—'}</Td>
                  <Td color={DIM}>{fmtStrategy(t.strategy)}</Td>
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
  const last = [...history].reverse().slice(0, 30)
  if (!last.length) return null
  return (
    <div style={{ background: SURF, border: `1px solid ${BDR}`, overflow: 'hidden' }}>
      <div style={{ padding: '11px 18px', borderBottom: `1px solid ${BDR}` }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: '0.15em' }}>
          {'// HISTORIAL · ÚLTIMOS '}{last.length}{' TRADES'}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: BG }}>{['Activo','TF','Dirección','Estrategia','P&L %','Resultado','Cierre'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>
            {last.map((t, i) => {
              const d = (t.direction ?? t.side ?? '').toLowerCase()
              const pnl = t.pnl_pct ?? t.pnl
              const res = t.result?.toLowerCase() ?? (pnl !== undefined && pnl >= 0 ? 'win' : 'loss')
              const closedAt = t.closed_at
                ? new Date(t.closed_at).toLocaleString('es-CL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '—'
              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(26,29,46,0.3)' }}>
                  <Td color="#e8e9f0">{t.sym ?? '?'}</Td>
                  <Td color={GOLD}>{t.tf ?? '—'}</Td>
                  <Td color={d === 'long' ? GRN : RED}>{d === 'long' ? '▲ LONG' : '▼ SHORT'}</Td>
                  <Td color={DIM}>{fmtStrategy(t.strategy)}</Td>
                  <Td color={pnl !== undefined ? (pnl >= 0 ? GRN : RED) : MUTED}>{pct(pnl)}</Td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: res === 'win' ? GRN : RED, border: `1px solid ${res === 'win' ? GRN : RED}40`, padding: '2px 7px' }}>
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
  const [champions,  setChampions]  = useState<Champion[]>([])
  const [pubLoading, setPubLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [pubRes, champRes] = await Promise.all([
        fetch('/api/vps/signals'),
        fetch('/api/vps/champions'),
      ])
      if (pubRes.ok)   setPubData(await pubRes.json())
      if (champRes.ok) {
        const d = await champRes.json()
        const list: Champion[] = Array.isArray(d)
          ? d
          : Array.isArray(d?.champions) ? d.champions
          : Array.isArray(d?.models)    ? d.models
          : typeof d === 'object' && d !== null && !d.error
            ? Object.entries(d).map(([slot, v]) => ({ slot, ...(v as object) }))
            : []
        setChampions(list)
      }
      setLastUpdate(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }))
    } catch { /* offline */ }
    finally { setPubLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: MONO }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.28em', color: DIM, marginBottom: 10, textTransform: 'uppercase' }}>
            {'// SQUANT DESK · 5 MOTORES · 2 ACTIVOS'}
          </div>
          <h1 style={{ fontFamily: BEBAS, fontSize: 'clamp(44px,6vw,72px)', lineHeight: 0.93, margin: '0 0 8px' }}>
            <span style={{ color: C.text }}>MODELOS</span>{' '}
            <span style={{ background: `linear-gradient(135deg,${GOLD},#f5c842,#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              EN PRODUCCIÓN
            </span>
          </h1>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, display: 'flex', alignItems: 'center', gap: 16 }}>
            {pubLoading ? 'Conectando…' : lastUpdate ? `Actualizado ${lastUpdate} · Auto-refresh 60s` : 'Motor offline'}
            <span style={{ color: BDR }}>·</span>
            <span>
              <span style={{ color: GRN }}>●</span> Motor 1 Crypto
              <span style={{ color: MUTED, marginLeft: 4 }}>+</span>{' '}
              <span style={{ color: GRN }}>●</span> Motor 2 Commodities
              <span style={{ color: MUTED, marginLeft: 4 }}>+</span>{' '}
              <span style={{ color: MUTED }}>○</span> Motores 3/4/5 en desarrollo
            </span>
          </div>
        </div>

        {/* ── Portfolio Overview ── */}
        {!pubLoading && <EngineOverview data={pubData} />}

        {/* ── 5 Motores ── */}
        {MOTORS.map(motor => {
          const motorChamps = champions.filter(c => {
            const sym = (c.sym ?? c.ticker ?? c.asset ?? '').toUpperCase()
            return motor.syms.includes(sym)
          })
          return <MotorSection key={motor.id} motor={motor} champions={motorChamps} />
        })}

        {/* ── Posiciones Abiertas ── */}
        {!pubLoading && <OpenPositions trades={pubData?.open_trades ?? []} />}

        {/* ── Historial ── */}
        {!pubLoading && pubData?.history && pubData.history.length > 0 && (
          <TradeHistory history={pubData.history} />
        )}

      </div>
    </div>
  )
}
