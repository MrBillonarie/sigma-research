'use client'
import { useEffect, useState, useMemo } from 'react'
import type { PortfolioMetrics } from '@/types/decision-engine'

interface Props {
  metrics:   PortfolioMetrics
  flowScore: number
  buyCount:  number
  sellCount: number
  holdCount: number
  capital?:  number
}

function fmtUSD(n: number): string {
  const abs  = Math.abs(n)
  const sign = n < 0 ? '-' : '+'
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function fmtTotal(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 800): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const id = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(id) }
      else setVal(start)
    }, 16)
    return () => clearInterval(id)
  }, [target, duration])
  return val
}

// ─── Monte Carlo log-normal ───────────────────────────────────────────────────
// Genera `sims` trayectorias anuales con distribución log-normal.
// μ = ln(1+ret/100) − σ²/2 garantiza E[R]=ret% y Std[R]=vol% en términos anuales.
// byYear[y] = array ordenado de valores de portafolio al año y+1
function runMC(ret: number, vol: number, capital: number, sims = 2000): number[][] {
  const mu    = Math.log(1 + ret / 100) - (vol / 100) ** 2 / 2
  const sigma = vol / 100
  const byYear: number[][] = Array.from({ length: 5 }, () => [])
  for (let i = 0; i < sims; i++) {
    let v = capital
    for (let y = 0; y < 5; y++) {
      const u1 = Math.random() || 1e-10
      const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random())
      v *= Math.exp(mu + sigma * z)
      byYear[y].push(v)
    }
  }
  return byYear.map(arr => [...arr].sort((a, b) => a - b))
}

function pct(sorted: number[], p: number): number {
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * p / 100)))]
}

