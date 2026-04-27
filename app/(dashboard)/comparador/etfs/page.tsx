'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { C } from '@/app/lib/constants'

const MONO  = 'var(--font-dm-mono)'
const BEBAS = "'Bebas Neue', Impact, sans-serif"

type SortKey = 'r12m' | 'r1m' | 'r3m' | 'r3a' | 'tac' | 'aum' | 'precio' | 'ticker'

type EtfItem = {
  ticker:         string
  nombre:         string
  descripcion:    string | null
  indice:         string | null
  exposicion:     string | null
  sector:         string | null
  divisa:         string
  aum:            number | null
  volumen_avg:    number | null
  expense_ratio:  number | null
  dividend_yield: number | null
  precio:         number | null
  r1m:            number | null
  r3m:            number | null
  r12m:           number | null
  r3a:            number | null
}

type TopCard = { grupo: string; ticker: string | null; nombre: string | null; r12m: number | null; exposicion: string | null; sector: string | null }

type ApiResponse = {
  ok: boolean
  data: EtfItem[]
  total: number; page: number; pages: number
  exposiciones: string[]
  sectores: string[]
  topCards: TopCard[]
  ultima_actualizacion: string | null
}

const EXP_COLOR: Record<string, string> = {
  'USA': '#3b82f6', 'Global': C.gold, 'Emergentes': '#f97316',
  'Global ex USA': C.purple, 'Latam': C.green, 'Chile': C.green,
  'Brasil': '#22d3ee',
}

