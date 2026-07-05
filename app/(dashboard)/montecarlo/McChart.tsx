'use client'
import { useEffect, useRef } from 'react'
import type { SimResult } from './types'

// Lluvia de trayectorias viva — canvas propio en lugar de Chart.js:
// las ~60 trayectorias se dibujan en ráfaga escalonada al llegar una nueva
// simulación (se ve el Monte Carlo "corriendo"), teñidas por su destino
// (verde = alcanza la meta, rojo = no llega). Después emergen las bandas
// P10/P50/P90 y la mediana dorada. Crosshair + tooltip con percentiles
// exactos por mes. El target se re-lee en vivo (mover el slider de objetivo
// re-tiñe las trayectorias sin resimular).

const GOLD = '#d4af37', GLOW = '#f0cc5a', GREEN = '#34d399', RED = '#f87171'
const BG = '#04050a', BORDER = '#1a1d2e', DIM = '#7a7f9a', MUTED = '#3a3f55'

const fmt = (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1e3).toFixed(0)}K`

interface Props { result: SimResult; capital: number; target: number; years: number; nSims: number }

const M = { l: 64, r: 20, t: 18, b: 30 }
const ANIM_MS = 1700

function ease(p: number) { return 1 - Math.pow(1 - Math.min(Math.max(p, 0), 1), 3) }

export default function McChart({ result, capital, target, years, nSims }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hoverRef  = useRef<number | null>(null)
  const dataRef   = useRef({ result, capital, target })
  const startRef  = useRef(0)

  // Nueva simulación → relanzar la ráfaga. Target/capital se leen en vivo.
  useEffect(() => {
    dataRef.current.result = result
    startRef.current = typeof performance !== 'undefined' ? performance.now() : 0
  }, [result])
  useEffect(() => {
    dataRef.current.capital = capital
    dataRef.current.target  = target
  }, [capital, target])

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
      const { result: R, capital: CAP, target: T } = dataRef.current
      const paths = R.samplePaths
      if (!paths.length || W === 0) return
      const steps = paths[0].length - 1
      const p = reduced ? 1 : ease((now - startRef.current) / ANIM_MS)

      const L = M.l, Rx = W - M.r, TP = M.t, B = H - M.b
      const lastI = R.p90.length - 1
      const maxV = Math.max(T * 1.18, R.p90[lastI] * 1.18, CAP * 1.5)
      const xs = (t: number) => L + (t / steps) * (Rx - L)
      const ys = (v: number) => TP + (1 - Math.min(v, maxV) / maxV) * (B - TP)

      ctx!.clearRect(0, 0, W, H)

      // ── Grid + ejes ──
      ctx!.font = '9px monospace'
      ctx!.textAlign = 'right'
      for (let g = 1; g <= 4; g++) {
        const v = (maxV / 4) * g
        const y = ys(v)
        ctx!.strokeStyle = 'rgba(212,175,55,0.06)'
        ctx!.lineWidth = 1
        ctx!.setLineDash([3, 5])
        ctx!.beginPath(); ctx!.moveTo(L, y); ctx!.lineTo(Rx, y); ctx!.stroke()
        ctx!.setLineDash([])
        ctx!.fillStyle = DIM
        ctx!.fillText(fmt(v), L - 8, y + 3)
      }
      ctx!.textAlign = 'center'
      const yearsTotal = Math.round(steps / 12)
      const skipY = Math.max(1, Math.ceil(yearsTotal / 10))
      for (let t = 0; t <= steps; t += 12 * skipY) {
        ctx!.fillStyle = DIM
        ctx!.fillText(`${t / 12}Y`, xs(t), B + 16)
      }
      ctx!.strokeStyle = BORDER
      ctx!.beginPath(); ctx!.moveTo(L, B); ctx!.lineTo(Rx, B); ctx!.stroke()

      // ── Zona de éxito (sobre la meta) ──
      const ty = ys(T)
      if (ty > TP) {
        const zGrad = ctx!.createLinearGradient(0, TP, 0, ty)
        zGrad.addColorStop(0, 'rgba(52,211,153,0.055)')
        zGrad.addColorStop(1, 'rgba(52,211,153,0.012)')
        ctx!.fillStyle = zGrad
        ctx!.fillRect(L, TP, Rx - L, ty - TP)
      }

      // ── Lluvia de trayectorias (ráfaga escalonada, teñidas por destino) ──
      ctx!.save()
      ctx!.beginPath(); ctx!.rect(L, TP - 2, Rx - L, B - TP + 4); ctx!.clip()
      const nP = paths.length
      for (let i = 0; i < nP; i++) {
        const path = paths[i]
        const startAt = (i / nP) * 0.55
        const pp = reduced ? 1 : Math.min(Math.max((p - startAt) / 0.42, 0), 1)
        if (pp <= 0) continue
        const k = Math.max(1, Math.floor(pp * steps))
        const ok = path[steps] >= T
        ctx!.strokeStyle = ok ? 'rgba(52,211,153,0.14)' : 'rgba(248,113,113,0.10)'
        ctx!.lineWidth = 0.9
        ctx!.beginPath()
        ctx!.moveTo(xs(0), ys(path[0]))
        for (let t = 1; t <= k; t++) ctx!.lineTo(xs(t), ys(path[t]))
        ctx!.stroke()
        // cabeza brillante mientras se dibuja
        if (pp < 1) {
          ctx!.fillStyle = ok ? 'rgba(52,211,153,0.8)' : 'rgba(248,113,113,0.6)'
          ctx!.beginPath(); ctx!.arc(xs(k), ys(path[k]), 1.6, 0, Math.PI * 2); ctx!.fill()
        }
      }

      // ── Bandas de percentiles (emergen tras la ráfaga) ──
      const bp = reduced ? 1 : ease((p - 0.68) / 0.32)
      if (bp > 0) {
        // banda P10–P90
        ctx!.globalAlpha = bp
        ctx!.beginPath()
        ctx!.moveTo(xs(0), ys(R.p90[0]))
        for (let t = 1; t <= lastI; t++) ctx!.lineTo(xs(t), ys(R.p90[t]))
        for (let t = lastI; t >= 0; t--) ctx!.lineTo(xs(t), ys(R.p10[t]))
        ctx!.closePath()
        ctx!.fillStyle = 'rgba(212,175,55,0.06)'
        ctx!.fill()

        const band = (arr: number[], color: string, width: number, dash: number[]) => {
          ctx!.strokeStyle = color
          ctx!.lineWidth = width
          ctx!.setLineDash(dash)
          ctx!.beginPath()
          ctx!.moveTo(xs(0), ys(arr[0]))
          for (let t = 1; t <= lastI; t++) ctx!.lineTo(xs(t), ys(arr[t]))
          ctx!.stroke()
          ctx!.setLineDash([])
        }
        band(R.p90, 'rgba(52,211,153,0.75)', 1.4, [5, 4])
        band(R.p10, 'rgba(248,113,113,0.75)', 1.4, [5, 4])
        // mediana dorada con glow
        ctx!.save()
        ctx!.shadowColor = GOLD
        ctx!.shadowBlur = 10
        band(R.p50, GLOW, 2.4, [])
        ctx!.restore()
        ctx!.globalAlpha = 1
      }
      ctx!.restore() // fin clip

      // ── Línea de capital inicial ──
      const cy = ys(CAP)
      ctx!.strokeStyle = 'rgba(58,63,85,0.5)'
      ctx!.lineWidth = 1
      ctx!.setLineDash([3, 5])
      ctx!.beginPath(); ctx!.moveTo(L, cy); ctx!.lineTo(Rx, cy); ctx!.stroke()
      ctx!.setLineDash([])
      ctx!.font = '600 9px monospace'
      ctx!.textAlign = 'left'
      ctx!.fillStyle = MUTED
      ctx!.fillText(`CAPITAL ${fmt(CAP)}`, L + 6, cy - 5)

      // ── Línea de objetivo + chip ──
      ctx!.strokeStyle = 'rgba(212,175,55,0.5)'
      ctx!.lineWidth = 1
      ctx!.setLineDash([8, 5])
      ctx!.beginPath(); ctx!.moveTo(L, ty); ctx!.lineTo(Rx, ty); ctx!.stroke()
      ctx!.setLineDash([])
      const objTxt = `OBJETIVO ${fmt(T)}`
      const ow = ctx!.measureText(objTxt).width + 12
      ctx!.fillStyle = 'rgba(11,13,20,0.92)'
      ctx!.fillRect(Rx - ow, ty - 9, ow, 16)
      ctx!.strokeStyle = 'rgba(212,175,55,0.4)'
      ctx!.strokeRect(Rx - ow + 0.5, ty - 8.5, ow - 1, 15)
      ctx!.fillStyle = GOLD
      ctx!.fillText(objTxt, Rx - ow + 6, ty + 3)

      // ── Crosshair + tooltip de percentiles ──
      const hi = hoverRef.current
      if (hi !== null && hi >= 0 && hi <= lastI && bp >= 1) {
        const hx = xs(hi)
        ctx!.strokeStyle = 'rgba(232,233,240,0.14)'
        ctx!.lineWidth = 1
        ctx!.beginPath(); ctx!.moveTo(hx, TP); ctx!.lineTo(hx, B); ctx!.stroke()
        const rows: Array<[string, number, string]> = [
          ['P90', R.p90[hi], GREEN],
          ['P50', R.p50[hi], GLOW],
          ['P10', R.p10[hi], RED],
        ]
        for (const [, v, color] of rows) {
          ctx!.fillStyle = color
          ctx!.beginPath(); ctx!.arc(hx, ys(v), 3, 0, Math.PI * 2); ctx!.fill()
        }
        const title = hi % 12 === 0 ? `AÑO ${hi / 12}` : `AÑO ${(hi / 12).toFixed(1)}`
        ctx!.font = '600 10px monospace'
        const bw = 118, bh = 66
        let bx = hx + 12
        if (bx + bw > W - 6) bx = hx - bw - 12
        const by = TP + 8
        ctx!.fillStyle = 'rgba(11,13,20,0.95)'
        ctx!.fillRect(bx, by, bw, bh)
        ctx!.strokeStyle = 'rgba(212,175,55,0.35)'
        ctx!.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1)
        ctx!.textAlign = 'left'
        ctx!.fillStyle = DIM
        ctx!.fillText(title, bx + 10, by + 15)
        rows.forEach(([lbl, v, color], ri) => {
          ctx!.fillStyle = color
          ctx!.fillText(`${lbl}  ${fmt(v)}`, bx + 10, by + 31 + ri * 15)
        })
      }
    }

    function loop(now: number) {
      if (visible && !document.hidden) scene(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    function onMove(e: MouseEvent) {
      const r = cv!.getBoundingClientRect()
      const steps = dataRef.current.result.p90.length - 1
      const x = e.clientX - r.left
      const L = M.l, Rx = r.width - M.r
      if (x < L - 6 || x > Rx + 6) { hoverRef.current = null; return }
      hoverRef.current = Math.round(((x - L) / (Rx - L)) * steps)
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
    <div style={{ height: 440, padding: '14px 14px 4px', background: BG }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: 'calc(100% - 22px)', display: 'block', cursor: 'crosshair' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: MUTED }}>
          <span style={{ color: 'rgba(52,211,153,0.8)' }}>—</span> alcanza la meta&nbsp;&nbsp;
          <span style={{ color: 'rgba(248,113,113,0.8)' }}>—</span> no llega&nbsp;&nbsp;
          <span style={{ color: GLOW }}>—</span> mediana P50
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: MUTED }}>
          {nSims.toLocaleString()} simulaciones · {result.samplePaths.length} paths visibles · {years * 12} pasos mensuales
        </span>
      </div>
    </div>
  )
}
