'use client'
import { useEffect, useRef } from 'react'
import { C } from '@/app/lib/constants'

// ─── Esfera de 24 horas ───────────────────────────────────────────────────────
// El ángulo es la hora real de llegada (00:00 arriba, 12:00 abajo) y la banda
// concéntrica es el canal. La aguja marca ahora mismo. Nada acá es decorativo:
// si un punto está a las 4 de la mañana es porque el motor disparó a esa hora.

export type DialChannel = 'señal' | 'fire' | 'mercado' | 'otro'

export interface DialPoint {
  hour:    number       // 0–24 en hora local
  channel: DialChannel
  unread:  boolean
  real:    boolean      // dinero real — se marca con anillo, no con color
}

const CH_COLOR: Record<DialChannel, string> = {
  'señal':   C.gold,
  'fire':    C.amber,
  'mercado': C.blue,
  'otro':    C.textDim,
}

const CH_BAND: Record<DialChannel, number> = {
  'señal':   0.86,
  'fire':    0.60,
  'mercado': 0.36,
  'otro':    0.20,
}

const SWEEP_MS = 620   // entrada de la aguja

export default function NotifDial({ points, size = 132 }: { points: DialPoint[]; size?: number }) {
  const ref     = useRef<HTMLCanvasElement>(null)
  const dataRef = useRef<DialPoint[]>(points)

  // Snapshot de los datos sin re-montar el efecto: si el efecto dependiera de
  // `points`, cada notificación entrante reiniciaría la animación de entrada.
  useEffect(() => { dataRef.current = points })

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Canvas no resuelve var(--…) en `ctx.font`: hay que pasarle la familia ya
    // resuelta, y repintar cuando la fuente termine de cargar (el primer pintado
    // le gana y caería a una fuente de respaldo).
    const mono = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-dm-mono').trim()
    const FONT = `500 8px ${mono ? mono + ',' : ''}ui-monospace,monospace`

    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    cv.width  = size * DPR
    cv.height = size * DPR
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)

    const cx = size / 2, cy = size / 2, R = size * 0.41
    const ang  = (h: number) => (h / 24) * Math.PI * 2 - Math.PI / 2
    const hourNow = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 }

    let raf = 0, start = 0, visible = true
    let cleanupIO: (() => void) | undefined

    function draw(needle: number) {
      const c = ctx!
      c.clearRect(0, 0, size, size)

      // anillos de banda
      for (const b of [0.86, 0.60, 0.36]) {
        c.strokeStyle = 'rgba(57,226,230,0.10)'; c.lineWidth = 1
        c.beginPath(); c.arc(cx, cy, R * b, 0, Math.PI * 2); c.stroke()
      }

      // marcas cada 3 h, largas cada 6 h
      for (let h = 0; h < 24; h += 3) {
        const a = ang(h), major = h % 6 === 0
        c.strokeStyle = major ? 'rgba(57,226,230,0.34)' : 'rgba(57,226,230,0.15)'
        c.lineWidth   = major ? 1.3 : 1
        const r0 = major ? R * 0.90 : R * 0.95
        c.beginPath()
        c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
        c.lineTo(cx + Math.cos(a) * R,  cy + Math.sin(a) * R)
        c.stroke()
      }

      // Etiquetas horarias: sin ellas el ángulo no se puede leer y la esfera
      // vuelve a ser decorativa. Caben mientras el radio deje margen para el
      // texto (R*1.13 + alto de línea ≤ size/2).
      if (size >= 118) {
        c.font = FONT
        c.fillStyle = 'rgba(122,127,154,0.85)'
        c.textAlign = 'center'; c.textBaseline = 'middle'
        for (const h of [0, 6, 12, 18]) {
          const a = ang(h)
          c.fillText(String(h).padStart(2, '0'), cx + Math.cos(a) * R * 1.13, cy + Math.sin(a) * R * 1.13)
        }
      }

      // estela del barrido
      if (typeof c.createConicGradient === 'function') {
        const g = c.createConicGradient(needle, cx, cy)
        g.addColorStop(0,    'rgba(57,226,230,0.26)')
        g.addColorStop(0.10, 'rgba(57,226,230,0)')
        g.addColorStop(1,    'rgba(57,226,230,0)')
        c.fillStyle = g
        c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill()
      }

      // aguja = ahora
      c.strokeStyle = 'rgba(94,234,240,0.9)'; c.lineWidth = 1.5
      c.beginPath(); c.moveTo(cx, cy)
      c.lineTo(cx + Math.cos(needle) * R, cy + Math.sin(needle) * R); c.stroke()

      // eventos
      for (const p of dataRef.current) {
        const a = ang(p.hour), r = R * (CH_BAND[p.channel] ?? 0.2)
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
        const col = CH_COLOR[p.channel] ?? C.textDim
        c.globalAlpha = p.unread ? 1 : 0.4
        c.fillStyle   = col
        c.shadowBlur  = p.unread ? 11 : 0
        c.shadowColor = col
        c.beginPath(); c.arc(x, y, p.unread ? 3.4 : 2.4, 0, Math.PI * 2); c.fill()
        c.shadowBlur = 0
        if (p.real) {
          c.strokeStyle = C.green; c.lineWidth = 1.4; c.globalAlpha = 0.95
          c.beginPath(); c.arc(x, y, 6.2, 0, Math.PI * 2); c.stroke()
        }
        c.globalAlpha = 1
      }

      // borde y núcleo
      c.strokeStyle = 'rgba(57,226,230,0.28)'; c.lineWidth = 1.2
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke()
      c.fillStyle = 'rgba(94,234,240,0.9)'
      c.beginPath(); c.arc(cx, cy, 2, 0, Math.PI * 2); c.fill()
    }

    // Entrada: la aguja barre hasta la hora actual y se detiene. No queda un rAF
    // vivo — el latido de "en línea" lo da el punto CSS del panel lateral.
    function animate(ts: number) {
      if (!start) start = ts
      const k = Math.min(1, (ts - start) / SWEEP_MS)
      const e = 1 - Math.pow(1 - k, 3)
      const to = ang(hourNow())
      draw(to - (1 - e) * 0.9)
      if (k < 1 && visible) raf = requestAnimationFrame(animate)
    }

    if (reduced) draw(ang(hourNow()))
    else {
      const io = new IntersectionObserver(es => {
        visible = es[0].isIntersecting
        if (visible && !start) raf = requestAnimationFrame(animate)
      }, { threshold: 0 })
      io.observe(cv)
      cleanupIO = () => io.disconnect()
    }

    // Las fuentes de Next llegan después del primer pintado.
    if (document.fonts?.ready) document.fonts.ready.then(() => draw(ang(hourNow())))
    // Y la aguja tiene que seguir avanzando en una pestaña abierta todo el día.
    const tick = window.setInterval(() => draw(ang(hourNow())), 60_000)

    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(tick)
      cleanupIO?.()
    }
  }, [size])

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: size, height: size, display: 'block' }}
      aria-hidden
    />
  )
}
