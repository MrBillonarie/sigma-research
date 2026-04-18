'use client'
import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'

const C = {
  bg:      '#04050a',
  surface: '#0b0d14',
  border:  '#1a1d2e',
  muted:   '#3a3f55',
  dimText: '#7a7f9a',
  text:    '#e8e9f0',
  gold:    '#d4af37',
  glow:    '#f0cc5a',
  green:   '#34d399',
  red:     '#f87171',
  yellow:  '#fbbf24',
} as const

// ─── IL formula (v3 concentrated liquidity) ──────────────────────────────────
// r = sqrt(P_final / P_initial) - 1
// IL = 2*sqrt(r+1)/(r+2) - 1
function calcIL(pFinal: number, pInitial: number): number {
  if (pInitial <= 0 || pFinal <= 0) return 0
  const r = Math.sqrt(pFinal / pInitial) - 1
  if (r + 2 === 0) return 0
  return 2 * Math.sqrt(r + 1) / (r + 2) - 1
}

// ─── Scenario builder ────────────────────────────────────────────────────────
type Scenario = { name: string; pct: number; lower: number; upper: number; amplitude: number; feeMonthly: number }

function buildScenarios(price: number, capital: number, apr: number): Scenario[] {
  const specs = [
    { name: 'Conservador', pct: 3 },
    { name: 'Balanceado',  pct: 7 },
    { name: 'Agresivo',   pct: 12 },
  ]
  return specs.map(s => {
    const half  = (s.pct / 2) / 100
    const lower = Math.round(price * (1 - half))
    const upper = Math.round(price * (1 + half))
    const amplitude = ((upper - lower) / price) * 100
    // Amplification factor for concentrated liquidity vs full range.
    // Simplified: fee boost ≈ sqrt(upper/lower) / (sqrt(upper/lower) - 1)
    const sqrtRatio = Math.sqrt(upper / lower)
    const boost = sqrtRatio > 1 ? sqrtRatio / (sqrtRatio - 1) : 1
    const feeMonthly = (capital * (apr / 100) * boost) / 12
    return { name: s.name, pct: s.pct, lower, upper, amplitude, feeMonthly }
  })
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function Label({ text }: { text: string }) {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 5 }}>
      {text}
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: C.surface, padding: '18px 20px', border: `1px solid ${C.border}` }}>
      <Label text={label} />
      <div style={{ fontFamily: "'Bebas Neue', var(--font-bebas), Impact, sans-serif", fontSize: 32, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, marginTop: 4 }}>
        {sub}
      </div>
    </div>
  )
}

