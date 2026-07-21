'use client'
import { useEffect, useRef } from 'react'
import { C } from '@/app/lib/constants'

// ─── Rosa de 24 horas ─────────────────────────────────────────────────────────
// Cada sector es una hora del día (00:00 arriba, 12:00 abajo) y su largo es
// cuántos avisos llegaron en esa hora, apilados por canal. La aguja marca ahora.
//
// La primera versión dibujaba un punto por notificación. Funcionaba con datos de
// muestra y se rompía con los reales: el motor genera >130 señales por día, así
// que la banda exterior se saturaba y quedaba un anillo sólido — decorativo, que
// es justo lo que este instrumento vino a evitar. Agregar por hora escala sin
// techo y además responde algo útil: en qué franjas dispara el motor.

export type DialChannel = 'señal' | 'fire' | 'mercado' | 'otro'

export interface DialPoint {
  hour:    number       // 0–24 en hora local
  channel: DialChannel
  unread:  boolean
  real:    boolean      // dinero real
}

const CH_COLOR: Record<DialChannel, string> = {
  'señal':   C.gold,
  'fire':    C.amber,
  'mercado': C.blue,
  'otro':    C.textDim,
}

// Orden de apilado, de adentro hacia afuera. Fijo, para que la lectura no
// cambie de forma entre repintados.
const STACK: DialChannel[] = ['señal', 'fire', 'mercado', 'otro']

const SWEEP_MS = 620   // entrada de la aguja

interface Bin {
  total:  number
  ch:     Record<DialChannel, number>
  unread: number
  real:   boolean
}

function binByHour(points: DialPoint[]): Bin[] {
  const bins: Bin[] = Array.from({ length: 24 }, () => ({
    total: 0, unread: 0, real: false,
    ch: { 'señal': 0, 'fire': 0, 'mercado': 0, 'otro': 0 },
  }))
  for (const p of points) {
    const h = Math.min(23, Math.max(0, Math.floor(p.hour)))
    const b = bins[h]
    b.total++
    b.ch[p.channel] = (b.ch[p.channel] ?? 0) + 1
    if (p.unread) b.unread++
    if (p.real)   b.real = true
  }
  return bins
}

