'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/app/lib/supabase'
import { C } from '@/app/lib/constants'
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
  label, value, onChange, suffix = '', step = 0.1, min = 0
}: {
  label: string; value: number; onChange: (v: number) => void
  suffix?: string; step?: number; min?: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>{label}</span>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="number" step={step} min={min}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{
            background: C.bg, border: `1px solid ${C.border}`, outline: 'none',
            color: C.text, fontFamily: 'monospace', fontSize: 13, padding: '8px 12px',
            fontVariantNumeric: 'tabular-nums', width: '100%',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = C.gold)}
          onBlur={e  => (e.target.style.borderColor = C.border)}
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

  // ── Load data from Supabase ────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const TRADING_PLATFORMS = ['ibkr', 'binance_spot', 'binance_futures']

      const [portResult, tradesResult] = await Promise.all([
        supabase.from('portfolio').select('*').eq('user_id', user.id).single(),
        supabase.from('trades').select('pnl_usd, resultado, sl, tp, entry_price, lado'),
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
        winRate      = Math.round((wins.length / totalCount) * 100)

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
      setLoading(false)
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
  <div class="logo">Sigma Research · Inteligencia Cuantitativa</div>
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
  Sigma Research · Diagnóstico generado el ${reportDate} · ${totalOps} operaciones mensuales · ${riskPerOp}% riesgo por operación · RR ${rr.toFixed(1)}<br>
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

  const minWinFmt = calcs.minWinRate.toFixed(1)

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
              style={{
                padding: '9px 18px', border: `1px solid ${autoMode ? C.gold : C.border}`,
                background: autoMode ? `${C.gold}15` : 'transparent',
                color: autoMode ? C.gold : C.dimText,
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer',
              }}
            >
              {autoMode ? '⚡ AUTO' : '✎ MANUAL'}
            </button>
            {/* PDF export */}
            <button
              onClick={handleExportPDF}
              style={{
                padding: '9px 18px', border: `1px solid ${C.border}`,
                background: 'transparent', color: C.dimText,
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer',
              }}
            >
              ↓ EXPORTAR PDF
            </button>
          </div>
        </div>

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
            {/* ── Two-column layout ─────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,380px) 1fr', gap: 1, background: C.border, marginBottom: 1 }}>

              {/* ══ MODULE 1: LEFT PANEL ══════════════════════════════════ */}
              <div style={{ background: C.surface, padding: '24px' }}>

                {/* Patrimonio inputs */}
                <SectionLabel>PATRIMONIO</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
                  <div>
                    <NumberInput
                      label={`Patrimonio en Trading${autoMode && dbPatrimonio > 0 ? ' (auto)' : ''}`}
                      value={patrimonio}
                      onChange={autoMode ? () => {} : setPatrimonio}
                      suffix="USD"
                      step={100}
                    />
                    {autoMode && dbPatrimonio > 0 && (
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.muted, marginTop: 3 }}>
                        Leído desde tu portafolio (IBKR + Binance)
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

                {/* Risk inputs */}
                <SectionLabel>GESTIÓN DE RIESGO</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
                  <div>
                    <NumberInput
                      label={`Relación Retorno/Riesgo${autoMode && dbRR > 0 ? ' (auto)' : ''}`}
                      value={rr}
                      onChange={autoMode ? () => {} : setRr}
                      suffix="RR"
                      step={0.1}
                      min={0.1}
                    />
                    {autoMode && dbRR > 0 && (
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.muted, marginTop: 3 }}>
                        Calculado desde {dbTotalOps} trades en Journal
                      </div>
                    )}
                  </div>
                  <NumberInput label="Riesgo por operación %" value={riskPerOp}     onChange={setRiskPerOp}     suffix="%" step={0.1} min={0.1} />
                  <NumberInput label="Riesgo de cartera %"   value={riskPortfolio} onChange={setRiskPortfolio} suffix="%" step={0.1} min={0.1} />
                </div>

                {/* Calculated values */}
                <SectionLabel>VALORES CALCULADOS</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <CalcRow label="Retorno que iré a buscar por op."  value={fmtUSD(calcs.retornoPorOp)}   color={C.green} />
                  <CalcRow label="Riesgo de cada operación"          value={fmtUSD(calcs.riesgoPerOp)}   color={C.red} />
                  <CalcRow label="Máx. operaciones simultáneas"      value={calcs.maxSimultaneous.toString()} sub="ops" color={C.gold} />
                  <CalcRow label="Riesgo total de cartera"           value={fmtUSD(calcs.riesgoCartera)} color={C.red} />
                  <CalcRow
                    label="% mín. ganadoras para ser rentable"
                    value={`${minWinFmt}%`}
                    color={dbWinRate > 0 && dbWinRate > calcs.minWinRate ? C.green : C.yellow}
                  />
                </div>

                {/* Mi posición actual */}
                {hasRealData && dbWinRate > 0 && (
                  <div style={{ marginTop: 24, padding: '14px', background: `${C.gold}08`, border: `1px solid ${C.gold}30` }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>
                      → MI POSICIÓN ACTUAL
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 11 }}>
                        <span style={{ color: C.dimText }}>Win rate histórico</span>
                        <span style={{ color: dbWinRate > calcs.minWinRate ? C.green : C.red, fontWeight: 700 }}>{dbWinRate}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 11 }}>
                        <span style={{ color: C.dimText }}>RR histórico</span>
                        <span style={{ color: C.gold }}>{dbRR.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 11 }}>
                        <span style={{ color: C.dimText }}>Total operaciones</span>
                        <span style={{ color: C.text }}>{dbTotalOps}</span>
                      </div>
                      <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>
                        {dbWinRate > calcs.minWinRate
                          ? `✓ Tu win rate supera el mínimo requerido (+${(dbWinRate - calcs.minWinRate).toFixed(1)}pp)`
                          : `✗ Tu win rate está ${(calcs.minWinRate - dbWinRate).toFixed(1)}pp por debajo del mínimo`
                        }
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ══ MODULE 2: RIGHT PANEL — SCENARIO TABLE ════════════════ */}
              <div style={{ background: C.surface, padding: '24px', overflow: 'hidden' }}>
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
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 12, height: 12, background: bg, border: `1px solid ${tc}30`, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText }}>{label}</span>
                    </div>
                  ))}
                  {hasRealData && dbWinRate > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 12, height: 12, border: `2px solid ${C.gold}`, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: 9, color: C.gold }}>Tu posición actual</span>
                    </div>
                  )}
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 520 }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: 11, fontFamily: 'monospace', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        {/* Corner cell */}
                        <th style={{
                          position: 'sticky', left: 0, top: 0, zIndex: 20,
                          background: C.bg, padding: '6px 10px', minWidth: 70,
                          fontFamily: 'monospace', fontSize: 9, color: C.dimText,
                          border: `1px solid ${C.border}`, textAlign: 'center', fontWeight: 400,
                        }}>
                          WR \ RR
                        </th>
                        {RR_VALUES.map(r => (
                          <th key={r} style={{
                            position: 'sticky', top: 0, zIndex: 10,
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
              </div>
            </div>

            {/* ── Monthly summary bar ──────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: C.border, marginTop: 1 }}>
              {[
                {
                  label: 'Escenario conservador',
                  sub:   `Win rate mínimo (${calcs.minWinRate.toFixed(0)}%)`,
                  pct:   monthlySummary.pctMin,
                  usd:   monthlySummary.usdMin,
                  color: monthlySummary.pctMin >= 0 ? C.yellow : C.red,
                },
                {
                  label: 'Escenario esperado',
                  sub:   `Con tu WR actual (${dbWinRate > 0 ? dbWinRate : 50}%)`,
                  pct:   monthlySummary.pct,
                  usd:   monthlySummary.usd,
                  color: monthlySummary.pct >= 0 ? C.green : C.red,
                },
                {
                  label: 'Escenario optimista',
                  sub:   `Win rate +10pp (${Math.min(dbWinRate > 0 ? dbWinRate + 10 : 60, 100)}%)`,
                  pct:   monthlySummary.pctOpt,
                  usd:   monthlySummary.usdOpt,
                  color: C.green,
                },
              ].map(({ label, sub, pct, usd, color }) => (
                <div key={label} style={{ background: C.surface, padding: '20px 24px' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, marginBottom: 10 }}>{sub}</div>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 42, color, lineHeight: 1, marginBottom: 4 }}>
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
          <div className="pdf-logo">SIGMA RESEARCH</div>
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
          Sigma Research · Herramienta de simulación · Los resultados son proyecciones basadas en parámetros configurados y no garantizan rentabilidad futura.
        </div>
      </div>

    </div>
  )
}
