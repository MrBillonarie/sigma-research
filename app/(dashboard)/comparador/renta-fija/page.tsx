'use client'
import { useState, useMemo, useEffect } from 'react'
import { C } from '@/app/lib/constants'

const MONO  = 'var(--font-dm-mono)'
const BEBAS = "'Bebas Neue', Impact, sans-serif"

interface BancoRow {
  id: string; nombre: string
  d7: number; d14: number; d30: number; d60: number; d90: number; d180: number; d360: number
  updated_at: string
}

const BANCOS_FALLBACK: BancoRow[] = [
  { id: 'banco-internacional', nombre: 'Banco Internacional', d7: 0.09, d14: 0.18, d30: 0.40, d60: 0.42, d90: 0.44, d180: 0.46, d360: 0.50, updated_at: '' },
  { id: 'banco-consorcio',     nombre: 'Banco Consorcio',     d7: 0.09, d14: 0.18, d30: 0.40, d60: 0.42, d90: 0.44, d180: 0.46, d360: 0.50, updated_at: '' },
  { id: 'btg-pactual',         nombre: 'BTG Pactual',         d7: 0.09, d14: 0.17, d30: 0.39, d60: 0.41, d90: 0.43, d180: 0.45, d360: 0.49, updated_at: '' },
  { id: 'banco-ripley',        nombre: 'Banco Ripley',        d7: 0.09, d14: 0.17, d30: 0.39, d60: 0.41, d90: 0.43, d180: 0.45, d360: 0.48, updated_at: '' },
  { id: 'banco-security',      nombre: 'Banco Security',      d7: 0.08, d14: 0.16, d30: 0.37, d60: 0.39, d90: 0.41, d180: 0.43, d360: 0.47, updated_at: '' },
  { id: 'banco-bice',          nombre: 'Banco BICE',          d7: 0.08, d14: 0.16, d30: 0.37, d60: 0.39, d90: 0.41, d180: 0.43, d360: 0.47, updated_at: '' },
  { id: 'bancoestado',         nombre: 'BancoEstado',         d7: 0.08, d14: 0.15, d30: 0.35, d60: 0.37, d90: 0.39, d180: 0.41, d360: 0.45, updated_at: '' },
  { id: 'banco-de-chile',      nombre: 'Banco de Chile',      d7: 0.07, d14: 0.15, d30: 0.34, d60: 0.36, d90: 0.38, d180: 0.40, d360: 0.44, updated_at: '' },
  { id: 'itau',                nombre: 'Itaú',                d7: 0.07, d14: 0.15, d30: 0.34, d60: 0.36, d90: 0.38, d180: 0.40, d360: 0.44, updated_at: '' },
  { id: 'scotiabank',          nombre: 'Scotiabank',          d7: 0.07, d14: 0.14, d30: 0.32, d60: 0.34, d90: 0.36, d180: 0.38, d360: 0.42, updated_at: '' },
  { id: 'bci',                 nombre: 'BCI',                 d7: 0.07, d14: 0.14, d30: 0.32, d60: 0.34, d90: 0.36, d180: 0.38, d360: 0.42, updated_at: '' },
  { id: 'santander',           nombre: 'Santander',           d7: 0.06, d14: 0.13, d30: 0.30, d60: 0.32, d90: 0.34, d180: 0.36, d360: 0.40, updated_at: '' },
  { id: 'banco-falabella',     nombre: 'Banco Falabella',     d7: 0.06, d14: 0.13, d30: 0.30, d60: 0.32, d90: 0.34, d180: 0.36, d360: 0.40, updated_at: '' },
]

const PLAZOS = [
  { label: '7d',   days: 7   },
  { label: '14d',  days: 14  },
  { label: '30d',  days: 30  },
  { label: '60d',  days: 60  },
  { label: '90d',  days: 90  },
  { label: '180d', days: 180 },
  { label: '360d', days: 360 },
]

function fmtCLP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CL')
}

const TOP_PLAZOS = [
  { label: '30 días',  key: 'd30'  as const, color: C.green  },
  { label: '90 días',  key: 'd90'  as const, color: '#3b82f6' },
  { label: '180 días', key: 'd180' as const, color: C.gold   },
  { label: '360 días', key: 'd360' as const, color: C.purple },
]

