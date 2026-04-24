'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { C } from '@/app/lib/constants'

// ─── Platform definitions ─────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'ibkr',            name: 'IBKR',            color: '#3b82f6', type: 'Equities / Options', isCLP: false },
  { id: 'binance_spot',    name: 'Binance Spot',     color: '#f59e0b', type: 'Crypto Spot',        isCLP: false },
  { id: 'binance_futures', name: 'Binance Futures',  color: '#ef4444', type: 'Crypto Perps',       isCLP: false },
  { id: 'fintual',         name: 'Fintual',          color: '#8b5cf6', type: 'Fondos Mutuos',      isCLP: true  },
  { id: 'santander',       name: 'Santander',        color: '#ec4899', type: 'Ahorro / DAP',       isCLP: true  },
  { id: 'cash',            name: 'Cash / Banco',     color: '#6b7280', type: 'Liquidez',           isCLP: false },
]

const CRYPTO_IDS = new Set(['binance_spot', 'binance_futures'])

// ─── FIRE helper ─────────────────────────────────────────────────────────────
function yearsToFire(current: number, target: number, monthlySavings: number, annualReturn: number): number | null {
  if (current >= target) return 0
  if (annualReturn <= 0 && monthlySavings <= 0) return null
  const r = annualReturn / 12
  let bal = current
  for (let m = 1; m <= 720; m++) {
    bal = bal * (1 + r) + monthlySavings
    if (bal >= target) return +(m / 12).toFixed(1)
  }
  return null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtUSD(n: number) { return '$' + Math.round(n).toLocaleString('es-CL') }
function fmtCLP(n: number) { return '$' + Math.round(n).toLocaleString('es-CL') }
function pct(n: number)    { return n.toFixed(1) + '%' }
function num(s: string)    { return parseFloat(s) || 0 }

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

interface PassivePosition {
  id: string
  category: string
  nombre: string
  capital: number
  apy: number
  ingresoMensual: number
  ingresoAnual?: number
}

type PortfolioRow = Record<string, number>

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const [portfolio,  setPortfolio]  = useState<PortfolioRow>({})
  const [positions,  setPositions]  = useState<PassivePosition[]>([])
  const [loading,    setLoading]    = useState(true)
  const [trm,        setTrm]        = useState('950')
  const [monthlySav, setMonthlySav] = useState('500')

  const trmVal = num(trm) || 950

  // ─── Load data from localStorage only ──────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sigma_portfolio')
      if (raw) setPortfolio(JSON.parse(raw))
    } catch {}

    try {
      const raw = localStorage.getItem('sigma_positions')
      if (raw) {
        const parsed = JSON.parse(raw) as PassivePosition[]
        setPositions(parsed.map(p => ({
          ...p,
          ingresoMensual: p.ingresoMensual ?? (p.capital * p.apy) / 100 / 12,
        })))
      }
    } catch {}

    setLoading(false)
  }, [])

  // ─── Derived values ──────────────────────────────────────────────────────────
  const D = useMemo(() => {
    // Convert platform values to USD (fintual/santander stored as CLP → divide by TRM)
    const platformUSD = PLATFORMS.map(p => {
      const raw = portfolio[p.id] ?? 0
      const usd = p.isCLP ? raw / trmVal : raw
      return { ...p, usd }
    })

    const platformTotal = platformUSD.reduce((s, p) => s + p.usd, 0)

    // Passive positions capital
    const passiveCapital  = positions.reduce((s, p) => s + p.capital, 0)
    const passiveMonthly  = positions.reduce((s, p) => s + p.ingresoMensual, 0)

    // Grand total USD
    const totalUSD = platformTotal + passiveCapital
    const totalCLP = totalUSD * trmVal

    // Ingreso ratio
    const ingresoAnual  = passiveMonthly * 12
    const yieldRatio    = totalUSD > 0 ? (ingresoAnual / totalUSD) * 100 : 0

    // Allocation segments (platforms + ingresos pasivos)
    const allSegments = [
      ...platformUSD.filter(p => p.usd > 0).map(p => ({
        name:  p.name,
        color: p.color,
        usd:   p.usd,
        type:  p.type,
        pct:   totalUSD > 0 ? (p.usd / totalUSD) * 100 : 0,
        monthlyIncome: 0,
      })),
      ...(passiveCapital > 0 ? [{
        name:  'Ingresos Pasivos',
        color: C.gold,
        usd:   passiveCapital,
        type:  'Multi-yield',
        pct:   totalUSD > 0 ? (passiveCapital / totalUSD) * 100 : 0,
        monthlyIncome: passiveMonthly,
      }] : []),
    ]

    // Concentration risk
    const maxSegment    = allSegments.reduce((m, s) => s.pct > m.pct ? s : m, { pct: 0, name: '—' } as typeof allSegments[0])
    const cryptoPct     = totalUSD > 0
      ? (platformUSD.filter(p => CRYPTO_IDS.has(p.id)).reduce((s, p) => s + p.usd, 0) / totalUSD) * 100
      : 0
    const cashUSD       = platformUSD.find(p => p.id === 'cash')?.usd ?? 0
    const cashPct       = totalUSD > 0 ? (cashUSD / totalUSD) * 100 : 0

    // FIRE
    const FIRE_GOAL_MONTHLY = 2000
    const FIRE_RATE         = 0.04
    const fireTarget        = (FIRE_GOAL_MONTHLY * 12) / FIRE_RATE
    const firePct           = Math.min((totalUSD / fireTarget) * 100, 100)
    const fireYears         = yearsToFire(totalUSD, fireTarget, num(monthlySav), 0.08)

    // Table rows
    const tableRows = [
      ...platformUSD.map(p => ({
        name:  p.name,
        color: p.color,
        type:  p.type,
        usd:   p.usd,
        clp:   p.usd * trmVal,
        pct:   totalUSD > 0 ? (p.usd / totalUSD) * 100 : 0,
        monthly: 0,
      })),
      {
        name:    'Ingresos Pasivos',
        color:   C.gold,
        type:    'Multi-yield',
        usd:     passiveCapital,
        clp:     passiveCapital * trmVal,
        pct:     totalUSD > 0 ? (passiveCapital / totalUSD) * 100 : 0,
        monthly: passiveMonthly,
      },
    ]

    return {
      platformTotal, passiveCapital, passiveMonthly,
      totalUSD, totalCLP, ingresoAnual, yieldRatio,
      allSegments, maxSegment, cryptoPct, cashPct, cashUSD,
      fireTarget, firePct, fireYears, FIRE_GOAL_MONTHLY,
      tableRows,
    }
  }, [portfolio, positions, trmVal, monthlySav])

  const hasData = D.totalUSD > 0

  // ─── Empty state ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, letterSpacing: '0.2em' }}>CARGANDO PORTAFOLIO…</div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 48, color: C.dimText, marginBottom: 16 }}>SIN DATOS</div>
          <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText, lineHeight: 1.8, marginBottom: 28 }}>
            Para ver tu portafolio consolidado, primero ingresa datos en estas secciones:
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/terminal" style={{ fontFamily: 'monospace', fontSize: 12, color: C.gold, border: `1px solid ${C.gold}`, padding: '8px 20px', textDecoration: 'none' }}>
              → Terminal (Portfolio)
            </Link>
            <Link href="/ingresos-pasivos" style={{ fontFamily: 'monospace', fontSize: 12, color: C.green, border: `1px solid ${C.green}`, padding: '8px 20px', textDecoration: 'none' }}>
              → Ingresos Pasivos
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
                {'// VISTA CONSOLIDADA DE PATRIMONIO'}
              </div>
              <h1 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
                <span style={{ color: C.text }}>PORT</span>
                <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FOLIO</span>
              </h1>
            </div>
            {/* TRM inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText }}>TRM CLP/USD</span>
              <input
                type="number" value={trm} onChange={e => setTrm(e.target.value)} min={1}
                style={{ width: 80, background: C.bg, border: `1px solid ${C.gold}44`, color: C.gold, fontFamily: 'monospace', fontSize: 13, padding: '4px 8px', outline: 'none', textAlign: 'right' }}
              />
            </div>
          </div>
        </div>

        {/* ── KPIs × 4 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: C.border, marginBottom: 40 }}>
          {[
            { label: 'Patrimonio Total USD', value: fmtUSD(D.totalUSD),          color: C.text  },
            { label: 'Patrimonio Total CLP', value: fmtCLP(D.totalCLP),          color: C.text  },
            { label: 'Ingreso Pasivo / mes', value: fmtUSD(D.passiveMonthly),    color: C.green },
            { label: 'Yield Efectivo',       value: pct(D.yieldRatio),           color: C.gold  },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: C.surface, padding: '20px 22px' }}>
              <Label text={label} />
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, color, lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── Allocation bar ── */}
        <div style={{ marginBottom: 40 }}>
          <SectionTitle>ALLOCATION</SectionTitle>
          {/* Stacked bar */}
          <div style={{ display: 'flex', height: 32, borderRadius: 2, overflow: 'hidden', marginBottom: 16, background: C.border }}>
            {D.allSegments.map(seg => (
              seg.pct > 0 && (
                <div
                  key={seg.name}
                  title={`${seg.name}: ${pct(seg.pct)}`}
                  style={{ width: `${seg.pct}%`, background: seg.color, transition: 'width 0.5s ease', position: 'relative' }}
                />
              )
            ))}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, background: C.border }}>
            {D.allSegments.map(seg => (
              seg.usd > 0 && (
                <div key={seg.name} style={{ background: C.surface, padding: '12px 16px', flex: '1 1 140px', minWidth: 130 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 10, height: 10, background: seg.color, borderRadius: 1, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{seg.name}</span>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, color: C.text, lineHeight: 1 }}>{fmtUSD(seg.usd)}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: seg.color, marginTop: 3 }}>{pct(seg.pct)}</div>
                  {seg.monthlyIncome > 0 && (
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.green, marginTop: 2 }}>{fmtUSD(seg.monthlyIncome)}/mes</div>
                  )}
                </div>
              )
            ))}
          </div>
        </div>

        {/* ── Detail table ── */}
        <div style={{ marginBottom: 40 }}>
          <SectionTitle>DETALLE POR PLATAFORMA</SectionTitle>
          <div style={{ background: C.surface, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Plataforma', 'Tipo', 'Capital USD', 'Capital CLP', '% del total', 'Ingreso/mes'].map(h => (
                    <th key={h} style={{ padding: '8px 16px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dimText, textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {D.tableRows.map(row => (
                  <tr key={row.name} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, background: row.color, borderRadius: 1, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.text }}>{row.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{row.type}</td>
                    <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: row.usd > 0 ? C.text : C.muted }}>
                      {row.usd > 0 ? fmtUSD(row.usd) : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: row.clp > 0 ? C.dimText : C.muted }}>
                      {row.clp > 0 ? fmtCLP(row.clp) : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', minWidth: 110 }}>
                      {row.usd > 0 ? (
                        <div>
                          <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.text, marginBottom: 4 }}>{pct(row.pct)}</div>
                          <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                            <div style={{ width: `${Math.min(row.pct, 100)}%`, height: '100%', background: row.color, borderRadius: 2 }} />
                          </div>
                        </div>
                      ) : <span style={{ color: C.muted, fontFamily: 'monospace', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: 12, color: row.monthly > 0 ? C.green : C.muted }}>
                      {row.monthly > 0 ? fmtUSD(row.monthly) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${C.gold}44`, background: C.gold + '08' }}>
                  <td colSpan={2} style={{ padding: '12px 16px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, color: C.gold, letterSpacing: '0.1em' }}>TOTAL</td>
                  <td style={{ padding: '12px 16px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, color: C.gold }}>{fmtUSD(D.totalUSD)}</td>
                  <td style={{ padding: '12px 16px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, color: C.gold }}>{fmtCLP(D.totalCLP)}</td>
                  <td style={{ padding: '12px 16px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, color: C.gold }}>100%</td>
                  <td style={{ padding: '12px 16px', fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, color: C.green }}>{fmtUSD(D.passiveMonthly)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Concentration & risk ── */}
        <div style={{ marginBottom: 40 }}>
          <SectionTitle>CONCENTRACIÓN Y RIESGO</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: C.border }}>
            {/* Concentración máxima */}
            {(() => {
              const v     = D.maxSegment?.pct ?? 0
              const level = v > 50 ? { label: 'ALTA',  color: C.red }
                          : v > 30 ? { label: 'MEDIA', color: C.yellow }
                          :          { label: 'BAJA',  color: C.green }
              return (
                <div style={{ background: C.surface, padding: '22px 20px' }}>
                  <Label text="Concentración máxima" />
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, color: level.color, lineHeight: 1 }}>{pct(v)}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.15em', color: level.color, background: level.color + '18', padding: '2px 8px' }}>{level.label}</div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>
                    Mayor posición: <span style={{ color: C.text }}>{D.maxSegment?.name ?? '—'}</span>
                  </div>
                  <div style={{ marginTop: 10, height: 3, background: C.border, borderRadius: 2 }}>
                    <div style={{ width: `${Math.min(v, 100)}%`, height: '100%', background: level.color, borderRadius: 2 }} />
                  </div>
                </div>
              )
            })()}

            {/* Correlación Crypto */}
            {(() => {
              const v     = D.cryptoPct
              const level = v > 60 ? { label: 'ALTA',  color: C.red }
                          : v > 35 ? { label: 'MEDIA', color: C.yellow }
                          :          { label: 'BAJA',  color: C.green }
              return (
                <div style={{ background: C.surface, padding: '22px 20px' }}>
                  <Label text="Exposición Crypto" />
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, color: level.color, lineHeight: 1 }}>{pct(v)}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.15em', color: level.color, background: level.color + '18', padding: '2px 8px' }}>{level.label}</div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>
                    Binance Spot + Futures
                  </div>
                  <div style={{ marginTop: 10, height: 3, background: C.border, borderRadius: 2 }}>
                    <div style={{ width: `${Math.min(v, 100)}%`, height: '100%', background: level.color, borderRadius: 2 }} />
                  </div>
                </div>
              )
            })()}

            {/* Liquidez */}
            {(() => {
              const v     = D.cashPct
              const level = v < 5  ? { label: 'CRÍTICA',  color: C.red }
                          : v < 10 ? { label: 'BAJA',     color: C.yellow }
                          :          { label: 'OK',        color: C.green }
              return (
                <div style={{ background: C.surface, padding: '22px 20px' }}>
                  <Label text="Liquidez inmediata" />
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 36, color: level.color, lineHeight: 1 }}>{pct(v)}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.15em', color: level.color, background: level.color + '18', padding: '2px 8px' }}>{level.label}</div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>
                    Cash: <span style={{ color: C.text }}>{fmtUSD(D.cashUSD)}</span>
                  </div>
                  <div style={{ marginTop: 10, height: 3, background: C.border, borderRadius: 2 }}>
                    <div style={{ width: `${Math.min(v, 100)}%`, height: '100%', background: level.color, borderRadius: 2 }} />
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* ── FIRE progress ── */}
        <div style={{ marginBottom: 40 }}>
          <SectionTitle>PROGRESO FIRE</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.border }}>
            <div style={{ background: C.surface, padding: '24px 22px' }}>
              <Label text={`Meta FIRE — $${D.FIRE_GOAL_MONTHLY.toLocaleString('es-CL')}/mes · Regla 4%`} />
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 42, color: D.firePct >= 100 ? C.green : C.gold, lineHeight: 1, marginBottom: 8 }}>
                {pct(D.firePct)}
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 3, marginBottom: 14 }}>
                <div style={{
                  width: `${D.firePct}%`, height: '100%', borderRadius: 3,
                  background: D.firePct >= 100 ? C.green : `linear-gradient(90deg, ${C.gold}, ${C.glow})`,
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>
                <span>Actual: <span style={{ color: C.text }}>{fmtUSD(D.totalUSD)}</span></span>
                <span>Meta: <span style={{ color: C.gold }}>{fmtUSD(D.fireTarget)}</span></span>
              </div>
            </div>
            <div style={{ background: C.bg, padding: '24px 22px' }}>
              <Label text="Años estimados para FIRE (8% retorno anual)" />
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 42, color: D.fireYears === 0 ? C.green : C.text, lineHeight: 1, marginBottom: 12 }}>
                {D.fireYears === 0 ? '¡YA!' : D.fireYears !== null ? `${D.fireYears} años` : '50+ años'}
              </div>
              <div style={{ marginBottom: 10 }}>
                <Label text="Ahorro mensual asumido (USD)" />
                <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, background: C.surface, marginTop: 4 }}>
                  <span style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>$</span>
                  <input
                    type="number" value={monthlySav} onChange={e => setMonthlySav(e.target.value)} min={0}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontFamily: 'monospace', fontSize: 12, padding: '7px 10px 7px 0' }}
                  />
                </div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, lineHeight: 1.7 }}>
                Falta: <span style={{ color: C.gold }}>{fmtUSD(Math.max(0, D.fireTarget - D.totalUSD))}</span> para alcanzar la meta
              </div>
            </div>
          </div>
        </div>

        {/* ── Tax mini-card ── */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <Label text="Resumen tributario estimado" />
            <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, marginBottom: 3 }}>Ingreso pasivo anual</div>
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 28, color: C.green, lineHeight: 1 }}>
                  {fmtUSD(D.ingresoAnual)}
                </div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, maxWidth: 340, lineHeight: 1.7 }}>
                Para calcular tu Impuesto Global Complementario (IGC) con desglose por BTC, futuros, acciones y más →
              </div>
            </div>
          </div>
          <Link href="/tax" style={{
            fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: C.gold, border: `1px solid ${C.gold}`, padding: '10px 24px', textDecoration: 'none',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            → TAX CHILE
          </Link>
        </div>

      </div>
    </div>
  )
}
