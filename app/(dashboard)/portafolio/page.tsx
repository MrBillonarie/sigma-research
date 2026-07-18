'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/app/lib/supabase'
import { C, cardStyle, heroCardStyle, numberEmboss } from '@/app/lib/constants'

const ReturnBoard = dynamic(() => import('./ReturnBoard'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 300, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>Cargando terminal…</span>
    </div>
  ),
})

// ─── Constants ──────────────────────────���─────────────────────────────────────
const MONTHS = [
  'Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic',
  'Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic 24',
]

const PLATFORM_META = [
  { id: 'ibkr',            name: 'Interactive Brokers', short: 'IBKR',      color: '#3b82f6', currency: 'USD', type: 'Equities / Options', isCLP: false },
  { id: 'binance_spot',    name: 'Binance Spot',        short: 'SPOT',      color: '#f59e0b', currency: 'USD', type: 'Crypto Spot',        isCLP: false },
  { id: 'binance_futures', name: 'Binance Futures',     short: 'FUTUROS',   color: '#ef4444', currency: 'USD', type: 'Crypto Perps',       isCLP: false },
  { id: 'fintual',         name: 'Fintual',             short: 'FINTUAL',   color: '#8b5cf6', currency: 'CLP', type: 'Fondos Mutuos',      isCLP: true  },
  { id: 'santander',       name: 'Santander',           short: 'SANTANDER', color: '#ec4899', currency: 'CLP', type: 'Ahorro / DAP',       isCLP: true  },
  { id: 'cash',            name: 'Cash / Banco',        short: 'CASH',      color: '#6b7280', currency: 'USD', type: 'Liquidez',           isCLP: false },
]

const CRYPTO_IDS = new Set(['binance_spot', 'binance_futures'])

// Dorado se reserva para el TOTAL agregado — los Ingresos Pasivos son una
// "parte" más del portafolio, así que llevan su propio color de identidad.
const PASSIVE_COLOR = '#06b6d4'

// ─── Risk profile data ────────────────────────────────────────────────────────
const PROFILE_DATA = {
  conservador: {
    label: 'Conservador', badgeColor: '#60a5fa',
    desc: 'Tu perfil prioriza la preservación del capital y la estabilidad. Alta exposición a renta fija con suficiente liquidez para no depender de activos volátiles.',
    allocation: [
      { name: 'Renta Fija', color: '#8b5cf6', rec: 50 },
      { name: 'Acciones',   color: '#3b82f6', rec: 20 },
      { name: 'Cash',       color: '#6b7280', rec: 20 },
      { name: 'BTC/Crypto', color: '#f59e0b', rec: 10 },
    ],
  },
  moderado: {
    label: 'Moderado', badgeColor: '#39e2e6',
    desc: 'Tu perfil busca un balance entre crecimiento y estabilidad. Acciones y crypto como motores de retorno, con renta fija que amortigua la volatilidad.',
    allocation: [
      { name: 'Acciones',   color: '#3b82f6', rec: 40 },
      { name: 'BTC/Crypto', color: '#f59e0b', rec: 25 },
      { name: 'Renta Fija', color: '#8b5cf6', rec: 20 },
      { name: 'Cash',       color: '#6b7280', rec: 15 },
    ],
  },
  agresivo: {
    label: 'Agresivo', badgeColor: '#ef4444',
    desc: 'Tu perfil maximiza el crecimiento aceptando alta volatilidad. Dominado por crypto y acciones de alto potencial, con mínima renta fija como colchón.',
    allocation: [
      { name: 'BTC/Crypto', color: '#f59e0b', rec: 50 },
      { name: 'Acciones',   color: '#3b82f6', rec: 35 },
      { name: 'Renta Fija', color: '#8b5cf6', rec: 10 },
      { name: 'Cash',       color: '#6b7280', rec:  5 },
    ],
  },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────
function seededRng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function genHistory(finalVal: number, volatility: number, trend: number, seed: number): number[] {
  const rand = seededRng(seed)
  const n = 24
  const vals: number[] = []
  let v = finalVal * Math.pow(1 - trend, n / 12)
  for (let i = 0; i < n; i++) {
    v = v * (1 + trend / 12 + (rand() - 0.48) * volatility)
    vals.push(Math.round(v))
  }
  vals[n - 1] = finalVal
  return vals
}

function yearsToFire(current: number, target: number, monthlySavings: number, annualReturn: number): number | null {
  if (current >= target) return 0
  if (annualReturn <= 0 && monthlySavings <= 0) return null
  const r = annualReturn / 12
  let bal = current
  for (let m = 1; m <= 720; m++) {
    bal = bal * (1 + r) + monthlySavings
    if (bal >= target) return +(m / 12).toFixed(1)
  }
  return null
}

function calcProfile(a: { horizonte: string; reaccion: string; objetivo: string }): 'conservador' | 'moderado' | 'agresivo' {
  let score = 0
  if (a.horizonte === '1-3')  score += 1
  else if (a.horizonte === '3-10') score += 2
  else if (a.horizonte === '10+')  score += 3
  if (a.reaccion === 'esperaria')      score += 1
  else if (a.reaccion === 'oportunidad') score += 2
  if (a.objetivo === 'moderado') score += 1
  else if (a.objetivo === 'maximo')  score += 2
  if (score <= 2) return 'conservador'
  if (score <= 5) return 'moderado'
  return 'agresivo'
}

function fmtUSD(n: number) { return '$' + Math.round(n).toLocaleString('es-CL') }
function fmtCLP(n: number) { return '$' + Math.round(n).toLocaleString('es-CL') }
function pct(n: number)    { return n.toFixed(1) + '%' }
function num(s: string)    { return parseFloat(s) || 0 }

// ─── Sub-components ────────────────────────────��─────────────────────────��────
function Label({ text }: { text: string }) {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>
      {text}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  // Barra de acento cian a la izquierda — unifica todos los títulos con el
  // lenguaje "terminal" (mismo filo que las cards del board/HUD).
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <span aria-hidden style={{ width: 3, height: 22, borderRadius: 2, flexShrink: 0, background: `linear-gradient(180deg, ${C.glow}, ${C.blue})`, boxShadow: `0 0 10px ${C.gold}66` }} />
      <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 26, color: C.text, letterSpacing: '0.05em' }}>
        {children}
      </span>
    </div>
  )
}

// ─── CountUp — anima de valor previo → target con ease-out cúbico ─────────────
function useCountUp(target: number, dur = 1200) {
  const [v, setV] = useState(0)
  const vRef    = useRef(0)
  const fromRef = useRef(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      vRef.current = target; fromRef.current = target; setV(target)
      return
    }
    const from = fromRef.current
    let raf = 0
    let t0: number | null = null
    const tick = (t: number) => {
      if (t0 === null) t0 = t
      const p = Math.min(1, (t - t0) / dur)
      const val = from + (target - from) * (1 - Math.pow(1 - p, 3))
      vRef.current = val
      setV(val)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); fromRef.current = vRef.current }
  }, [target, dur])
  return v
}

function CountText({ target, format }: { target: number; format: (v: number) => string }) {
  const v = useCountUp(target)
  return <>{format(v)}</>
}

