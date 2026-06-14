'use client'
import { useEffect, useState } from 'react'
import TickerBar from './TickerBar'
import StatBar from './StatBar'

interface LiveMetrics {
  winRate:     number
  sharpe:      number
  maxDD:       number
  totalPnL:    number
  profitFactor:number
  totalTrades: number
  hasData:     boolean
}

function computeMetrics(): LiveMetrics {
  const empty: LiveMetrics = { winRate:0, sharpe:0, maxDD:0, totalPnL:0, profitFactor:0, totalTrades:0, hasData:false }
  try {
    const raw = localStorage.getItem('sigma_trades')
    if (!raw) return empty
    const trades: { pnl_usd: number; resultado: string; fecha: string }[] = JSON.parse(raw)
    if (!trades.length) return empty

    const wins   = trades.filter(t => t.resultado === 'WIN').length
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0

    const sorted = [...trades].sort((a,b) => (a.fecha??'').localeCompare(b.fecha??''))
    let peak = 0, cum = 0, maxDD = 0
    for (const t of sorted) {
      cum += t.pnl_usd
      if (cum > peak) peak = cum
      const dd = peak > 0 ? ((peak - cum) / peak) * 100 : 0
      if (dd > maxDD) maxDD = dd
    }

    // Sharpe approximation from daily PnL buckets
    const byDay: Record<string, number> = {}
    for (const t of sorted) {
      byDay[t.fecha] = (byDay[t.fecha] ?? 0) + t.pnl_usd
    }
    const days = Object.values(byDay)
    const mean = days.reduce((s,v) => s+v, 0) / (days.length || 1)
    const variance = days.reduce((s,v) => s + (v-mean)**2, 0) / (days.length || 1)
    const stdDev = Math.sqrt(variance)
    const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0

    const sumWins   = trades.filter(t=>t.resultado==='WIN').reduce((s,t)=>s+Math.abs(t.pnl_usd),0)
    const sumLosses = trades.filter(t=>t.resultado==='LOSS').reduce((s,t)=>s+Math.abs(t.pnl_usd),0)
    const profitFactor = sumLosses > 0 ? sumWins / sumLosses : sumWins > 0 ? 99 : 0

    const totalPnL = sorted.reduce((s,t) => s + t.pnl_usd, 0)
    const totalTrades = trades.length

    return { winRate, sharpe, maxDD: -maxDD, totalPnL, profitFactor, totalTrades, hasData: true }
  } catch { return empty }
}

function AnimatedNumber({ target, decimals = 2 }: { target: number; decimals?: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const duration = 2000
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(parseFloat((eased * target).toFixed(decimals)))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, decimals])
  return <>{val.toFixed(decimals)}</>
}

export default function Hero() {
  const [time,    setTime]    = useState('')
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null)

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' }) + ' EST')
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setMetrics(computeMetrics())
  }, [])

  const m = metrics

  const METRIC_ROWS = m?.hasData ? [
    { label: 'Win Rate',      value: m.winRate,      decimals: 1, unit: '%',  prefix: '' },
    { label: 'Sharpe Ratio',  value: Math.abs(m.sharpe), decimals: 2, unit: '',   prefix: '' },
    { label: 'Max Drawdown',  value: Math.abs(m.maxDD),  decimals: 1, unit: '%',  prefix: '-' },
    { label: 'PnL Total',     value: Math.abs(m.totalPnL), decimals: 0, unit: '',  prefix: m.totalPnL >= 0 ? '+$' : '-$' },
    { label: 'Profit Factor', value: m.profitFactor, decimals: 2, unit: '',   prefix: '' },
    { label: 'Trades',        value: m.totalTrades,  decimals: 0, unit: '',   prefix: '' },
  ] : [
    { label: 'Sharpe Ratio',  value: 2.41,  decimals: 2, unit: '',   prefix: '' },
    { label: 'Alpha Anual',   value: 18.7,  decimals: 1, unit: '%',  prefix: '' },
    { label: 'Max Drawdown',  value: 4.2,   decimals: 1, unit: '%',  prefix: '-' },
    { label: 'Win Rate',      value: 67.3,  decimals: 1, unit: '%',  prefix: '' },
    { label: 'Calmar Ratio',  value: 4.45,  decimals: 2, unit: '',   prefix: '' },
    { label: 'Beta SPX',      value: 0.12,  decimals: 2, unit: '',   prefix: '' },
  ]

  return (
    <>
    <section className="relative min-h-screen flex flex-col bg-bg overflow-hidden">
      <div
        className="absolute inset-0 bg-grid-pattern bg-grid opacity-60"
        style={{ backgroundSize: '40px 40px' }}
      />
      <div className="absolute inset-0 bg-radial-gold opacity-40 pointer-events-none" />
      <div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-30 animate-scan-line pointer-events-none"
        style={{ top: '40%' }}
      />

      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 pt-24 pb-12 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
          <span className="section-label text-text-dim">SISTEMA ACTIVO</span>
          <span className="section-label text-border">|</span>
          <span className="section-label text-text-dim font-mono">{time}</span>
        </div>

        <div className="mb-6">
          <div className="section-label text-gold mb-4 animate-fade-up" style={{ animationDelay: '0ms' }}>
            {'// SIGMA RESEARCH v2.4.1'}
          </div>
          <h1 className="display-heading text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-[9rem] 2xl:text-[10rem] leading-none mb-4 overflow-hidden">
            <span className="block text-text animate-fade-up" style={{ animationDelay: '80ms' }}>QUANT</span>
            <span className="block gold-text animate-fade-up" style={{ animationDelay: '180ms' }}>INTELLIGENCE</span>
            <span className="block text-text animate-fade-up" style={{ animationDelay: '280ms' }}>PLATFORM</span>
          </h1>
          <p className="terminal-text text-text-dim max-w-2xl text-base leading-relaxed mt-6 animate-fade-up" style={{ animationDelay: '400ms' }}>
            Modelos estadísticos de grado institucional para análisis de mercados,
            planificación financiera y señales algorítmicas.
            Construido sobre datos reales. Diseñado para resultados reales.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 mb-10 animate-fade-up" style={{ animationDelay: '520ms' }}>
          <a href="#productos" className="px-8 py-3 bg-gold text-bg display-heading text-xl tracking-widest hover:bg-gold-glow transition-colors duration-200 shadow-gold-lg">
            EXPLORAR PLATAFORMA
          </a>
          <a href="#fire" className="px-8 py-3 gold-border display-heading text-xl tracking-widest text-gold hover:bg-gold/10 transition-all duration-200">
            CALCULADORA FIRE
          </a>
        </div>

        {/* Live metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border">
          {METRIC_ROWS.map((row) => (
            <div key={row.label} className="bg-surface p-4 flex flex-col gap-1">
              <span className="section-label text-text-dim text-xs">{row.label}</span>
              <span className="display-heading text-2xl text-gold num tabular-nums">
                {row.prefix}
                <AnimatedNumber target={row.value} decimals={row.decimals} />
                {row.unit}
              </span>
              <span className="terminal-text text-xs" style={{ color: m?.hasData ? '#34d399' : '#7a7f9a' }}>
                {m?.hasData ? 'REAL' : 'DEMO'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10">
        <TickerBar />
      </div>
    </section>
    <StatBar />
    </>
  )
}