// ─── Fan chart SVG ────────────────────────────────────────────────────────────
function MonteCarloSection({ ret, vol, capital }: { ret: number; vol: number; capital: number }) {
  const MONO  = 'monospace'
  const BEBAS = "'Bebas Neue', Impact, sans-serif"
  const SIMS  = 2000

  const byYear = useMemo(() => runMC(ret, vol, capital, SIMS), [ret, vol, capital])

  // Percentiles en cada año (índice 0 = año 1)
  const P = byYear.map(s => ({
    p5:  pct(s,  5), p10: pct(s, 10), p25: pct(s, 25),
    p50: pct(s, 50), p75: pct(s, 75), p90: pct(s, 90), p95: pct(s, 95),
  }))

  // Probabilidad de ganancia al año 5
  const profitProb = Math.round(byYear[4].filter(v => v > capital).length / SIMS * 100)

  // ─── SVG fan chart ───────────────────────────────────────────────────────
  const W = 600, H = 210
  const PAD = { t: 16, b: 28, l: 62, r: 16 }
  const cW  = W - PAD.l - PAD.r
  const cH  = H - PAD.t - PAD.b

  const allP = P.flatMap(p => [p.p5, p.p95])
  const lo   = Math.min(capital, ...allP) * 0.97
  const hi   = Math.max(...allP) * 1.02

  const xS = (yr: number) => PAD.l + (yr / 5) * cW
  const yS = (v: number)  => PAD.t + cH - ((v - lo) / (hi - lo)) * cH

  // Construye path de banda rellena entre dos percentiles
  function band(loKey: keyof typeof P[0], hiKey: keyof typeof P[0]) {
    const top = P.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xS(i + 1)} ${yS(p[hiKey])}`)
    const bot = [...P].reverse().map((p, i) => `L ${xS(5 - i)} ${yS(p[loKey])}`)
    return [...[`M ${xS(0)} ${yS(capital)}`], ...top, ...bot, `L ${xS(0)} ${yS(capital)}`, 'Z'].join(' ')
  }

  function linePath(key: keyof typeof P[0]) {
    return [`M ${xS(0)} ${yS(capital)}`, ...P.map((p, i) => `L ${xS(i + 1)} ${yS(p[key])}`)].join(' ')
  }

  const yTicks = [lo, capital, (capital + hi) / 2, hi].filter((v, i, a) =>
    Math.abs(v - capital) > (hi - lo) * 0.08 || v === capital  // evitar ticks muy juntos
    && a.indexOf(v) === i
  ).slice(0, 4)

  return (
    <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 10, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', background: '#04050a', borderBottom: '1px solid #1a1d2e',
      }}>
        <div>
          <span style={{ fontSize: 10, color: '#7a7f9a', fontFamily: MONO, letterSpacing: 1, textTransform: 'uppercase' }}>
            Simulación Monte Carlo
          </span>
          <span style={{ fontSize: 9, color: '#3a3f55', fontFamily: MONO, marginLeft: 12 }}>
            {SIMS.toLocaleString()} trayectorias · distribución log-normal
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 10, color: '#3a3f55', fontFamily: MONO }}>Prob. ganancia a 5 años: </span>
          <span style={{ fontSize: 13, fontFamily: BEBAS, color: profitProb > 60 ? '#1D9E75' : profitProb > 40 ? '#d4af37' : '#f87171', letterSpacing: 1 }}>
            {profitProb}%
          </span>
        </div>
      </div>

      {/* SVG Fan Chart */}
      <div style={{ padding: '4px 0 0' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>

          {/* Grid vertical (años) */}
          {[1, 2, 3, 4, 5].map(yr => (
            <line key={yr} x1={xS(yr)} y1={PAD.t} x2={xS(yr)} y2={PAD.t + cH}
              stroke="#1a1d2e" strokeWidth={1} />
          ))}

          {/* Grid horizontal + Y labels */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={PAD.l} y1={yS(v)} x2={PAD.l + cW} y2={yS(v)}
                stroke={v === capital ? '#3a3f55' : '#1a1d2e'}
                strokeWidth={v === capital ? 1.5 : 1}
                strokeDasharray={v === capital ? '5 4' : undefined} />
              <text x={PAD.l - 6} y={yS(v)} textAnchor="end" dominantBaseline="middle"
                fill={v === capital ? '#7a7f9a' : '#3a3f55'}
                style={{ fontSize: '9px', fontFamily: MONO }}>
                {fmtTotal(v)}
              </text>
            </g>
          ))}

          {/* Bandas rellenas */}
          <path d={band('p5',  'p95')} fill="#378ADD" opacity={0.06} />
          <path d={band('p10', 'p90')} fill="#378ADD" opacity={0.10} />
          <path d={band('p25', 'p75')} fill="#378ADD" opacity={0.18} />

          {/* Líneas de percentiles — de afuera hacia adentro */}
          <path d={linePath('p95')} fill="none" stroke="#1D9E75" strokeWidth={1}   strokeDasharray="3 4" opacity={0.35} />
          <path d={linePath('p90')} fill="none" stroke="#1D9E75" strokeWidth={1.2} strokeDasharray="5 3" opacity={0.65} />
          <path d={linePath('p75')} fill="none" stroke="#1D9E75" strokeWidth={1.5} opacity={0.55} />
          <path d={linePath('p50')} fill="none" stroke="#d4af37" strokeWidth={2.5} />
          <path d={linePath('p25')} fill="none" stroke="#f87171" strokeWidth={1.5} opacity={0.55} />
          <path d={linePath('p10')} fill="none" stroke="#f87171" strokeWidth={1.2} strokeDasharray="5 3" opacity={0.65} />
          <path d={linePath('p5')}  fill="none" stroke="#f87171" strokeWidth={1}   strokeDasharray="3 4" opacity={0.35} />

          {/* Punto inicial */}
          <circle cx={xS(0)} cy={yS(capital)} r={4} fill="#7a7f9a" />

          {/* X axis labels */}
          {[0, 1, 2, 3, 4, 5].map(yr => (
            <text key={yr} x={xS(yr)} y={PAD.t + cH + 18} textAnchor="middle"
              fill="#3a3f55" style={{ fontSize: '9px', fontFamily: MONO }}>
              {yr === 0 ? 'hoy' : `${yr}a`}
            </text>
          ))}

          {/* Leyenda */}
          <g transform={`translate(${PAD.l + 8}, ${PAD.t + 8})`}>
            <line x1={0} y1={6} x2={18} y2={6} stroke="#d4af37" strokeWidth={2.5} />
            <text x={22} y={10} fill="#7a7f9a" style={{ fontSize: '8px', fontFamily: MONO }}>P50 mediana</text>
            <line x1={0} y1={20} x2={18} y2={20} stroke="#1D9E75" strokeWidth={1.5} />
            <text x={22} y={24} fill="#7a7f9a" style={{ fontSize: '8px', fontFamily: MONO }}>P75 / P25</text>
            <line x1={0} y1={34} x2={18} y2={34} stroke="#1D9E75" strokeWidth={1.2} strokeDasharray="5 3" opacity={0.65} />
            <text x={22} y={38} fill="#7a7f9a" style={{ fontSize: '8px', fontFamily: MONO }}>P90 / P10</text>
            <line x1={0} y1={48} x2={18} y2={48} stroke="#1D9E75" strokeWidth={1} strokeDasharray="3 4" opacity={0.35} />
            <text x={22} y={52} fill="#7a7f9a" style={{ fontSize: '8px', fontFamily: MONO }}>P95 / P5</text>
          </g>
        </svg>
      </div>

      {/* Tabla de percentiles: P10 / P50 / P90 en años 1, 3, 5 */}
      <div style={{ borderTop: '1px solid #1a1d2e' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr',
          padding: '6px 20px', background: '#04050a',
        }}>
          <div style={{ fontSize: 9, color: '#3a3f55', fontFamily: MONO, textTransform: 'uppercase' }}>Percentil</div>
          {[1, 3, 5].map(yr => (
            <div key={yr} style={{ fontSize: 9, color: '#7a7f9a', fontFamily: MONO, textAlign: 'right', textTransform: 'uppercase' }}>
              {yr} AÑO{yr > 1 ? 'S' : ''}
            </div>
          ))}
        </div>

        {[
          { label: 'P90  ⬆', p: 'p90' as const, color: '#1D9E75' },
          { label: 'P50  →', p: 'p50' as const, color: '#d4af37' },
          { label: 'P10  ⬇', p: 'p10' as const, color: '#f87171' },
        ].map((row) => (
          <div key={row.p} style={{
            display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr',
            padding: '10px 20px',
            borderTop: '1px solid #0d0f1a',
            background: row.p === 'p50' ? 'rgba(212,175,55,0.03)' : 'transparent',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: row.color, fontFamily: MONO, fontWeight: 700 }}>{row.label}</span>
            </div>
            {[0, 2, 4].map(idx => {
              const val  = P[idx][row.p]
              const gain = val - capital
              return (
                <div key={idx} style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 17, fontFamily: BEBAS, letterSpacing: 1, color: gain >= 0 ? row.color : '#f87171' }}>
                    {fmtUSD(gain)} USD
                  </div>
                  <div style={{ fontSize: 9, color: '#3a3f55', fontFamily: MONO, marginTop: 1 }}>
                    total {fmtTotal(val)}
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        <div style={{ padding: '7px 20px', borderTop: '1px solid #0d0f1a' }}>
          <span style={{ fontSize: 9, color: '#3a3f55', fontFamily: MONO }}>
            P90 = mejor 10% de escenarios · P50 = mediana · P10 = peor 10% · Log-normal anual con retorno {ret > 0 ? '+' : ''}{ret.toFixed(1)}% y volatilidad {vol.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Gauge Fear & Greed ───────────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const animated = useCountUp(score)
  const cx = 110, cy = 100
  const Ro = 88,  Ri = 60
  const W  = 220, H  = 130
  const a  = (p: number) => Math.PI * (1 - p / 100)
  const px = (ang: number, R: number) => cx + R * Math.cos(ang)
  const py = (ang: number, R: number) => cy - R * Math.sin(ang)

  function sector(from: number, to: number) {
    const [a1, a2] = [a(from), a(to)]
    const L = (to - from) > 50 ? 1 : 0
    return `M ${px(a1,Ro)} ${py(a1,Ro)} A ${Ro} ${Ro} 0 ${L} 1 ${px(a2,Ro)} ${py(a2,Ro)} L ${px(a2,Ri)} ${py(a2,Ri)} A ${Ri} ${Ri} 0 ${L} 0 ${px(a1,Ri)} ${py(a1,Ri)} Z`
  }

  const ZONES = [
    { from: 0,  to: 20,  fill: '#ef4444' },
    { from: 20, to: 40,  fill: '#f97316' },
    { from: 40, to: 60,  fill: '#6b7280' },
    { from: 60, to: 80,  fill: '#22c55e' },
    { from: 80, to: 100, fill: '#1D9E75' },
  ]

  const needleAngle = a(animated)
  const activeZone  = ZONES.find(z => animated >= z.from && animated <= z.to)
  const scoreColor  = activeZone?.fill ?? '#d4af37'
  const label       = animated >= 70 ? 'ALCISTA' : animated >= 45 ? 'NEUTRO' : 'BAJISTA'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <path d={sector(0, 100)} fill="#1a1d2e" />
      {ZONES.map(z => (
        <path key={z.from} d={sector(z.from + 0.8, z.to - 0.8)} fill={z.fill}
          opacity={animated >= z.from && animated < z.to ? 1 : 0.35} />
      ))}
      {[20, 40, 60, 80].map(t => (
        <line key={t} x1={px(a(t), Ri-1)} y1={py(a(t), Ri-1)}
          x2={px(a(t), Ro+1)} y2={py(a(t), Ro+1)} stroke="#04050a" strokeWidth={2} />
      ))}
      {[0, 25, 50, 75, 100].map(t => {
        const ang = a(t)
        return (
          <g key={t}>
            <circle cx={px(ang, (Ro+Ri)/2)} cy={py(ang, (Ro+Ri)/2)} r={2.5} fill="#04050a" />
            <text x={px(ang, Ri-14)} y={py(ang, Ri-14)} textAnchor="middle" dominantBaseline="middle"
              fill="#3a3f55" style={{ fontSize: '9px', fontFamily: 'monospace' }}>{t}</text>
          </g>
        )
      })}
      <line x1={cx} y1={cy} x2={px(needleAngle, Ro-10)} y2={py(needleAngle, Ro-10)}
        stroke="#e8e9f0" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill="#e8e9f0" />
      <circle cx={cx} cy={cy} r={3} fill="#04050a" />
      <text x={cx} y={cy+22} textAnchor="middle" fill={scoreColor}
        style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '28px', letterSpacing: '1px' }}>
        {Math.round(animated)}
      </text>
      <text x={cx} y={cy+36} textAnchor="middle" fill="#3a3f55"
        style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.15em' }}>
        {label}
      </text>
    </svg>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────────
function Card({
  label, value, sub, color, icon, gauge, subColor,
}: { label: string; value: string; sub?: string; color: string; icon: string; gauge?: React.ReactNode; subColor?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 160, background: '#0b0d14',
      border: '1px solid #1a1d2e', borderTop: `2px solid ${color}30`,
      borderRadius: 10, padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 10, color: '#7a7f9a', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      {gauge ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          {gauge}
          {sub && <div style={{ fontSize: 11, color: '#3a3f55', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{sub}</div>}
        </div>
      ) : (
        <>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 28, letterSpacing: 1, color }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: subColor ?? '#7a7f9a', marginTop: 4, fontFamily: 'monospace' }}>{sub}</div>}
        </>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function MetricCards({ metrics, flowScore, buyCount, sellCount, holdCount, capital = 0 }: Props) {
  const ret    = metrics.expectedReturn
  const vol    = metrics.annualVolatility
  const sharpe = metrics.sharpeRatio

  const retColor    = ret    > 8   ? '#1D9E75' : ret    > 4   ? '#d4af37' : '#f87171'
  const sharpeColor = sharpe > 1   ? '#1D9E75' : sharpe > 0.5 ? '#d4af37' : '#f87171'
  const flowColor   = flowScore > 60 ? '#1D9E75' : flowScore > 40 ? '#d4af37' : '#f87171'

  const animRet    = useCountUp(Math.abs(ret), 900)
  const animVol    = useCountUp(vol,           900)
  const animSharpe = useCountUp(sharpe * 100,  900)

  const gainUSD = capital > 0 ? capital * ret  / 100 : 0
  const ddUSD   = capital > 0 ? capital * metrics.maxDrawdown / 100 : 0
  const volUSD  = capital > 0 ? capital * vol  / 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Card
          icon="📈" label="Retorno Esperado"
          value={`${ret > 0 ? '+' : '-'}${animRet.toFixed(1)}%`}
          sub={capital > 0 ? fmtUSD(gainUSD) + ' USD / año' : 'Retorno anual proyectado'}
          subColor={capital > 0 ? retColor : undefined}
          color={retColor}
        />
        <Card
          icon="〰️" label="Volatilidad Anual"
          value={`${animVol.toFixed(1)}%`}
          sub={capital > 0
            ? `±${fmtUSD(volUSD).replace('+', '')} · DD: ${fmtUSD(ddUSD)} USD`
            : `DD máx: ${metrics.maxDrawdown.toFixed(1)}%`}
          color="#378ADD"
        />
        <Card
          icon="⚖️" label="Sharpe Ratio"
          value={(animSharpe / 100).toFixed(2)}
          sub="Mayor = mejor riesgo/retorno"
          color={sharpeColor}
        />
        <Card
          icon="🌊" label="Score Flujo"
          value=""
          color={flowColor}
          gauge={<ScoreGauge score={flowScore} />}
          sub={`▲ ${buyCount}  →  ${holdCount}  ▼ ${sellCount}`}
        />
      </div>

      {capital > 0 && <MonteCarloSection ret={ret} vol={vol} capital={capital} />}
    </div>
  )
}
