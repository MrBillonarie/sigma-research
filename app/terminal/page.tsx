'use client'
import dynamic from 'next/dynamic'

const TerminalChart = dynamic(() => import('./TerminalChart'), { ssr: false,
  loading: () => <div style={{ height: 320, background: '#04050a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7f9a' }}>Cargando gráfico…</span></div>,
})

const C = {
  bg: '#04050a', surface: '#0b0d14', border: '#1a1d2e',
  muted: '#3a3f55', dimText: '#7a7f9a', text: '#e8e9f0',
  gold: '#d4af37', glow: '#f0cc5a', green: '#34d399', red: '#f87171', yellow: '#fbbf24',
}

// ─── Mock portfolio data ──────────────────────────────────────────────────────
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
                'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic 24']

const platforms = [
  { id: 'ibkr',      name: 'Interactive Brokers', color: '#3b82f6', current: 28_450, prev: 21_200, currency: 'USD', type: 'Equities / Options', change: 34.2 },
  { id: 'bnspot',    name: 'Binance Spot',         color: '#f59e0b', current: 14_320, prev: 18_900, currency: 'USD', type: 'Crypto Spot',        change: -24.2 },
  { id: 'bnfut',     name: 'Binance Futures',      color: '#ef4444', current:  8_780, prev:  6_100, currency: 'USD', type: 'Crypto Perps',       change: 44.0 },
  { id: 'fintual',   name: 'Fintual',              color: '#8b5cf6', current: 12_640, prev: 10_800, currency: 'CLP', type: 'Fondos Mutuos',      change: 17.0 },
  { id: 'santander', name: 'Santander',            color: '#ec4899', current:  6_900, prev:  6_500, currency: 'CLP', type: 'Ahorro / DAP',       change:  6.2 },
]

// Generate 24 months of history per platform
function genHistory(finalVal: number, volatility: number, trend: number): number[] {
  const n = 24
  const vals: number[] = []
  let v = finalVal * Math.pow(1 - trend, n / 12)
  for (let i = 0; i < n; i++) {
    v = v * (1 + trend / 12 + (Math.random() - 0.48) * volatility)
    vals.push(Math.round(v))
  }
  vals[n - 1] = finalVal
  return vals
}

const platformHistories = platforms.map(p => ({
  name: p.name,
  color: p.color,
  data: genHistory(p.current, 0.06, 0.08),
}))

const totalHistory = MONTHS.slice(0, 24).map((_, i) =>
  platformHistories.reduce((sum, p) => sum + p.data[i], 0)
)

const totalCurrent  = platforms.reduce((s, p) => s + p.current, 0)
const totalPrev     = platforms.reduce((s, p) => s + p.prev, 0)
const ytdReturn     = ((totalCurrent - totalPrev) / totalPrev) * 100

// Compute Sharpe & drawdown from totalHistory
const returns = totalHistory.slice(1).map((v, i) => (v - totalHistory[i]) / totalHistory[i])
const meanR   = returns.reduce((a, b) => a + b, 0) / returns.length
const stdR    = Math.sqrt(returns.reduce((a, b) => a + (b - meanR) ** 2, 0) / returns.length)
const sharpe  = stdR > 0 ? (meanR / stdR) * Math.sqrt(12) : 0
let peak = 0, maxDD = 0
totalHistory.forEach(v => {
  if (v > peak) peak = v
  const dd = (v - peak) / peak
  if (dd < maxDD) maxDD = dd
})

const fmt  = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(2)}M` : `$${v.toLocaleString('en-US')}`
const fmtK = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(2)}M` : `$${(v/1e3).toFixed(1)}K`

function Label({ text }: { text: string }) {
  return <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>{text}</div>
}

