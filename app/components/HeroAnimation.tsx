'use client'
import { useEffect, useRef, useState } from 'react'

// ─── Velas japonesas 3D + equity curve firma ─────────────────────────────────
// El hero es un gráfico financiero inequívoco: candlesticks con volumen físico
// (cara frontal, tapa iluminada, costado en sombra — proyección oblicua) que
// crecen desde la base uno a uno, y la equity curve dorada de la marca con su
// cometa cruzando por encima de los cierres. La última vela "late" como un
// precio formándose en vivo.
//
// Robustez de primer impacto: un solo rAF, pausa vía IntersectionObserver y
// document.hidden, prefers-reduced-motion = frame estático, determinista
// (sin Math.random en render), mobile atenuado.

// Silueta de la equity curve original (viewBox 800×380 del SVG histórico)
const POINTS = [
  [0, 300], [40, 280], [80, 295], [120, 260], [160, 240], [200, 255], [240, 220],
  [280, 200], [320, 215], [360, 185], [400, 170], [440, 155], [480, 168], [520, 140],
  [560, 120], [600, 130], [640, 105], [680, 90], [720, 100], [760, 78], [800, 60],
]

const GOLD = '212,175,55'
const N_CANDLES = 24

const SYMBOLS   = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
const SYM_LABEL: Record<string, string> = { BTCUSDT: 'BTC', ETHUSDT: 'ETH', SOLUSDT: 'SOL', BNBUSDT: 'BNB' }
const FALLBACK  = [
  { sym: 'BTC', price: '—', change: '…', up: true  },
  { sym: 'ETH', price: '—', change: '…', up: true  },
  { sym: 'SOL', price: '—', change: '…', up: false },
  { sym: 'BNB', price: '—', change: '…', up: true  },
]

interface Ticker { sym: string; price: string; change: string; up: boolean }

// Elevación 0..1 de la curva de marca en u∈[0,1]
function profileAt(u: number): number {
  const px = u * 800
  let j = 0
  while (j < POINTS.length - 2 && POINTS[j + 1][0] < px) j++
  const [x0, y0] = POINTS[j]
  const [x1, y1] = POINTS[j + 1]
  const t = Math.min(Math.max((px - x0) / ((x1 - x0) || 1), 0), 1)
  return (300 - (y0 + (y1 - y0) * t)) / 240
}

