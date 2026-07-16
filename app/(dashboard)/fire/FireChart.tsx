'use client'
import { useEffect, useRef } from 'react'
import { C } from '@/app/lib/constants'

// Montaña de capital 3D — reemplaza la línea Chart.js por un canvas propio:
// el área bajo la curva de capital se extruye en oblicuo (mismo lenguaje 3D
// de las velas del hero), se dibuja progresivamente al mover cualquier slider,
// la meta es la línea de cumbre y el Año FIRE una compuerta verde con bandera.
// El tooltip por año se conserva (hover → capital exacto y % de la meta).


const fmtV = (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1e3).toFixed(0)}K`

interface Props { labels: string[]; acum: number[]; target: number; fireYear: number | null; capital: number }

const MARGIN = { l: 64, r: 20, t: 30, b: 30 }
const DEPTH_X = 9
const DEPTH_Y = -6
const REVEAL_MS = 1100

function ease(p: number) { return 1 - Math.pow(1 - Math.min(Math.max(p, 0), 1), 3) }

export default function FireChart({ acum, target, fireYear, capital }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hoverRef  = useRef<number | null>(null)
  const dataRef   = useRef({ acum, target, fireYear, capital })
  const startRef  = useRef(0)

  // Datos nuevos (slider movido) → re-lanzar el dibujo progresivo
  useEffect(() => {
    dataRef.current = { acum, target, fireYear, capital }
    startRef.current = typeof performance !== 'undefined' ? performance.now() : 0
  }, [acum, target, fireYear, capital])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let visible = true
    let W = 0, H = 0

    function resize() {
      if (!cv) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = cv.clientWidth
      H = cv.clientHeight
      cv.width  = Math.round(W * dpr)
      cv.height = Math.round(H * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(cv)
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting }, { threshold: 0.05 })
    io.observe(cv)

    function scene(now: number) {
      const { acum: A, target: T, fireYear: FY, capital: CAP } = dataRef.current
      const n = A.length
      if (n < 2 || W === 0) return
      const p = reduced ? 1 : ease((now - startRef.current) / REVEAL_MS)
      const pulse = reduced ? 0 : Math.sin(now / 480)

      const L = MARGIN.l, R = W - MARGIN.r, TP = MARGIN.t, B = H - MARGIN.b
      const maxV = Math.max(T * 1.14, ...A)
      const xs = (i: number) => L + (i / (n - 1)) * (R - L)
      const ys = (v: number) => TP + (1 - v / maxV) * (B - TP)

      ctx!.clearRect(0, 0, W, H)

      // ── Grid + ejes ──
      ctx!.font = '9px monospace'
      ctx!.textAlign = 'right'
      for (let g = 1; g <= 4; g++) {
        const v = (maxV / 4) * g
        const y = ys(v)
        ctx!.strokeStyle = 'rgba(57,226,230,0.06)'
        ctx!.lineWidth = 1
        ctx!.setLineDash([3, 5])
        ctx!.beginPath(); ctx!.moveTo(L, y); ctx!.lineTo(R, y); ctx!.stroke()
        ctx!.setLineDash([])
        ctx!.fillStyle = C.dimText
        ctx!.fillText(fmtV(v), L - 8, y + 3)
      }
      // Eje X: años cada ~5
      ctx!.textAlign = 'center'
      const step = Math.max(1, Math.ceil((n - 1) / 10))
      for (let i = 0; i < n; i += step) {
        ctx!.fillStyle = C.dimText
        ctx!.fillText(String(i), xs(i), B + 16)
      }
      // Base
      ctx!.strokeStyle = C.border
      ctx!.beginPath(); ctx!.moveTo(L, B); ctx!.lineTo(R, B); ctx!.stroke()

      // ── Montaña con reveal progresivo (clip por ancho) ──
      const revealX = L + p * (R - L)
      ctx!.save()
      ctx!.beginPath(); ctx!.rect(L - 2, 0, revealX - L + 4, H); ctx!.clip()

      // Cara trasera (offset de profundidad, más oscura)
      ctx!.beginPath()
      ctx!.moveTo(xs(0) + DEPTH_X, B + DEPTH_Y)
      for (let i = 0; i < n; i++) ctx!.lineTo(xs(i) + DEPTH_X, ys(A[i]) + DEPTH_Y)
      ctx!.lineTo(xs(n - 1) + DEPTH_X, B + DEPTH_Y)
      ctx!.closePath()
      ctx!.fillStyle = 'rgba(90,72,18,0.5)'
      ctx!.fill()

      // Cinta superior (cara que "recibe la luz": une cresta frontal y trasera)
      ctx!.beginPath()
      ctx!.moveTo(xs(0), ys(A[0]))
      for (let i = 1; i < n; i++) ctx!.lineTo(xs(i), ys(A[i]))
      for (let i = n - 1; i >= 0; i--) ctx!.lineTo(xs(i) + DEPTH_X, ys(A[i]) + DEPTH_Y)
      ctx!.closePath()
      ctx!.fillStyle = 'rgba(240,204,90,0.30)'
      ctx!.fill()

      // Cara lateral derecha
      ctx!.beginPath()
      ctx!.moveTo(xs(n - 1), ys(A[n - 1]))
      ctx!.lineTo(xs(n - 1) + DEPTH_X, ys(A[n - 1]) + DEPTH_Y)
      ctx!.lineTo(xs(n - 1) + DEPTH_X, B + DEPTH_Y)
      ctx!.lineTo(xs(n - 1), B)
      ctx!.closePath()
      ctx!.fillStyle = 'rgba(140,112,30,0.38)'
      ctx!.fill()

      // Cara frontal (ladera) con gradiente
      const grad = ctx!.createLinearGradient(0, TP, 0, B)
      grad.addColorStop(0, 'rgba(57,226,230,0.34)')
      grad.addColorStop(1, 'rgba(57,226,230,0.03)')
      ctx!.beginPath()
      ctx!.moveTo(xs(0), B)
      for (let i = 0; i < n; i++) ctx!.lineTo(xs(i), ys(A[i]))
      ctx!.lineTo(xs(n - 1), B)
      ctx!.closePath()
      ctx!.fillStyle = grad
      ctx!.fill()

      // Cresta frontal — contenida antes del Año FIRE, plena después
      const splitAt = FY !== null ? Math.min(FY, n - 1) : n - 1
      const strokeCrest = (from: number, to: number, color: string, width: number, blur: number) => {
        if (to <= from) return
        ctx!.save()
        ctx!.shadowColor = C.gold
        ctx!.shadowBlur = blur
        ctx!.strokeStyle = color
        ctx!.lineWidth = width
        ctx!.lineJoin = 'round'
        ctx!.beginPath()
        ctx!.moveTo(xs(from), ys(A[from]))
        for (let i = from + 1; i <= to; i++) ctx!.lineTo(xs(i), ys(A[i]))
        ctx!.stroke()
        ctx!.restore()
      }
      strokeCrest(0, splitAt, 'rgba(57,226,230,0.62)', 2, 6)
      if (FY !== null) strokeCrest(splitAt, n - 1, C.glow, 2.4, 12)

      ctx!.restore() // fin clip reveal

      // ── Línea de cumbre (meta) ──
      const ty = ys(T)
      ctx!.strokeStyle = 'rgba(57,226,230,0.45)'
      ctx!.lineWidth = 1
      ctx!.setLineDash([7, 5])
      ctx!.beginPath(); ctx!.moveTo(L, ty); ctx!.lineTo(R, ty); ctx!.stroke()
      ctx!.setLineDash([])
      // Chip de meta
      const metaTxt = `META ${fmtV(T)}`
      ctx!.font = '600 9px monospace'
      const mw = ctx!.measureText(metaTxt).width + 12
      const mx = R - mw, my = ty - 9
      ctx!.fillStyle = 'rgba(11,13,20,0.92)'
      ctx!.fillRect(mx, my, mw, 16)
      ctx!.strokeStyle = 'rgba(57,226,230,0.4)'
      ctx!.strokeRect(mx + 0.5, my + 0.5, mw - 1, 15)
      ctx!.fillStyle = C.gold
      ctx!.textAlign = 'left'
      ctx!.fillText(metaTxt, mx + 6, my + 11)

      // ── Compuerta + bandera del Año FIRE ──
      if (FY !== null && FY < n) {
        const gAlpha = ease((p - 0.8) / 0.2)
        if (gAlpha > 0) {
          const gx = xs(FY)
          const gy = ys(A[FY])
          ctx!.save()
          ctx!.globalAlpha = gAlpha
          // compuerta vertical con gradiente
          const gGrad = ctx!.createLinearGradient(0, TP, 0, B)
          gGrad.addColorStop(0, 'rgba(52,211,153,0.55)')
          gGrad.addColorStop(1, 'rgba(52,211,153,0.05)')
          ctx!.strokeStyle = gGrad
          ctx!.lineWidth = 1.5
          ctx!.setLineDash([4, 4])
          ctx!.beginPath(); ctx!.moveTo(gx, TP); ctx!.lineTo(gx, B); ctx!.stroke()
          ctx!.setLineDash([])
          // glow en la base de la compuerta
          ctx!.save()
          ctx!.shadowColor = C.green
          ctx!.shadowBlur = 14
          ctx!.fillStyle = C.green
          ctx!.beginPath(); ctx!.arc(gx, gy, 4.5, 0, Math.PI * 2); ctx!.fill()
          ctx!.restore()
          // bandera plantada
          const poleH = 26
          ctx!.strokeStyle = C.green
          ctx!.lineWidth = 1.6
          ctx!.beginPath(); ctx!.moveTo(gx, gy); ctx!.lineTo(gx, gy - poleH); ctx!.stroke()
          ctx!.fillStyle = C.green
          ctx!.beginPath()
          ctx!.moveTo(gx, gy - poleH)
          ctx!.lineTo(gx + 14 + pulse * 1.2, gy - poleH + 4.5)
          ctx!.lineTo(gx, gy - poleH + 9)
          ctx!.closePath()
          ctx!.fill()
          // etiqueta
          ctx!.font = '600 9px monospace'
          ctx!.textAlign = gx > W - 90 ? 'right' : 'left'
          ctx!.fillStyle = C.green
          ctx!.fillText(`AÑO FIRE · ${FY}`, gx > W - 90 ? gx - 8 : gx + 8, TP + 12)
          ctx!.restore()
        }
      }

      // ── "Estás aquí" — pulso en el año 0 ──
      const sx = xs(0), sy = ys(CAP)
      ctx!.save()
      ctx!.strokeStyle = `rgba(57,226,230,${0.35 - pulse * 0.15})`
      ctx!.lineWidth = 1.5
      ctx!.beginPath(); ctx!.arc(sx, sy, 7 + pulse * 2.5, 0, Math.PI * 2); ctx!.stroke()
      ctx!.shadowColor = C.gold
      ctx!.shadowBlur = 10
      ctx!.fillStyle = C.glow
      ctx!.beginPath(); ctx!.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx!.fill()
      ctx!.restore()
      ctx!.font = '600 10px monospace'
      ctx!.textAlign = 'left'
      ctx!.fillStyle = C.gold
      ctx!.fillText('ESTÁS AQUÍ', sx + 12, Math.max(sy - 10, TP + 12))

      // ── Crosshair + tooltip ──
      const hi = hoverRef.current
      if (hi !== null && hi >= 0 && hi < n) {
        const hx = xs(hi), hv = A[hi], hy = ys(hv)
        ctx!.strokeStyle = 'rgba(232,233,240,0.14)'
        ctx!.lineWidth = 1
        ctx!.beginPath(); ctx!.moveTo(hx, TP); ctx!.lineTo(hx, B); ctx!.stroke()
        ctx!.save()
        ctx!.shadowColor = C.gold
        ctx!.shadowBlur = 8
        ctx!.fillStyle = '#fff'
        ctx!.beginPath(); ctx!.arc(hx, hy, 3.5, 0, Math.PI * 2); ctx!.fill()
        ctx!.restore()
        // caja
        const lines = [`AÑO ${hi}`, fmtV(hv), `${Math.min((hv / T) * 100, 999).toFixed(0)}% DE LA META`]
        ctx!.font = '600 10px monospace'
        const bw = Math.max(...lines.map(t => ctx!.measureText(t).width)) + 20
        const bh = 52
        let bx = hx + 12
        if (bx + bw > W - 6) bx = hx - bw - 12
        const by = Math.max(Math.min(hy - bh - 8, H - bh - 6), 6)
        ctx!.fillStyle = 'rgba(11,13,20,0.95)'
        ctx!.fillRect(bx, by, bw, bh)
        ctx!.strokeStyle = 'rgba(57,226,230,0.35)'
        ctx!.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1)
        ctx!.textAlign = 'left'
        ctx!.fillStyle = C.dimText
        ctx!.fillText(lines[0], bx + 10, by + 16)
        ctx!.fillStyle = C.glow
        ctx!.font = '700 12px monospace'
        ctx!.fillText(lines[1], bx + 10, by + 32)
        ctx!.font = '600 9px monospace'
        ctx!.fillStyle = hv >= T ? C.green : C.dimText
        ctx!.fillText(lines[2], bx + 10, by + 46)
      }
    }

    function loop(now: number) {
      if (visible && !document.hidden) scene(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    function onMove(e: MouseEvent) {
      const r = cv!.getBoundingClientRect()
      const n = dataRef.current.acum.length
      const x = e.clientX - r.left
      const L = MARGIN.l, R = r.width - MARGIN.r
      if (x < L - 6 || x > R + 6) { hoverRef.current = null; return }
      hoverRef.current = Math.round(((x - L) / (R - L)) * (n - 1))
    }
    function onLeave() { hoverRef.current = null }
    cv.addEventListener('mousemove', onMove)
    cv.addEventListener('mouseleave', onLeave)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      cv.removeEventListener('mousemove', onMove)
      cv.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <div style={{ height: 340, padding: '10px 8px 4px', background: C.bg }}>
      <canvas ref={canvasRef} role="img" aria-label="Proyección de patrimonio hacia la independencia financiera (FIRE)" style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }} />
    </div>
  )
}
