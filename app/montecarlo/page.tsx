'use client'
import { useState, useCallback, useEffect } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Filler, Tooltip, Legend,
} from 'chart.js'
import { fmt } from '../lib/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

// ── Simulation types ──────────────────────────────────────────────────────────
interface YearlyPercentiles {
  p10: number; p25: number; p50: number; p75: number; p90: number
}

interface SimOutput {
  yearly:    YearlyPercentiles[]   // index = year (0..años)
  finalVals: number[]
  tasa:      number                // % capital > 0 at end
  max:       number
  min:       number
}

// ── Box-Muller N(0,1) ─────────────────────────────────────────────────────────
function gauss(): number {
  let u = 0, v = 0
  while (!u) u = Math.random()
  while (!v) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// ── GBM Monte Carlo engine ────────────────────────────────────────────────────
// Annual GBM: S(t+1) = S(t) · exp((μ − σ²/2) + σ·Z) + aporte_anual_real
function simulate(
  capital:     number,   // $
  aporteAnual: number,   // $ / año (aporte mensual × 12)
  retorno:     number,   // decimal (e.g. 0.18)
  volatilidad: number,   // decimal (e.g. 0.25)
  inflacion:   number,   // decimal (e.g. 0.03)
  años:        number,
  n:           number,
): SimOutput {
  const drift = retorno - 0.5 * volatilidad * volatilidad

  // Store column per year for percentile computation
  const cols: Float64Array[] = Array.from({ length: años + 1 }, () => new Float64Array(n))
  const finals = new Float64Array(n)

  for (let i = 0; i < n; i++) {
    let c = capital
    cols[0][i] = c
    for (let y = 1; y <= años; y++) {
      c = c * Math.exp(drift + volatilidad * gauss())
      // Inflation-adjusted contribution: aporte grows with inflation
      c += aporteAnual * Math.pow(1 + inflacion, y - 1)
      if (c < 0) c = 0
      cols[y][i] = c
    }
    finals[i] = c
  }

  // Percentiles at each year
  const yearly: YearlyPercentiles[] = cols.map(col => {
    const s = col.slice().sort()
    return {
      p10: s[Math.floor(n * 0.10)],
      p25: s[Math.floor(n * 0.25)],
      p50: s[Math.floor(n * 0.50)],
      p75: s[Math.floor(n * 0.75)],
      p90: s[Math.floor(n * 0.90)],
    }
  })

  const sortedFinals = finals.slice().sort()
  const positivos    = Array.from(finals).filter(v => v > 0).length

  return {
    yearly,
    finalVals: Array.from(finals),
    tasa: (positivos / n) * 100,
    max:  sortedFinals[n - 1],
    min:  sortedFinals[0],
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtShort = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M`
  : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K`
  : `$${v.toFixed(0)}`

// ── Slider component ──────────────────────────────────────────────────────────
function Slider({
  label, value, min, max, step, display, onChange,
}: {
  label: string; value: number; min: number; max: number
  step: number; display: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="section-label text-text-dim">{label}</label>
        <span className="terminal-text text-gold text-sm num tabular-nums">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-gold"
        aria-label={label}
      />
      <div className="flex justify-between terminal-text text-xs text-muted mt-1">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color,
}: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-surface p-4 sm:p-5">
      <div className="section-label text-text-dim text-xs mb-1">{label}</div>
      <div className={`display-heading text-3xl num tabular-nums ${color}`}>{value}</div>
      <div className="terminal-text text-xs text-muted mt-1">{sub}</div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MonteCarloPage() {
  // Parameters
  const [capital,     setCapital]     = useState(71_090)
  const [aporteMes,   setAporteMes]   = useState(1_500)
  const [retorno,     setRetorno]     = useState(18)
  const [volatilidad, setVolatilidad] = useState(25)
  const [inflacion,   setInflacion]   = useState(3)
  const [años,        setAños]        = useState(30)
  const [nSims,       setNSims]       = useState(5_000)

  // Simulation state
  const [result,  setResult]  = useState<SimOutput | null>(null)
  const [running, setRunning] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const runSim = useCallback(() => {
    setRunning(true)
    setTimeout(() => {
      try {
        const out = simulate(
          capital,
          aporteMes * 12,
          retorno     / 100,
          volatilidad / 100,
          inflacion   / 100,
          años,
          nSims,
        )
        setResult(out)
      } finally {
        setRunning(false)
      }
    }, 0)
  }, [capital, aporteMes, retorno, volatilidad, inflacion, años, nSims])

  // Auto-run on mount
  useEffect(() => { if (mounted) runSim() }, [mounted]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = result ? {
    p10: result.yearly[años].p10,
    p25: result.yearly[años].p25,
    p50: result.yearly[años].p50,
    p75: result.yearly[años].p75,
    p90: result.yearly[años].p90,
  } : null

  // ── Chart data ──────────────────────────────────────────────────────────────
  const xLabels = Array.from({ length: años + 1 }, (_, i) => `Año ${i}`)

  const chartData = result ? {
    labels: xLabels,
    datasets: [
      {
        label: 'P90',
        data: result.yearly.map(y => y.p90),
        borderColor: '#34d399',
        backgroundColor: 'rgba(52,211,153,0.06)',
        borderWidth: 1.5,
        fill: '+3',
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: 'P75',
        data: result.yearly.map(y => y.p75),
        borderColor: '#86efac',
        backgroundColor: 'rgba(134,239,172,0.06)',
        borderWidth: 1,
        fill: '+1',
        tension: 0.4,
        pointRadius: 0,
        borderDash: [4, 3],
      },
      {
        label: 'P50 (Mediana)',
        data: result.yearly.map(y => y.p50),
        borderColor: '#d4af37',
        backgroundColor: 'rgba(212,175,55,0.08)',
        borderWidth: 2.5,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: 'P25',
        data: result.yearly.map(y => y.p25),
        borderColor: '#fb923c',
        backgroundColor: 'rgba(251,146,60,0.04)',
        borderWidth: 1,
        fill: '-1',
        tension: 0.4,
        pointRadius: 0,
        borderDash: [4, 3],
      },
      {
        label: 'P10',
        data: result.yearly.map(y => y.p10),
        borderColor: '#f87171',
        backgroundColor: 'rgba(248,113,113,0.04)',
        borderWidth: 1.5,
        fill: '-1',
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  } : null

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        align: 'start' as const,
        labels: {
          color: '#9298b8',
          font: { family: 'monospace', size: 10 },
          boxWidth: 14,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: '#0b0d14',
        borderColor: '#1a1d2e',
        borderWidth: 1,
        titleColor: '#9298b8',
        bodyColor: '#e8e9f0',
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            ` ${ctx.dataset.label}: ${fmtShort(ctx.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(26,29,46,0.5)', display: true },
        ticks: {
          color: '#9298b8',
          font: { family: 'monospace', size: 10 },
          maxTicksLimit: 10,
          callback: (_: unknown, i: number) => (i % 5 === 0 ? `Año ${i}` : ''),
        },
        border: { color: '#1a1d2e' },
      },
      y: {
        grid: { color: 'rgba(26,29,46,0.6)' },
        ticks: {
          color: '#9298b8',
          font: { family: 'monospace', size: 10 },
          callback: (v: number | string) => fmtShort(Number(v)),
        },
        border: { color: '#1a1d2e' },
      },
    },
  } as const

  // ── Percentile table (every 5 years) ──────────────────────────────────────
  const tableRows = result
    ? Array.from({ length: Math.floor(años / 5) + 1 }, (_, i) => {
        const y = Math.min(i * 5, años)
        return { y, ...result.yearly[y] }
      })
    : []

  // ── Success rate color ─────────────────────────────────────────────────────
  function taColor(t: number) {
    return t >= 80 ? 'text-emerald-400' : t >= 60 ? 'text-yellow-400' : 'text-red-400'
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pt-24 pb-16">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="section-label text-gold mb-3">{'// SIMULACIÓN MONTE CARLO'}</div>
          <h1 className="display-heading leading-none text-text" style={{ fontSize: 'clamp(52px,7vw,96px)' }}>
            MOTOR{' '}
            <span className="gold-text">PROBABILÍSTICO</span>
          </h1>
          <p className="terminal-text text-text-dim mt-4 max-w-2xl">
            Cada trayectoria sigue el GBM lognormal:{' '}
            <code className="text-gold bg-gold/5 px-1.5 py-0.5 font-mono text-xs">
              S(t+1) = S(t) · exp((μ − σ²/2) + σ·Z) + aporte
            </code>{' '}
            con Z~N(0,1) via Box-Muller, Δt = 1 año.
          </p>
        </div>

        {/* ── Two-column layout ────────────────────────────────────────── */}
        <div className="grid xl:grid-cols-[320px_1fr] gap-px bg-border mb-px">

          {/* ── Controls panel ─────────────────────────────────────────── */}
          <div className="bg-surface p-6 flex flex-col gap-5">
            <div className="section-label text-gold text-xs">PARÁMETROS</div>

            <Slider label="Capital inicial"       value={capital}     min={0}  max={2_000_000} step={5_000}  display={fmt(capital)}              onChange={setCapital} />
            <Slider label="Aporte mensual"        value={aporteMes}   min={0}  max={20_000}    step={100}    display={fmt(aporteMes)}             onChange={setAporteMes} />
            <Slider label="Retorno anual esp."    value={retorno}     min={1}  max={30}        step={0.5}    display={`${retorno}%`}              onChange={setRetorno} />
            <Slider label="Volatilidad anual"     value={volatilidad} min={1}  max={60}        step={0.5}    display={`${volatilidad}%`}          onChange={setVolatilidad} />
            <Slider label="Inflación anual"       value={inflacion}   min={0}  max={10}        step={0.5}    display={`${inflacion}%`}            onChange={setInflacion} />
            <Slider label="Años de simulación"    value={años}        min={5}  max={50}        step={1}      display={`${años} años`}             onChange={setAños} />

            {/* N° simulaciones selector */}
            <div>
              <div className="section-label text-text-dim mb-2">N° SIMULACIONES</div>
              <div className="flex gap-1">
                {[1_000, 5_000, 10_000].map(n => (
                  <button key={n} onClick={() => setNSims(n)}
                    className={`flex-1 py-2 section-label text-xs transition-colors ${
                      nSims === n
                        ? 'bg-gold text-bg'
                        : 'bg-bg border border-border text-text-dim hover:border-gold/30 hover:text-gold'
                    }`}>
                    {n.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Derived stats */}
            <div className="border-t border-border pt-4 flex flex-col gap-2">
              <div className="section-label text-text-dim text-xs mb-1">PARÁMETROS IMPLÍCITOS</div>
              {[
                ['Aporte anual',       fmt(aporteMes * 12)],
                ['Retorno real',       `${(retorno - inflacion).toFixed(1)}%`],
                ['Retorno ajust. σ',   `${(retorno - 0.5 * (volatilidad ** 2) / 100).toFixed(2)}%`],
                ['Sharpe implícito',   volatilidad > 0 ? ((retorno - 4.5) / volatilidad).toFixed(2) : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="terminal-text text-xs text-text-dim">{k}</span>
                  <span className="terminal-text text-xs text-gold num tabular-nums">{v}</span>
                </div>
              ))}
            </div>

            {/* Simulate button */}
            <button
              onClick={runSim}
              disabled={running}
              className={`mt-1 py-3 display-heading text-xl tracking-widest transition-colors ${
                running
                  ? 'bg-border text-muted cursor-wait'
                  : 'bg-gold text-bg hover:bg-gold-glow shadow-gold'
              }`}
            >
              {running ? 'SIMULANDO…' : `SIMULAR ${nSims.toLocaleString()}`}
            </button>
          </div>

          {/* ── Chart + stats panel ────────────────────────────────────── */}
          <div className="bg-bg flex flex-col">

            {/* Chart header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <span className="section-label text-text-dim text-xs">FAN CHART · PERCENTILES P10 / P25 / P50 / P75 / P90</span>
              {running && (
                <span className="terminal-text text-xs text-gold animate-pulse">
                  ⟳ {nSims.toLocaleString()} TRAYECTORIAS…
                </span>
              )}
            </div>

            {/* Chart */}
            <div className="p-4 h-80 sm:h-96 relative">
              {running && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg z-10">
                  <div className="w-10 h-10 border-2 border-border border-t-gold rounded-full animate-spin" />
                  <span className="terminal-text text-xs text-text-dim">
                    {nSims.toLocaleString()} × {años} trayectorias GBM…
                  </span>
                </div>
              )}
              {mounted && chartData && !running
                ? <Line data={chartData} options={chartOpts} />
                : !running && <div className="h-full flex items-center justify-center terminal-text text-xs text-muted">Ajusta parámetros y presiona SIMULAR</div>
              }
            </div>

          </div>
        </div>

        {/* ── Results grid ────────────────────────────────────────────── */}
        {stats && !running && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border mb-px">
            <StatCard label="TASA DE ÉXITO"      value={`${result!.tasa.toFixed(1)}%`}   sub="capital > 0 al final"   color={taColor(result!.tasa)} />
            <StatCard label="MEDIANA FINAL"       value={fmtShort(stats.p50)}             sub={`año ${años} · P50`}    color="text-gold" />
            <StatCard label="PEOR ESCENARIO P10"  value={fmtShort(stats.p10)}             sub={`año ${años} · P10`}    color="text-red-400" />
            <StatCard label="MEJOR ESCENARIO P90" value={fmtShort(stats.p90)}             sub={`año ${años} · P90`}    color="text-emerald-400" />
            <StatCard label="PERCENTIL 25"        value={fmtShort(stats.p25)}             sub={`año ${años} · P25`}    color="text-orange-400" />
            <StatCard label="PERCENTIL 75"        value={fmtShort(stats.p75)}             sub={`año ${años} · P75`}    color="text-green-400" />
            <StatCard label="MÁXIMO SIMULADO"     value={fmtShort(result!.max)}           sub={`de ${nSims.toLocaleString()} sims`} color="text-gold" />
            <StatCard label="MÍNIMO SIMULADO"     value={fmtShort(result!.min)}           sub={`de ${nSims.toLocaleString()} sims`} color="text-red-400" />
          </div>
        )}

        {/* ── Percentile table ────────────────────────────────────────── */}
        {result && !running && (
          <div className="bg-surface border border-border mb-6">
            <div className="px-5 py-3 border-b border-border">
              <div className="section-label text-gold text-xs">TABLA DE PERCENTILES · CADA 5 AÑOS</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-border">
                    {['AÑO', 'P10', 'P25', 'P50 MEDIANA', 'P75', 'P90'].map(h => (
                      <th key={h} className="section-label text-text-dim text-xs font-normal text-right px-4 py-3 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr key={row.y} className={`border-b border-border hover:bg-gold/5 transition-colors ${i % 2 ? 'bg-gold/[0.015]' : ''}`}>
                      <td className="terminal-text text-xs text-text-dim num px-4 py-3">Año {row.y}</td>
                      <td className="terminal-text text-sm text-red-400    num tabular-nums text-right px-4 py-3">{fmtShort(row.p10)}</td>
                      <td className="terminal-text text-sm text-orange-400 num tabular-nums text-right px-4 py-3">{fmtShort(row.p25)}</td>
                      <td className="terminal-text text-sm text-gold       num tabular-nums text-right px-4 py-3 font-medium">{fmtShort(row.p50)}</td>
                      <td className="terminal-text text-sm text-green-400  num tabular-nums text-right px-4 py-3">{fmtShort(row.p75)}</td>
                      <td className="terminal-text text-sm text-emerald-400 num tabular-nums text-right px-4 py-3">{fmtShort(row.p90)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Methodology note ──────────────────────────────────────── */}
        <div className="bg-surface border border-border/60 p-4">
          <div className="section-label text-text-dim text-xs mb-2">METODOLOGÍA</div>
          <p className="terminal-text text-xs text-muted leading-relaxed">
            Simulación Monte Carlo lognormal · Box-Muller transform ·{' '}
            <span className="text-gold">{nSims.toLocaleString()} trayectorias</span> ·
            Retorno ajustado por volatilidad σ²/2 · Aportes indexados a inflación ·
            GBM anual: <code className="text-gold/80">exp((μ − σ²/2) + σ·Z)</code> ·
            Float64Array · percentiles calculados sobre población completa
          </p>
        </div>

      </div>
    </div>
  )
}
