'use client'
import { useState, useMemo, useEffect } from 'react'
import { C } from '@/app/lib/constants'
import {
  DEPOSITOS, STAKING, DEFI_EARN, LP_POOLS, DIV_CRYPTO, DIV_TRADFI, BOTS,
  RISK_COLOR, CATEGORY_ICON,
  type PositionCategory, type RiskLevel,
} from './data'
import { calcMonthlyIncome, calcCompoundGrowth, calcWeightedAPY, calcIL } from './logic'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Position {
  id: string
  category: PositionCategory
  nombre: string
  capital: number
  apy: number
  plazo: string
  risk: RiskLevel
  url: string
  vencimiento?: string
  ingresoMensual: number
  ingresoAnual: number
}

type CatalogItem = { label: string; apy: number; url: string; category: PositionCategory }

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_APY = 40
const FREEDOM_GOAL = 2000
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const TABS: PositionCategory[] = ['Depósito', 'Staking', 'DeFi', 'LP', 'Dividendo', 'Bot']

// ─── Catalog builder ──────────────────────────────────────────────────────────
function buildCatalog(): CatalogItem[] {
  const items: CatalogItem[] = []
  DEPOSITOS.forEach(d => items.push({ label: `${d.plataforma} · ${d.moneda} (${d.plazo})`, apy: d.apy, url: d.url, category: 'Depósito' }))
  STAKING.forEach(s => items.push({ label: `${s.activo} · ${s.plataforma}`, apy: +((s.apyMin + s.apyMax) / 2).toFixed(1), url: s.url, category: 'Staking' }))
  DEFI_EARN.forEach(d => items.push({ label: `${d.protocolo} · ${d.activo}`, apy: d.apySupply, url: d.url, category: 'DeFi' }))
  LP_POOLS.forEach(lp => items.push({ label: `${lp.par} · ${lp.dex}`, apy: +((lp.feeApr + lp.farmApr)).toFixed(1), url: lp.url, category: 'LP' }))
  DIV_CRYPTO.forEach(d => items.push({ label: `${d.token} · ${d.protocolo}`, apy: +((d.yieldMin + d.yieldMax) / 2).toFixed(1), url: d.url, category: 'Dividendo' }))
  DIV_TRADFI.forEach(d => items.push({ label: `${d.token} · ${d.protocolo}`, apy: +((d.yieldMin + d.yieldMax) / 2).toFixed(1), url: d.url, category: 'Dividendo' }))
  BOTS.forEach(b => items.push({ label: b.estrategia, apy: b.retMax > 0 ? +((b.retMin + b.retMax) / 2).toFixed(1) : 10, url: b.url, category: 'Bot' }))
  return items
}

const ALL_CATALOG = buildCatalog()

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('es-CL', { maximumFractionDigits: 0 }) }
function fmtApy(n: number) { return n.toFixed(1) + '%' }

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const color = RISK_COLOR[risk]
  return (
    <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color, background: color + '18', padding: '2px 7px' }}>
      {risk}
    </span>
  )
}

function Label({ text }: { text: string }) {
  return <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>{text}</div>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 28, color: C.text, letterSpacing: '0.05em', marginBottom: 16 }}>
      {children}
    </div>
  )
}

