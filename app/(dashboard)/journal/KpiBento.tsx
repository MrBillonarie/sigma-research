'use client'
import { C } from '@/app/lib/constants'

// ─── KpiBento — resumen ejecutivo integrado (layout bento asimétrico) ─────────
// El equity actual manda en un bloque grande con su curva; el resto son tiles
// de distinto tamaño con micro-visualización. Solo front, misma data.

interface Props {
  capital: number; capitalSub: string; equityFinal: number
  pnlNeto: number; totalTrades: number; wins: number; winRate: number
  profitFactor: number; maxDD: number; expectancy: number; sharpe: number
  equityCurve: number[]
}

const F_DISP = "var(--font-bebas,'Bebas Neue',Impact,sans-serif)"
const hexa = (h: string, a: number) => {
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}
const fmtN = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtUsd = (v: number) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function AreaSpark({ data, color, w, h }: { data: number[]; color: string; w: number; h: number }) {
  if (!data || data.length < 2) return null
  const mn = Math.min(...data), mx = Math.max(...data), rg = (mx - mn) || 1
  const X = (i: number) => (i / (data.length - 1)) * w
  const Y = (v: number) => h - 2 - ((v - mn) / rg) * (h - 4) + 1
  const line = data.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const area = `0,${h} ${line} ${w},${h}`
  const ex = X(data.length - 1), ey = Y(data[data.length - 1])
  const id = `kb${Math.round(w)}${color.slice(1)}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.28} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={ex} cy={ey} r={2.2} fill={color} />
    </svg>
  )
}
function Ring({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, Math.max(0, pct)) / 100)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border2} strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize={12} fill={color}>{pct.toFixed(0)}%</text>
    </svg>
  )
}
function ThBar({ val, thresh, color, w = 70 }: { val: number; thresh: number; color: string; w?: number }) {
  const f = Math.min(1, Math.max(0, val / (thresh * 2))), tx = w * 0.5
  return (
    <svg width={w} height={14} viewBox={`0 0 ${w} 14`}>
      <rect x={0} y={5} width={w} height={4} rx={2} fill={C.border2} />
      <rect x={0} y={5} width={Math.round(w * f)} height={4} rx={2} fill={color} />
      <line x1={tx} y1={1} x2={tx} y2={13} stroke={C.dimText} strokeWidth={1.5} />
    </svg>
  )
}
function Dots({ wins, total }: { wins: number; total: number }) {
  const n = Math.min(total, 12)
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: 2, background: i < wins ? C.green : C.red }} />
      ))}
    </div>
  )
}

function pfColor(pf: number) { return pf >= 1.5 ? C.green : pf >= 1 ? C.yellow : C.red }
function shColor(s: number) { return s >= 1 ? C.green : s >= 0 ? C.yellow : C.red }

export default function KpiBento(p: Props) {
  const eqColor = C.gold // cian (acento equity/capital)
  const pnlC = p.pnlNeto >= 0 ? C.green : C.red
  const wrC = p.winRate >= 50 ? C.green : C.red
  const exC = p.expectancy >= 0 ? C.green : C.red
  const losses = Math.max(0, p.totalTrades - p.wins)

  return (
    <div>
      <style>{`
        .kb{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:86px;gap:10px}
        @media(max-width:640px){.kb{grid-template-columns:repeat(2,1fr)}}
        .kb-t{position:relative;border:1px solid ${C.border};border-radius:12px;overflow:hidden;background:${C.surface};
          padding:13px 15px;display:flex;flex-direction:column;justify-content:space-between}
        .kb-t::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--ac),transparent 65%)}
        .kb-t.hero{grid-column:span 2;grid-row:span 2;padding:16px 18px}
        .kb-t.tall{grid-row:span 2}
        .kb-kl{font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:${C.muted}}
        .kb-v{font-family:${F_DISP};line-height:.9;letter-spacing:.02em;font-variant-numeric:tabular-nums;color:var(--ac)}
        .kb-chip{font-size:9px;padding:2px 7px;border-radius:5px;font-variant-numeric:tabular-nums;white-space:nowrap}
        .kb-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .kb-sub{font-size:9px;color:${C.muted};margin-top:2px}
      `}</style>
      <div className="kb">
        {/* HERO — equity actual */}
        <div className="kb-t hero" style={{ ['--ac' as string]: eqColor }}>
          <div className="kb-row" style={{ alignItems: 'flex-start' }}>
            <span className="kb-kl">Equity actual · sobre tu capital</span>
            <span className="kb-chip" style={{ color: pnlC, background: hexa(pnlC, 0.14) }}>PNL {fmtUsd(p.pnlNeto)}</span>
          </div>
          <div>
            <div className="kb-v" style={{ fontSize: 44 }}>${fmtN(p.equityFinal)}</div>
            <div style={{ marginTop: 6, height: 44 }}><AreaSpark data={p.equityCurve} color={eqColor} w={240} h={44} /></div>
          </div>
        </div>

        {/* TALL — win rate */}
        <div className="kb-t tall" style={{ ['--ac' as string]: wrC }}>
          <span className="kb-kl">Win rate</span>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Ring pct={p.winRate} color={wrC} size={64} /></div>
          <div className="kb-kl" style={{ textAlign: 'center' }}>{p.wins}W · {losses}L</div>
        </div>

        {/* Profit factor */}
        <div className="kb-t" style={{ ['--ac' as string]: pfColor(p.profitFactor) }}>
          <span className="kb-kl">Profit factor</span>
          <div className="kb-row" style={{ alignItems: 'flex-end' }}>
            <span className="kb-v" style={{ fontSize: 26 }}>{p.profitFactor >= 999 ? '∞' : p.profitFactor.toFixed(2)}</span>
            {p.profitFactor < 999 && <ThBar val={p.profitFactor} thresh={1} color={pfColor(p.profitFactor)} w={70} />}
          </div>
        </div>

        {/* Max drawdown */}
        <div className="kb-t" style={{ ['--ac' as string]: C.red }}>
          <span className="kb-kl">Max drawdown</span>
          <div><span className="kb-v" style={{ fontSize: 24 }}>{p.maxDD.toFixed(1)}%</span>{p.maxDD > 100 && <div className="kb-sub">incluye liquidación</div>}</div>
        </div>

        {/* Sharpe */}
        <div className="kb-t" style={{ ['--ac' as string]: shColor(p.sharpe) }}>
          <span className="kb-kl">Sharpe ratio</span>
          <div><span className="kb-v" style={{ fontSize: 26 }}>{p.sharpe.toFixed(2)}</span><div className="kb-sub">anualizado rf=0</div></div>
        </div>

        {/* Expectancy */}
        <div className="kb-t" style={{ ['--ac' as string]: exC }}>
          <span className="kb-kl">Expectancy</span>
          <div><span className="kb-v" style={{ fontSize: 26 }}>{fmtUsd(p.expectancy)}</span><div className="kb-sub">por trade</div></div>
        </div>

        {/* Total trades */}
        <div className="kb-t" style={{ ['--ac' as string]: eqColor }}>
          <span className="kb-kl">Total trades</span>
          <div className="kb-row" style={{ alignItems: 'flex-end' }}>
            <span className="kb-v" style={{ fontSize: 26 }}>{p.totalTrades}</span>
            <Dots wins={p.wins} total={p.totalTrades} />
          </div>
        </div>

        {/* Capital base */}
        <div className="kb-t" style={{ ['--ac' as string]: eqColor }}>
          <span className="kb-kl">Capital base</span>
          <div><span className="kb-v" style={{ fontSize: 24 }}>${fmtN(p.capital)}</span><div className="kb-sub">{p.capitalSub}</div></div>
        </div>
      </div>
    </div>
  )
}
