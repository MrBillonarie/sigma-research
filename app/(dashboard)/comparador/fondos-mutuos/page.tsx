'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { C } from '@/app/lib/constants'

const MONO  = 'var(--font-dm-mono)'
const BEBAS = "'Bebas Neue', Impact, sans-serif"

type SortKey = 'r12m' | 'r1m' | 'r3m' | 'r3a' | 'tac' | 'nombre'

type FondoItem = {
  nombre: string; adm: string; tipo: string; riesgo: number
  r1m: number; r3m: number; r1a: number; r3a: number | null
  tac: number | null; minCLP: number; source?: 'live' | 'static'
}

type TopCategoria = { categoria: string; nombre: string | null; adm: string | null; r12m: number | null }

type ApiResponse = {
  ok: boolean; data: FondoItem[]
  total: number; page: number; pages: number; liveCount: number
  agfs: string[]; ultima_actualizacion: string | null
  topPorCategoria?: TopCategoria[]
}

type Tipo = 'todos' | 'renta fija' | 'conservador' | 'moderado' | 'agresivo' | 'etf'

const FILTROS: { label: string; value: Tipo }[] = [
  { label: 'Todos',       value: 'todos'       },
  { label: 'Renta Fija',  value: 'renta fija'  },
  { label: 'Conservador', value: 'conservador' },
  { label: 'Moderado',    value: 'moderado'    },
  { label: 'Agresivo',    value: 'agresivo'    },
  { label: 'ETF Singular', value: 'etf'         },
]

const RISK_COLOR: Record<number, string> = { 1: C.green, 2: '#3b82f6', 3: C.gold, 4: C.purple, 5: C.red }
const RISK_LABEL: Record<number, string> = { 1: 'Bajo', 2: 'Bajo-Med', 3: 'Medio', 4: 'Med-Alto', 5: 'Alto' }
const CAT_COLOR: Record<string, string>  = { 'renta fija': C.green, conservador: '#3b82f6', moderado: C.gold, agresivo: C.red }
const CAT_ICON:  Record<string, string>  = { 'renta fija': '🏦', conservador: '🛡️', moderado: '⚖️', agresivo: '🚀' }

const fmtCLP  = (n: number)         => '$' + Math.round(n).toLocaleString('es-CL')
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : null

function PctCell({ v }: { v: number | null }) {
  if (v === null) return <span style={{ color: C.muted }}>—</span>
  const color = v > 0 ? C.green : v < 0 ? C.red : C.dimText
  return <span style={{ color }}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>
}

function RiesgoPill({ n }: { n: number }) {
  const color = RISK_COLOR[n] ?? C.dimText
  return (
    <span style={{
      background: color + '1a', color, border: `1px solid ${color}40`,
      borderRadius: 4, padding: '2px 7px', fontSize: 10, letterSpacing: '0.1em',
      fontFamily: MONO, whiteSpace: 'nowrap',
    }}>
      {n} · {RISK_LABEL[n] ?? '—'}
    </span>
  )
}

