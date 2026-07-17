'use client'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createChart, ColorType, CrosshairMode, AreaSeries } from 'lightweight-charts'
import { C, F, cardStyle, numberEmboss } from '@/app/lib/constants'

// ── Symbol config ──────────────────────────────────────────────────────────────

interface SymCfg {
  label: string
  src: 'binance' | 'yahoo'   // yahoo: sin par en Binance — klines vía /api/market/klines
  pair?: string
  ws?: string
}

const SYMBOLS: SymCfg[] = [
  // Motor 1 — crypto (Binance spot)
  { label: 'BTC',  src: 'binance', pair: 'BTCUSDT', ws: 'btcusdt' },
  { label: 'ETH',  src: 'binance', pair: 'ETHUSDT', ws: 'ethusdt' },
  { label: 'SOL',  src: 'binance', pair: 'SOLUSDT', ws: 'solusdt' },
  { label: 'BNB',  src: 'binance', pair: 'BNBUSDT', ws: 'bnbusdt' },
  { label: 'LTC',  src: 'binance', pair: 'LTCUSDT', ws: 'ltcusdt' },
  // Motor 2 — commodities (futuros vía Yahoo)
  { label: 'XAU',  src: 'yahoo' },
  { label: 'WTI',  src: 'yahoo' },
  { label: 'XPD',  src: 'yahoo' },
  { label: 'URNM', src: 'yahoo' },
  // Motor 3 — S&P 500 stocks (Yahoo)
  { label: 'AAPL', src: 'yahoo' },
  { label: 'NVDA', src: 'yahoo' },
  { label: 'TSLA', src: 'yahoo' },
  { label: 'JPM',  src: 'yahoo' },
  { label: 'XOM',  src: 'yahoo' },
  // Motor 4 — índices (ETFs vía Yahoo)
  { label: 'SPY',  src: 'yahoo' },
  { label: 'QQQ',  src: 'yahoo' },
  { label: 'IWM',  src: 'yahoo' },
  { label: 'XLE',  src: 'yahoo' },
  // Motor 5 — internacional (ETFs país vía Yahoo)
  { label: 'EWJ',  src: 'yahoo' },
  { label: 'EWT',  src: 'yahoo' },
  { label: 'EWY',  src: 'yahoo' },
]

// Agrupación visual por motor (mismos labels que el rail de precios del HUD)
const SYMBOL_GROUPS = [
  { tag: 'M1 · CRYPTO', labels: ['BTC', 'ETH', 'SOL', 'BNB', 'LTC'] },
  { tag: 'M2 · COMM',   labels: ['XAU', 'WTI', 'XPD', 'URNM'] },
  { tag: 'M3 · STOCKS', labels: ['AAPL', 'NVDA', 'TSLA', 'JPM', 'XOM'] },
  { tag: 'M4 · ÍNDICES', labels: ['SPY', 'QQQ', 'IWM', 'XLE'] },
  { tag: 'M5 · INTL', labels: ['EWJ', 'EWT', 'EWY'] },
]

type SymLabel = string

const TIMEFRAMES = ['15m', '1h', '4h', '1d'] as const
type TF = typeof TIMEFRAMES[number]

// Binance interval strings
const TF_INTERVAL: Record<TF, string> = { '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' }

// ── Types ──────────────────────────────────────────────────────────────────────