// Pseudo-random determinista por índice (mechas de las velas)
function det(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export default function HeroAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawn,   setDrawn]   = useState(false)
  const [tick,    setTick]    = useState(0)
  const [tickers, setTickers] = useState<Ticker[]>(FALLBACK)

  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 1200)
    return () => clearTimeout(t)
  }, [])

  // Live prices from Binance public API
  useEffect(() => {
    async function fetchPrices() {
      try {
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(SYMBOLS)}`
        const res  = await fetch(url, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as Array<{ symbol: string; lastPrice: string; priceChangePercent: string }>
        setTickers(data.map(d => {
          const pct = parseFloat(d.priceChangePercent)
          const px  = parseFloat(d.lastPrice)
          return {
            sym:    SYM_LABEL[d.symbol] ?? d.symbol,
            price:  px >= 1000 ? px.toLocaleString('en-US', { maximumFractionDigits: 0 }) : px.toFixed(2),
            change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
            up:     pct >= 0,
          }
        }))
      } catch { /* keep fallback */ }
    }
    fetchPrices()
    const id = setInterval(fetchPrices, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(n => (n + 1) % tickers.length), 3000)
    return () => clearInterval(id)
  }, [tickers.length])

  // ── Render de la escena ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cv = canvas, g = ctx

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // OHLC determinista derivado de la curva de marca: cada vela abre en el
    // cierre anterior y cierra sobre la curva — velas y curva cuentan la
    // misma historia
    const candles = Array.from({ length: N_CANDLES }, (_, i) => {
      const open  = profileAt(i / N_CANDLES)
      const close = profileAt((i + 1) / N_CANDLES)
      const hi    = Math.max(open, close) + 0.02 + det(i, 1) * 0.05
      const lo    = Math.min(open, close) - 0.02 - det(i, 2) * 0.05
      return { open, close, hi, lo, up: close >= open }
    })

    let raf = 0
    let inView = true
    const start = performance.now()
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }

    function resize() {
      const dpr = window.devicePixelRatio || 1
      cv.width  = cv.clientWidth * dpr
      cv.height = cv.clientHeight * dpr
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const onMouse = (e: MouseEvent) => {
      mouse.tx = e.clientX / window.innerWidth - 0.5
      mouse.ty = e.clientY / window.innerHeight - 0.5
    }
    if (!reduced) window.addEventListener('mousemove', onMouse)

    const io = new IntersectionObserver(([e]) => {
      const was = inView
      inView = e.isIntersecting
      if (inView && !was && !reduced) raf = requestAnimationFrame(frame)
    }, { threshold: 0.05 })
    io.observe(cv)

    const ease = (v: number) => 1 - Math.pow(1 - Math.min(Math.max(v, 0), 1), 3)

    function drawScene(t: number) {
      const W = cv.clientWidth, H = cv.clientHeight
      if (W === 0 || H === 0) return
      g.clearRect(0, 0, W, H)

      // Parallax suavizado por capas
      mouse.x += (mouse.tx - mouse.x) * 0.055
      mouse.y += (mouse.ty - mouse.y) * 0.055

      // Área del gráfico
      const left  = W * 0.05, right = W * 0.97
      const baseY = H * 0.855, topY  = H * 0.14
      const toY   = (e: number) => baseY - e * (baseY - topY) * 0.92

      const gridRev = reduced ? 1 : ease(t / 0.7)

      // ── Grid de precios (niveles horizontales punteados + eje base) ──
      const gx = mouse.x * 22, gy = mouse.y * 12
      g.save()
      g.translate(gx, gy)
      g.setLineDash([3, 9])
      for (let k = 1; k <= 4; k++) {
        const y = toY(k * 0.24)
        g.strokeStyle = `rgba(${GOLD},${(0.055 * gridRev).toFixed(3)})`
        g.lineWidth = 1
        g.beginPath(); g.moveTo(left, y); g.lineTo(right, y); g.stroke()
      }
      g.setLineDash([])
      // Eje base
      g.strokeStyle = `rgba(${GOLD},${(0.16 * gridRev).toFixed(3)})`
      g.beginPath(); g.moveTo(left, baseY + 1); g.lineTo(right, baseY + 1); g.stroke()
      g.restore()

      // ── Velas 3D (proyección oblicua) ──
      const cx3 = mouse.x * 16, cy3 = mouse.y * 9
      const step  = (right - left) / N_CANDLES
      const bodyW = step * 0.5
      const d     = Math.min(13, step * 0.42)   // profundidad de extrusión
      const ox    = d * 0.62, oy = -d * 0.4     // vector de fuga (arriba-derecha)

      g.save()
      g.translate(cx3, cy3)

      for (let i = 0; i < N_CANDLES; i++) {
        const c = candles[i]
        // Entrada escalonada: cada vela crece desde la base
        const grow = reduced ? 1 : ease((t - 0.15 - i * 0.055) / 0.5)
        if (grow <= 0) continue

        // La última vela "late" — precio formándose en vivo
        let close = c.close, hi = c.hi
        if (i === N_CANDLES - 1 && !reduced && t > 2.2) {
          const breath = Math.sin(t * 1.7) * 0.5 + Math.sin(t * 3.3) * 0.5
          close = c.close + breath * 0.012
          hi    = c.hi + Math.max(0, breath) * 0.01
        }

        const x     = left + i * step + (step - bodyW) / 2
        const yO    = toY(c.open), yC = toY(close)
        const yTop0 = Math.min(yO, yC), yBot0 = Math.max(yO, yC)
        // crecer desde la base: interpola hacia baseY
        const yTop = baseY - (baseY - yTop0) * grow
        const yBot = baseY - (baseY - yBot0) * grow
        const yHi  = baseY - (baseY - toY(hi)) * grow
        const yLo  = baseY - (baseY - toY(c.lo)) * grow
        const xm   = x + bodyW / 2

        const a = grow // alpha acompaña el crecimiento
        const up = c.up

        // Mecha (detrás del cuerpo)
        g.strokeStyle = up ? `rgba(${GOLD},${(0.55 * a).toFixed(3)})` : `rgba(248,113,113,${(0.4 * a).toFixed(3)})`
        g.lineWidth = 1
        g.beginPath(); g.moveTo(xm, yHi); g.lineTo(xm, yLo); g.stroke()

        // Cara lateral derecha (sombra)
        g.fillStyle = up ? `rgba(${GOLD},${(0.13 * a).toFixed(3)})` : `rgba(248,113,113,${(0.09 * a).toFixed(3)})`
        g.beginPath()
        g.moveTo(x + bodyW, yTop)
        g.lineTo(x + bodyW + ox, yTop + oy)
        g.lineTo(x + bodyW + ox, yBot + oy)
        g.lineTo(x + bodyW, yBot)
        g.closePath(); g.fill()

        // Tapa superior (luz)
        g.fillStyle = up ? `rgba(255,252,215,${(0.30 * a).toFixed(3)})` : `rgba(248,113,113,${(0.20 * a).toFixed(3)})`
        g.beginPath()
        g.moveTo(x, yTop)
        g.lineTo(x + ox, yTop + oy)
        g.lineTo(x + bodyW + ox, yTop + oy)
        g.lineTo(x + bodyW, yTop)
        g.closePath(); g.fill()

        // Cara frontal
        const bodyH = Math.max(yBot - yTop, 1.5)
        const grad = g.createLinearGradient(0, yTop, 0, yTop + bodyH)
        if (up) {
          grad.addColorStop(0, `rgba(${GOLD},${(0.34 * a).toFixed(3)})`)
          grad.addColorStop(1, `rgba(${GOLD},${(0.16 * a).toFixed(3)})`)
        } else {
          grad.addColorStop(0, `rgba(248,113,113,${(0.24 * a).toFixed(3)})`)
          grad.addColorStop(1, `rgba(248,113,113,${(0.10 * a).toFixed(3)})`)
        }
        g.fillStyle = grad
        g.fillRect(x, yTop, bodyW, bodyH)
        g.strokeStyle = up ? `rgba(${GOLD},${(0.75 * a).toFixed(3)})` : `rgba(248,113,113,${(0.5 * a).toFixed(3)})`
        g.lineWidth = 1
        g.strokeRect(x, yTop, bodyW, bodyH)
      }
      g.restore()

      // ── Equity curve firma (por encima de los cierres) ──
      const lx = mouse.x * 7, ly = mouse.y * 4
      const curveRev = reduced ? 1 : ease((t - 0.9) / 1.7)
      if (curveRev > 0) {
        const pts: Array<[number, number]> = POINTS.map(([px, py]) => [
          left + (px / 800) * (right - left) + lx,
          toY((300 - py) / 240) + ly,
        ])
        const upTo = Math.max(2, Math.ceil(pts.length * curveRev))
        const path = () => {
          g.beginPath()
          g.moveTo(pts[0][0], pts[0][1])
          for (let i = 1; i < upTo; i++) {
            const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
            const mx = (x0 + x1) / 2
            g.bezierCurveTo(mx, y0, mx, y1, x1, y1)
          }
        }
        // Aura
        g.save()
        g.shadowColor = `rgba(${GOLD},0.85)`
        g.shadowBlur  = 15
        g.strokeStyle = `rgba(${GOLD},0.85)`
        g.lineWidth   = 2
        path(); g.stroke()
        g.restore()
        // Núcleo caliente
        g.strokeStyle = 'rgba(255,252,215,0.8)'
        g.lineWidth   = 0.8
        path(); g.stroke()

        // Punto final vivo
        if (curveRev >= 1) {
          const [ex, ey] = pts[pts.length - 1]
          g.save()
          g.shadowColor = `rgba(${GOLD},0.9)`
          g.shadowBlur  = 12
          g.fillStyle   = `rgba(${GOLD},0.95)`
          g.beginPath(); g.arc(ex, ey, 4.2, 0, Math.PI * 2); g.fill()
          g.restore()

          // Cometa recorriendo la curva (vuelta de 10s)
          if (!reduced && t > 2.8) {
            const u = ((t - 2.8) % 10) / 10
            const at = (uu: number): [number, number] => {
              const f = Math.min(Math.max(uu, 0), 1) * (pts.length - 1)
              const i0 = Math.floor(f), i1 = Math.min(i0 + 1, pts.length - 1)
              const ft = f - i0
              return [
                pts[i0][0] + (pts[i1][0] - pts[i0][0]) * ft,
                pts[i0][1] + (pts[i1][1] - pts[i0][1]) * ft,
              ]
            }
            for (let k = 1; k <= 3; k++) {
              const [tx2, ty2] = at(u - k * 0.022)
              g.fillStyle = `rgba(${GOLD},${(0.38 / k).toFixed(3)})`
              g.beginPath(); g.arc(tx2, ty2, 3.4 - k * 0.7, 0, Math.PI * 2); g.fill()
            }
            const [hx, hy] = at(u)
            g.save()
            g.shadowColor = `rgba(${GOLD},0.95)`
            g.shadowBlur  = 14
            g.fillStyle   = 'rgba(255,255,255,0.95)'
            g.beginPath(); g.arc(hx, hy, 3.5, 0, Math.PI * 2); g.fill()
            g.restore()
            // Anillo al llegar al pico
            if (u > 0.965 || u < 0.08) {
              const ph = u > 0.9 ? (u - 0.965) / 0.115 : (u + 0.035) / 0.115
              g.strokeStyle = `rgba(${GOLD},${(0.5 * (1 - ph)).toFixed(3)})`
              g.lineWidth = 1.4
              g.beginPath(); g.arc(ex, ey, 5 + ph * 14, 0, Math.PI * 2); g.stroke()
            }
          }
        }
      }
    }

    function frame(now: number) {
      if (!inView) return
      if (!document.hidden) drawScene((now - start) / 1000)
      raf = requestAnimationFrame(frame)
    }

    if (reduced) {
      drawScene(1000)
    } else {
      raf = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
    }
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>

      {/* ── Gráfico de velas 3D + curva firma ─────────────────────────────── */}
      <div className="absolute right-0 top-0 h-full hero-chart" style={{ width: '58%' }}>
        <canvas ref={canvasRef} className="w-full h-full" />
        {/* Fundido hacia el lado del headline para que el texto respire */}
        <div className="absolute inset-y-0 left-0 w-40" style={{ background: 'linear-gradient(90deg, #04050a, transparent)' }} />
      </div>

      {/* ── Live ticker strip ─────────────────────────────────────────────── */}
      <div
        className="absolute bottom-8 left-0 right-0 flex items-center gap-6 px-8 transition-opacity duration-700"
        style={{ opacity: drawn ? 0.6 : 0 }}
      >
        {tickers.map((t, i) => (
          <div
            key={t.sym}
            className="flex items-center gap-2 transition-all duration-500"
            style={{ opacity: Math.abs(i - tick) < 3 ? 1 : 0.3 }}
          >
            <span className="terminal-text text-[10px] text-text-dim tracking-widest">{t.sym}</span>
            <span className="terminal-text text-[11px] text-text num tabular-nums">{t.price}</span>
            <span className={`terminal-text text-[10px] num ${t.up ? 'text-emerald-400' : 'text-red-400'}`}>
              {t.change}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        /* En mobile el headline ocupa todo el ancho — el gráfico se atenúa para
           que el texto no compita visualmente contra la escena detrás. */
        @media (max-width: 640px) {
          .hero-chart { opacity: 0.26 !important; width: 82% !important; }
        }
      `}</style>
    </div>
  )
}
