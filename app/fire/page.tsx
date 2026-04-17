'use client'
import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import SiteNav from '../components/SiteNav'

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
const MODES = [
  {
    id: 'lean',
    name: 'LEAN FIRE',
    color: '#f59e0b',
    description: 'Independencia financiera con estilo de vida frugal. Mínimo suficiente para cubrir necesidades básicas con margen.',
    defaultGasto: 1200,
    icon: '⚡',
  },
  {
    id: 'barista',
    name: 'BARISTA FIRE',
    color: '#34d399',
    description: 'Semi-retiro. El portafolio cubre la mayoría de gastos, complementado con trabajo part-time o pasiones.',
    defaultGasto: 2500,
    icon: '☕',
  },
  {
    id: 'fat',
    name: 'FAT FIRE',
    color: '#d4af37',
    description: 'Retiro completo con alto estándar de vida. Lujo, viajes frecuentes y sin restricciones financieras.',
    defaultGasto: 6000,
    icon: '🏆',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const fmtK = (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1e3).toFixed(1)}K`

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
  const [mode,    setMode]    = useState(1)   // 0=Lean 1=Barista 2=Fat
  const [capital, setCapital] = useState(80_000)
  const [ahorro,  setAhorro]  = useState(1_500)
  const [retorno, setRetorno] = useState(8)
  const [edad,    setEdad]    = useState(29)
  const [gasto,   setGasto]   = useState(MODES[1].defaultGasto)

  const m = MODES[mode]

  const { data, target, fireYear } = useMemo(
    () => project(capital, ahorro, retorno, gasto),
    [capital, ahorro, retorno, gasto]
  )

  const years = data.length - 1
  const labels = Array.from({ length: years + 1 }, (_, i) => String(i))
  const progress = Math.min((capital / target) * 100, 100)
  const edadFire = fireYear !== null ? edad + fireYear : null
  const capitalFinal = data[data.length - 1]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <SiteNav />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 64px' }}>

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

        {/* Mode selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: C.border, marginBottom: 1 }}>
          {MODES.map((md, i) => (
            <button key={md.id} onClick={() => { setMode(i); setGasto(md.defaultGasto) }} style={{
              padding: '18px 20px', textAlign: 'left', border: 'none', cursor: 'pointer',
              background: mode === i ? C.surface : C.bg,
              borderBottom: mode === i ? `2px solid ${md.color}` : '2px solid transparent',
              transition: 'background 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{md.icon}</span>
                <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 24, color: mode === i ? md.color : C.text }}>{md.name}</span>
              </div>
              <p style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, margin: 0, lineHeight: 1.6 }}>{md.description}</p>
            </button>
          ))}
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 1, background: C.border }}>

          {/* Controls */}
          <div style={{ background: C.surface, padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: m.color }}>
              {m.name}
            </div>
            <Slider label="Capital actual"    value={capital} min={0}      max={1_000_000} step={5_000}  display={fmt(capital)}          onChange={setCapital} />
            <Slider label="Ahorro mensual"     value={ahorro}  min={0}      max={15_000}    step={100}    display={fmt(ahorro)}            onChange={setAhorro} />
            <Slider label="Gasto mensual FIRE" value={gasto}   min={500}    max={15_000}    step={100}    display={fmt(gasto)}             onChange={setGasto} />
            <Slider label="Retorno anual est." value={retorno} min={1}      max={20}        step={0.5}    display={`${retorno}%`}          onChange={setRetorno} />
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
          <div style={{ background: C.bg, display: 'flex', flexDirection: 'column' }}>

            {/* Big result */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: C.border, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ background: C.surface, padding: '22px 22px' }}>
                <Label text="Años para FIRE" />
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 56, lineHeight: 0.9, background: `linear-gradient(135deg,${C.gold},${C.glow})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {fireYear !== null ? fireYear : '50+'}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginTop: 6 }}>
                  {edadFire ? `Edad: ${edadFire} años` : 'Aumenta ahorro / retorno'}
                </div>
              </div>
              <div style={{ background: C.surface, padding: '22px 22px' }}>
                <Label text="Capital objetivo" />
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, color: C.gold, lineHeight: 1 }}>
                  {fmtK(target)}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginTop: 6 }}>25× gastos anuales</div>
              </div>
              <div style={{ background: C.surface, padding: '22px 22px' }}>
                <Label text={`Capital en año ${Math.min(years, 50)}`} />
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, color: capitalFinal >= target ? C.green : C.yellow, lineHeight: 1 }}>
                  {fmtK(capitalFinal)}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginTop: 6 }}>
                  {capitalFinal >= target ? '✓ Objetivo alcanzado' : `Falta ${fmtK(target - capitalFinal)}`}
                </div>
              </div>
            </div>

            {/* Progress */}
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>PROGRESO ACTUAL</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: m.color }}>{progress.toFixed(1)}%</span>
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.glow})`, transition: 'width 0.5s', borderRadius: 3 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 10, color: C.muted, marginTop: 4 }}>
                <span>{fmt(capital)}</span><span>Meta: {fmtK(target)}</span>
              </div>
            </div>

            {/* Chart */}
            <div style={{ borderBottom: `1px solid ${C.border}` }}>
              <div style={{ padding: '10px 18px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>PROYECCIÓN DE CAPITAL · RETORNO {retorno}% ANUAL</span>
              </div>
              <FireChart labels={labels} acum={data} target={target} fireYear={fireYear} />
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

      </div>
    </div>
  )
}
