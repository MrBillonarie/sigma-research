'use client'
import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { fmt, fmtK } from '@/app/lib/format'
import FireChallenges from './FireChallenges'
import FireOnboarding from './FireOnboarding'
import { usePortfolio } from '@/app/lib/usePortfolio'
import { useFireProfile } from '@/app/lib/useFireProfile'
import { cardStyle, heroCardStyle, numberEmboss } from '@/app/lib/constants'

const FireChart = dynamic(() => import('./FireChart'), {
  ssr: false,
  loading: () => <div style={{ height: 320, background: '#04050a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7f9a' }}>Cargando proyección…</span></div>,
})

const C = {
  bg: '#04050a', surface: '#0b0d14', border: '#1a1d2e',
  muted: '#3a3f55', dimText: '#7a7f9a', text: '#e8e9f0',
  gold: '#d4af37', glow: '#f0cc5a', green: '#34d399', red: '#f87171', yellow: '#fbbf24',
}

// ─── FIRE modes ───────────────────────────────────────────────────────────────
// peak = altura del sparkline (0–1): la altitud de libertad que persigue cada
// modo, no la velocidad a la que crece — Lean apunta bajo, Fat apunta alto.
const MODES = [
  {
    id: 'lean',
    name: 'LEAN FIRE',
    color: '#f59e0b',
    description: 'Independencia financiera con estilo de vida frugal. Mínimo suficiente para cubrir necesidades básicas con margen.',
    defaultGasto: 1200,
    peak: 0.32,
  },
  {
    id: 'barista',
    name: 'BARISTA FIRE',
    color: '#34d399',
    description: 'Semi-retiro. El portafolio cubre la mayoría de gastos, complementado con trabajo part-time o pasiones.',
    defaultGasto: 2500,
    peak: 0.62,
  },
  {
    id: 'fat',
    name: 'FAT FIRE',
    color: '#d4af37',
    description: 'Retiro completo con alto estándar de vida. Lujo, viajes frecuentes y sin restricciones financieras.',
    defaultGasto: 6000,
    peak: 0.95,
  },
]

// Sparkline ascendente — la altura a la que llega representa la altitud de
// libertad de cada modo, conectando con el lenguaje de curva del resto de
// la página (no un ícono literal, no un emoji).
function ModeSparkline({ color, peak }: { color: string; peak: number }) {
  const w = 46, h = 28, padX = 3, padTop = 4, padBottom = 4
  const x0 = padX, y0 = h - padBottom
  const x1 = w - padX, y1 = padTop + (1 - peak) * (h - padTop - padBottom)
  const cx = (x0 + x1) / 2
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', flexShrink: 0 }}>
      <path d={`M${x0},${y0} Q${cx},${y0} ${x1},${y1}`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.85} />
      <circle cx={x1} cy={y1} r={3} fill={color} />
    </svg>
  )
}

// ─── Simulation ───────────────────────────────────────────────────────────────
function project(capital: number, ahorro: number, retorno: number, gastoFire: number, maxYears = 50) {
  const target = (gastoFire * 12) / 0.04  // Regla del 4%
  const data: number[] = [capital]
  let fireYear: number | null = null
  let c = capital

  for (let y = 1; y <= maxYears; y++) {
    c = c * (1 + retorno / 100) + ahorro * 12
    data.push(Math.round(c))
    if (fireYear === null && c >= target) fireYear = y
  }
  return { data, target, fireYear }
}


function Slider({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number
  step: number; display: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>{label}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.gold, fontWeight: 500 }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: C.gold, cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 10, color: C.muted, marginTop: 2 }}>
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  )
}