export default function FondosMutuosPage() {
  const [monto,     setMonto]     = useState(5_000_000)
  const [filtro,    setFiltro]    = useState<Tipo>('todos')
  const [agf,       setAgf]       = useState('')
  const [searchRaw, setSearchRaw] = useState('')
  const [search,    setSearch]    = useState('')
  const [view,      setView]      = useState<'tabla' | 'ranking'>('tabla')
  const [fondos,    setFondos]    = useState<FondoItem[]>([])
  const [agfs,      setAgfs]      = useState<string[]>([])
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const [page,      setPage]      = useState(1)
  const [pages,     setPages]     = useState(0)
  const [total,     setTotal]     = useState(0)
  const [ultimaAct, setUltimaAct] = useState<string | null>(null)
  const [topCat,    setTopCat]    = useState<TopCategoria[]>([])
  const [sortKey,   setSortKey]   = useState<SortKey>('r12m')
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('desc')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchRaw); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchRaw])

  useEffect(() => { setPage(1) }, [filtro, agf, sortKey, sortDir])

  const fetchFondos = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search)             p.set('search', search)
    if (agf)                p.set('agf', agf)
    if (filtro !== 'todos') p.set('tipo', filtro)
    p.set('page', String(page))
    p.set('sort', sortKey)
    p.set('dir',  sortDir)

    fetch(`/api/cmf/fondos-mutuos?${p}`)
      .then(r => r.json())
      .then((json: ApiResponse) => {
        if (!json.ok) return
        setFondos(json.data ?? [])
        setTotal(json.total ?? 0)
        setPages(json.pages ?? 0)
        setUltimaAct(json.ultima_actualizacion ?? null)
        if (json.agfs?.length) setAgfs(json.agfs)
        if (json.topPorCategoria?.length) setTopCat(json.topPorCategoria)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search, agf, filtro, page, sortKey, sortDir])

  useEffect(() => { fetchFondos() }, [fetchFondos])

  // ── Exportar CSV ─────────────────────────────────────────────────────────────
  async function exportCsv() {
    setExporting(true)
    try {
      const p = new URLSearchParams()
      if (search)             p.set('search', search)
      if (agf)                p.set('agf', agf)
      if (filtro !== 'todos') p.set('tipo', filtro)
      p.set('sort', sortKey); p.set('dir', sortDir)
      p.set('export', 'csv')
      const res  = await fetch(`/api/cmf/fondos-mutuos?${p}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `fondos-mutuos-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setExporting(false)
  }

  // ── Sort handler ─────────────────────────────────────────────────────────────
  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const maxR1a  = useMemo(() => Math.max(0, ...fondos.map(f => f.r1a)), [fondos])
  const ranked  = useMemo(() => [...fondos].sort((a, b) => b.r1a - a.r1a), [fondos])
  const isEmpty = !loading && fondos.length === 0

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

  // Columnas con su sortKey
  const COLS: { label: string; key?: SortKey; align: 'left' | 'right' }[] = [
    { label: 'Fondo',          key: 'nombre', align: 'left'  },
    { label: 'Administradora',               align: 'left'  },
    { label: 'Riesgo',                        align: 'right' },
    { label: '1M%',            key: 'r1m',   align: 'right' },
    { label: '3M%',            key: 'r3m',   align: 'right' },
    { label: '12M%',           key: 'r12m',  align: 'right' },
    { label: '3A%',            key: 'r3a',   align: 'right' },
    { label: 'TAC%',           key: 'tac',   align: 'right' },
    { label: 'Ganancia est.',               align: 'right' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 24px', fontFamily: MONO }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: BEBAS, fontSize: 32, color: C.text, letterSpacing: '0.05em' }}>
            COMPARADOR · FONDOS MUTUOS
          </div>
          {loading ? (
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.dimText, background: C.surface, border: `1px solid ${C.border}`, padding: '3px 8px', borderRadius: 4 }}>
              CARGANDO…
            </span>
          ) : ultimaAct ? (
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.green, background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.3)', padding: '3px 8px', borderRadius: 4 }}>
              ● LIVE · {total} fondos
            </span>
          ) : (
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.dimText, background: C.surface, border: `1px solid ${C.border}`, padding: '3px 8px', borderRadius: 4 }}>SIN SYNC</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.dimText, marginTop: 4 }}>
          {ultimaAct ? `Fintual API · Supabase · Actualizado ${fmtDate(ultimaAct)}` : 'Ejecuta el primer sync para cargar todos los fondos'}
        </div>
      </div>

      {/* ── TOP POR CATEGORÍA ──────────────────────────────────────────────────── */}
      {topCat.length > 0 && filtro !== 'etf' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 24 }}>
          {topCat.map(t => {
            const color = CAT_COLOR[t.categoria] ?? C.gold
            const icon  = CAT_ICON[t.categoria]  ?? '📊'
            return (
              <div key={t.categoria} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderTop: `2px solid ${color}`, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color }}>{t.categoria}</span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: C.text, marginBottom: 4, lineHeight: 1.3 }}>
                  {t.nombre ?? '—'}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: C.dimText, marginBottom: 6 }}>
                  {t.adm ?? ''}
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

        {/* Monto */}
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6, textTransform: 'uppercase' }}>Monto CLP</div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.dimText, fontSize: 13, pointerEvents: 'none' }}>$</span>
            <input type="number" value={monto} onChange={e => setMonto(Math.max(0, Number(e.target.value)))}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px 8px 24px', color: C.text, fontSize: 13, fontFamily: MONO, width: 160, outline: 'none' }} />
          </div>
        </div>

        {/* Search */}
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6, textTransform: 'uppercase' }}>Buscar</div>
          <input type="text" value={searchRaw} onChange={e => setSearchRaw(e.target.value)} placeholder="nombre del fondo…"
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13, fontFamily: MONO, width: 200, outline: 'none' }} />
        </div>

        {/* AGF */}
        {agfs.length > 0 && (
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6, textTransform: 'uppercase' }}>Administradora</div>
            <select value={agf} onChange={e => setAgf(e.target.value)}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: agf ? C.text : C.dimText, fontSize: 13, fontFamily: MONO, outline: 'none', cursor: 'pointer' }}>
              <option value="">Todas las AGF</option>
              {agfs.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}

        {/* Tipo */}
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6, textTransform: 'uppercase' }}>Tipo</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTROS.map(f => (
              <button key={f.value} onClick={() => setFiltro(f.value)} style={pill(filtro === f.value)}>{f.label}</button>
            ))}
          </div>
        </div>

        {/* Botones derecha */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Exportar CSV */}
          <button onClick={exportCsv} disabled={exporting || loading} style={{
            padding: '8px 14px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
            background: 'transparent', color: exporting ? C.muted : C.gold,
            border: `1px solid ${exporting ? C.border : C.gold + '60'}`,
            cursor: exporting ? 'default' : 'pointer', borderRadius: 6,
          }}>
            {exporting ? 'EXPORTANDO…' : '↓ CSV'}
          </button>
          {/* Vista */}
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
            {search || agf || filtro !== 'todos' ? 'No hay fondos que coincidan con los filtros.' : 'La base de datos está vacía. Ejecuta el primer sync.'}
          </div>
        </div>
      )}

      {/* ── TABLA CON COLUMNAS ORDENABLES ──────────────────────────────────────── */}
      {!isEmpty && view === 'tabla' && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {COLS.map(col => {
                    const isActive = col.key && sortKey === col.key
                    const arrow    = isActive ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''
                    return (
                      <th
                        key={col.label}
                        onClick={col.key ? () => handleSort(col.key!) : undefined}
                        style={{
                          padding: '12px 14px',
                          textAlign: col.align,
                          fontSize: 10, letterSpacing: '0.15em',
                          color: isActive ? C.gold : C.dimText,
                          textTransform: 'uppercase', fontWeight: 500, fontFamily: MONO,
                          whiteSpace: 'nowrap',
                          cursor: col.key ? 'pointer' : 'default',
                          userSelect: 'none',
                        }}
                      >
                        {col.label}{arrow}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {fondos.map((f, i) => {
                  const isBest   = f.r1a === maxR1a && maxR1a > 0
                  const ganancia = monto * (f.r1a / 100)
                  return (
                    <tr key={`${f.nombre}-${i}`} style={{
                      borderBottom: i < fondos.length - 1 ? `1px solid ${C.border}` : 'none',
                      background:   isBest ? 'rgba(212,175,55,0.04)' : 'transparent',
                    }}>
                      <td style={{ padding: '12px 14px', fontFamily: MONO, fontSize: 12, color: isBest ? C.gold : C.text, whiteSpace: 'nowrap' }}>
                        {f.nombre}
                        {isBest && <span style={{ marginLeft: 8, fontSize: 9, color: C.gold, background: 'rgba(212,175,55,0.12)', padding: '2px 6px', borderRadius: 4 }}>★ TOP</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: MONO, fontSize: 12, color: C.dimText, whiteSpace: 'nowrap' }}>{f.adm}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}><RiesgoPill n={f.riesgo} /></td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12 }}><PctCell v={f.r1m} /></td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12 }}><PctCell v={f.r3m} /></td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12, fontWeight: 600 }}><PctCell v={f.r1a} /></td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12 }}><PctCell v={f.r3a} /></td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12, color: C.dimText }}>
                        {f.tac != null ? `${f.tac.toFixed(2)}%` : <span style={{ color: C.muted }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12, color: C.green }}>{fmtCLP(ganancia)}</td>
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
          {ranked.map((f, i) => {
            const isFirst  = i === 0
            const ganancia = monto * (f.r1a / 100)
            return (
              <div key={`${f.nombre}-${i}`} style={{
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
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontFamily: MONO, fontSize: 13, color: isFirst ? C.gold : C.text }}>
                    {f.nombre}
                    {isFirst && <span style={{ marginLeft: 8, fontSize: 9, color: C.gold, background: 'rgba(212,175,55,0.15)', padding: '2px 7px', borderRadius: 4 }}>MEJOR 12M</span>}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: C.dimText, marginTop: 2 }}>{f.adm}</div>
                </div>
                <RiesgoPill n={f.riesgo} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: MONO, fontSize: 20, color: f.r1a >= 0 ? C.green : C.red }}>{f.r1a > 0 ? '+' : ''}{f.r1a.toFixed(2)}%</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.dimText }}>12 meses</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 110 }}>
                  <div style={{ fontFamily: MONO, fontSize: 14, color: C.green }}>{fmtCLP(ganancia)}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.dimText }}>ganancia est.</div>
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
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.dimText }}>{page} / {pages} · {total} fondos</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} style={{
            padding: '7px 16px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
            background: page >= pages ? C.bg : C.surface, color: page >= pages ? C.muted : C.dimText,
            border: `1px solid ${C.border}`, borderRadius: 6, cursor: page >= pages ? 'default' : 'pointer',
          }}>SIGUIENTE →</button>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 28, paddingTop: 14, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.dimText, fontFamily: MONO }}>
        {ultimaAct
          ? `Fuente: Fintual API + Supabase · Sync diario 2am UTC · Rentabilidades pasadas no garantizan resultados futuros`
          : 'Fuente: Fintual API (pública) · Ejecuta el sync para cargar datos'}
      </div>
    </div>
  )
}
