'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import { C } from '@/app/lib/constants'

const TerminalChart = dynamic(() => import('../terminal/TerminalChart'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 320, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>Cargando gráfico…</span>
    </div>
  ),
})

// ─── Constants ──────────────────────────���─────────────────────────────────────
const MONTHS = [
  'Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic',
  'Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic 24',
]

const PLATFORM_META = [
  { id: 'ibkr',            name: 'Interactive Brokers', color: '#3b82f6', currency: 'USD', type: 'Equities / Options', isCLP: false },
  { id: 'binance_spot',    name: 'Binance Spot',        color: '#f59e0b', currency: 'USD', type: 'Crypto Spot',        isCLP: false },
  { id: 'binance_futures', name: 'Binance Futures',     color: '#ef4444', currency: 'USD', type: 'Crypto Perps',       isCLP: false },
  { id: 'fintual',         name: 'Fintual',             color: '#8b5cf6', currency: 'CLP', type: 'Fondos Mutuos',      isCLP: true  },
  { id: 'santander',       name: 'Santander',           color: '#ec4899', currency: 'CLP', type: 'Ahorro / DAP',       isCLP: true  },
  { id: 'cash',            name: 'Cash / Banco',        color: '#6b7280', currency: 'USD', type: 'Liquidez',           isCLP: false },
]

const CRYPTO_IDS = new Set(['binance_spot', 'binance_futures'])

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
    label: 'Moderado', badgeColor: '#d4af37',
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
  return (
    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 26, color: C.text, letterSpacing: '0.05em', marginBottom: 14 }}>
      {children}
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
  background: C.bg, border: `1px solid ${C.border}`, outline: 'none',
  color: C.text, fontFamily: 'monospace', fontSize: 13, padding: '8px 12px',
  fontVariantNumeric: 'tabular-nums', width: '100%',
}