export default function RentaFijaPage() {
  const [monto,  setMonto]  = useState(5_000_000)
  const [plazo,  setPlazo]  = useState(30)
  const [view,   setView]   = useState<'tabla' | 'ranking'>('tabla')
  const [tip,    setTip]    = useState<{ tasa: string; periodo: string } | null>(null)
  const [bancos, setBancos] = useState<BancoRow[]>(BANCOS_FALLBACK)

  useEffect(() => {
    fetch('/api/tasas-dap')
      .then(r => r.json())
      .then(j => { if (j.ok && j.data?.length) setBancos(j.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/cmf/tip')
      .then(r => r.json())
      .then(json => {
        if (!json.ok || !json.data.length) return
        const last = json.data[json.data.length - 1]
        const tasa    = last.TasaAnual ?? last.Tasa ?? last.tasa ?? null
        const periodo = last.Periodo  ?? last.Mes  ?? ''
        if (tasa) setTip({ tasa, periodo })
      })
      .catch(() => {})
  }, [])

  const maxTasa = Math.max(...bancos.map(b => b.d30))
  const ranked  = useMemo(() => [...bancos].sort((a, b) => b.d30 - a.d30), [bancos])
  const topBancos = useMemo(() =>
    TOP_PLAZOS.map(p => {
      const best = [...bancos].sort((a, b) => (b[p.key] ?? 0) - (a[p.key] ?? 0))[0]
      return { ...p, banco: best?.nombre ?? null, tasa: best?.[p.key] ?? null }
    }), [bancos])

  function getTasa(banco: BancoRow) {
    const map: Record<number, number | null> = {
      7: banco.d7 ?? null, 14: banco.d14 ?? null, 30: banco.d30 ?? null,
      60: banco.d60 ?? null, 90: banco.d90 ?? null, 180: banco.d180 ?? null, 360: banco.d360 ?? null,
    }
    return map[plazo] ?? null
  }

  function getGanancia(banco: BancoRow) {
    const tasa = getTasa(banco)
    if (tasa === null) return null
    return monto * (tasa / 100) * (plazo / 30)
  }

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

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 24px', fontFamily: MONO }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: BEBAS, fontSize: 32, color: C.text, letterSpacing: '0.05em' }}>
          COMPARADOR · RENTA FIJA
        </div>
        <div style={{ fontSize: 12, color: C.dimText, marginTop: 4 }}>
          Depósitos a plazo · Tasas mensuales % · Chile
        </div>
      </div>

      {/* TIP Banner */}
      {tip && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          marginBottom: 20, padding: '12px 16px',
          background: 'rgba(212,175,55,0.05)',
          border: `1px solid ${C.gold}`,
          borderRadius: 10,
        }}>
          <span style={{
            fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: C.green, background: 'rgba(52,211,153,0.12)',
            border: '1px solid rgba(52,211,153,0.3)',
            padding: '3px 8px', borderRadius: 4, flexShrink: 0,
          }}>
            DATO OFICIAL CMF
          </span>
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.text }}>
            Tasa promedio sistema (TIP):
            <span style={{ color: C.gold, marginLeft: 6, fontWeight: 600 }}>
              {parseFloat(tip.tasa).toFixed(2)}% anual
            </span>
          </span>
          {tip.periodo && (
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.dimText, marginLeft: 'auto' }}>
              Período {tip.periodo}
            </span>
          )}
        </div>
      )}

      {/* Top por plazo */}
      {bancos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 24 }}>
          {topBancos.map(t => (
            <div key={t.label} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderTop: `2px solid ${t.color}`, padding: '14px 16px',
            }}>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.color, marginBottom: 8 }}>
                {t.label}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.text, marginBottom: 4 }}>
                {t.banco ?? '—'}
              </div>
              {t.tasa !== null && (
                <div style={{ fontFamily: BEBAS, fontSize: 22, color: t.color, letterSpacing: '0.04em' }}>
                  {t.tasa.toFixed(2)}%
                  <span style={{ fontFamily: MONO, fontSize: 9, color: C.dimText, marginLeft: 6 }}>mensual</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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

        {/* Plazo pills */}
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6, textTransform: 'uppercase' }}>
            Plazo
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PLAZOS.map(p => (
              <button key={p.days} onClick={() => setPlazo(p.days)} style={pill(plazo === p.days)}>
                {p.label}
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, textTransform: 'uppercase', fontWeight: 500, fontFamily: MONO }}>
                    Banco
                  </th>
                  {PLAZOS.map(p => (
                    <th key={p.days} style={{
                      padding: '12px 16px', textAlign: 'right', fontSize: 10, letterSpacing: '0.2em',
                      color: plazo === p.days ? C.gold : C.dimText,
                      textTransform: 'uppercase', fontWeight: 500, fontFamily: MONO,
                      background: plazo === p.days ? 'rgba(212,175,55,0.06)' : 'transparent',
                      whiteSpace: 'nowrap',
                    }}>
                      {p.label}
                    </th>
                  ))}
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, textTransform: 'uppercase', fontWeight: 500, fontFamily: MONO, whiteSpace: 'nowrap' }}>
                    Ganancia est.
                  </th>
                </tr>
              </thead>
              <tbody>
                {bancos.map((banco, i) => {
                  const ganancia = getGanancia(banco)
                  const isBest   = banco.d30 === maxTasa
                  return (
                    <tr
                      key={banco.nombre}
                      style={{
                        borderBottom: i < bancos.length - 1 ? `1px solid ${C.border}` : 'none',
                        background:   isBest ? 'rgba(212,175,55,0.04)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '13px 16px', fontFamily: MONO, fontSize: 13, color: isBest ? C.gold : C.text, whiteSpace: 'nowrap' }}>
                        {banco.nombre}
                        {isBest && (
                          <span style={{
                            marginLeft: 8, fontSize: 9, letterSpacing: '0.15em', color: C.gold,
                            background: 'rgba(212,175,55,0.12)', padding: '2px 6px', borderRadius: 4,
                          }}>
                            ★ MEJOR
                          </span>
                        )}
                      </td>
                      {PLAZOS.map(p => {
                        const val      = p.days === 30 ? banco.d30 : null
                        const isActive = plazo === p.days
                        return (
                          <td key={p.days} style={{
                            padding: '13px 16px', textAlign: 'right', fontFamily: MONO, fontSize: 13,
                            color:      val !== null ? (isBest && isActive ? C.gold : C.text) : C.muted,
                            background: isActive ? 'rgba(212,175,55,0.04)' : 'transparent',
                          }}>
                            {val !== null ? val.toFixed(2) + '%' : '—'}
                          </td>
                        )
                      })}
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontFamily: MONO, fontSize: 13, color: ganancia !== null ? C.green : C.muted }}>
                        {ganancia !== null ? fmtCLP(ganancia) : '—'}
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
          {ranked.map((banco, i) => {
            const tasa     = getTasa(banco)
            const ganancia = getGanancia(banco)
            const isFirst  = i === 0
            return (
              <div
                key={banco.nombre}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
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

                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontFamily: MONO, fontSize: 14, color: isFirst ? C.gold : C.text }}>
                    {banco.nombre}
                    {isFirst && (
                      <span style={{
                        marginLeft: 10, fontSize: 9, letterSpacing: '0.15em', color: C.gold,
                        background: 'rgba(212,175,55,0.15)', padding: '2px 7px', borderRadius: 4,
                      }}>
                        MEJOR TASA
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: MONO, fontSize: 20, color: isFirst ? C.gold : C.text, letterSpacing: '0.02em' }}>
                    {tasa !== null ? tasa.toFixed(2) + '%' : '—'}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.dimText }}>mensual · {(tasa ?? 0) * 12}% anual</div>
                </div>

                <div style={{ textAlign: 'right', minWidth: 110 }}>
                  <div style={{ fontFamily: MONO, fontSize: 14, color: ganancia !== null ? C.green : C.muted }}>
                    {ganancia !== null ? fmtCLP(ganancia) : '—'}
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
        Tasas verificadas manualmente · Fuente: sitios oficiales de cada banco · Actualizado Abril 2026
      </div>
    </div>
  )
}
