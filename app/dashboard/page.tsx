'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, ArcElement, Filler, Tooltip,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Filler, Tooltip)

// ── Types ─────────────────────────────────────────────────────────────────────
type Section    = 'overview' | 'portfolio' | 'signals' | 'fire' | 'reports' | 'journal' | 'config'
type ConfigTab  = 'perfil' | 'estrategia' | 'alertas'
type JFilter    = 'all' | 'long' | 'short' | 'win' | 'loss'

// ── Deterministic equity curve (90 pts, $0 → $234.65) ────────────────────────
function srnd(s: number) { const x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x) }
const EQUITY: number[] = (() => {
  const n = 90, final = 234.65, drift = final / (n - 1)
  const pts = [0]
  for (let i = 1; i < n - 1; i++) pts.push(parseFloat((pts[i - 1] + drift + (srnd(i * 7 + 3) - 0.42) * 22).toFixed(2)))
  pts.push(final)
  return pts
})()
const EQ_LABELS = Array.from({ length: 90 }, (_, i) =>
  i === 0 ? '01 Feb' : i === 28 ? '01 Mar' : i === 59 ? '01 Abr' : i === 89 ? '30 Abr' : ''
)

// ── Static data ───────────────────────────────────────────────────────────────
const SPARKS: Record<string, { d: number[]; pos: boolean }> = {
  pnl:    { d: [12,18,15,22,19,28,24,32,29,38,35,46,52,64],   pos: true  },
  wr:     { d: [80,82,79,84,83,85,86,84,87,85,86,85,85,85],   pos: true  },
  pf:     { d: [3.8,3.9,3.7,4.0,4.1,4.0,4.1,4.2,4.1,4.2,4.1,4.2,4.1,4.16], pos: true },
  trades: { d: [2,3,4,3,4,5,3,4,5,4,3,4,5,36],               pos: true  },
  sharpe: { d: [8.1,8.8,9.0,9.2,9.5,9.8,9.6,10.0,9.9,10.1,10.0,10.2,10.1,10.25], pos: true },
  dd:     { d: [-8,-7,-9,-8,-10,-9,-11,-10,-12,-11,-11,-12,-11,-11.8], pos: false },
}

const KPIS = [
  { label: 'P&L MES',       value: '+$64.05',  sub: 'Abr 2026',      color: 'text-emerald-400', spark: 'pnl'    },
  { label: 'WIN RATE',      value: '85.2%',    sub: '122 trades',    color: 'text-gold',         spark: 'wr'     },
  { label: 'PROFIT FACTOR', value: '4.16x',    sub: 'PRO.MACD v116', color: 'text-gold',         spark: 'pf'     },
  { label: 'TRADES MES',    value: '36',       sub: 'Abr 2026',      color: 'text-gold',         spark: 'trades' },
  { label: 'SHARPE RATIO',  value: '10.25',    sub: 'Feb–Abr 2026',  color: 'text-gold',         spark: 'sharpe' },
  { label: 'MAX DRAWDOWN',  value: '-11.8%',   sub: 'período',       color: 'text-red-400',      spark: 'dd'     },
]

const PORTFOLIO = [
  { name: 'IBKR',            type: 'Acciones USA', value: 28450, pct: 40, chg: '+12.3', pos: true,  color: '#3b82f6' },
  { name: 'Binance Spot',    type: 'Cripto',       value: 14320, pct: 20, chg: '-5.8',  pos: false, color: '#f59e0b' },
  { name: 'Binance Futures', type: 'BTC Perp',     value:  8780, pct: 12, chg: '+44.0', pos: true,  color: '#ef4444' },
  { name: 'Fintual',         type: 'Fondos CL',    value: 12640, pct: 18, chg: '+7.2',  pos: true,  color: '#8b5cf6' },
  { name: 'Santander',       type: 'Cash CL',      value:  6900, pct: 10, chg: '+2.1',  pos: true,  color: '#ec4899' },
]

const CORR_NAMES = ['IBKR', 'BN.Spot', 'BN.Fut', 'Fintual', 'Sntdr']
const CORR = [
  [1.00, 0.42, 0.38, 0.31, 0.12],
  [0.42, 1.00, 0.88, 0.21, 0.08],
  [0.38, 0.88, 1.00, 0.18, 0.05],
  [0.31, 0.21, 0.18, 1.00, 0.22],
  [0.12, 0.08, 0.05, 0.22, 1.00],
]

const SIGNALS = [
  { pair: 'BTCUSDT', dir: 'LONG',  prob: 78, tf: '15M', entry: '95,200', sl: '94,200', tp: '97,400', rr: '2.2', status: 'ACTIVA',  date: '2026-04-16' },
  { pair: 'ETHUSDT', dir: 'SHORT', prob: 65, tf: '1H',  entry: '3,180',  sl: '3,230',  tp: '3,045',  rr: '2.7', status: 'ACTIVA',  date: '2026-04-15' },
  { pair: 'SOLUSDT', dir: 'LONG',  prob: 71, tf: '15M', entry: '178.5',  sl: '175.5',  tp: '185.5',  rr: '2.3', status: 'CERRADA', date: '2026-04-13' },
]

const JOURNAL_DATA = [
  { fecha: '2026-04-14', par: 'BTCUSDT', dir: 'LONG',  entrada: '95,200', salida: '97,840', pnl: '+$52.80', rr: '2.2', win: true  },
  { fecha: '2026-04-11', par: 'ETHUSDT', dir: 'SHORT', entrada: '3,180',  salida: '3,045',  pnl: '+$27.00', rr: '1.8', win: true  },
  { fecha: '2026-04-08', par: 'BTCUSDT', dir: 'LONG',  entrada: '93,450', salida: '92,100', pnl: '-$27.00', rr: '-0.9', win: false },
  { fecha: '2026-03-28', par: 'SOLUSDT', dir: 'LONG',  entrada: '178.5',  salida: '192.3',  pnl: '+$13.80', rr: '2.4', win: true  },
  { fecha: '2026-03-21', par: 'BTCUSDT', dir: 'SHORT', entrada: '98,100', salida: '96,200', pnl: '+$38.00', rr: '2.0', win: true  },
  { fecha: '2026-03-15', par: 'ETHUSDT', dir: 'LONG',  entrada: '3,250',  salida: '3,410',  pnl: '+$32.00', rr: '2.1', win: true  },
  { fecha: '2026-02-28', par: 'BTCUSDT', dir: 'SHORT', entrada: '91,800', salida: '90,200', pnl: '+$32.00', rr: '2.0', win: true  },
  { fecha: '2026-02-20', par: 'SOLUSDT', dir: 'SHORT', entrada: '185.5',  salida: '190.2',  pnl: '-$9.40',  rr: '-0.8', win: false },
]