// ─── Main page ───────────────────────────���──────────────────────────────���─────
export default function PortfolioPage() {
  const [portfolio,    setPortfolio]    = useState<PortfolioRow>({})
  const [dbId,         setDbId]         = useState<string | null>(null)
  const [positions,    setPositions]    = useState<PassivePosition[]>([])
  const [storedTotal,  setStoredTotal]  = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [trm,          setTrm]          = useState('950')
  const [trmLive,      setTrmLive]      = useState(false)
  const [monthlySav,   setMonthlySav]   = useState('500')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [draftForm, setDraftForm] = useState<PortfolioRow>({})
  const [saving,    setSaving]    = useState(false)
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

  const trmVal = num(trm) || 950

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

      const { data } = await supabase.from('portfolio').select('*').eq('user_id', user.id).single()
      if (data) {
        setDbId(data.id)
        const vals: PortfolioRow = {}
        PLATFORM_META.forEach(p => { vals[p.id] = data[p.id] ?? 0 })
        setPortfolio(vals)
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

  // ─── Fetch Binance live data ──────────────────���───────────────────────────
  useEffect(() => {
    async function fetchBinance() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoadingBinanceFutures(false); setLoadingBinanceSpot(false); return }
      const headers = { Authorization: `Bearer ${session.access_token}` }

      try {
        const res = await fetch('/api/binance/positions', { headers })
        const json = await res.json()
        if (json.error) setErrorBinanceFutures(json.error)
        else setBinanceFutures(json.positions ?? [])
      } catch { setErrorBinanceFutures('Error al conectar.') }
      setLoadingBinanceFutures(false)

      try {
        const res = await fetch('/api/binance/spot', { headers })
        const json = await res.json()
        if (json.error) setErrorBinanceSpot(json.error)
        else setBinanceSpot(json.balances ?? [])
      } catch { setErrorBinanceSpot('Error al conectar.') }
      setLoadingBinanceSpot(false)
    }
    fetchBinance()
  }, [])

  // ─── Modal actions ────────────────���─────────────────────────────────��─────
  function openModal() { setDraftForm({ ...portfolio }); setModalOpen(true) }

  async function savePortfolio() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = { user_id: user.id, updated_at: new Date().toISOString(), ...draftForm }
    if (dbId) {
      await supabase.from('portfolio').update(payload).eq('id', dbId)
    } else {
      const { data } = await supabase.from('portfolio').insert(payload).select().single()
      if (data) setDbId(data.id)
    }
    setPortfolio({ ...draftForm })
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
    const platformHistories = platforms.map(p => ({ name: p.name, color: p.color, data: p.history }))
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
        name: 'Ingresos Pasivos', color: C.gold, usd: passiveCapital, type: 'Multi-yield',
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
      { name: 'Ingresos Pasivos', color: C.gold, type: 'Multi-yield',
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

  // ─── Render ──────────────────────────────────────────────────────���────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: 36, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
              {'// PORTAFOLIO · VISTA CONSOLIDADA'}
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
              <span style={{ color: C.text }}>PORTA</span>
              <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FOLIO</span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText }}>TRM CLP/USD</span>
                <span style={{ fontFamily: 'monospace', fontSize: 9, color: trmLive ? C.green : C.muted, letterSpacing: '0.1em' }}>
                  {trmLive ? '● live' : '○ manual'}
                </span>
              </div>
              <input
                type="number" value={trm} onChange={e => { setTrm(e.target.value); setTrmLive(false) }} min={1}
                style={{ width: 80, background: C.bg, border: `1px solid ${C.gold}44`, color: C.gold, fontFamily: 'monospace', fontSize: 13, padding: '4px 8px', outline: 'none', textAlign: 'right' }}
              />
            </div>
            <button onClick={openModal} style={{ padding: '10px 22px', border: `1px solid ${C.gold}`, background: 'transparent', color: C.gold, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', cursor: 'pointer' }}>
              EDITAR PORTAFOLIO
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: C.muted }}>Cargando portafolio…</div>
        ) : !hasSavedData ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '48px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginBottom: 20 }}>No tienes datos de portafolio guardados todavía.</div>
            <button onClick={openModal} style={{ padding: '12px 28px', background: C.gold, color: C.bg, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', border: 'none', cursor: 'pointer' }}>
              CONFIGURAR PORTAFOLIO
            </button>
          </div>
        ) : (
          <>
            {/* ── 1. KPI CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: C.border, marginBottom: 1 }}>
              {[
                { label: 'Total Patrimonio', value: fmtUSD(totalCurrent), sub: 'USD equiv.',       color: C.gold },
                { label: 'Rentabilidad YTD', value: `${ytdReturn > 0 ? '+' : ''}${ytdReturn.toFixed(2)}%`, sub: 'vs. inicio de año', color: ytdReturn >= 0 ? C.green : C.red },
                { label: 'Sharpe Ratio',     value: sharpe.toFixed(2),    sub: '12M rolling',      color: sharpe >= 1.5 ? C.green : C.gold },
                { label: 'Max Drawdown',     value: `${(maxDD * 100).toFixed(2)}%`, sub: '24M window', color: C.red },
              ].map(({ label, value, sub, color }) => (
                <div key={label} style={{ background: C.surface, padding: '20px 22px' }}>
                  <Label text={label} />
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 38, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* ── 2. CAPITAL EVOLUTION CHART ── */}
            <div style={{ background: C.surface, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>EVOLUCIÓN DE CAPITAL · 24 MESES</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>base: USD equiv.</span>
              </div>
              <TerminalChart labels={MONTHS.slice(0, 24)} total={totalHistory} platforms={platformHistories} />
            </div>

            {/* ── 3. KPIs × 4 (portfolio totals) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: C.border, marginBottom: 40 }}>
              {[
                { label: 'Patrimonio Total USD', value: fmtUSD(D.totalUSD),       color: C.text  },
                { label: 'Patrimonio Total CLP', value: fmtCLP(D.totalCLP),       color: C.text  },
                { label: 'Ingreso Pasivo / mes', value: fmtUSD(D.passiveMonthly), color: C.green },
                { label: 'Yield Efectivo',       value: pct(D.yieldRatio),        color: C.gold  },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: C.surface, padding: '20px 22px' }}>
                  <Label text={label} />
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, color, lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* ── 4. ALLOCATION BAR ── */}
            <div style={{ marginBottom: 40 }}>
              <SectionTitle>ALLOCATION</SectionTitle>
              <div style={{ display: 'flex', height: 32, borderRadius: 2, overflow: 'hidden', marginBottom: 16, background: C.border }}>
                {D.allSegments.map(seg => seg.pct > 0 && (
                  <div key={seg.name} title={`${seg.name}: ${pct(seg.pct)}`}
                    style={{ width: `${seg.pct}%`, background: seg.color, transition: 'width 0.5s ease' }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, background: C.border }}>
                {D.allSegments.map(seg => seg.usd > 0 && (
                  <div key={seg.name} style={{ background: C.surface, padding: '12px 16px', flex: '1 1 140px', minWidth: 130 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 10, height: 10, background: seg.color, borderRadius: 1, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{seg.name}</span>
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, color: C.text, lineHeight: 1 }}>{fmtUSD(seg.usd)}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: seg.color, marginTop: 3 }}>{pct(seg.pct)}</div>
                    {seg.monthlyIncome > 0 && (
                      <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.green, marginTop: 2 }}>{fmtUSD(seg.monthlyIncome)}/mes</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── 5. BINANCE FUTURES POSITIONS ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ background: C.surface, padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>BINANCE FUTURES · POSICIONES ABIERTAS</span>
              </div>
              <div style={{ background: C.bg, padding: '16px 18px' }}>
                {loadingBinanceFutures ? (
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted }}>Cargando posiciones…</div>
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
                          <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
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

            {/* ── 6. BINANCE SPOT BALANCES ── */}
            <div style={{ marginBottom: 40 }}>
              <div style={{ background: C.surface, padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>BINANCE SPOT · BALANCES</span>
              </div>
              <div style={{ background: C.bg, padding: '16px 18px' }}>
                {loadingBinanceSpot ? (
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted }}>Cargando balances…</div>
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

            {/* ── 7. DETAIL TABLE ── */}
            <div style={{ marginBottom: 40 }}>
              <SectionTitle>DETALLE POR PLATAFORMA</SectionTitle>
              <div style={{ background: C.surface, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Plataforma', 'Tipo', 'Capital USD', 'Capital CLP', '% del total', 'Ingreso/mes'].map(h => (
                        <th key={h} style={{ padding: '8px 16px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dimText, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {D.tableRows.map(row => (
                      <tr key={row.name} style={{ borderBottom: `1px solid ${C.border}` }}>
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

            {/* ── 8. CONCENTRATION & RISK ── */}
            <div style={{ marginBottom: 40 }}>
              <SectionTitle>CONCENTRACIÓN Y RIESGO</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: C.border }}>
                {[
                  { label: 'Concentración máxima', v: D.maxSegment.pct, sub: `Mayor posición: ${D.maxSegment.name}`,
                    level: D.maxSegment.pct > 50 ? { l: 'ALTA', c: C.red } : D.maxSegment.pct > 30 ? { l: 'MEDIA', c: C.yellow } : { l: 'BAJA', c: C.green } },
                  { label: 'Exposición Crypto', v: D.cryptoPct, sub: 'Binance Spot + Futures',
                    level: D.cryptoPct > 60 ? { l: 'ALTA', c: C.red } : D.cryptoPct > 35 ? { l: 'MEDIA', c: C.yellow } : { l: 'BAJA', c: C.green } },
                  { label: 'Liquidez inmediata', v: D.cashPct, sub: `Cash: ${fmtUSD(D.cashUSD)}`,
                    level: D.cashPct < 5 ? { l: 'CRÍTICA', c: C.red } : D.cashPct < 10 ? { l: 'BAJA', c: C.yellow } : { l: 'OK', c: C.green } },
                ].map(({ label, v, sub, level }) => (
                  <div key={label} style={{ background: C.surface, padding: '22px 20px' }}>
                    <Label text={label} />
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                      <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, color: level.c, lineHeight: 1 }}>{pct(v)}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.15em', color: level.c, background: level.c + '18', padding: '2px 8px' }}>{level.l}</div>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{sub}</div>
                    <div style={{ marginTop: 10, height: 3, background: C.border, borderRadius: 2 }}>
                      <div style={{ width: `${Math.min(v, 100)}%`, height: '100%', background: level.c, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 9. FIRE PROGRESS ── */}
            <div style={{ marginBottom: 40 }}>
              <SectionTitle>PROGRESO FIRE</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.border }}>
                <div style={{ background: C.surface, padding: '24px 22px' }}>
                  <Label text={`Meta FIRE — $${D.FIRE_GOAL_MONTHLY.toLocaleString('es-CL')}/mes · Regla 4%`} />
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 42, color: D.firePct >= 100 ? C.green : C.gold, lineHeight: 1, marginBottom: 8 }}>
                    {pct(D.firePct)}
                  </div>
                  <div style={{ height: 6, background: C.border, borderRadius: 3, marginBottom: 14 }}>
                    <div style={{ width: `${D.firePct}%`, height: '100%', borderRadius: 3, background: D.firePct >= 100 ? C.green : `linear-gradient(90deg,${C.gold},${C.glow})`, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>
                    <span>Actual: <span style={{ color: C.text }}>{fmtUSD(D.totalUSD)}</span></span>
                    <span>Meta: <span style={{ color: C.gold }}>{fmtUSD(D.fireTarget)}</span></span>
                  </div>
                </div>
                <div style={{ background: C.bg, padding: '24px 22px' }}>
                  <Label text="Años estimados para FIRE (8% retorno anual)" />
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 42, color: D.fireYears === 0 ? C.green : C.text, lineHeight: 1, marginBottom: 12 }}>
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

            {/* ── 10. TAX MINI-CARD ── */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <Label text="Resumen tributario estimado" />
                <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, marginBottom: 3 }}>Ingreso pasivo anual</div>
                    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 28, color: C.green, lineHeight: 1 }}>{fmtUSD(D.ingresoAnual)}</div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, maxWidth: 340, lineHeight: 1.7 }}>
                    Para calcular tu Impuesto Global Complementario (IGC) con desglose por BTC, futuros, acciones y más →
                  </div>
                </div>
              </div>
              <Link href="/tax" style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.gold, border: `1px solid ${C.gold}`, padding: '10px 24px', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                → TAX CHILE
              </Link>
            </div>
          </>
        )}

        {/* ── 11. ASSET ALLOCATION RECOMENDADA ── */}
        {!loading && (
          <div style={{ marginTop: 40 }}>
            <SectionTitle>ASSET ALLOCATION RECOMENDADA</SectionTitle>

            {quizResult === null ? (
              /* ── Quiz form ── */
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '28px 24px' }}>
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
                        style={{ padding: '8px 16px', background: quizAnswers.horizonte === opt.value ? C.gold + '20' : 'transparent', border: `1px solid ${quizAnswers.horizonte === opt.value ? C.gold : C.border}`, color: quizAnswers.horizonte === opt.value ? C.gold : C.dimText, fontFamily: 'monospace', fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em' }}>
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
                        style={{ padding: '8px 16px', background: quizAnswers.reaccion === opt.value ? C.gold + '20' : 'transparent', border: `1px solid ${quizAnswers.reaccion === opt.value ? C.gold : C.border}`, color: quizAnswers.reaccion === opt.value ? C.gold : C.dimText, fontFamily: 'monospace', fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em' }}>
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
                        style={{ padding: '8px 16px', background: quizAnswers.objetivo === opt.value ? C.gold + '20' : 'transparent', border: `1px solid ${quizAnswers.objetivo === opt.value ? C.gold : C.border}`, color: quizAnswers.objetivo === opt.value ? C.gold : C.dimText, fontFamily: 'monospace', fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  disabled={!quizAnswers.horizonte || !quizAnswers.reaccion || !quizAnswers.objetivo}
                  onClick={() => setQuizResult(calcProfile(quizAnswers))}
                  style={{ padding: '12px 32px', background: C.gold, color: C.bg, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', border: 'none', cursor: 'pointer', opacity: (!quizAnswers.horizonte || !quizAnswers.reaccion || !quizAnswers.objetivo) ? 0.4 : 1 }}>
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
                    style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', color: C.dimText, background: 'transparent', border: `1px solid ${C.border}`, padding: '5px 14px', cursor: 'pointer' }}>
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
                      <canvas ref={donutRef} />
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
                  <div style={{ background: C.surface }}>
                    <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div ref={modalRef} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 32, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 20 }}>{'// EDITAR PORTAFOLIO'}</div>
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
                    onChange={e => setDraftForm(f => ({ ...f, [p.id]: parseFloat(e.target.value) || 0 }))}
                    style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={savePortfolio} disabled={saving}
                style={{ flex: 1, padding: '12px', background: C.gold, color: C.bg, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'GUARDANDO…' : 'GUARDAR'}
              </button>
              <button onClick={() => setModalOpen(false)}
                style={{ padding: '12px 20px', background: 'transparent', color: C.dimText, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
