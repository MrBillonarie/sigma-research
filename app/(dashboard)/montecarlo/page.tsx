'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabase } from '@/app/lib/supabase'
import { C } from '@/app/lib/constants'
import { usePortfolio } from '@/app/lib/usePortfolio'
import type { SimResult } from './types'

// Load Chart.js only on the client — prevents SSR crash (window/document undefined)
const McChart = dynamic(() => import('./McChart'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 440, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#04050a' }}>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7f9a' }}>Cargando gráfico…</span>
    </div>
  ),
})

// ─── GBM Monte Carlo engine ───────────────────────────────────────────────────
function normalZ(): number {
  // Box-Muller transform
  let u = 0, v = 0
  while (!u) u = Math.random()
  while (!v) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function simulate(
  capital:  number,
  μMonthly: number,   // decimal e.g. 0.007
  σMonthly: number,   // decimal e.g. 0.045
  years:    number,
  n:        number,
  target:   number,
): SimResult {
  const steps = years * 12
  const drift = μMonthly - 0.5 * σMonthly * σMonthly

  // Allocate all paths
  const all = new Array<Float32Array>(n)
  for (let i = 0; i < n; i++) {
    all[i] = new Float32Array(steps + 1)
    all[i][0] = capital
    let v = capital
    for (let t = 1; t <= steps; t++) {
      v = v * Math.exp(drift + σMonthly * normalZ())
      all[i][t] = v < 0 ? 0 : v        // floor at 0
    }
  }

  // Percentiles at each step
  const p10 = new Array<number>(steps + 1)
  const p50 = new Array<number>(steps + 1)
  const p90 = new Array<number>(steps + 1)
  const col = new Float32Array(n)
  for (let t = 0; t <= steps; t++) {
    for (let i = 0; i < n; i++) col[i] = all[i][t]
    col.sort()                           // Float32Array.sort() is numeric by default
    p10[t] = col[Math.floor(n * 0.10)]
    p50[t] = col[Math.floor(n * 0.50)]
    p90[t] = col[Math.floor(n * 0.90)]
  }

  // Sample ~60 evenly-spaced paths for visual rendering
  const stride = Math.max(1, Math.floor(n / 60))
  const samplePaths: number[][] = []
  for (let i = 0; i < n; i += stride) {
    samplePaths.push(Array.from(all[i]))
  }

  const finalVals = all.map(path => path[steps])
  const probTarget = target > 0
    ? (finalVals.filter(v => v >= target).length / n) * 100
    : 0

  // X-axis labels: show "0Y", "1Y", ... at each 12-step mark; blank otherwise
  const labels: string[] = []
  for (let t = 0; t <= steps; t++) {
    labels.push(t % 12 === 0 ? `${t / 12}Y` : '')
  }

  return { samplePaths, p10, p50, p90, probTarget, finalVals: Array.from(finalVals), labels }
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtShort = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1e3).toFixed(0)}K`

const fmtFull = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`

// ─── Slider ───────────────────────────────────────────────────────────────────
function Slider({
  label, value, min, max, step, display,
  onChange,
}: {
  label: string; value: number; min: number; max: number
  step: number; display: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>
          {label}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.gold, fontWeight: 500 }}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: C.gold, cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 10, color: C.muted, marginTop: 2 }}>
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: C.surface, padding: '18px 20px' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Bebas Neue', var(--font-bebas), Impact, sans-serif", fontSize: 34, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, marginTop: 4 }}>
        {sub}
      </div>
    </div>
  )
}

// ─── CSV parsing (Binance Trade History) ─────────────────────────────────────
interface CsvStats { nTrades: number; mu: number; sigma: number; capital: number }

