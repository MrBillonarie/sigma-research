'use client'
import { useState, useMemo, useEffect } from 'react'
import { C } from '@/app/lib/constants'

const MONO  = 'var(--font-dm-mono)'
const BEBAS = "'Bebas Neue', Impact, sans-serif"

type FondoItem = {
  nombre: string; adm: string; tipo: string; riesgo: number
  r1m: number; r3m: number; r1a: number; r3a: number | null
  tac: number; minCLP: number; source?: 'live' | 'static'
}

const FONDOS_STATIC: FondoItem[] = [
  { nombre: 'LarrainVial Enfoque LV',   adm: 'LarrainVial AGF', tipo: 'agresivo',    riesgo: 5, r1m:  1.80, r3m: 7.20, r1a: 22.30, r3a: 41.20, tac: 1.95, minCLP: 500000 },
  { nombre: 'Risky Norris',             adm: 'Fintual',         tipo: 'agresivo',    riesgo: 5, r1m:  1.32, r3m: 9.94, r1a: 18.50, r3a: null,  tac: 1.19, minCLP: 1000   },
  { nombre: 'BTG Pactual Acciones CL',  adm: 'BTG Pactual AGF', tipo: 'agresivo',    riesgo: 4, r1m: -0.50, r3m: 4.20, r1a: 13.20, r3a: 26.80, tac: 1.60, minCLP: 500000 },
  { nombre: 'Moderate Pitt',            adm: 'Fintual',         tipo: 'moderado',    riesgo: 3, r1m:  1.10, r3m: 6.06, r1a:  9.61, r3a: null,  tac: 1.19, minCLP: 1000   },
  { nombre: 'Sura Acciones Chile',      adm: 'Sura AGF',        tipo: 'moderado',    riesgo: 3, r1m:  0.20, r3m: 3.50, r1a:  8.40, r3a: 18.20, tac: 1.40, minCLP: 100000 },
  { nombre: 'Conservative Clooney',    adm: 'Fintual',         tipo: 'conservador', riesgo: 2, r1m:  0.53, r3m: 2.90, r1a:  8.79, r3a: null,  tac: 1.19, minCLP: 1000   },
  { nombre: 'Security Plus',           adm: 'Security AGF',    tipo: 'renta fija',  riesgo: 1, r1m:  0.41, r3m: 1.78, r1a:  5.15, r3a: 11.80, tac: 0.68, minCLP: 100000 },
  { nombre: 'BTG Pactual Renta Corto', adm: 'BTG Pactual AGF', tipo: 'renta fija',  riesgo: 1, r1m:  0.42, r3m: 1.75, r1a:  5.10, r3a: null,  tac: 0.60, minCLP: 100000 },
  { nombre: 'BCI Competitivo',         adm: 'BCI Asset Mgmt',  tipo: 'renta fija',  riesgo: 1, r1m:  0.38, r3m: 1.65, r1a:  4.90, r3a: 11.20, tac: 0.70, minCLP: 50000  },
  { nombre: 'Sura Renta Depósito',     adm: 'Sura AGF',        tipo: 'renta fija',  riesgo: 1, r1m:  0.39, r3m: 1.70, r1a:  5.00, r3a: 11.00, tac: 0.75, minCLP: 100000 },
  { nombre: 'Very Conservative Streep',adm: 'Fintual',         tipo: 'conservador', riesgo: 1, r1m:  0.30, r3m: 1.20, r1a:  4.80, r3a: null,  tac: 1.19, minCLP: 1000   },
]

type Tipo = 'todos' | 'renta fija' | 'conservador' | 'moderado' | 'agresivo'

const FILTROS: { label: string; value: Tipo }[] = [
  { label: 'Todos',       value: 'todos'       },
  { label: 'Renta Fija',  value: 'renta fija'  },
  { label: 'Conservador', value: 'conservador' },
  { label: 'Moderado',    value: 'moderado'    },
  { label: 'Agresivo',    value: 'agresivo'    },
]

const RISK_COLOR: Record<number, string> = {
  1: C.green,
  2: '#3b82f6',
  3: C.gold,
  4: C.purple,
  5: C.red,
}

