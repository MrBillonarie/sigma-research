'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const MONO  = 'var(--font-dm-mono, monospace)'
const BEBAS = "'Bebas Neue', Impact, sans-serif"

// ─── Types ────────────────────────────────────────────────────────────────────
interface StatBlock { total: number; correct: number; accuracy: number; avgReturn: number }
interface AccuracyData {
  hasData:      boolean
  measured:     number
  pendingCount: number
  message?:     string
  overall:      StatBlock
  byClass:      Record<string, StatBlock>
  bySignal:     { comprar: StatBlock; reducir: StatBlock }
  byScore:      { label: string; total: number; correct: number; accuracy: number; avgReturn: number }[]
  byConditions: { label: string; total: number; correct: number; accuracy: number; avgReturn: number }[]
  byRegime:     Record<string, StatBlock>
  recent:       {
    ticker: string; name: string; signal: string; score: number; assetClass: string
    conditionsMet: number | null; conditionsTotal: number | null; regime: string | null
    outcomeReturn: number; correct: boolean; generatedAt: string
  }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function accColor(acc: number) {
  return acc >= 60 ? '#1D9E75' : acc >= 45 ? '#d4af37' : '#f87171'
}
function retColor(r: number) { return r > 0 ? '#1D9E75' : r < 0 ? '#f87171' : '#7a7f9a' }

function StatCard({ label, stat, icon }: { label: string; stat: StatBlock; icon: string }) {
  if (!stat || stat.total === 0) return (
    <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ fontSize: 10, color: '#3a3f55', fontFamily: MONO, letterSpacing: 1 }}>{icon} {label}</div>
      <div style={{ fontSize: 13, color: '#3a3f55', fontFamily: MONO, marginTop: 8 }}>Sin datos aún</div>
    </div>
  )
  const ac = accColor(stat.accuracy)
  return (
    <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderTop: `2px solid ${ac}30`, borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: MONO, letterSpacing: 1, marginBottom: 8 }}>{icon} {label}</div>
      <div style={{ fontFamily: BEBAS, fontSize: 32, letterSpacing: 1, color: ac }}>{stat.accuracy}%</div>
      <div style={{ fontSize: 11, color: '#7a7f9a', fontFamily: MONO, marginTop: 4 }}>
        {stat.correct}/{stat.total} señales · ret. medio{' '}
        <span style={{ color: retColor(stat.avgReturn) }}>{stat.avgReturn > 0 ? '+' : ''}{stat.avgReturn.toFixed(1)}%</span>
      </div>
    </div>
  )
}

