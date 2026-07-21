'use client'
import { useEffect, useRef } from 'react'
import { C } from '@/app/lib/constants'

// ─── Núcleo con anillo de actividad ───────────────────────────────────────────
// Anillo exterior: 24 tramos, uno por hora del día en curso (00:00 arriba). Cada
// tramo se enciende según cuántos avisos llegaron en esa hora y toma el color del
// canal dominante. Muescas verdes por fuera donde hubo dinero real.
//
// El poliedro del centro es decorativo — no codifica nada más que "hay actividad".
// Queda dicho para que nadie lo lea como dato.
//
// Historia: la primera versión ponía un punto por notificación y se saturaba con
// el volumen real (>130 señales/día formaban un anillo sólido). La segunda pasó a
// barras radiales, que escalaban bien pero quedaban como un gráfico cualquiera.

export type DialChannel = 'señal' | 'fire' | 'mercado' | 'otro'

export interface DialPoint {
  hour:    number       // 0–24 en hora local
  channel: DialChannel
  unread:  boolean
  real:    boolean
}

const CH_COLOR: Record<DialChannel, string> = {
  'señal':   C.gold,
  'fire':    C.amber,
  'mercado': C.blue,
  'otro':    C.textDim,
}

interface Bin { total: number; ch: Record<DialChannel, number>; unread: number; real: boolean }

function binByHour(points: DialPoint[]): Bin[] {
  const bins: Bin[] = Array.from({ length: 24 }, () => ({
    total: 0, unread: 0, real: false,
    ch: { 'señal': 0, 'fire': 0, 'mercado': 0, 'otro': 0 },
  }))
  for (const p of points) {
    const b = bins[Math.min(23, Math.max(0, Math.floor(p.hour)))]
    b.total++
    b.ch[p.channel] = (b.ch[p.channel] ?? 0) + 1
    if (p.unread) b.unread++
    if (p.real)   b.real = true
  }
  return bins
}

const dominant = (b: Bin): DialChannel =>
  (Object.keys(b.ch) as DialChannel[]).reduce((a, k) => (b.ch[k] > b.ch[a] ? k : a), 'señal')

// Geometría del icosaedro, calculada una vez para todas las instancias.
const PHI = (1 + Math.sqrt(5)) / 2
const VERTS: number[][] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
].map(p => { const l = Math.hypot(p[0], p[1], p[2]); return p.map(x => x / l) })

const EDGES: [number, number][] = (() => {
  const e: [number, number][] = []
  for (let i = 0; i < VERTS.length; i++)
    for (let j = i + 1; j < VERTS.length; j++)
      if (Math.hypot(VERTS[i][0] - VERTS[j][0], VERTS[i][1] - VERTS[j][1], VERTS[i][2] - VERTS[j][2]) < 1.12)
        e.push([i, j])
  return e
})()

