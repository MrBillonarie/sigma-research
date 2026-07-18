'use client'
import { useEffect, useRef } from 'react'
import { C } from '@/app/lib/constants'

// ─── RiskDial — dial de riesgo (velocímetro) + donut de anillos ──────────────
// Resultado del quiz de perfil: la aguja apunta a tu perfil (Conservador→
// Agresivo) y los anillos concéntricos muestran la allocation recomendada.
// Solo front, cero cambios al motor.

interface Alloc { name: string; color: string; rec: number }
interface Props { profile: string; label: string; allocation: Alloc[] }

const SCORE: Record<string, number> = { conservador: 0.16, moderado: 0.5, agresivo: 0.84 }
const mixc = (a: string, b: string, t: number) => {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)]
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)]
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`
}

export default function RiskDial({ profile, label, allocation }: Props) {
  const dialRef = useRef<HTMLCanvasElement>(null)
  const donutRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const dcv = dialRef.current, ocv = donutRef.current
    if (!dcv || !ocv) return
    const dc = dcv.getContext('2d'), oc = ocv.getContext('2d')
    if (!dc || !oc) return
    const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    const target = SCORE[profile] ?? 0.5
    const UP = label.toUpperCase()

    const fit = (cv: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      const r = cv.getBoundingClientRect()
      const w = r.width || 280, h = +(cv.getAttribute('height') || 220)
      cv.width = w * DPR; cv.height = h * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      ;(cv as HTMLCanvasElement & { _w: number; _h: number })._w = w
      ;(cv as HTMLCanvasElement & { _w: number; _h: number })._h = h
    }
    const dim = (cv: HTMLCanvasElement) => cv as HTMLCanvasElement & { _w: number; _h: number }
    fit(dcv, dc); fit(ocv, oc)
    const ro = new ResizeObserver(() => { fit(dcv, dc); fit(ocv, oc) }); ro.observe(dcv); ro.observe(ocv)
    let visible = true
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting }, { threshold: 0.02 })
    io.observe(dcv)

    let cur = 0, sweep = RM ? 1 : 0, raf = 0

    const drawDial = (W: number, H: number) => {
      dc.clearRect(0, 0, W, H)
      const cx = W / 2, cy = H * 0.82, r = Math.min(W * 0.42, H * 0.72), a0 = Math.PI, a1 = Math.PI * 2
      const seg = 64
      for (let i = 0; i < seg; i++) {
        const t0 = a0 + (a1 - a0) * i / seg, t1 = a0 + (a1 - a0) * (i + 1) / seg, f = i / seg
        const col = f < 0.5 ? mixc('#2fd39a', '#39e2e6', f / 0.5) : mixc('#39e2e6', '#ff5d6c', (f - 0.5) / 0.5)
        dc.strokeStyle = col; dc.lineWidth = 14; dc.beginPath(); dc.arc(cx, cy, r, t0, t1); dc.stroke()
      }
      for (let k = 0; k <= 10; k++) {
        const a = a0 + (a1 - a0) * k / 10
        dc.strokeStyle = 'rgba(4,6,11,0.5)'; dc.lineWidth = k % 5 === 0 ? 2 : 1
        dc.beginPath(); dc.moveTo(cx + Math.cos(a) * (r - 7), cy + Math.sin(a) * (r - 7)); dc.lineTo(cx + Math.cos(a) * (r + 7), cy + Math.sin(a) * (r + 7)); dc.stroke()
      }
      const an = a0 + (a1 - a0) * cur
      dc.save(); dc.translate(cx, cy); dc.rotate(an)
      dc.fillStyle = '#eaf6ff'; dc.shadowColor = '#5eeaf0'; dc.shadowBlur = 10
      dc.beginPath(); dc.moveTo(-8, 0); dc.lineTo(r - 4, -2.5); dc.lineTo(r - 4, 2.5); dc.closePath(); dc.fill(); dc.restore(); dc.shadowBlur = 0
      dc.fillStyle = '#0b1017'; dc.beginPath(); dc.arc(cx, cy, 8, 0, 7); dc.fill(); dc.strokeStyle = '#5eeaf0'; dc.lineWidth = 1.5; dc.stroke()
      dc.fillStyle = '#2fd39a'; dc.font = '9px monospace'; dc.textAlign = 'left'; dc.textBaseline = 'top'; dc.fillText('CONSERVADOR', cx - r, cy + 12)
      dc.fillStyle = '#ff5d6c'; dc.textAlign = 'right'; dc.fillText('AGRESIVO', cx + r, cy + 12)
      dc.fillStyle = '#5eeaf0'; dc.textAlign = 'center'; dc.textBaseline = 'alphabetic'; dc.font = "700 26px 'Bebas Neue',Impact,sans-serif"; dc.fillText(UP, cx, cy - 24)
      dc.fillStyle = '#7b8698'; dc.font = '9px monospace'; dc.fillText('perfil de riesgo', cx, cy - 9)
    }

    const drawDonut = (W: number, H: number) => {
      oc.clearRect(0, 0, W, H)
      const cx = W / 2, cy = H / 2 - 2, lw = 11, gapR = 5, R0 = Math.min(W, H) * 0.36
      allocation.forEach((a, i) => {
        const r = R0 - i * (lw + gapR)
        if (r < 6) return
        oc.strokeStyle = 'rgba(120,150,175,0.10)'; oc.lineWidth = lw; oc.lineCap = 'round'
        oc.beginPath(); oc.arc(cx, cy, r, 0, 7); oc.stroke()
        oc.save(); oc.shadowColor = a.color; oc.shadowBlur = 9; oc.strokeStyle = a.color; oc.lineWidth = lw; oc.lineCap = 'round'
        oc.beginPath(); oc.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (a.rec / 100) * sweep); oc.stroke(); oc.restore()
      })
      oc.fillStyle = '#dff6fb'; oc.textAlign = 'center'; oc.textBaseline = 'alphabetic'; oc.font = '8px monospace'; oc.fillText(UP, cx, cy - 4)
      oc.fillStyle = '#5eeaf0'; oc.font = "700 16px 'Bebas Neue',Impact,sans-serif"; oc.fillText(`${allocation.length} CLASES`, cx, cy + 14)
    }

    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (!visible) return
      cur += (target - cur) * (RM ? 1 : 0.06)
      sweep = RM ? 1 : Math.min(1, sweep + 0.03)
      const d = dim(dcv), o = dim(ocv)
      if (d._w) drawDial(d._w, d._h)
      if (o._w) drawDonut(o._w, o._h)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [profile, label, allocation])

  return (
    <div>
      <style>{`
        .rd-cmd{display:flex;align-items:center;gap:14px;padding:10px 16px;border-bottom:1px solid ${C.border};
          background:linear-gradient(90deg,rgba(255,180,84,.06),rgba(255,255,255,.012) 40%);flex-wrap:wrap;font-size:11px;font-family:monospace}
        .rd-cmd .go{color:${C.amber}} .rd-cmd .go b{color:${C.bg};background:${C.amber};padding:1px 6px;border-radius:3px;font-weight:700;margin-left:2px}
        .rd-cmd .fn{color:${C.dimText};letter-spacing:.12em;text-transform:uppercase;font-size:10px}
        .rd-cmd .badge{margin-left:auto;font-size:10px;letter-spacing:.18em;padding:3px 12px;border-radius:20px;border:1px solid ${C.gold};color:${C.gold}}
        .rd-grid{display:grid;grid-template-columns:1fr 288px}
        @media(max-width:680px){.rd-grid{grid-template-columns:1fr}.rd-donutcol{border-left:none!important;border-top:1px solid ${C.border}}}
        .rd-dialcol{position:relative}
        .rd-donutcol{position:relative;border-left:1px solid ${C.border};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px}
        .rd-cv{display:block;width:100%;height:220px}
        .rd-donutcol .rd-cv{max-width:250px}
        .rd-leg{display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;margin-top:8px;font-size:10px;color:${C.dimText}}
        .rd-leg span{display:inline-flex;align-items:center;gap:5px}
        .rd-leg i{width:8px;height:8px;border-radius:2px}
        .rd-leg b{color:${C.text};font-weight:400;font-variant-numeric:tabular-nums}
      `}</style>
      <div className="rd-cmd">
        <span className="go">SQUANT<b>GO</b></span>
        <span className="fn">Perfil · Gauge</span>
        <span className="badge">{label.toUpperCase()}</span>
      </div>
      <div className="rd-grid">
        <div className="rd-dialcol"><canvas ref={dialRef} height={220} className="rd-cv" /></div>
        <div className="rd-donutcol">
          <canvas ref={donutRef} height={220} className="rd-cv" />
          <div className="rd-leg">
            {allocation.map(a => (
              <span key={a.name}><i style={{ background: a.color }} />{a.name} <b>{a.rec}%</b></span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
