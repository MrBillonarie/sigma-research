'use client'
import { useState, useMemo } from 'react'
import type { Asset, AssetClass, SignalType } from '@/types/decision-engine'

const SIGNAL_CFG: Record<SignalType, { label: string; color: string; bg: string }> = {
  comprar:  { label: 'COMPRAR',  color: '#1D9E75', bg: 'rgba(29,158,117,0.12)'  },
  mantener: { label: 'MANTENER', color: '#d4af37', bg: 'rgba(212,175,55,0.12)'  },
  reducir:  { label: 'REDUCIR',  color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  neutral:  { label: 'NEUTRAL',  color: '#7a7f9a', bg: 'rgba(122,127,154,0.12)' },
}

const CLASS_LABEL: Record<AssetClass, string> = {
  fondos: 'Fondo Mutuo', etfs: 'ETF', renta_fija: 'Renta Fija', crypto: 'Crypto',
}

const CLASS_COLOR: Record<AssetClass, string> = {
  fondos: '#1D9E75', etfs: '#378ADD', renta_fija: '#d4af37', crypto: '#a78bfa',
}

function SignalBadge({ signal }: { signal: SignalType }) {
  const c = SIGNAL_CFG[signal]
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
      color: c.color, background: c.bg,
      borderRadius: 4, padding: '3px 8px', whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}

function Pct({ v }: { v: number }) {
  const color = v > 0 ? '#1D9E75' : v < 0 ? '#f87171' : '#7a7f9a'
  return (
    <span style={{ color, fontFamily: 'monospace', fontSize: 12 }}>
      {v > 0 ? '+' : ''}{v.toFixed(1)}%
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color = score > 65 ? '#1D9E75' : score > 45 ? '#d4af37' : '#f87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 60, height: 4, background: '#1a1d2e',
        borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color, fontFamily: 'monospace', minWidth: 24 }}>{score}</span>
    </div>
  )
}

interface Props {
  assets: Asset[]
}

type SortKey = 'name' | 'score' | 'return30d' | 'return1y' | 'rsi' | 'netFlow'

