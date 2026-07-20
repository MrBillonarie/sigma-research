'use client'
import { useEffect, useRef } from 'react'
import { C } from '@/app/lib/constants'

// ─── FIRE · Elegí tu modo — trayectoria ascendente ────────────────────────────
// Reemplaza las 3 tarjetas de modo: Lean/Barista/Fat son 3 puntos de altitud
// en una sola curva (la altitud = qué tan alto apunta cada modo, no qué tan
// rápido crece). El tab de arriba es la interacción garantizada (accesible,
// teclado/lector de pantalla); el clic directo sobre el nodo es progresivo.

export interface ModeDef {
  id: string
  name: string
  color: string
  peak: number        // 0–1, altitud de libertad del modo
  description: string
}

interface Props {
  modes: ModeDef[]
  activeIndex: number
  onSelect: (i: number) => void
  closestIndex?: number | null   // modo que calza con el gasto real del usuario
}

const FF = "ui-monospace,'DM Mono',monospace"
const hexa = (h: string, a: number) => {
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function ModeAscender({ modes, activeIndex, onSelect, closestIndex }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(activeIndex)
  stateRef.current = activeIndex

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
      W = r.width || 700; H = r.height || 190
      canvas.width = W * DPR; canvas.height = H * DPR; c.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    size()
    const ro = new ResizeObserver(size); ro.observe(canvas)
    let visible = true
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting }, { threshold: 0.02 })
    io.observe(canvas)
    let raf = 0

    const xOf = (i: number) => modes.length <= 1 ? 0.5 : 0.13 + i * (0.87 - 0.13) / (modes.length - 1)

    const draw = (t: number) => {
      if (!W) return
      const active = stateRef.current
      c.clearRect(0, 0, W, H)
      c.fillStyle = '#060810'; c.fillRect(0, 0, W, H)
      const top = 34, bottom = H - 46
      const pts = modes.map((m, i) => ({ x: W * xOf(i), y: bottom - (bottom - top) * m.peak }))

      // atmósfera de fondo — grid sutil + nebulosa por nodo, para que la curva no flote en negro vacío
      c.strokeStyle = hexa('#5eeaf0', .05); c.lineWidth = 1
      for (let gy = top; gy <= bottom + 20; gy += 26) { c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke() }
      modes.forEach((m, i) => {
        const p = pts[i]
        const g = c.createRadialGradient(p.x, p.y, 4, p.x, p.y, 90)
        g.addColorStop(0, hexa(m.color, .10)); g.addColorStop(1, 'transparent')
        c.fillStyle = g; c.fillRect(0, 0, W, H)
      })

      const smooth = (ctx: CanvasRenderingContext2D) => {
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length - 1; i++) { const xc = (pts[i].x + pts[i + 1].x) / 2, yc = (pts[i].y + pts[i + 1].y) / 2; ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc) }
        const last = pts[pts.length - 1]; ctx.lineTo(last.x, last.y)
      }
      // wash tenue bajo toda la curva
      c.save(); c.beginPath(); smooth(c); c.lineTo(pts[pts.length - 1].x, bottom); c.lineTo(pts[0].x, bottom); c.closePath(); c.clip()
      const washg = c.createLinearGradient(0, top, 0, bottom); washg.addColorStop(0, hexa('#5eeaf0', .05)); washg.addColorStop(1, 'transparent')
      c.fillStyle = washg; c.fillRect(0, 0, W, H)
      c.restore()
      // relleno marcado hasta el modo activo
      c.save(); c.beginPath(); smooth(c); c.lineTo(pts[active].x, bottom); c.lineTo(pts[0].x, bottom); c.closePath(); c.clip()
      const grad = c.createLinearGradient(0, top, 0, bottom); grad.addColorStop(0, hexa(modes[active].color, .20)); grad.addColorStop(1, 'transparent')
      c.fillStyle = grad; c.fillRect(0, 0, pts[active].x + 40, H)
      c.restore()
      // tramo completo, visible (no completamente apagado)
      c.beginPath(); smooth(c); c.strokeStyle = hexa('#5eeaf0', .4); c.setLineDash([5, 4]); c.lineWidth = 1.6; c.stroke(); c.setLineDash([])
      // tramo recorrido (0 hasta el activo), brillante
      if (active > 0) {
        c.save(); c.beginPath()
        c.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i <= active; i++) { const xc = (pts[i - 1].x + pts[i].x) / 2, yc = (pts[i - 1].y + pts[i].y) / 2; c.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc); c.lineTo(pts[i].x, pts[i].y) }
        c.strokeStyle = '#5eeaf0'; c.lineWidth = 2.4; c.shadowColor = '#5eeaf0'; c.shadowBlur = 9; c.stroke(); c.shadowBlur = 0
        c.restore()
      }
      // nodes
      modes.forEach((m, i) => {
        const p = pts[i], isAc = i === active
        const pulse = RM ? (isAc ? 1 : 0.6) : (isAc ? (0.7 + Math.sin(t * 2) * 0.3) : (0.5 + Math.sin(t * 1.4 + i) * 0.15))
        c.fillStyle = hexa(m.color, (isAc ? .24 : .14) + pulse * 0.06); c.beginPath(); c.arc(p.x, p.y, isAc ? 18 : 11, 0, 7); c.fill()
        c.fillStyle = isAc ? m.color : hexa(m.color, .85)
        c.beginPath(); c.arc(p.x, p.y, isAc ? 6 : 4, 0, 7); c.fill()
        c.strokeStyle = '#04060b'; c.lineWidth = 2; c.stroke()
        // hito de "tu nivel actual"
        if (closestIndex === i) {
          c.strokeStyle = hexa(m.color, .8); c.lineWidth = 1.4; c.beginPath(); c.arc(p.x, p.y, (isAc ? 6 : 4) + 5, 0, 7); c.stroke()
        }
        c.textAlign = 'center'
        c.fillStyle = isAc ? m.color : hexa('#e8e9f0', .7)
        c.font = (isAc ? '700 16px ' : '600 12px ') + FF
        c.textBaseline = 'bottom'
        c.fillText(m.name, p.x, p.y - 16)
        c.fillStyle = hexa('#7a7f9a', isAc ? .95 : .7); c.font = (isAc ? '11px ' : '9px ') + FF; c.textBaseline = 'top'
        c.fillText(m.description.length > 60 && !isAc ? m.description.slice(0, 57) + '…' : m.description, p.x, p.y + (isAc ? 16 : 14))
      })
    }

    const frame = () => { raf = requestAnimationFrame(frame); if (visible) draw(performance.now() / 1000) }
    raf = requestAnimationFrame(frame)

    const onClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top
      const top = 34, bottom = H - 46
      modes.forEach((m, i) => {
        const p = { x: W * xOf(i), y: bottom - (bottom - top) * m.peak }
        if (Math.hypot(mx - p.x, my - p.y) < 24) onSelect(i)
      })
    }
    canvas.addEventListener('click', onClick)

    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); canvas.removeEventListener('click', onClick) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modes, closestIndex])

  return (
    <div>
      <style>{`
        .ma-tabs{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
        .ma-tab{font-family:${FF};font-size:11px;letter-spacing:.08em;padding:8px 18px;border-radius:20px;
          border:1px solid ${C.border2};background:transparent;color:${C.dimText};cursor:pointer;transition:all .18s;
          display:flex;align-items:center;gap:9px}
        .ma-tab::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--mc);opacity:.45;transition:opacity .18s}
        .ma-tab:hover{border-color:var(--mc);color:${C.text}}
        .ma-tab.active{border-color:var(--mc);color:var(--mc);background:color-mix(in srgb,var(--mc) 14%,transparent);
          box-shadow:0 0 16px color-mix(in srgb,var(--mc) 28%,transparent)}
        .ma-tab.active::before{opacity:1;box-shadow:0 0 6px var(--mc)}
      `}</style>
      <div className="ma-tabs" role="tablist" aria-label="Elegí tu modo FIRE">
        {modes.map((m, i) => (
          <button
            key={m.id} role="tab" aria-selected={i === activeIndex}
            className={`ma-tab${i === activeIndex ? ' active' : ''}`}
            style={{ ['--mc' as string]: m.color }}
            onClick={() => onSelect(i)}
          >
            {m.name}
            {closestIndex === i && <span style={{ fontSize: 8, opacity: .75 }}>· TU NIVEL</span>}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} height={190} style={{ display: 'block', width: '100%', height: 190, cursor: 'pointer' }} />
    </div>
  )
}
