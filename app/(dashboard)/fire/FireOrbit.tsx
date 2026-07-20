'use client'
import { useEffect, useRef } from 'react'
import { C } from '@/app/lib/constants'
import { fmt, fmtK } from '@/app/lib/format'

// ─── FIRE · Órbita de Escape ─────────────────────────────────────────────────
// Reemplaza el camino plano en perspectiva: tu capital como nave en
// trayectoria de escape hacia el planeta "Libertad". Mismos hitos 25/50/75%
// + meta que el camino anterior, mismo lenguaje de compuertas pero en 3D.

interface Props {
  progress: number   // 0-100, ya clampeado por el padre
  color: string       // color del modo activo (solo tiñe el % del label)
  capital: number
  target: number
}

const FF = "ui-monospace,'DM Mono',monospace"
const kFmt = (v: number) => (v >= 1_000_000 ? '$' + (v / 1e6).toFixed(2) + 'M' : v >= 1000 ? '$' + Math.round(v / 1000) + 'K' : '$' + Math.round(v))
const hexa = (h: string, a: number) => {
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}
type Pt = { x: number; y: number }
function bezier(A: Pt, B: Pt, c1: Pt, c2: Pt) {
  return (u: number): Pt => ({
    x: (1 - u) ** 3 * A.x + 3 * (1 - u) ** 2 * u * c1.x + 3 * (1 - u) * u * u * c2.x + u ** 3 * B.x,
    y: (1 - u) ** 3 * A.y + 3 * (1 - u) ** 2 * u * c1.y + 3 * (1 - u) * u * u * c2.y + u ** 3 * B.y,
  })
}
function tangentNormal(path: (u: number) => Pt, u: number) {
  const d = 0.001, p0 = path(Math.max(0, u - d)), p1 = path(Math.min(1, u + d))
  const dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.hypot(dx, dy) || 1
  return { ang: Math.atan2(dy, dx), nx: -dy / len, ny: dx / len }
}