function CatalogRow({ cols }: { cols: (string | React.ReactNode)[] }) {
  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      {cols.map((c, i) => (
        <td key={i} style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: C.dimText, verticalAlign: 'middle' }}>
          {c}
        </td>
      ))}
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function IngresoPasivosPage() {
  const [activeTab, setActiveTab] = useState<PositionCategory>('Depósito')
  const [positions, setPositions] = useState<Position[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [calcCapital, setCalcCapital] = useState(10000)
  const [calcApy, setCalcApy] = useState(6)
  const [calcMonths, setCalcMonths] = useState(12)
  const [liveRates, setLiveRates] = useState<Record<string, number | null>>({})
  const [liveAt, setLiveAt] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/apy-live')
      .then(r => r.json())
      .then(j => { if (j.ok) { setLiveRates(j.rates); setLiveAt(j.fetchedAt) } })
      .catch(() => {})
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sigma_positions')
      if (stored) {
        const parsed = JSON.parse(stored) as Position[]
        const migrated = parsed.map(p => ({
          ...p,
          ingresoMensual: p.ingresoMensual ?? calcMonthlyIncome(p.capital, p.apy),
          ingresoAnual: p.ingresoAnual ?? calcMonthlyIncome(p.capital, p.apy) * 12,
        }))
        setPositions(migrated)
      }
    } catch {}
  }, [])

  function savePositions(next: Position[]) {
    setPositions(next)
    localStorage.setItem('sigma_positions', JSON.stringify(next))
  }

  function removePosition(id: string) {
    savePositions(positions.filter(p => p.id !== id))
    setConfirmDeleteId(null)
  }

  // ─── Metrics ────────────────────────────────────────────────────────────────
  const totalCapital = useMemo(() => positions.reduce((s, p) => s + p.capital, 0), [positions])
  const monthlyIncome = useMemo(() => positions.reduce((s, p) => s + p.ingresoMensual, 0), [positions])
  const weightedApy = useMemo(() => calcWeightedAPY(positions.map(p => ({ capital: p.capital, apy: p.apy }))), [positions])
  const yearlyIncome = monthlyIncome * 12
  const libertadPct = Math.min((monthlyIncome / FREEDOM_GOAL) * 100, 100)

  // ─── Category breakdown ─────────────────────────────────────────────────────
  const categoryBreakdown = useMemo(() => {
    const map: Partial<Record<PositionCategory, { capital: number; monthly: number }>> = {}
    for (const p of positions) {
      if (!map[p.category]) map[p.category] = { capital: 0, monthly: 0 }
      map[p.category]!.capital += p.capital
      map[p.category]!.monthly += p.ingresoMensual
    }
    return map
  }, [positions])

  // ─── 12-month projection ────────────────────────────────────────────────────
  const projection12 = useMemo(() => {
    if (totalCapital === 0 || weightedApy === 0) return []
    return Array.from({ length: 12 }, (_, i) => {
      const projCap = calcCompoundGrowth(totalCapital, weightedApy, i + 1)
      return calcMonthlyIncome(projCap, weightedApy)
    })
  }, [totalCapital, weightedApy])

  const maxProjection = Math.max(...projection12, 1)
  const currentMonthIdx = new Date().getMonth()
  const projectionMonths = Array.from({ length: 12 }, (_, i) => MONTH_NAMES[(currentMonthIdx + i) % 12])

  // ─── Calculator ─────────────────────────────────────────────────────────────
  const calcMonthlyVal = calcMonthlyIncome(calcCapital, calcApy)
  const calcFinal = calcCompoundGrowth(calcCapital, calcApy, calcMonths)
  const calcGain = calcFinal - calcCapital

  // ─── Catalog content ────────────────────────────────────────────────────────
  const catalogContent = useMemo(() => {
    const lv = (key: string | undefined, fallback: number) => {
      const live = key ? (liveRates[key] ?? null) : null
      const val = live ?? fallback
      return (
        <span style={{ color: C.green }}>
          {fmtApy(val)}
          {live !== null && <span style={{ fontSize: 8, color: C.gold, marginLeft: 4, letterSpacing: '0.05em' }}>● LIVE</span>}
        </span>
      )
    }

    if (activeTab === 'Depósito') return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Plataforma', 'Moneda', 'Plazo', 'APY', 'Mín USD', 'Riesgo', ''].map(h => (
              <th key={h} style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEPOSITOS.map(d => (
            <CatalogRow key={d.plataforma + d.moneda} cols={[
              d.plataforma,
              <span key="m" style={{ color: C.gold }}>{d.moneda}</span>,
              d.plazo,
              <span key="a">{lv(d.liveKey, d.apy)}</span>,
              '$' + fmt(d.minUSD),
              <RiskBadge key="r" risk={d.risk} />,
              <a key="u" href={d.url} target="_blank" rel="noreferrer" style={{ color: C.dimText, fontFamily: 'monospace', fontSize: 11 }}>↗</a>,
            ]} />
          ))}
        </tbody>
      </table>
    )
    if (activeTab === 'Staking') return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Activo', 'APY Min', 'APY Max', 'Lock-up', 'Plataforma', 'Riesgo', ''].map(h => (
              <th key={h} style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STAKING.map(s => (
            <CatalogRow key={s.activo} cols={[
              <span key="a" style={{ color: C.gold }}>{s.activo}</span>,
              fmtApy(s.apyMin),
              <span key="mx">{lv(s.liveKey, s.apyMax)}</span>,
              s.lockup,
              s.plataforma,
              <RiskBadge key="r" risk={s.risk} />,
              <a key="u" href={s.url} target="_blank" rel="noreferrer" style={{ color: C.dimText, fontFamily: 'monospace', fontSize: 11 }}>↗</a>,
            ]} />
          ))}
        </tbody>
      </table>
    )
    if (activeTab === 'DeFi') return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Protocolo', 'Activo', 'APY Supply', 'TVL (M)', 'Auditado', 'Chain', 'Tipo', 'Riesgo', ''].map(h => (
              <th key={h} style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEFI_EARN.map(d => (
            <CatalogRow key={d.protocolo + d.activo} cols={[
              d.protocolo,
              <span key="a" style={{ color: C.gold }}>{d.activo}</span>,
              <span key="apy">{lv(d.liveKey, d.apySupply)}</span>,
              '$' + d.tvlM + 'M',
              d.audited ? <span key="ok" style={{ color: C.green }}>✓</span> : <span key="no" style={{ color: C.red }}>✗</span>,
              d.chain,
              d.tipo,
              <RiskBadge key="r" risk={d.risk} />,
              <a key="u" href={d.url} target="_blank" rel="noreferrer" style={{ color: C.dimText, fontFamily: 'monospace', fontSize: 11 }}>↗</a>,
            ]} />
          ))}
        </tbody>
      </table>
    )
    if (activeTab === 'LP') return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Par', 'DEX', 'Fee APR', 'Farm APR', 'Total APR', 'IL Estimado', 'Riesgo', ''].map(h => (
              <th key={h} style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LP_POOLS.map(lp => {
            const totalApr = lp.feeApr + lp.farmApr
            const il = calcIL(2) * 100
            return (
              <CatalogRow key={lp.par} cols={[
                <span key="p" style={{ color: C.gold }}>{lp.par}</span>,
                lp.dex,
                fmtApy(lp.feeApr),
                lp.farmApr > 0 ? <span key="fa" style={{ color: C.purple }}>{fmtApy(lp.farmApr)}</span> : <span key="fd" style={{ color: C.dimText }}>—</span>,
                <span key="t">{lv(lp.liveKey, totalApr)}</span>,
                <span key="il" style={{ color: C.yellow }}>{il.toFixed(1)}%@2x</span>,
                <RiskBadge key="r" risk={lp.risk} />,
                <a key="u" href={lp.url} target="_blank" rel="noreferrer" style={{ color: C.dimText, fontFamily: 'monospace', fontSize: 11 }}>↗</a>,
              ]} />
            )
          })}
        </tbody>
      </table>
    )
    if (activeTab === 'Dividendo') return (
      <div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Crypto</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Token', 'Protocolo', 'Tipo', 'Yield Min', 'Yield Max', 'Frecuencia', 'Riesgo', ''].map(h => (
                <th key={h} style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIV_CRYPTO.map(d => (
              <CatalogRow key={d.token} cols={[
                <span key="t" style={{ color: C.gold }}>{d.token}</span>,
                d.protocolo,
                d.tipo,
                fmtApy(d.yieldMin),
                <span key="mx">{lv(d.liveKey, d.yieldMax)}</span>,
                d.freq,
                <RiskBadge key="r" risk={d.risk} />,
                <a key="u" href={d.url} target="_blank" rel="noreferrer" style={{ color: C.dimText, fontFamily: 'monospace', fontSize: 11 }}>↗</a>,
              ]} />
            ))}
          </tbody>
        </table>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>TradFi / ETFs</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Ticker', 'Fondo', 'Tipo', 'Yield Min', 'Yield Max', 'Frecuencia', 'Riesgo', ''].map(h => (
                <th key={h} style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIV_TRADFI.map(d => (
              <CatalogRow key={d.token} cols={[
                <span key="t" style={{ color: C.gold }}>{d.token}</span>,
                d.protocolo,
                d.tipo,
                fmtApy(d.yieldMin),
                <span key="mx">{lv(d.liveKey, d.yieldMax)}</span>,
                d.freq,
                <RiskBadge key="r" risk={d.risk} />,
                <a key="u" href={d.url} target="_blank" rel="noreferrer" style={{ color: C.dimText, fontFamily: 'monospace', fontSize: 11 }}>↗</a>,
              ]} />
            ))}
          </tbody>
        </table>
      </div>
    )
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 1, background: C.border }}>
        {BOTS.map(b => (
          <div key={b.estrategia} style={{ background: C.surface, padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22, color: C.text }}>{b.estrategia}</div>
              <RiskBadge risk={b.risk} />
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, lineHeight: 1.7, marginBottom: 12 }}>{b.descripcion}</div>
            {b.retMin > 0 ? (
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.green }}>
                Retorno estimado: {b.retMin}–{b.retMax}% anual
              </div>
            ) : (
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>Sin retorno fijo — gestión de precio medio</div>
            )}
            {b.url !== '#' && (
              <a href={b.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12, fontFamily: 'monospace', fontSize: 11, color: C.gold }}>
                Ver en plataforma ↗
              </a>
            )}
          </div>
        ))}
      </div>
    )
  }, [activeTab, liveRates])

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
            {'// INGRESOS PASIVOS · HUB FINANCIERO'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ color: C.text }}>INGRESOS</span>{' '}
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PASIVOS</span>
          </h1>
          <p style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText, marginTop: 14, maxWidth: 600, lineHeight: 1.7 }}>
            Centraliza y visualiza todas tus fuentes de ingreso pasivo. Registra posiciones, compara opciones del mercado y proyecta tu crecimiento.
          </p>
        </div>

        {/* ── KPIs × 5 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: C.border, marginBottom: 1 }}>
          <div style={{ background: C.surface, padding: '20px 22px' }}>
            <Label text="Capital Total" />
            <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, color: C.text, lineHeight: 1 }}>${fmt(totalCapital)}</div>
          </div>
          <div style={{ background: C.surface, padding: '20px 22px' }}>
            <Label text="Ingreso Mensual" />
            <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, color: C.green, lineHeight: 1 }}>${fmt(monthlyIncome)}</div>
          </div>
          <div style={{ background: C.surface, padding: '20px 22px' }}>
            <Label text="Ingreso Anual" />
            <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, color: C.green, lineHeight: 1 }}>${fmt(yearlyIncome)}</div>
          </div>
          <div style={{ background: C.surface, padding: '20px 22px' }}>
            <Label text="APY Promedio" />
            <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, color: C.gold, lineHeight: 1 }}>{fmtApy(weightedApy)}</div>
          </div>
          <div style={{ background: C.surface, padding: '20px 22px' }}>
            <Label text={`Libertad Financiera · meta $${fmt(FREEDOM_GOAL)}/mes`} />
            <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, color: libertadPct >= 100 ? C.green : C.gold, lineHeight: 1 }}>
              {libertadPct.toFixed(1)}%
            </div>
            <div style={{ marginTop: 8, height: 3, background: C.border, borderRadius: 2 }}>
              <div style={{
                width: `${libertadPct}%`, height: '100%', borderRadius: 2,
                background: libertadPct >= 100 ? C.green : `linear-gradient(90deg, ${C.gold}, ${C.glow})`,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        </div>

        {/* ── Category breakdown ── */}
        {Object.keys(categoryBreakdown).length > 0 && (
          <div style={{ display: 'flex', gap: 1, background: C.border, marginBottom: 40, overflowX: 'auto' }}>
            {(Object.entries(categoryBreakdown) as [PositionCategory, { capital: number; monthly: number }][]).map(([cat, data]) => (
              <div key={cat} style={{ background: C.surface, padding: '16px 20px', flex: 1, minWidth: 130 }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{CATEGORY_ICON[cat]}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>{cat}</div>
                <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22, color: C.text, lineHeight: 1 }}>${fmt(data.capital)}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.green, marginTop: 3 }}>${fmt(data.monthly)}/mes</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Positions table ── */}
        <div style={{ background: C.surface, marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>
              MIS POSICIONES ACTIVAS · {positions.length} REGISTRADAS
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              style={{ fontFamily: 'monospace', fontSize: 11, color: C.bg, background: C.gold, border: 'none', padding: '6px 16px', cursor: 'pointer', letterSpacing: '0.1em' }}
            >
              + AGREGAR
            </button>
          </div>

          {positions.length === 0 ? (
            <div style={{ padding: '40px 18px', fontFamily: 'monospace', fontSize: 13, color: C.muted, textAlign: 'center' }}>
              Sin posiciones registradas. Haz clic en{' '}
              <span style={{ color: C.gold }}>+ AGREGAR</span> para comenzar.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Categoría', 'Nombre', 'Capital', 'APY', 'Ingreso/mes', 'Riesgo', 'Plazo', ''].map(h => (
                    <th key={h} style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>
                      {CATEGORY_ICON[p.category]} {p.category}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: C.text }}>
                      <div>{p.nombre}</div>
                      {p.vencimiento && (
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>vence {p.vencimiento}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: C.text }}>${fmt(p.capital)}</td>
                    <td style={{ padding: '10px 14px', minWidth: 90 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.green, marginBottom: 5 }}>{fmtApy(p.apy)}</div>
                      <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                        <div style={{
                          width: `${Math.min((p.apy / MAX_APY) * 100, 100)}%`,
                          height: '100%', background: C.gold, borderRadius: 2,
                        }} />
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: C.green }}>${fmt(p.ingresoMensual)}</td>
                    <td style={{ padding: '10px 14px' }}><RiskBadge risk={p.risk} /></td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>{p.plazo}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {confirmDeleteId === p.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>¿Eliminar?</span>
                          <button
                            onClick={() => removePosition(p.id)}
                            style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44`, fontFamily: 'monospace', fontSize: 11, padding: '3px 9px', cursor: 'pointer' }}
                          >Sí</button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            style={{ background: C.border, color: C.dimText, border: 'none', fontFamily: 'monospace', fontSize: 11, padding: '3px 9px', cursor: 'pointer' }}
                          >No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(p.id)}
                          style={{ background: C.border + '66', color: C.red, border: `1px solid ${C.border}`, fontFamily: 'monospace', fontSize: 13, padding: '4px 10px', cursor: 'pointer' }}
                        >✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── 12-month projection ── */}
        {projection12.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <SectionTitle>PROYECCIÓN A 12 MESES</SectionTitle>
            <div style={{ background: C.surface, padding: '28px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 200 }}>
                {projection12.map((val, i) => {
                  const barH = Math.max((val / maxProjection) * 160, 4)
                  const isLast = i === 11
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: isLast ? C.gold : C.green, letterSpacing: '0.05em', textAlign: 'center' }}>
                        ${fmt(val)}
                      </div>
                      <div style={{
                        width: '100%',
                        height: barH,
                        background: isLast
                          ? `linear-gradient(to top, ${C.gold}, ${C.glow})`
                          : `linear-gradient(to top, ${C.gold}99, ${C.gold}22)`,
                        borderRadius: '2px 2px 0 0',
                      }} />
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {projectionMonths[i]}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                {[
                  { label: 'Ingreso mes 1', value: `$${fmt(projection12[0])}`, color: C.text },
                  { label: 'Ingreso mes 12', value: `$${fmt(projection12[11])}`, color: C.gold },
                  { label: 'Crecimiento', value: `+${(((projection12[11] - projection12[0]) / projection12[0]) * 100).toFixed(1)}%`, color: C.green },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 24, color, lineHeight: 1 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Catalog tabs ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 16 }}>
            <SectionTitle>CATÁLOGO DE OPORTUNIDADES</SectionTitle>
            {liveAt ? (
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#34d399', letterSpacing: '0.18em' }}>
                ● DATOS EN VIVO · {new Date(liveAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : (
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280', letterSpacing: '0.18em' }}>
                ○ CARGANDO DATOS...
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 1, background: C.border, marginBottom: 1 }}>
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '11px 8px', fontFamily: 'monospace', fontSize: 11,
                  letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
                  background: activeTab === tab ? C.surface : C.bg,
                  color: activeTab === tab ? C.gold : C.dimText,
                  borderBottom: activeTab === tab ? `2px solid ${C.gold}` : '2px solid transparent',
                }}
              >
                {CATEGORY_ICON[tab]} {tab}
              </button>
            ))}
          </div>
          <div style={{ background: C.surface, overflowX: 'auto' }}>
            {catalogContent}
          </div>
        </div>

        {/* ── Compound calculator ── */}
        <div>
          <SectionTitle>CALCULADORA DE CRECIMIENTO</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.border }}>
            <div style={{ background: C.surface, padding: '24px 24px' }}>
              <Label text="Parámetros" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
                {[
                  { label: 'Capital inicial (USD)', value: calcCapital, min: 100, max: 1_000_000, step: 100, set: setCalcCapital },
                  { label: 'APY anual (%)',          value: calcApy,     min: 0.1, max: 100,       step: 0.1, set: setCalcApy },
                  { label: 'Plazo (meses)',           value: calcMonths,  min: 1,   max: 120,       step: 1,   set: setCalcMonths },
                ].map(({ label, value, min, max, step, set }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{label}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.gold }}>{value}</span>
                    </div>
                    <input
                      type="range" min={min} max={max} step={step} value={value}
                      onChange={e => set(Number(e.target.value))}
                      style={{ width: '100%', accentColor: C.gold }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: C.bg, padding: '24px 24px' }}>
              <Label text="Proyección con interés compuesto" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {[
                  { label: 'Capital inicial', value: '$' + fmt(calcCapital),                              color: C.text  },
                  { label: 'Ingreso mensual', value: '$' + fmt(calcMonthlyVal),                           color: C.green },
                  { label: 'Ganancia total',  value: '+$' + fmt(calcGain),                               color: C.green },
                  { label: 'Capital final',   value: '$' + fmt(calcFinal),                               color: C.gold  },
                  { label: 'Crecimiento',     value: '+' + ((calcGain / calcCapital) * 100).toFixed(1) + '%', color: C.gold },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>{label}</span>
                    <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22, color }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {showAddModal && (
        <AddPositionModal
          onClose={() => setShowAddModal(false)}
          onSave={(pos) => { savePositions([...positions, pos]); setShowAddModal(false) }}
        />
      )}
    </div>
  )
}

// ─── Add position modal ───────────────────────────────────────────────────────
function AddPositionModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (p: Position) => void
}) {
  const [category, setCategory]       = useState<PositionCategory>('Depósito')
  const [nombre, setNombre]           = useState('')
  const [capital, setCapital]         = useState(1000)
  const [apy, setApy]                 = useState(5)
  const [plazo, setPlazo]             = useState('Flexible')
  const [risk, setRisk]               = useState<RiskLevel>('Bajo')
  const [vencimiento, setVencimiento] = useState('')
  const [selectedCatalog, setSelectedCatalog] = useState('')
  const [catalogUrl, setCatalogUrl]   = useState('')

  const catalogForCategory = ALL_CATALOG.filter(item => item.category === category)
  const liveMonthly = calcMonthlyIncome(capital, apy)

  useEffect(() => { setSelectedCatalog(''); setCatalogUrl('') }, [category])

  function handleCatalogSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setSelectedCatalog(val)
    if (!val) { setCatalogUrl(''); return }
    const item = catalogForCategory[parseInt(val)]
    if (!item) return
    setApy(item.apy)
    setCatalogUrl(item.url)
    if (!nombre) setNombre(item.label)
  }

  function handleSave() {
    if (!nombre.trim()) return
    const ingresoMensual = calcMonthlyIncome(capital, apy)
    onSave({
      id: Date.now().toString(),
      category,
      nombre: nombre.trim(),
      capital,
      apy,
      plazo,
      risk,
      url: catalogUrl,
      vencimiento: vencimiento || undefined,
      ingresoMensual,
      ingresoAnual: ingresoMensual * 12,
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: C.bg, border: `1px solid ${C.border}`,
    color: C.text, fontFamily: 'monospace', fontSize: 12,
    padding: '8px 10px', boxSizing: 'border-box',
  }
  const selectStyle: React.CSSProperties = { ...inputStyle }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,5,10,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '32px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 26, color: C.text, marginBottom: 24 }}>NUEVA POSICIÓN</div>

        {/* Categoría */}
        <div style={{ marginBottom: 14 }}>
          <Label text="Categoría" />
          <select value={category} onChange={e => setCategory(e.target.value as PositionCategory)} style={selectStyle}>
            {(['Depósito','Staking','DeFi','LP','Dividendo','Bot'] as PositionCategory[]).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Cargar del catálogo */}
        {catalogForCategory.length > 0 && (
          <div style={{ marginBottom: 14, padding: '12px 14px', background: C.bg, border: `1px solid ${C.border}` }}>
            <Label text="Cargar del catálogo (opcional — auto-rellena APY y URL)" />
            <select value={selectedCatalog} onChange={handleCatalogSelect} style={selectStyle}>
              <option value="">— Seleccionar del catálogo —</option>
              {catalogForCategory.map((item, i) => (
                <option key={i} value={i.toString()}>{item.label} · {fmtApy(item.apy)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Nombre */}
        <div style={{ marginBottom: 14 }}>
          <Label text="Nombre / Descripción" />
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: USDT Binance 30d" style={inputStyle} />
        </div>

        {/* Capital */}
        <div style={{ marginBottom: 14 }}>
          <Label text="Capital (USD)" />
          <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} min={1} style={inputStyle} />
        </div>

        {/* APY */}
        <div style={{ marginBottom: 14 }}>
          <Label text="APY (%)" />
          <input type="number" value={apy} onChange={e => setApy(Number(e.target.value))} min={0} step={0.1} style={inputStyle} />
        </div>

        {/* Live preview */}
        <div style={{ marginBottom: 14, padding: '14px 16px', background: C.bg, border: `1px solid ${C.gold}33` }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 10 }}>
            Preview — Ingreso Estimado
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, marginBottom: 3 }}>Mensual</div>
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 28, color: C.gold, lineHeight: 1 }}>${fmt(liveMonthly)}</div>
            </div>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, marginBottom: 3 }}>Anual</div>
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 28, color: C.gold, lineHeight: 1 }}>${fmt(liveMonthly * 12)}</div>
            </div>
          </div>
        </div>

        {/* Plazo */}
        <div style={{ marginBottom: 14 }}>
          <Label text="Plazo" />
          <input value={plazo} onChange={e => setPlazo(e.target.value)} placeholder="Flexible / 30 días / …" style={inputStyle} />
        </div>

        {/* Vencimiento */}
        <div style={{ marginBottom: 14 }}>
          <Label text="Fecha de vencimiento (opcional)" />
          <input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }} />
        </div>

        {/* Riesgo */}
        <div style={{ marginBottom: 24 }}>
          <Label text="Nivel de riesgo" />
          <select value={risk} onChange={e => setRisk(e.target.value as RiskLevel)} style={selectStyle}>
            {(['Muy bajo','Bajo','Medio','Alto','Muy alto'] as RiskLevel[]).map(r => <option key={r}>{r}</option>)}
          </select>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSave}
            style={{ flex: 1, background: C.gold, color: C.bg, border: 'none', fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.12em', padding: '10px', cursor: 'pointer' }}
          >
            GUARDAR
          </button>
          <button
            onClick={onClose}
            style={{ flex: 1, background: C.bg, color: C.dimText, border: `1px solid ${C.border}`, fontFamily: 'monospace', fontSize: 12, padding: '10px', cursor: 'pointer' }}
          >
            CANCELAR
          </button>
        </div>
      </div>
    </div>
  )
}