export default function TerminalPage() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
            {'// PORTFOLIO DASHBOARD · MULTI-PLATAFORMA'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ color: C.text }}>SIGMA</span>{' '}
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TERMINAL</span>
          </h1>
        </div>

        {/* Top metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: C.border, marginBottom: 1 }}>
          {[
            { label: 'Total Patrimonio',   value: fmt(totalCurrent),         sub: 'USD equiv.',           color: C.gold  },
            { label: 'Rentabilidad YTD',   value: `${ytdReturn > 0 ? '+' : ''}${ytdReturn.toFixed(2)}%`, sub: 'vs. inicio de año', color: ytdReturn >= 0 ? C.green : C.red },
            { label: 'Sharpe Ratio',       value: sharpe.toFixed(2),         sub: '12M rolling',          color: sharpe >= 1.5 ? C.green : C.gold },
            { label: 'Max Drawdown',       value: `${(maxDD*100).toFixed(2)}%`, sub: '24M window',        color: C.red   },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{ background: C.surface, padding: '20px 22px' }}>
              <Label text={label} />
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 38, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Capital evolution chart */}
        <div style={{ background: C.surface, marginBottom: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>EVOLUCIÓN DE CAPITAL · 24 MESES</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>base: USD equiv.</span>
          </div>
          <TerminalChart
            labels={MONTHS.slice(0, 24)}
            total={totalHistory}
            platforms={platformHistories}
          />
        </div>

        {/* Platform grid */}
        <div style={{ marginBottom: 1 }}>
          <div style={{ background: C.surface, padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>DESGLOSE POR PLATAFORMA</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: C.border }}>
            {platforms.map(p => {
              const pctTotal = (p.current / totalCurrent) * 100
              return (
                <div key={p.id} style={{ background: C.bg, padding: '20px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.dimText }}>{p.name}</span>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 30, color: C.text, lineHeight: 1, marginBottom: 4 }}>
                    {fmtK(p.current)}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: p.change >= 0 ? C.green : C.red, marginBottom: 8 }}>
                    {p.change >= 0 ? '+' : ''}{p.change.toFixed(1)}% YTD
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 2, background: C.border, marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${pctTotal}%`, background: p.color }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted }}>{p.type}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>{pctTotal.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Allocation table */}
        <div style={{ background: C.surface }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>TABLA RESUMEN</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Plataforma', 'Tipo', 'Moneda', 'Valor actual', 'Valor prev.', 'Cambio YTD', '% Portafolio'].map(h => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'left', color: C.dimText, fontWeight: 400, letterSpacing: '0.15em', fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {platforms.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(212,175,55,0.02)' }}>
                  <td style={{ padding: '12px 18px', color: C.text }}>{p.name}</td>
                  <td style={{ padding: '12px 18px', color: C.dimText }}>{p.type}</td>
                  <td style={{ padding: '12px 18px', color: C.dimText }}>{p.currency}</td>
                  <td style={{ padding: '12px 18px', color: C.gold, fontWeight: 500 }}>{fmt(p.current)}</td>
                  <td style={{ padding: '12px 18px', color: C.dimText }}>{fmt(p.prev)}</td>
                  <td style={{ padding: '12px 18px', color: p.change >= 0 ? C.green : C.red }}>{p.change >= 0 ? '+' : ''}{p.change.toFixed(1)}%</td>
                  <td style={{ padding: '12px 18px', color: C.dimText }}>{((p.current / totalCurrent) * 100).toFixed(1)}%</td>
                </tr>
              ))}
              <tr style={{ borderTop: `1px solid ${C.gold}30` }}>
                <td colSpan={3} style={{ padding: '12px 18px', color: C.gold, fontFamily: "'Bebas Neue', Impact", fontSize: 14, letterSpacing: '0.15em' }}>TOTAL</td>
                <td style={{ padding: '12px 18px', color: C.gold, fontFamily: "'Bebas Neue', Impact", fontSize: 18 }}>{fmt(totalCurrent)}</td>
                <td style={{ padding: '12px 18px', color: C.dimText }}>{fmt(totalPrev)}</td>
                <td style={{ padding: '12px 18px', color: ytdReturn >= 0 ? C.green : C.red, fontFamily: "'Bebas Neue', Impact", fontSize: 18 }}>{ytdReturn >= 0 ? '+' : ''}{ytdReturn.toFixed(2)}%</td>
                <td style={{ padding: '12px 18px', color: C.gold }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
