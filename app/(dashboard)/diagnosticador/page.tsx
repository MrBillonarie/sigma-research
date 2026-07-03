'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/app/lib/supabase'
import { C, F, cardStyle, heroCardStyle, numberEmboss } from '@/app/lib/constants'
import {
  calcRisk, scenarioReturn, cellColor, cellTextColor, fmtUSD,
  WIN_RATES, RR_VALUES,
} from './logic'

// ── Sub-components ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.gold, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
      {'// '}{children}
    </div>
  )
}

function CalcRow({ label, value, sub, color = C.text }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: `1px solid ${C.border}20` }}>
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, flex: 1 }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, color, letterSpacing: '0.04em' }}>{value}</span>
        {sub && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, marginLeft: 6 }}>{sub}</span>}
      </div>
    </div>
  )
}

function NumberInput({
  label, value, onChange, suffix = '', step = 0.1, min = 0, disabled = false
}: {
  label: string; value: number; onChange: (v: number) => void
  suffix?: string; step?: number; min?: number; disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>{label}</span>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="number" step={step} min={min}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className="diag-input"
          style={{
            background: disabled ? C.surface : C.bg, border: `1px solid ${C.border}`, outline: 'none', borderRadius: C.radiusSm,
            color: disabled ? C.muted : C.text, fontFamily: 'monospace', fontSize: 13, padding: '8px 12px',
            fontVariantNumeric: 'tabular-nums', width: '100%', cursor: disabled ? 'not-allowed' : 'text',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
        {suffix && (
          <span style={{ position: 'absolute', right: 10, fontFamily: 'monospace', fontSize: 12, color: C.muted, pointerEvents: 'none' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Tooltip component ────────────────────────────────────────────────────────
function CellTooltip({ content }: { content: string }) {
  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
      transform: 'translateX(-50%)', zIndex: 50,
      background: '#1a1d2e', border: `1px solid ${C.gold}60`,
      padding: '6px 10px', whiteSpace: 'nowrap',
      fontFamily: 'monospace', fontSize: 10, color: C.text,
      pointerEvents: 'none', lineHeight: 1.5,
    }}>
      {content}
    </div>
  )
}

// ── Marco de esquinas técnicas — reemplaza la caja cerrada por 4 marcas en L,
// como un visor de instrumento. Firma de los paneles de diagnóstico real
// (hero, vitals, matriz); el resto de la página NO usa cajas. ────────────────
function BracketFrame({
  accent, background, padding = '24px', radius = 3, armLen = 18, stroke = 2, style, children,
}: {
  accent: string; background?: string; padding?: string; radius?: number; armLen?: number; stroke?: number
  style?: React.CSSProperties; children: React.ReactNode
}) {
  const corner = (top: boolean, left: boolean): React.CSSProperties => ({
    position: 'absolute',
    width: armLen, height: armLen,
    ...(top ? { top: -stroke } : { bottom: -stroke }),
    ...(left ? { left: -stroke } : { right: -stroke }),
    borderTop:    top  ? `${stroke}px solid ${accent}` : 'none',
    borderBottom: !top ? `${stroke}px solid ${accent}` : 'none',
    borderLeft:   left ? `${stroke}px solid ${accent}` : 'none',
    borderRight:  !left ? `${stroke}px solid ${accent}` : 'none',
  })
  return (
    <div style={{ position: 'relative', background: background ?? C.surface, borderRadius: radius, boxShadow: C.shadowCard, padding, ...style }}>
      <div style={corner(true, true)} />
      <div style={corner(true, false)} />
      <div style={corner(false, true)} />
      <div style={corner(false, false)} />
      {children}
    </div>
  )
}

// ── Gauge cluster — "panel de signos vitales", agrupado en un solo
// instrumento en vez de métricas sueltas flotando por la página. ─────────────

// Llenado animado 0→valor (ease-out cúbico) al montar — instrumento encendiéndose
function useGaugeAnim(target: number, delay = 300): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0  = performance.now() + delay
    const dur = 1200
    const tick = (now: number) => {
      const p = Math.min(Math.max((now - t0) / dur, 0), 1)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, delay])
  return v
}

function RiskGauge({ value, color, size = 84, label }: { value: number; color: string; size?: number; label?: string }) {
  const stroke = 8
  const r = size / 2 - stroke
  const circumference = 2 * Math.PI * r
  const clamped = Math.min(Math.max(value, 0), 100)
  const anim    = useGaugeAnim(clamped)
  const offset  = circumference * (1 - anim / 100)

  // El número acompaña el llenado: si hay label numérico ("2.5%") cuenta su
  // parte numérica; si no, cuenta el porcentaje del gauge
  const labelNum = label ? parseFloat(label) : NaN
  const suffix   = label ? label.replace(/[0-9.\-]/g, '') : '%'
  const ratio    = clamped > 0 ? anim / clamped : 1
  const shown    = label
    ? (isNaN(labelNum) ? label : `${(labelNum * ratio).toFixed(labelNum % 1 !== 0 ? 1 : 0)}${suffix}`)
    : `${Math.round(anim)}%`

  // Ticks de escala tipo instrumento de aviación (12 marcas)
  const c = size / 2
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a  = (i / 12) * Math.PI * 2
    const r1 = r + stroke / 2 + 1.5
    const r2 = r1 + 3
    return {
      x1: c + Math.cos(a) * r1, y1: c + Math.sin(a) * r1,
      x2: c + Math.cos(a) * r2, y2: c + Math.sin(a) * r2,
    }
  })

  return (
    <div style={{ position: 'relative', width: size + 10, height: size + 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size + 10} height={size + 10} viewBox={`-5 -5 ${size + 10} ${size + 10}`} style={{ transform: 'rotate(-90deg)' }}>
        {ticks.map((tk, i) => (
          <line key={i} x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2} stroke={C.border} strokeWidth={1.2} />
        ))}
        <circle cx={c} cy={c} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
        <circle
          cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${color}90)` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: F.display, fontSize: size * 0.22, color, lineHeight: 1, textShadow: numberEmboss, fontVariantNumeric: 'tabular-nums' }}>
          {shown}
        </span>
      </div>
    </div>
  )
}

// ── ECG del trader — el pulso del diagnóstico ─────────────────────────────────
// Un trazo de electrocardiograma recorrido por un pulso brillante. Ritmo y
// amplitud reflejan el estado: estable si APTO, agitado si el win rate está
// por debajo del mínimo.
function ECGLine({ color, agitated, speed }: { color: string; agitated: boolean; speed: number }) {
  const beat = agitated
    ? 'l6,0 l3,-5 l3,5 l4,0 l3,-22 l4,34 l3,-12 l5,0 l4,6 l4,-6 l81,0'
    : 'l10,0 l4,-4 l4,4 l6,0 l4,-16 l5,26 l4,-10 l8,0 l5,4 l5,-4 l65,0'
  const d = 'M0,26 ' + Array(5).fill(beat).join(' ')
  return (
    <svg viewBox="0 0 600 40" preserveAspectRatio="none" style={{ width: '100%', height: 34, display: 'block' }} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeOpacity="0.16" strokeWidth="1.2" />
      <path
        d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round"
        style={{
          strokeDasharray: '90 1400',
          animation: `ecgTravel ${speed}s linear infinite`,
          filter: `drop-shadow(0 0 4px ${color})`,
        }}
      />
    </svg>
  )
}

function GaugeStat({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {children}
      <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.dimText, textAlign: 'center', maxWidth: 100 }}>
        {title}
      </span>
    </div>
  )
}

function VitalsPanel({ minWinRate, minWinColor, riskPerOp, riskPortfolio, ecgColor, ecgAgitated, ecgSpeed }: {
  minWinRate: number; minWinColor: string; riskPerOp: number; riskPortfolio: number
  ecgColor: string; ecgAgitated: boolean; ecgSpeed: number
}) {
  return (
    <BracketFrame accent={C.violet} padding="20px 22px">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.violet }}>
          {'◈ PANEL DE SIGNOS VITALES'}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.2em', color: ecgColor }}>
          ● PULSO
        </span>
      </div>
      {/* ECG del trader — el pulso de tu diagnóstico */}
      <div style={{ marginBottom: 14, borderBottom: `1px solid ${C.border}40`, paddingBottom: 6 }}>
        <ECGLine color={ecgColor} agitated={ecgAgitated} speed={ecgSpeed} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', gap: 12, flexWrap: 'wrap' }}>
        <GaugeStat title="WR mínimo rentable">
          <RiskGauge value={minWinRate} color={minWinColor} />
        </GaugeStat>
        <GaugeStat title="Riesgo / operación">
          <RiskGauge value={Math.min((riskPerOp / 10) * 100, 100)} color={C.violet} label={`${riskPerOp}%`} />
        </GaugeStat>
        <GaugeStat title="Riesgo de cartera">
          <RiskGauge value={Math.min((riskPortfolio / 10) * 100, 100)} color={C.violet} label={`${riskPortfolio}%`} />
        </GaugeStat>
      </div>
    </BracketFrame>
  )
}

// ── Barra de diagnóstico — espectro continuo rojo→ámbar→verde con una aguja
// marcando exactamente dónde está el win rate real respecto al mínimo. ───────
function DiagnosisSpectrum({ current, breakeven, hasData, scanned }: { current: number; breakeven: number; hasData: boolean; scanned: boolean }) {
  const pos = (v: number) => Math.min(Math.max(v, 0), 100)
  const curPct = pos(current)
  const bePct = pos(breakeven)
  const gap = current - breakeven

  const verdict = !hasData ? 'SIN DATOS' : gap >= 10 ? 'APTO' : gap >= 0 ? 'AJUSTADO' : gap >= -10 ? 'EN RIESGO' : 'CRÍTICO'
  const verdictColor = !hasData ? C.violet : gap >= 10 ? C.green : gap >= 0 ? C.gold : gap >= -10 ? C.amber : C.red
  const symbol = !hasData ? '–' : gap >= 0 ? '✓' : gap >= -10 ? '⚠' : '✕'

  // Secuencia de escaneo: la línea barre el panel (0.1s–1.25s), la aguja viaja
  // hasta tu posición (0.7s–2.2s), el veredicto aparece (1.5s) y el sello se
  // estampa con burst al final (1.9s)
  const needleTransition = 'left 1.5s cubic-bezier(0.22,1,0.36,1) 0.7s'

  return (
    <div>
      {/* Línea de escaneo — barre el panel una sola vez al cargar */}
      {scanned && (
        <div style={{
          position: 'absolute', left: 6, right: 6, top: 0, height: 2, borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`,
          boxShadow: `0 0 14px ${C.gold}`, opacity: 0, pointerEvents: 'none',
          animation: 'diagScan 1.15s ease-in-out 0.1s forwards',
        }} />
      )}

      {/* Burst del sello — anillo que explota al estamparse */}
      {scanned && (
        <div style={{
          position: 'absolute', top: -42, left: '50%', width: 84, height: 84,
          borderRadius: '50%', border: `2px solid ${verdictColor}`, pointerEvents: 'none',
          opacity: 0, animation: 'sealBurst 0.7s ease-out 2.05s both',
        }} />
      )}

      {/* Sello — se estampa al final de la secuencia, como un timbre */}
      <div style={{
        position: 'absolute', top: -42, left: '50%', transform: 'translateX(-50%)',
        width: 84, height: 84, borderRadius: '50%', background: C.bg,
        border: `3px solid ${verdictColor}`, boxShadow: `0 0 18px ${verdictColor}80, 0 4px 10px rgba(0,0,0,0.5)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 30, fontWeight: 700, color: verdictColor,
        animation: scanned ? 'sealStamp 0.55s cubic-bezier(0.34,1.56,0.64,1) 1.9s both' : 'none',
      }}>
        {symbol}
      </div>

      <div style={{
        textAlign: 'center', marginBottom: 24,
        opacity: scanned ? 1 : 0, transform: scanned ? 'none' : 'translateY(6px)',
        transition: 'opacity 0.6s ease 1.5s, transform 0.6s ease 1.5s',
      }}>
        <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.dimText, marginBottom: 8 }}>
          {'// DIAGNÓSTICO'}
        </div>
        <div style={{ fontFamily: F.display, fontSize: 'clamp(30px,4vw,46px)', color: verdictColor, lineHeight: 1, letterSpacing: '0.03em', textShadow: numberEmboss }}>
          {verdict}
        </div>
        {hasData && (
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: gap >= 0 ? C.green : C.red, marginTop: 8 }}>
            Win rate actual vs. mínimo: {gap >= 0 ? '+' : ''}{gap.toFixed(1)}pp
          </div>
        )}
      </div>

      <div style={{ position: 'relative', height: 12, borderRadius: 6, marginTop: 26, marginBottom: hasData ? 30 : 8,
        background: `linear-gradient(90deg, ${C.red} 0%, ${C.red} 22%, ${C.amber} 42%, ${C.green} 68%, ${C.green} 100%)`,
        boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.45)' }}>

        {/* breakeven tick — el mínimo requerido, siempre visible */}
        <div style={{ position: 'absolute', top: -5, bottom: -5, left: `${bePct}%`, width: 2, background: C.text, opacity: scanned ? 0.75 : 0, transition: 'opacity 0.4s ease 0.5s' }} />
        <div style={{ position: 'absolute', top: -22, left: `${bePct}%`, transform: 'translateX(-50%)', fontFamily: 'monospace', fontSize: 9, color: C.textDim, whiteSpace: 'nowrap', opacity: scanned ? 1 : 0, transition: 'opacity 0.4s ease 0.5s' }}>
          mín. {breakeven.toFixed(0)}%
        </div>

        {/* tu posición — la aguja viaja hasta tu win rate real */}
        {hasData && (
          <>
            <div style={{
              position: 'absolute', top: '50%', left: scanned ? `${curPct}%` : '0%', transform: 'translate(-50%,-50%)',
              width: 18, height: 18, borderRadius: '50%', background: C.bg,
              border: `3px solid ${verdictColor}`, boxShadow: `0 0 12px ${verdictColor}90`,
              transition: needleTransition,
            }} />
            <div style={{
              position: 'absolute', top: 20, left: scanned ? `${curPct}%` : '0%', transform: 'translateX(-50%)',
              fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: verdictColor, whiteSpace: 'nowrap',
              transition: needleTransition, opacity: scanned ? 1 : 0,
            }}>
              {current.toFixed(0)}% actual
            </div>
          </>
        )}
      </div>

      {!hasData && (
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, marginTop: 8 }}>
          Registra operaciones en tu Journal para ver tu diagnóstico real frente al mínimo requerido.
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function DiagnosticadorPage() {
  // ── Data source state ──────────────────────────────────────────────────────
  const [autoMode,  setAutoMode]  = useState(true)
  const [loading,   setLoading]   = useState(true)
  const [hasRealData, setHasRealData] = useState(false)

  // ── Portfolio & journal stats from DB ─────────────────────────────────────
  const [dbPatrimonio, setDbPatrimonio] = useState(0)
  const [dbWinRate,    setDbWinRate]    = useState(0)    // 0–100
  const [dbRR,         setDbRR]         = useState(0)
  const [dbTotalOps,   setDbTotalOps]   = useState(0)

  // ── Module 1 inputs ────────────────────────────────────────────────────────
  const [patrimonio,    setPatrimonio]    = useState(10_000)
  const [rr,            setRr]            = useState(3.0)
  const [riskPerOp,     setRiskPerOp]     = useState(2.0)
  const [riskPortfolio, setRiskPortfolio] = useState(2.0)

  // ── Module 2 inputs ────────────────────────────────────────────────────────
  const [opsPerDay,    setOpsPerDay]    = useState(1)
  const [daysPerMonth, setDaysPerMonth] = useState(20)

  // ── Tooltip state ─────────────────────────────────────────────────────────
  const [tooltip, setTooltip] = useState<{ row: number; col: number; content: string } | null>(null)

  // ── Secuencia de escaneo — arranca cuando terminan de cargar los datos ────
  const [scanned, setScanned] = useState(false)
  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => setScanned(true), 150)
    return () => clearTimeout(t)
  }, [loading])

  // ── Load data from Supabase ────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const TRADING_PLATFORMS = ['ibkr', 'binance_spot', 'binance_futures']

        const [portResult, tradesResult] = await Promise.all([
          supabase.from('portfolio').select('*').eq('user_id', user.id).single(),
          supabase.from('trades').select('pnl_usd, resultado, sl, tp, entry_price, lado').eq('user_id', user.id),
        ])

        let totalTrading = 0
        if (portResult.data) {
          TRADING_PLATFORMS.forEach(k => { totalTrading += (portResult.data[k] ?? 0) })
        }

        interface Trade { resultado: string; pnl_usd: number; sl: number | null; tp: number | null; entry_price: number | null }
        let winRate = 0, avgRR = 0, totalCount = 0
        if (tradesResult.data && tradesResult.data.length > 0) {
          const trades = tradesResult.data as Trade[]
          totalCount   = trades.length
          const wins   = trades.filter((t) => t.resultado === 'WIN')
          const losses = trades.filter((t) => t.resultado === 'LOSS')
          // Denominador = solo trades decisivos (WIN+LOSS), no totalCount —
          // antes los BREAKEVEN contaban en el denominador pero no en el
          // numerador, sesgando el win rate hacia abajo y pudiendo marcar
          // "EN RIESGO" a alguien que en realidad no pierde plata en esos.
          const decisive = wins.length + losses.length
          winRate      = decisive > 0 ? Math.round((wins.length / decisive) * 100) : 0

          const rrFromSetup = trades
            .filter((t) => t.sl && t.tp && t.entry_price)
            .map((t) => {
              const ep = t.entry_price!
              const risk   = Math.abs(ep - t.sl!)
              const reward = Math.abs(t.tp! - ep)
              return risk > 0 ? reward / risk : 0
            })
            .filter((v) => v > 0)

          if (rrFromSetup.length > 0) {
            avgRR = rrFromSetup.reduce((a, b) => a + b, 0) / rrFromSetup.length
          } else if (wins.length > 0 && losses.length > 0) {
            const avgWin  = wins.reduce((a, t)   => a + Math.abs(t.pnl_usd), 0) / wins.length
            const avgLoss = losses.reduce((a, t) => a + Math.abs(t.pnl_usd), 0) / losses.length
            avgRR = avgLoss > 0 ? avgWin / avgLoss : 0
          }
        }

        const hasData = totalTrading > 0 || totalCount > 0
        setHasRealData(hasData)
        setDbPatrimonio(totalTrading)
        setDbWinRate(winRate)
        setDbRR(parseFloat(avgRR.toFixed(2)))
        setDbTotalOps(totalCount)

        if (hasData) {
          if (totalTrading > 0)  setPatrimonio(totalTrading)
          if (avgRR > 0)         setRr(parseFloat(avgRR.toFixed(2)))
        }
      } catch {
        // Supabase unavailable or auth error — page works in manual mode
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Sync inputs when toggling auto/manual ─────────────────────────────────
  useEffect(() => {
    if (autoMode && hasRealData) {
      if (dbPatrimonio > 0) setPatrimonio(dbPatrimonio)
      if (dbRR > 0)         setRr(dbRR)
    }
  }, [autoMode, hasRealData, dbPatrimonio, dbRR])

  // ── Derived calculations ───────────────────────────────────────────────────
  const calcs = useMemo(() => calcRisk({ patrimonio, rr, riskPerOp, riskPortfolio }), [patrimonio, rr, riskPerOp, riskPortfolio])
  const totalOps = opsPerDay * daysPerMonth

  // User's current position in table
  const userWinRow = Math.round(dbWinRate / 5) * 5  // nearest 5%
  const userRRCol  = Math.round(rr * 2) / 2          // nearest 0.5

  // ── Table data ─────────────────────────────────────────────────────────────
  const tableData = useMemo(() =>
    WIN_RATES.map(wr =>
      RR_VALUES.map(r => scenarioReturn(wr / 100, r, totalOps, riskPerOp))
    ),
    [totalOps, riskPerOp]
  )

  // Frontera de rentabilidad — primera columna (de izquierda a derecha) donde
  // cada fila cruza de pérdida a ganancia. Dibuja el "litoral" de la matriz.
  const breakEvenCol = useMemo(() =>
    tableData.map(row => row.findIndex(v => v >= 0)),
    [tableData]
  )

  // ── Monthly summary for current config ───────────────────────────────────
  const monthlySummary = useMemo(() => {
    const wr = dbWinRate > 0 ? dbWinRate / 100 : 0.5
    const pct    = scenarioReturn(wr, rr, totalOps, riskPerOp)
    const pctMin = scenarioReturn(calcs.minWinRate / 100, rr, totalOps, riskPerOp)
    const pctOpt = scenarioReturn(Math.min((wr * 100 + 10) / 100, 1), rr, totalOps, riskPerOp)
    return {
      pct,
      usd:    (pct    / 100) * patrimonio,
      pctMin,
      usdMin: (pctMin / 100) * patrimonio,
      pctOpt,
      usdOpt: (pctOpt / 100) * patrimonio,
    }
  }, [dbWinRate, rr, totalOps, riskPerOp, calcs.minWinRate, patrimonio])

  // ── Estado del pulso (ECG) — mismo criterio del veredicto ─────────────────
  const diagGap  = dbWinRate - calcs.minWinRate
  const hasDiag  = hasRealData && dbWinRate > 0
  const diagColor = !hasDiag ? C.violet : diagGap >= 10 ? C.green : diagGap >= 0 ? C.gold : diagGap >= -10 ? C.amber : C.red
  const ecgAgitated = hasDiag && diagGap < 0
  const ecgSpeed = !hasDiag ? 5 : diagGap >= 10 ? 4.2 : diagGap >= 0 ? 3.4 : diagGap >= -10 ? 2.6 : 1.9

  const reportDate = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })

  // ── PDF export ─────────────────────────────────────────────────────────────
  function handleExportPDF() {
    const wr       = dbWinRate > 0 ? dbWinRate : 50
    const wrOpt    = Math.min(wr + 10, 100)
    const wrMin    = calcs.minWinRate

    const sign = (v: number) => v >= 0 ? `+${v.toFixed(2)}%` : `${v.toFixed(2)}%`
    const usdSign = (v: number) => `${v >= 0 ? '+' : '−'}${fmtUSD(Math.abs(v))}`

    const row = (label: string, val: string, cls = '') =>
      `<tr><td>${label}</td><td class="r ${cls}">${val}</td></tr>`

    const scenRow = (label: string, w: number, pct: number, usd: number) =>
      `<tr>
        <td>${label}</td>
        <td class="r">${w.toFixed(0)}%</td>
        <td class="r ${pct >= 0 ? 'g' : 'rd'}">${sign(pct)}</td>
        <td class="r ${pct >= 0 ? 'g' : 'rd'}">${usdSign(usd)}</td>
      </tr>`

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Sigma Diagnosticador — ${reportDate}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #111; background: #fff; padding: 40px 48px; max-width: 860px; margin: 0 auto; }

  .header { border-bottom: 3px solid #111; padding-bottom: 14px; margin-bottom: 28px; }
  .logo { font-size: 10px; letter-spacing: .3em; text-transform: uppercase; color: #888; margin-bottom: 6px; }
  .title { font-size: 30px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 3px; }
  .subtitle { font-size: 10px; color: #666; }

  .section { font-size: 10px; letter-spacing: .22em; text-transform: uppercase; color: #333; background: #f2f2f2; padding: 5px 10px; margin: 22px 0 0; border-left: 3px solid #111; }

  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 10px; border-bottom: 1px solid #e4e4e4; font-size: 11px; }
  th { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #666; font-weight: normal; background: #fafafa; }
  tr.bold td { font-weight: 700; background: #f8f8f8; }
  .r  { text-align: right; }
  .g  { color: #14532d; font-weight: 700; }
  .rd { color: #7f1d1d; font-weight: 700; }

  .summary-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; background: #ddd; margin-top: 22px; }
  .summary-card { background: #fff; padding: 16px 18px; }
  .sc-label { font-size: 10px; letter-spacing: .15em; text-transform: uppercase; color: #888; margin-bottom: 4px; }
  .sc-sub   { font-size: 9px; color: #aaa; margin-bottom: 10px; }
  .sc-pct   { font-size: 32px; font-weight: 900; line-height: 1; margin-bottom: 4px; }
  .sc-usd   { font-size: 13px; font-weight: 600; }
  .pos  { color: #14532d; }
  .neg  { color: #7f1d1d; }
  .neu  { color: #92400e; }

  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 9px; color: #aaa; line-height: 1.6; }
  @page { margin: 18mm; size: A4 portrait; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>

<div class="header">
  <div class="logo">SQuant Desk · Inteligencia Cuantitativa</div>
  <div class="title">Diagnóstico de Trading</div>
  <div class="subtitle">Generado el ${reportDate} · ${autoMode ? 'Datos automáticos desde portafolio' : 'Datos ingresados manualmente'}</div>
</div>

<div class="section">Parámetros configurados</div>
<table>
  <tbody>
    ${row('Patrimonio en trading', fmtUSD(patrimonio))}
    ${row('Relación Retorno / Riesgo (RR)', rr.toFixed(1))}
    ${row('Riesgo por operación', riskPerOp + '%')}
    ${row('Riesgo de cartera', riskPortfolio + '%')}
    ${row('Operaciones por día', opsPerDay.toString())}
    ${row('Días operados al mes', daysPerMonth.toString())}
    ${row('Total operaciones al mes', totalOps.toString(), 'bold')}
  </tbody>
</table>

<div class="section">Gestión de riesgo por operación</div>
<table>
  <tbody>
    ${row('Retorno objetivo por operación', fmtUSD(calcs.retornoPorOp), 'g')}
    ${row('Riesgo máximo por operación', fmtUSD(calcs.riesgoPerOp), 'rd')}
    ${row('Máx. operaciones simultáneas', calcs.maxSimultaneous + ' ops')}
    ${row('Riesgo total de cartera', fmtUSD(calcs.riesgoCartera), 'rd')}
    ${row('Patrimonio total rec. mínimo (20% en trading)', fmtUSD(calcs.patrimonioMinRec))}
    ${row('Patrimonio total rec. máximo (10% en trading)', fmtUSD(calcs.patrimonioMaxRec))}
    ${row('Win rate mínimo para ser rentable', calcs.minWinRate.toFixed(1) + '%')}
  </tbody>
</table>

${hasRealData && dbWinRate > 0 ? `
<div class="section">Mi posición histórica (Journal)</div>
<table>
  <tbody>
    ${row('Win rate histórico', dbWinRate + '%', dbWinRate > calcs.minWinRate ? 'g' : 'rd')}
    ${row('RR promedio histórico', dbRR.toFixed(2))}
    ${row('Total operaciones registradas', dbTotalOps.toString())}
    ${row('Estado vs. win rate mínimo',
      dbWinRate > calcs.minWinRate
        ? `✓ Supera mínimo (+${(dbWinRate - calcs.minWinRate).toFixed(1)}pp)`
        : `✗ Por debajo del mínimo (−${(calcs.minWinRate - dbWinRate).toFixed(1)}pp)`,
      dbWinRate > calcs.minWinRate ? 'g' : 'rd'
    )}
  </tbody>
</table>` : ''}

<div class="section">Proyección de rentabilidad mensual</div>
<table>
  <thead>
    <tr>
      <th>Escenario</th>
      <th class="r">Win Rate</th>
      <th class="r">Retorno %</th>
      <th class="r">Retorno USD / mes</th>
    </tr>
  </thead>
  <tbody>
    ${scenRow('Conservador — win rate mínimo', wrMin, monthlySummary.pctMin, monthlySummary.usdMin)}
    ${scenRow('Esperado — win rate actual', wr, monthlySummary.pct, monthlySummary.usd)}
    ${scenRow('Optimista — win rate +10pp', wrOpt, monthlySummary.pctOpt, monthlySummary.usdOpt)}
  </tbody>
</table>

<div class="summary-grid">
  ${[
    { label: 'Conservador', sub: `WR mínimo (${wrMin.toFixed(0)}%)`, pct: monthlySummary.pctMin, usd: monthlySummary.usdMin },
    { label: 'Esperado',    sub: `WR actual (${wr}%)`,               pct: monthlySummary.pct,    usd: monthlySummary.usd    },
    { label: 'Optimista',   sub: `WR +10pp (${wrOpt}%)`,             pct: monthlySummary.pctOpt, usd: monthlySummary.usdOpt },
  ].map(s => {
    const cls = s.pct >= 30 ? 'pos' : s.pct >= 0 ? 'neu' : 'neg'
    return `<div class="summary-card">
      <div class="sc-label">${s.label}</div>
      <div class="sc-sub">${s.sub}</div>
      <div class="sc-pct ${cls}">${s.pct >= 0 ? '+' : ''}${s.pct.toFixed(1)}%</div>
      <div class="sc-usd ${cls}">${usdSign(s.usd)} / mes</div>
    </div>`
  }).join('')}
</div>

<div class="footer">
  SQuant Desk · Diagnóstico generado el ${reportDate} · ${totalOps} operaciones mensuales · ${riskPerOp}% riesgo por operación · RR ${rr.toFixed(1)}<br>
  Esta herramienta es solo de simulación. Los resultados son proyecciones estadísticas y no garantizan rentabilidad futura. Operar conlleva riesgo de pérdida de capital.
</div>

</body>
</html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono,'DM Mono',monospace)" }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 24px 64px' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>
              {'// DIAGNOSTICADOR · GESTIÓN DE RIESGO'}
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue',var(--font-bebas),Impact,sans-serif", fontSize: 'clamp(40px,5vw,72px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
              <span style={{ color: C.text }}>SIGMA</span>{' '}
              <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>DIAGNOSTICADOR</span>
            </h1>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {/* Auto/Manual toggle */}
            <button
              onClick={() => setAutoMode(m => !m)}
              className="diag-btn"
              style={{
                padding: '9px 18px', border: `1px solid ${autoMode ? C.gold : C.border}`, borderRadius: C.radiusSm,
                background: autoMode ? `${C.gold}15` : 'transparent',
                color: autoMode ? C.gold : C.dimText,
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s, filter 0.15s',
              }}
            >
              {autoMode ? '⚡ AUTO' : '✎ MANUAL'}
            </button>
            {/* PDF export */}
            <button
              onClick={handleExportPDF}
              className="diag-btn"
              style={{
                padding: '9px 18px', border: `1px solid ${C.border}`, borderRadius: C.radiusSm,
                background: 'transparent', color: C.dimText,
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s, filter 0.15s',
              }}
            >
              ↓ EXPORTAR PDF
            </button>
          </div>
        </div>

        <style>{`
          .diag-btn:hover { filter: brightness(1.25); border-color: ${C.gold}80 !important; }
          .diag-input:focus { border-color: ${C.gold} !important; box-shadow: 0 0 0 1px ${C.gold}33; }
          /* Secuencia de escaneo diagnóstico */
          @keyframes diagScan {
            0%   { top: 0;   opacity: 0; }
            10%  { opacity: 0.95; }
            85%  { opacity: 0.95; }
            100% { top: 97%; opacity: 0; }
          }
          @keyframes sealStamp {
            from { opacity: 0; transform: translateX(-50%) scale(1.9); }
            to   { opacity: 1; transform: translateX(-50%) scale(1); }
          }
          @keyframes sealBurst {
            from { opacity: 0.8; transform: translateX(-50%) scale(0.6); }
            to   { opacity: 0;   transform: translateX(-50%) scale(1.9); }
          }
          /* Pulso viajando por el electrocardiograma */
          @keyframes ecgTravel { to { stroke-dashoffset: -1490; } }
          @media (prefers-reduced-motion: reduce) {
            [style*="diagScan"], [style*="sealBurst"] { animation: none !important; opacity: 0 !important; }
            [style*="sealStamp"] { animation: none !important; opacity: 1 !important; }
            [style*="ecgTravel"] { animation: none !important; }
          }
        `}</style>

        {/* ── Warning badge if no real data ──────────────────────────────── */}
        {!loading && !hasRealData && (
          <div style={{
            padding: '10px 16px', marginBottom: 24, background: `${C.yellow}10`,
            border: `1px solid ${C.yellow}40`, fontFamily: 'monospace', fontSize: 11, color: C.yellow,
          }}>
            ⚠ Usando valores de ejemplo — completa tu portafolio en Terminal y tus trades en Journal para personalizar
          </div>
        )}

        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: C.muted }}>
            Cargando datos del portafolio…
          </div>
        ) : (
          <>
            {/* ── Hero: veredicto del diagnóstico ──────────────────────── */}
            <BracketFrame
              accent={C.gold}
              background={heroCardStyle.background}
              padding="56px 32px 28px"
              style={{ boxShadow: `${C.shadowCard}, ${C.glowGoldSm}`, marginBottom: 24 }}
            >
              <DiagnosisSpectrum
                current={dbWinRate}
                breakeven={calcs.minWinRate}
                hasData={hasRealData && dbWinRate > 0}
                scanned={scanned}
              />
            </BracketFrame>

            {/* ── Inputs y métricas — fila de tarjetas a lo ancho completo,
                liberando espacio para que la matriz de escenarios respire ──── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20, marginBottom: 20 }}>

              <div style={{ padding: '4px 2px' }}>
                {/* Patrimonio inputs — sin caja: solo tipografía y espaciado */}
                <SectionLabel>PATRIMONIO</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <NumberInput
                      label={`Patrimonio en Trading${autoMode ? (dbPatrimonio > 0 ? ' (auto)' : ' (auto · sin datos)') : ''}`}
                      value={patrimonio}
                      onChange={setPatrimonio}
                      disabled={autoMode}
                      suffix="USD"
                      step={100}
                    />
                    {autoMode && (
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.muted, marginTop: 3 }}>
                        {dbPatrimonio > 0 ? 'Leído desde tu portafolio (IBKR + Binance)' : 'Sin datos de portafolio — cambia a MANUAL para editar'}
                      </div>
                    )}
                  </div>

                  <CalcRow
                    label="Patrimonio total rec. mín. (20% en trading)"
                    value={fmtUSD(calcs.patrimonioMinRec)}
                    color={C.dimText}
                  />
                  <CalcRow
                    label="Patrimonio total rec. máx. (10% en trading)"
                    value={fmtUSD(calcs.patrimonioMaxRec)}
                    color={C.dimText}
                  />
                </div>
              </div>

              <div style={{ padding: '4px 2px' }}>
                {/* Risk inputs — sin caja: solo tipografía y espaciado */}
                <SectionLabel>GESTIÓN DE RIESGO</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <NumberInput
                      label={`Relación Retorno/Riesgo${autoMode ? (dbRR > 0 ? ' (auto)' : ' (auto · sin datos)') : ''}`}
                      value={rr}
                      onChange={setRr}
                      disabled={autoMode}
                      suffix="RR"
                      step={0.1}
                      min={0.1}
                    />
                    {autoMode && (
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.muted, marginTop: 3 }}>
                        {dbRR > 0 ? `Calculado desde ${dbTotalOps} trades en Journal` : 'Sin trades suficientes — cambia a MANUAL para editar'}
                      </div>
                    )}
                  </div>
                  <NumberInput label="Riesgo por operación %" value={riskPerOp}     onChange={setRiskPerOp}     suffix="%" step={0.1} min={0.1} />
                  <NumberInput label="Riesgo de cartera %"   value={riskPortfolio} onChange={setRiskPortfolio} suffix="%" step={0.1} min={0.1} />
                </div>
              </div>

              {/* Panel de signos vitales — los 3 indicadores de riesgo agrupados
                  en un solo instrumento, en vez de gauges sueltos */}
              <VitalsPanel
                minWinRate={calcs.minWinRate}
                minWinColor={dbWinRate > 0 ? (dbWinRate > calcs.minWinRate ? C.green : C.red) : C.violet}
                riskPerOp={riskPerOp}
                riskPortfolio={riskPortfolio}
                ecgColor={diagColor}
                ecgAgitated={ecgAgitated}
                ecgSpeed={ecgSpeed}
              />

              <div style={{ padding: '4px 2px' }}>
                {/* Calculated values — sin caja: solo tipografía y espaciado */}
                <SectionLabel>VALORES CALCULADOS</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <CalcRow label="Retorno que iré a buscar por op."  value={fmtUSD(calcs.retornoPorOp)}   color={C.green} />
                  <CalcRow label="Riesgo de cada operación"          value={fmtUSD(calcs.riesgoPerOp)}   color={C.red} />
                  <CalcRow label="Máx. operaciones simultáneas"      value={calcs.maxSimultaneous.toString()} sub="ops" color={C.gold} />
                  <CalcRow label="Riesgo total de cartera"           value={fmtUSD(calcs.riesgoCartera)} color={C.red} />
                </div>
              </div>
            </div>

            {/* ── Matriz de escenarios — a lo ancho completo de la página ──── */}
            <BracketFrame accent={C.violet} style={{ marginBottom: 24 }}>
              <SectionLabel>ESCENARIOS DE RENTABILIDAD MENSUAL</SectionLabel>

                {/* Scenario inputs */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 140 }}>
                    <NumberInput label="Operaciones / día" value={opsPerDay}    onChange={setOpsPerDay}    suffix="ops" step={1} min={1} />
                  </div>
                  <div style={{ minWidth: 140 }}>
                    <NumberInput label="Días que opero / mes" value={daysPerMonth} onChange={setDaysPerMonth} suffix="días" step={1} min={1} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 2 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 5 }}>
                      Total ops / mes
                    </span>
                    <span style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: C.gold, lineHeight: 1 }}>
                      {totalOps}
                    </span>
                  </div>
                </div>

                {/* Color legend */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  {[
                    { bg: '#3b0a0a', tc: '#fca5a5', label: '< −20%' },
                    { bg: '#7f1d1d', tc: '#fca5a5', label: '−20% a 0%' },
                    { bg: '#713f12', tc: '#fde68a', label: '0% a 10%' },
                    { bg: '#14532d', tc: '#86efac', label: '10% a 30%' },
                    { bg: '#166534', tc: '#4ade80', label: '30% a 60%' },
                    { bg: '#052e16', tc: '#bbf7d0', label: '> 60%' },
                  ].map(({ bg, tc, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 4px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: C.radiusSm }}>
                      <span style={{ width: 11, height: 11, background: bg, border: `1px solid ${tc}30`, borderRadius: 2, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText }}>{label}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 4px', background: C.bg, border: `1px solid ${C.violet}40`, borderRadius: C.radiusSm }}>
                    <span style={{ width: 3, height: 11, background: C.violet, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 9, color: C.violet }}>Frontera de rentabilidad</span>
                  </div>
                  {hasRealData && dbWinRate > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 4px', background: C.bg, border: `1px solid ${C.gold}40`, borderRadius: C.radiusSm }}>
                      <span style={{ width: 11, height: 11, border: `2px solid ${C.gold}`, borderRadius: 2, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: 9, color: C.gold }}>Tu posición actual</span>
                    </div>
                  )}
                </div>

                {/* Table — sin maxHeight: la matriz completa se ve sin scroll interno */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: 11, fontFamily: 'monospace', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        {/* Corner cell — sticky solo en horizontal, ya no hay scroll vertical interno */}
                        <th style={{
                          position: 'sticky', left: 0, zIndex: 20,
                          background: C.bg, padding: '6px 10px', minWidth: 70,
                          fontFamily: 'monospace', fontSize: 9, color: C.dimText,
                          border: `1px solid ${C.border}`, textAlign: 'center', fontWeight: 400,
                        }}>
                          WR \ RR
                        </th>
                        {RR_VALUES.map(r => (
                          <th key={r} style={{
                            background: C.bg, padding: '6px 8px', minWidth: 54,
                            fontFamily: 'monospace', fontSize: 9, color: Math.abs(r - userRRCol) < 0.01 ? C.gold : C.dimText,
                            border: `1px solid ${C.border}`, textAlign: 'center', fontWeight: 400,
                            borderBottom: Math.abs(r - userRRCol) < 0.01 ? `2px solid ${C.gold}60` : undefined,
                          }}>
                            {r.toFixed(1)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {WIN_RATES.map((wr, rowIdx) => (
                        <tr key={wr}>
                          {/* Row header */}
                          <td style={{
                            position: 'sticky', left: 0, zIndex: 5,
                            background: C.bg, padding: '5px 10px',
                            fontFamily: 'monospace', fontSize: 9,
                            color: wr === userWinRow ? C.gold : C.dimText,
                            border: `1px solid ${C.border}`, textAlign: 'center',
                            borderRight: wr === userWinRow ? `2px solid ${C.gold}60` : undefined,
                          }}>
                            {wr}%
                          </td>

                          {RR_VALUES.map((r, colIdx) => {
                            const val     = tableData[rowIdx][colIdx]
                            const bg      = cellColor(val)
                            const tc      = cellTextColor(val)
                            const isUser  = wr === userWinRow && Math.abs(r - userRRCol) < 0.01 && hasRealData && dbWinRate > 0
                            const isHover = tooltip?.row === rowIdx && tooltip?.col === colIdx
                            const isBreakeven = breakEvenCol[rowIdx] === colIdx

                            return (
                              <td
                                key={r}
                                style={{
                                  background: bg,
                                  padding: '5px 4px',
                                  textAlign: 'center',
                                  color: tc,
                                  border: isUser
                                    ? `2px solid ${C.gold}`
                                    : `1px solid ${C.border}20`,
                                  boxShadow: isBreakeven ? `inset 3px 0 0 ${C.violet}` : undefined,
                                  position: 'relative',
                                  cursor: 'default',
                                  fontWeight: isUser ? 700 : 400,
                                  minWidth: 54,
                                  transition: 'filter 0.1s',
                                  filter: isHover ? 'brightness(1.3)' : 'none',
                                }}
                                onMouseEnter={() => {
                                  const dollarReturn = (val / 100) * patrimonio
                                  setTooltip({
                                    row: rowIdx, col: colIdx,
                                    content: `${wr}% ganadoras · RR ${r.toFixed(1)} → ${val >= 0 ? '+' : ''}${val.toFixed(1)}% mensual = ${fmtUSD(dollarReturn)}`,
                                  })
                                }}
                                onMouseLeave={() => setTooltip(null)}
                              >
                                {val >= 0 ? '+' : ''}{val.toFixed(1)}%
                                {isUser && (
                                  <span style={{ position: 'absolute', top: -6, right: -6, fontSize: 10, lineHeight: 1 }}>★</span>
                                )}
                                {isHover && tooltip && (
                                  <CellTooltip content={tooltip.content} />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 10, fontFamily: 'monospace', fontSize: 9, color: C.muted, lineHeight: 1.6 }}>
                  Fórmula: (WR × RR − (1 − WR)) × {totalOps} ops × {riskPerOp}% riesgo por op
                  {hasRealData && dbWinRate > 0 && ` · ★ = tu posición histórica (${dbWinRate}% WR, RR ${dbRR.toFixed(1)})`}
                </div>
              </BracketFrame>

            {/* ── Monthly summary bar ──────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {[
                {
                  label: 'Escenario conservador',
                  sub:   `Win rate mínimo (${calcs.minWinRate.toFixed(0)}%)`,
                  pct:   monthlySummary.pctMin,
                  usd:   monthlySummary.usdMin,
                  color: monthlySummary.pctMin >= 0 ? C.amber : C.red,
                  hero:  false,
                },
                {
                  label: 'Escenario esperado',
                  sub:   `Con tu WR actual (${dbWinRate > 0 ? dbWinRate : 50}%)`,
                  pct:   monthlySummary.pct,
                  usd:   monthlySummary.usd,
                  color: monthlySummary.pct >= 0 ? C.green : C.red,
                  hero:  true,
                },
                {
                  label: 'Escenario optimista',
                  sub:   `Win rate +10pp (${Math.min(dbWinRate > 0 ? dbWinRate + 10 : 60, 100)}%)`,
                  pct:   monthlySummary.pctOpt,
                  usd:   monthlySummary.usdOpt,
                  color: C.green,
                  hero:  false,
                },
              ].map(({ label, sub, pct, usd, color, hero }) => (
                <div key={label} style={{ ...(hero ? heroCardStyle : cardStyle), background: hero ? undefined : C.surface, padding: '20px 24px' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, marginBottom: 10 }}>{sub}</div>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 42, color, lineHeight: 1, marginBottom: 4, textShadow: numberEmboss }}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, color, opacity: 0.8 }}>
                    {usd >= 0 ? '+' : ''}{fmtUSD(Math.abs(usd))} / mes
                  </div>
                  <div style={{ marginTop: 10, height: 3, background: C.border }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(Math.abs(pct), 100)}%`,
                      background: color,
                      transition: 'width 0.4s',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── PDF report rendered in new window via handleExportPDF ─────────────── */}
      <div id="sigma-pdf-report" style={{ display: 'none' }}>
        <div className="pdf-header">
          <div className="pdf-logo">SQUANT DESK</div>
          <div className="pdf-title">DIAGNÓSTICO DE TRADING</div>
          <div className="pdf-date">Generado el {reportDate} · {autoMode ? 'Datos automáticos' : 'Datos manuales'}</div>
        </div>

        <div className="pdf-section-title">CONFIGURACIÓN DE PARÁMETROS</div>
        <table className="pdf-table">
          <tbody>
            <tr><td>Patrimonio en Trading</td><td className="right">{fmtUSD(patrimonio)}</td></tr>
            <tr><td>Relación Retorno / Riesgo</td><td className="right">{rr.toFixed(1)} RR</td></tr>
            <tr><td>Riesgo por operación</td><td className="right">{riskPerOp}%</td></tr>
            <tr><td>Riesgo de cartera</td><td className="right">{riskPortfolio}%</td></tr>
            <tr><td>Operaciones por día</td><td className="right">{opsPerDay}</td></tr>
            <tr><td>Días operados al mes</td><td className="right">{daysPerMonth}</td></tr>
            <tr className="bold"><td>Total operaciones al mes</td><td className="right">{totalOps}</td></tr>
          </tbody>
        </table>

        <div className="pdf-section-title">GESTIÓN DE RIESGO POR OPERACIÓN</div>
        <table className="pdf-table">
          <tbody>
            <tr><td>Retorno objetivo por operación</td><td className="right green">{fmtUSD(calcs.retornoPorOp)}</td></tr>
            <tr><td>Riesgo máximo por operación</td><td className="right red">{fmtUSD(calcs.riesgoPerOp)}</td></tr>
            <tr><td>Máx. operaciones simultáneas</td><td className="right">{calcs.maxSimultaneous} ops</td></tr>
            <tr><td>Riesgo total de cartera</td><td className="right red">{fmtUSD(calcs.riesgoCartera)}</td></tr>
            <tr><td>Patrimonio total recomendado (10% trading)</td><td className="right">{fmtUSD(calcs.patrimonioMaxRec)}</td></tr>
            <tr><td>Patrimonio total recomendado (20% trading)</td><td className="right">{fmtUSD(calcs.patrimonioMinRec)}</td></tr>
            <tr className="bold"><td>% mínimo de operaciones ganadoras para ser rentable</td><td className="right">{calcs.minWinRate.toFixed(1)}%</td></tr>
          </tbody>
        </table>

        {hasRealData && dbWinRate > 0 && (
          <>
            <div className="pdf-section-title">MI POSICIÓN HISTÓRICA (JOURNAL)</div>
            <table className="pdf-table">
              <tbody>
                <tr><td>Win rate histórico</td><td className="right">{dbWinRate}%</td></tr>
                <tr><td>RR promedio histórico</td><td className="right">{dbRR.toFixed(2)}</td></tr>
                <tr><td>Total operaciones registradas</td><td className="right">{dbTotalOps}</td></tr>
                <tr className="bold">
                  <td>Estado vs. mínimo requerido</td>
                  <td className={`right ${dbWinRate > calcs.minWinRate ? 'green' : 'red'}`}>
                    {dbWinRate > calcs.minWinRate
                      ? `✓ Supera mínimo (+${(dbWinRate - calcs.minWinRate).toFixed(1)}pp)`
                      : `✗ Por debajo del mínimo (−${(calcs.minWinRate - dbWinRate).toFixed(1)}pp)`}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <div className="pdf-section-title">PROYECCIÓN DE RENTABILIDAD MENSUAL</div>
        <table className="pdf-table">
          <thead>
            <tr>
              <th>Escenario</th>
              <th className="right">Win Rate</th>
              <th className="right">Retorno %</th>
              <th className="right">Retorno USD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Conservador (win rate mínimo)</td>
              <td className="right">{calcs.minWinRate.toFixed(0)}%</td>
              <td className={`right ${monthlySummary.pctMin >= 0 ? 'green' : 'red'}`}>
                {monthlySummary.pctMin >= 0 ? '+' : ''}{monthlySummary.pctMin.toFixed(2)}%
              </td>
              <td className={`right ${monthlySummary.pctMin >= 0 ? 'green' : 'red'}`}>
                {monthlySummary.usdMin >= 0 ? '+' : ''}{fmtUSD(Math.abs(monthlySummary.usdMin))}
              </td>
            </tr>
            <tr className="bold">
              <td>Esperado (win rate actual)</td>
              <td className="right">{dbWinRate > 0 ? dbWinRate : 50}%</td>
              <td className={`right ${monthlySummary.pct >= 0 ? 'green' : 'red'}`}>
                {monthlySummary.pct >= 0 ? '+' : ''}{monthlySummary.pct.toFixed(2)}%
              </td>
              <td className={`right ${monthlySummary.pct >= 0 ? 'green' : 'red'}`}>
                {monthlySummary.usd >= 0 ? '+' : ''}{fmtUSD(Math.abs(monthlySummary.usd))}
              </td>
            </tr>
            <tr>
              <td>Optimista (win rate +10pp)</td>
              <td className="right">{Math.min(dbWinRate > 0 ? dbWinRate + 10 : 60, 100)}%</td>
              <td className="right green">+{monthlySummary.pctOpt.toFixed(2)}%</td>
              <td className="right green">+{fmtUSD(monthlySummary.usdOpt)}</td>
            </tr>
          </tbody>
        </table>

        <div className="pdf-footer">
          SQuant Desk · Herramienta de simulación · Los resultados son proyecciones basadas en parámetros configurados y no garantizan rentabilidad futura.
        </div>
      </div>

    </div>
  )
}
