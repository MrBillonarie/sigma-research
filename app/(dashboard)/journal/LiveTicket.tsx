'use client'
import { C } from '@/app/lib/constants'

// ─── LiveTicket — tarjeta de trade abierto estilo "boleta de orden" ──────────
// Precio en vivo + P&L flotante + grid de niveles (Entrada/SL/TP/R:R) + barra
// de posición SL↔TP. Reemplaza la barrita plana anterior. Solo front.

interface LiveTrade {
  sym: string; direction: 'long' | 'short'; strategy: string; grade: string; tf: string
  entry: number; sl: number; tp: number; pnl_pct: number; pnlUsd: number; opened_at: string
}

const F_DISP = "var(--font-bebas,'Bebas Neue',Impact,sans-serif)"

function fmtN(v: number) { return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtUsd(v: number) { return `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function elapsedSince(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  const days = Math.floor(hrs / 24)
  return `${days}d ${hrs % 24}h`
}

export default function LiveTicket({ t }: { t: LiveTrade }) {
  const short = t.direction === 'short'
  const price = t.entry > 0 ? (short ? t.entry * (1 - t.pnl_pct / 100) : t.entry * (1 + t.pnl_pct / 100)) : t.entry
  const win = t.pnlUsd >= 0
  const pc = win ? C.green : C.red
  const slPct = t.entry > 0 ? Math.abs(((t.sl - t.entry) / t.entry) * 100) : 0
  const tpPct = t.entry > 0 ? Math.abs(((t.tp - t.entry) / t.entry) * 100) : 0
  const risk = Math.abs(t.entry - t.sl), reward = Math.abs(t.tp - t.entry)
  const rr = risk > 0 ? reward / risk : 0

  // barra de posición SL↔TP
  const lo = Math.min(t.sl, t.tp), hi = Math.max(t.sl, t.tp), span = hi - lo || 1
  const pos = (v: number) => Math.min(98, Math.max(2, ((v - lo) / span) * 100))
  const slLeft = t.sl < t.tp
  const barBg = `linear-gradient(90deg, ${slLeft ? C.red : C.green}, #141b26 44%, #141b26 56%, ${slLeft ? C.green : C.red})`
  const rawTo = t.tp - t.entry !== 0 ? ((price - t.entry) / (t.tp - t.entry)) * 100 : 0
  const recorrido = rawTo <= 0 ? 'en contra de TP' : `${Math.min(100, rawTo).toFixed(0)}% del camino a TP`

  const hasLevels = t.entry > 0 && !!t.sl && !!t.tp

  return (
    <div className="lt">
      <style>{`
        .lt{position:relative;border:1px solid ${C.border};border-radius:12px;overflow:hidden;
          background:linear-gradient(180deg,${C.surface},${C.bg} 130%);
          box-shadow:0 20px 44px -26px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.03)}
        .lt::before{content:'';position:absolute;top:0;left:0;bottom:0;width:3px;background:${pc};box-shadow:0 0 14px ${pc}}
        .lt-sweep{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 40%,${pc}0c 50%,transparent 60%);background-size:250% 100%;animation:ltsw 6s linear infinite}
        @keyframes ltsw{to{background-position:-140% 0}}
        @media (prefers-reduced-motion: reduce){.lt-sweep{animation:none}.lt-ping{animation:none}}
        .lt-top{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid ${C.border};
          background:linear-gradient(90deg,rgba(255,180,84,.05),transparent 45%);flex-wrap:wrap;position:relative}
        .lt-live{display:inline-flex;align-items:center;gap:7px;font-size:9px;letter-spacing:.18em;color:${C.green}}
        .lt-live .lt-ping{width:7px;height:7px;border-radius:50%;background:${C.green};box-shadow:0 0 8px ${C.green};animation:ltpg 1.5s infinite}
        @keyframes ltpg{50%{opacity:.3}}
        .lt-sym{font-family:${F_DISP};font-size:24px;letter-spacing:.02em;color:${C.text}}
        .lt-side{font-size:10px;letter-spacing:.1em;padding:2px 9px;border-radius:5px}
        .lt-strat{font-size:10px;color:${C.dimText};text-transform:capitalize}
        .lt-go{margin-left:auto;font-size:10px;letter-spacing:.05em;color:${C.amber}}
        .lt-go b{background:${C.amber};color:${C.bg};padding:1px 6px;border-radius:3px;font-weight:700;margin-left:2px}
        .lt-price{display:flex;align-items:flex-end;gap:16px;padding:14px 16px 12px;flex-wrap:wrap;position:relative}
        .lt-big{font-family:${F_DISP};font-size:42px;line-height:.85;color:${C.text};font-variant-numeric:tabular-nums}
        .lt-since{font-size:10px;color:${C.muted}}
        .lt-pnl{margin-left:auto;text-align:right}
        .lt-pnl .v{font-family:${F_DISP};font-size:30px;line-height:.9;color:${pc};text-shadow:0 0 18px ${pc}40}
        .lt-pnl .s{font-size:10px;color:${pc}}
        .lt-grid{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid ${C.border}}
        .lt-cell{padding:10px 16px;border-right:1px solid ${C.border}}
        .lt-cell:last-child{border-right:none}
        .lt-kl{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:${C.muted}}
        .lt-cell .v{font-size:14px;color:${C.text};font-variant-numeric:tabular-nums;margin-top:3px}
        .lt-prog{padding:12px 16px;border-top:1px solid ${C.border};position:relative}
        .lt-bar{position:relative;height:8px;border-radius:4px}
        .lt-entry{position:absolute;top:-3px;width:2px;height:14px;background:${C.dimText};transform:translateX(-50%)}
        .lt-dot{position:absolute;top:-4px;width:14px;height:14px;border-radius:50%;background:${pc};box-shadow:0 0 12px ${pc};border:2px solid ${C.bg};transform:translateX(-50%);transition:left .6s ease}
        .lt-lbls{display:flex;justify-content:space-between;font-size:9px;margin-top:8px}
        @media(max-width:560px){.lt-grid{grid-template-columns:repeat(2,1fr)}.lt-cell:nth-child(2){border-right:none}}
      `}</style>
      <div className="lt-sweep" aria-hidden />

      <div className="lt-top">
        <span className="lt-live"><span className="lt-ping" />EN VIVO · NO REALIZADO</span>
        <span className="lt-sym">{t.sym}</span>
        <span className="lt-side" style={{ color: short ? C.red : C.green, border: `1px solid ${short ? C.red : C.green}66`, background: `${short ? C.red : C.green}12` }}>
          {short ? '▼ SHORT' : '▲ LONG'}
        </span>
        <span className="lt-strat">{t.strategy.replace(/_/g, ' ')} · {t.grade} · {t.tf}</span>
        <span className="lt-go">SQUANT<b>GO</b></span>
      </div>

      <div className="lt-price">
        <span className="lt-big">{fmtN(price)}</span>
        <span className="lt-since">entrada ${fmtN(t.entry)} · abierta {elapsedSince(t.opened_at)}</span>
        <div className="lt-pnl">
          <div className="v">{fmtUsd(t.pnlUsd)}</div>
          <div className="s">{t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct.toFixed(2)}%</div>
        </div>
      </div>

      <div className="lt-grid">
        <div className="lt-cell"><div className="lt-kl">Entrada</div><div className="v">${fmtN(t.entry)}</div></div>
        <div className="lt-cell"><div className="lt-kl">Stop loss</div><div className="v" style={{ color: C.red }}>${fmtN(t.sl)} <span style={{ fontSize: 10, color: C.muted }}>-{slPct.toFixed(1)}%</span></div></div>
        <div className="lt-cell"><div className="lt-kl">Take profit</div><div className="v" style={{ color: C.green }}>${fmtN(t.tp)} <span style={{ fontSize: 10, color: C.muted }}>+{tpPct.toFixed(1)}%</span></div></div>
        <div className="lt-cell"><div className="lt-kl">Riesgo : Benef.</div><div className="v">{rr.toFixed(2)}</div></div>
      </div>

      {hasLevels && (
        <div className="lt-prog">
          <div className="lt-kl" style={{ marginBottom: 9 }}>Precio en el rango · {recorrido}</div>
          <div className="lt-bar" style={{ background: barBg }}>
            <span className="lt-entry" style={{ left: `${pos(t.entry)}%` }} />
            <span className="lt-dot" style={{ left: `${pos(price)}%` }} />
          </div>
          <div className="lt-lbls">
            <span style={{ color: slLeft ? C.red : C.green }}>{slLeft ? 'SL' : 'TP'} ${fmtN(lo)}</span>
            <span style={{ color: C.dimText }}>entrada ${fmtN(t.entry)}</span>
            <span style={{ color: slLeft ? C.green : C.red }}>{slLeft ? 'TP' : 'SL'} ${fmtN(hi)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