const RISK_LABEL: Record<number, string> = {
  1: 'Bajo',
  2: 'Bajo-Med',
  3: 'Medio',
  4: 'Med-Alto',
  5: 'Alto',
}

function fmtCLP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CL')
}

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
      {n} · {RISK_LABEL[n]}
    </span>
  )
}

export default function FondosMutuosPage() {
  const [monto,     setMonto]     = useState(5_000_000)
  const [filtro,    setFiltro]    = useState<Tipo>('todos')
  const [view,      setView]      = useState<'tabla' | 'ranking'>('tabla')
  const [fondos,    setFondos]    = useState<FondoItem[]>(FONDOS_STATIC)
  const [loading,   setLoading]   = useState(true)
  const [liveCount, setLiveCount] = useState(0)

  useEffect(() => {
    fetch('/api/cmf/fondos-mutuos')
      .then(r => r.json())
      .then(json => {
        if (json.ok && Array.isArray(json.data)) {
          setFondos(json.data)
          setLiveCount(json.liveCount ?? 0)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(
    () => filtro === 'todos' ? fondos : fondos.filter(f => f.tipo === filtro),
    [filtro, fondos],
  )

  const maxR1a = useMemo(() => Math.max(...filtered.map(f => f.r1a)), [filtered])

  const ranked = useMemo(() => [...filtered].sort((a, b) => b.r1a - a.r1a), [filtered])

  const pill = (active: boolean) => ({
    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontFamily: MONO,
    background: active ? C.gold : C.surface,
    color:      active ? '#000' : C.dimText,
    border:     `1px solid ${active ? C.gold : C.border}`,
    cursor: 'pointer' as const, transition: 'all 0.15s',
  })

  const toggleBtn = (active: boolean) => ({
    padding: '8px 16px', fontSize: 11, fontFamily: MONO, letterSpacing: '0.15em',
    textTransform: 'uppercase' as const, cursor: 'pointer' as const, border: 'none',
    background: active ? C.gold : C.surface,
    color:      active ? '#000' : C.dimText,
    transition: 'all 0.15s',
  })

  const TABLE_HEADERS = ['Fondo', 'Administradora', 'Riesgo', '1M%', '3M%', '12M%', '3A%', 'TAC%', 'Ganancia est. 12M']

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 24px', fontFamily: MONO }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: BEBAS, fontSize: 32, color: C.text, letterSpacing: '0.05em' }}>
            COMPARADOR · FONDOS MUTUOS
          </div>
          {loading ? (
            <span style={{
              fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.dimText,
              background: C.surface, border: `1px solid ${C.border}`,
              padding: '3px 8px', borderRadius: 4,
            }}>
              CARGANDO…
            </span>
          ) : liveCount > 0 ? (
            <span style={{
              fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.green,
              background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.3)',
              padding: '3px 8px', borderRadius: 4,
            }}>
              ● LIVE · {liveCount}/{fondos.length} fondos
            </span>
          ) : (
            <span style={{
              fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.dimText,
              background: C.surface, border: `1px solid ${C.border}`,
              padding: '3px 8px', borderRadius: 4,
            }}>
              ESTÁTICO
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.dimText, marginTop: 4 }}>
          {liveCount > 0
            ? `Fintual API + CMF Chile · Actualizado ${new Date().toLocaleDateString('es-CL')}`
            : 'Fondos registrados CMF Chile · Rentabilidades históricas'}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24, alignItems: 'flex-end' }}>

        {/* Monto */}
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6, textTransform: 'uppercase' }}>
            Monto CLP
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.dimText, fontSize: 13, pointerEvents: 'none' }}>$</span>
            <input
              type="number"
              value={monto}
              onChange={e => setMonto(Math.max(0, Number(e.target.value)))}
              style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '8px 12px 8px 24px', color: C.text, fontSize: 13,
                fontFamily: MONO, width: 160, outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Tipo pills */}
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6, textTransform: 'uppercase' }}>
            Tipo
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTROS.map(f => (
              <button key={f.value} onClick={() => setFiltro(f.value)} style={pill(filtro === f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* View toggle */}
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('tabla')}   style={toggleBtn(view === 'tabla')}>Tabla</button>
            <button onClick={() => setView('ranking')} style={toggleBtn(view === 'ranking')}>Ranking</button>
          </div>
        </div>
      </div>

      {/* ── TABLA ─────────────────────────────────────────────────────────────── */}
      {view === 'tabla' && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {TABLE_HEADERS.map(h => (
                    <th key={h} style={{
                      padding: '12px 14px',
                      textAlign: (h === 'Fondo' || h === 'Administradora') ? 'left' : 'right',
                      fontSize: 10, letterSpacing: '0.15em',
                      color: h === '12M%' ? C.gold : C.dimText,
                      textTransform: 'uppercase', fontWeight: 500, fontFamily: MONO,
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => {
                  const isBest   = f.r1a === maxR1a
                  const ganancia = monto * (f.r1a / 100)
                  return (
                    <tr
                      key={f.nombre}
                      style={{
                        borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
                        background:   isBest ? 'rgba(212,175,55,0.04)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontFamily: MONO, fontSize: 12, color: isBest ? C.gold : C.text, whiteSpace: 'nowrap' }}>
                        {f.nombre}
                        {isBest && (
                          <span style={{
                            marginLeft: 8, fontSize: 9, letterSpacing: '0.12em', color: C.gold,
                            background: 'rgba(212,175,55,0.12)', padding: '2px 6px', borderRadius: 4,
                          }}>
                            ★ TOP
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: MONO, fontSize: 12, color: C.dimText, whiteSpace: 'nowrap' }}>
                        {f.adm}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <RiesgoPill n={f.riesgo} />
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12 }}>
                        <PctCell v={f.r1m} />
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12 }}>
                        <PctCell v={f.r3m} />
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>
                        <PctCell v={f.r1a} />
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12 }}>
                        <PctCell v={f.r3a} />
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12, color: C.dimText }}>
                        {f.tac.toFixed(2)}%
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: MONO, fontSize: 12, color: C.green }}>
                        {fmtCLP(ganancia)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── RANKING ───────────────────────────────────────────────────────────── */}
      {view === 'ranking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranked.map((f, i) => {
            const isFirst  = i === 0
            const ganancia = monto * (f.r1a / 100)
            return (
              <div
                key={f.nombre}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                  background: isFirst ? 'rgba(212,175,55,0.06)' : C.surface,
                  border:     `1px solid ${isFirst ? C.gold : C.border}`,
                  borderRadius: 10, padding: '14px 18px',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isFirst ? C.gold : C.muted + '30',
                  color:      isFirst ? '#000' : C.dimText,
                  fontFamily: MONO, fontSize: 12, fontWeight: 700,
                }}>
                  {i + 1}
                </div>

                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontFamily: MONO, fontSize: 13, color: isFirst ? C.gold : C.text }}>
                    {f.nombre}
                    {isFirst && (
                      <span style={{
                        marginLeft: 8, fontSize: 9, letterSpacing: '0.15em', color: C.gold,
                        background: 'rgba(212,175,55,0.15)', padding: '2px 7px', borderRadius: 4,
                      }}>
                        MEJOR 12M
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: C.dimText, marginTop: 2 }}>
                    {f.adm}
                  </div>
                </div>

                <RiesgoPill n={f.riesgo} />

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: MONO, fontSize: 20, color: f.r1a >= 0 ? C.green : C.red, letterSpacing: '0.02em' }}>
                    {f.r1a > 0 ? '+' : ''}{f.r1a.toFixed(2)}%
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.dimText }}>12 meses</div>
                </div>

                <div style={{ textAlign: 'right', minWidth: 110 }}>
                  <div style={{ fontFamily: MONO, fontSize: 14, color: C.green }}>
                    {fmtCLP(ganancia)}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.dimText }}>ganancia est.</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 28, paddingTop: 14, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.dimText, fontFamily: MONO, letterSpacing: '0.02em' }}>
        {liveCount > 0
          ? `Fuente: Fintual API (fondos Fintual) + CMF SBIF API (resto) · Valor cuota diario · Caché 24h · Rentabilidades pasadas no garantizan resultados futuros`
          : 'Fuente: Portal Fondos Mutuos CMF Chile · Datos estáticos · Rentabilidades pasadas no garantizan resultados futuros'}
      </div>
    </div>
  )
}
