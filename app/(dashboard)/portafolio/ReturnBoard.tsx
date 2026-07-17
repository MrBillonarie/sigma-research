'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { C } from '@/app/lib/constants'

// ─── Terminal Board · Retorno ────────────────────────────────────────────────
// Gráfico limpio del total (verde sobre el aporte inicial / rojo por debajo) +
// tablero de tenencias que se actualiza al mover el crosshair. Al pasar el mouse
// por una fuente se resalta la fila y se dibuja su curva sobre el gráfico.
// Solo front — misma data que el chart anterior. Cero cambios al motor.

interface Src { name: string; short: string; color: string; data: number[] }
interface Props { labels: string[]; total: number[]; sources: Src[] }

const F_DISP = "var(--font-bebas,'Bebas Neue',Impact,sans-serif)"

const fmt  = (v: number) => (v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'K' : '$' + Math.round(v))
const fmtF = (v: number) => '$' + Math.round(v).toLocaleString('es-CL')
const sgn  = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
const hexa = (h: string, a: number) => {
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}
function sparkPts(data: number[], w = 50, h = 16) {
  const mn = Math.min(...data), mx = Math.max(...data), rg = (mx - mn) || 1
  return data.map((v, i) => `${(i / (data.length - 1) * w).toFixed(1)},${(h - 1 - (v - mn) / rg * (h - 2)).toFixed(1)}`).join(' ')
}

function niceTicks(mn: number, mx: number) {
  const raw = (mx - mn) / 4
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  const nn = raw / p
  const s = nn <= 1 ? 1 : nn <= 2 ? 2 : nn <= 2.5 ? 2.5 : nn <= 5 ? 5 : 10
  const step = s * p
  const lo = Math.floor(mn / step) * step, hi = Math.ceil(mx / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + 1; v += step) ticks.push(v)
  return { lo, hi, ticks }
}

