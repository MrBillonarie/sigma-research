'use client'
import { useState, useMemo } from 'react'
import type { Asset, AssetClass, SignalType, Allocation, TradeStatus } from '@/types/decision-engine'

const SIGNAL_CFG: Record<SignalType, { label: string; color: string; bg: string }> = {
  comprar:  { label: 'COMPRAR',  color: '#1D9E75', bg: 'rgba(29,158,117,0.12)'  },
  mantener: { label: 'MANTENER', color: '#d4af37', bg: 'rgba(212,175,55,0.12)'  },
  reducir:  { label: 'REDUCIR',  color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  neutral:  { label: 'NEUTRAL',  color: '#7a7f9a', bg: 'rgba(122,127,154,0.12)' },
}

const CLASS_LABEL: Record<AssetClass, string> = {
  fondos: 'Fondos Mutuos', etfs: 'ETFs Globales', renta_fija: 'Renta Fija', crypto: 'Crypto',
}
const CLASS_COLOR: Record<AssetClass, string> = {
  fondos: '#1D9E75', etfs: '#378ADD', renta_fija: '#d4af37', crypto: '#a78bfa',
}
const CLASS_ICON: Record<AssetClass, string> = {
  fondos: '🏦', etfs: '📊', renta_fija: '🏛️', crypto: '₿',
}
const CLASS_ORDER: AssetClass[] = ['fondos', 'etfs', 'renta_fija', 'crypto']

function fmt(n: number, cur: 'CLP' | 'USD'): string {
  if (cur === 'CLP') {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
    return `$${Math.round(n).toLocaleString('es-CL')}`
  }
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function SignalBadge({ signal }: { signal: SignalType }) {
  const c = SIGNAL_CFG[signal]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
      color: c.color, background: c.bg, border: `1px solid ${c.color}30`,
      borderRadius: 4, padding: '3px 8px', whiteSpace: 'nowrap',
    }}>{c.label}</span>
  )
}

function Pct({ v }: { v: number }) {
  const color = v > 0 ? '#1D9E75' : v < 0 ? '#f87171' : '#7a7f9a'
  return <span style={{ color, fontFamily: 'monospace', fontSize: 12 }}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</span>
}

function ScoreBar({ score }: { score: number }) {
  const color = score > 65 ? '#1D9E75' : score > 45 ? '#d4af37' : '#f87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 56, height: 4, background: '#1a1d2e', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color, fontFamily: 'monospace', minWidth: 22 }}>{score}</span>
    </div>
  )
}

const STATUS_CFG: Record<TradeStatus, { label: string; color: string }> = {
  'entry':    { label: 'ENTRY',    color: '#1D9E75' },
  'watch':    { label: 'WATCH',    color: '#d4af37' },
  'no-setup': { label: 'NO SETUP', color: '#3a3f55' },
}

function StatusChip({ status }: { status: TradeStatus }) {
  const c = STATUS_CFG[status]
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, fontFamily: 'monospace',
      color: c.color, background: `${c.color}18`,
      border: `1px solid ${c.color}40`,
      borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap',
    }}>{c.label}</span>
  )
}

function CondsEV({ met, total, ev }: { met: number; total: number; ev: number }) {
  const condColor = met >= Math.ceil(total * 0.75) ? '#1D9E75' : met >= Math.ceil(total * 0.5) ? '#d4af37' : '#f87171'
  const evColor   = ev > 0 ? '#1D9E75' : ev < 0 ? '#f87171' : '#7a7f9a'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: condColor, fontFamily: 'monospace', fontWeight: 700 }}>
        {met}/{total} conds
      </span>
      <span style={{ fontSize: 10, color: evColor, fontFamily: 'monospace' }}>
        EV {ev > 0 ? '+' : ''}{ev.toFixed(1)}%
      </span>
    </div>
  )
}