// ─── Reveal al scroll — cada sección entra una sola vez ───────────────────────
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setOn(true); return }
    const io = new IntersectionObserver(es => {
      if (es[0].isIntersecting) { setOn(true); io.disconnect() }
    }, { threshold: 0.1 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={on ? 'pf-rv pf-rv-in' : 'pf-rv'} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

// ─── Gauge circular de riesgo — la aguja barre desde 0 al entrar ──────────────
function RiskGauge({ value, color, size = 84 }: { value: number; color: string; size?: number }) {
  const av = useCountUp(value, 1300)
  const stroke = 8
  const r = size / 2 - stroke
  const circumference = 2 * Math.PI * r
  const clamped = Math.min(Math.max(av, 0), 100)
  const offset = circumference * (1 - clamped / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: size * 0.24, color, lineHeight: 1, textShadow: numberEmboss }}>
          {Math.round(clamped)}%
        </span>
      </div>
    </div>
  )
}

// ─── Núcleo de Patrimonio — hero 3D: el total late en el centro y cada fuente
// orbita con radio y tamaño según su peso real. Canvas 2D, se pausa fuera de
// viewport y respeta prefers-reduced-motion. Reemplaza el bloque de KPIs. ─────
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

type CoreSeg = { name: string; color: string; usd: number; pct: number; monthlyIncome: number }

function WealthCore({ segments, total }: { segments: CoreSeg[]; total: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)
  const segRef    = useRef<CoreSeg[]>(segments)
  const mouseRef  = useRef({ x: 0, y: 0, px: -999, py: -999, inside: false })
  segRef.current  = segments

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap   = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    let W = 0, H = 0
    const resize = () => {
      const r = wrap.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width = W * DPR; canvas.height = H * DPR
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(wrap)

    let visible = true
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting }, { threshold: 0.05 })
    io.observe(canvas)

    let tilt = 0.46, twist = 0
    const t0 = performance.now()
    let raf = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible) return
      const t = (now - t0) / 1000
      const segs = segRef.current.filter(s => s.usd > 0)
      const cx = W / 2, cy = H / 2 + 4
      ctx.clearRect(0, 0, W, H)

      const m = mouseRef.current
      const mx = m.inside ? m.x - 0.5 : 0
      const my = m.inside ? m.y - 0.5 : 0
      tilt  = lerp(tilt,  0.46 + my * 0.16, 0.06)
      twist = lerp(twist, mx * 0.5,         0.06)
      const ky = Math.cos(tilt)

      const n = segs.length || 1
      const coreR = Math.max(30, Math.min(W, H) * 0.12)
      const maxR  = Math.min(W * 0.44, H * 0.46)
      const minR  = coreR * 1.8
      const bodies = segs.map((s, i) => ({
        s, i,
        orbit: n > 1 ? minR + (maxR - minR) * (i / (n - 1)) : (minR + maxR) / 2,
        size:  6 + Math.min(s.pct, 55) * 0.5,
        spd:   0.24 - i * 0.02,
        base:  (i / n) * Math.PI * 2,
      }))

      // halo de fondo
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.5)
      bg.addColorStop(0, 'rgba(57,226,230,0.05)'); bg.addColorStop(1, 'transparent')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

      // órbitas (elipses)
      bodies.forEach(b => {
        ctx.beginPath()
        for (let k = 0; k <= 56; k++) {
          const a = (k / 56) * Math.PI * 2 + twist
          const x = cx + Math.cos(a) * b.orbit, y = cy + Math.sin(a) * b.orbit * ky
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y)
        }
        ctx.closePath(); ctx.strokeStyle = 'rgba(120,150,175,0.10)'; ctx.lineWidth = 1; ctx.stroke()
      })

      // posiciones + orden por profundidad
      const T = reduce ? 0 : t
      const drawn = bodies.map(b => {
        const a = b.base + T * b.spd + twist
        const x = cx + Math.cos(a) * b.orbit, y = cy + Math.sin(a) * b.orbit * ky
        const depth = (Math.sin(a) * ky + 1) / 2
        return { ...b, x, y, depth, scale: 0.62 + depth * 0.55 }
      }).sort((p, q) => p.depth - q.depth)

      // pick de hover
      let hoverI = -1
      if (m.inside) {
        let best = 24
        drawn.forEach(d => { const dd = Math.hypot(d.x - m.px, d.y - m.py); if (dd < best + d.size) { best = dd; hoverI = d.i } })
      }

      // núcleo central (total) — pulso
      const pulse = 1 + (reduce ? 0 : Math.sin(t * 1.8) * 0.035)
      const cr = coreR * pulse
      const cg = ctx.createRadialGradient(cx, cy - cr * 0.3, 3, cx, cy, cr * 1.7)
      cg.addColorStop(0, '#eafcff'); cg.addColorStop(0.35, '#5eeaf0')
      cg.addColorStop(0.7, 'rgba(79,146,255,0.5)'); cg.addColorStop(1, 'transparent')
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, cr * 1.7, 0, 7); ctx.fill()

      // planetas
      drawn.forEach(d => {
        const isH = d.i === hoverI
        const rr = d.size * d.scale * (isH ? 1.35 : 1)
        ctx.strokeStyle = isH ? 'rgba(94,234,240,0.5)' : 'rgba(120,150,175,0.05)'
        ctx.lineWidth = isH ? 1.4 : 1
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(d.x, d.y); ctx.stroke()
        const g = ctx.createRadialGradient(d.x - rr * 0.3, d.y - rr * 0.3, 1, d.x, d.y, rr * 1.5)
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, d.s.color); g.addColorStop(1, d.s.color + '00')
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, rr * 1.4, 0, 7); ctx.fill()
        ctx.globalAlpha = 0.4 + d.scale * 0.4
        ctx.fillStyle = d.s.color; ctx.beginPath(); ctx.arc(d.x, d.y, rr, 0, 7); ctx.fill()
        ctx.globalAlpha = 1
        if (isH) { ctx.strokeStyle = '#5eeaf0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(d.x, d.y, rr + 4, 0, 7); ctx.stroke() }
      })

      // tarjeta hover
      if (hoverI >= 0 && segs[hoverI]) {
        const b = segs[hoverI]
        const l1 = b.name
        const l2 = `${fmtUSD(b.usd)}  ·  ${b.pct.toFixed(1)}%`
        ctx.font = "11px 'DM Mono', monospace"
        const tw = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 22
        const bx = Math.min(m.px + 14, W - tw - 8)
        const by = Math.min(Math.max(m.py - 6, 6), H - 46)
        ctx.fillStyle = 'rgba(8,10,15,0.95)'; ctx.strokeStyle = b.color; ctx.lineWidth = 1
        roundRectPath(ctx, bx, by, tw, 40, 7); ctx.fill(); ctx.stroke()
        ctx.textAlign = 'left'; ctx.fillStyle = '#e8e9f0'; ctx.fillText(l1, bx + 11, by + 16)
        ctx.fillStyle = b.color; ctx.fillText(l2, bx + 11, by + 31)
      }
    }
    raf = requestAnimationFrame(frame)

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      const m = mouseRef.current
      m.x = (e.clientX - r.left) / r.width; m.y = (e.clientY - r.top) / r.height
      m.px = e.clientX - r.left; m.py = e.clientY - r.top; m.inside = true
    }
    const onLeave = () => { const m = mouseRef.current; m.inside = false; m.px = -999; m.py = -999 }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  const animTotal = useCountUp(total, 1400)

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300 }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {/* Total al centro — sin tarjeta: solo sombra detrás de las letras para legibilidad */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: 3 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.3em', color: C.dimText, textShadow: '0 1px 4px rgba(0,0,0,0.85)' }}>PATRIMONIO TOTAL</span>
        <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(30px,4.4vw,48px)', lineHeight: 1, letterSpacing: '0.02em', textShadow: '0 2px 7px rgba(0,0,0,0.9), 0 0 18px rgba(0,0,0,0.6)', background: `linear-gradient(135deg,${C.gold},${C.glow})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {fmtUSD(animTotal)}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, textShadow: '0 1px 4px rgba(0,0,0,0.85)' }}>USD equiv.</span>
      </div>
    </div>
  )
}