function NumberInput({
  label, value, onChange, step, prefix,
}: {
  label: string; value: number; onChange: (v: number) => void; step?: number; prefix?: string
}) {
  return (
    <div>
      <Label text={label} />
      <div style={{ display: 'flex', alignItems: 'center', background: C.surface, border: `1px solid ${C.border}`, padding: '10px 14px', gap: 6 }}>
        {prefix && <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.muted }}>{prefix}</span>}
        <input
          type="number"
          value={value}
          step={step ?? 100}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            background: 'transparent', border: 'none', outline: 'none', color: C.text,
            fontFamily: 'monospace', fontSize: 14, fontVariantNumeric: 'tabular-nums', width: '100%',
          }}
        />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LpDefiPage() {
  const [price,   setPrice]   = useState(84_000)
  const [lower,   setLower]   = useState(81_000)
  const [upper,   setUpper]   = useState(87_000)
  const [capital, setCapital] = useState(500)
  const [pool,    setPool]    = useState('BTC/USDC')
  const [apr,     setApr]     = useState(35)
  const [adx,     setAdx]     = useState(18)

  // ── Derived calculations ───────────────────────────────────────────────────
  const calc = useMemo(() => {
    const amplitude = price > 0 ? ((upper - lower) / price) * 100 : 0

    // Amplification boost for concentrated liquidity range
    const sqrtRatio = (lower > 0 && upper > 0) ? Math.sqrt(upper / lower) : 1
    const boost = sqrtRatio > 1 ? sqrtRatio / (sqrtRatio - 1) : 1
    const annualFee  = capital * (apr / 100) * boost
    const feeDaily   = annualFee / 365
    const feeWeekly  = annualFee / 52
    const feeMonthly = annualFee / 12

    const ilLower = calcIL(lower, price)  // price drops to lower tick
    const ilUpper = calcIL(upper, price)  // price rises to upper tick
    const worstIL = Math.min(ilLower, ilUpper) // most negative

    // How many days of fees to cover the worst-case IL
    const ilAbs = Math.abs(worstIL) * capital
    const feeDailyIL = capital * (apr / 100) * boost / 365
    const feeCoverDays = (feeDailyIL > 0 && ilAbs > 0) ? ilAbs / feeDailyIL : Infinity

    // Range status
    let rangeStatus: 'valid' | 'narrow' | 'wide' = 'valid'
    if (amplitude < 3)  rangeStatus = 'narrow'
    if (amplitude > 15) rangeStatus = 'wide'

    return { amplitude, feeDaily, feeWeekly, feeMonthly, ilLower, ilUpper, worstIL, feeCoverDays, rangeStatus }
  }, [price, lower, upper, capital, apr])

  const scenarios = useMemo(() => buildScenarios(price, capital, apr), [price, capital, apr])

  // ── ADX regime ────────────────────────────────────────────────────────────
  const regime = useMemo(() => {
    if (adx < 15)  return { label: 'LATERAL TIGHT — Rango estrecho ±3–5%',  dot: C.green,  bg: 'rgba(52,211,153,0.08)'  }
    if (adx <= 20) return { label: 'LATERAL NORMAL — Rango medio ±7–10%',    dot: C.yellow, bg: 'rgba(251,191,36,0.08)'  }
    return             { label: 'TRENDING — No usar LP ahora',                dot: C.red,    bg: 'rgba(248,113,113,0.08)' }
  }, [adx])

  const rangeColors: Record<string, string> = {
    valid:  C.green,
    narrow: C.yellow,
    wide:   C.red,
  }
  const rangeLabels: Record<string, string> = {
    valid:  '✅ VÁLIDO',
    narrow: '⚠️ MUY ESTRECHO (<3%)',
    wide:   '⚠️ MUY AMPLIO (>15%)',
  }

  const fmt  = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtP = (v: number) => `${(v * 100).toFixed(2)}%`
  const fmtN = (v: number, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 24px 80px' }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
            {'// LP DEFI · PANCAKESWAP V3 · CALCULADOR DE RANGOS'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', var(--font-bebas), Impact, sans-serif", fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ color: C.text }}>LP</span>{' '}
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>DEFI</span>
          </h1>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginTop: 10 }}>
            Calcula fees estimadas, impermanent loss y rangos óptimos para posiciones concentradas.
          </div>
        </div>

        {/* ── Inputs grid ───────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 1, background: C.border, marginBottom: 1 }}>

          {/* Left column: price + ticks + capital */}
          <div style={{ background: C.surface, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>
              PARÁMETROS DEL RANGO
            </div>

            <NumberInput label="Precio actual" value={price} onChange={setPrice} step={100} prefix="$" />
            <NumberInput label="Order Block inferior / Lower Tick" value={lower} onChange={setLower} step={100} prefix="$" />
            <NumberInput label="Order Block superior / Upper Tick" value={upper} onChange={setUpper} step={100} prefix="$" />
            <NumberInput label="Capital a depositar (USD)" value={capital} onChange={setCapital} step={50} prefix="$" />
          </div>

          {/* Right column: pool + APR + ADX */}
          <div style={{ background: C.surface, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>
              CONFIGURACIÓN DE POOL
            </div>

            {/* Pool selector */}
            <div>
              <Label text="Pool" />
              <div style={{ display: 'flex', gap: 8 }}>
                {['BTC/USDC', 'BNB/USDC', 'USDT/USDC'].map(p => (
                  <button
                    key={p}
                    onClick={() => setPool(p)}
                    style={{
                      flex: 1, padding: '10px 8px', background: pool === p ? C.gold : C.surface,
                      border: `1px solid ${pool === p ? C.gold : C.border}`,
                      color: pool === p ? C.bg : C.dimText,
                      fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.1em',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* APR slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>
                  APR estimado del pool
                </span>
                <input
                  type="number"
                  value={apr}
                  min={5} max={150}
                  onChange={e => setApr(Math.min(150, Math.max(5, Number(e.target.value))))}
                  style={{
                    width: 56, background: 'transparent', border: `1px solid ${C.border}`,
                    color: C.gold, fontFamily: 'monospace', fontSize: 13, textAlign: 'right',
                    padding: '2px 6px', outline: 'none',
                  }}
                />
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.gold, marginLeft: 4 }}>%</span>
              </div>
              <input
                type="range"
                min={5} max={150} step={1} value={apr}
                onChange={e => setApr(Number(e.target.value))}
                style={{ width: '100%', accentColor: C.gold, cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 10, color: C.muted, marginTop: 2 }}>
                <span>5%</span><span>150%</span>
              </div>
            </div>

            {/* ADX input */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Label text="ADX actual (indicador de tendencia)" />
                <input
                  type="number"
                  value={adx}
                  min={0} max={100}
                  onChange={e => setAdx(Math.min(100, Math.max(0, Number(e.target.value))))}
                  style={{
                    width: 56, background: 'transparent', border: `1px solid ${C.border}`,
                    color: C.gold, fontFamily: 'monospace', fontSize: 13, textAlign: 'right',
                    padding: '2px 6px', outline: 'none',
                  }}
                />
              </div>
              <input
                type="range"
                min={0} max={60} step={1} value={adx}
                onChange={e => setAdx(Number(e.target.value))}
                style={{ width: '100%', accentColor: C.gold, cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 10, color: C.muted, marginTop: 2 }}>
                <span>0</span><span>60+</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Status badges ─────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1, background: C.border, marginBottom: 1 }}>
          {/* Range status */}
          <div style={{ background: C.surface, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 6 }}>
                ESTADO DEL RANGO
              </div>
              <div style={{
                fontFamily: 'monospace', fontSize: 13, fontWeight: 600,
                color: rangeColors[calc.rangeStatus], letterSpacing: '0.05em',
              }}>
                {rangeLabels[calc.rangeStatus]}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginTop: 4 }}>
                Amplitud: <span style={{ color: C.gold }}>{fmtN(calc.amplitude)}%</span>
              </div>
            </div>
          </div>

          {/* ADX regime */}
          <div style={{ background: regime.bg, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${regime.dot}22` }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: regime.dot, flexShrink: 0, boxShadow: `0 0 8px ${regime.dot}` }} />
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 6 }}>
                RÉGIMEN ADX · {adx}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: regime.dot, fontWeight: 600 }}>
                {regime.label}
              </div>
            </div>
          </div>
        </div>

        {/* ── Output stat cards ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: C.border, marginBottom: 1 }}>
          <StatCard label="Fee diaria estimada"   value={fmt(calc.feeDaily)}    sub={`Pool: ${pool}`}       color={C.gold}  />
          <StatCard label="Fee semanal estimada"  value={fmt(calc.feeWeekly)}   sub="7 días"               color={C.gold}  />
          <StatCard label="Fee mensual estimada"  value={fmt(calc.feeMonthly)}  sub="30 días"              color={C.glow}  />
          <StatCard label="APR efectivo"          value={`${fmtN(apr)}%`}       sub="APR base configurado" color={C.gold}  />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: C.border, marginBottom: 1 }}>
          <StatCard
            label="IL si precio toca lower"
            value={`${fmtN(calc.ilLower * 100)}%`}
            sub={`Precio: $${lower.toLocaleString('en-US')}`}
            color={calc.ilLower < -0.01 ? C.red : C.green}
          />
          <StatCard
            label="IL si precio toca upper"
            value={`${fmtN(calc.ilUpper * 100)}%`}
            sub={`Precio: $${upper.toLocaleString('en-US')}`}
            color={calc.ilUpper < -0.01 ? C.red : C.dimText}
          />
          <StatCard
            label="IL máximo en USD"
            value={fmt(Math.abs(calc.worstIL) * capital)}
            sub="Peor escenario"
            color={C.red}
          />
          <StatCard
            label="Días fees para cubrir IL"
            value={isFinite(calc.feeCoverDays) ? fmtN(calc.feeCoverDays, 1) : '—'}
            sub="Ratio Fee / IL"
            color={calc.feeCoverDays < 30 ? C.green : calc.feeCoverDays < 90 ? C.yellow : C.red}
          />
        </div>

        {/* ── Reference scenarios table ─────────────────────────────────────── */}
        <div style={{ background: C.surface, marginBottom: 1 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>
              ESCENARIOS DE REFERENCIA · PRECIO ACTUAL ${price.toLocaleString('en-US')}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Escenario', 'Amplitud %', 'Lower Tick', 'Upper Tick', 'Fee mensual', 'IL lower', 'IL upper'].map(h => (
                    <th key={h} style={{ padding: '10px 18px', textAlign: 'left', color: C.dimText, fontWeight: 400, letterSpacing: '0.15em', fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s, i) => {
                  const scIlLower = calcIL(s.lower, price)
                  const scIlUpper = calcIL(s.upper, price)
                  const rowColors = [C.green, C.yellow, C.red]
                  return (
                    <tr key={s.name} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : `rgba(212,175,55,0.02)` }}>
                      <td style={{ padding: '13px 18px' }}>
                        <span style={{ color: rowColors[i], fontWeight: 600 }}>{s.name}</span>
                        <span style={{ color: C.muted, marginLeft: 8 }}>±{s.pct / 2}%</span>
                      </td>
                      <td style={{ padding: '13px 18px', color: C.gold, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtN(s.amplitude)}%
                      </td>
                      <td style={{ padding: '13px 18px', color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                        ${s.lower.toLocaleString('en-US')}
                      </td>
                      <td style={{ padding: '13px 18px', color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                        ${s.upper.toLocaleString('en-US')}
                      </td>
                      <td style={{ padding: '13px 18px', color: C.glow, fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(s.feeMonthly)}
                      </td>
                      <td style={{ padding: '13px 18px', color: scIlLower < -0.005 ? C.red : C.green, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtN(scIlLower * 100)}%
                      </td>
                      <td style={{ padding: '13px 18px', color: scIlUpper < -0.005 ? C.red : C.dimText, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtN(scIlUpper * 100)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer note ───────────────────────────────────────────────────── */}
        <div style={{ padding: '16px 0', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, letterSpacing: '0.1em' }}>
            Fees estimadas con boost de liquidez concentrada. IL calculado con fórmula v3 estándar.
          </span>
          <Link href="/" style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, textDecoration: 'none' }}>
            ← VOLVER AL INICIO
          </Link>
        </div>

      </div>
    </div>
  )
}