interface Kline { time: number; value: number }
interface Stats {
  price: number
  change24h: number
  volume24h: number
  high24h?: number
  low24h?: number
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtPrice(v: number): string {
  if (v >= 1000) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (v >= 1)    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  return v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

// Versión corta para espacios reducidos (rango 24h)
function fmtPriceShort(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(1)}K`
  if (v >= 1000)  return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (v >= 1)     return v.toFixed(2)
  return v.toFixed(4)
}

function fmtVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

// ── Superposición de futuros ─────────────────────────────────────────────────
// Trayectorias normalizadas (±1 en la frontera) que forman el "cono" de
// probabilidad hacia el futuro. Se generan una vez; el ancho real en pantalla
// sale de la volatilidad reciente del activo (ver overlay en PriceChart).
const SUPER_STEPS = 22
const SUPER_TRAJ  = 58
const SUPER: number[][] = (() => {
  const arr: number[][] = []
  for (let i = 0; i < SUPER_TRAJ; i++) {
    const off = [0]; let v = (Math.random() - 0.5) * 0.3
    for (let s = 1; s <= SUPER_STEPS; s++) { v += (Math.random() - 0.5) * 0.45; v *= 0.95; off.push(off[s - 1] + v) }
    arr.push(off)
  }
  let mx = 0.0001; arr.forEach(o => { mx = Math.max(mx, Math.abs(o[SUPER_STEPS])) })
  arr.forEach(o => { for (let s = 0; s <= SUPER_STEPS; s++) o[s] /= mx })
  return arr
})()
const SUPER_P50: number[] = (() => {
  const b: number[] = []
  for (let s = 0; s <= SUPER_STEPS; s++) { const c = SUPER.map(o => o[s]).sort((x, y) => x - y); b.push(c[Math.round(0.5 * (SUPER_TRAJ - 1))]) }
  return b
})()

// ── PriceChart component ───────────────────────────────────────────────────────

interface ChartProps {
  data: Kline[]
  livePrice: number | null
  showSuper: boolean
}

function PriceChart({ data, livePrice, showSuper }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef   = useRef<HTMLCanvasElement>(null)
  const chartRef     = useRef<ReturnType<typeof createChart> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef    = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.VerticalGradient, topColor: '#081324', bottomColor: '#04070f' },
        textColor:  C.dimText,
        fontFamily: 'monospace',
        fontSize:   10,
      },
      grid: {
        vertLines: { color: 'rgba(57,226,230,0.045)' },
        horzLines: { color: 'rgba(57,226,230,0.055)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: C.gold + '50', labelBackgroundColor: C.surface },
        horzLine: { color: C.gold + '50', labelBackgroundColor: C.surface },
      },
      rightPriceScale: { borderColor: C.border },
      // rightOffset deja espacio a la derecha del último dato → ahí vive el cono
      // de superposición de futuros (overlay).
      timeScale:       { borderColor: C.border, rightOffset: 16 },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series = (chart as any).addSeries(AreaSeries, {
      lineColor:   C.glow,
      topColor:    'rgba(57,226,230,0.22)',
      bottomColor: 'rgba(57,226,230,0.00)',
      lineWidth:   2,
      priceLineColor: C.gold + '80',
      crosshairMarkerBorderColor: C.glow,
      crosshairMarkerBackgroundColor: C.bg,
    })

    chartRef.current  = chart
    seriesRef.current = series

    if (data.length) {
      series.setData(data)
      chart.timeScale().fitContent()
    }

    const ro = new ResizeObserver(entries => {
      chart.applyOptions({ width: entries[0].contentRect.width })
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current  = null
      seriesRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount only — data updates handled below

  // Update data when symbol/TF changes
  useEffect(() => {
    if (!seriesRef.current || !data.length) return
    seriesRef.current.setData(data)
    chartRef.current?.timeScale().fitContent()
  }, [data])

  // Update live price candle
  useEffect(() => {
    if (!seriesRef.current || !livePrice || !data.length) return
    const last = data[data.length - 1]
    seriesRef.current.update({ time: last.time, value: livePrice })
  }, [livePrice, data])

  // ── Overlay: superposición de futuros ──────────────────────────────────────
  // Canvas transparente sobre el chart. Cada frame lee las coordenadas reales de
  // lightweight-charts (timeToCoordinate / priceToCoordinate) para anclar el cono
  // al último dato y que siga el zoom/scroll. El ancho sale de la volatilidad
  // reciente (desvío de retornos). Pausa fuera de viewport y respeta reduce-motion.
  useEffect(() => {
    const cv = overlayRef.current, cont = containerRef.current
    if (!cv || !cont) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0, t = 0, visible = true
    const io = new IntersectionObserver(e => { visible = e[0].isIntersecting }, { threshold: 0 })
    io.observe(cont)

    function draw() {
      const w = cont!.clientWidth, h = cont!.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (w && h) {
        if (cv!.width !== Math.round(w * dpr)) { cv!.width = Math.round(w * dpr); cv!.height = Math.round(h * dpr) }
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx!.clearRect(0, 0, w, h)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chart = chartRef.current as any, series = seriesRef.current
        if ((visible || t === 0) && chart && series && showSuper && data.length >= 6) {
          try {
            const last = data[data.length - 1]
            const lastPrice = livePrice ?? last.value
            const x0 = chart.timeScale().timeToCoordinate(last.time)
            const y0 = series.priceToCoordinate(lastPrice)
            const plotW = chart.timeScale().width()
            if (x0 != null && y0 != null) {
              const bs = chart.timeScale().options().barSpacing || 8
              // volatilidad reciente (desvío de retornos)
              let sum = 0, sum2 = 0, n = 0
              for (let i = Math.max(1, data.length - 30); i < data.length; i++) {
                const r = (data[i].value - data[i - 1].value) / (data[i - 1].value || 1); sum += r; sum2 += r * r; n++
              }
              const mean = n ? sum / n : 0
              const sd = n > 1 ? Math.sqrt(Math.max(0, sum2 / n - mean * mean)) : 0.01
              const yA = series.priceToCoordinate(lastPrice * (1 + Math.max(0.004, sd) * 3.4))
              const spreadPx = Math.min(h * 0.42, Math.max(14, Math.abs((yA ?? y0) - y0)))
              const futPx = Math.min(Math.max(0, plotW - x0 - 4), SUPER_STEPS * bs)
              const fx = (s: number) => x0 + (s / SUPER_STEPS) * futPx
              const breathe = reduced ? 1 : 0.82 + 0.18 * Math.sin(t * 0.02)
              const oy = (o: number) => y0 + o * spreadPx * breathe
              ctx!.save(); ctx!.beginPath(); ctx!.rect(x0, 0, Math.max(0, plotW - x0), h); ctx!.clip()
              ctx!.globalCompositeOperation = 'lighter'; ctx!.lineWidth = 1
              for (let i = 0; i < SUPER_TRAJ; i++) {
                const o = SUPER[i]
                ctx!.strokeStyle = 'rgba(79,146,255,0.10)'
                ctx!.beginPath()
                for (let s = 0; s <= SUPER_STEPS; s++) {
                  const wig = reduced ? 0 : Math.sin(t * 0.05 + i * 0.7 + s * 0.4) * 0.03 * (s / SUPER_STEPS)
                  const px = fx(s), py = oy(o[s] + wig)
                  if (s) ctx!.lineTo(px, py); else ctx!.moveTo(px, py)
                }
                ctx!.stroke()
                if (!reduced) {
                  const fp = ((t * 0.006) + (i * 0.014)) % 1
                  const sf = fp * SUPER_STEPS, s0 = Math.floor(sf), fr = sf - s0
                  const px = fx(sf), py = oy(o[s0] + (o[Math.min(SUPER_STEPS, s0 + 1)] - o[s0]) * fr)
                  ctx!.fillStyle = 'rgba(125,176,255,' + (0.5 * (1 - fp)).toFixed(2) + ')'
                  ctx!.beginPath(); ctx!.arc(px, py, 1.1, 0, 7); ctx!.fill()
                }
              }
              // mediana (camino más probable) cian → azul
              ctx!.beginPath()
              for (let s = 0; s <= SUPER_STEPS; s++) { const px = fx(s), py = oy(SUPER_P50[s]); if (s) ctx!.lineTo(px, py); else ctx!.moveTo(px, py) }
              const mg = ctx!.createLinearGradient(x0, 0, plotW, 0); mg.addColorStop(0, '#5eeaf0'); mg.addColorStop(1, '#4f92ff')
              ctx!.strokeStyle = mg; ctx!.lineWidth = 1.8; ctx!.shadowColor = '#4f92ff'; ctx!.shadowBlur = 8; ctx!.stroke(); ctx!.shadowBlur = 0
              ctx!.globalCompositeOperation = 'source-over'; ctx!.restore()
              // nodo del "ahora"
              ctx!.fillStyle = '#eaf6ff'; ctx!.shadowColor = '#5eeaf0'; ctx!.shadowBlur = 10; ctx!.beginPath(); ctx!.arc(x0, y0, 3, 0, 7); ctx!.fill(); ctx!.shadowBlur = 0
            }
          } catch { /* si la API del chart no está lista, se reintenta el próximo frame */ }
        }
        if (!reduced) t++
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); io.disconnect() }
  }, [data, livePrice, showSuper])

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%' }} />
      {/* Overlay de superposición — no intercepta el mouse (el crosshair del chart sigue vivo) */}
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }} />
      {/* Watermark Σ — decorativo, no intercepta el mouse */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 2,
        pointerEvents: 'none', zIndex: 1,
      }}>
        <span style={{ fontFamily: F.display, fontSize: 110, lineHeight: 1, color: 'rgba(57,226,230,0.045)' }}>Σ</span>
        <span style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.45em', color: 'rgba(57,226,230,0.07)' }}>SQUANT DESK</span>
      </div>
    </div>
  )
}

// ── Historial del motor por activo ───────────────────────────────────────────
// Operaciones cerradas del motor SIGMA filtradas por el símbolo en pantalla,
// desde /api/vps/trades (respeta el gating Free/PRO del backend). Resumen con
// anillo de win-rate en partículas + lista de operaciones con relieve.
interface MotorTrade {
  sym?: string; direction?: string; tf?: string; strategy?: string; grade?: string
  pnl_pct?: number; pnl_dollar?: number; closed_at?: string; reason?: string; status?: string
  entry?: number; exit?: number; entry_price?: number; exit_price?: number
}
const RES_LABEL: Record<string, [string, string]> = {
  TP_HIT: ['tp', 'TP HIT'], SL_HIT: ['sl', 'SL HIT'], TRAIL_HIT: ['tr', 'TRAILING'],
  TIME_HIT: ['tr', 'TIEMPO'], MANUAL_CLOSE: ['mn', 'MANUAL'],
}
const MH_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function mhDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  return isNaN(d.getTime()) ? '' : `${d.getDate()} ${MH_MONTHS[d.getMonth()]}`
}

function MotorHistory({ sym }: { sym: SymLabel }) {
  const [hist, setHist] = useState<MotorTrade[]>([])
  const [loading, setLoading] = useState(true)
  const ringRef = useRef<HTMLCanvasElement>(null)
  const ringTarget = useRef(0)

  useEffect(() => {
    let alive = true
    fetch('/api/vps/trades', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j) setHist(Array.isArray(j.history) ? j.history : []) })
      .catch(e => console.error('[terminal] historial del motor no disponible:', e))
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const ops = useMemo(() =>
    hist.filter(t => (t.sym ?? '').toUpperCase() === sym.toUpperCase())
        .sort((a, b) => (b.closed_at ?? '').localeCompare(a.closed_at ?? ''))
        .slice(0, 40),
  [hist, sym])

  const S = useMemo(() => {
    const n = ops.length
    const wins = ops.filter(o => (o.pnl_pct ?? 0) > 0).length
    const pnl = ops.reduce((s, o) => s + (o.pnl_pct ?? 0), 0)
    let streak = 0; let sg: boolean | null = null
    for (const o of ops) { const w = (o.pnl_pct ?? 0) > 0; if (sg === null) { sg = w; streak = 1 } else if (w === sg) streak++; else break }
    const pcts = ops.map(o => o.pnl_pct ?? 0)
    return { n, wr: n ? Math.round(wins / n * 100) : 0, pnl, streak, sg, best: pcts.length ? Math.max(...pcts) : 0, worst: pcts.length ? Math.min(...pcts) : 0 }
  }, [ops])
  ringTarget.current = S.n ? S.wr / 100 : 0

  useEffect(() => {
    const cv = ringRef.current; if (!cv) return
    const ctx = cv.getContext('2d'); if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0, t = 0, cur = 0
    function loop() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv!.clientWidth, h = cv!.clientHeight
      if (w && h) {
        if (cv!.width !== Math.round(w * dpr)) { cv!.width = Math.round(w * dpr); cv!.height = Math.round(h * dpr) }
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0); cur += (ringTarget.current - cur) * 0.08; ctx!.clearRect(0, 0, w, h)
        const cx = w / 2, cy = h * 0.46, R = Math.min(w, h) * 0.36, wr = cur, NP = 58
        for (let i = 0; i < NP; i++) {
          const f = i / NP, a = -Math.PI / 2 + f * Math.PI * 2, isW = f <= wr
          const col = isW ? [47, 211, 154] : [90, 100, 124]
          const wob = reduced ? 0 : Math.sin(t * 0.05 + i * 0.6) * 2, rr = R + wob
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.9
          const pulse = isW ? (0.55 + 0.45 * Math.abs(Math.sin(t * 0.06 + i * 0.5))) : 0.3
          ctx!.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${pulse.toFixed(2)})`
          ctx!.beginPath(); ctx!.arc(px, py, isW ? 2 : 1.2, 0, 7); ctx!.fill()
        }
        ctx!.textAlign = 'center'; ctx!.fillStyle = '#eef3fa'; ctx!.font = '700 24px system-ui,sans-serif'; ctx!.fillText(Math.round(wr * 100) + '%', cx, cy + 5)
        ctx!.font = '8px ui-monospace, monospace'; ctx!.fillStyle = '#8b97ad'; ctx!.fillText('WIN RATE', cx, cy + 20)
        if (!reduced) t++
      }
      raf = requestAnimationFrame(loop)
    }
    loop(); return () => cancelAnimationFrame(raf)
  }, [])

  const motorTag = SYMBOL_GROUPS.find(g => g.labels.includes(sym))?.tag ?? ''

  return (
    <div id="motor-hist" style={{ marginTop: 30 }}>
      <style>{`
        #motor-hist .mh-op { display:grid; grid-template-columns:4px 92px 1fr auto auto; gap:12px; align-items:center;
          border:1px solid ${C.border}; border-radius:11px; overflow:hidden;
          background:linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0.004));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 3px 0 rgba(0,0,0,0.35); transition:transform .12s, box-shadow .12s; }
        #motor-hist .mh-op:hover { transform:translateY(-1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 14px -6px rgba(0,0,0,0.6); }
        #motor-hist .mh-stripe { align-self:stretch; }
        #motor-hist .mh-op.win .mh-stripe { background:linear-gradient(180deg, ${C.green}, #158a63); }
        #motor-hist .mh-op.loss .mh-stripe { background:linear-gradient(180deg, ${C.red}, #a13540); }
        #motor-hist .mh-res { font-family:${F.mono}; font-size:8.5px; letter-spacing:.06em; padding:3px 7px; border-radius:5px; white-space:nowrap; }
        #motor-hist .mh-res.tp { color:${C.green}; background:rgba(47,211,154,.12); border:1px solid rgba(47,211,154,.35); }
        #motor-hist .mh-res.sl { color:${C.red}; background:rgba(255,93,108,.12); border:1px solid rgba(255,93,108,.35); }
        #motor-hist .mh-res.tr { color:${C.gold}; background:rgba(57,226,230,.10); border:1px solid rgba(57,226,230,.3); }
        #motor-hist .mh-res.mn { color:${C.muted}; background:rgba(139,151,173,.1); border:1px solid ${C.border}; }
        @media (max-width:640px){ #motor-hist .mh-op { grid-template-columns:4px 70px 1fr auto; } #motor-hist .mh-colr { display:none; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={{ fontFamily: F.display, fontSize: 30, letterSpacing: '0.03em', margin: 0, lineHeight: 0.9 }}>
          HISTORIAL DEL MOTOR <span style={{ background: `linear-gradient(100deg, ${C.glow}, ${C.blue})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{sym}</span>
        </h2>
        {motorTag && <span style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: '0.14em', color: C.gold, border: `1px solid ${C.gold}44`, borderRadius: 999, padding: '3px 10px', background: `${C.gold}12` }}>{motorTag}</span>}
        <span style={{ marginLeft: 'auto', fontFamily: F.mono, fontSize: 10.5, color: C.muted }}>{loading ? 'cargando…' : `${S.n} operación${S.n === 1 ? '' : 'es'} del motor`}</span>
      </div>

      {(!loading && S.n === 0) ? (
        <div style={{ ...cardStyle, background: C.surface, padding: '26px', textAlign: 'center', fontFamily: F.mono, fontSize: 12, color: C.muted }}>
          El motor aún no registró operaciones cerradas en {sym}.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14, alignItems: 'center', marginBottom: 16,
            border: `1px solid ${C.border}`, borderRadius: 14, background: `linear-gradient(180deg, ${C.surface2}, ${C.surface})`, padding: '14px 16px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <canvas ref={ringRef} style={{ width: 140, height: 118, display: 'block' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
              {([
                ['OPERACIONES', String(S.n), C.text],
                ['PNL ACUM.', `${S.pnl >= 0 ? '+' : ''}${S.pnl.toFixed(1)}%`, S.pnl >= 0 ? C.green : C.red],
                ['RACHA', `${S.streak}${S.sg ? 'W' : 'L'}`, C.text],
                ['MEJOR / PEOR', `+${S.best.toFixed(1)} / ${S.worst.toFixed(1)}%`, C.dimText],
              ] as [string, string, string][]).map(([k, v, col], i) => (
                <div key={i} style={{ padding: '9px 11px', border: `1px solid ${C.border}`, borderRadius: 10, background: 'linear-gradient(180deg, rgba(57,226,230,0.03), rgba(0,0,0,0.15))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 3px 0 rgba(0,0,0,0.35)' }}>
                  <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: '0.14em', color: C.muted }}>{k}</div>
                  <div style={{ fontFamily: F.display, fontSize: i === 3 ? 15 : 22, marginTop: 3, letterSpacing: '0.02em', lineHeight: 1, color: col }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {ops.map((o, i) => {
              const win = (o.pnl_pct ?? 0) > 0
              const [rc, rt] = RES_LABEL[o.reason ?? o.status ?? ''] ?? ['mn', (o.reason ?? o.status ?? '—')]
              const dir = (o.direction ?? '').toLowerCase()
              const entry = o.entry ?? o.entry_price, exit = o.exit ?? o.exit_price
              const gcol = (o.grade ?? '').startsWith('A') ? C.gold : C.blue
              return (
                <div key={i} className={`mh-op ${win ? 'win' : 'loss'}`}>
                  <div className="mh-stripe" />
                  <div style={{ padding: '10px 0', fontFamily: F.mono, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: dir === 'long' ? C.green : dir === 'short' ? C.red : C.dimText }}>
                    {dir === 'long' ? '▲ LONG' : dir === 'short' ? '▼ SHORT' : '● —'}
                    <span style={{ display: 'block', fontWeight: 400, fontSize: 8, letterSpacing: '0.14em', color: C.muted, marginTop: 2 }}>{o.tf && o.tf !== '?' ? o.tf : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 0' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{o.strategy ? o.strategy.replace(/_/g, ' ') : 'Estrategia'}</span>
                      {o.grade && <span style={{ fontFamily: F.mono, fontSize: 8.5, fontWeight: 700, borderRadius: 4, padding: '1px 6px', color: gcol, background: `${gcol}1e` }}>{o.grade}</span>}
                    </div>
                    {entry != null && exit != null && (
                      <div style={{ fontFamily: F.mono, fontSize: 10.5, color: C.muted }}>Entrada <b style={{ color: '#c3cede' }}>{fmtPrice(entry)}</b> → Salida <b style={{ color: '#c3cede' }}>{fmtPrice(exit)}</b></div>
                    )}
                  </div>
                  <div className="mh-colr" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <span className={`mh-res ${rc}`}>{rt}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 8.5, color: C.dimText }}>{mhDate(o.closed_at)}</span>
                  </div>
                  <div style={{ textAlign: 'right', paddingRight: 16, minWidth: 92 }}>
                    <div style={{ fontFamily: F.display, fontSize: 21, letterSpacing: '0.02em', lineHeight: 1, color: win ? C.green : C.red }}>{(o.pnl_pct ?? 0) >= 0 ? '+' : ''}{(o.pnl_pct ?? 0).toFixed(2)}%</div>
                    {o.pnl_dollar != null && <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.muted, marginTop: 1 }}>{o.pnl_dollar >= 0 ? '+' : '−'}${Math.abs(o.pnl_dollar).toLocaleString('en-US')}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TerminalPage() {
  const [sym,       setSym]       = useState<SymLabel>('BTC')
  const [tf,        setTf]        = useState<TF>('4h')
  const [klines,    setKlines]    = useState<Kline[]>([])
  const [stats,     setStats]     = useState<Stats | null>(null)
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [showSuper, setShowSuper] = useState(true)

  const symConfig = SYMBOLS.find(s => s.label === sym)!

  // Deep-link: /terminal?symbol=AAPL (usado por la búsqueda del sidebar)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('symbol')?.toUpperCase()
    if (q && SYMBOLS.some(s => s.label === q)) setSym(q)
  }, [])

  // ── Fetch historical klines ──────────────────────────────────────────────────

  const fetchKlines = useCallback(async (cfg: SymCfg, interval: string) => {
    setLoading(true)
    setError(null)
    try {
      if (cfg.src === 'yahoo') {
        const res = await fetch(`/api/market/klines?symbol=${cfg.label}&tf=${interval}`)
        if (!res.ok) throw new Error(`Datos ${res.status}`)
        const d = await res.json()
        const data: Kline[] = Array.isArray(d.klines) ? d.klines : []
        setKlines(data)
        if (d.price != null) {
          setStats({ price: d.price, change24h: d.change24h ?? 0, volume24h: d.volume24h ?? 0 })
        }
      } else {
        const url = `https://api.binance.com/api/v3/klines?symbol=${cfg.pair}&interval=${interval}&limit=150`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Binance ${res.status}`)
        const raw: [number, string, string, string, string, string][] = await res.json()
        const data: Kline[] = raw.map(k => ({
          time:  Math.floor(k[0] / 1000) as unknown as number,
          value: parseFloat(k[4]), // close price
        }))
        setKlines(data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos')
      setKlines([])
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Fetch 24h ticker stats ───────────────────────────────────────────────────

  const fetchStats = useCallback(async (pair: string) => {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`)
      if (!res.ok) return
      const d = await res.json()
      setStats({
        price:     parseFloat(d.lastPrice),
        change24h: parseFloat(d.priceChangePercent),
        volume24h: parseFloat(d.quoteVolume),
        high24h:   parseFloat(d.highPrice),
        low24h:    parseFloat(d.lowPrice),
      })
    } catch {
      // stats are non-critical — fail silently
    }
  }, [])

  // Reload on symbol / timeframe change
  useEffect(() => {
    setLivePrice(null)
    setStats(null)
    fetchKlines(symConfig, TF_INTERVAL[tf])
    if (symConfig.src === 'binance' && symConfig.pair) fetchStats(symConfig.pair)
    // Yahoo no tiene WebSocket — refrescar por polling
    if (symConfig.src === 'yahoo') {
      const id = setInterval(() => fetchKlines(symConfig, TF_INTERVAL[tf]), 60_000)
      return () => clearInterval(id)
    }
  }, [sym, tf, symConfig, fetchKlines, fetchStats])

  // ── Live price WebSocket (solo símbolos Binance) ────────────────────────────

  useEffect(() => {
    if (symConfig.src !== 'binance' || !symConfig.ws) return
    let ws: WebSocket
    let dead = false

    function connect() {
      if (dead) return
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symConfig.ws}@miniTicker`)
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data)
          const p = parseFloat(d.c)
          if (!isNaN(p)) {
            setLivePrice(p)
            setStats(prev => prev ? { ...prev, price: p } : prev)
          }
        } catch {}
      }
      ws.onerror = () => ws.close()
      ws.onclose = () => { if (!dead) setTimeout(connect, 5000) }
    }

    connect()
    return () => { dead = true; ws?.close() }
  }, [symConfig.ws])

  // ── Derived ───────────────────────────────────────────────────────────────────

  const mono: React.CSSProperties = { fontFamily: F.mono }

  const displayPrice = livePrice ?? stats?.price ?? null
  const change24h    = stats?.change24h ?? null
  const changeColor  = change24h === null ? C.dimText : change24h >= 0 ? C.green : C.red
  const hasRange     = stats?.high24h != null && stats?.low24h != null && stats.high24h > stats.low24h
  const rangePct     = hasRange && displayPrice !== null
    ? Math.min(100, Math.max(0, ((displayPrice - stats!.low24h!) / (stats!.high24h! - stats!.low24h!)) * 100))
    : null

  const cardBgSoft = 'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.008))'
  const filoStyle: React.CSSProperties = {
    height: 2,
    background: 'linear-gradient(90deg, rgba(57,226,230,0.85), rgba(79,146,255,0.4) 45%, transparent 82%)',
  }

  return (
    <div id="sigma-terminal" style={{ minHeight: '100vh', background: C.bg, color: C.text, ...mono }}>
      <style>{`
        @keyframes term-pulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
        @keyframes term-shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }

        #sigma-terminal .tsym, #sigma-terminal .ttf {
          font-family: var(--font-dm-mono,'DM Mono','Courier New',monospace);
          cursor: pointer;
          transition: border-color .15s, color .15s, box-shadow .15s, background .15s;
          border: 1px solid ${C.border};
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008));
          color: ${C.dimText};
        }
        #sigma-terminal .tsym {
          font-size: 11px; letter-spacing: .12em;
          padding: 6px 14px; border-radius: 8px;
        }
        #sigma-terminal .ttf {
          font-size: 10px; letter-spacing: .1em;
          padding: 4px 12px; border-radius: 6px;
        }
        #sigma-terminal .tsym:hover, #sigma-terminal .ttf:hover {
          border-color: ${C.border2}; color: ${C.text};
        }
        #sigma-terminal .tsym.on, #sigma-terminal .ttf.on {
          border-color: rgba(57,226,230,0.55);
          background: linear-gradient(180deg, rgba(57,226,230,0.16), rgba(57,226,230,0.04));
          color: ${C.glow};
          box-shadow: 0 0 18px rgba(57,226,230,0.16), inset 0 1px 0 rgba(255,255,255,0.06);
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 64px' }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.25em', color: C.dimText, marginBottom: 6 }}>
            {'// SQUANT DESK · TERMINAL'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
            <h1 style={{
              fontFamily: F.display,
              fontSize: 'clamp(32px,4.5vw,52px)',
              letterSpacing: '0.05em',
              margin: 0,
              lineHeight: 1,
            }}>
              <span style={{
                background: `linear-gradient(100deg, ${C.glow}, #4f92ff)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>{sym}</span>
              <span style={{ color: C.dimText, fontSize: '0.55em', marginLeft: 10 }}>/ {symConfig.src === 'binance' ? 'USDT' : 'USD'}</span>
            </h1>

            {/* Live price block */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              {displayPrice !== null ? (
                <>
                  <span style={{
                    fontFamily: F.display,
                    fontSize: 'clamp(22px,3vw,34px)',
                    color: C.text,
                    letterSpacing: '0.03em',
                    textShadow: numberEmboss,
                  }}>
                    ${fmtPrice(displayPrice)}
                  </span>
                  {change24h !== null && (
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: changeColor,
                      padding: '2px 9px', borderRadius: 999,
                      border: `1px solid ${changeColor}40`,
                      background: `${changeColor}14`,
                    }}>
                      {change24h >= 0 ? '▲ +' : '▼ '}{change24h.toFixed(2)}%
                    </span>
                  )}
                  {livePrice && (
                    <span style={{ fontSize: 8, color: C.green, letterSpacing: '0.15em', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', background: C.green,
                        boxShadow: `0 0 8px ${C.green}`,
                        animation: 'term-pulse 1.6s ease-in-out infinite',
                      }} />
                      LIVE
                    </span>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 13, color: C.muted }}>—</span>
              )}
            </div>
          </div>

          {/* 24h volume */}
          {stats?.volume24h ? (
            <div style={{ fontSize: 10, color: C.dimText, marginTop: 6 }}>
              Vol 24h&nbsp;
              <span style={{ color: C.text }}>{fmtVol(stats.volume24h)}</span>
            </div>
          ) : null}
        </div>

        {/* ── Symbol selector (agrupado por motor) ───────────────────────────── */}
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 16 }}>
          {SYMBOL_GROUPS.map(g => (
            <div key={g.tag}>
              <div style={{ fontSize: 8, letterSpacing: '0.25em', color: C.muted, marginBottom: 6 }}>{g.tag}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {g.labels.map(label => (
                  <button
                    key={label}
                    className={`tsym${sym === label ? ' on' : ''}`}
                    onClick={() => setSym(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Chart card ─────────────────────────────────────────────────────── */}
        <div style={{ ...cardStyle, overflow: 'hidden', background: C.surface }}>
          <div style={filoStyle} />

          {/* Toolbar del chart: par + fuente a la izquierda, timeframes a la derecha */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 10,
            padding: '10px 14px',
            borderBottom: `1px solid ${C.border}`,
            background: 'linear-gradient(90deg, rgba(57,226,230,0.05), rgba(255,255,255,0.015) 45%)',
          }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: C.dimText }}>
              <span style={{ color: C.glow }}>{symConfig.pair ?? `${symConfig.label}/USD`}</span>
              <span style={{ color: C.muted }}>&nbsp;·&nbsp;{symConfig.src === 'binance' ? 'BINANCE SPOT · WS LIVE' : 'YAHOO FINANCE · 60s'}</span>
              {showSuper && <span style={{ color: C.blue }}>&nbsp;&nbsp;+&nbsp;SUPERPOSICIÓN</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                className={`ttf${showSuper ? ' on' : ''}`}
                onClick={() => setShowSuper(v => !v)}
                title="Superposición de futuros — proyección probabilística"
              >
                ⟶ FUTURO
              </button>
              <span style={{ width: 1, height: 16, background: C.border, margin: '0 2px' }} />
              {TIMEFRAMES.map(t => (
                <button key={t} className={`ttf${tf === t ? ' on' : ''}`} onClick={() => setTf(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div style={{
              height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(90deg, ${C.surface} 25%, ${C.surface2} 50%, ${C.surface} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'term-shimmer 1.6s linear infinite',
            }}>
              <span style={{ fontSize: 10, color: C.dimText, letterSpacing: '0.2em' }}>CARGANDO DATOS…</span>
            </div>
          )}
          {error && !loading && (
            <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 10, color: C.red, letterSpacing: '0.15em' }}>ERROR AL CARGAR</span>
              <span style={{ fontSize: 10, color: C.dimText }}>{error}</span>
              <span style={{ fontSize: 9, color: C.muted }}>Este par podría no estar disponible en Binance</span>
            </div>
          )}
          {!loading && !error && klines.length > 0 && (
            <PriceChart data={klines} livePrice={livePrice} showSuper={showSuper} />
          )}
        </div>

        {/* ── Stats cards ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
          marginTop: 14,
        }}>
          {/* PRECIO — tratamiento hero */}
          <div style={{
            ...cardStyle,
            border: `1px solid ${C.gold}40`,
            boxShadow: `${C.shadowCard}, ${C.glowGoldSm}`,
            background: `linear-gradient(160deg, ${C.gold}14, ${C.surface} 60%)`,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 8, letterSpacing: '0.25em', color: C.dimText, marginBottom: 6 }}>PRECIO</div>
            <div style={{ fontFamily: F.display, fontSize: 20, color: C.glow, lineHeight: 1, textShadow: numberEmboss }}>
              {displayPrice !== null ? `$${fmtPrice(displayPrice)}` : '—'}
            </div>
          </div>

          {/* CAMBIO 24H */}
          <div style={{ ...cardStyle, backgroundColor: C.surface, backgroundImage: cardBgSoft, padding: '14px 16px' }}>
            <div style={{ fontSize: 8, letterSpacing: '0.25em', color: C.muted, marginBottom: 6 }}>CAMBIO 24H</div>
            <div style={{ fontFamily: F.display, fontSize: 20, color: changeColor, lineHeight: 1, textShadow: numberEmboss }}>
              {change24h !== null ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%` : '—'}
            </div>
          </div>

          {/* VOLUMEN 24H */}
          <div style={{ ...cardStyle, backgroundColor: C.surface, backgroundImage: cardBgSoft, padding: '14px 16px' }}>
            <div style={{ fontSize: 8, letterSpacing: '0.25em', color: C.muted, marginBottom: 6 }}>VOLUMEN 24H</div>
            <div style={{ fontFamily: F.display, fontSize: 20, color: C.text, lineHeight: 1, textShadow: numberEmboss }}>
              {stats?.volume24h ? fmtVol(stats.volume24h) : '—'}
            </div>
          </div>

          {/* RANGO 24H — barra con posición del precio (solo Binance) */}
          {hasRange && rangePct !== null && (
            <div style={{ ...cardStyle, backgroundColor: C.surface, backgroundImage: cardBgSoft, padding: '14px 16px' }}>
              <div style={{ fontSize: 8, letterSpacing: '0.25em', color: C.muted, marginBottom: 9 }}>RANGO 24H</div>
              <div style={{ position: 'relative', height: 4, borderRadius: 2, background: C.border2, marginBottom: 7 }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: '100%',
                  width: `${rangePct}%`, borderRadius: 2,
                  background: `linear-gradient(90deg, ${C.goldDim}, ${C.gold})`,
                }} />
                <div style={{
                  position: 'absolute', top: -3, left: `calc(${rangePct}% - 5px)`,
                  width: 10, height: 10, borderRadius: '50%',
                  background: C.glow, boxShadow: `0 0 8px ${C.gold}`,
                  border: `2px solid ${C.bg}`,
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.dimText }}>
                <span>{fmtPriceShort(stats!.low24h!)}</span>
                <span>{fmtPriceShort(stats!.high24h!)}</span>
              </div>
            </div>
          )}

          {/* PAR */}
          <div style={{ ...cardStyle, backgroundColor: C.surface, backgroundImage: cardBgSoft, padding: '14px 16px' }}>
            <div style={{ fontSize: 8, letterSpacing: '0.25em', color: C.muted, marginBottom: 6 }}>PAR</div>
            <div style={{ fontFamily: F.display, fontSize: 20, color: C.dimText, lineHeight: 1 }}>
              {symConfig.pair ?? `${symConfig.label}/USD`}
            </div>
          </div>
        </div>

        {/* ── Historial del motor por activo ─────────────────────────────────── */}
        <MotorHistory sym={sym} />

      </div>
    </div>
  )
}
