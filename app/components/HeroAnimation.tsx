'use client'
import { useEffect, useRef, useState } from 'react'

// ─── Terreno de rendimiento 3D ────────────────────────────────────────────────
// La cresta frontal del terreno ES la equity curve original (misma silueta de
// marca), extruida en profundidad como una cordillera wireframe dorada que
// ondea lentamente. Canvas 2D con proyección en perspectiva, oclusión sólida
// (pintado back-to-front) y niebla de profundidad.
//
// Robustez de primer impacto:
//  - entrada coreografiada: el relieve se levanta desde un plano liso (2s)
//  - un solo requestAnimationFrame; pausa si el hero sale del viewport o la
//    pestaña se oculta (IntersectionObserver + document.hidden)
//  - prefers-reduced-motion → un frame estático, sin loop ni cometa
//  - determinista (sin Math.random en render) — sin saltos entre cargas

// Silueta de la equity curve original — y en px del viewBox 800×380 de antes
const POINTS = [
  [0, 300], [40, 280], [80, 295], [120, 260], [160, 240], [200, 255], [240, 220],
  [280, 200], [320, 215], [360, 185], [400, 170], [440, 155], [480, 168], [520, 140],
  [560, 120], [600, 130], [640, 105], [680, 90], [720, 100], [760, 78], [800, 60],
]

const GOLD = '212,175,55'
const BG   = '4,5,10'

const COLS  = 46   // resolución horizontal de la malla
const ROWS  = 24   // filas de profundidad
const FOCAL = 2.1  // fuerza de la perspectiva

const SYMBOLS   = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
const SYM_LABEL: Record<string, string> = { BTCUSDT: 'BTC', ETHUSDT: 'ETH', SOLUSDT: 'SOL', BNBUSDT: 'BNB' }
const FALLBACK  = [
  { sym: 'BTC', price: '—', change: '…', up: true  },
  { sym: 'ETH', price: '—', change: '…', up: true  },
  { sym: 'SOL', price: '—', change: '…', up: false },
  { sym: 'BNB', price: '—', change: '…', up: true  },
]

interface Ticker { sym: string; price: string; change: string; up: boolean }