export default function ReturnBoard({ labels, total, sources }: Props) {
  const N = total.length
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hoverXRef = useRef(-1)
  const hoverSrcRef = useRef(-1)
  const rangeRef = useRef(Math.min(24, N))
  const [range, setRange] = useState(Math.min(24, N))
  const [activeK, setActiveK] = useState(N - 1)
  const [hoverSrc, setHoverSrc] = useState(-1)

  useEffect(() => { rangeRef.current = range }, [range])
  useEffect(() => { hoverSrcRef.current = hoverSrc }, [hoverSrc])

  // KPIs fijos sobre todo el rango disponible
  const kpi = useMemo(() => {
    const rets: number[] = []
    for (let k = 1; k < N; k++) rets.push((total[k] - total[k - 1]) / total[k - 1] * 100)
    return {
      ret: (total[N - 1] - total[0]) / total[0] * 100,
      best: rets.length ? Math.max(...rets) : 0,
      worst: rets.length ? Math.min(...rets) : 0,
      base: total[0],
    }
  }, [total, N])

  const sparks = useMemo(
    () => sources.map(s => sparkPts(s.data)),
    [sources]
  )
  const totalSpark = useMemo(() => sparkPts(total), [total])

  // ─── Loop de dibujo ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const DPR = Math.min(window.devicePixelRatio || 1, 2)

    let W = 0, H = 0
    const size = () => {
      const r = canvas.getBoundingClientRect()
      W = r.width || 860; H = +(canvas.getAttribute('height') || 300)
      canvas.width = W * DPR; canvas.height = H * DPR
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    size()
    const ro = new ResizeObserver(size); ro.observe(canvas)
    let visible = true
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting }, { threshold: 0.02 })
    io.observe(canvas)

    let anim = RM ? 1 : 0
    let curRange = rangeRef.current
    let lastK = -1
    let raf = 0

    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath(); ctx.moveTo(x + r, y)
      ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
    }

    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (!visible || !W) return
      if (rangeRef.current !== curRange) { curRange = rangeRef.current; anim = RM ? 1 : 0 }
      anim = RM ? 1 : Math.min(1, anim + 0.045)

      const PAD = { l: 12, r: 54, t: 14, b: 22 }
      const n = curRange, off = N - n
      const tot = total.slice(off), base = tot[0]
      const ph = H - PAD.t - PAD.b, pw = W - PAD.l - PAD.r
      const lo = Math.min(...tot, base), hi = Math.max(...tot, base), padv = (hi - lo) * 0.18 || 100
      const { lo: yLo, hi: yHi, ticks } = niceTicks(lo - padv, hi + padv)
      const X = (k: number) => PAD.l + (n <= 1 ? pw / 2 : pw * k / (n - 1))
      const Y = (v: number) => PAD.t + ph * (1 - (v - yLo) / (yHi - yLo))
      ctx.clearRect(0, 0, W, H)

      // grid + labels y
      ctx.font = '9px monospace'; ctx.textBaseline = 'middle'
      ticks.forEach(v => {
        const y = Y(v)
        ctx.strokeStyle = 'rgba(57,226,230,0.05)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y); ctx.stroke()
        ctx.fillStyle = C.muted; ctx.textAlign = 'left'; ctx.fillText(fmt(v), W - PAD.r + 7, y)
      })

      const yBase = Y(base), kMax = Math.floor((n - 1) * anim)

      // fills verde/rojo respecto al aporte inicial
      ;([['#2fd39a', true], ['#ff5d6c', false]] as [string, boolean][]).forEach(([color, topSide]) => {
        ctx.save(); ctx.beginPath()
        if (topSide) ctx.rect(0, 0, W, yBase); else ctx.rect(0, yBase, W, H - yBase)
        ctx.clip()
        ctx.beginPath(); ctx.moveTo(X(0), yBase)
        for (let k = 0; k <= kMax; k++) ctx.lineTo(X(k), Y(tot[k]))
        ctx.lineTo(X(kMax), yBase); ctx.closePath()
        const g = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + ph)
        g.addColorStop(0, hexa(color, 0.34)); g.addColorStop(1, hexa(color, 0.02))
        ctx.fillStyle = g; ctx.fill(); ctx.restore()
      })

      // break-even
      ctx.strokeStyle = 'rgba(142,163,181,0.45)'; ctx.lineWidth = 1; ctx.setLineDash([5, 4])
      ctx.beginPath(); ctx.moveTo(PAD.l, yBase); ctx.lineTo(W - PAD.r, yBase); ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = C.dimText; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.font = '8px monospace'
      ctx.fillText('break-even · aporte ' + fmt(base), PAD.l + 3, yBase - 3)

      // línea total, color por tramo
      for (let k = 1; k <= kMax; k++) {
        ctx.strokeStyle = (tot[k] >= base) ? C.glow : '#ff8a95'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(X(k - 1), Y(tot[k - 1])); ctx.lineTo(X(k), Y(tot[k])); ctx.stroke()
      }
      // glow
      ctx.save(); ctx.globalAlpha = 0.5; ctx.beginPath()
      for (let k = 0; k <= kMax; k++) { const x = X(k), y = Y(tot[k]); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y) }
      ctx.strokeStyle = C.glow; ctx.lineWidth = 2; ctx.shadowColor = C.glow; ctx.shadowBlur = 10; ctx.stroke()
      ctx.restore(); ctx.shadowBlur = 0

      // overlay de fuente al pasar por su fila del tablero
      const hs = hoverSrcRef.current
      if (hs >= 0 && sources[hs]) {
        const d = sources[hs].data.slice(off)
        const dmn = Math.min(...d), dmx = Math.max(...d), drg = (dmx - dmn) || 1
        ctx.beginPath()
        for (let k = 0; k < n; k++) {
          const x = X(k), y = PAD.t + ph * 0.60 + ph * 0.34 * (1 - (d[k] - dmn) / drg)
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y)
        }
        ctx.strokeStyle = sources[hs].color; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([])
        ctx.fillStyle = sources[hs].color; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '700 9px monospace'
        ctx.fillText(sources[hs].short + ' (forma)', PAD.l + 4, PAD.t + ph * 0.60 - 2)
      }

      // pico / valle
      if (anim >= 1) {
        const iMax = tot.indexOf(Math.max(...tot)), iMin = tot.indexOf(Math.min(...tot))
        ;([[iMax, '#2fd39a', 'pico'], [iMin, '#ff5d6c', 'valle']] as [number, string, string][]).forEach(([i, c, lb]) => {
          const x = X(i), y = Y(tot[i])
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill()
          ctx.fillStyle = c; ctx.textAlign = 'center'; ctx.textBaseline = lb === 'pico' ? 'bottom' : 'top'; ctx.font = '8px monospace'
          ctx.fillText(lb + ' ' + fmt(tot[i]), x, lb === 'pico' ? y - 7 : y + 7)
        })
      }

      // eje x
      ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = '8px monospace'
      const labs = labels.slice(off)
      const step = Math.max(1, Math.ceil(n / 7))
      for (let k = 0; k < n; k += step) ctx.fillText((labs[k] || '').slice(0, 3).toLowerCase(), X(k), H - PAD.b + 6)

      // endpoint HOY
      if (anim >= 1) {
        const ex = X(n - 1), ey = Y(tot[n - 1])
        const pu = RM ? 4 : 4 + Math.sin(performance.now() / 380) * 1.4
        ctx.fillStyle = 'rgba(94,234,240,0.18)'; ctx.beginPath(); ctx.arc(ex, ey, pu + 5, 0, 7); ctx.fill()
        ctx.fillStyle = C.glow; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, 7); ctx.fill()
        ctx.strokeStyle = C.bg; ctx.lineWidth = 1.5; ctx.stroke()
      }

      // crosshair → mes activo
      let k = n - 1
      if (hoverXRef.current >= 0) {
        k = Math.max(0, Math.min(n - 1, Math.round((hoverXRef.current - PAD.l) / pw * (n - 1))))
        const x = X(k), y = Y(tot[k]), up = tot[k] >= base
        ctx.strokeStyle = 'rgba(94,234,240,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
        ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + ph); ctx.stroke(); ctx.setLineDash([])
        ctx.fillStyle = up ? C.glow : '#ff8a95'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill()
        // tag de precio
        ctx.fillStyle = up ? C.glow : C.red; ctx.fillRect(W - PAD.r, y - 8, PAD.r, 16)
        ctx.fillStyle = C.bg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '700 9px monospace'
        ctx.fillText(fmt(tot[k]), W - PAD.r + 4, y)
        // tag de fecha
        const dl = (labs[k] || '')
        ctx.font = '9px monospace'; const dw = ctx.measureText(dl).width + 12
        ctx.fillStyle = C.border; ctx.fillRect(x - dw / 2, H - PAD.b + 2, dw, 15)
        ctx.fillStyle = C.dimText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(dl, x, H - PAD.b + 9.5)
        // chip % vs inicio
        const d0 = (tot[k] - base) / base * 100, chip = sgn(d0)
        ctx.font = '700 10px monospace'; const cwid = ctx.measureText(chip).width + 14
        let cxx = x + 8; if (cxx + cwid > W - PAD.r) cxx = x - cwid - 8
        ctx.fillStyle = up ? 'rgba(47,211,154,0.16)' : 'rgba(255,93,108,0.16)'
        rr(cxx, y - 20, cwid, 16, 4); ctx.fill()
        ctx.fillStyle = up ? C.green : C.red; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(chip, cxx + 7, y - 12)
      }
      // sincronizar tablero solo al cambiar de mes
      const globalK = (hoverXRef.current >= 0) ? off + k : N - 1
      if (globalK !== lastK) { lastK = globalK; setActiveK(globalK) }
    }
    raf = requestAnimationFrame(frame)

    const onMove = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); hoverXRef.current = e.clientX - r.left }
    const onLeave = () => { hoverXRef.current = -1 }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
      canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [total, sources, labels, N])

  // ─── Render ──────────────────────────────────────────────────────────────
  const tv = total[activeK]
  const d0 = (tv - total[0]) / total[0] * 100
  const isHoy = activeK === N - 1
  const dateLbl = isHoy ? 'SYNC · HOY' : (labels[activeK] || '')

  const ranges = ([[6, '6M'], [12, '1A'], [24, '24M']] as [number, string][]).filter(([m]) => m <= N)

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
        .rb-grid{display:grid;grid-template-columns:1fr 366px}
        @media(max-width:820px){.rb-grid{grid-template-columns:1fr}}
        .rb-chartcol{border-right:1px solid ${C.border};position:relative;min-width:0}
        @media(max-width:820px){.rb-chartcol{border-right:none;border-bottom:1px solid ${C.border}}}
        .rb-tf{display:flex;gap:4px;padding:8px 16px 2px}
        .rb-tf button{font-family:monospace;font-size:10px;letter-spacing:.1em;color:${C.dimText};cursor:pointer;background:transparent;
          border:1px solid ${C.border2};border-radius:6px;padding:4px 10px;transition:.15s}
        .rb-tf button:hover{color:${C.glow};border-color:rgba(57,226,230,.4)}
        .rb-tf button.on{color:${C.bg};background:linear-gradient(100deg,${C.glow},${C.blue});border-color:transparent;font-weight:600}
        .rb-canvas{display:block;width:100%;height:300px}
        .rb-bh,.rb-row{display:grid;grid-template-columns:14px 1fr 50px 72px 56px;gap:8px;align-items:center;padding:9px 14px}
        .rb-bh{border-bottom:1px solid ${C.border};font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:${C.muted}}
        .rb-bh .r{text-align:right}
        .rb-row{border-bottom:1px solid rgba(24,34,49,.6);transition:background .12s;cursor:default}
        .rb-row:hover,.rb-row.on{background:rgba(57,226,230,.06)}
        .rb-row i{width:9px;height:9px;border-radius:2px}
        .rb-row .bn{font-size:11px;color:${C.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.04em}
        .rb-row .bs{display:flex;justify-content:center}
        .rb-row .bv{text-align:right;font-size:11.5px;color:${C.text};font-variant-numeric:tabular-nums}
        .rb-row .bd{text-align:right;font-size:11px;font-variant-numeric:tabular-nums}
        .rb-row.total{background:rgba(255,180,84,.05);border-top:1px solid ${C.border}}
        .rb-row.total .bn{color:${C.amber}} .rb-row.total .bv{color:${C.glow};font-weight:600}
        .rb-kpis{display:flex;gap:0;padding:8px 16px 0;flex-wrap:wrap}
        .rb-kpi{padding:6px 16px 6px 0;margin-right:16px;border-right:1px solid ${C.border}}
        .rb-kpi:last-child{border-right:none}
        .rb-kpi .kl{font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:${C.muted}}
        .rb-kpi .kv{font-size:13px;color:${C.text};font-variant-numeric:tabular-nums;margin-top:2px}
        .rb-foot{display:flex;gap:14px;padding:8px 14px;border-top:1px solid ${C.border};font-size:9.5px;color:${C.muted};
          letter-spacing:.08em;flex-wrap:wrap;background:linear-gradient(90deg,rgba(57,226,230,.03),transparent);font-family:monospace}
        .rb-foot b{color:${C.dimText};font-weight:400}
      `}</style>

      <div className="rb-cmd">
        <span className="go">SQUANT<b>GO</b></span>
        <span className="fn">PORT · Return</span>
        <span className="fn">{ranges.find(([m]) => m === range)?.[1] ?? '24M'}</span>
        <span className="fn">USD</span>
        <span className="live">{dateLbl}</span>
      </div>

      <div className="rb-grid">
        <div className="rb-chartcol">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '13px 16px 0', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: F_DISP, fontSize: 36, lineHeight: 0.9, letterSpacing: '0.02em', background: `linear-gradient(135deg,${C.glow},${C.gold})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{fmt(tv)}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: d0 >= 0 ? C.green : C.red }}>{sgn(d0)} vs inicio</span>
            <span style={{ fontSize: 11, color: C.dimText }}>· {(tv - total[0] >= 0 ? '+' : '−') + fmtF(Math.abs(tv - total[0])).slice(1)} ganancia</span>
            <span style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.muted, marginLeft: 'auto' }}>{isHoy ? 'últ. valor' : (labels[activeK] || '')}</span>
          </div>
          <div className="rb-kpis">
            <div className="rb-kpi"><div className="kl">Retorno total</div><div className="kv" style={{ color: kpi.ret >= 0 ? C.green : C.red }}>{sgn(kpi.ret)}</div></div>
            <div className="rb-kpi"><div className="kl">Mejor mes</div><div className="kv" style={{ color: C.green }}>{sgn(kpi.best)}</div></div>
            <div className="rb-kpi"><div className="kl">Peor mes</div><div className="kv" style={{ color: C.red }}>{sgn(kpi.worst)}</div></div>
            <div className="rb-kpi"><div className="kl">Aporte inicial</div><div className="kv">{fmt(kpi.base)}</div></div>
          </div>
          <div className="rb-tf">
            {ranges.map(([m, lbl]) => (
              <button key={m} className={range === m ? 'on' : ''} onClick={() => setRange(m)}>{lbl}</button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <canvas ref={canvasRef} height={300} className="rb-canvas" />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="rb-bh"><span /><span>Fuente</span><span className="r">Hist.</span><span className="r">Valor</span><span className="r">Δ inicio</span></div>
          {sources.map((s, j) => {
            const d = (s.data[activeK] - s.data[0]) / s.data[0] * 100
            return (
              <div key={s.name} className={`rb-row${hoverSrc === j ? ' on' : ''}`}
                onMouseEnter={() => setHoverSrc(j)} onMouseLeave={() => setHoverSrc(-1)}>
                <i style={{ background: s.color }} />
                <span className="bn">{s.short}</span>
                <span className="bs"><svg width="50" height="16" viewBox="0 0 50 16"><polyline points={sparks[j]} fill="none" stroke={s.color} strokeWidth={1.3} /></svg></span>
                <span className="bv">{fmtF(s.data[activeK])}</span>
                <span className="bd" style={{ color: d >= 0 ? C.green : C.red }}>{(d >= 0 ? '▲' : '▼') + Math.abs(d).toFixed(1)}</span>
              </div>
            )
          })}
          <div className="rb-row total">
            <i style={{ background: C.glow }} />
            <span className="bn">TOTAL</span>
            <span className="bs"><svg width="50" height="16" viewBox="0 0 50 16"><polyline points={totalSpark} fill="none" stroke={C.glow} strokeWidth={1.5} /></svg></span>
            <span className="bv">{fmtF(tv)}</span>
            <span className="bd" style={{ color: d0 >= 0 ? C.green : C.red }}>{(d0 >= 0 ? '▲' : '▼') + Math.abs(d0).toFixed(1)}</span>
          </div>
        </div>
      </div>

      <div className="rb-foot"><b>F1</b> 6M <b>F2</b> 1A <b>F3</b> 24M · <b>⟳</b> curva estimada hasta sync · base USD equiv. · cero cambios al motor</div>
    </div>
  )
}
