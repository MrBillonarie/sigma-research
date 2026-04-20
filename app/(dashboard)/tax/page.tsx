'use client'
import { useState, useMemo } from 'react'
import { C } from '@/app/lib/constants'

// ─── Tramos IGC 2024 (CLP) ────────────────────────────────────────────────────
const TRAMOS = [
  { from: 0,            to: 9_600_000,   rate: 0.000, label: '$0 – $9.6M' },
  { from: 9_600_000,    to: 21_400_000,  rate: 0.040, label: '$9.6M – $21.4M' },
  { from: 21_400_000,   to: 35_700_000,  rate: 0.080, label: '$21.4M – $35.7M' },
  { from: 35_700_000,   to: 50_000_000,  rate: 0.135, label: '$35.7M – $50M' },
  { from: 50_000_000,   to: 71_400_000,  rate: 0.230, label: '$50M – $71.4M' },
  { from: 71_400_000,   to: 107_000_000, rate: 0.304, label: '$71.4M – $107M' },
  { from: 107_000_000,  to: Infinity,    rate: 0.350, label: '$107M+' },
]

function calcIGC(base: number): number {
  let tax = 0
  let rem = Math.max(base, 0)
  for (const t of TRAMOS) {
    if (rem <= 0) break
    const chunk = t.to === Infinity ? rem : Math.min(rem, t.to - t.from)
    tax += chunk * t.rate
    rem  -= chunk
  }
  return tax
}

function activeTramoIdx(base: number): number {
  for (let i = TRAMOS.length - 1; i >= 0; i--) {
    if (base > TRAMOS[i].from) return i
  }
  return 0
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtClp(n: number): string {
  return '$' + Math.round(Math.abs(n)).toLocaleString('es-CL') + (n < 0 ? ' (pérd.)' : '')
}
function fmtUsd(n: number): string { return 'USD ' + Math.round(n).toLocaleString('es-CL') }
function pct(r: number): string    { return (r * 100).toFixed(1) + '%' }
function num(s: string): number    { return parseFloat(s) || 0 }

function Label({ text }: { text: string }) {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>
      {text}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 26, color: C.text, letterSpacing: '0.05em', marginBottom: 14 }}>
      {children}
    </div>
  )
}