export default function NotifDial({ points, size = 132 }: { points: DialPoint[]; size?: number }) {
  const ref       = useRef<HTMLCanvasElement>(null)
  const dataRef   = useRef<DialPoint[]>(points)
  const redrawRef = useRef<(() => void) | null>(null)

  // Snapshot de los datos sin re-montar el efecto: si el efecto dependiera de
  // `points`, cada notificación entrante reiniciaría la animación de entrada.
  // El repintado explícito sí hace falta: las notificaciones llegan por fetch y
  // por realtime, así que la rosa se monta vacía y sin esto no se actualizaría
  // hasta el siguiente tick del minutero.
  useEffect(() => {
    dataRef.current = points
    redrawRef.current?.()
  })

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
    const R0 = R * 0.34               // hueco central
    const R1 = R * 0.97               // tope de las barras
    const SLICE = (Math.PI * 2) / 24
    const GAP   = SLICE * 0.16

    const ang  = (h: number) => (h / 24) * Math.PI * 2 - Math.PI / 2
    const hourNow = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 }

    let raf = 0, start = 0, visible = true
    let cleanupIO: (() => void) | undefined

    function wedge(a0: number, a1: number, r0: number, r1: number, fill: string, alpha: number) {
      const c = ctx!
      c.globalAlpha = alpha
      c.fillStyle = fill
      c.beginPath()
      c.arc(cx, cy, r1, a0, a1)
      c.arc(cx, cy, r0, a1, a0, true)
      c.closePath()
      c.fill()
      c.globalAlpha = 1
    }

    function draw(needle: number) {
      const c = ctx!
      c.clearRect(0, 0, size, size)

      const bins = binByHour(dataRef.current)
      const max  = Math.max(1, ...bins.map(b => b.total))

      // Guías: hueco interior y tope. Sin números — la escala se lee en los
      // medidores de al lado; acá lo que importa es la forma del día.
      c.strokeStyle = 'rgba(57,226,230,0.10)'; c.lineWidth = 1
      c.beginPath(); c.arc(cx, cy, R0, 0, Math.PI * 2); c.stroke()
      c.beginPath(); c.arc(cx, cy, R1, 0, Math.PI * 2); c.stroke()

      // Marcas cada 6 h, por fuera de las barras
      for (let h = 0; h < 24; h += 6) {
        const a = ang(h)
        c.strokeStyle = 'rgba(57,226,230,0.30)'; c.lineWidth = 1.2
        c.beginPath()
        c.moveTo(cx + Math.cos(a) * R1 * 1.02, cy + Math.sin(a) * R1 * 1.02)
        c.lineTo(cx + Math.cos(a) * R * 1.06,  cy + Math.sin(a) * R * 1.06)
        c.stroke()
      }

      if (size >= 118) {
        c.font = FONT
        c.fillStyle = 'rgba(122,127,154,0.85)'
        c.textAlign = 'center'; c.textBaseline = 'middle'
        for (const h of [0, 6, 12, 18]) {
          const a = ang(h)
          c.fillText(String(h).padStart(2, '0'), cx + Math.cos(a) * R * 1.16, cy + Math.sin(a) * R * 1.16)
        }
      }

      // Barras por hora
      bins.forEach((b, h) => {
        if (b.total === 0) return
        const a0 = ang(h) + GAP / 2
        const a1 = ang(h + 1) - GAP / 2
        // Raíz cuadrada: una hora con 1 aviso tiene que verse aunque otra
        // tenga 40. Con escala lineal desaparecería.
        const len = (R1 - R0) * Math.sqrt(b.total / max)
        let r = R0

        for (const ch of STACK) {
          const n = b.ch[ch]
          if (!n) continue
          const seg = len * (n / b.total)
          // Lo leído se apaga; lo pendiente queda a plena intensidad.
          const alpha = b.unread > 0 ? 0.9 : 0.34
          wedge(a0, a1, r, r + seg, CH_COLOR[ch], alpha)
          r += seg
        }

        // Cresta luminosa si esa hora tiene algo sin leer
        if (b.unread > 0) {
          c.shadowBlur = 8; c.shadowColor = C.glow
          wedge(a0, a1, r, r + 1.6, C.glow, 1)
          c.shadowBlur = 0
        }
        // Marca verde si en esa hora hubo dinero real. Va a radio fijo, fuera
        // del anillo: colgada del tope de la barra quedaba a una altura distinta
        // en cada hora y en las barras cortas casi no se veía. Es el dato más
        // importante del panel, tiene que leerse siempre igual.
        if (b.real) {
          c.strokeStyle = C.green; c.lineWidth = 2.2
          c.shadowBlur = 7; c.shadowColor = C.green
          c.beginPath(); c.arc(cx, cy, R1 + 2.8, a0, a1); c.stroke()
          c.shadowBlur = 0
        }
      })

      // Estela y aguja = ahora
      if (typeof c.createConicGradient === 'function') {
        const g = c.createConicGradient(needle, cx, cy)
        g.addColorStop(0,    'rgba(57,226,230,0.20)')
        g.addColorStop(0.08, 'rgba(57,226,230,0)')
        g.addColorStop(1,    'rgba(57,226,230,0)')
        c.fillStyle = g
        c.beginPath(); c.arc(cx, cy, R0, 0, Math.PI * 2); c.fill()
      }
      c.strokeStyle = 'rgba(94,234,240,0.9)'; c.lineWidth = 1.5
      c.beginPath()
      c.moveTo(cx, cy)
      c.lineTo(cx + Math.cos(needle) * R * 1.02, cy + Math.sin(needle) * R * 1.02)
      c.stroke()

      c.fillStyle = 'rgba(94,234,240,0.95)'
      c.beginPath(); c.arc(cx, cy, 2.2, 0, Math.PI * 2); c.fill()
    }

    // Entrada: la aguja barre hasta la hora actual y se detiene. No queda un rAF
    // vivo — el latido de "en línea" lo da el punto CSS del panel lateral.
    function animate(ts: number) {
      if (!start) start = ts
      const k = Math.min(1, (ts - start) / SWEEP_MS)
      const e = 1 - Math.pow(1 - k, 3)
      draw(ang(hourNow()) - (1 - e) * 0.9)
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

    // Repintado bajo demanda cuando cambian los datos (ver efecto de arriba).
    redrawRef.current = () => draw(ang(hourNow()))

    // Las fuentes de Next llegan después del primer pintado.
    if (document.fonts?.ready) document.fonts.ready.then(() => draw(ang(hourNow())))
    // Y la aguja tiene que seguir avanzando en una pestaña abierta todo el día.
    const tick = window.setInterval(() => draw(ang(hourNow())), 60_000)

    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(tick)
      cleanupIO?.()
      redrawRef.current = null
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