function Label({ text }: { text: string }) {
  return <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>{text}</div>
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FirePage() {
  const { totalUSD: portfolioTotal, ready: portfolioReady } = usePortfolio()
  const { profile: fireProfile, loading: fireProfileLoading, needsOnboarding, saveProfile } = useFireProfile()
  const [mode,    setMode]    = useState(1)   // 0=Lean 1=Barista 2=Fat
  const [capital, setCapital] = useState(80_000)

  // Sync capital from Portfolio page when it loads
  useEffect(() => {
    if (portfolioReady && portfolioTotal > 0) setCapital(Math.round(portfolioTotal))
  }, [portfolioReady, portfolioTotal])
  const [ahorro,  setAhorro]  = useState(1_500)
  const [retorno, setRetorno] = useState(8)
  const [edad,    setEdad]    = useState(29)
  const [gasto,   setGasto]   = useState(MODES[1].defaultGasto)
  const [retornoMotor, setRetornoMotor] = useState<number | null>(null)

  // Retorno real del motor en vivo (mismo origen de datos que el HUD/motor-en-vivo,
  // vía la ruta ya protegida /api/vps/portfolio) — solo precarga el slider una vez,
  // el usuario sigue pudiendo ajustarlo libremente después.
  useEffect(() => {
    fetch('/api/vps/portfolio', { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const pct = data?.live?.return_pct
        if (typeof pct === 'number' && pct > 0) {
          setRetornoMotor(Math.round(pct * 10) / 10)
          setRetorno(prev => prev === 8 ? Math.min(20, Math.round(pct * 10) / 10) : prev)
        }
      })
      .catch(() => {})
  }, [])

  // Hidratar edad/ahorro/gasto desde el perfil FIRE guardado en Supabase
  // (persiste entre dispositivos, a diferencia del localStorage anterior).
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (fireProfileLoading || hydrated) return
    if (fireProfile.fire_completed) {
      if (fireProfile.fire_edad)           setEdad(fireProfile.fire_edad)
      if (fireProfile.fire_ahorro_mensual !== null) setAhorro(fireProfile.fire_ahorro_mensual)
      if (fireProfile.fire_gasto_mensual)  setGasto(fireProfile.fire_gasto_mensual)
    }
    setHydrated(true)
  }, [fireProfileLoading, fireProfile, hydrated])

  // Guardar cambios de los sliders de vuelta al perfil (debounced)
  useEffect(() => {
    if (!hydrated || !fireProfile.fire_completed) return
    const t = setTimeout(() => {
      saveProfile({ fire_edad: edad, fire_ahorro_mensual: ahorro, fire_gasto_mensual: gasto })
    }, 800)
    return () => clearTimeout(t)
  }, [edad, ahorro, gasto, hydrated, fireProfile.fire_completed, saveProfile])

  function handleOnboardingComplete(data: { edad: number; ahorro: number; gasto: number }) {
    setEdad(data.edad)
    setAhorro(data.ahorro)
    setGasto(data.gasto)
    setHydrated(true)
    saveProfile({
      fire_edad: data.edad, fire_ahorro_mensual: data.ahorro,
      fire_gasto_mensual: data.gasto, fire_completed: true,
    })
  }

  const m = MODES[mode]

  // Modo que calza con tu gasto real (perfil guardado) — un espejo de tu
  // situación, independiente de cuál tengas seleccionado para explorar.
  const closestModeIdx = useMemo(() => {
    if (!fireProfile.fire_completed || !fireProfile.fire_gasto_mensual) return null
    let best = 0, bestDiff = Infinity
    MODES.forEach((md, i) => {
      const diff = Math.abs(fireProfile.fire_gasto_mensual! - md.defaultGasto)
      if (diff < bestDiff) { bestDiff = diff; best = i }
    })
    return best
  }, [fireProfile])

  const { data, target, fireYear } = useMemo(
    () => project(capital, ahorro, retorno, gasto),
    [capital, ahorro, retorno, gasto]
  )

  // sigma_fire_target sigue en localStorage sin keying por usuario: lo lee
  // app/(dashboard)/home/page.tsx para mostrar la meta FIRE en el dashboard.
  useEffect(() => {
    try { localStorage.setItem('sigma_fire_target', String(target)) } catch {}
  }, [target])

  const years = data.length - 1
  const labels = Array.from({ length: years + 1 }, (_, i) => String(i))
  const progress = Math.min((capital / target) * 100, 100)
  const edadFire = fireYear !== null ? edad + fireYear : null
  const capitalFinal = data[data.length - 1]

  // Tu fecha de libertad real, no solo un conteo de años abstracto.
  const fireDateLabel = useMemo(() => {
    if (fireYear === null) return null
    const d = new Date()
    d.setFullYear(d.getFullYear() + fireYear)
    return d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  }, [fireYear])

  if (fireProfileLoading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>Cargando tu FIRE Planner…</span>
      </div>
    )
  }

  if (needsOnboarding) {
    return <FireOnboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <div className="dash-content" style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
            {'// INDEPENDENCIA FINANCIERA · REGLA DEL 4%'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FIRE</span>{' '}
            <span style={{ color: C.text }}>PLANNER</span>
          </h1>
        </div>

        {/* Mode selector — el activo pesa más (su propio color, no el dorado
            genérico); el que calza con tu gasto real lleva su propio badge */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {MODES.map((md, i) => {
            const active = mode === i
            const isYours = closestModeIdx === i
            return (
              <button key={md.id} onClick={() => { setMode(i); setGasto(md.defaultGasto) }} style={{
                position: 'relative', padding: '18px 20px', textAlign: 'left', cursor: 'pointer',
                borderRadius: cardStyle.borderRadius,
                border: active ? `1px solid ${md.color}40` : cardStyle.border,
                background: active ? `linear-gradient(160deg,${md.color}14,${C.surface} 60%)` : C.surface,
                boxShadow: active ? `${cardStyle.boxShadow}, 0 0 18px ${md.color}22` : cardStyle.boxShadow,
                transition: 'background 0.2s, border-color 0.2s',
              }}>
                {isYours && (
                  <span style={{ position: 'absolute', top: 12, right: 14, fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.12em', color: md.color, border: `1px solid ${md.color}50`, borderRadius: 4, padding: '2px 6px' }}>
                    TU NIVEL ACTUAL
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <ModeSparkline color={md.color} peak={md.peak} />
                  <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 24, color: active ? md.color : C.text }}>{md.name}</span>
                </div>
                <p style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, margin: 0, lineHeight: 1.6 }}>{md.description}</p>
              </button>
            )
          })}
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>

          {/* Controls */}
          <div style={{ ...cardStyle, background: C.surface, padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: m.color }}>
              {m.name}
            </div>
            <Slider label="Capital actual"    value={capital} min={0}      max={1_000_000} step={5_000}  display={fmt(capital)}          onChange={setCapital} />
            <Slider label="Ahorro mensual"     value={ahorro}  min={0}      max={15_000}    step={100}    display={fmt(ahorro)}            onChange={setAhorro} />
            <Slider label="Gasto mensual FIRE" value={gasto}   min={500}    max={15_000}    step={100}    display={fmt(gasto)}             onChange={setGasto} />
            <div>
              <Slider label="Retorno anual est." value={retorno} min={1}      max={20}        step={0.5}    display={`${retorno}%`}          onChange={setRetorno} />
              {retornoMotor !== null && (
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText, marginTop: 4 }}>
                  Motor en vivo: <span style={{ color: C.green }}>{retornoMotor}%</span>
                  {retorno !== retornoMotor && (
                    <button onClick={() => setRetorno(Math.min(20, retornoMotor))} style={{ marginLeft: 8, background: 'none', border: 'none', color: C.gold, fontFamily: 'monospace', fontSize: 9, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                      usar este valor
                    </button>
                  )}
                </div>
              )}
            </div>
            <Slider label="Edad actual"        value={edad}    min={18}     max={65}        step={1}      display={`${edad} años`}         onChange={setEdad} />

            {/* Key derived */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label text="Parámetros FIRE" />
              {[
                ['Meta (25× gastos anuales)', fmtK(target)],
                ['Tasa retiro segura',         '4.00%'],
                ['Ingreso pasivo mensual',      fmt(gasto)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 11, gap: 8 }}>
                  <span style={{ color: C.dimText }}>{k}</span>
                  <span style={{ color: m.color, whiteSpace: 'nowrap' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          <div style={{ ...cardStyle, background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Big result — tu fecha real, no un conteo de años abstracto */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '18px 18px 0' }}>
              <div style={{ ...heroCardStyle, padding: '22px 22px' }}>
                <Label text="Tu día de libertad financiera" />
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, lineHeight: 1.05, textTransform: 'capitalize', background: `linear-gradient(135deg,${C.gold},${C.glow})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: numberEmboss }}>
                  {fireDateLabel ?? 'Más de 50 años'}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginTop: 6 }}>
                  {edadFire ? `Tendrás ${edadFire} años · en ${fireYear} ${fireYear === 1 ? 'año' : 'años'} más` : 'Aumenta ahorro / retorno'}
                </div>
              </div>
              <div style={{ ...cardStyle, background: C.surface, padding: '22px 22px' }}>
                <Label text="Capital objetivo" />
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, color: C.gold, lineHeight: 1, textShadow: numberEmboss }}>
                  {fmtK(target)}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginTop: 6 }}>25× gastos anuales</div>
              </div>
              <div style={{ ...cardStyle, background: C.surface, padding: '22px 22px' }}>
                <Label text={`Capital en año ${Math.min(years, 50)}`} />
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, color: capitalFinal >= target ? C.green : C.yellow, lineHeight: 1, textShadow: numberEmboss }}>
                  {fmtK(capitalFinal)}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginTop: 6 }}>
                  {capitalFinal >= target ? '✓ Objetivo alcanzado' : `Falta ${fmtK(target - capitalFinal)}`}
                </div>
              </div>
            </div>

            {/* Progress — camino con hitos, no una barra de carga genérica */}
            <div style={{ padding: '18px 18px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>TU CAMINO AL OBJETIVO</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: m.color }}>{progress.toFixed(1)}%</span>
              </div>
              <div style={{ position: 'relative', height: 8, background: C.border, borderRadius: 4 }}>
                <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.glow})`, transition: 'width 0.5s', borderRadius: 4 }} />
                {[25, 50, 75, 100].map(milestone => (
                  <div key={milestone} style={{
                    position: 'absolute', top: -3, left: `${milestone}%`, transform: 'translateX(-50%)',
                    width: 2, height: 14, borderRadius: 1,
                    background: progress >= milestone ? C.gold : C.muted,
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 10, color: C.muted, marginTop: 10 }}>
                <span>{fmt(capital)}</span><span>Meta: {fmtK(target)}</span>
              </div>
            </div>

            {/* Chart */}
            <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ padding: '10px 18px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>PROYECCIÓN DE CAPITAL · RETORNO {retorno}% ANUAL</span>
              </div>
              <FireChart labels={labels} acum={data} target={target} fireYear={fireYear} capital={capital} />
            </div>

            {/* Desglose anual - primeros 10 años */}
            <div>
              <div style={{ padding: '10px 18px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>PROYECCIÓN ANUAL (PRIMEROS 15 AÑOS)</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Año', 'Edad', 'Capital', 'Ahorro acum.', '% Meta'].map(h => (
                        <th key={h} style={{ padding: '8px 16px', textAlign: 'left', color: C.dimText, fontWeight: 400, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 16).map((val, yr) => {
                      const pct = Math.min((val / target) * 100, 100)
                      const isFire = fireYear !== null && yr === fireYear
                      return (
                        <tr key={yr} style={{ borderBottom: `1px solid ${C.border}`, background: isFire ? 'rgba(52,211,153,0.06)' : yr % 2 === 0 ? 'transparent' : 'rgba(212,175,55,0.02)' }}>
                          <td style={{ padding: '9px 16px', color: isFire ? C.green : C.dimText }}>{isFire ? '🎯 ' : ''}{yr}</td>
                          <td style={{ padding: '9px 16px', color: C.dimText }}>{edad + yr}</td>
                          <td style={{ padding: '9px 16px', color: isFire ? C.green : (val >= target ? C.green : C.text) }}>{fmt(val)}</td>
                          <td style={{ padding: '9px 16px', color: C.dimText }}>{fmt(ahorro * 12 * yr)}</td>
                          <td style={{ padding: '9px 16px', color: pct >= 100 ? C.green : C.gold }}>{pct.toFixed(1)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ── Retos FIRE ── */}
        <FireChallenges ahorro={ahorro} capital={capital} retorno={retorno} target={target} />

      </div>
    </div>
  )
}