export default function SignalTable({ assets }: Props) {
  const [classFilter,  setClassFilter]  = useState<AssetClass | 'all'>('all')
  const [signalFilter, setSignalFilter] = useState<SignalType | 'all'>('all')
  const [search,       setSearch]       = useState('')
  const [sortKey,      setSortKey]      = useState<SortKey>('score')
  const [sortDesc,     setSortDesc]     = useState(true)
  const [page,         setPage]         = useState(1)
  const PER_PAGE = 15

  const filtered = useMemo(() => {
    let r = assets
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

  const pages   = Math.ceil(filtered.length / PER_PAGE)
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDesc(d => !d)
    else { setSortKey(k); setSortDesc(true) }
    setPage(1)
  }

  const TH = ({ label, k }: { label: string; k?: SortKey }) => (
    <th
      onClick={k ? () => toggleSort(k) : undefined}
      style={{
        padding: '8px 12px', textAlign: 'left', fontSize: 10,
        color: k && sortKey === k ? '#e8e9f0' : '#7a7f9a',
        fontFamily: 'monospace', letterSpacing: 0.5, textTransform: 'uppercase',
        cursor: k ? 'pointer' : 'default', whiteSpace: 'nowrap',
        userSelect: 'none',
        borderBottom: '1px solid #1a1d2e',
      }}
    >
      {label}{k && sortKey === k ? (sortDesc ? ' ↓' : ' ↑') : ''}
    </th>
  )

  return (
    <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 10, overflow: 'hidden' }}>
      {/* Filtros */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #1a1d2e',
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <h3 style={{
          margin: 0, fontSize: 12, color: '#7a7f9a',
          fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase',
          marginRight: 4,
        }}>
          SEÑALES ({filtered.length})
        </h3>

        {/* Búsqueda */}
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Buscar activo..."
          style={{
            background: '#04050a', border: '1px solid #1a1d2e',
            borderRadius: 6, padding: '5px 10px', color: '#e8e9f0',
            fontSize: 12, fontFamily: 'monospace', width: 160, outline: 'none',
          }}
        />

        {/* Filtro clase */}
        <select
          value={classFilter}
          onChange={e => { setClassFilter(e.target.value as AssetClass | 'all'); setPage(1) }}
          style={{
            background: '#04050a', border: '1px solid #1a1d2e',
            borderRadius: 6, padding: '5px 10px', color: '#e8e9f0',
            fontSize: 12, fontFamily: 'monospace', cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="all">Todos los activos</option>
          <option value="fondos">Fondos Mutuos</option>
          <option value="etfs">ETFs</option>
          <option value="renta_fija">Renta Fija</option>
          <option value="crypto">Crypto</option>
        </select>

        {/* Filtro señal */}
        <select
          value={signalFilter}
          onChange={e => { setSignalFilter(e.target.value as SignalType | 'all'); setPage(1) }}
          style={{
            background: '#04050a', border: '1px solid #1a1d2e',
            borderRadius: 6, padding: '5px 10px', color: '#e8e9f0',
            fontSize: 12, fontFamily: 'monospace', cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="all">Todas las señales</option>
          <option value="comprar">COMPRAR</option>
          <option value="mantener">MANTENER</option>
          <option value="reducir">REDUCIR</option>
          <option value="neutral">NEUTRAL</option>
        </select>
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#04050a' }}>
              <TH label="Activo"    k="name"     />
              <TH label="Clase"                  />
              <TH label="Señal"                  />
              <TH label="Score"     k="score"    />
              <TH label="Ret. 30d"  k="return30d"/>
              <TH label="Ret. 1A"   k="return1y" />
              <TH label="RSI"       k="rsi"      />
              <TH label="Flujo"     k="netFlow"  />
            </tr>
          </thead>
          <tbody>
            {visible.map((a, i) => (
              <tr
                key={a.id}
                style={{
                  borderBottom: '1px solid #0d0f1a',
                  background: i % 2 === 0 ? 'transparent' : '#04050a22',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1a1d2e33')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : '#04050a22')}
              >
                <td style={{ padding: '8px 12px', maxWidth: 240 }}>
                  <div style={{
                    fontSize: 12, color: '#e8e9f0', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.name}
                  </div>
                  {a.ticker && (
                    <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: 'monospace' }}>
                      {a.ticker}
                    </div>
                  )}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    fontSize: 10, color: CLASS_COLOR[a.assetClass], fontFamily: 'monospace',
                  }}>
                    {CLASS_LABEL[a.assetClass]}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <SignalBadge signal={a.signal} />
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <ScoreBar score={a.score} />
                </td>
                <td style={{ padding: '8px 12px' }}><Pct v={a.return30d} /></td>
                <td style={{ padding: '8px 12px' }}><Pct v={a.return1y}  /></td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: '#7a7f9a' }}>
                  {a.rsi.toFixed(0)}
                </td>
                <td style={{ padding: '8px 12px' }}><Pct v={a.netFlow} /></td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} style={{
                  padding: '30px', textAlign: 'center',
                  color: '#3a3f55', fontFamily: 'monospace', fontSize: 13,
                }}>
                  Sin activos con esos filtros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div style={{
          padding: '10px 16px', borderTop: '1px solid #1a1d2e',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={btnStyle(page !== 1)}
          >
            ‹ Ant
          </button>
          <span style={{ fontSize: 11, color: '#7a7f9a', fontFamily: 'monospace', flex: 1, textAlign: 'center' }}>
            {page} / {pages} — {filtered.length} activos
          </span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
            style={btnStyle(page !== pages)}
          >
            Sig ›
          </button>
        </div>
      )}
    </div>
  )
}

function btnStyle(enabled: boolean) {
  return {
    background: 'transparent',
    border: `1px solid ${enabled ? '#1a1d2e' : '#0d0f1a'}`,
    borderRadius: 6, padding: '4px 12px',
    color: enabled ? '#e8e9f0' : '#3a3f55',
    fontSize: 11, fontFamily: 'monospace', cursor: enabled ? 'pointer' : 'not-allowed',
  }
}