const NAV: { id: Section; icon: string; label: string }[] = [
  { id: 'overview',  icon: '◈', label: 'RESUMEN'    },
  { id: 'portfolio', icon: '▦', label: 'PORTAFOLIO' },
  { id: 'signals',   icon: '◉', label: 'SEÑALES'    },
  { id: 'fire',      icon: '◎', label: 'FIRE'       },
  { id: 'reports',   icon: '▤', label: 'REPORTES'   },
  { id: 'journal',   icon: '▨', label: 'JOURNAL'    },
  { id: 'config',    icon: '⊙', label: 'CONFIG'     },
]

// ── Primitives ────────────────────────────────────────────────────────────────
function Clock() {
  const [t, setT] = useState('')
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' }) + ' EST')
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])
  return <>{t}</>
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const W = 72, H = 20
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${(H - ((v - min) / range) * (H - 2) - 1).toFixed(1)}`).join(' ')
  return (
    <svg width={W} height={H} className="opacity-60">
      <polyline points={pts} fill="none" stroke={positive ? '#34d399' : '#f87171'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ProbArc({ value }: { value: number }) {
  const r = 26, cx = 32, cy = 32, circ = 2 * Math.PI * r
  return (
    <svg width={64} height={64} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1d2e" strokeWidth={6} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#d4af37" strokeWidth={6}
        strokeDasharray={`${((value / 100) * circ).toFixed(1)} ${circ.toFixed(1)}`} strokeLinecap="round" />
    </svg>
  )
}

function AnimCounter({ target }: { target: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const s = Date.now(), dur = 1800
    const tick = () => { const p = Math.min((Date.now() - s) / dur, 1); setV(Math.round((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  }, [target])
  return <>{v}</>
}

function Divider() {
  return <div className="w-full h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent my-1" />
}

// ── Live prices WebSocket ──────────────────────────────────────────────────────
type Tick = { price: string; chg: string; up: boolean }
function useLivePrices() {
  const [prices, setPrices] = useState<Record<string, Tick>>({})
  const ws = useRef<WebSocket | null>(null)
  useEffect(() => {
    function connect() {
      const sock = new WebSocket('wss://stream.binance.com:9443/stream?streams=btcusdt@miniTicker/ethusdt@miniTicker/solusdt@miniTicker')
      ws.current = sock
      sock.onmessage = (ev) => {
        const d = JSON.parse(ev.data).data
        if (!d?.s) return
        const close = parseFloat(d.c), open = parseFloat(d.o)
        const pct = ((close - open) / open) * 100
        const dec = d.s === 'SOLUSDT' ? 3 : 2
        setPrices(p => ({ ...p, [d.s]: {
          price: close.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }),
          chg: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
          up: pct >= 0,
        }}))
      }
      sock.onclose = () => setTimeout(connect, 3000)
    }
    connect()
    return () => ws.current?.close()
  }, [])
  return prices
}

// ── HUD Panel (right sidebar — always visible) ───────────────────────────────
function HudPanel({ prices }: { prices: Record<string, Tick> }) {
  const [session, setSession] = useState('')
  useEffect(() => {
    const tick = () => {
      const h = new Date().getUTCHours()
      setSession(h < 8 ? 'ASIA' : h < 13 ? 'LONDON' : h < 21 ? 'NEW YORK' : 'OVERNIGHT')
    }
    tick(); const id = setInterval(tick, 60_000); return () => clearInterval(id)
  }, [])

  const btc = prices['BTCUSDT'], eth = prices['ETHUSDT'], sol = prices['SOLUSDT']

  return (
    <aside className="hidden xl:flex flex-col w-72 bg-surface border-l border-border overflow-y-auto shrink-0">
      <div className="p-4 border-b border-border">
        <div className="section-label text-gold text-xs mb-3">{'// LIVE HUD'}</div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="terminal-text text-xs text-emerald-400">SISTEMA ACTIVO</span>
        </div>
      </div>

      {/* Sesión de mercado */}
      <div className="p-4 border-b border-border">
        <div className="section-label text-text-dim text-xs mb-2">SESIÓN ACTIVA</div>
        <div className="display-heading text-2xl text-gold">{session || '—'}</div>
        <div className="terminal-text text-xs text-text-dim mt-1">
          <Clock />
        </div>
      </div>

      <Divider />

      {/* Precios en vivo */}
      <div className="p-4 border-b border-border flex flex-col gap-3">
        <div className="section-label text-text-dim text-xs mb-1">CRYPTO LIVE</div>
        {[
          { sym: 'BTCUSDT', label: 'BTC', tick: btc },
          { sym: 'ETHUSDT', label: 'ETH', tick: eth },
          { sym: 'SOLUSDT', label: 'SOL', tick: sol },
        ].map(({ label, tick }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="terminal-text text-xs text-text-dim w-8">{label}</span>
            <span className="terminal-text text-sm text-text num tabular-nums">
              {tick ? tick.price : <span className="text-muted animate-pulse">—</span>}
            </span>
            {tick && (
              <span className={`terminal-text text-xs num tabular-nums ${tick.up ? 'text-emerald-400' : 'text-red-400'}`}>
                {tick.chg}
              </span>
            )}
          </div>
        ))}
        {/* Static markets */}
        <Divider />
        {[
          { label: 'SPX',  price: '5,234', chg: '+0.82%', up: true },
          { label: 'GOLD', price: '2,341', chg: '+0.21%', up: true },
        ].map(m => (
          <div key={m.label} className="flex items-center justify-between">
            <span className="terminal-text text-xs text-text-dim w-8">{m.label}</span>
            <span className="terminal-text text-sm text-text num tabular-nums">{m.price}</span>
            <span className={`terminal-text text-xs num tabular-nums ${m.up ? 'text-emerald-400' : 'text-red-400'}`}>{m.chg}</span>
          </div>
        ))}
      </div>

      <Divider />

      {/* Señal activa */}
      <div className="p-4 border-b border-border">
        <div className="section-label text-text-dim text-xs mb-3">SEÑAL ACTIVA</div>
        <div className="bg-bg border border-gold/20 p-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="display-heading text-xl text-text">BTCUSDT</span>
            <span className="section-label text-xs text-emerald-400 border border-emerald-400/30 px-2 py-0.5">LONG</span>
          </div>
          <div className="flex gap-4">
            <div>
              <div className="section-label text-text-dim text-xs">PROB</div>
              <div className="display-heading text-xl text-gold">78%</div>
            </div>
            <div>
              <div className="section-label text-text-dim text-xs">TF</div>
              <div className="display-heading text-xl text-text">15M</div>
            </div>
            <div>
              <div className="section-label text-text-dim text-xs">RR</div>
              <div className="display-heading text-xl text-gold">2.2</div>
            </div>
          </div>
        </div>
      </div>

      <Divider />

      {/* P&L y VaR */}
      <div className="p-4 flex flex-col gap-3">
        <div>
          <div className="section-label text-text-dim text-xs mb-1">P&L HOY</div>
          <div className="display-heading text-3xl text-emerald-400 num">+$64.05</div>
        </div>
        <div>
          <div className="section-label text-text-dim text-xs mb-1">VaR DEL DÍA</div>
          <div className="display-heading text-2xl text-red-400 num">−$142</div>
          <div className="terminal-text text-xs text-muted">2% del capital</div>
        </div>
        <Divider />
        <div className="terminal-text text-xs text-text-dim leading-relaxed">
          PRO.MACD v116<br />
          Feb–Abr 2026 · 122 trades<br />
          <span className="text-gold">Sharpe 10.25 · WR 85.2%</span>
        </div>
      </div>
    </aside>
  )
}

// ── SECTION: Overview ─────────────────────────────────────────────────────────
function SectionOverview({ onNav }: { onNav: (s: Section) => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const chartData = {
    labels: EQ_LABELS,
    datasets: [{
      label: 'Equity',
      data: EQUITY,
      borderColor: '#d4af37',
      backgroundColor: 'rgba(212,175,55,0.08)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
    }],
  }
  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: {
      backgroundColor: '#0b0d14',
      borderColor: '#1a1d2e',
      borderWidth: 1,
      titleColor: '#9298b8',
      bodyColor: '#d4af37',
      callbacks: { label: (ctx: { parsed: { y: number | null } }) => ` $${(ctx.parsed.y ?? 0).toFixed(2)}` },
    }},
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9298b8', font: { size: 10 }, maxTicksLimit: 6 }, border: { color: '#1a1d2e' } },
      y: { grid: { color: 'rgba(26,29,46,0.8)' }, ticks: { color: '#9298b8', font: { size: 10 }, callback: (v: number | string) => `$${v}` }, border: { color: '#1a1d2e' } },
    },
  } as const

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <div className="section-label text-gold mb-1">{'// PANEL DE CONTROL'}</div>
        <h2 className="display-heading text-5xl text-text">RESUMEN</h2>
      </div>

      {/* 6 KPI cards with sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-border">
        {KPIS.map(k => (
          <div key={k.label} className="bg-surface p-4 hover:border-gold/20 transition-colors flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <span className="section-label text-text-dim text-xs">{k.label}</span>
              <Sparkline data={SPARKS[k.spark].d} positive={SPARKS[k.spark].pos} />
            </div>
            <div className={`display-heading text-3xl num tabular-nums ${k.color}`}>{k.value}</div>
            <div className="terminal-text text-xs text-muted">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Equity curve */}
      <div className="bg-surface border border-border">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <div className="section-label text-gold text-xs">EQUITY CURVE · PRO.MACD v116</div>
            <div className="terminal-text text-xs text-text-dim">Feb–Abr 2026 · 90 días · $0 → +$234.65</div>
          </div>
          <div className="display-heading text-2xl text-emerald-400 num">+$234.65</div>
        </div>
        <div className="p-4 h-52">
          {mounted
            ? <Line data={chartData} options={chartOpts} />
            : <div className="h-full bg-bg animate-pulse" />
          }
        </div>
      </div>

      {/* Quick access cards */}
      <div className="grid sm:grid-cols-3 gap-px bg-border">
        {[
          { id: 'signals'  as Section, label: 'SEÑALES ACTIVAS', value: '2',        color: 'text-emerald-400', desc: 'BTCUSDT · ETHUSDT' },
          { id: 'fire'     as Section, label: 'FIRE AGE',         value: '38 años',  color: 'text-gold',        desc: 'Proyección base' },
          { id: 'journal'  as Section, label: 'ÚLTIMO P&L',       value: '+$52.80',  color: 'text-emerald-400', desc: 'BTCUSDT LONG · 14 Abr' },
        ].map(c => (
          <button key={c.id} onClick={() => onNav(c.id)}
            className="bg-surface p-5 text-left hover:bg-gold/5 transition-colors group border border-transparent hover:border-gold/20">
            <div className="section-label text-text-dim text-xs mb-2">{c.label}</div>
            <div className={`display-heading text-3xl num ${c.color} group-hover:text-gold transition-colors`}>{c.value}</div>
            <div className="terminal-text text-xs text-muted mt-1">{c.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── SECTION: Portfolio ────────────────────────────────────────────────────────
function SectionPortfolio() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const donutData = {
    labels: PORTFOLIO.map(p => p.name),
    datasets: [{
      data: PORTFOLIO.map(p => p.pct),
      backgroundColor: PORTFOLIO.map(p => p.color + '99'),
      borderColor: PORTFOLIO.map(p => p.color),
      borderWidth: 1.5,
      hoverOffset: 6,
    }],
  }
  const donutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0b0d14',
        borderColor: '#1a1d2e',
        borderWidth: 1,
        titleColor: '#9298b8',
        bodyColor: '#e8e9f0',
        callbacks: { label: (ctx: { label: string; parsed: number }) => ` ${ctx.label}: ${ctx.parsed}%` },
      },
    },
  } as const

  function corrColor(v: number) {
    if (v >= 1.00) return 'bg-gold/30 text-gold'
    if (v >= 0.70) return 'bg-red-500/20 text-red-400'
    if (v >= 0.40) return 'bg-yellow-500/10 text-yellow-400'
    return 'bg-emerald-500/5 text-emerald-400'
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <div className="section-label text-gold mb-1">{'// ASIGNACIÓN DE CAPITAL'}</div>
        <h2 className="display-heading text-5xl text-text">PORTAFOLIO</h2>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-px bg-border">
        <div className="bg-surface p-5">
          <div className="section-label text-text-dim text-xs mb-1">TOTAL</div>
          <div className="display-heading text-4xl text-gold num">$71,090</div>
          <div className="terminal-text text-xs text-muted">USD equiv.</div>
        </div>
        <div className="bg-surface p-5">
          <div className="section-label text-text-dim text-xs mb-1">MEJOR PLATAFORMA</div>
          <div className="display-heading text-3xl text-emerald-400">IBKR</div>
          <div className="terminal-text text-xs text-muted">+12.3% YTD</div>
        </div>
        <div className="bg-surface p-5">
          <div className="section-label text-text-dim text-xs mb-1">MAYOR EXPOSICIÓN</div>
          <div className="display-heading text-3xl text-gold">IBKR</div>
          <div className="terminal-text text-xs text-muted">40% del portafolio</div>
        </div>
      </div>

      {/* Table + Donut */}
      <div className="grid lg:grid-cols-[1fr_220px] gap-px bg-border">
        {/* Table with progress bars */}
        <div className="bg-surface overflow-x-auto">
          <div className="px-5 py-3 border-b border-border">
            <div className="section-label text-text-dim text-xs">DESGLOSE PLATAFORMAS</div>
          </div>
          <table className="w-full border-collapse min-w-[400px]">
            <thead>
              <tr className="border-b border-border">
                {['Plataforma', 'Tipo', 'Valor', 'Rendimiento', 'Peso'].map(h => (
                  <th key={h} className="section-label text-text-dim text-xs text-left px-4 py-3 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PORTFOLIO.map((p, i) => (
                <tr key={p.name} className={`border-b border-border hover:bg-gold/5 transition-colors ${i % 2 ? 'bg-gold/[0.015]' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                      <span className="terminal-text text-sm text-text">{p.name}</span>
                    </div>
                  </td>
                  <td className="terminal-text text-xs text-text-dim px-4 py-3">{p.type}</td>
                  <td className="terminal-text text-sm text-gold num tabular-nums px-4 py-3">
                    ${p.value.toLocaleString('en-US')}
                  </td>
                  <td className={`terminal-text text-sm num tabular-nums px-4 py-3 ${p.pos ? 'text-emerald-400' : 'text-red-400'}`}>
                    {p.chg}%
                  </td>
                  <td className="px-4 py-3 w-28">
                    <div className="flex items-center gap-2">
                      <div className="h-1 flex-1 bg-border">
                        <div className="h-full transition-all duration-700" style={{ width: `${p.pct}%`, background: p.color }} />
                      </div>
                      <span className="terminal-text text-xs text-text-dim num tabular-nums w-7">{p.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Donut chart */}
        <div className="bg-surface p-5 flex flex-col gap-4">
          <div className="section-label text-text-dim text-xs">DISTRIBUCIÓN</div>
          <div className="h-40">
            {mounted
              ? <Doughnut data={donutData} options={donutOpts} />
              : <div className="h-full bg-bg animate-pulse rounded-full" />
            }
          </div>
          <div className="flex flex-col gap-1.5">
            {PORTFOLIO.map(p => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="terminal-text text-xs text-text-dim flex-1">{p.name}</span>
                <span className="terminal-text text-xs text-text num">{p.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Correlation matrix */}
      <div className="bg-surface border border-border overflow-x-auto">
        <div className="px-5 py-3 border-b border-border">
          <div className="section-label text-text-dim text-xs">MATRIZ DE CORRELACIÓN</div>
        </div>
        <div className="p-4 min-w-[400px]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-20" />
                {CORR_NAMES.map(n => (
                  <th key={n} className="section-label text-text-dim text-xs font-normal py-2 px-2 text-center">{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CORR.map((row, i) => (
                <tr key={CORR_NAMES[i]}>
                  <td className="section-label text-text-dim text-xs py-1.5 pr-3">{CORR_NAMES[i]}</td>
                  {row.map((v, j) => (
                    <td key={j} className={`text-center py-1.5 px-2 terminal-text text-xs num tabular-nums ${corrColor(v)}`}>
                      {v.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── SECTION: Signals ──────────────────────────────────────────────────────────
function SectionSignals() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <div className="section-label text-gold mb-1">{'// PRO.MACD v116'}</div>
        <h2 className="display-heading text-5xl text-text">SEÑALES</h2>
      </div>

      <div className="flex flex-col gap-4">
        {SIGNALS.map((s, i) => (
          <div key={i} className="bg-surface border border-border hover:border-gold/30 transition-colors p-5">
            <div className="flex flex-wrap gap-5 items-start">
              {/* Left: pair + status */}
              <div className="flex items-center gap-3 min-w-[160px]">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.status === 'ACTIVA' ? 'bg-emerald-400 animate-pulse' : 'bg-muted'}`} />
                <div>
                  <div className="display-heading text-3xl text-text">{s.pair}</div>
                  <div className="terminal-text text-xs text-muted">{s.date}</div>
                </div>
              </div>

              {/* Prob arc */}
              <div className="relative flex items-center justify-center w-16 h-16">
                <ProbArc value={s.prob} />
                <div className="absolute text-center">
                  <div className="display-heading text-lg text-gold leading-none">{s.prob}%</div>
                </div>
              </div>

              {/* Direction + TF */}
              <div className="flex flex-col gap-2">
                <span className={`section-label text-xs border px-3 py-1 self-start ${
                  s.dir === 'LONG' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5'
                                   : 'text-red-400 border-red-400/30 bg-red-400/5'
                }`}>{s.dir}</span>
                <div className="flex gap-4">
                  <div>
                    <div className="section-label text-text-dim text-xs">TF</div>
                    <div className="display-heading text-xl text-text">{s.tf}</div>
                  </div>
                  <div>
                    <div className="section-label text-text-dim text-xs">RR</div>
                    <div className="display-heading text-xl text-gold">{s.rr}</div>
                  </div>
                </div>
              </div>

              {/* Levels */}
              <div className="flex gap-4 ml-auto">
                <div>
                  <div className="section-label text-text-dim text-xs">ENTRADA</div>
                  <div className="terminal-text text-sm text-text num tabular-nums">{s.entry}</div>
                </div>
                <div>
                  <div className="section-label text-text-dim text-xs">STOP LOSS</div>
                  <div className="terminal-text text-sm text-red-400 num tabular-nums">{s.sl}</div>
                </div>
                <div>
                  <div className="section-label text-text-dim text-xs">TAKE PROFIT</div>
                  <div className="terminal-text text-sm text-emerald-400 num tabular-nums">{s.tp}</div>
                </div>
                <div className="flex items-start">
                  <span className={`section-label text-xs border px-2 py-0.5 ${
                    s.status === 'ACTIVA' ? 'text-emerald-400 border-emerald-400/30' : 'text-muted border-border'
                  }`}>{s.status}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Track record footer */}
      <div className="bg-surface border border-border/60 p-4">
        <div className="terminal-text text-xs text-text-dim leading-relaxed">
          <span className="text-gold">PRO.MACD v116</span> · Feb–Abr 2026 · 122 trades ·
          Sharpe <span className="text-text">10.25</span> · WR <span className="text-text">85.2%</span> · PF <span className="text-text">4.16x</span> · Max DD <span className="text-red-400">-11.8%</span> · Expectancy <span className="text-emerald-400">+$2.34</span>
        </div>
      </div>
    </div>
  )
}

// ── SECTION: FIRE ─────────────────────────────────────────────────────────────
function SectionFire() {
  const scenarios = [
    { label: 'CONSERVADOR', age: 45, years: 20, return: '10%', color: 'text-text-dim', border: 'border-border' },
    { label: 'BASE',        age: 38, years: 13, return: '18%', color: 'text-gold',     border: 'border-gold/40' },
    { label: 'AGRESIVO',    age: 32, years:  7, return: '28%', color: 'text-emerald-400', border: 'border-emerald-400/30' },
  ]
  const patrimonio = 71090, meta = 1_200_000
  const pct = Math.min((patrimonio / meta) * 100, 100)

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <div className="section-label text-gold mb-1">{'// INDEPENDENCIA FINANCIERA'}</div>
        <h2 className="display-heading text-5xl text-text">FIRE SIMULATOR</h2>
      </div>

      {/* Main result */}
      <div className="bg-surface border border-gold/20 p-8 flex flex-col items-center text-center gap-3">
        <div className="section-label text-text-dim text-xs">PROYECCIÓN BASE · FIRE AGE</div>
        <div className="display-heading num leading-none" style={{ fontSize: 'clamp(80px,14vw,140px)', background: 'linear-gradient(135deg,#d4af37,#f0cc5a,#a88c25)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          <AnimCounter target={38} />
        </div>
        <div className="display-heading text-2xl text-text tracking-widest">AÑOS</div>
        <p className="terminal-text text-sm text-text-dim max-w-xs">
          Con retorno anual 18% y tasa de ahorro 35%, alcanzas FIRE en 13 años.
        </p>
      </div>

      {/* 3 scenarios */}
      <div className="grid grid-cols-3 gap-px bg-border">
        {scenarios.map(s => (
          <div key={s.label} className={`bg-surface p-5 border-2 ${s.border} flex flex-col gap-2 ${s.label === 'BASE' ? 'bg-gold/5' : ''}`}>
            <div className="section-label text-text-dim text-xs">{s.label}</div>
            <div className={`display-heading text-5xl num ${s.color}`}>{s.age}</div>
            <div className="terminal-text text-xs text-muted">{s.years} años restantes</div>
            <div className="terminal-text text-xs text-text-dim">Retorno: {s.return}</div>
          </div>
        ))}
      </div>

      {/* Progress hacia meta */}
      <div className="bg-surface border border-border p-5">
        <div className="flex justify-between mb-2">
          <div className="section-label text-text-dim text-xs">PROGRESO HACIA META $1.2M</div>
          <div className="terminal-text text-xs text-gold num">{pct.toFixed(1)}%</div>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-gold-gradient transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <div className="terminal-text text-xs text-text-dim">Actual: <span className="text-gold num">${patrimonio.toLocaleString('en-US')}</span></div>
          <div className="terminal-text text-xs text-text-dim">Meta: <span className="text-text num">$1,200,000</span></div>
        </div>
      </div>

      <Link href="/fire"
        className="flex items-center justify-center gap-2 bg-gold text-bg display-heading text-xl tracking-widest py-4 hover:bg-gold-glow transition-colors shadow-gold-lg">
        VER SIMULACIÓN COMPLETA →
      </Link>

      <p className="terminal-text text-xs text-muted text-center">
        Retorno base 18% anual · Tasa ahorro 35% · Gastos anuales $24,000 · Edad actual 25
      </p>
    </div>
  )
}

// ── SECTION: Reports ──────────────────────────────────────────────────────────
function SectionReports() {
  const included = [
    'Track record completo', 'Equity curve interactiva', 'Distribución de P&L',
    'Análisis de régimen de mercado', 'Heatmap de rendimiento', 'Rolling Sharpe 30D',
    'Drawdown analysis', 'Trade duration stats', 'Hourly performance heatmap',
    'Correlación con BTC/ETH', 'Win/Loss ratio por sesión', 'Kelly criterion analysis',
    'Monte Carlo simulation', 'Risk-adjusted returns',
  ]
  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <div className="section-label text-gold mb-1">{'// ANÁLISIS MENSUAL'}</div>
        <h2 className="display-heading text-5xl text-text">REPORTES</h2>
      </div>

      <div className="grid sm:grid-cols-2 gap-px bg-border">
        {/* Reporte 001 */}
        <div className="bg-surface border border-transparent hover:border-gold/20 transition-colors p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="section-label text-gold text-xs mb-1">REPORTE #001</div>
              <div className="display-heading text-3xl text-text">MARZO 2026</div>
            </div>
            <span className="section-label text-xs text-emerald-400 border border-emerald-400/30 px-2 py-0.5 shrink-0">DISPONIBLE</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border">
            {[
              { l: 'TRADES',   v: '86'    },
              { l: 'WIN RATE', v: '84.9%' },
              { l: 'PF',       v: '4.02x' },
              { l: 'SHARPE',   v: '9.87'  },
            ].map(m => (
              <div key={m.l} className="bg-bg p-3">
                <div className="section-label text-text-dim text-xs mb-0.5">{m.l}</div>
                <div className="display-heading text-xl text-gold num">{m.v}</div>
              </div>
            ))}
          </div>
          <a href="#"
            className="flex items-center justify-center gap-2 bg-gold text-bg section-label text-xs py-3 hover:bg-gold-glow transition-colors">
            ↓ DESCARGAR PDF
          </a>
        </div>

        {/* Reporte 002 */}
        <div className="bg-surface p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="section-label text-text-dim text-xs mb-1">REPORTE #002</div>
              <div className="display-heading text-3xl text-text">ABRIL 2026</div>
            </div>
            <span className="section-label text-xs text-yellow-400 border border-yellow-400/30 px-2 py-0.5 shrink-0">EN PROGRESO</span>
          </div>
          <div className="terminal-text text-xs text-text-dim">36 trades registrados · disponible 30 Abr 2026</div>
          {/* Progress bar 60% */}
          <div>
            <div className="flex justify-between mb-1">
              <div className="section-label text-text-dim text-xs">COMPLETADO</div>
              <div className="terminal-text text-xs text-gold num">60%</div>
            </div>
            <div className="h-1.5 bg-border">
              <div className="h-full bg-gold-gradient transition-all duration-700" style={{ width: '60%' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border opacity-50">
            {[
              { l: 'TRADES',   v: '36' },
              { l: 'WIN RATE', v: '—'  },
              { l: 'PF',       v: '—'  },
              { l: 'SHARPE',   v: '—'  },
            ].map(m => (
              <div key={m.l} className="bg-bg p-3">
                <div className="section-label text-text-dim text-xs mb-0.5">{m.l}</div>
                <div className="display-heading text-xl text-gold num">{m.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-center gap-2 bg-border text-muted section-label text-xs py-3 cursor-not-allowed">
            ↓ DESCARGAR PDF
          </div>
        </div>
      </div>

      {/* What's included */}
      <div className="bg-surface border border-border p-5">
        <div className="section-label text-gold text-xs mb-4">QUÉ INCLUYE CADA REPORTE · 14 SECCIONES</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
          {included.map((item, i) => (
            <div key={item} className="flex items-center gap-2">
              <span className="terminal-text text-xs text-gold/50">{String(i + 1).padStart(2, '0')}.</span>
              <span className="terminal-text text-xs text-text-dim">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── SECTION: Journal ──────────────────────────────────────────────────────────
function SectionJournal() {
  const [filter, setFilter] = useState<JFilter>('all')

  const filtered = JOURNAL_DATA.filter(t => {
    if (filter === 'long')  return t.dir === 'LONG'
    if (filter === 'short') return t.dir === 'SHORT'
    if (filter === 'win')   return t.win
    if (filter === 'loss')  return !t.win
    return true
  })

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <div className="section-label text-gold mb-1">{'// TRACK RECORD · PRO.MACD v116'}</div>
        <h2 className="display-heading text-5xl text-text">JOURNAL</h2>
      </div>

      {/* Stats — full 122-trade dataset */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
        {[
          { label: 'P&L TOTAL',  value: '+$234.65', color: 'text-emerald-400' },
          { label: 'WIN RATE',   value: '85.2%',    color: 'text-gold'        },
          { label: 'AVG WIN',    value: '+$3.62',   color: 'text-emerald-400' },
          { label: 'AVG LOSS',   value: '-$5.03',   color: 'text-red-400'     },
        ].map(s => (
          <div key={s.label} className="bg-surface p-4">
            <div className="section-label text-text-dim text-xs mb-1">{s.label}</div>
            <div className={`display-heading text-3xl num tabular-nums ${s.color}`}>{s.value}</div>
            <div className="terminal-text text-xs text-muted mt-0.5">122 trades totales</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'long', 'short', 'win', 'loss'] as JFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`section-label text-xs px-4 py-2 border transition-colors ${
              filter === f
                ? 'text-gold border-gold/50 bg-gold/5'
                : 'text-text-dim border-border hover:text-gold hover:border-gold/20'
            }`}>
            {f === 'all' ? 'TODOS' : f.toUpperCase()}
          </button>
        ))}
        <span className="terminal-text text-xs text-muted self-center ml-2">
          {filtered.length} trade{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-surface border-b border-border">
              {['Fecha', 'Par', 'Dir.', 'Entrada', 'Salida', 'P&L', 'RR'].map(h => (
                <th key={h} className="section-label text-text-dim text-xs text-left px-4 py-3 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={i} className={`border-b border-border transition-colors ${
                t.win ? 'hover:bg-emerald-400/5' : 'hover:bg-red-400/5'
              } ${t.win ? 'bg-emerald-400/[0.02]' : 'bg-red-400/[0.025]'}`}>
                <td className="terminal-text text-xs text-muted num px-4 py-3">{t.fecha}</td>
                <td className="terminal-text text-sm text-text px-4 py-3">{t.par}</td>
                <td className="px-4 py-3">
                  <span className={`section-label text-xs ${t.dir === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>{t.dir}</span>
                </td>
                <td className="terminal-text text-xs text-text-dim num tabular-nums px-4 py-3">{t.entrada}</td>
                <td className="terminal-text text-xs text-text-dim num tabular-nums px-4 py-3">{t.salida}</td>
                <td className={`terminal-text text-sm font-medium num tabular-nums px-4 py-3 ${t.win ? 'text-emerald-400' : 'text-red-400'}`}>{t.pnl}</td>
                <td className={`terminal-text text-sm num tabular-nums px-4 py-3 ${t.win ? 'text-emerald-400' : 'text-red-400'}`}>{t.rr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="terminal-text text-xs text-muted">
        Mostrando {filtered.length} de 122 trades · Track record completo disponible en Reporte #001
      </p>
    </div>
  )
}

// ── SECTION: Config ───────────────────────────────────────────────────────────
function SectionConfig() {
  const [tab, setTab] = useState<ConfigTab>('perfil')
  const [alerts, setAlerts] = useState({ telegram: true, email: false, sonido: true })
  const [alertTypes, setAlertTypes] = useState({ nuevaSenal: true, senalCerrada: true, maxDD: true, nuevoReporte: false })

  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const activeDays = ['Mar', 'Mié', 'Jue']
  const lockedDays = ['Sáb']

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <div className="section-label text-gold mb-1">{'// CUENTA & ESTRATEGIA'}</div>
        <h2 className="display-heading text-5xl text-text">CONFIGURACIÓN</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['perfil', 'estrategia', 'alertas'] as ConfigTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`section-label text-xs px-5 py-3 border-b-2 transition-colors ${
              tab === t ? 'text-gold border-gold' : 'text-text-dim border-transparent hover:text-gold'
            }`}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── Tab: Perfil ── */}
      {tab === 'perfil' && (
        <div className="flex flex-col gap-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 border border-gold/40 bg-gold/10 flex items-center justify-center">
              <span className="display-heading text-3xl text-gold">A</span>
            </div>
            <div>
              <div className="display-heading text-2xl text-text">ALONSO MOYANO</div>
              <span className="section-label text-xs text-gold border border-gold/30 px-2 py-0.5">PRO ACTIVO</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'NOMBRE',        value: 'Alonso Moyano' },
              { label: 'EMAIL',         value: 'alonso@sigmaresearch.com' },
              { label: 'PAÍS',          value: 'Chile' },
              { label: 'ZONA HORARIA',  value: 'America/Santiago' },
            ].map(f => (
              <div key={f.label} className="flex flex-col gap-1.5">
                <label className="section-label text-text-dim text-xs">{f.label}</label>
                <input
                  defaultValue={f.value} readOnly
                  className="bg-surface border border-border focus:border-gold/50 outline-none px-4 py-2.5 terminal-text text-sm text-text transition-colors"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button className="section-label text-xs bg-gold text-bg px-6 py-3 hover:bg-gold-glow transition-colors">
              GUARDAR CAMBIOS
            </button>
            <button className="section-label text-xs border border-gold/30 text-gold px-6 py-3 hover:bg-gold/5 transition-colors">
              GESTIONAR PLAN
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Estrategia ── */}
      {tab === 'estrategia' && (
        <div className="flex flex-col gap-6">
          <div>
            <div className="section-label text-gold text-xs mb-3">PARÁMETROS PRO.MACD v116</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'ATR MULT',     value: '1.7'   },
                { label: 'TRAIL SHORT',  value: '1.9'   },
                { label: 'TRAIL LONG',   value: '2.2'   },
                { label: 'TP LONG',      value: '2.5x'  },
                { label: 'MAX DD',       value: '12%'   },
                { label: 'KELLY FRAC',   value: '0.25'  },
                { label: 'RISK MIN',     value: '0.5%'  },
                { label: 'RISK MAX',     value: '2%'    },
                { label: 'PYRAMID',      value: '0.25x' },
                { label: 'TRAIL FACTOR', value: '4.0'   },
              ].map(p => (
                <div key={p.label} className="flex flex-col gap-1.5">
                  <label className="section-label text-text-dim text-xs">{p.label}</label>
                  <input
                    defaultValue={p.value} readOnly
                    className="bg-bg border border-border px-3 py-2 terminal-text text-sm text-gold num tabular-nums text-center outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="section-label text-gold text-xs mb-3">DÍAS ACTIVOS</div>
            <div className="flex gap-2 flex-wrap">
              {days.map(d => {
                const isActive = activeDays.includes(d)
                const isLocked = lockedDays.includes(d)
                return (
                  <div key={d} className={`section-label text-xs border px-4 py-2 ${
                    isLocked ? 'text-red-400 border-red-400/30 bg-red-400/5 cursor-not-allowed' :
                    isActive ? 'text-gold border-gold/50 bg-gold/10' :
                    'text-text-dim border-border'
                  }`}>
                    {d}
                    {isLocked && <span className="ml-1 text-red-400">✗</span>}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div className="section-label text-gold text-xs mb-3">SESIONES DE TRADING</div>
            <div className="flex flex-col gap-2">
              {[
                { label: 'LONDON',   hours: '08–13h UTC', active: true },
                { label: 'NEW YORK', hours: '13–20h UTC', active: true },
                { label: 'ASIA',     hours: '00–08h UTC', active: false },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between bg-surface border border-border px-4 py-3">
                  <div>
                    <span className="section-label text-xs text-text">{s.label}</span>
                    <span className="terminal-text text-xs text-text-dim ml-3">{s.hours}</span>
                  </div>
                  <span className={`section-label text-xs ${s.active ? 'text-emerald-400' : 'text-muted'}`}>
                    {s.active ? '✓ ACTIVA' : '— INACTIVA'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Alertas ── */}
      {tab === 'alertas' && (
        <div className="flex flex-col gap-5">
          {/* Toggle rows */}
          {[
            { key: 'telegram' as const, label: 'ALERTAS TELEGRAM', desc: '@DonPadreCL' },
            { key: 'email'    as const, label: 'ALERTAS EMAIL',     desc: 'alonso@sigmaresearch.com' },
            { key: 'sonido'   as const, label: 'ALERTA SONORA',     desc: 'Al detectar nueva señal' },
          ].map(a => (
            <div key={a.key} className="flex items-center justify-between bg-surface border border-border px-4 py-4">
              <div>
                <div className="section-label text-xs text-text">{a.label}</div>
                <div className="terminal-text text-xs text-text-dim mt-0.5">{a.desc}</div>
              </div>
              <button onClick={() => setAlerts(v => ({ ...v, [a.key]: !v[a.key] }))}
                className="flex items-center gap-2">
                <div className={`w-10 h-5 rounded-full transition-colors relative ${alerts[a.key] ? 'bg-gold/40' : 'bg-border'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${alerts[a.key] ? 'left-5 bg-gold' : 'left-0.5 bg-muted'}`} />
                </div>
                <span className={`section-label text-xs ${alerts[a.key] ? 'text-gold' : 'text-muted'}`}>
                  {alerts[a.key] ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          ))}

          {/* Alert types */}
          <div className="bg-surface border border-border p-5">
            <div className="section-label text-gold text-xs mb-4">TIPOS DE ALERTA</div>
            <div className="flex flex-col gap-3">
              {[
                { key: 'nuevaSenal'   as const, label: 'Nueva señal PRO.MACD' },
                { key: 'senalCerrada' as const, label: 'Señal cerrada / TP/SL' },
                { key: 'maxDD'        as const, label: 'Max Drawdown alcanzado' },
                { key: 'nuevoReporte' as const, label: 'Nuevo reporte disponible' },
              ].map(t => (
                <label key={t.key} className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={alertTypes[t.key]}
                    onChange={() => setAlertTypes(v => ({ ...v, [t.key]: !v[t.key] }))}
                    className="w-4 h-4 cursor-pointer accent-gold"
                  />
                  <span className="terminal-text text-sm text-text-dim group-hover:text-text transition-colors">
                    {t.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button className="section-label text-xs bg-gold text-bg px-6 py-3 hover:bg-gold-glow transition-colors self-start">
            GUARDAR CONFIGURACIÓN
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main dashboard layout ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const [section, setSection] = useState<Section>('overview')
  const [mobileMenu, setMobileMenu] = useState(false)
  const prices = useLivePrices()

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">

      {/* ── Sticky header ── */}
      <header className="bg-surface border-b border-border px-4 sm:px-5 py-3 flex items-center justify-between sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 border border-gold flex items-center justify-center">
              <span className="display-heading text-gold text-xs leading-none">Σ</span>
            </div>
            <span className="display-heading text-base tracking-widest text-text hidden sm:block">SIGMA</span>
          </Link>
          <span className="section-label text-gold border border-gold/30 px-2 py-0.5 text-xs shrink-0">PRO ACTIVO</span>
          <div className="hidden md:flex flex-col leading-none ml-1">
            <span className="section-label text-text-dim text-xs">BIENVENIDO</span>
            <span className="display-heading text-xl text-text">ALONSO</span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <span className="terminal-text text-xs text-text-dim num tabular-nums hidden sm:block"><Clock /></span>
          <button className="section-label text-xs text-red-400 hover:text-red-300 transition-colors">
            CERRAR SESIÓN
          </button>
          <button className="xl:hidden section-label text-xs text-text-dim hover:text-gold"
            onClick={() => setMobileMenu(v => !v)}>
            {mobileMenu ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileMenu && (
        <nav className="xl:hidden bg-surface border-b border-border px-3 py-2 flex flex-wrap gap-1 shrink-0">
          {NAV.map(item => (
            <button key={item.id} onClick={() => { setSection(item.id); setMobileMenu(false) }}
              className={`section-label text-xs px-3 py-2 border transition-colors ${
                section === item.id ? 'text-gold border-gold/40 bg-gold/5' : 'text-text-dim border-transparent hover:text-gold'
              }`}>
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ── */}
        <aside className="hidden xl:flex flex-col w-52 bg-surface border-r border-border py-5 px-2 shrink-0 overflow-y-auto">
          <div className="section-label text-gold/50 text-xs px-3 mb-3">NAVEGACIÓN</div>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setSection(item.id)}
              className={`flex items-center gap-3 section-label text-xs text-left px-3 py-2.5 border-l-2 transition-colors ${
                section === item.id
                  ? 'text-gold bg-gold/5 border-gold'
                  : 'text-text-dim hover:text-gold hover:bg-gold/5 border-transparent'
              }`}>
              <span className="text-sm leading-none">{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div className="mt-auto pt-6 px-3 border-t border-border">
            <div className="section-label text-muted text-xs leading-relaxed">
              PRO.MACD v116<br />
              Feb–Abr 2026<br />
              122 trades<br />
              <span className="text-gold">Sharpe 10.25</span>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {section === 'overview'  && <SectionOverview onNav={setSection} />}
          {section === 'portfolio' && <SectionPortfolio />}
          {section === 'signals'   && <SectionSignals />}
          {section === 'fire'      && <SectionFire />}
          {section === 'reports'   && <SectionReports />}
          {section === 'journal'   && <SectionJournal />}
          {section === 'config'    && <SectionConfig />}
        </main>

        {/* ── Right HUD ── */}
        <HudPanel prices={prices} />
      </div>
    </div>
  )
}
