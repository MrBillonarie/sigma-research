'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/app/lib/supabase'
import { C, cardStyle, heroCardStyle, numberEmboss } from '@/app/lib/constants'
import { usePortfolio } from '@/app/lib/usePortfolio'
import { useFireProfile } from '@/app/lib/useFireProfile'
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

// ─── Ruido Box-Muller — textura estática de puntos dispersos, evoca la fuente
// aleatoria del modelo sin ser literal ni animada. ────────────────────────────
const NOISE_BG = [
  'radial-gradient(circle at 8% 15%, rgba(57,226,230,0.055) 1px, transparent 1.6px)',
  'radial-gradient(circle at 22% 62%, rgba(57,226,230,0.045) 1px, transparent 1.6px)',
  'radial-gradient(circle at 35% 28%, rgba(57,226,230,0.05) 1px, transparent 1.6px)',
  'radial-gradient(circle at 48% 78%, rgba(57,226,230,0.045) 1px, transparent 1.6px)',
  'radial-gradient(circle at 58% 12%, rgba(57,226,230,0.055) 1px, transparent 1.6px)',
  'radial-gradient(circle at 67% 52%, rgba(57,226,230,0.045) 1px, transparent 1.6px)',
  'radial-gradient(circle at 74% 88%, rgba(57,226,230,0.05) 1px, transparent 1.6px)',
  'radial-gradient(circle at 83% 33%, rgba(57,226,230,0.055) 1px, transparent 1.6px)',
  'radial-gradient(circle at 91% 68%, rgba(57,226,230,0.045) 1px, transparent 1.6px)',
  'radial-gradient(circle at 14% 92%, rgba(57,226,230,0.05) 1px, transparent 1.6px)',
  'radial-gradient(circle at 5% 45%, rgba(57,226,230,0.045) 1px, transparent 1.6px)',
  'radial-gradient(circle at 95% 8%, rgba(57,226,230,0.05) 1px, transparent 1.6px)',
].join(',')

// ─── Stat card — P50 puede pedir tratamiento hero: es el centro de la
// campana, el escenario más probable, debe pesar más que P10/P90. ───────────
function StatCard({ label, value, sub, color, hero = false }: { label: string; value: string; sub: string; color: string; hero?: boolean }) {
  return (
    <div style={{ ...(hero ? heroCardStyle : cardStyle), background: hero ? undefined : C.surface, padding: '18px 20px' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Bebas Neue', var(--font-bebas), Impact, sans-serif", fontSize: hero ? 40 : 34, color, lineHeight: 1, textShadow: numberEmboss }}>
        {value}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, marginTop: 4 }}>
        {sub}
      </div>
    </div>
  )
}

// ─── Gauge circular de probabilidad — la prob. de alcanzar la meta FIRE es
// literalmente una probabilidad, se lee mejor como anillo que como número
// perdido entre 4 cards iguales. Mismo lenguaje que /portafolio y
// /diagnosticador (firma SIGMA, no un acento nuevo). ──────────────────────────
function ProbGauge({ value, color, size = 124 }: { value: number; color: string; size?: number }) {
  const stroke = 10
  const r = size / 2 - stroke
  const circumference = 2 * Math.PI * r
  const clamped = Math.min(Math.max(value, 0), 100)
  const offset = circumference * (1 - clamped / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Bebas Neue', var(--font-bebas), Impact, sans-serif", fontSize: size * 0.26, color, lineHeight: 1, textShadow: numberEmboss }}>
          {Math.round(clamped)}%
        </span>
      </div>
    </div>
  )
}

