'use client'
import { useState, useEffect, useMemo, type ReactNode, type CSSProperties } from 'react'
import dynamic from 'next/dynamic'
import { fmt, fmtK } from '@/app/lib/format'
import FireChallenges from './FireChallenges'
import FireOnboarding from './FireOnboarding'
import FirePushOptIn from './FirePushOptIn'
import { usePortfolio } from '@/app/lib/usePortfolio'
import { useFireProfile } from '@/app/lib/useFireProfile'
import { C, cardStyle } from '@/app/lib/constants'
import { supabase } from '@/app/lib/supabase'
import { createNotification } from '@/app/lib/notify'

const FireChart = dynamic(() => import('./FireChart'), {
  ssr: false,
  loading: () => <div style={{ height: 320, background: '#04050a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7f9a' }}>Cargando proyección…</span></div>,
})
const FireOrbit = dynamic(() => import('./FireOrbit'), {
  ssr: false,
  loading: () => <div style={{ height: 280, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>Cargando trayectoria…</span></div>,
})
const ModeAscender = dynamic(() => import('./ModeAscender'), {
  ssr: false,
  loading: () => <div style={{ height: 190, background: '#060810', borderRadius: 10, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>Cargando modos…</span></div>,
})

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
    color: '#39e2e6',
    description: 'Retiro completo con alto estándar de vida. Lujo, viajes frecuentes y sin restricciones financieras.',
    defaultGasto: 6000,
    peak: 0.95,
  },
]

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


function Slider({ icon, accent = C.gold, label, value, min, max, step, display, onChange }: {
  icon?: ReactNode; accent?: string; label: string; value: number; min: number; max: number
  step: number; display: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
        {icon && (
          <span style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            background: `${accent}1f`, border: `1px solid ${accent}4d`, color: accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </span>
        )}
        <span style={{ fontFamily: 'monospace', fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dimText, flex: 1 }}>{label}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.gold, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{display}</span>
      </div>
      <div style={{ marginLeft: icon ? 31 : 0 }}>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: '100%', accentColor: accent, cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 10, color: C.muted, marginTop: 2 }}>
          <span>{min}</span><span>{max}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Íconos de línea (sin emoji) — trazo 1.4px, currentColor ─────────────────
const ICONS = {
  capital: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}><rect x="2" y="7" width="3.5" height="7" rx=".5" /><rect x="6.3" y="4" width="3.5" height="10" rx=".5" /><rect x="10.6" y="9" width="3" height="5" rx=".5" /></svg>,
  ahorro: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 13h12M4 9l3-3 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 4h3v3" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  gasto: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 3v10h12" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 10l3-3 2 2 4-5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  retorno: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M2 11l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 4h4v4" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  edad: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}><path d="M4 2h8M4 14h8M4 2c0 4 8 4 8 8s-8 4-8 8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
}

function Label({ text }: { text: string }) {
  return <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>{text}</div>
}

// ─── Tabla "Libro Mayor" — tratamiento visual del desglose anual ─────────────
// Premium por refinamiento, no por brillo: la órbita y el gráfico 3D de arriba
// se llevan la atención, así que la tabla es el descanso de la página. Acero
// apagado para el progreso corriente; el oro cálido queda RESERVADO para la
// única línea del año FIRE, para que "el día de libertad" resalte sin competir.
// Mismos datos que antes — sólo cambia el CSS.
const STEEL = '#3c4759'
const LGOLD = '#e9c877'
const LCOLS = '64px 56px 1fr 150px 150px 120px'
const ledgerHead: CSSProperties = {
  fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.16em',
  textTransform: 'uppercase', color: C.muted, whiteSpace: 'nowrap',
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

  // Meta FIRE alcanzada — notifica una sola vez (flag en localStorage), no en
  // cada render ni cada vez que el capital fluctúa por encima de la meta.
  useEffect(() => {
    if (progress < 100 || target <= 0) return
    try {
      if (localStorage.getItem('sigma_fire_goal_notified') === 'true') return
    } catch {}
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      createNotification({
        userId:      data.user.id,
        title:       '¡Meta FIRE alcanzada!',
        body:        `Tu capital llegó a ${fmtK(target)}, tu meta de independencia financiera. ¡Felicitaciones!`,
        type:        'fire',
        urgente:     true,
        accionLabel: 'Ver FIRE',
        accionHref:  '/fire',
      })
      try { localStorage.setItem('sigma_fire_goal_notified', 'true') } catch {}
    })
  }, [progress, target])

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold }}>
              {'// INDEPENDENCIA FINANCIERA · REGLA DEL 4%'}
            </div>
            <FirePushOptIn />
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#2f6bd6)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FIRE</span>{' '}
            <span style={{ color: C.text }}>PLANNER</span>
          </h1>
        </div>

        {/* Mode selector — trayectoria ascendente con tabs accesibles; el activo
            pesa más (su propio color); el que calza con tu gasto real lleva un halo */}
        <div style={{ marginBottom: 24 }}>
          <ModeAscender
            modes={MODES}
            activeIndex={mode}
            closestIndex={closestModeIdx}
            onSelect={i => { setMode(i); setGasto(MODES[i].defaultGasto) }}
          />
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>

          {/* Controls — consola de instrumento: filo superior + íconos en placa, ambos con el color del modo activo */}
          <div style={{
            background: `linear-gradient(180deg,${C.surface2},${C.surface})`, borderRadius: cardStyle.borderRadius,
            border: cardStyle.border, boxShadow: cardStyle.boxShadow, padding: 24,
            display: 'flex', flexDirection: 'column', gap: 22, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${m.color},transparent 75%)` }} />
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: m.color }}>
              {m.name}
            </div>
            <Slider icon={ICONS.capital} accent={m.color} label="Capital actual"    value={capital} min={0}      max={1_000_000} step={5_000}  display={fmt(capital)}          onChange={setCapital} />
            <Slider icon={ICONS.ahorro}  accent={m.color} label="Ahorro mensual"     value={ahorro}  min={0}      max={15_000}    step={100}    display={fmt(ahorro)}            onChange={setAhorro} />
            <Slider icon={ICONS.gasto}   accent={m.color} label="Gasto mensual FIRE" value={gasto}   min={500}    max={15_000}    step={100}    display={fmt(gasto)}             onChange={setGasto} />
            <div>
              <Slider icon={ICONS.retorno} accent={m.color} label="Retorno anual est." value={retorno} min={1}      max={20}        step={0.5}    display={`${retorno}%`}          onChange={setRetorno} />
              {retornoMotor !== null && (
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText, marginTop: 4, marginLeft: 31 }}>
                  Motor en vivo: <span style={{ color: C.green }}>{retornoMotor}%</span>
                  {retorno !== retornoMotor && (
                    <button onClick={() => setRetorno(Math.min(20, retornoMotor))} style={{ marginLeft: 8, background: 'none', border: 'none', color: C.gold, fontFamily: 'monospace', fontSize: 9, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                      usar este valor
                    </button>
                  )}
                </div>
              )}
            </div>
            <Slider icon={ICONS.edad} accent={m.color} label="Edad actual"        value={edad}    min={18}     max={65}        step={1}      display={`${edad} años`}         onChange={setEdad} />

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

            {/* Resultado como momento tipográfico — tu fecha real pesa más que 3 cajas iguales */}
            <div style={{ padding: '30px 34px 0', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: '60%', height: '180%', background: `radial-gradient(closest-side, ${C.gold}18, transparent 70%)`, pointerEvents: 'none' }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 36, flexWrap: 'wrap', paddingBottom: 22, borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <Label text="Tu día de libertad financiera" />
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(44px, 5.4vw, 72px)', lineHeight: 0.88, textTransform: 'capitalize', letterSpacing: '0.01em', background: `linear-gradient(135deg,${C.gold},${C.glow})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: `drop-shadow(0 0 22px ${C.gold}48)` }}>
                    {fireDateLabel ?? 'Más de 50 años'}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginTop: 8 }}>
                    {edadFire ? `Tendrás ${edadFire} años · en ${fireYear} ${fireYear === 1 ? 'año' : 'años'} más` : 'Aumenta ahorro / retorno'}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 11, paddingLeft: 26, borderLeft: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 12 }}>
                    <span style={{ color: C.dimText }}>Capital objetivo</span>
                    <b style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, fontWeight: 400, color: C.text, letterSpacing: '0.02em' }}>{fmtK(target)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 12 }}>
                    <span style={{ color: C.dimText }}>Capital en año {Math.min(years, 50)}</span>
                    <b style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, fontWeight: 400, color: capitalFinal >= target ? C.green : C.yellow, letterSpacing: '0.02em' }}>{fmtK(capitalFinal)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 12 }}>
                    <span style={{ color: C.dimText }}>{capitalFinal >= target ? 'Objetivo' : 'Progreso actual'}</span>
                    <b style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, fontWeight: 400, color: capitalFinal >= target ? C.green : C.text, letterSpacing: '0.02em' }}>
                      {capitalFinal >= target ? '✓ alcanzado' : `${progress.toFixed(1)}%`}
                    </b>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress — Órbita de Escape, trayectoria hacia el planeta "Libertad" */}
            <FireOrbit progress={progress} color={m.color} capital={capital} target={target} />

            {/* Chart */}
            <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ padding: '10px 18px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>PROYECCIÓN DE CAPITAL · RETORNO {retorno}% ANUAL</span>
              </div>
              <FireChart labels={labels} acum={data} target={target} fireYear={fireYear} capital={capital} />
            </div>

            {/* Desglose anual — tratamiento "Libro Mayor" (solo visual; mismos datos) */}
            <div>
              <div style={{ padding: '13px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dimText }}>PROYECCIÓN ANUAL</span>
                <span style={{ fontFamily: 'monospace', fontSize: 9.5, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>primeros 15 años · meta {fmtK(target)}</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 560 }}>
                  {/* Cabecera */}
                  <div style={{ display: 'grid', gridTemplateColumns: LCOLS, alignItems: 'center', columnGap: 16, padding: '0 22px', height: 34, borderBottom: `1px solid ${C.border}` }}>
                    <span style={ledgerHead}>Año</span>
                    <span style={ledgerHead}>Edad</span>
                    <span />
                    <span style={{ ...ledgerHead, textAlign: 'right' }}>Ahorro acum.</span>
                    <span style={{ ...ledgerHead, textAlign: 'right' }}>Capital</span>
                    <span style={{ ...ledgerHead, textAlign: 'right' }}>% Meta</span>
                  </div>
                  {data.slice(0, 16).flatMap((val, yr) => {
                    const pct     = Math.min((val / target) * 100, 100)
                    const prevPct = yr > 0 ? Math.min((data[yr - 1] / target) * 100, 100) : 0
                    const q = Math.floor(pct / 25), pq = Math.floor(prevPct / 25)
                    const isFire = fireYear !== null && yr === fireYear
                    const els: ReactNode[] = []

                    // Separador de hito al cruzar 25 / 50 / 75 % — pausa discreta en la lectura
                    if (q > pq && q < 4) {
                      els.push(
                        <div key={`sep-${yr}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', height: 30 }}>
                          <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                          <span style={{ fontFamily: 'monospace', fontSize: 8.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.muted }}>{q * 25}% de la meta</span>
                          <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                        </div>
                      )
                    }

                    els.push(
                      <div key={yr} style={{
                        display: 'grid', gridTemplateColumns: LCOLS, alignItems: 'center', columnGap: 16,
                        padding: '0 22px', height: isFire ? 58 : 46,
                        borderBottom: '1px solid rgba(255,255,255,0.045)',
                        borderTop: isFire ? `1px solid ${LGOLD}66` : undefined,
                        background: isFire ? `linear-gradient(90deg,${LGOLD}0d,transparent 60%)` : undefined,
                      }}>
                        <span style={{ fontFamily: 'monospace', color: isFire ? LGOLD : C.dimText, fontVariantNumeric: 'tabular-nums' }}>{yr}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{edad + yr}</span>
                        <span>
                          {isFire && <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: LGOLD }}>día de libertad</span>}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, textAlign: 'right', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{fmt(ahorro * 12 * yr)}</span>
                        <span style={{
                          textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                          fontFamily: isFire ? "'Bebas Neue', Impact, sans-serif" : 'monospace',
                          fontSize: isFire ? 22 : 12, letterSpacing: isFire ? '0.03em' : '0.01em',
                          color: isFire ? LGOLD : (val >= target ? C.green : C.text),
                        }}>{fmt(val)}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                          <span style={{ position: 'relative', width: 78, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 2, background: isFire ? LGOLD : STEEL }} />
                          </span>
                          <span style={{ fontFamily: 'monospace', width: 42, textAlign: 'right', fontSize: 11, color: isFire ? LGOLD : C.dimText, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
                        </span>
                      </div>
                    )
                    return els
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Retos FIRE ── */}
        <FireChallenges ahorro={ahorro} gasto={gasto} capital={capital} retorno={retorno} target={target} />

      </div>
    </div>
  )
}