function UsdInput({ label, value, onChange, badge, badgeColor, accentBorder }:
  { label: string; value: string; onChange: (v: string) => void; badge: string; badgeColor: string; accentBorder?: boolean }
) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Label text={label} />
        <span style={{
          fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: badgeColor, background: badgeColor + '18', padding: '2px 6px',
        }}>{badge}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${accentBorder ? badgeColor + '55' : C.border}`, background: C.bg }}>
        <span style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>USD</span>
        <input
          type="number" value={value} onChange={e => onChange(e.target.value)} placeholder="0"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontFamily: 'monospace', fontSize: 12, padding: '8px 10px 8px 0' }}
        />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TaxChilePage() {
  const [anio,            setAnio]            = useState<'2024' | '2025'>('2024')
  const [trm,             setTrm]             = useState('950')
  const [btcSpot,         setBtcSpot]         = useState('')
  const [btcFutures,      setBtcFutures]      = useState('')
  const [accionesUS,      setAccionesUS]      = useState('')
  const [accionesCL,      setAccionesCL]      = useState('')
  const [ingresosPasivos, setIngresosPasivos] = useState('')
  const [withholding,     setWithholding]     = useState('')
  const [otrosIngresos,   setOtrosIngresos]   = useState('')
  const [cl365,           setCl365]           = useState(false)
  const [copied,          setCopied]          = useState(false)

  const trmVal = parseFloat(trm) || 950

  // ─── Core calculations ───────────────────────────────────────────────────────
  const R = useMemo(() => {
    const btcSpotClp    = num(btcSpot)    * trmVal
    const btcFutClp     = num(btcFutures) * trmVal
    const accUSClp      = num(accionesUS) * trmVal
    const accCLClp      = num(accionesCL) * trmVal
    const pasivosClp    = num(ingresosPasivos) * trmVal
    const whtClp        = num(withholding) * trmVal
    const otrosClp      = num(otrosIngresos)

    // acciones CL: 10% único si >365 días → excluir de IGC base
    const baseIGC = Math.max(0,
      otrosClp + btcSpotClp + btcFutClp + accUSClp +
      (cl365 ? 0 : accCLClp) + pasivosClp
    )

    const igcTax        = calcIGC(baseIGC)
    const accCLTax      = cl365 ? Math.max(0, accCLClp * 0.10) : 0
    const maxWhtCredit  = Math.max(0, accUSClp * 0.15)
    const whtCredit     = Math.min(whtClp, maxWhtCredit)
    const totalTax      = Math.max(0, igcTax + accCLTax - whtCredit)
    const totalGross    = btcSpotClp + btcFutClp + accUSClp + accCLClp + pasivosClp + otrosClp
    const totalTaxUSD   = totalTax / trmVal
    const efectiva      = totalGross > 0 ? totalTax / totalGross : 0
    const tramoIdx      = activeTramoIdx(baseIGC)

    // Per-bracket breakdown
    let accum = 0
    const brackets = TRAMOS.map((t, i) => {
      let inBracket = 0
      if (baseIGC > t.from) {
        inBracket = t.to === Infinity
          ? baseIGC - t.from
          : Math.min(baseIGC - t.from, t.to - t.from)
      }
      const taxInBracket = inBracket * t.rate
      accum += taxInBracket
      return { ...t, inBracket, taxInBracket, accumulated: accum, active: i === tramoIdx && baseIGC > 0 }
    })

    // Proportional per-category tax (approximate)
    const propTax = (share: number) =>
      baseIGC > 0 ? (share / baseIGC) * igcTax : 0

    const rows = [
      { label: 'BTC / Crypto Spot',   usd: num(btcSpot),    clp: btcSpotClp, trat: 'IGC — Capital',       tax: propTax(btcSpotClp) },
      { label: 'Futuros Perpetuos',   usd: num(btcFutures), clp: btcFutClp,  trat: 'IGC — Derivados',     tax: propTax(btcFutClp)  },
      { label: 'Acciones USA',        usd: num(accionesUS), clp: accUSClp,   trat: 'IGC + Créd. USA',     tax: propTax(accUSClp)   },
      { label: 'Acciones Chile',      usd: num(accionesCL), clp: accCLClp,   trat: cl365 ? '10% Único (Ley 21.210)' : 'IGC — Normal', tax: cl365 ? accCLTax : propTax(accCLClp) },
      { label: 'Ingresos Pasivos',    usd: num(ingresosPasivos), clp: pasivosClp, trat: 'IGC — Renta Ord.', tax: propTax(pasivosClp) },
    ].filter(r => r.usd !== 0)

    return {
      btcSpotClp, btcFutClp, accUSClp, accCLClp, pasivosClp, otrosClp,
      baseIGC, igcTax, accCLTax, whtCredit, whtClp,
      totalTax, totalGross, totalTaxUSD, efectiva, tramoIdx, brackets, rows,
    }
  }, [btcSpot, btcFutures, accionesUS, accionesCL, ingresosPasivos, withholding, otrosIngresos, cl365, trmVal])

  // ─── Recommendations ─────────────────────────────────────────────────────────
  const tips = useMemo(() => {
    const out: { color: string; text: string }[] = []
    const futPct = R.totalGross > 0 ? R.btcFutClp / R.totalGross : 0
    if (futPct > 0.5)
      out.push({ color: C.yellow, text: 'Futuros > 50% de tus ganancias. Considera operar bajo una SpA para diferir o separar la base imponible de derivados.' })
    if (num(accionesCL) > 0 && !cl365)
      out.push({ color: C.yellow, text: `Acciones Chile con menos de 365 días tributan al ${pct(TRAMOS[R.tramoIdx].rate)} (IGC). Mantenerlas hasta cumplir el año reduce la tasa al 10% único (Ley 21.210).` })
    if (num(withholding) > 0)
      out.push({ color: C.green, text: `Crédito por Withholding Tax USA correctamente aplicado (${fmtClp(R.whtCredit)}). Guarda el Form 1042-S de IBKR para respaldarlo ante el SII.` })
    if (R.baseIGC > 50_000_000)
      out.push({ color: C.red, text: 'Base imponible supera $50M CLP (tramo 23%+). Evalúa diferir ganancias discrecionales al siguiente año tributario para optimizar el tramo.' })
    return out
  }, [R, accionesCL, withholding, cl365])

  // ─── Export ──────────────────────────────────────────────────────────────────
  function handleExport() {
    const lines = [
      `SIGMA RESEARCH — RESUMEN TRIBUTARIO CHILE AT${anio}`,
      `Generado: ${new Date().toLocaleDateString('es-CL')}`,
      '━'.repeat(50),
      `TRM utilizado: $${trmVal} CLP/USD`,
      '',
      'GANANCIAS DEL PERÍODO',
      '─'.repeat(40),
      `BTC/Crypto Spot (Capital):         ${fmtClp(R.btcSpotClp)}`,
      `Futuros Perpetuos (Derivados):     ${fmtClp(R.btcFutClp)}`,
      `Acciones USA (Cap. extranjero):    ${fmtClp(R.accUSClp)}`,
      `Acciones Chile (Cap. local):       ${fmtClp(R.accCLClp)}  ${cl365 ? '→ >365 días, 10% único' : '→ <365 días, IGC'}`,
      `Ingresos Pasivos (Renta ord.):     ${fmtClp(R.pasivosClp)}`,
      `Otros ingresos (CLP):              ${fmtClp(R.otrosClp)}`,
      '',
      'CÁLCULO IMPOSITIVO',
      '─'.repeat(40),
      `Base imponible IGC:                ${fmtClp(R.baseIGC)}`,
      `Tramo IGC aplicable:               ${pct(TRAMOS[R.tramoIdx].rate)}`,
      `Impuesto IGC:                      ${fmtClp(R.igcTax)}`,
      `Impuesto acc. Chile (10% único):   ${fmtClp(R.accCLTax)}`,
      `Crédito Withholding USA:          -${fmtClp(R.whtCredit)}`,
      '━'.repeat(50),
      `IMPUESTO TOTAL ESTIMADO:           ${fmtClp(R.totalTax)}`,
      `                                   (${fmtUsd(R.totalTaxUSD)})`,
      `Tasa efectiva:                     ${pct(R.efectiva)}`,
      '',
      `⚠  REFERENCIAL — Consultar con contador certificado`,
      `Declaración AT${parseInt(anio) + 1}: 30 de Abril ${parseInt(anio) + 1}`,
    ]
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
            {'// TRIBUTACIÓN · CHILE · IGC 2024'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
                <span style={{ color: C.text }}>TAX</span>{' '}
                <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CHILE</span>
              </h1>
              <p style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText, marginTop: 12, maxWidth: 560, lineHeight: 1.7 }}>
                Calculadora de Impuesto Global Complementario para traders. BTC, futuros, acciones USA/CL, ingresos pasivos.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ background: C.yellow + '15', border: `1px solid ${C.yellow}44`, padding: '7px 14px', fontFamily: 'monospace', fontSize: 11, color: C.yellow, letterSpacing: '0.08em' }}>
                ⚠ REFERENCIAL — Consulta a un contador certificado
              </div>
              <div style={{ display: 'flex', gap: 1, background: C.border }}>
                {(['2024', '2025'] as const).map(y => (
                  <button key={y} onClick={() => setAnio(y)} style={{
                    padding: '6px 22px', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em',
                    border: 'none', cursor: 'pointer',
                    background: anio === y ? C.surface : C.bg,
                    color:      anio === y ? C.gold    : C.dimText,
                    borderBottom: anio === y ? `2px solid ${C.gold}` : '2px solid transparent',
                  }}>
                    AT {y}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Main grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 1, background: C.border, marginBottom: 40, alignItems: 'start' }}>

          {/* ── Left: inputs ── */}
          <div style={{ background: C.surface, padding: '28px 24px' }}>
            <SectionTitle>GANANCIAS DEL AÑO</SectionTitle>

            {/* TRM */}
            <div style={{ marginBottom: 20, padding: '12px 14px', background: C.bg, border: `1px solid ${C.border}` }}>
              <Label text="TRM — Tipo de cambio CLP / USD" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <input
                  type="number" value={trm} onChange={e => setTrm(e.target.value)} min={1}
                  style={{ width: 110, background: C.surface, border: `1px solid ${C.gold}55`, color: C.gold, fontFamily: 'monospace', fontSize: 14, padding: '6px 10px', outline: 'none' }}
                />
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>CLP por USD · editable</span>
              </div>
            </div>

            <UsdInput label="BTC / Crypto Spot (Binance Spot)"      value={btcSpot}         onChange={setBtcSpot}         badge="Capital"        badgeColor={C.purple} />
            <UsdInput label="Futuros Perpetuos (Binance Futures)"   value={btcFutures}      onChange={setBtcFutures}      badge="Derivados"      badgeColor={C.yellow} />
            <UsdInput label="Acciones USA — IBKR"                   value={accionesUS}      onChange={setAccionesUS}      badge="Cap. Extranjero" badgeColor={C.gold}  />
            <UsdInput label="Ingresos Pasivos (Staking / DeFi)"     value={ingresosPasivos} onChange={setIngresosPasivos} badge="Renta Ord."     badgeColor={C.green} />

            {/* Acciones CL con checkbox 365 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Label text="Acciones Chile (Santander / Fintual)" />
                <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.green, background: C.green + '18', padding: '2px 6px' }}>
                  Cap. Local
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, background: C.bg }}>
                <span style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>USD</span>
                <input
                  type="number" value={accionesCL} onChange={e => setAccionesCL(e.target.value)} placeholder="0"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontFamily: 'monospace', fontSize: 12, padding: '8px 10px 8px 0' }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={cl365} onChange={e => setCl365(e.target.checked)}
                  style={{ accentColor: C.gold, width: 14, height: 14 }}
                />
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: cl365 ? C.green : C.dimText, lineHeight: 1.5 }}>
                  ¿Mantuviste {'>'}365 días? → aplica 10% único (Ley 21.210)
                </span>
              </label>
            </div>

            {/* Withholding */}
            <UsdInput
              label="Crédito Withholding Tax USA pagado (IBKR)"
              value={withholding} onChange={setWithholding}
              badge="Crédito" badgeColor={C.green} accentBorder
            />

            {/* Otros ingresos CLP */}
            <div style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Label text="Otros ingresos anuales (sueldo, honorarios…)" />
                <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.08em', color: C.dimText, background: C.border, padding: '2px 6px' }}>CLP</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, background: C.bg }}>
                <span style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>$</span>
                <input
                  type="number" value={otrosIngresos} onChange={e => setOtrosIngresos(e.target.value)} placeholder="0"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontFamily: 'monospace', fontSize: 12, padding: '8px 10px 8px 0' }}
                />
              </div>
            </div>
          </div>

          {/* ── Right: results ── */}
          <div style={{ background: C.bg, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <SectionTitle>RESULTADO ESTIMADO AT {anio}</SectionTitle>

            {/* Per-category table */}
            {R.rows.length > 0 ? (
              <div style={{ background: C.surface, marginBottom: 1, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Categoría', 'USD', 'CLP', 'Tratamiento', 'Impuesto est.'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dimText, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {R.rows.map(row => (
                      <tr key={row.label} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: C.text, whiteSpace: 'nowrap' }}>{row.label}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: row.usd < 0 ? C.red : C.dimText }}>
                          {row.usd.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: row.clp < 0 ? C.red : C.dimText }}>{fmtClp(row.clp)}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 10, color: C.gold, whiteSpace: 'nowrap' }}>{row.trat}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: row.tax > 0 ? C.red : C.muted }}>{row.tax > 0 ? fmtClp(row.tax) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ background: C.surface, padding: '28px', fontFamily: 'monospace', fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 1 }}>
                Ingresa tus ganancias del año para ver el desglose.
              </div>
            )}

            {/* Summary lines */}
            <div style={{ background: C.surface, padding: '20px 20px' }}>
              {[
                { label: 'Total ganancia bruta',         value: fmtClp(R.totalGross),  color: C.text  },
                { label: 'Crédito Withholding USA',      value: R.whtCredit > 0 ? `−${fmtClp(R.whtCredit)}` : '—',  color: C.green },
                { label: 'Base imponible IGC',           value: fmtClp(R.baseIGC),     color: C.text  },
                { label: 'Tramo IGC aplicable',          value: pct(TRAMOS[R.tramoIdx].rate), color: C.gold },
                { label: 'Impuesto IGC estimado',        value: fmtClp(R.igcTax),      color: C.red   },
                { label: 'Impuesto acc. Chile 10% único',value: R.accCLTax > 0 ? fmtClp(R.accCLTax) : '—', color: R.accCLTax > 0 ? C.red : C.muted },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{label}</span>
                  <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, color, lineHeight: 1 }}>{value}</span>
                </div>
              ))}

              {/* Total highlight */}
              <div style={{ marginTop: 10, padding: '18px 18px', background: C.red + '0e', border: `1px solid ${C.red}2a` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <Label text="Impuesto total estimado" />
                    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 42, color: C.red, lineHeight: 1 }}>
                      {fmtClp(R.totalTax)}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, marginTop: 5 }}>
                      {fmtUsd(R.totalTaxUSD)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Label text="Tasa efectiva" />
                    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 42, color: C.gold, lineHeight: 1 }}>
                      {pct(R.efectiva)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, fontFamily: 'monospace', fontSize: 11, color: C.dimText, textAlign: 'center', letterSpacing: '0.05em' }}>
                Fecha límite declaración IGC:{' '}
                <span style={{ color: C.yellow }}>30 de Abril {parseInt(anio) + 1}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tramos IGC table ── */}
        <div style={{ marginBottom: 40 }}>
          <SectionTitle>TABLA DE TRAMOS IGC {anio}</SectionTitle>
          <div style={{ background: C.surface, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Rango CLP', 'Tasa', 'Imponible en tramo', 'Impuesto en tramo', 'Acumulado'].map(h => (
                    <th key={h} style={{ padding: '8px 16px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dimText, textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {R.brackets.map((b, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: b.active ? C.gold + '10' : 'transparent' }}>
                    <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: b.active ? C.gold : C.dimText, whiteSpace: 'nowrap' }}>
                      {b.active && <span style={{ marginRight: 8, color: C.gold }}>▶</span>}
                      {TRAMOS[i].label}
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: b.active ? C.gold : C.dimText }}>
                      {pct(b.rate)}
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: b.inBracket > 0 ? C.text : C.muted }}>
                      {b.inBracket > 0 ? fmtClp(b.inBracket) : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: b.taxInBracket > 0 ? C.red : C.muted }}>
                      {b.taxInBracket > 0 ? fmtClp(b.taxInBracket) : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: b.accumulated > 0 ? C.text : C.muted }}>
                      {b.accumulated > 0 ? fmtClp(b.accumulated) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Recommendations ── */}
        {tips.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <SectionTitle>RECOMENDACIONES AUTOMÁTICAS</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: C.border }}>
              {tips.map((tip, i) => (
                <div key={i} style={{ background: C.surface, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ color: tip.color, fontSize: 13, flexShrink: 0, marginTop: 1 }}>◆</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, lineHeight: 1.75 }}>{tip.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Export ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
          <button
            onClick={handleExport}
            style={{
              fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase',
              color:      copied ? C.bg   : C.gold,
              background: copied ? C.green : 'transparent',
              border:     `1px solid ${copied ? C.green : C.gold}`,
              padding: '10px 28px', cursor: 'pointer', transition: 'all 0.25s',
            }}
          >
            {copied ? '✓ COPIADO AL PORTAPAPELES' : '↓ EXPORTAR RESUMEN PARA CONTADOR'}
          </button>
        </div>

      </div>
    </div>
  )
}