function parseBinanceCsv(text: string): CsvStats | null {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return null

  // Find header
  const header = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
  const profitIdx = header.findIndex(h => h.includes('realized profit') || h === 'realizedprofit')
  const amountIdx = header.findIndex(h => h === 'amount' || h.includes('total'))
  if (profitIdx === -1 && amountIdx === -1) return null

  const profits: number[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''))
    const idx = profitIdx !== -1 ? profitIdx : amountIdx
    const val = parseFloat(cols[idx] ?? '')
    if (!isNaN(val)) profits.push(val)
  }
  if (profits.length < 3) return null

  // Bucket by month to get monthly returns
  const totalPnl = profits.reduce((a, b) => a + b, 0)
  const meanR = totalPnl / profits.length
  const variance = profits.reduce((a, p) => a + (p - meanR) ** 2, 0) / profits.length

  const baseCapital = Math.max(1000, Math.abs(profits.reduce((a, b) => a + Math.abs(b), 0)) * 2)
  const muPct   = (meanR / baseCapital) * 100
  const sigPct  = (Math.sqrt(variance) / baseCapital) * 100

  return { nTrades: profits.length, mu: Math.max(0, Math.min(3, muPct)), sigma: Math.max(0.5, Math.min(20, sigPct)), capital: baseCapital }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MonteCarloPage() {
  const { totalUSD: portfolioTotal, ready: portfolioReady } = usePortfolio()
  const [capital,  setCapital]  = useState(50_000)
  const [μPct,     setMu]       = useState(0.70)
  const [σPct,     setSigma]    = useState(4.50)
  const [years,    setYears]    = useState(20)
  const [nSims,    setNSims]    = useState(2000)
  const [targetM,  setTargetM]  = useState(1.0)
  const [result,   setResult]   = useState<SimResult | null>(null)
  const [running,  setRunning]  = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const [mode,      setMode]      = useState<'manual' | 'csv'>('manual')
  const [csvStats,  setCsvStats]  = useState<CsvStats | null>(null)
  const [csvError,  setCsvError]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [savedMsg,  setSavedMsg]  = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const target = targetM * 1_000_000

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvError('')
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const parsed = parseBinanceCsv(text)
      if (!parsed) {
        setCsvError('No se pudo leer el CSV. Asegúrate de que sea el historial de trades de Binance.')
        return
      }
      setCsvStats(parsed)
      setMu(parseFloat(parsed.mu.toFixed(3)))
      setSigma(parseFloat(parsed.sigma.toFixed(3)))
      setCapital(Math.round(parsed.capital / 1000) * 1000)
    }
    reader.readAsText(file)
  }

  const runSim = useCallback(() => {
    setRunning(true)
    setTimeout(() => {
      try {
        const res = simulate(capital, μPct / 100, σPct / 100, years, nSims, target)
        setResult(res)
      } finally {
        setRunning(false)
      }
    }, 0)
  }, [capital, μPct, σPct, years, nSims, target])

  useEffect(() => { runSim() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync capital from Portfolio page — only if user hasn't uploaded a CSV
  useEffect(() => {
    if (portfolioReady && portfolioTotal > 0 && !csvStats)
      setCapital(Math.round(portfolioTotal / 1000) * 1000)
  }, [portfolioReady, portfolioTotal, csvStats])

  const stats = useMemo(() => {
    if (!result) return null
    const steps = years * 12
    const annualReturn = (Math.pow(1 + μPct / 100, 12) - 1) * 100
    const annualVol    = σPct * Math.sqrt(12)
    const sharpe       = annualVol > 0 ? (annualReturn - 4.5) / annualVol : 0
    return {
      p10: result.p10[steps],
      p50: result.p50[steps],
      p90: result.p90[steps],
      prob: result.probTarget,
      annualReturn,
      annualVol,
      sharpe,
    }
  }, [result, years, μPct, σPct])

  async function saveRun() {
    if (!stats || !result) return
    setSaving(true); setSavedMsg('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSavedMsg('Inicia sesión para guardar.'); setSaving(false); return }
      await supabase.from('montecarlo_runs').insert({
        user_id:       user.id,
        modo:          mode,
        capital,
        n_trades:      csvStats?.nTrades ?? null,
        anios:         years,
        mu_mensual:    μPct,
        sigma_mensual: σPct,
        sharpe:        stats.sharpe,
        var_95:        result.p10[years * 12],
        p50_final:     stats.p50,
        prob_objetivo: stats.prob,
      })
      setSavedMsg('Simulación guardada.')
    } catch {
      setSavedMsg('Error al guardar. Intenta nuevamente.')
    }
    setSaving(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: scrolled ? 'rgba(4,5,10,0.96)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: `1px solid ${scrolled ? C.border : 'transparent'}`,
        transition: 'all 0.3s',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <div style={{ width: 28, height: 28, border: `1px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'Bebas Neue', var(--font-bebas), Impact", color: C.gold, fontSize: 14, lineHeight: 1 }}>Σ</span>
            </div>
            <span style={{ fontFamily: "'Bebas Neue', var(--font-bebas), Impact, sans-serif", fontSize: 18, letterSpacing: '0.18em', color: C.text }}>
              SIGMA RESEARCH
            </span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {([['Inicio', '/'], ['FIRE', '/#fire'], ['Modelos', '/#modelos']] as [string, string][]).map(([l, h]) => (
              <Link key={h} href={h} style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.dimText, textDecoration: 'none' }}>
                {l}
              </Link>
            ))}
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.gold, borderBottom: `1px solid ${C.gold}`, paddingBottom: 2 }}>
              Monte Carlo
            </span>
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '96px 24px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 12 }}>
            {'// SIMULACIÓN ESTOCÁSTICA · GBM · BOX-MULLER'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', var(--font-bebas), Impact, sans-serif", fontSize: 'clamp(52px, 8vw, 100px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ color: C.text }}>MONTE CARLO</span><br />
            <span style={{
              background: `linear-gradient(135deg, ${C.gold} 0%, ${C.glow} 50%, #a88c25 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>SIMULATOR</span>
          </h1>
          <p style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText, marginTop: 16, maxWidth: 620, lineHeight: 1.7 }}>
            Cada trayectoria sigue el GBM:&nbsp;
            <code style={{ color: C.gold, background: 'rgba(212,175,55,0.08)', padding: '1px 6px' }}>
              S(t+Δt) = S(t) · exp((μ − σ²/2)Δt + σ√Δt · Z)
            </code>
            &nbsp;con Z~N(0,1) generado por Box-Muller, Δt = 1 mes.
          </p>
        </div>

        {/* Grid: controls | chart */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 1, background: C.border }}>

          {/* ── Controls panel ── */}
          <div style={{ background: C.surface, padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold }}>
              PARÁMETROS
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 1, background: C.border }}>
              {(['manual', 'csv'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  style={{ flex: 1, padding: '8px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: mode === m ? C.gold : C.surface, color: mode === m ? C.bg : C.dimText }}>
                  {m === 'manual' ? 'MANUAL' : 'CSV BINANCE'}
                </button>
              ))}
            </div>

            {/* CSV upload section */}
            {mode === 'csv' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, lineHeight: 1.6 }}>
                  Sube tu historial de trades de Binance (CSV). Se calculan μ y σ reales a partir de los <em>Realized Profit</em>.
                </div>
                <button onClick={() => fileRef.current?.click()}
                  style={{ padding: '10px', background: 'transparent', border: `1px dashed ${C.gold}60`, color: C.gold, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer' }}>
                  SELECCIONAR CSV
                </button>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvFile} style={{ display: 'none' }} />
                {csvError && <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.red }}>{csvError}</div>}
                {csvStats && (
                  <div style={{ background: C.bg, padding: '10px 12px', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.green }}>✓ CSV cargado — {csvStats.nTrades} trades</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>μ mensual: <span style={{ color: C.gold }}>{csvStats.mu.toFixed(3)}%</span></div>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>σ mensual: <span style={{ color: C.gold }}>{csvStats.sigma.toFixed(3)}%</span></div>
                  </div>
                )}
              </div>
            )}

            <Slider label="Capital inicial" value={capital} min={5000} max={500000} step={5000}
              display={fmtFull(capital)} onChange={setCapital} />

            <Slider label="Retorno mensual μ" value={μPct} min={0} max={3} step={0.05}
              display={`${μPct.toFixed(2)}% / mes`} onChange={setMu} />

            <Slider label="Volatilidad mensual σ" value={σPct} min={0.5} max={20} step={0.25}
              display={`${σPct.toFixed(2)}% / mes`} onChange={setSigma} />

            <Slider label="Horizonte" value={years} min={1} max={40} step={1}
              display={`${years} años`} onChange={setYears} />

            <Slider label="N° simulaciones" value={nSims} min={1000} max={10000} step={500}
              display={nSims.toLocaleString()} onChange={setNSims} />

            <Slider label="Objetivo FIRE" value={targetM} min={0.1} max={5} step={0.1}
              display={`$${targetM.toFixed(1)}M`} onChange={setTargetM} />

            {/* Derived annuals */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 2 }}>
                EQUIVALENTE ANUAL
              </div>
              {[
                ['Retorno anual', `${((Math.pow(1 + μPct/100, 12) - 1) * 100).toFixed(2)}%`],
                ['Volatilidad anual', `${(σPct * Math.sqrt(12)).toFixed(2)}%`],
                ['Sharpe implícito (rf=4.5%)', (() => {
                  const aR = (Math.pow(1 + μPct/100, 12) - 1) * 100
                  const aV = σPct * Math.sqrt(12)
                  return aV > 0 ? ((aR - 4.5) / aV).toFixed(2) : '—'
                })()],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 11, gap: 8 }}>
                  <span style={{ color: C.dimText }}>{k}</span>
                  <span style={{ color: C.gold, whiteSpace: 'nowrap' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* SIMULAR button */}
            <button
              onClick={runSim}
              disabled={running}
              style={{
                marginTop: 4,
                padding: '14px 0',
                background: running ? C.border : C.gold,
                color: running ? C.dimText : C.bg,
                border: 'none',
                cursor: running ? 'wait' : 'pointer',
                fontFamily: "'Bebas Neue', var(--font-bebas), Impact, sans-serif",
                fontSize: 22,
                letterSpacing: '0.15em',
                transition: 'background 0.15s, box-shadow 0.15s',
                boxShadow: running ? 'none' : `0 0 20px rgba(212,175,55,0.25)`,
              }}
              onMouseEnter={e => { if (!running) (e.target as HTMLButtonElement).style.background = C.glow }}
              onMouseLeave={e => { if (!running) (e.target as HTMLButtonElement).style.background = C.gold }}
            >
              {running ? 'SIMULANDO…' : `SIMULAR ${nSims.toLocaleString()}`}
            </button>

            {/* Save run */}
            {result && !running && (
              <div>
                <button onClick={saveRun} disabled={saving}
                  style={{ width: '100%', padding: '10px 0', background: 'transparent', color: C.gold, border: `1px solid ${C.gold}60`, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'GUARDANDO…' : 'GUARDAR SIMULACIÓN'}
                </button>
                {savedMsg && <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.green, marginTop: 6 }}>{savedMsg}</div>}
              </div>
            )}
          </div>

          {/* ── Chart + stats panel ── */}
          <div style={{ background: C.bg, display: 'flex', flexDirection: 'column' }}>

            {/* Chart header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.dimText }}>
                TRAYECTORIAS GBM
              </span>
              {running && (
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.gold }}>
                  ⟳ EJECUTANDO {nSims.toLocaleString()} SIMULACIONES…
                </span>
              )}
            </div>

            {/* Chart — dynamic loaded, no SSR */}
            {result && !running ? (
              <McChart result={result} capital={capital} target={target} years={years} nSims={nSims} />
            ) : running ? (
              <div style={{ height: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: C.bg }}>
                <div style={{ width: 48, height: 48, border: `2px solid ${C.border}`, borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>
                  Generando {nSims.toLocaleString()} × {years * 12} trayectorias GBM…
                </span>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            ) : (
              <div style={{ height: 440, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>
                  Ajusta parámetros y presiona SIMULAR
                </span>
              </div>
            )}

            {/* Stats grid */}
            {stats && !running && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: C.border, borderTop: `1px solid ${C.border}` }}>
                <StatCard
                  label="P10 · Peor escenario"
                  value={fmtShort(stats.p10)}
                  sub={`peor 10% · año ${years}`}
                  color={C.red}
                />
                <StatCard
                  label="P50 · Capital mediano"
                  value={fmtShort(stats.p50)}
                  sub={`mediana · año ${years}`}
                  color={C.gold}
                />
                <StatCard
                  label="P90 · Mejor escenario"
                  value={fmtShort(stats.p90)}
                  sub={`mejor 10% · año ${years}`}
                  color={C.green}
                />
                <StatCard
                  label="Prob. Objetivo FIRE"
                  value={`${stats.prob.toFixed(1)}%`}
                  sub={`alcanzar ${fmtShort(target)}`}
                  color={stats.prob >= 70 ? C.green : stats.prob >= 40 ? C.yellow : C.red}
                />
              </div>
            )}

            {/* Extended stats row */}
            {stats && !running && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: C.border }}>
                {[
                  ['Retorno anual implícito',  `${stats.annualReturn.toFixed(2)}%`],
                  ['Volatilidad anual (σ√12)', `${stats.annualVol.toFixed(2)}%`],
                  ['Sharpe ratio implícito',   stats.sharpe.toFixed(3)],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: C.surface, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{k}</span>
                    <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22, color: C.gold }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Formula note */}
            <div style={{ padding: '10px 18px', borderTop: `1px solid ${C.border}` }}>
              <p style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, margin: 0 }}>
                GBM · drift = μ − σ²/2 · Float32Array · percentiles calculados sobre las {nSims.toLocaleString()} simulaciones completas · ~60 paths visibles
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