function AccBar({ accuracy, total }: { accuracy: number; total: number }) {
  const color = accColor(accuracy)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 6, background: '#1a1d2e', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${accuracy}%`, background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 12, color, minWidth: 36 }}>{accuracy}%</span>
      <span style={{ fontFamily: MONO, fontSize: 10, color: '#3a3f55' }}>({total})</span>
    </div>
  )
}

const CLASS_LABEL: Record<string, string> = {
  fondos: 'Fondos Mutuos', etfs: 'ETFs Globales', renta_fija: 'Renta Fija', crypto: 'Crypto',
}
const CLASS_ICON: Record<string, string> = {
  fondos: '🏦', etfs: '📊', renta_fija: '🏛️', crypto: '₿',
}
const REGIME_LABEL: Record<string, string> = {
  'risk-on': '▲ Risk-On', 'risk-off': '▼ Risk-Off', 'neutral': '◆ Neutral',
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AccuracyPage() {
  const [data,    setData]    = useState<AccuracyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/motor/accuracy')
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(e.message ?? 'Error'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#04050a', padding: '100px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#7a7f9a', fontFamily: MONO, fontSize: 13 }}>Midiendo outcomes pendientes…</span>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#04050a', padding: '100px 24px' }}>
      <div style={{ color: '#f87171', fontFamily: MONO }}>{error}</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#04050a', padding: '88px 24px 64px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#378ADD', boxShadow: '0 0 8px #378ADD' }} />
          <span style={{ fontSize: 10, color: '#378ADD', fontFamily: MONO, letterSpacing: 1 }}>
            CICLO DE RETROALIMENTACIÓN
          </span>
        </div>
        <h1 style={{ margin: '0 0 4px', fontSize: 32, fontFamily: BEBAS, letterSpacing: 2, color: '#e8e9f0' }}>
          ACCURACY DEL MOTOR
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#7a7f9a', fontFamily: MONO }}>
          ¿Las señales emitidas 22+ días atrás acertaron la dirección?
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/motor-decision" style={{
            background: 'transparent', border: '1px solid #1a1d2e', borderRadius: 7,
            padding: '7px 14px', color: '#7a7f9a', fontSize: 11, fontFamily: MONO, textDecoration: 'none',
          }}>← Motor</Link>
          {data && (
            <span style={{ fontSize: 10, color: '#3a3f55', fontFamily: MONO, lineHeight: '32px' }}>
              {data.measured} señales medidas · {data.pendingCount} pendientes
            </span>
          )}
        </div>
      </div>

      {/* ── Sin datos aún ────────────────────────────────────────────────── */}
      {!data?.hasData && (
        <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 12, padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <div style={{ fontFamily: BEBAS, fontSize: 22, color: '#e8e9f0', letterSpacing: 1, marginBottom: 8 }}>
            ACUMULANDO SEÑALES
          </div>
          <div style={{ fontSize: 12, color: '#7a7f9a', fontFamily: MONO, maxWidth: 480, margin: '0 auto' }}>
            {data?.message ?? 'El motor lleva guardando señales con precio y contexto. En 22+ días verás aquí la accuracy real de cada indicador.'}
          </div>
          {(data?.pendingCount ?? 0) > 0 && (
            <div style={{ marginTop: 20, fontSize: 11, color: '#378ADD', fontFamily: MONO }}>
              {data!.pendingCount} señales pendientes de que venzan sus 22 días
            </div>
          )}
        </div>
      )}

      {data?.hasData && (
        <>
          {/* ── Cards globales ───────────────────────────────────────────── */}
          <section style={{ marginBottom: 24 }}>
            <SectionLabel>ACCURACY GLOBAL</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <StatCard label="TOTAL"    stat={data.overall}          icon="📊" />
              <StatCard label="COMPRAR"  stat={data.bySignal.comprar} icon="▲" />
              <StatCard label="REDUCIR"  stat={data.bySignal.reducir} icon="▼" />
              <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: MONO, letterSpacing: 1, marginBottom: 8 }}>📈 MEJOR RÉGIMEN</div>
                {Object.entries(data.byRegime)
                  .filter(([, s]) => s.total > 0)
                  .sort(([, a], [, b]) => b.accuracy - a.accuracy)
                  .map(([regime, s]) => (
                    <div key={regime} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#7a7f9a', fontFamily: MONO }}>{REGIME_LABEL[regime] ?? regime}</span>
                      <span style={{ fontSize: 11, color: accColor(s.accuracy), fontFamily: MONO, fontWeight: 700 }}>{s.accuracy}%</span>
                    </div>
                  ))
                }
                {Object.values(data.byRegime).every(s => s.total === 0) && (
                  <span style={{ fontSize: 11, color: '#3a3f55', fontFamily: MONO }}>Sin datos</span>
                )}
              </div>
            </div>
          </section>

          {/* ── Por clase + por score ─────────────────────────────────────── */}
          <section style={{ marginBottom: 24 }}>
            <SectionLabel>ACCURACY POR CLASE Y SCORE</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* Por clase */}
              <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 10, color: '#7a7f9a', fontFamily: MONO, letterSpacing: 1 }}>
                  POR CLASE DE ACTIVO
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#04050a' }}>
                      {['Clase', 'Accuracy', 'Ret. medio', 'N'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#3a3f55', fontFamily: MONO, borderBottom: '1px solid #1a1d2e' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['fondos', 'etfs', 'renta_fija', 'crypto'].map(cls => {
                      const s = data.byClass[cls]
                      if (!s || s.total === 0) return null
                      return (
                        <tr key={cls} style={{ borderBottom: '1px solid #0d0f1a' }}>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: '#e8e9f0', fontFamily: MONO }}>
                            {CLASS_ICON[cls]} {CLASS_LABEL[cls]}
                          </td>
                          <td style={{ padding: '10px 12px' }}><AccBar accuracy={s.accuracy} total={s.total} /></td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: retColor(s.avgReturn), fontFamily: MONO }}>
                            {s.avgReturn > 0 ? '+' : ''}{s.avgReturn.toFixed(1)}%
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 11, color: '#3a3f55', fontFamily: MONO }}>{s.total}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Por score bucket — ¿scores altos = más accuracy? */}
              <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 10, color: '#7a7f9a', fontFamily: MONO, letterSpacing: 1 }}>
                  POR SCORE — ¿DISCRIMINA BIEN?
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#04050a' }}>
                      {['Score', 'Accuracy', 'Ret. medio', 'N'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#3a3f55', fontFamily: MONO, borderBottom: '1px solid #1a1d2e' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.byScore.filter(b => b.total > 0).map(b => (
                      <tr key={b.label} style={{ borderBottom: '1px solid #0d0f1a' }}>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: '#e8e9f0', fontFamily: MONO }}>{b.label}</td>
                        <td style={{ padding: '10px 12px' }}><AccBar accuracy={b.accuracy} total={b.total} /></td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: retColor(b.avgReturn), fontFamily: MONO }}>
                          {b.avgReturn > 0 ? '+' : ''}{b.avgReturn.toFixed(1)}%
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#3a3f55', fontFamily: MONO }}>{b.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── Por condiciones ───────────────────────────────────────────── */}
          {data.byConditions.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <SectionLabel>CONDICIONES CUMPLIDAS vs ACCURACY</SectionLabel>
              <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1d2e', fontSize: 10, color: '#7a7f9a', fontFamily: MONO, letterSpacing: 1 }}>
                  ¿MÁS CONDICIONES CUMPLIDAS = MEJOR SEÑAL? — VALIDACIÓN EMPÍRICA
                </div>
                <div style={{ padding: '16px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {data.byConditions.map(b => (
                    <div key={b.label} style={{ background: '#04050a', border: '1px solid #1a1d2e', borderRadius: 8, padding: '12px 16px', minWidth: 100, textAlign: 'center' }}>
                      <div style={{ fontFamily: BEBAS, fontSize: 22, color: accColor(b.accuracy), letterSpacing: 1 }}>{b.accuracy}%</div>
                      <div style={{ fontSize: 11, color: '#e8e9f0', fontFamily: MONO, marginBottom: 2 }}>{b.label} conds</div>
                      <div style={{ fontSize: 10, color: retColor(b.avgReturn), fontFamily: MONO }}>
                        {b.avgReturn > 0 ? '+' : ''}{b.avgReturn.toFixed(1)}% avg
                      </div>
                      <div style={{ fontSize: 9, color: '#3a3f55', fontFamily: MONO }}>n={b.total}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '10px 16px', borderTop: '1px solid #0d0f1a', fontSize: 10, color: '#3a3f55', fontFamily: MONO }}>
                  Si 7/8 y 8/8 tienen accuracy notablemente mayor que 4/8, el contador de condiciones discrimina bien y debería pesar más en el score.
                </div>
              </div>
            </section>
          )}

          {/* ── Señales recientes con outcome ────────────────────────────── */}
          {data.recent.length > 0 && (
            <section>
              <SectionLabel>SEÑALES RECIENTES CON OUTCOME</SectionLabel>
              <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#04050a' }}>
                        {['Activo', 'Señal', 'Score', 'Conds', 'Régimen', 'Outcome', 'Dirección', 'Fecha señal'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#3a3f55', fontFamily: MONO, borderBottom: '1px solid #1a1d2e', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #0d0f1a', background: i % 2 === 0 ? 'transparent' : '#04050a22' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ fontSize: 12, color: '#e8e9f0' }}>{r.name}</div>
                            <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: MONO }}>{r.ticker}</div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, fontFamily: MONO,
                              color: r.signal === 'comprar' ? '#1D9E75' : '#f87171',
                              background: r.signal === 'comprar' ? 'rgba(29,158,117,0.12)' : 'rgba(248,113,113,0.12)',
                              border: `1px solid ${r.signal === 'comprar' ? '#1D9E7530' : '#f8717130'}`,
                              borderRadius: 4, padding: '2px 7px',
                            }}>
                              {r.signal.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', fontFamily: MONO, fontSize: 12, color: r.score > 65 ? '#1D9E75' : r.score > 50 ? '#d4af37' : '#f87171' }}>{r.score}</td>
                          <td style={{ padding: '8px 12px', fontFamily: MONO, fontSize: 11, color: '#7a7f9a' }}>
                            {r.conditionsMet != null ? `${r.conditionsMet}/${r.conditionsTotal}` : '—'}
                          </td>
                          <td style={{ padding: '8px 12px', fontFamily: MONO, fontSize: 10, color: '#7a7f9a' }}>{REGIME_LABEL[r.regime ?? ''] ?? r.regime ?? '—'}</td>
                          <td style={{ padding: '8px 12px', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: retColor(r.outcomeReturn) }}>
                            {r.outcomeReturn > 0 ? '+' : ''}{r.outcomeReturn.toFixed(1)}%
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: 16 }}>
                            {r.correct ? '✅' : '❌'}
                          </td>
                          <td style={{ padding: '8px 12px', fontFamily: MONO, fontSize: 10, color: '#3a3f55' }}>
                            {new Date(r.generatedAt).toLocaleDateString('es-CL')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10, fontSize: 10, color: '#7a7f9a', fontFamily: MONO, letterSpacing: 1.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ height: 1, width: 20, background: '#1a1d2e' }} />
      {children}
      <div style={{ height: 1, flex: 1, background: '#1a1d2e' }} />
    </div>
  )
}