export default function HeroAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawn,   setDrawn]   = useState(false)
  const [tick,    setTick]    = useState(0)
  const [tickers, setTickers] = useState<Ticker[]>(FALLBACK)

  // Fade del ticker strip cuando el terreno ya se levantó
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

  // ── Render del terreno ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cv = canvas, cx2d = ctx

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Perfil de elevación de la marca (0..1), muestreado a COLS columnas
    const profile: number[] = []
    for (let c = 0; c <= COLS; c++) {
      const px = (c / COLS) * 800
      let j = 0
      while (j < POINTS.length - 2 && POINTS[j + 1][0] < px) j++
      const [x0, y0] = POINTS[j]
      const [x1, y1] = POINTS[j + 1]
      const tt = Math.min(Math.max((px - x0) / ((x1 - x0) || 1), 0), 1)
      profile.push((300 - (y0 + (y1 - y0) * tt)) / 240)
    }

    // Ruido de valor determinista — el relieve profundo de la cordillera
    const rand = (i: number, j: number) => {
      const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
      return s - Math.floor(s)
    }
    const smooth = (v: number) => v * v * (3 - 2 * v)
    const noise2 = (x: number, y: number) => {
      const xi = Math.floor(x), yi = Math.floor(y)
      const xf = smooth(x - xi), yf = smooth(y - yi)
      const a = rand(xi, yi),     b = rand(xi + 1, yi)
      const c = rand(xi, yi + 1), d = rand(xi + 1, yi + 1)
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
    }

    // Altura del terreno: marca al frente, cordillera al fondo, ondeo lento
    function heightAt(c: number, z: number, t: number): number {
      const brand = profile[c] * Math.max(0, 1 - z * 0.62) * 0.78
      const ridge = noise2(c * 0.34 + 2.7, z * 5.6 + 1.3) * (0.20 + z * 0.55)
      const wave  = Math.sin(c * 0.31 + z * 6.5 + t * 0.35) * 0.03 * (0.25 + z)
      return brand + ridge * 0.6 + wave
    }

    let raf = 0
    let inView = true
    const start = performance.now()
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }

    function resize() {
      const dpr = window.devicePixelRatio || 1
      cv.width  = cv.clientWidth * dpr
      cv.height = cv.clientHeight * dpr
      cx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const onMouse = (e: MouseEvent) => {
      mouse.tx = e.clientX / window.innerWidth - 0.5
      mouse.ty = e.clientY / window.innerHeight - 0.5
    }
    if (!reduced) window.addEventListener('mousemove', onMouse)

    // Pausa cuando el hero sale de pantalla — el primer impacto no debe
    // seguir cobrando CPU tres secciones más abajo
    const io = new IntersectionObserver(([e]) => {
      const was = inView
      inView = e.isIntersecting
      if (inView && !was && !reduced) raf = requestAnimationFrame(frame)
    }, { threshold: 0.05 })
    io.observe(cv)

    function drawScene(t: number) {
      const W = cv.clientWidth, H = cv.clientHeight
      if (W === 0 || H === 0) return
      cx2d.clearRect(0, 0, W, H)

      // Entrada: el relieve se levanta desde un plano liso
      const reveal = reduced ? 1 : Math.min(1, Math.max(0, (t - 0.2) / 2.0))
      const rev    = 1 - Math.pow(1 - reveal, 3)

      // Parallax suavizado
      mouse.x += (mouse.tx - mouse.x) * 0.055
      mouse.y += (mouse.ty - mouse.y) * 0.055

      const horizonY = H * 0.30
      const baseY    = H * 0.88
      const centerX  = W * 0.56
      const AMP      = H * 0.36 * rev

      // Resplandor del horizonte
      const hg = cx2d.createLinearGradient(0, horizonY - 24, 0, horizonY + 90)
      hg.addColorStop(0,   `rgba(${GOLD},0)`)
      hg.addColorStop(0.4, `rgba(${GOLD},${(0.05 * rev).toFixed(3)})`)
      hg.addColorStop(1,   `rgba(${GOLD},0)`)
      cx2d.fillStyle = hg
      cx2d.fillRect(0, horizonY - 24, W, 114)

      let frontPts: Array<[number, number]> = []

      // Filas de atrás hacia adelante (oclusión sólida)
      for (let r = ROWS - 1; r >= 0; r--) {
        const z = r / (ROWS - 1)                    // 0 = frente · 1 = horizonte
        const s = 1 / (1 + z * FOCAL)
        const rowY   = horizonY + (baseY - horizonY) * Math.pow(s, 1.18) + mouse.y * 13 * z
        const halfW  = W * 0.56 * (0.34 + 0.66 * s)
        const xShift = mouse.x * 30 * z

        const pts: Array<[number, number]> = []
        for (let c = 0; c <= COLS; c++) {
          const xN = c / COLS - 0.5
          const sx = centerX + xN * 2 * halfW + xShift
          const sy = rowY - heightAt(c, z, t) * AMP * s
          pts.push([sx, sy])
        }
        if (r === 0) frontPts = pts

        // Banda de oclusión: la montaña tapa lo que tiene detrás
        cx2d.beginPath()
        cx2d.moveTo(pts[0][0], pts[0][1])
        for (let c = 1; c <= COLS; c++) cx2d.lineTo(pts[c][0], pts[c][1])
        cx2d.lineTo(pts[COLS][0], H + 4)
        cx2d.lineTo(pts[0][0], H + 4)
        cx2d.closePath()
        cx2d.fillStyle = `rgba(${BG},0.92)`
        cx2d.fill()

        // Línea de la fila — niebla de profundidad
        const alpha = (0.07 + (1 - z) * 0.34) * rev
        cx2d.strokeStyle = `rgba(${GOLD},${alpha.toFixed(3)})`
        cx2d.lineWidth   = 0.6 + (1 - z) * 0.8
        cx2d.beginPath()
        cx2d.moveTo(pts[0][0], pts[0][1])
        for (let c = 1; c <= COLS; c++) cx2d.lineTo(pts[c][0], pts[c][1])
        cx2d.stroke()
      }

      // ── Cresta frontal: la firma de marca con tratamiento plasma ──
      if (frontPts.length) {
        const crest = () => {
          cx2d.beginPath()
          cx2d.moveTo(frontPts[0][0], frontPts[0][1])
          for (let c = 1; c <= COLS; c++) cx2d.lineTo(frontPts[c][0], frontPts[c][1])
        }
        // Aura ancha
        cx2d.save()
        cx2d.shadowColor = `rgba(${GOLD},0.85)`
        cx2d.shadowBlur  = 16
        cx2d.strokeStyle = `rgba(${GOLD},${(0.85 * rev).toFixed(3)})`
        cx2d.lineWidth   = 2
        crest(); cx2d.stroke()
        cx2d.restore()
        // Núcleo caliente
        cx2d.strokeStyle = `rgba(255,252,215,${(0.8 * rev).toFixed(3)})`
        cx2d.lineWidth   = 0.8
        crest(); cx2d.stroke()

        const [ex, ey] = frontPts[COLS]

        // Cometa recorriendo la cresta (arranca tras la entrada, vuelta de 10s)
        if (!reduced && t > 2.8) {
          const u = ((t - 2.8) % 10) / 10
          const cometAt = (uu: number): [number, number] => {
            const f = Math.min(Math.max(uu, 0), 1) * COLS
            const i0 = Math.floor(f), i1 = Math.min(i0 + 1, COLS)
            const ft = f - i0
            return [
              frontPts[i0][0] + (frontPts[i1][0] - frontPts[i0][0]) * ft,
              frontPts[i0][1] + (frontPts[i1][1] - frontPts[i0][1]) * ft,
            ]
          }
          // Cola
          for (let k = 1; k <= 3; k++) {
            const [tx2, ty2] = cometAt(u - k * 0.022)
            cx2d.fillStyle = `rgba(${GOLD},${(0.38 / k).toFixed(3)})`
            cx2d.beginPath(); cx2d.arc(tx2, ty2, 3.4 - k * 0.7, 0, Math.PI * 2); cx2d.fill()
          }
          // Cabeza
          const [hx, hy] = cometAt(u)
          cx2d.save()
          cx2d.shadowColor = `rgba(${GOLD},0.95)`
          cx2d.shadowBlur  = 14
          cx2d.fillStyle   = 'rgba(255,255,255,0.95)'
          cx2d.beginPath(); cx2d.arc(hx, hy, 3.6, 0, Math.PI * 2); cx2d.fill()
          cx2d.restore()

          // Anillo expandiéndose cuando el cometa llega al pico
          if (u > 0.965 || u < 0.08) {
            const ph = u > 0.9 ? (u - 0.965) / 0.115 : (u + 0.035) / 0.115
            cx2d.strokeStyle = `rgba(${GOLD},${(0.5 * (1 - ph)).toFixed(3)})`
            cx2d.lineWidth = 1.4
            cx2d.beginPath(); cx2d.arc(ex, ey, 5 + ph * 14, 0, Math.PI * 2); cx2d.stroke()
          }
        }

        // Punto final vivo — el rendimiento de hoy
        cx2d.save()
        cx2d.shadowColor = `rgba(${GOLD},0.9)`
        cx2d.shadowBlur  = 12
        cx2d.fillStyle   = `rgba(${GOLD},${(0.95 * rev).toFixed(3)})`
        cx2d.beginPath(); cx2d.arc(ex, ey, 4.4, 0, Math.PI * 2); cx2d.fill()
        cx2d.restore()
      }
    }

    function frame(now: number) {
      if (!inView) return
      if (!document.hidden) drawScene((now - start) / 1000)
      raf = requestAnimationFrame(frame)
    }

    if (reduced) {
      // Un frame estático — todo el relieve, sin loop
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

      {/* ── Terreno 3D ─────────────────────────────────────────────────────── */}
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
        /* En mobile el headline ocupa todo el ancho — el terreno se atenúa para
           que el texto no compita visualmente contra la escena detrás. */
        @media (max-width: 640px) {
          .hero-chart { opacity: 0.26 !important; width: 82% !important; }
        }
      `}</style>
    </div>
  )
}