export default function NotifDial({ points, size = 168 }: { points: DialPoint[]; size?: number }) {
  const ref       = useRef<HTMLCanvasElement>(null)
  const dataRef   = useRef<DialPoint[]>(points)
  const redrawRef = useRef<(() => void) | null>(null)

  // Snapshot sin re-montar el efecto. El repintado explícito sí hace falta: las
  // notificaciones llegan por fetch y por realtime, así que el anillo se monta
  // vacío y sin esto no se actualizaría hasta el siguiente tick del minutero.
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
    // resuelta, y repintar en document.fonts.ready porque el primer pintado le
    // gana a la carga de la fuente y caería a una de respaldo.
    const mono = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-dm-mono').trim()
    const FONT = `500 7.5px ${mono ? mono + ',' : ''}ui-monospace,monospace`

    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    cv.width  = size * DPR
    cv.height = size * DPR
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)

    const cx = size / 2, cy = size / 2
    const RING = size * 0.37          // radio del anillo de actividad
    const LW   = Math.max(3, size * 0.024)
    const CORE = size * 0.225         // radio del poliedro

    let raf = 0, spin = reduced ? 0.6 : 0, visible = true
    let cleanupIO: (() => void) | undefined

    function draw() {
      const c = ctx!
      c.clearRect(0, 0, size, size)

      const bins = binByHour(dataRef.current)
      const max  = Math.max(1, ...bins.map(b => b.total))
      const step = (Math.PI * 2) / 24
      const gap  = step * 0.18

      bins.forEach((b, h) => {
        const a0 = (h / 24) * Math.PI * 2 - Math.PI / 2 + gap / 2
        const a1 = a0 + step - gap

        // Carril de fondo: mantiene visible la forma del reloj aunque el día
        // esté vacío, para que el instrumento nunca se vea "roto".
        c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = LW
        c.beginPath(); c.arc(cx, cy, RING, a0, a1); c.stroke()
        if (b.total === 0) return

        // Raíz cuadrada: una hora con 1 aviso tiene que verse aunque otra
        // tenga 40. Con escala lineal desaparecería.
        const k   = Math.sqrt(b.total / max)
        const col = CH_COLOR[dominant(b)]
        c.strokeStyle = col
        c.globalAlpha = 0.22 + 0.75 * k
        c.shadowBlur  = 9 * k; c.shadowColor = col
        c.beginPath(); c.arc(cx, cy, RING, a0, a1); c.stroke()
        c.shadowBlur = 0; c.globalAlpha = 1

        // Cresta si esa hora tiene algo sin leer
        if (b.unread > 0) {
          c.strokeStyle = C.glow; c.lineWidth = 1.6
          c.shadowBlur = 7; c.shadowColor = C.glow
          c.beginPath(); c.arc(cx, cy, RING - LW / 2 - 1.6, a0, a1); c.stroke()
          c.shadowBlur = 0; c.lineWidth = LW
        }

        // Dinero real: por fuera y a radio fijo, el dato más importante del panel.
        if (b.real) {
          c.strokeStyle = C.green; c.lineWidth = 2.2
          c.shadowBlur = 7; c.shadowColor = C.green
          c.beginPath(); c.arc(cx, cy, RING + LW / 2 + 3.2, a0, a1); c.stroke()
          c.shadowBlur = 0
        }
      })

      // Referencias horarias
      c.font = FONT
      c.fillStyle = 'rgba(122,127,154,0.8)'
      c.textAlign = 'center'; c.textBaseline = 'middle'
      for (const h of [0, 6, 12, 18]) {
        const a = (h / 24) * Math.PI * 2 - Math.PI / 2
        const r = RING + LW / 2 + 12
        c.fillText(String(h).padStart(2, '0'), cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      }

      // ── Núcleo (decorativo) ──
      const ca = Math.cos(spin), sa = Math.sin(spin)
      const cb = Math.cos(spin * 0.6), sb = Math.sin(spin * 0.6)
      const P = VERTS.map(v => {
        const vx = v[0] * CORE, vy = v[1] * CORE, vz = v[2] * CORE
        const X = vx * ca - vz * sa
        let Z = vx * sa + vz * ca
        const Y = vy * cb - Z * sb; Z = vy * sb + Z * cb
        const s = 280 / (280 + Z)
        return [cx + X * s, cy + Y * s, Z]
      })

      const g = c.createRadialGradient(cx, cy, 3, cx, cy, CORE * 1.35)
      g.addColorStop(0, 'rgba(57,226,230,0.24)')
      g.addColorStop(1, 'rgba(57,226,230,0)')
      c.fillStyle = g
      c.beginPath(); c.arc(cx, cy, CORE * 1.35, 0, Math.PI * 2); c.fill()

      for (const [i, j] of EDGES) {
        const dep = (P[i][2] + P[j][2]) / 2
        const o = 0.14 + 0.5 * (1 - (dep + CORE) / (2 * CORE))
        c.strokeStyle = `rgba(94,234,240,${o.toFixed(3)})`
        c.lineWidth = dep < 0 ? 1.5 : 0.8
        c.beginPath(); c.moveTo(P[i][0], P[i][1]); c.lineTo(P[j][0], P[j][1]); c.stroke()
      }
      for (const p of P) {
        const o = 0.3 + 0.7 * (1 - (p[2] + CORE) / (2 * CORE))
        c.fillStyle = `rgba(94,234,240,${o.toFixed(3)})`
        c.beginPath(); c.arc(p[0], p[1], p[2] < 0 ? 2.6 : 1.6, 0, Math.PI * 2); c.fill()
      }
      c.fillStyle = 'rgba(255,255,255,0.92)'
      c.shadowBlur = 16; c.shadowColor = C.gold
      c.beginPath(); c.arc(cx, cy, 3, 0, Math.PI * 2); c.fill()
      c.shadowBlur = 0
    }

    function loop() {
      draw()
      // El giro es el punto de esta variante, así que el rAF vive mientras el
      // panel esté a la vista; el IntersectionObserver lo corta al salir.
      spin += 0.006
      if (visible) raf = requestAnimationFrame(loop)
    }

    if (reduced) draw()
    else {
      const io = new IntersectionObserver(es => {
        const nowVisible = es[0].isIntersecting
        if (nowVisible && !visible) { visible = true; raf = requestAnimationFrame(loop) }
        else if (!nowVisible) { visible = false; cancelAnimationFrame(raf) }
      }, { threshold: 0 })
      io.observe(cv)
      cleanupIO = () => io.disconnect()
      raf = requestAnimationFrame(loop)
    }

    redrawRef.current = () => draw()
    if (document.fonts?.ready) document.fonts.ready.then(() => draw())

    return () => {
      cancelAnimationFrame(raf)
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