function ProbPanel({ prob, target }: { prob: number; target: number }) {
  const color = prob >= 70 ? C.green : prob >= 40 ? C.yellow : C.red
  return (
    <div style={{ ...cardStyle, background: C.surface, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 22 }}>
      <ProbGauge value={prob} color={color} />
      <div>
        <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 6 }}>
          PROBABILIDAD DE ÉXITO
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.muted, lineHeight: 1.6, maxWidth: 320 }}>
          Fracción de las simulaciones que alcanza {fmtShort(target)} dentro del horizonte simulado.
        </div>
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
  const { profile: fireProfile } = useFireProfile()
  const [capital,  setCapital]  = useState(50_000)
  const [μPct,     setMu]       = useState(0.70)
  const [σPct,     setSigma]    = useState(4.50)
  const [years,    setYears]    = useState(20)
  const [nSims,    setNSims]    = useState(2000)
  const [targetM,  setTargetM]  = useState(1.0)
  const [result,   setResult]   = useState<SimResult | null>(null)
  const [running,  setRunning]  = useState(false)
  // Parámetros que realmente generaron `result` — capturados en el momento
  // exacto de simular. P10/P50/P90/Sharpe deben leerse siempre desde acá, no
  // desde los sliders en vivo: si el usuario mueve "Horizonte" después de
  // simular sin volver a presionar SIMULAR, indexar con el valor del slider
  // contra arrays dimensionados para el horizonte viejo da `undefined` →
  // "$NaNK" en pantalla y corrompe lo que se guarda en Supabase.
  const [simulatedParams, setSimulatedParams] = useState<{
    capital: number; μPct: number; σPct: number; years: number; nSims: number
  } | null>(null)
  const [mode,      setMode]      = useState<'manual' | 'csv'>('manual')
  const [csvStats,  setCsvStats]  = useState<CsvStats | null>(null)
  const [csvError,  setCsvError]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [savedMsg,  setSavedMsg]  = useState('')
  const [simStep,   setSimStep]   = useState(-1)  // -1 idle · 0..2 paso de la secuencia
  const [simCount,  setSimCount]  = useState(0)   // runs de la sesión
  const fileRef = useRef<HTMLInputElement>(null)

  const target = targetM * 1_000_000

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
    const params = { capital, μPct, σPct, years, nSims }
    // Secuencia cinemática: los pasos se muestran ANTES del cálculo bloqueante
    // (el simulate real corre al final, en el paso "percentiles").
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const stepMs = reduced ? 0 : 380
    setSimStep(0)
    setTimeout(() => {
      setSimStep(1)
      setTimeout(() => {
        setSimStep(2)
        setTimeout(() => {
          try {
            const res = simulate(capital, μPct / 100, σPct / 100, years, nSims, target)
            setResult(res)
            setSimulatedParams(params)
            setSimCount(c => c + 1)
          } finally {
            setRunning(false)
            setSimStep(-1)
          }
        }, stepMs)
      }, stepMs)
    }, stepMs)
  }, [capital, μPct, σPct, years, nSims, target])

  // Solo capital/μ/σ/horizonte/n° simulaciones requieren volver a simular
  // (cambian las trayectorias GBM en sí). El objetivo FIRE no — la
  // probabilidad de alcanzarlo se recalcula en vivo más abajo sobre las
  // mismas trayectorias ya generadas, sin necesidad de resimular.
  const isStale = !!(result && simulatedParams && (
    simulatedParams.capital !== capital || simulatedParams.μPct !== μPct ||
    simulatedParams.σPct !== σPct || simulatedParams.years !== years ||
    simulatedParams.nSims !== nSims
  ))

  useEffect(() => { runSim() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync capital from Portfolio page — only if user hasn't uploaded a CSV
  useEffect(() => {
    if (portfolioReady && portfolioTotal > 0 && !csvStats)
      setCapital(Math.round(portfolioTotal / 1000) * 1000)
  }, [portfolioReady, portfolioTotal, csvStats])

  // Meta FIRE real (misma fórmula — regla del 4% — que usa /fire) en vez de
  // un objetivo genérico de $1M: precarga el slider una vez, el usuario
  // sigue pudiendo explorar otros escenarios libremente después.
  const fireTargetM = useMemo(() => {
    if (!fireProfile.fire_completed || !fireProfile.fire_gasto_mensual) return null
    return Math.round(((fireProfile.fire_gasto_mensual * 12) / 0.04) / 1_000_000 * 10) / 10
  }, [fireProfile])

  useEffect(() => {
    if (fireTargetM !== null) setTargetM(prev => prev === 1.0 ? fireTargetM : prev)
  }, [fireTargetM])

  const stats = useMemo(() => {
    if (!result || !simulatedParams) return null
    // Último índice tomado del largo real del array simulado — nunca puede
    // quedar fuera de rango, sin importar lo que diga el slider en vivo.
    const lastStep = result.p10.length - 1
    const annualReturn = (Math.pow(1 + simulatedParams.μPct / 100, 12) - 1) * 100
    const annualVol    = simulatedParams.σPct * Math.sqrt(12)
    const sharpe       = annualVol > 0 ? (annualReturn - 4.5) / annualVol : 0
    return {
      p10: result.p10[lastStep],
      p50: result.p50[lastStep],
      p90: result.p90[lastStep],
      annualReturn,
      annualVol,
      sharpe,
    }
  }, [result, simulatedParams])

  // Probabilidad de alcanzar el objetivo — recalculada en vivo sobre los
  // valores finales ya simulados cada vez que se mueve el slider de
  // Objetivo FIRE, sin necesidad de resimular (cambiar el umbral no requiere
  // nuevas trayectorias, solo recontar cuántas ya superan el nuevo target).
  const liveProb = useMemo(() => {
    if (!result || target <= 0) return 0
    return (result.finalVals.filter(v => v >= target).length / result.finalVals.length) * 100
  }, [result, target])

  useEffect(() => {
    try { localStorage.setItem('sigma_montecarlo', JSON.stringify({ fireProbability: Math.round(liveProb) })) } catch {}
  }, [liveProb])

  async function saveRun() {
    if (!stats || !result || !simulatedParams || isStale) return
    setSaving(true); setSavedMsg('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSavedMsg('Inicia sesión para guardar.'); setSaving(false); return }
      const { error: saveErr } = await supabase.from('montecarlo_runs').insert({
        user_id:       user.id,
        modo:          mode,
        capital:       simulatedParams.capital,
        n_trades:      csvStats?.nTrades ?? null,
        anios:         simulatedParams.years,
        mu_mensual:    simulatedParams.μPct,
        sigma_mensual: simulatedParams.σPct,
        sharpe:        stats.sharpe,
        var_95:        result.p10[result.p10.length - 1],
        p50_final:     stats.p50,
        prob_objetivo: liveProb,
      })
      if (saveErr) throw saveErr
      setSavedMsg('Simulación guardada.')
    } catch {
      setSavedMsg('Error al guardar. Intenta nuevamente.')
    }
    setSaving(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <style>{`
        .mc-in { animation: mcIn .45s ease both; }
        @keyframes mcIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
        .mc-blink { animation: mcBlink .9s steps(2) infinite; }
        @keyframes mcBlink { 50% { opacity:0; } }
        @media (prefers-reduced-motion: reduce) {
          .mc-in { animation:none; }
          .mc-blink { animation:none; }
        }
      `}</style>
      <div className="dash-content" style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 12 }}>
            {'// SIMULACIÓN ESTOCÁSTICA · GBM · BOX-MULLER'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', var(--font-bebas), Impact, sans-serif", fontSize: 'clamp(52px, 8vw, 100px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ color: C.text }}>MONTE CARLO</span><br />
            <span style={{
              background: `linear-gradient(135deg, ${C.gold} 0%, ${C.glow} 50%, #2f6bd6 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>SIMULATOR</span>
          </h1>
          <p style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText, marginTop: 16, maxWidth: 620, lineHeight: 1.7 }}>
            Cada trayectoria sigue el GBM:&nbsp;
            <code style={{ color: C.gold, background: 'rgba(57,226,230,0.08)', padding: '1px 6px' }}>
              S(t+Δt) = S(t) · exp((μ − σ²/2)Δt + σ√Δt · Z)
            </code>
            &nbsp;con Z~N(0,1) generado por Box-Muller, Δt = 1 mes.
          </p>
        </div>

        {/* Grid: controls | chart */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>

          {/* ── Controls panel — textura de ruido Box-Muller de fondo ── */}
          <div style={{ ...cardStyle, background: C.surface, backgroundImage: NOISE_BG, padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
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

            <div>
              <Slider label="Objetivo FIRE" value={targetM} min={0.1} max={5} step={0.1}
                display={`$${targetM.toFixed(1)}M`} onChange={setTargetM} />
              {fireTargetM !== null && (
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText, marginTop: 4 }}>
                  Meta FIRE: <span style={{ color: C.green }}>${fireTargetM.toFixed(1)}M</span>
                  {targetM !== fireTargetM && (
                    <button onClick={() => setTargetM(fireTargetM)} style={{ marginLeft: 8, background: 'none', border: 'none', color: C.gold, fontFamily: 'monospace', fontSize: 9, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                      usar este valor
                    </button>
                  )}
                </div>
              )}
            </div>

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
                background: running ? C.border : `linear-gradient(135deg, ${C.glow}, ${C.gold} 55%, #2f6bd6)`,
                color: running ? C.dimText : C.bg,
                border: 'none',
                cursor: running ? 'wait' : 'pointer',
                fontFamily: "'Bebas Neue', var(--font-bebas), Impact, sans-serif",
                fontSize: 22,
                letterSpacing: '0.15em',
                transition: 'background 0.15s, box-shadow 0.15s',
                boxShadow: running ? 'none' : `0 0 20px rgba(57,226,230,0.25)`,
              }}
              onMouseEnter={e => { if (!running) (e.target as HTMLButtonElement).style.boxShadow = '0 0 32px rgba(57,226,230,0.5)' }}
              onMouseLeave={e => { if (!running) (e.target as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(57,226,230,0.25)' }}
            >
              {running ? '⟳ SIMULANDO…' : `⚡ SIMULAR ${nSims.toLocaleString()}`}
            </button>

            {/* Save run */}
            {result && !running && (
              <div>
                <button onClick={saveRun} disabled={saving || isStale}
                  style={{ width: '100%', padding: '10px 0', background: 'transparent', color: C.gold, border: `1px solid ${C.gold}60`, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', cursor: saving || isStale ? 'not-allowed' : 'pointer', opacity: saving || isStale ? 0.5 : 1 }}>
                  {saving ? 'GUARDANDO…' : 'GUARDAR SIMULACIÓN'}
                </button>
                {isStale && (
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.yellow, marginTop: 6 }}>
                    Cambiaste parámetros — vuelve a presionar SIMULAR antes de guardar.
                  </div>
                )}
                {savedMsg && <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.green, marginTop: 6 }}>{savedMsg}</div>}
              </div>
            )}
          </div>

          {/* ── Chart + stats panel ── */}
          <div style={{ ...cardStyle, background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Chart header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.dimText }}>
                TRAYECTORIAS GBM
                {simCount > 0 && (
                  <span style={{ marginLeft: 10, fontSize: 9, letterSpacing: '0.12em', color: C.gold, border: `1px solid ${C.gold}35`, padding: '2px 7px' }}>
                    RUN #{simCount}
                  </span>
                )}
              </span>
              {running ? (
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.gold }}>
                  ⟳ EJECUTANDO {nSims.toLocaleString()} SIMULACIONES…
                </span>
              ) : isStale && (
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.yellow }}>
                  ⚠ Mostrando la última simulación — cambiaste parámetros
                </span>
              )}
            </div>

            {/* Chart — dynamic loaded, no SSR. capital/years/nSims se pasan
                congelados (lo que de verdad se simuló), no los sliders en
                vivo, para que las líneas de referencia del gráfico no
                contradigan las trayectorias ya dibujadas. target sí va en
                vivo — no requiere resimular, solo cambia dónde se dibuja la
                línea de meta. */}
            {result && !running && simulatedParams ? (
              <McChart result={result} capital={simulatedParams.capital} target={target} years={simulatedParams.years} nSims={simulatedParams.nSims} />
            ) : running ? (
              <div style={{ height: 440, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
                <div style={{ background: '#07080d', border: `1px solid ${C.border}`, padding: '20px 26px', fontFamily: 'monospace', fontSize: 12, lineHeight: 2.2, minWidth: 380 }}>
                  {[
                    'generando ruido Box-Muller (Z~N(0,1))',
                    `integrando ${nSims.toLocaleString()} trayectorias GBM`,
                    'calculando percentiles P10 / P50 / P90',
                  ].map((s, i) => (
                    i > simStep ? null : (
                      <div key={s} style={{ color: i < simStep ? C.dimText : C.gold, display: 'flex', gap: 10 }}>
                        <span style={{ color: C.gold }}>{'>'}</span>
                        <span style={{ flex: 1 }}>{s}…</span>
                        {i < simStep
                          ? <span style={{ color: C.green }}>✓</span>
                          : <span className="mc-blink" style={{ color: C.gold }}>▓</span>}
                      </div>
                    )
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ height: 440, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>
                  Ajusta parámetros y presiona SIMULAR
                </span>
              </div>
            )}

            {/* Stats grid — P50 con tratamiento hero: el centro de la campana.
                El año en el subtítulo viene de simulatedParams (lo que de
                verdad se simuló), no del slider en vivo. */}
            {stats && simulatedParams && !running && (
              <div key={`st-${simCount}`} className="mc-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '18px 18px 0', animationDelay: '250ms' }}>
                <StatCard
                  label="P10 · Peor escenario"
                  value={fmtShort(stats.p10)}
                  sub={`peor 10% · año ${simulatedParams.years}`}
                  color={C.red}
                />
                <StatCard
                  label="P50 · Capital mediano"
                  value={fmtShort(stats.p50)}
                  sub={`mediana · año ${simulatedParams.years}`}
                  color={C.gold}
                  hero
                />
                <StatCard
                  label="P90 · Mejor escenario"
                  value={fmtShort(stats.p90)}
                  sub={`mejor 10% · año ${simulatedParams.years}`}
                  color={C.green}
                />
              </div>
            )}

            {/* Probabilidad — gauge circular propio, separado de las 3 cards de
                escenario porque es una lectura distinta (no un monto, una chance).
                Se recalcula en vivo (liveProb), por eso no requiere `simulatedParams`. */}
            {result && !running && (
              <div key={`pb-${simCount}`} className="mc-in" style={{ padding: '16px 18px 0', animationDelay: '420ms' }}>
                <ProbPanel prob={liveProb} target={target} />
              </div>
            )}

            {/* Extended stats row */}
            {stats && !running && (
              <div key={`ex-${simCount}`} className="mc-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '16px 18px 18px', animationDelay: '560ms' }}>
                {[
                  ['Retorno anual implícito',  `${stats.annualReturn.toFixed(2)}%`],
                  ['Volatilidad anual (σ√12)', `${stats.annualVol.toFixed(2)}%`],
                  ['Sharpe ratio implícito',   stats.sharpe.toFixed(3)],
                ].map(([k, v]) => (
                  <div key={k} style={{ ...cardStyle, background: C.surface, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{k}</span>
                    <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22, color: C.gold }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Formula note */}
            <div style={{ padding: '10px 18px', borderTop: `1px solid ${C.border}` }}>
              <p style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, margin: 0 }}>
                GBM · drift = μ − σ²/2 · Float32Array · percentiles calculados sobre las {(simulatedParams?.nSims ?? nSims).toLocaleString()} simulaciones completas · ~60 paths visibles
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
