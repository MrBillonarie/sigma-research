'use client'
import { useState, useMemo, useEffect } from 'react'
import { C } from '@/app/lib/constants'

const MONO  = 'var(--font-dm-mono)'
const BEBAS = "'Bebas Neue', Impact, sans-serif"

const BANCOS = [
  { nombre: 'Banco Internacional', d30: 0.40 },
  { nombre: 'Banco Consorcio',     d30: 0.40 },
  { nombre: 'BTG Pactual',         d30: 0.39 },
  { nombre: 'Banco Ripley',        d30: 0.39 },
  { nombre: 'Banco Security',      d30: 0.37 },
  { nombre: 'Banco BICE',          d30: 0.37 },
  { nombre: 'BancoEstado',         d30: 0.35 },
  { nombre: 'Banco de Chile',      d30: 0.34 },
  { nombre: 'Itaú',                d30: 0.34 },
  { nombre: 'Santander',           d30: 0.30 },
  { nombre: 'Banco Falabella',     d30: 0.30 },
]

const PLAZOS = [
  { label: '30d',  days: 30  },
  { label: '60d',  days: 60  },
  { label: '90d',  days: 90  },
  { label: '180d', days: 180 },
  { label: '360d', days: 360 },
]

function fmtCLP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CL')
}

export default function RentaFijaPage() {
  const [monto,  setMonto]  = useState(5_000_000)
  const [plazo,  setPlazo]  = useState(30)
  const [view,   setView]   = useState<'tabla' | 'ranking'>('tabla')
  const [tip,    setTip]    = useState<{ tasa: string; periodo: string } | null>(null)

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

  const maxTasa = Math.max(...BANCOS.map(b => b.d30))

  const ranked = useMemo(() => [...BANCOS].sort((a, b) => b.d30 - a.d30), [])

  function getTasa(banco: typeof BANCOS[number]) {
    return plazo === 30 ? banco.d30 : null
  }

  function getGanancia(banco: typeof BANCOS[number]) {
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
                {BANCOS.map((banco, i) => {
                  const ganancia = getGanancia(banco)
                  const isBest   = banco.d30 === maxTasa
                  return (
                    <tr
                      key={banco.nombre}
                      style={{
                        borderBottom: i < BANCOS.length - 1 ? `1px solid ${C.border}` : 'none',
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