interface Props {
  assets:     Asset[]
  capital?:   number
  currency?:  'CLP' | 'USD'
  allocation?: Allocation
}
type SortKey = 'name' | 'score' | 'return30d' | 'return1y' | 'rsi' | 'netFlow'

export default function SignalTable({ assets, capital = 0, currency = 'CLP', allocation }: Props) {
  const [classFilter,  setClassFilter]  = useState<AssetClass | 'all'>('all')
  const [signalFilter, setSignalFilter] = useState<SignalType | 'all'>('all')
  const [search,       setSearch]       = useState('')
  const [sortKey,      setSortKey]      = useState<SortKey>('score')
  const [sortDesc,     setSortDesc]     = useState(true)
  const [page,         setPage]         = useState(1)
  const [grouped,      setGrouped]      = useState(false)
  const [showAll,      setShowAll]      = useState(false)  // por defecto: solo top picks
  const PER_PAGE = 15

  const showMonto = capital > 0 && !!allocation
  const numCols   = showMonto ? 10 : 9

  // Máximo de picks con capital asignado por clase (no 40 ETFs con $5 cada uno)
  const MAX_PICKS: Record<AssetClass, number> = {
    fondos: 5, etfs: 5, renta_fija: 2, crypto: 2,
  }

  // Set de IDs que reciben capital: top N comprar por score dentro de cada clase
  const capitalRecipients = useMemo(() => {
    const ids = new Set<string>()
    for (const cls of CLASS_ORDER) {
      assets
        .filter(a => a.assetClass === cls && a.signal === 'comprar')
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_PICKS[cls])
        .forEach(a => ids.add(a.id))
    }
    return ids
  }, [assets])

  // Score total solo entre los picks seleccionados
  const classBuyScores = useMemo(() => {
    const map = new Map<AssetClass, number>()
    for (const cls of CLASS_ORDER) {
      const total = assets
        .filter(a => a.assetClass === cls && capitalRecipients.has(a.id))
        .reduce((s, a) => s + a.score, 0)
      map.set(cls, total)
    }
    return map
  }, [assets, capitalRecipients])

  function suggestedAmount(a: Asset): number {
    if (!showMonto || !allocation || !capitalRecipients.has(a.id)) return 0
    const classAmount = capital * (allocation[a.assetClass] / 100)
    const totalScore  = classBuyScores.get(a.assetClass) || 1
    return classAmount * (a.score / totalScore)
  }

  const hasFilters = classFilter !== 'all' || signalFilter !== 'all' || search !== ''

  const signalCounts = useMemo(() => {
    let r = assets
    if (classFilter !== 'all')  r = r.filter(a => a.assetClass === classFilter)
    if (search) { const q = search.toLowerCase(); r = r.filter(a => a.name.toLowerCase().includes(q) || (a.ticker ?? '').toLowerCase().includes(q)) }
    return {
      comprar:  r.filter(a => a.signal === 'comprar').length,
      mantener: r.filter(a => a.signal === 'mantener' || a.signal === 'neutral').length,
      reducir:  r.filter(a => a.signal === 'reducir').length,
      total:    r.length,
    }
  }, [assets, classFilter, search])

  const filtered = useMemo(() => {
    let r = assets
    // vista compacta por defecto: solo top picks con capital + señales reducir
    if (!showAll) r = r.filter(a => capitalRecipients.has(a.id) || a.signal === 'reducir')
    if (classFilter  !== 'all') r = r.filter(a => a.assetClass === classFilter)
    if (signalFilter !== 'all') r = r.filter(a => a.signal     === signalFilter)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(a => a.name.toLowerCase().includes(q) || (a.ticker ?? '').toLowerCase().includes(q))
    }
    r = [...r].sort((a, b) => {
      const av = a[sortKey] as number | string
      const bv = b[sortKey] as number | string
      if (typeof av === 'string') return sortDesc ? bv.toString().localeCompare(av) : av.localeCompare(bv.toString())
      return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })
    return r
  }, [assets, classFilter, signalFilter, search, sortKey, sortDesc])

  const groupedData = useMemo(() => {
    if (!grouped) return null
    return CLASS_ORDER.map(cls => ({
      cls,
      items: filtered.filter(a => a.assetClass === cls),
    })).filter(g => g.items.length > 0)
  }, [filtered, grouped])

  const pages   = Math.ceil(filtered.length / PER_PAGE)
  const visible = grouped ? filtered : filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDesc(d => !d)
    else { setSortKey(k); setSortDesc(true) }
    setPage(1)
  }

  function clearFilters() {
    setClassFilter('all'); setSignalFilter('all'); setSearch(''); setPage(1)
  }

  const TH = ({ label, k }: { label: string; k?: SortKey }) => (
    <th onClick={k ? () => toggleSort(k) : undefined} style={{
      padding: '8px 12px', textAlign: 'left', fontSize: 10,
      color: k && sortKey === k ? '#e8e9f0' : '#7a7f9a',
      fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase',
      cursor: k ? 'pointer' : 'default', whiteSpace: 'nowrap', userSelect: 'none',
      borderBottom: '1px solid #1a1d2e',
    }}>
      {label}{k && sortKey === k ? (sortDesc ? ' ↓' : ' ↑') : ''}
    </th>
  )

  function RowEl({ a, i }: { a: Asset; i: number }) {
    const monto = suggestedAmount(a)
    return (
      <tr
        style={{ borderBottom: '1px solid #0d0f1a', background: i % 2 === 0 ? 'transparent' : '#04050a22', transition: 'background 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1a1d2e44')}
        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : '#04050a22')}
      >
        <td style={{ padding: '8px 12px', maxWidth: 240 }}>
          <div style={{ fontSize: 12, color: '#e8e9f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
          {a.ticker && <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: 'monospace' }}>{a.ticker}</div>}
        </td>
        <td style={{ padding: '8px 12px' }}>
          <span style={{ fontSize: 10, color: CLASS_COLOR[a.assetClass], fontFamily: 'monospace' }}>
            {CLASS_ICON[a.assetClass]} {CLASS_LABEL[a.assetClass]}
          </span>
        </td>
        <td style={{ padding: '8px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <SignalBadge signal={a.signal} />
              {a.signalChanged && a.prevSignal && (
                <span title={`Cambió de ${SIGNAL_CFG[a.prevSignal].label}`} style={{
                  fontSize: 9, fontFamily: 'monospace', color: '#d4af37',
                  background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)',
                  borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap',
                }}>
                  {SIGNAL_CFG[a.prevSignal].label[0]}→{SIGNAL_CFG[a.signal].label[0]}
                </span>
              )}
            </div>
            <StatusChip status={a.status ?? 'no-setup'} />
          </div>
        </td>
        <td style={{ padding: '8px 12px' }}><ScoreBar score={a.score} /></td>
        <td style={{ padding: '8px 12px' }}>
          <CondsEV
            met={a.conditionsMet ?? 0}
            total={a.conditionsTotal ?? 8}
            ev={a.evNeto ?? 0}
          />
        </td>
        <td style={{ padding: '8px 12px' }}><Pct v={a.return30d} /></td>
        <td style={{ padding: '8px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Pct v={a.return1y} />
            {(a.dividendYield ?? 0) > 0 && (
              <span style={{ fontSize: 9, color: '#d4af37', fontFamily: 'monospace' }}>
                div {a.dividendYield!.toFixed(1)}%
              </span>
            )}
          </div>
        </td>
        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: a.rsi > 70 ? '#f87171' : a.rsi < 30 ? '#1D9E75' : '#7a7f9a' }}>
          {a.rsi.toFixed(0)}
        </td>
        <td style={{ padding: '8px 12px' }}><Pct v={a.netFlow} /></td>
        {showMonto && (() => {
          // Kelly efectivo = kellyPct × (volScalar/100) → % real del capital
          const kellyEff = (a.kellyPct ?? 0) * (a.volScalar ?? 100) / 100
          const kellyAmt = capital * kellyEff / 100
          const isComprar = a.signal === 'comprar'
          const isReducir = a.signal === 'reducir'
          const hasKelly  = kellyEff > 0 && isComprar
          const entryColor = (a.status ?? 'watch') === 'entry' ? '#1D9E75' : '#d4af37'

          return (
            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>

                {/* ── Monto de cartera (score-weighted, solo top picks) ──── */}
                {monto > 0 && (
                  <>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#1D9E75', fontWeight: 700 }}>
                      {fmt(monto, currency)}
                    </span>
                    <span style={{ fontSize: 9, color: '#1D9E75', fontFamily: 'monospace', opacity: 0.6 }}>
                      ★ cartera
                    </span>
                  </>
                )}

                {/* ── Separador si hay ambos valores ───────────────────────── */}
                {monto > 0 && hasKelly && (
                  <div style={{ width: 64, height: 1, background: '#1a1d2e', margin: '3px 0' }} />
                )}

                {/* ── Sizing Kelly (todos los COMPRAR con edge) ─────────────── */}
                {hasKelly ? (
                  <>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: entryColor, fontWeight: 700 }}>
                      {fmt(kellyAmt, currency)}
                    </span>
                    <span style={{ fontSize: 9, color: entryColor, fontFamily: 'monospace', opacity: 0.8 }}>
                      K: {kellyEff.toFixed(1)}% del capital
                    </span>
                    {(a.volScalar ?? 100) < 100 && (
                      <span style={{ fontSize: 9, color: '#7a7f9a', fontFamily: 'monospace' }}>
                        vol ↓ ×{((a.volScalar ?? 100) / 100).toFixed(2)}
                      </span>
                    )}
                  </>
                ) : isComprar ? (
                  <span style={{ color: '#3a3f55', fontSize: 10, fontFamily: 'monospace' }}>
                    sin edge
                  </span>
                ) : isReducir ? (
                  <span style={{ color: '#f87171', fontSize: 10, fontFamily: 'monospace' }}>
                    reducir exp.
                  </span>
                ) : (
                  <span style={{ color: '#3a3f55', fontSize: 11, fontFamily: 'monospace' }}>—</span>
                )}

              </div>
            </td>
          )
        })()}
      </tr>
    )
  }

  return (
    <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 10, overflow: 'hidden' }}>

      {/* ── Filtros ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1d2e', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 4 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#7a7f9a', letterSpacing: '0.1em' }}>SEÑALES</span>
          {[
            { sig: 'comprar' as SignalType,  count: signalCounts.comprar,  color: '#1D9E75' },
            { sig: 'mantener' as SignalType, count: signalCounts.mantener, color: '#d4af37' },
            { sig: 'reducir' as SignalType,  count: signalCounts.reducir,  color: '#f87171' },
          ].map(({ sig, count, color }) => (
            <button key={sig} onClick={() => { setSignalFilter(signalFilter === sig ? 'all' : sig); setPage(1) }} style={{
              background: signalFilter === sig ? color + '20' : 'transparent',
              border: `1px solid ${signalFilter === sig ? color : '#1a1d2e'}`,
              borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
              fontFamily: 'monospace', fontSize: 10, color,
            }}>
              {SIGNAL_CFG[sig].label[0]} {count}
            </button>
          ))}
        </div>

        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar activo…"
          style={{ background: '#04050a', border: '1px solid #1a1d2e', borderRadius: 6, padding: '5px 10px', color: '#e8e9f0', fontSize: 12, fontFamily: 'monospace', width: 150, outline: 'none' }} />

        <select value={classFilter} onChange={e => { setClassFilter(e.target.value as AssetClass | 'all'); setPage(1) }}
          style={{ background: '#04050a', border: '1px solid #1a1d2e', borderRadius: 6, padding: '5px 10px', color: classFilter !== 'all' ? CLASS_COLOR[classFilter as AssetClass] : '#e8e9f0', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer', outline: 'none' }}>
          <option value="all">Todos los activos</option>
          {CLASS_ORDER.map(c => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
        </select>

        <button onClick={() => setGrouped(g => !g)} style={{
          background: grouped ? '#1a1d2e' : 'transparent', border: '1px solid #1a1d2e',
          borderRadius: 6, padding: '5px 10px', color: grouped ? '#e8e9f0' : '#7a7f9a',
          fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
        }}>
          {grouped ? '≡ Agrupado' : '≡ Agrupar'}
        </button>

        {hasFilters && (
          <button onClick={clearFilters} style={{
            background: 'transparent', border: '1px solid #f87171', borderRadius: 6,
            padding: '5px 10px', color: '#f87171', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
          }}>
            ✕ Limpiar
          </button>
        )}

        <button onClick={() => { setShowAll(v => !v); setPage(1) }} style={{
          background: showAll ? 'transparent' : 'rgba(29,158,117,0.1)',
          border: `1px solid ${showAll ? '#1a1d2e' : '#1D9E75'}`,
          borderRadius: 6, padding: '5px 10px',
          color: showAll ? '#7a7f9a' : '#1D9E75',
          fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
        }}>
          {showAll ? `★ Solo picks (${capitalRecipients.size})` : `☰ Ver todos (${assets.length})`}
        </button>

        <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 11, color: '#3a3f55' }}>
          {filtered.length} activos
        </span>
      </div>

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#04050a' }}>
              <TH label="Activo"    k="name"      />
              <TH label="Clase"                   />
              <TH label="Señal"                   />
              <TH label="Score"     k="score"     />
              <TH label="Conds · EV"              />
              <TH label="Ret. 30d"  k="return30d" />
              <TH label="Ret. 1A"   k="return1y"  />
              <TH label="RSI"       k="rsi"       />
              <TH label="Flujo"     k="netFlow"   />
              {showMonto && <TH label="Sizing (cartera · kelly)" />}
            </tr>
          </thead>
          <tbody>
            {grouped && groupedData ? (
              groupedData.map(({ cls, items }) => (
                <>
                  <tr key={`hdr-${cls}`}>
                    <td colSpan={numCols} style={{
                      padding: '8px 12px 6px', background: '#04050a',
                      borderBottom: `1px solid ${CLASS_COLOR[cls]}40`,
                      borderTop: '1px solid #1a1d2e',
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: CLASS_COLOR[cls], letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                        {CLASS_ICON[cls]}  {CLASS_LABEL[cls].toUpperCase()} · {items.length} activos
                      </span>
                    </td>
                  </tr>
                  {items.map((a, i) => <RowEl key={a.id} a={a} i={i} />)}
                </>
              ))
            ) : (
              visible.map((a, i) => <RowEl key={a.id} a={a} i={i} />)
            )}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={numCols} style={{ padding: '30px', textAlign: 'center', color: '#3a3f55', fontFamily: 'monospace', fontSize: 13 }}>
                  Sin activos con esos filtros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Paginación ────────────────────────────────────────────────────── */}
      {!grouped && pages > 1 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #1a1d2e', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={btnStyle(page !== 1)}>‹ Ant</button>
          <span style={{ fontSize: 11, color: '#7a7f9a', fontFamily: 'monospace', flex: 1, textAlign: 'center' }}>
            {page} / {pages}
          </span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={btnStyle(page !== pages)}>Sig ›</button>
        </div>
      )}
    </div>
  )
}

function btnStyle(enabled: boolean): React.CSSProperties {
  return {
    background: 'transparent', border: `1px solid ${enabled ? '#1a1d2e' : '#0d0f1a'}`, borderRadius: 6,
    padding: '4px 12px', color: enabled ? '#e8e9f0' : '#3a3f55',
    fontSize: 11, fontFamily: 'monospace', cursor: enabled ? 'pointer' : 'not-allowed',
  }
}