export default function FireOrbit({ progress, color, capital, target }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = canvas.getContext('2d')
    if (!c) return
    const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0, H = 0
    const size = () => {
      const r = canvas.getBoundingClientRect()
      W = r.width || 700; H = +(canvas.getAttribute('height') || 280)
      canvas.width = W * DPR; canvas.height = H * DPR; c.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    size()
    const ro = new ResizeObserver(size); ro.observe(canvas)
    let visible = true
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting }, { threshold: 0.02 })
    io.observe(canvas)
    let raf = 0

    const draw = (t: number) => {
      if (!W) return
      const prog = Math.min(Math.max(progress, 0), 100)
      c.clearRect(0, 0, W, H)
      c.fillStyle = '#03050a'; c.fillRect(0, 0, W, H)
      const gr = H * 0.24, gx = W - gr * 3.0, gy = H * 0.36
      const A: Pt = { x: 40, y: H - 30 }, B: Pt = { x: gx - gr * 0.75, y: gy + gr * 0.55 }
      const path = bezier(A, B, { x: W * 0.20, y: H - 10 }, { x: W * 0.56, y: H * 0.20 })

      const neb1 = c.createRadialGradient(W * 0.12, H * 0.85, 4, W * 0.12, H * 0.85, W * 0.4)
      neb1.addColorStop(0, 'rgba(79,146,255,.09)'); neb1.addColorStop(1, 'transparent'); c.fillStyle = neb1; c.fillRect(0, 0, W, H)
      const neb2 = c.createRadialGradient(gx, gy, 4, gx, gy, W * 0.32)
      neb2.addColorStop(0, 'rgba(233,196,106,.11)'); neb2.addColorStop(1, 'transparent'); c.fillStyle = neb2; c.fillRect(0, 0, W, H)
      for (let k = 0; k < 80; k++) {
        const x = (k * 53.7) % W, y = (k * 97.3) % (H - 6), seed = (k * 13) % 7
        const tw = RM ? 0.85 : 0.55 + Math.sin(t * 1.3 + seed) * 0.35
        c.fillStyle = hexa('#dff6fb', (0.08 + (k % 4) * 0.05) * tw); c.beginPath(); c.arc(x, y, (k % 3) * 0.5 + 0.5, 0, 7); c.fill()
      }

      const hl = c.createRadialGradient(gx, gy, 4, gx, gy, gr * 2.0)
      hl.addColorStop(0, hexa('#e9c46a', .26)); hl.addColorStop(1, 'transparent'); c.fillStyle = hl; c.beginPath(); c.arc(gx, gy, gr * 2.0, 0, 7); c.fill()

      c.save(); c.translate(gx, gy); c.rotate(-0.42)
      c.strokeStyle = hexa('#5eeaf0', .3); c.lineWidth = 2.2; c.setLineDash([2, 4])
      c.beginPath(); c.ellipse(0, 0, gr * 2.0, gr * 0.62, 0, Math.PI, Math.PI * 2); c.stroke(); c.setLineDash([]); c.restore()

      const bd = c.createRadialGradient(gx - gr * .4, gy - gr * .4, 2, gx, gy, gr)
      bd.addColorStop(0, '#f8ecc6'); bd.addColorStop(.45, '#e9c46a'); bd.addColorStop(.8, '#a97f2e'); bd.addColorStop(1, '#5c4114')
      c.fillStyle = bd; c.beginPath(); c.arc(gx, gy, gr, 0, 7); c.fill()
      c.save(); c.beginPath(); c.arc(gx, gy, gr, 0, 7); c.clip()
      ;([[-.5, .14], [.15, .10], [.55, .08]] as [number, number][]).forEach(([dy, al]) => {
        c.strokeStyle = hexa('#5c4114', al); c.lineWidth = 4; c.beginPath(); c.ellipse(gx, gy + gr * dy, gr * 1.05, gr * 0.24, 0, 0, 7); c.stroke()
      })
      c.fillStyle = hexa('#03050a', .28); c.beginPath(); c.arc(gx + gr * .42, gy + gr * .32, gr * 0.82, 0, 7); c.fill()
      c.restore()
      c.strokeStyle = hexa('#fff2d0', .45); c.lineWidth = 1.3; c.beginPath(); c.arc(gx, gy, gr, 0, 7); c.stroke()

      c.save(); c.translate(gx, gy); c.rotate(-0.42)
      c.strokeStyle = hexa('#bff4fb', .7); c.lineWidth = 2.2; c.beginPath(); c.ellipse(0, 0, gr * 2.0, gr * 0.62, 0, 0, Math.PI); c.stroke()
      c.strokeStyle = hexa('#5eeaf0', .24); c.lineWidth = 5.5; c.beginPath(); c.ellipse(0, 0, gr * 2.0, gr * 0.62, 0, 0, Math.PI); c.stroke()
      c.restore()

      c.fillStyle = '#f6e6b8'; c.font = '700 11px ' + FF; c.textAlign = 'center'; c.textBaseline = 'top'
      c.fillText('LIBERTAD · ' + kFmt(target), gx, gy + gr + 14)

      c.strokeStyle = hexa('#8ea3b5', .35); c.lineWidth = 1.2; c.beginPath(); c.moveTo(A.x - 16, A.y + 3); c.lineTo(A.x + 16, A.y + 3); c.stroke()
      c.fillStyle = hexa('#8ea3b5', .85); c.font = '700 9px ' + FF; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('hoy ' + kFmt(capital), A.x - 16, A.y + 8)

      c.beginPath(); for (let u = 0; u <= 1; u += 0.02) { const p = path(u); if (u) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y) }
      c.strokeStyle = hexa('#5eeaf0', .06); c.lineWidth = 11; c.stroke()
      c.beginPath(); for (let u = 0; u <= 1; u += 0.02) { const p = path(u); if (u) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y) }
      c.strokeStyle = hexa('#5eeaf0', .28); c.setLineDash([6, 5]); c.lineWidth = 1.6; c.stroke(); c.setLineDash([])
      c.beginPath(); for (let u = 0; u <= prog / 100; u += 0.02) { const p = path(u); if (u) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y) }
      c.strokeStyle = '#5eeaf0'; c.lineWidth = 2.6; c.shadowColor = '#5eeaf0'; c.shadowBlur = 10; c.stroke(); c.shadowBlur = 0

      ;([0.25, 0.5, 0.75] as number[]).forEach(ms => {
        const p = path(ms), lit = prog / 100 >= ms
        c.save(); if (lit) { c.shadowColor = '#5eeaf0'; c.shadowBlur = 8 }
        c.strokeStyle = lit ? hexa('#5eeaf0', .9) : hexa('#3a4a5a', .75); c.lineWidth = 1.6; c.beginPath(); c.arc(p.x, p.y, 3.8, 0, 7); c.stroke()
        c.restore()
        c.fillStyle = lit ? '#dff6fb' : '#5b6a78'; c.font = '700 9px ' + FF; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText((ms * 100) + '%', p.x, p.y - 8)
      })

      if (!RM) {
        c.save(); c.globalCompositeOperation = 'lighter'
        for (let q = 1; q <= 12; q++) {
          const p = path(Math.max(0, prog / 100 - q * 0.010)); c.globalAlpha = (1 - q / 12) * 0.5
          c.fillStyle = '#5eeaf0'; c.beginPath(); c.arc(p.x, p.y, 3 * (1 - q / 12) + 0.7, 0, 7); c.fill()
        }
        c.restore(); c.globalAlpha = 1
      }

      const u0 = prog / 100, tn = tangentNormal(path, u0), me = path(u0)
      c.fillStyle = hexa('#eafcff', .24); c.beginPath(); c.arc(me.x, me.y, 11, 0, 7); c.fill()
      c.save(); c.translate(me.x, me.y); c.rotate(tn.ang)
      c.fillStyle = '#eafcff'; c.beginPath(); c.moveTo(9, 0); c.lineTo(-5.5, 5); c.lineTo(-2, 0); c.lineTo(-5.5, -5); c.closePath(); c.fill()
      c.strokeStyle = '#5eeaf0'; c.lineWidth = 1.2; c.stroke(); c.restore()
    }

    if (RM) {
      draw(0)
    } else {
      const frame = () => { raf = requestAnimationFrame(frame); if (visible) draw(performance.now() / 1000) }
      raf = requestAnimationFrame(frame)
    }
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [progress, capital, target])

  const pct = Math.min(Math.max(progress, 0), 100)

  return (
    <div style={{ padding: '18px 18px 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>TU CAMINO A LA LIBERTAD</span>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color }}>{pct.toFixed(1)}%</span>
      </div>
      <canvas ref={canvasRef} height={280} style={{ display: 'block', width: '100%' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 10, color: C.muted, marginTop: 2 }}>
        <span>{fmt(capital)}</span><span>Meta: {fmtK(target)}</span>
      </div>
    </div>
  )
}