const fmtUSD  = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtAUM  = (n: number | null) => {
  if (!n) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : null

function PctCell({ v }: { v: number | null }) {
  if (v === null) return <span style={{ color: C.muted }}>—</span>
  const color = v > 0 ? C.green : v < 0 ? C.red : C.dimText
  return <span style={{ color }}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>
}

function ExposicionPill({ v }: { v: string | null }) {
  if (!v) return null
  const color = EXP_COLOR[v] ?? C.dimText
  return (
    <span style={{
      background: color + '1a', color, border: `1px solid ${color}40`,
      borderRadius: 4, padding: '2px 7px', fontSize: 10,
      letterSpacing: '0.08em', fontFamily: MONO, whiteSpace: 'nowrap',
    }}>
      {v}
    </span>
  )
}

export default function EtfsPage() {
  const [searchRaw,  setSearchRaw]  = useState('')
  const [search,     setSearch]     = useState('')
  const [exposicion, setExposicion] = useState('')
  const [sector,     setSector]     = useState('')
  const [view,       setView]       = useState<'tabla' | 'ranking'>('tabla')
  const [etfs,       setEtfs]       = useState<EtfItem[]>([])
  const [exposiciones, setExposiciones] = useState<string[]>([])
  const [sectores,   setSectores]   = useState<string[]>([])
  const [topCards,   setTopCards]   = useState<TopCard[]>([])
  const [loading,    setLoading]    = useState(true)
  const [exporting,  setExporting]  = useState(false)
  const [page,       setPage]       = useState(1)
  const [pages,      setPages]      = useState(0)
  const [total,      setTotal]      = useState(0)
  const [ultimaAct,  setUltimaAct]  = useState<string | null>(null)
  const [sortKey,    setSortKey]    = useState<SortKey>('r12m')
  const [sortDir,    setSortDir]    = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchRaw); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchRaw])

  useEffect(() => { setPage(1) }, [exposicion, sector, sortKey, sortDir])

  const fetchEtfs = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search)     p.set('search',     search)
    if (exposicion) p.set('exposicion', exposicion)
    if (sector)     p.set('sector',     sector)
    p.set('page', String(page))
    p.set('sort', sortKey)
    p.set('dir',  sortDir)

    fetch(`/api/etfs?${p}`)
      .then(r => r.json())
      .then((json: ApiResponse) => {
        if (!json.ok) return
        setEtfs(json.data ?? [])
        setTotal(json.total ?? 0)
        setPages(json.pages ?? 0)
        setUltimaAct(json.ultima_actualizacion ?? null)
        if (json.exposiciones?.length) setExposiciones(json.exposiciones)
        if (json.sectores?.length)     setSectores(json.sectores)
        if (json.topCards?.length)     setTopCards(json.topCards)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search, exposicion, sector, page, sortKey, sortDir])

  useEffect(() => { fetchEtfs() }, [fetchEtfs])

  async function exportCsv() {
    setExporting(true)
    try {
      const p = new URLSearchParams()
      if (search)     p.set('search',     search)
      if (exposicion) p.set('exposicion', exposicion)
      if (sector)     p.set('sector',     sector)
      p.set('sort', sortKey); p.set('dir', sortDir)
      p.set('export', 'csv')
      const res  = await fetch(`/api/etfs?${p}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `etfs-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setExporting(false)
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const maxR12m  = useMemo(() => Math.max(0, ...etfs.map(e => e.r12m ?? 0)), [etfs])
  const ranked   = useMemo(() => [...etfs].sort((a, b) => (b.r12m ?? -999) - (a.r12m ?? -999)), [etfs])
  const isEmpty  = !loading && etfs.length === 0

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontFamily: MONO,
    background: active ? C.gold : C.surface,
    color:      active ? '#000' : C.dimText,
    border:     `1px solid ${active ? C.gold : C.border}`,
    cursor: 'pointer', transition: 'all 0.15s',
  })

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', fontSize: 11, fontFamily: MONO, letterSpacing: '0.15em',
    textTransform: 'uppercase', cursor: 'pointer', border: 'none',
    background: active ? C.gold : C.surface,
    color:      active ? '#000' : C.dimText,
    transition: 'all 0.15s',
  })

  const COLS: { label: string; key?: SortKey; align: 'left' | 'right' }[] = [
    { label: 'Ticker',       key: 'ticker',  align: 'left'  },
    { label: 'Nombre',                        align: 'left'  },
    { label: 'Exposición',                    align: 'left'  },
    { label: 'Precio USD',   key: 'precio',  align: 'right' },
    { label: '1M%',          key: 'r1m',     align: 'right' },
    { label: '3M%',          key: 'r3m',     align: 'right' },
    { label: '12M%',         key: 'r12m',    align: 'right' },
    { label: '3A%',          key: 'r3a',     align: 'right' },
    { label: 'Exp. Ratio',   key: 'tac',     align: 'right' },
    { label: 'Div. Yield',                    align: 'right' },
    { label: 'AUM',          key: 'aum',     align: 'right' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 24px', fontFamily: MONO }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: BEBAS, fontSize: 32, color: C.text, letterSpacing: '0.05em' }}>
            COMPARADOR · ETFs
          </div>
          {loading ? (
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.dimText, background: C.surface, border: `1px solid ${C.border}`, padding: '3px 8px', borderRadius: 4 }}>
              CARGANDO…
            </span>
          ) : ultimaAct ? (
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.green, background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.3)', padding: '3px 8px', borderRadius: 4 }}>
              ● LIVE · {total} ETFs
            </span>
          ) : (
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.dimText, background: C.surface, border: `1px solid ${C.border}`, padding: '3px 8px', borderRadius: 4 }}>SIN SYNC</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.dimText, marginTop: 4 }}>
          {ultimaAct
            ? `Yahoo Finance · Supabase · Actualizado ${fmtDate(ultimaAct)} · Precios en USD`
            : 'Ejecuta npx tsx scripts/sync-etfs.ts para cargar los datos'}
        </div>
      </div>

      {/* ── TOP CARDS ──────────────────────────────────────────────────────────── */}
      {topCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 24 }}>
          {topCards.map(t => {
            const color = EXP_COLOR[t.exposicion ?? ''] ?? C.gold
            const icon = t.grupo === 'USA' ? '🇺🇸' : t.grupo === 'Global' ? '🌍' : t.grupo === 'Emergentes' ? '🌏' : '📊'
            return (
              <div key={t.grupo} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderTop: `2px solid ${color}`, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color }}>{t.grupo}</span>
                </div>
                <div style={{ fontFamily: BEBAS, fontSize: 20, color: C.text, letterSpacing: '0.06em', marginBottom: 2 }}>
                  {t.ticker ?? '—'}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: C.dimText, marginBottom: 6, lineHeight: 1.3 }}>
                  {t.nombre ?? ''}
                </div>
                {t.r12m !== null && (
                  <div style={{ fontFamily: BEBAS, fontSize: 22, color, letterSpacing: '0.04em' }}>
                    {t.r12m > 0 ? '+' : ''}{t.r12m.toFixed(2)}%
                    <span style={{ fontFamily: MONO, fontSize: 9, color: C.dimText, marginLeft: 6 }}>12M</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── CONTROLES ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24, alignItems: 'flex-end' }}>

        {/* Search */}
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6, textTransform: 'uppercase' }}>Buscar</div>
          <input type="text" value={searchRaw} onChange={e => setSearchRaw(e.target.value)} placeholder="ticker o nombre…"
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13, fontFamily: MONO, width: 180, outline: 'none' }} />
        </div>

        {/* Exposición */}
        {exposiciones.length > 0 && (
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6, textTransform: 'uppercase' }}>Exposición</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setExposicion('')} style={pill(!exposicion)}>Todas</button>
              {exposiciones.map(e => (
                <button key={e} onClick={() => setExposicion(e === exposicion ? '' : e)} style={pill(exposicion === e)}>{e}</button>
              ))}
            </div>
          </div>
        )}

        {/* Sector */}
        {sectores.length > 0 && (
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6, textTransform: 'uppercase' }}>Sector</div>
            <select value={sector} onChange={e => setSector(e.target.value)}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: sector ? C.text : C.dimText, fontSize: 13, fontFamily: MONO, outline: 'none', cursor: 'pointer' }}>
              <option value="">Todos los sectores</option>
              {sectores.map(s => <option key={s} value={s!}>{s}</option>)}
            </select>
          </div>
        )}

        {/* Botones derecha */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={exportCsv} disabled={exporting || loading} style={{
            padding: '8px 14px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
            background: 'transparent', color: exporting ? C.muted : C.gold,
            border: `1px solid ${exporting ? C.border : C.gold + '60'}`,
            cursor: exporting ? 'default' : 'pointer', borderRadius: 6,
          }}>
            {exporting ? 'EXPORTANDO…' : '↓ CSV'}
          </button>
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('tabla')}   style={toggleBtn(view === 'tabla')}>Tabla</button>
            <button onClick={() => setView('ranking')} style={toggleBtn(view === 'ranking')}>Ranking</button>
          </div>
        </div>
      </div>

      {/* ── EMPTY STATE ────────────────────────────────────────────────────────── */}
      {isEmpty && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontFamily: BEBAS, fontSize: 22, color: C.dimText, letterSpacing: '0.08em', marginBottom: 8 }}>SIN DATOS</div>
          <div style={{ fontSize: 12, color: C.dimText, maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            {search || exposicion || sector
              ? 'No hay ETFs que coincidan con los filtros.'
              : <>Ejecuta el sync para cargar los datos:<br /><code style={{ color: C.gold }}>npx tsx scripts/sync-etfs.ts</code></>}
          </div>
        </div>
      )}

      {/* ── TABLA ──────────────────────────────────────────────────────────────── */}
      {!isEmpty && view === 'tabla' && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {COLS.map(col => {
                    const isActive = col.key && sortKey === col.key
                    const arrow    = isActive ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''
                    return (
                      <th key={col.label} onClick={col.key ? () => handleSort(col.key!) : undefined}
                        style={{
                          padding: '12px 14px', textAlign: col.align, fontSize: 10,
                          letterSpacing: '0.15em', color: isActive ? C.gold : C.dimText,
                          textTransform: 'uppercase', fontWeight: 500, fontFamily: MONO,
                          whiteSpace: 'nowrap', cursor: col.key ? 'pointer' : 'default', userSelect: 'none',
                        }}
                      >
                        {col.label}{arrow}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {etfs.map((e, i) => {
                  const isBest = e.r12m === maxR12m && maxR12m > 0
                  return (
                    <tr key={e.ticker} style={{
                      borderBottom: i < etfs.length - 1 ? `1px solid ${C.border}` : 'none',
                      background:   isBest ? 'rgba(212,175,55,0.04)' : 'transparent',
                    }}>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontFamily: BEBAS, fontSize: 18, color: isBest ? C.gold : C.text, letterSpacing: '0.06em' }}>
                          {e.ticker}
                        </span>
                        {isBest && <span style={{ marginLeft: 8, fontSize: 9, color: C.gold, background: 'rgba(212,175,55,0.12)', padding: '2px 6px', borderRadius: 4 }}>★ TOP</span>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontFamily: MONO, fontSize: 11, color: C.text, maxWidth: 220 }}>{e.nombre}</div>
                        {e.indice && <div style={{ fontFamily: MONO, fontSize: 9, color: C.dimText, marginTop: 2 }}>{e.indice}</div>}
                      </td>
                      <td style={{ padding: '12px 14px' }}><ExposicionPill v={e.exposicion} /></td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12, color: C.text }}>
                        {e.precio != null ? fmtUSD(e.precio) : <span style={{ color: C.muted }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12 }}><PctCell v={e.r1m} /></td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12 }}><PctCell v={e.r3m} /></td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12, fontWeight: 600 }}><PctCell v={e.r12m} /></td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12 }}><PctCell v={e.r3a} /></td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12, color: C.dimText }}>
                        {e.expense_ratio != null ? `${e.expense_ratio.toFixed(2)}%` : <span style={{ color: C.muted }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12, color: C.green }}>
                        {e.dividend_yield != null ? `${e.dividend_yield.toFixed(2)}%` : <span style={{ color: C.muted }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12, color: C.dimText }}>
                        {fmtAUM(e.aum)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── RANKING ────────────────────────────────────────────────────────────── */}
      {!isEmpty && view === 'ranking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranked.map((e, i) => {
            const isFirst = i === 0
            return (
              <div key={e.ticker} style={{
                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                background: isFirst ? 'rgba(212,175,55,0.06)' : C.surface,
                border: `1px solid ${isFirst ? C.gold : C.border}`,
                borderRadius: 10, padding: '14px 18px',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isFirst ? C.gold : C.muted + '30',
                  color: isFirst ? '#000' : C.dimText,
                  fontFamily: MONO, fontSize: 12, fontWeight: 700,
                }}>
                  {(page - 1) * 50 + i + 1}
                </div>
                <div style={{ minWidth: 60 }}>
                  <div style={{ fontFamily: BEBAS, fontSize: 22, color: isFirst ? C.gold : C.text, letterSpacing: '0.06em' }}>{e.ticker}</div>
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontFamily: MONO, fontSize: 12, color: isFirst ? C.gold : C.text }}>{e.nombre}</div>
                  {e.indice && <div style={{ fontFamily: MONO, fontSize: 10, color: C.dimText, marginTop: 2 }}>{e.indice}</div>}
                </div>
                <ExposicionPill v={e.exposicion} />
                {e.sector && (
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.dimText, background: C.muted + '20', padding: '2px 8px', borderRadius: 4 }}>{e.sector}</span>
                )}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: MONO, fontSize: 20, color: (e.r12m ?? 0) >= 0 ? C.green : C.red }}>
                    {e.r12m != null ? `${e.r12m > 0 ? '+' : ''}${e.r12m.toFixed(2)}%` : '—'}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.dimText }}>12 meses</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 90 }}>
                  <div style={{ fontFamily: MONO, fontSize: 13, color: C.text }}>
                    {e.precio != null ? fmtUSD(e.precio) : '—'}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.dimText }}>USD</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 70 }}>
                  <div style={{ fontFamily: MONO, fontSize: 13, color: C.dimText }}>{fmtAUM(e.aum)}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.dimText }}>AUM</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── PAGINACIÓN ─────────────────────────────────────────────────────────── */}
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{
            padding: '7px 16px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
            background: page <= 1 ? C.bg : C.surface, color: page <= 1 ? C.muted : C.dimText,
            border: `1px solid ${C.border}`, borderRadius: 6, cursor: page <= 1 ? 'default' : 'pointer',
          }}>← ANTERIOR</button>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.dimText }}>{page} / {pages} · {total} ETFs</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} style={{
            padding: '7px 16px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
            background: page >= pages ? C.bg : C.surface, color: page >= pages ? C.muted : C.dimText,
            border: `1px solid ${C.border}`, borderRadius: 6, cursor: page >= pages ? 'default' : 'pointer',
          }}>SIGUIENTE →</button>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 28, paddingTop: 14, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.dimText, fontFamily: MONO }}>
        Fuente: Yahoo Finance · Supabase · Precios en USD · Rentabilidades pasadas no garantizan resultados futuros
      </div>
    </div>
  )
}
