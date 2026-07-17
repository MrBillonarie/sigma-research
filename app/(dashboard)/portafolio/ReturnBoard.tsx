'use client'
import { C } from '@/app/lib/constants'

// ─── Holdings Board · Composición actual ─────────────────────────────────────
// SOLO datos reales: valor y peso actuales por fuente. No hay historial real
// guardado (solo el snapshot de hoy), así que NO se inventa evolución, retornos
// ni Δ. Sin canvas → no puede quedar en blanco. Cero cambios al motor.

interface Src { name: string; short: string; color: string; data: number[] }
interface Props { total: number[]; sources: Src[]; labels?: string[] }

const F_DISP = "var(--font-bebas,'Bebas Neue',Impact,sans-serif)"
const fmt  = (v: number) => (v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'K' : '$' + Math.round(v))
const fmtF = (v: number) => '$' + Math.round(v).toLocaleString('es-CL')

export default function ReturnBoard({ total, sources }: Props) {
  const N = total.length
  const tot = total[N - 1] || 0
  const rows = sources
    .map(s => ({ short: s.short, name: s.name, color: s.color, val: s.data[N - 1] || 0 }))
    .filter(r => r.val > 0)
    .sort((a, b) => b.val - a.val)

  return (
    <div>
      <style>{`
        .rb-cmd{display:flex;align-items:center;gap:14px;padding:9px 14px;border-bottom:1px solid ${C.border};
          background:linear-gradient(90deg,rgba(255,180,84,.06),rgba(255,255,255,.012) 40%);flex-wrap:wrap;font-size:11px;font-family:monospace}
        .rb-cmd .go{color:${C.amber};letter-spacing:.05em}
        .rb-cmd .go b{color:${C.bg};background:${C.amber};padding:1px 6px;border-radius:3px;font-weight:700;margin-left:2px}
        .rb-cmd .fn{color:${C.dimText};letter-spacing:.12em;text-transform:uppercase;font-size:10px}
        .rb-cmd .live{margin-left:auto;color:${C.green};display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.12em}
        .rb-cmd .live::before{content:'';width:6px;height:6px;border-radius:50%;background:${C.green};box-shadow:0 0 8px ${C.green};animation:rbpl 1.6s infinite}
        @keyframes rbpl{50%{opacity:.35}}
        .rb-head{display:flex;align-items:baseline;gap:12px;padding:14px 16px 12px;flex-wrap:wrap}
        .rb-bh,.rb-row{display:grid;grid-template-columns:14px 128px 1fr 92px 56px;gap:10px;align-items:center;padding:10px 16px}
        .rb-bh{border-top:1px solid ${C.border};border-bottom:1px solid ${C.border};font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:${C.muted}}
        .rb-bh .r{text-align:right}
        .rb-row{border-bottom:1px solid rgba(24,34,49,.6);transition:background .12s}
        .rb-row:hover{background:rgba(57,226,230,.05)}
        .rb-row i{width:9px;height:9px;border-radius:2px}
        .rb-row .bn{font-size:12px;color:${C.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.03em}
        .rb-bar{height:8px;border-radius:4px;background:${C.border};overflow:hidden;position:relative}
        .rb-bar i{display:block;height:100%;border-radius:4px}
        .rb-row .bv{text-align:right;font-size:12.5px;color:${C.text};font-variant-numeric:tabular-nums}
        .rb-row .bw{text-align:right;font-size:12px;color:${C.dimText};font-variant-numeric:tabular-nums}
        .rb-row.total{background:rgba(255,180,84,.05);border-top:1px solid ${C.border}}
        .rb-row.total .bn{color:${C.amber}} .rb-row.total .bv{color:${C.glow};font-weight:600}
        .rb-foot{display:flex;gap:8px;padding:10px 16px;border-top:1px solid ${C.border};font-size:10px;color:${C.muted};
          letter-spacing:.04em;line-height:1.6;background:linear-gradient(90deg,rgba(57,226,230,.03),transparent);font-family:monospace}
        .rb-foot b{color:${C.dimText};font-weight:400}
        @media(max-width:640px){.rb-bh,.rb-row{grid-template-columns:14px 1fr 84px 50px}.rb-bar{display:none}.rb-bh .hb{display:none}}
      `}</style>

      <div className="rb-cmd">
        <span className="go">SQUANT<b>GO</b></span>
        <span className="fn">PORT · Holdings</span>
        <span className="fn">USD equiv.</span>
        <span className="live">SYNC · HOY</span>
      </div>

      <div className="rb-head">
        <span style={{ fontFamily: F_DISP, fontSize: 40, lineHeight: 0.9, letterSpacing: '0.02em', background: `linear-gradient(135deg,${C.glow},${C.gold})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{fmt(tot)}</span>
        <span style={{ fontSize: 12, color: C.dimText }}>composición actual · {rows.length} fuentes</span>
        <span style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted, marginLeft: 'auto' }}>snapshot de hoy</span>
      </div>

      <div className="rb-bh"><span /><span>Fuente</span><span className="hb">Peso</span><span className="r">Valor</span><span className="r">%</span></div>
      {rows.map(r => {
        const pct = tot > 0 ? (r.val / tot) * 100 : 0
        return (
          <div key={r.name} className="rb-row">
            <i style={{ background: r.color }} />
            <span className="bn">{r.short}</span>
            <div className="rb-bar"><i style={{ width: `${pct}%`, background: `linear-gradient(90deg,${r.color},${r.color}cc)` }} /></div>
            <span className="bv">{fmtF(r.val)}</span>
            <span className="bw">{pct.toFixed(1)}%</span>
          </div>
        )
      })}
      <div className="rb-row total">
        <i style={{ background: C.glow }} />
        <span className="bn">TOTAL</span>
        <div className="rb-bar"><i style={{ width: '100%', background: `linear-gradient(90deg,${C.glow},${C.blue})` }} /></div>
        <span className="bv">{fmtF(tot)}</span>
        <span className="bw" style={{ color: C.amber }}>100%</span>
      </div>

      <div className="rb-foot">
        <span><b>ⓘ</b> Solo datos reales — tu composición actual. No mostramos evolución ni retornos porque
        aún no se guarda historial de tu patrimonio (solo el snapshot de hoy). El gráfico de evolución se
        activará cuando empecemos a snapshotear día a día. · cero cambios al motor</span>
      </div>
    </div>
  )
}