// ─── Types ───────────────────────────────���────────────────────────────��───────
interface PassivePosition {
  id: string
  category: string
  nombre: string
  capital: number
  apy: number
  ingresoMensual: number
}

type PortfolioRow = Record<string, number>

const inputStyle: React.CSSProperties = {
  background: C.bg, border: `1px solid ${C.border}`, outline: 'none', borderRadius: 8,
  color: C.text, fontFamily: 'monospace', fontSize: 13, padding: '8px 12px',
  fontVariantNumeric: 'tabular-nums', width: '100%',
}

// Filo cian superior — mismo detalle de las cards del HUD/Terminal
const FILO: React.CSSProperties = {
  height: 2,
  background: 'linear-gradient(90deg, rgba(57,226,230,0.85), rgba(79,146,255,0.4) 45%, transparent 82%)',
}

// Cabecera de card con gradiente sutil (mismo patrón de la toolbar del Terminal)
const CARD_HEAD_BG = 'linear-gradient(90deg, rgba(57,226,230,0.05), rgba(255,255,255,0.015) 45%)'

// ─── Main page ───────────────────────────���──────────────────────────────���─────
export default function PortfolioPage() {
  const [portfolio,    setPortfolio]    = useState<PortfolioRow>({})
  const [dbId,         setDbId]         = useState<string | null>(null)
  const [positions,    setPositions]    = useState<PassivePosition[]>([])
  const [storedTotal,  setStoredTotal]  = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [lastSaved,    setLastSaved]    = useState<string | null>(null)
  const [trm,          setTrm]          = useState('950')
  const [trmLive,      setTrmLive]      = useState(false)
  const [monthlySav,   setMonthlySav]   = useState('500')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [draftForm, setDraftForm] = useState<PortfolioRow>({})
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  // Binance live
  const [binanceFutures,        setBinanceFutures]        = useState<Record<string, string | number>[]>([])
  const [binanceSpot,           setBinanceSpot]           = useState<Record<string, string | number>[]>([])
  const [loadingBinanceFutures, setLoadingBinanceFutures] = useState(true)
  const [loadingBinanceSpot,    setLoadingBinanceSpot]    = useState(true)
  const [errorBinanceFutures,   setErrorBinanceFutures]   = useState('')
  const [errorBinanceSpot,      setErrorBinanceSpot]      = useState('')

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState({ horizonte: '', reaccion: '', objetivo: '' })
  const [quizResult,  setQuizResult]  = useState<'conservador' | 'moderado' | 'agresivo' | null>(null)
  const donutRef      = useRef<HTMLCanvasElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const donutChartRef = useRef<any>(null)

  // Un TRM <= 0 invertiría el signo de todo el capital CLP→USD (Fintual/
  // Santander) sin ningún aviso — se descarta y se usa el valor por defecto.
  const trmVal = num(trm) > 0 ? num(trm) : 950

  // ─── Load: localStorage → Supabase ──────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try { const r = localStorage.getItem('sigma_positions'); if (r) setPositions((JSON.parse(r) as PassivePosition[]).map(p => ({ ...p, ingresoMensual: p.ingresoMensual ?? (p.capital * p.apy) / 100 / 12 }))) } catch {}
      try { const n = Number(localStorage.getItem('sigma_portfolio_total')); if (n > 0) setStoredTotal(n) } catch {}

      // Fetch live CLP/USD rate
      try {
        const res = await fetch('/api/trm')
        const json = await res.json()
        if (json.clpPerUsd > 0) { setTrm(String(json.clpPerUsd)); setTrmLive(true) }
      } catch {}

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase.from('portfolio').select('*').eq('user_id', user.id).maybeSingle()
      if (data) {
        setDbId(data.id)
        const vals: PortfolioRow = {}
        PLATFORM_META.forEach(p => { vals[p.id] = data[p.id] ?? 0 })
        setPortfolio(vals)
        try { localStorage.setItem('sigma_portfolio', JSON.stringify(vals)) } catch {}
      }
      setLoading(false)
    }
    load()
  }, [])

  // ESC closes modal
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false) }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [])

  // ─── Fetch Binance live data (parallel) ──────────────────────────────────
  useEffect(() => {
    async function fetchBinance() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoadingBinanceFutures(false); setLoadingBinanceSpot(false); return }
      const headers = { Authorization: `Bearer ${session.access_token}` }

      const [futuresResult, spotResult] = await Promise.allSettled([
        fetch('/api/binance/positions', { headers }).then(r => r.json()),
        fetch('/api/binance/spot',      { headers }).then(r => r.json()),
      ])

      if (futuresResult.status === 'fulfilled') {
        const json = futuresResult.value
        if (json.error) setErrorBinanceFutures(json.error)
        else setBinanceFutures(json.positions ?? [])
      } else { setErrorBinanceFutures('Error al conectar.') }
      setLoadingBinanceFutures(false)

      if (spotResult.status === 'fulfilled') {
        const json = spotResult.value
        if (json.error) setErrorBinanceSpot(json.error)
        else setBinanceSpot(json.balances ?? [])
      } else { setErrorBinanceSpot('Error al conectar.') }
      setLoadingBinanceSpot(false)
    }
    fetchBinance()
  }, [])

  // ─── Modal actions ────────────────���─────────────────────────────────��─────
  function openModal() { setDraftForm({ ...portfolio }); setModalOpen(true) }

  async function savePortfolio() {
    setSaving(true)
    setSaveError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); setSaveError('Inicia sesión de nuevo para guardar.'); return }
    const payload = { user_id: user.id, updated_at: new Date().toISOString(), ...draftForm }
    // Antes no se revisaba `error` — si Supabase fallaba (red, RLS), igual se
    // mostraba "Guardado" y se sobreescribía el estado local, dejando al
    // usuario creyendo que su capital quedó al día cuando en realidad no se
    // guardó nada. La próxima carga traía el valor viejo y lo pisaba todo.
    if (dbId) {
      const { error } = await supabase.from('portfolio').update(payload).eq('id', dbId)
      if (error) { setSaving(false); setSaveError(`No se pudo guardar: ${error.message}`); return }
    } else {
      const { data, error } = await supabase.from('portfolio').insert(payload).select().single()
      if (error) { setSaving(false); setSaveError(`No se pudo guardar: ${error.message}`); return }
      if (data) setDbId(data.id)
    }
    const savedAt = new Date().toISOString()
    setPortfolio({ ...draftForm })
    setLastSaved(savedAt)
    try { localStorage.setItem('sigma_portfolio', JSON.stringify(draftForm)) } catch {}
    try { localStorage.setItem('sigma_portfolio_saved_at', savedAt) } catch {}
    setSaving(false)
    setModalOpen(false)
  }

  // ─── Per-platform with synthetic history (for chart + KPIs) ──────────────
  const platforms = useMemo(() => PLATFORM_META.map((p, i) => {
    const raw     = portfolio[p.id] ?? 0
    const current = p.isCLP ? raw / trmVal : raw
    const history = genHistory(current || 10_000, 0.06, 0.08, i * 1000 + 42)
    const prev    = history[0]
    const change  = prev > 0 ? ((current - prev) / prev) * 100 : 0
    return { ...p, current, prev, change, history }
  }).filter(p => p.id !== 'cash' || p.current > 0), [portfolio, trmVal])

  // ─── Terminal-style KPIs + chart data ─────────────────────────���──────────
  const { totalCurrent, ytdReturn, platformHistories, totalHistory, sharpe, maxDD } = useMemo(() => {
    const totalCurrent = platforms.reduce((s, p) => s + p.current, 0)
    const totalPrev    = platforms.reduce((s, p) => s + p.prev,    0)
    const ytdReturn    = totalPrev > 0 ? ((totalCurrent - totalPrev) / totalPrev) * 100 : 0
    const platformHistories = platforms.map(p => ({ name: p.name, short: p.short, color: p.color, data: p.history }))
    const totalHistory = MONTHS.slice(0, 24).map((_, i) =>
      platformHistories.reduce((sum, p) => sum + (p.data[i] ?? 0), 0)
    )
    const returns = totalHistory.slice(1).map((v, i) => (v - totalHistory[i]) / totalHistory[i])
    const meanR   = returns.reduce((a, b) => a + b, 0) / (returns.length || 1)
    const stdR    = Math.sqrt(returns.reduce((a, b) => a + (b - meanR) ** 2, 0) / (returns.length || 1))
    const sharpe  = stdR > 0 ? (meanR / stdR) * Math.sqrt(12) : 0
    let peak = 0, maxDD = 0
    totalHistory.forEach(v => {
      if (v > peak) peak = v
      const dd = peak > 0 ? (v - peak) / peak : 0
      if (dd < maxDD) maxDD = dd
    })
    return { totalCurrent, ytdReturn, platformHistories, totalHistory, sharpe, maxDD }
  }, [platforms])

  // ─── Portfolio derived values (allocation, FIRE, risk) ───────────────────
  const D = useMemo(() => {
    const passiveCapital = positions.reduce((s, p) => s + p.capital, 0)
    const passiveMonthly = positions.reduce((s, p) => s + p.ingresoMensual, 0)
    const totalUSD = totalCurrent + passiveCapital || storedTotal
    const totalCLP = totalUSD * trmVal
    const ingresoAnual = passiveMonthly * 12
    const yieldRatio   = totalUSD > 0 ? (ingresoAnual / totalUSD) * 100 : 0

    type Seg = { name: string; color: string; usd: number; type: string; pct: number; monthlyIncome: number }
    const allSegments: Seg[] = [
      ...platforms.filter(p => p.current > 0).map(p => ({
        name: p.name, color: p.color, usd: p.current, type: p.type,
        pct: totalUSD > 0 ? (p.current / totalUSD) * 100 : 0,
        monthlyIncome: 0,
      })),
      ...(passiveCapital > 0 ? [{
        name: 'Ingresos Pasivos', color: PASSIVE_COLOR, usd: passiveCapital, type: 'Multi-yield',
        pct: totalUSD > 0 ? (passiveCapital / totalUSD) * 100 : 0,
        monthlyIncome: passiveMonthly,
      }] : []),
    ]

    const maxSegment = allSegments.reduce<Seg>(
      (m, s) => s.pct > m.pct ? s : m,
      { name: '—', color: C.muted, usd: 0, type: '', pct: 0, monthlyIncome: 0 }
    )
    const cryptoPct = totalUSD > 0
      ? platforms.filter(p => CRYPTO_IDS.has(p.id)).reduce((s, p) => s + p.current, 0) / totalUSD * 100
      : 0
    const cashUSD = platforms.find(p => p.id === 'cash')?.current ?? 0
    const cashPct = totalUSD > 0 ? (cashUSD / totalUSD) * 100 : 0

    const FIRE_GOAL_MONTHLY = 2000
    const FIRE_RATE         = 0.04
    const fireTarget        = (FIRE_GOAL_MONTHLY * 12) / FIRE_RATE
    const firePct           = Math.min((totalUSD / fireTarget) * 100, 100)
    const fireYears         = yearsToFire(totalUSD, fireTarget, num(monthlySav), 0.08)

    const tableRows = [
      ...platforms.map(p => ({
        name: p.name, color: p.color, type: p.type,
        usd: p.current, clp: p.current * trmVal,
        pct: totalUSD > 0 ? (p.current / totalUSD) * 100 : 0,
        monthly: 0,
      })),
      { name: 'Ingresos Pasivos', color: PASSIVE_COLOR, type: 'Multi-yield',
        usd: passiveCapital, clp: passiveCapital * trmVal,
        pct: totalUSD > 0 ? (passiveCapital / totalUSD) * 100 : 0,
        monthly: passiveMonthly },
    ]

    return {
      passiveCapital, passiveMonthly, totalUSD, totalCLP,
      ingresoAnual, yieldRatio, allSegments, maxSegment,
      cryptoPct, cashPct, cashUSD, fireTarget, firePct, fireYears,
      FIRE_GOAL_MONTHLY, tableRows,
    }
  }, [platforms, positions, trmVal, monthlySav, storedTotal, totalCurrent])

  // Actual allocation by asset class (USD-normalised)
  const actualAlloc = useMemo((): Record<string, number> | null => {
    const find = (id: string) => platforms.find(p => p.id === id)?.current ?? 0
    const rfija  = find('fintual') + find('santander')
    const stocks = find('ibkr')
    const crypto = find('binance_spot') + find('binance_futures')
    const cash   = find('cash')
    const total  = rfija + stocks + crypto + cash
    if (total === 0) return null
    return {
      'Renta Fija': (rfija  / total) * 100,
      'Acciones':   (stocks / total) * 100,
      'BTC/Crypto': (crypto / total) * 100,
      'Cash':       (cash   / total) * 100,
    }
  }, [platforms])

  // Write totalUSD to localStorage for LP DeFi + home pages
  useEffect(() => {
    if (D.totalUSD > 0) {
      try { localStorage.setItem('sigma_portfolio_total', String(D.totalUSD)) } catch {}
    }
  }, [D.totalUSD])

  // Draw / redraw donut chart when quiz result changes
  useEffect(() => {
    if (!quizResult || !donutRef.current) return
    const profile = PROFILE_DATA[quizResult]
    let alive = true
    ;(async () => {
      const { default: Chart } = await import('chart.js/auto')
      if (!alive || !donutRef.current) return
      if (donutChartRef.current) { donutChartRef.current.destroy(); donutChartRef.current = null }
      donutChartRef.current = new Chart(donutRef.current, {
        type: 'doughnut',
        data: {
          labels: profile.allocation.map(a => a.name),
          datasets: [{ data: profile.allocation.map(a => a.rec), backgroundColor: profile.allocation.map(a => a.color), borderWidth: 0, hoverOffset: 6 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '68%',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}%` } },
          },
        },
      })
    })()
    return () => { alive = false; if (donutChartRef.current) { donutChartRef.current.destroy(); donutChartRef.current = null } }
  }, [quizResult])

  const hasSavedData   = totalCurrent > 0 || D.totalUSD > 0
  const activeProfile  = quizResult ? PROFILE_DATA[quizResult] : null

  // Encendido: el % FIRE cuenta y la barra se llena con el mismo valor animado
  const fireAnim = useCountUp(D.firePct, 1500)

  // ─── Render ──────────────────────────────────────────────────────���────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <style>{`
        /* ── Reveal al scroll ── */
        .pf-rv { opacity: 0; transform: translateY(14px); transition: opacity .55s ease, transform .55s ease; }
        .pf-rv-in { opacity: 1; transform: none; }

        /* ── Núcleo de patrimonio — hero 3D + KPIs laterales ── */
        .port-core-grid { display: grid; grid-template-columns: minmax(0,1.55fr) minmax(0,1fr); gap: 12px; }
        .port-core-side { display: grid; grid-template-rows: repeat(3,1fr); gap: 12px; }
        @media (max-width: 900px) {
          .port-core-grid { grid-template-columns: 1fr; }
          .port-core-side { grid-template-rows: none; grid-template-columns: repeat(3,1fr); }
        }
        @media (max-width: 560px) {
          .port-core-side { grid-template-columns: 1fr; }
        }

        /* ── Botones — lenguaje Cyan Deck ── */
        .pf-cta {
          font-family: monospace; letter-spacing: .2em; cursor: pointer;
          border: none; border-radius: 8px; color: #04050a;
          background: linear-gradient(100deg, #5eeaf0, #4f92ff);
          box-shadow: 0 0 18px rgba(57,226,230,0.22);
          transition: filter .15s, box-shadow .15s;
        }
        .pf-cta:hover:not(:disabled) { filter: brightness(1.12); box-shadow: 0 0 28px rgba(57,226,230,0.35); }
        .pf-cta:disabled { opacity: .4; cursor: default; }
        .pf-ghost {
          font-family: monospace; cursor: pointer; border-radius: 8px;
          background: transparent; border: 1px solid ${C.border}; color: ${C.dimText};
          transition: border-color .15s, color .15s, box-shadow .15s;
        }
        .pf-ghost:hover { border-color: rgba(57,226,230,0.55); color: ${C.glow}; box-shadow: 0 0 14px rgba(57,226,230,0.14); }
        .pf-ghost-accent {
          font-family: monospace; cursor: pointer; border-radius: 8px;
          background: transparent; border: 1px solid ${C.gold}66; color: ${C.gold};
          transition: border-color .15s, box-shadow .15s, background .15s;
        }
        .pf-ghost-accent:hover { border-color: ${C.gold}; background: rgba(57,226,230,0.08); box-shadow: 0 0 18px rgba(57,226,230,0.18); }
        .pf-opt {
          padding: 8px 16px; font-family: monospace; font-size: 11px; letter-spacing: .08em;
          background: transparent; border: 1px solid ${C.border}; color: ${C.dimText};
          cursor: pointer; border-radius: 8px;
          transition: border-color .15s, color .15s, background .15s, box-shadow .15s;
        }
        .pf-opt:hover { border-color: ${C.border2}; color: ${C.text}; }
        .pf-opt.on {
          border-color: rgba(57,226,230,0.55);
          background: linear-gradient(180deg, rgba(57,226,230,0.16), rgba(57,226,230,0.04));
          color: ${C.glow};
          box-shadow: 0 0 14px rgba(57,226,230,0.14);
        }

        @media (prefers-reduced-motion: reduce) {
          .pf-rv { opacity: 1; transform: none; transition: none; }
        }
      `}</style>
      <div className="dash-content" style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: 36, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
              {'// PORTAFOLIO · VISTA CONSOLIDADA'}
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
              <span style={{ color: C.text }}>PORTA</span>
              <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#2f6bd6)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FOLIO</span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', backgroundColor: C.surface, backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.008))' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText }}>TRM CLP/USD</span>
                <span style={{ fontFamily: 'monospace', fontSize: 9, color: trmLive ? C.green : C.muted, letterSpacing: '0.1em' }}>
                  {trmLive ? '● live' : '○ manual'}
                </span>
              </div>
              <input
                type="number" value={trm} min={1}
                onChange={e => { setTrm(e.target.value === '' ? '' : String(Math.max(0, Number(e.target.value) || 0))); setTrmLive(false) }}
                style={{ width: 80, background: C.bg, border: `1px solid ${C.gold}44`, borderRadius: 6, color: C.gold, fontFamily: 'monospace', fontSize: 13, padding: '4px 8px', outline: 'none', textAlign: 'right' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              {lastSaved && (
                <span style={{ fontFamily: 'monospace', fontSize: 9, color: C.muted, letterSpacing: '0.1em' }}>
                  Guardado {new Date(lastSaved).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button onClick={openModal} className="pf-ghost-accent" style={{ padding: '10px 22px', fontSize: 11, letterSpacing: '0.2em' }}>
                EDITAR PORTAFOLIO
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <style>{`@keyframes sk{0%{background-position:-200% 0}100%{background-position:200% 0}}.sk-pulse{background:linear-gradient(90deg,${C.border} 25%,${C.surface} 50%,${C.border} 75%);background-size:200% 100%;animation:sk 1.4s ease infinite;border-radius:2px}`}</style>
            <div className="port-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: C.border }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ background: C.surface, padding: '20px 18px' }}>
                  <div className="sk-pulse" style={{ width: '60%', height: 10, marginBottom: 12 }} />
                  <div className="sk-pulse" style={{ width: '80%', height: 28 }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.border }}>
              {[1,2].map(i => (
                <div key={i} style={{ background: C.surface, padding: '24px' }}>
                  <div className="sk-pulse" style={{ width: '40%', height: 10, marginBottom: 16 }} />
                  <div className="sk-pulse" style={{ width: '100%', height: 200 }} />
                </div>
              ))}
            </div>
          </div>
        ) : !hasSavedData ? (
          <div style={{ ...heroCardStyle, padding: '48px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginBottom: 20 }}>No tienes datos de portafolio guardados todavía.</div>
            <button onClick={openModal} className="pf-cta" style={{ padding: '12px 28px', fontSize: 12 }}>
              CONFIGURAR PORTAFOLIO
            </button>
          </div>
        ) : (
          <>
            {/* ── 1. NÚCLEO DE PATRIMONIO — hero 3D + KPIs secundarios ── */}
            <div className="port-core-grid" style={{ marginBottom: 24 }}>
              {/* El total late en el centro; cada fuente orbita según su peso real. */}
              <div style={{ ...heroCardStyle, position: 'relative', overflow: 'hidden', padding: 0, minHeight: 340 }}>
                <div style={{ ...FILO, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }} />
                <WealthCore segments={D.allSegments} total={D.totalUSD} />
              </div>
              {/* Métricas derivadas — curva simulada anclada al total real de hoy.
                  No hay historial real guardado (solo el snapshot actual): por eso
                  el sub-label dice "estimado" en las tres. */}
              <div className="port-core-side">
                {[
                  { label: 'Rentabilidad YTD', value: <CountText target={ytdReturn} format={v => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`} />, sub: 'estimado · vs. inicio de año', color: ytdReturn >= 0 ? C.green : C.red },
                  { label: 'Sharpe Ratio',     value: <CountText target={sharpe} format={v => v.toFixed(2)} />,                              sub: 'estimado · 12M rolling',      color: sharpe >= 1.5 ? C.green : sharpe >= 0.8 ? C.text : C.red },
                  { label: 'Max Drawdown',     value: <CountText target={maxDD * 100} format={v => `${v.toFixed(2)}%`} />,                   sub: 'estimado · 24M window',       color: C.red },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} style={{ ...cardStyle, background: C.surface, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Label text={label} />
                    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 34, color, lineHeight: 1, textShadow: numberEmboss }}>{value}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, marginTop: 4 }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 3. TERMINAL BOARD · RETORNO — curva del total + tablero de tenencias vivo ── */}
            <Reveal>
            <div style={{ ...cardStyle, background: C.surface, marginBottom: 24, overflow: 'hidden', position: 'relative' }}>
              <div style={FILO} />
              <ReturnBoard labels={MONTHS.slice(0, 24)} total={totalHistory} sources={platformHistories} />
            </div>
            </Reveal>

            {/* ── 4. KPIs × 4 (portfolio totals) ── */}
            <Reveal>
            <div className="port-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 40 }}>
              {[
                { label: 'Patrimonio Total USD', value: <CountText target={D.totalUSD} format={fmtUSD} />,       color: C.gold  },
                { label: 'Patrimonio Total CLP', value: <CountText target={D.totalCLP} format={fmtCLP} />,       color: C.gold  },
                { label: 'Ingreso Pasivo / mes', value: <CountText target={D.passiveMonthly} format={fmtUSD} />, color: C.green },
                { label: 'Yield Efectivo',       value: <CountText target={D.yieldRatio} format={pct} />,        color: C.green },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ ...cardStyle, background: C.surface, overflow: 'hidden', position: 'relative' }}>
                  <div style={FILO} />
                  <div style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: color, boxShadow: `0 0 8px ${color}66`, flexShrink: 0 }} />
                      <Label text={label} />
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, color, lineHeight: 1, textShadow: numberEmboss, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
            </Reveal>

            {/* ── 5. BINANCE FUTURES POSITIONS ── */}
            <style>{`@keyframes skp{0%{background-position:-200% 0}100%{background-position:200% 0}}.skp{background:linear-gradient(90deg,${C.border} 25%,${C.surface} 50%,${C.border} 75%);background-size:200% 100%;animation:skp 1.4s ease infinite;border-radius:2px}`}</style>
            <Reveal>
            <div style={{ ...cardStyle, marginBottom: 24, overflow: 'hidden' }}>
              <div style={FILO} />
              <div style={{ background: C.surface, backgroundImage: CARD_HEAD_BG, padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', flexShrink: 0 }} />
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>BINANCE FUTURES · POSICIONES ABIERTAS</span>
              </div>
              <div style={{ background: C.bg, padding: '16px 18px' }}>
                {loadingBinanceFutures ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {[1,2,3].map(i => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
                        <div className="skp" style={{ height: 12 }} />
                        <div className="skp" style={{ height: 12, width: '60%' }} />
                        <div className="skp" style={{ height: 12, width: '70%' }} />
                        <div className="skp" style={{ height: 12, width: '50%' }} />
                      </div>
                    ))}
                  </div>
                ) : errorBinanceFutures ? (
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.red }}>{errorBinanceFutures}</div>
                ) : binanceFutures.length === 0 ? (
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted }}>Sin posiciones abiertas.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['Par', 'Dirección', 'PnL no realizado', 'Precio entrada'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: C.dimText, fontWeight: 400, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {binanceFutures.map((pos, i) => {
                        const amt   = parseFloat(String(pos.positionAmt))
                        const pnl   = parseFloat(String(pos.unRealizedProfit))
                        const entry = parseFloat(String(pos.entryPrice))
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 1 ? C.surface2 : 'transparent', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = `${C.gold}0a`)}
                            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? C.surface2 : 'transparent')}>
                            <td style={{ padding: '10px 12px', color: C.text }}>{String(pos.symbol)}</td>
                            <td style={{ padding: '10px 12px', color: amt > 0 ? C.green : C.red }}>{amt > 0 ? 'LONG' : 'SHORT'}</td>
                            <td style={{ padding: '10px 12px', color: pnl >= 0 ? C.green : C.red }}>${pnl.toFixed(2)}</td>
                            <td style={{ padding: '10px 12px', color: C.dimText }}>${entry.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            </Reveal>

            {/* ── 6. BINANCE SPOT BALANCES ── */}
            <Reveal>
            <div style={{ ...cardStyle, marginBottom: 40, overflow: 'hidden' }}>
              <div style={FILO} />
              <div style={{ background: C.surface, backgroundImage: CARD_HEAD_BG, padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px #f59e0b', flexShrink: 0 }} />
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>BINANCE SPOT · BALANCES</span>
              </div>
              <div style={{ background: C.bg, padding: '16px 18px' }}>
                {loadingBinanceSpot ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 1, background: C.border }}>
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} style={{ background: C.bg, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="skp" style={{ height: 12, width: 50 }} />
                        <div className="skp" style={{ height: 12, width: 70 }} />
                      </div>
                    ))}
                  </div>
                ) : errorBinanceSpot ? (
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.red }}>{errorBinanceSpot}</div>
                ) : binanceSpot.length === 0 ? (
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted }}>Sin balances.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1, background: C.border }}>
                    {binanceSpot.map((b, i) => (
                      <div key={i} style={{ background: C.bg, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.text }}>{String(b.asset)}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.gold }}>{parseFloat(String(b.free)).toFixed(6)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            </Reveal>

            {/* ── 7. DETAIL TABLE ── */}
            <Reveal>
            <div style={{ marginBottom: 40 }}>
              <SectionTitle>DETALLE POR PLATAFORMA</SectionTitle>
              <div style={{ ...cardStyle, background: C.surface, overflow: 'hidden', overflowX: 'auto' }}>
                <div style={FILO} />
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Plataforma', 'Tipo', 'Capital USD', 'Capital CLP', '% del total', 'Ingreso/mes'].map(h => (
                        <th key={h} style={{ padding: '8px 16px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dimText, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {D.tableRows.map((row, i) => (
                      <tr key={row.name} style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${row.usd > 0 ? row.color : 'transparent'}`, background: i % 2 === 1 ? C.surface2 : 'transparent', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = `${row.color}0c`)}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? C.surface2 : 'transparent')}>
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, background: row.color, borderRadius: 1, flexShrink: 0 }} />
                            <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.text }}>{row.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{row.type}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: row.usd > 0 ? C.text : C.muted }}>{row.usd > 0 ? fmtUSD(row.usd) : '—'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: row.clp > 0 ? C.dimText : C.muted }}>{row.clp > 0 ? fmtCLP(row.clp) : '—'}</td>
                        <td style={{ padding: '11px 16px', minWidth: 110 }}>
                          {row.usd > 0 ? (
                            <div>
                              <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.text, marginBottom: 4 }}>{pct(row.pct)}</div>
                              <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                                <div style={{ width: `${Math.min(row.pct, 100)}%`, height: '100%', background: row.color, borderRadius: 2 }} />
                              </div>
                            </div>
                          ) : <span style={{ color: C.muted, fontFamily: 'monospace', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: row.monthly > 0 ? C.green : C.muted }}>{row.monthly > 0 ? fmtUSD(row.monthly) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${C.gold}44`, background: C.gold + '08' }}>
                      <td colSpan={2} style={{ padding: '12px 16px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, color: C.gold, letterSpacing: '0.1em' }}>TOTAL</td>
                      <td style={{ padding: '12px 16px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, color: C.gold }}>{fmtUSD(D.totalUSD)}</td>
                      <td style={{ padding: '12px 16px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, color: C.gold }}>{fmtCLP(D.totalCLP)}</td>
                      <td style={{ padding: '12px 16px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, color: C.gold }}>100%</td>
                      <td style={{ padding: '12px 16px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, color: C.green }}>{fmtUSD(D.passiveMonthly)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            </Reveal>

            {/* ── 8. CONCENTRATION & RISK — gauges circulares, firma propia de esta página ── */}
            <Reveal>
            <div style={{ marginBottom: 40 }}>
              <SectionTitle>CONCENTRACIÓN Y RIESGO</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {[
                  { label: 'Concentración máxima', v: D.maxSegment.pct, sub: `Mayor posición: ${D.maxSegment.name}`,
                    level: D.maxSegment.pct > 50 ? { l: 'ALTA', c: C.red } : D.maxSegment.pct > 30 ? { l: 'MEDIA', c: C.yellow } : { l: 'BAJA', c: C.green } },
                  { label: 'Exposición Crypto', v: D.cryptoPct, sub: 'Binance Spot + Futures',
                    level: D.cryptoPct > 60 ? { l: 'ALTA', c: C.red } : D.cryptoPct > 35 ? { l: 'MEDIA', c: C.yellow } : { l: 'BAJA', c: C.green } },
                  { label: 'Liquidez inmediata', v: D.cashPct, sub: `Cash: ${fmtUSD(D.cashUSD)}`,
                    level: D.cashPct < 5 ? { l: 'CRÍTICA', c: C.red } : D.cashPct < 10 ? { l: 'BAJA', c: C.yellow } : { l: 'OK', c: C.green } },
                ].map(({ label, v, sub, level }) => (
                  <div key={label} style={{ ...cardStyle, background: C.surface, overflow: 'hidden', position: 'relative' }}>
                    <div style={FILO} />
                    <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                      <RiskGauge value={v} color={level.c} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Label text={label} />
                        <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', color: level.c, background: level.c + '18', padding: '2px 8px', display: 'inline-block', marginBottom: 6 }}>{level.l}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{sub}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            </Reveal>

            {/* ── 9. FIRE PROGRESS ── */}
            <Reveal>
            <div style={{ marginBottom: 40 }}>
              <SectionTitle>PROGRESO FIRE</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ ...cardStyle, background: C.surface, overflow: 'hidden', position: 'relative' }}>
                  <div style={FILO} />
                  <div style={{ padding: '24px 22px' }}>
                  <Label text={`Meta FIRE — $${D.FIRE_GOAL_MONTHLY.toLocaleString('es-CL')}/mes · Regla 4%`} />
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 42, color: D.firePct >= 100 ? C.green : C.gold, lineHeight: 1, marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
                    {pct(fireAnim)}
                  </div>
                  <div style={{ height: 6, background: C.border, borderRadius: 3, marginBottom: 14 }}>
                    <div style={{
                      width: `${fireAnim}%`, height: '100%', borderRadius: 3,
                      background: D.firePct >= 100 ? C.green : `linear-gradient(90deg,${C.goldDim},${C.gold},${C.glow})`,
                      boxShadow: `0 0 12px ${D.firePct >= 100 ? C.green : C.gold}66`,
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>
                    <span>Actual: <span style={{ color: C.text }}>{fmtUSD(D.totalUSD)}</span></span>
                    <span>Meta: <span style={{ color: C.gold }}>{fmtUSD(D.fireTarget)}</span></span>
                  </div>
                  </div>
                </div>
                <div style={{ ...cardStyle, background: C.bg, overflow: 'hidden', position: 'relative' }}>
                  <div style={FILO} />
                  <div style={{ padding: '24px 22px' }}>
                  <Label text="Años estimados para FIRE (8% retorno anual)" />
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 42, color: D.fireYears === 0 ? C.green : C.text, lineHeight: 1, marginBottom: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {D.fireYears === 0 ? '¡YA!' : D.fireYears !== null ? `${D.fireYears} años` : '50+ años'}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <Label text="Ahorro mensual asumido (USD)" />
                    <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, background: C.surface, marginTop: 4 }}>
                      <span style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>$</span>
                      <input type="number" value={monthlySav} onChange={e => setMonthlySav(e.target.value)} min={0}
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontFamily: 'monospace', fontSize: 12, padding: '7px 10px 7px 0' }} />
                    </div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, lineHeight: 1.7 }}>
                    Falta: <span style={{ color: C.gold }}>{fmtUSD(Math.max(0, D.fireTarget - D.totalUSD))}</span> para alcanzar la meta
                  </div>
                  </div>
                </div>
              </div>
            </div>
            </Reveal>

          </>
        )}

        {/* ── 11. ASSET ALLOCATION RECOMENDADA ── */}
        {!loading && (
          <div style={{ marginTop: 40 }}>
            <SectionTitle>ASSET ALLOCATION RECOMENDADA</SectionTitle>

            {quizResult === null ? (
              /* ── Quiz form ── */
              <div style={{ ...cardStyle, background: C.surface, padding: '28px 24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ ...FILO, position: 'absolute', top: 0, left: 0, right: 0 }} />
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, marginBottom: 28, lineHeight: 1.8 }}>
                  Responde 3 preguntas para recibir una recomendación de allocation personalizada según tu perfil de riesgo.
                </div>

                {/* Q1 */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.text, marginBottom: 10, letterSpacing: '0.05em' }}>
                    1. ¿Cuál es tu horizonte de inversión?
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {[
                      { value: 'menos1', label: 'Menos de 1 año' },
                      { value: '1-3',    label: '1–3 años'       },
                      { value: '3-10',   label: '3–10 años'      },
                      { value: '10+',    label: 'Más de 10 años' },
                    ].map(opt => (
                      <button key={opt.value}
                        onClick={() => setQuizAnswers(a => ({ ...a, horizonte: opt.value }))}
                        className={`pf-opt${quizAnswers.horizonte === opt.value ? ' on' : ''}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Q2 */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.text, marginBottom: 10, letterSpacing: '0.05em' }}>
                    2. ¿Cómo reaccionarías si tu cartera cae 20%?
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {[
                      { value: 'venderia',    label: 'Vendería todo'                  },
                      { value: 'esperaria',   label: 'Me preocuparía pero esperaría' },
                      { value: 'oportunidad', label: 'Lo vería como oportunidad'      },
                    ].map(opt => (
                      <button key={opt.value}
                        onClick={() => setQuizAnswers(a => ({ ...a, reaccion: opt.value }))}
                        className={`pf-opt${quizAnswers.reaccion === opt.value ? ' on' : ''}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Q3 */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.text, marginBottom: 10, letterSpacing: '0.05em' }}>
                    3. ¿Cuál es tu objetivo principal?
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {[
                      { value: 'preservar', label: 'Preservar capital'    },
                      { value: 'moderado',  label: 'Crecimiento moderado' },
                      { value: 'maximo',    label: 'Máximo crecimiento'   },
                    ].map(opt => (
                      <button key={opt.value}
                        onClick={() => setQuizAnswers(a => ({ ...a, objetivo: opt.value }))}
                        className={`pf-opt${quizAnswers.objetivo === opt.value ? ' on' : ''}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  disabled={!quizAnswers.horizonte || !quizAnswers.reaccion || !quizAnswers.objetivo}
                  onClick={() => setQuizResult(calcProfile(quizAnswers))}
                  className="pf-cta" style={{ padding: '12px 32px', fontSize: 12 }}>
                  VER MI PERFIL →
                </button>
              </div>

            ) : activeProfile && (
              /* ── Result ── */
              <div>
                {/* Badge + description */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 13, letterSpacing: '0.22em', padding: '6px 18px', background: activeProfile.badgeColor + '18', border: `1px solid ${activeProfile.badgeColor}`, color: activeProfile.badgeColor }}>
                    PERFIL: {activeProfile.label.toUpperCase()}
                  </div>
                  <button
                    onClick={() => { setQuizResult(null); setQuizAnswers({ horizonte: '', reaccion: '', objetivo: '' }) }}
                    className="pf-ghost" style={{ fontSize: 10, letterSpacing: '0.15em', padding: '5px 14px' }}>
                    REPETIR TEST
                  </button>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, lineHeight: 1.8, marginBottom: 28, maxWidth: 580 }}>
                  {activeProfile.desc}
                </div>

                {/* Donut + comparison table */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: 32, alignItems: 'start' }}>

                  {/* Donut chart + legend */}
                  <div>
                    <div style={{ position: 'relative', width: '100%', height: 200, marginBottom: 16 }}>
                      <canvas ref={donutRef} role="img" aria-label="Distribución del portafolio por activo" />
                      {/* Centro del donut — perfil activo */}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: 2 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.3em', color: C.muted }}>PERFIL</span>
                        <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, letterSpacing: '0.08em', color: activeProfile.badgeColor, textShadow: numberEmboss }}>
                          {activeProfile.label.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {activeProfile.allocation.map(a => (
                        <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, background: a.color, borderRadius: 1, flexShrink: 0 }} />
                          <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, flex: 1, letterSpacing: '0.08em' }}>{a.name}</span>
                          <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, color: C.text }}>{a.rec}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Comparison table */}
                  <div style={{ ...cardStyle, background: C.surface, overflow: 'hidden' }}>
                    <div style={FILO} />
                    <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: CARD_HEAD_BG }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>RECOMENDADO vs. TU CARTERA ACTUAL</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          {['Clase de Activo', 'Recomendado', 'Tu cartera', 'Diferencia'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.dimText, textAlign: 'left', fontWeight: 400 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeProfile.allocation.map(a => {
                          const actual = actualAlloc ? (actualAlloc[a.name] ?? 0) : null
                          const diff   = actual !== null ? actual - a.rec : null
                          return (
                            <tr key={a.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 8, height: 8, background: a.color, borderRadius: 1, flexShrink: 0 }} />
                                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.text }}>{a.name}</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 24, color: a.color }}>{a.rec}%</td>
                              <td style={{ padding: '12px 16px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 24, color: C.text }}>
                                {actual !== null ? `${actual.toFixed(1)}%` : '—'}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                {diff !== null ? (
                                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: Math.abs(diff) < 5 ? C.green : diff > 0 ? '#f59e0b' : C.red, background: (Math.abs(diff) < 5 ? C.green : diff > 0 ? '#f59e0b' : C.red) + '18', padding: '3px 10px' }}>
                                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted }}>—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {!actualAlloc && (
                      <div style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 11, color: C.muted, borderTop: `1px solid ${C.border}` }}>
                        Configura tu portafolio para comparar con tu cartera actual.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL: EDITAR PORTAFOLIO ── */}
      {modalOpen && (
        <>
        <style>{'@keyframes sk-modal-in{from{opacity:0;transform:translateY(8px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}'}</style>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div ref={modalRef} style={{ ...heroCardStyle, padding: 32, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', animation: 'sk-modal-in 0.18s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold }}>{'// EDITAR PORTAFOLIO'}</div>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: C.muted }}>ESC para cerrar</span>
            </div>
            <p style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, marginBottom: 24, lineHeight: 1.6 }}>
              Introduce el valor actual en USD de cada plataforma. Los datos se guardan en tu cuenta.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
              {PLATFORM_META.map(p => (
                <div key={p.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>{p.name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, marginLeft: 'auto' }}>{p.currency}</span>
                  </div>
                  <input type="number" step="any" min="0" placeholder="0"
                    value={draftForm[p.id] || ''}
                    onChange={e => setDraftForm(f => ({ ...f, [p.id]: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    onFocus={e => (e.currentTarget.style.borderColor = p.color)}
                    onBlur={e => (e.currentTarget.style.borderColor = C.border)}
                    style={inputStyle} />
                </div>
              ))}
            </div>
            {saveError && (
              <div style={{ marginBottom: 16, fontFamily: 'monospace', fontSize: 11, color: C.red }}>⚠ {saveError}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={savePortfolio} disabled={saving}
                className="pf-cta" style={{ flex: 1, padding: '12px', fontSize: 12, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'GUARDANDO…' : 'GUARDAR'}
              </button>
              <button onClick={() => setModalOpen(false)}
                className="pf-ghost" style={{ padding: '12px 20px', fontSize: 12, letterSpacing: '0.2em' }}>
                CANCELAR
              </button>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  )
}
