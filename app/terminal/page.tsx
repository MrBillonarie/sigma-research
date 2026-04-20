'use client'
import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/app/lib/supabase'

const TerminalChart = dynamic(() => import('./TerminalChart'), {
  ssr: false,
  loading: () => <div style={{ height: 320, background: '#04050a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7f9a' }}>Cargando gráfico…</span></div>,
})

const C = {
  bg: '#04050a', surface: '#0b0d14', border: '#1a1d2e',
  muted: '#3a3f55', dimText: '#7a7f9a', text: '#e8e9f0',
  gold: '#d4af37', glow: '#f0cc5a', green: '#34d399', red: '#f87171', yellow: '#fbbf24',
}

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic',
                'Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic 24']

const PLATFORM_META = [
  { id: 'ibkr',             name: 'Interactive Brokers', color: '#3b82f6', currency: 'USD', type: 'Equities / Options' },
  { id: 'binance_spot',     name: 'Binance Spot',        color: '#f59e0b', currency: 'USD', type: 'Crypto Spot'        },
  { id: 'binance_futures',  name: 'Binance Futures',     color: '#ef4444', currency: 'USD', type: 'Crypto Perps'       },
  { id: 'fintual',          name: 'Fintual',             color: '#8b5cf6', currency: 'CLP', type: 'Fondos Mutuos'      },
  { id: 'santander',        name: 'Santander',           color: '#ec4899', currency: 'CLP', type: 'Ahorro / DAP'       },
  { id: 'cash',             name: 'Cash / Banco',        color: '#6b7280', currency: 'USD', type: 'Liquidez'           },
]

const EXPANDABLE = ['binance_futures', 'binance_spot']

type PortfolioRow = Record<string, number>

function seededRng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function genHistory(finalVal: number, volatility: number, trend: number, seed: number): number[] {
  const rand = seededRng(seed)
  const n = 24
  const vals: number[] = []
  let v = finalVal * Math.pow(1 - trend, n / 12)
  for (let i = 0; i < n; i++) {
    v = v * (1 + trend / 12 + (rand() - 0.48) * volatility)
    vals.push(Math.round(v))
  }
  vals[n - 1] = finalVal
  return vals
}

const fmt  = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(2)}M` : `$${v.toLocaleString('en-US')}`
const fmtK = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(2)}M` : `$${(v/1e3).toFixed(1)}K`

function Label({ text }: { text: string }) {
  return <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>{text}</div>
}

const inputStyle: React.CSSProperties = {
  background: C.bg, border: `1px solid ${C.border}`, outline: 'none',
  color: C.text, fontFamily: 'monospace', fontSize: 13, padding: '8px 12px',
  fontVariantNumeric: 'tabular-nums', width: '100%',
}

export default function TerminalPage() {
  const [portfolio,        setPortfolio]        = useState<PortfolioRow>({})
  const [dbId,             setDbId]             = useState<string | null>(null)
  const [modalOpen,        setModalOpen]        = useState(false)
  const [draftForm,        setDraftForm]        = useState<PortfolioRow>({})
  const [saving,           setSaving]           = useState(false)
  const [loading,          setLoading]          = useState(true)
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null)
  const [platformData,     setPlatformData]     = useState<Record<string, any[]>>({})
  const [loadingPlatform,  setLoadingPlatform]  = useState<string | null>(null)
  const [platformError,    setPlatformError]    = useState<Record<string, string>>({})
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase.from('portfolio').select('*').eq('user_id', user.id).single()
      if (data) {
        setDbId(data.id)
        const vals: PortfolioRow = {}
        PLATFORM_META.forEach(p => { vals[p.id] = data[p.id] ?? 0 })
        setPortfolio(vals)
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false) }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [])

  async function togglePlatform(id: string) {
    if (expandedPlatform === id) { setExpandedPlatform(null); return }
    setExpandedPlatform(id)
    if (platformData[id]) return // ya cargado
    setLoadingPlatform(id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const endpoint = id === 'binance_futures' ? '/api/binance/positions' : '/api/binance/spot'
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      const json = await res.json()
      if (json.error) {
        setPlatformError(e => ({ ...e, [id]: json.error }))
      } else {
        const data = id === 'binance_futures' ? (json.positions ?? []) : (json.balances ?? [])
        setPlatformData(d => ({ ...d, [id]: data }))
      }
    } catch {
      setPlatformError(e => ({ ...e, [id]: 'Error al conectar.' }))
    } finally {
      setLoadingPlatform(null)
    }
  }

  function openModal() {
    setDraftForm({ ...portfolio })
    setModalOpen(true)
  }

  async function savePortfolio() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = { user_id: user.id, updated_at: new Date().toISOString(), ...draftForm }
    if (dbId) {
      await supabase.from('portfolio').update(payload).eq('id', dbId)
    } else {
      const { data } = await supabase.from('portfolio').insert(payload).select().single()
      if (data) setDbId(data.id)
    }
    setPortfolio({ ...draftForm })
    setSaving(false)
    setModalOpen(false)
  }

  const hasSavedData = Object.values(portfolio).some(v => v > 0)

  const platforms = PLATFORM_META.map((p, i) => {
    const current = portfolio[p.id] ?? 0
    const history = genHistory(current || 10_000, 0.06, 0.08, i * 1000 + 42)
    const prev = history[0]
    const change = prev > 0 ? ((current - prev) / prev) * 100 : 0
    return { ...p, current, prev, change, history }
  }).filter(p => p.id !== 'cash' || p.current > 0)

  const totalCurrent = platforms.reduce((s, p) => s + p.current, 0)
  const totalPrev    = platforms.reduce((s, p) => s + p.prev,    0)
  const ytdReturn    = totalPrev > 0 ? ((totalCurrent - totalPrev) / totalPrev) * 100 : 0

  const platformHistories = platforms.map(p => ({ name: p.name, color: p.color, data: p.history }))
  const totalHistory = MONTHS.slice(0, 24).map((_, i) =>
    platformHistories.reduce((sum, p) => sum + (p.data[i] ?? 0), 0)
  )

  const returns = totalHistory.slice(1).map((v, i) => (v - totalHistory[i]) / totalHistory[i])
  const meanR   = returns.reduce((a, b) => a + b, 0) / (returns.length || 1)
  const stdR    = Math.sqrt(returns.reduce((a, b) => a + (b - meanR) ** 2, 0) / (returns.length || 1))
  const sharpe  = stdR > 0 ? (meanR / stdR) * Math.sqrt(12) : 0
  let peak = 0, maxDD = 0
  totalHistory.forEach(v => {
    if (v > peak) peak = v
    const dd = peak > 0 ? (v - peak) / peak : 0
    if (dd < maxDD) maxDD = dd
  })

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
              {'// PORTFOLIO DASHBOARD · MULTI-PLATAFORMA'}
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
              <span style={{ color: C.text }}>SIGMA</span>{' '}
              <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TERMINAL</span>
            </h1>
          </div>
          <button onClick={openModal}
            style={{ padding: '10px 22px', border: `1px solid ${C.gold}`, background: 'transparent', color: C.gold, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', cursor: 'pointer' }}>
            EDITAR PORTAFOLIO
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: C.muted }}>Cargando portafolio…</div>
        ) : !hasSavedData ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '48px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginBottom: 20 }}>No tienes datos de portafolio guardados todavía.</div>
            <button onClick={openModal} style={{ padding: '12px 28px', background: C.gold, color: C.bg, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', border: 'none', cursor: 'pointer' }}>
              CONFIGURAR PORTAFOLIO
            </button>
          </div>
        ) : (
          <>
            {/* Top metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: C.border, marginBottom: 1 }}>
              {[
                { label: 'Total Patrimonio', value: fmt(totalCurrent), sub: 'USD equiv.', color: C.gold },
                { label: 'Rentabilidad YTD', value: `${ytdReturn > 0 ? '+' : ''}${ytdReturn.toFixed(2)}%`, sub: 'vs. inicio de año', color: ytdReturn >= 0 ? C.green : C.red },
                { label: 'Sharpe Ratio', value: sharpe.toFixed(2), sub: '12M rolling', color: sharpe >= 1.5 ? C.green : C.gold },
                { label: 'Max Drawdown', value: `${(maxDD*100).toFixed(2)}%`, sub: '24M window', color: C.red },
              ].map(({ label, value, sub, color }) => (
                <div key={label} style={{ background: C.surface, padding: '20px 22px' }}>
                  <Label text={label} />
                  <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 38, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div style={{ background: C.surface, marginBottom: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>EVOLUCIÓN DE CAPITAL · 24 MESES</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>base: USD equiv.</span>
              </div>
              <TerminalChart labels={MONTHS.slice(0, 24)} total={totalHistory} platforms={platformHistories} />
            </div>

            {/* Platform grid */}
            <div style={{ marginBottom: 1 }}>
              <div style={{ background: C.surface, padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>DESGLOSE POR PLATAFORMA</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(platforms.length, 5)}, 1fr)`, gap: 1, background: C.border }}>
                {platforms.map(p => {
                  const pctTotal = totalCurrent > 0 ? (p.current / totalCurrent) * 100 : 0
                  const isExpandable = EXPANDABLE.includes(p.id)
                  const isExpanded = expandedPlatform === p.id
                  const data = platformData[p.id] ?? []
                  const isLoading = loadingPlatform === p.id
                  const error = platformError[p.id]
                  return (
                    <div key={p.id}
                      onClick={() => { if (isExpandable) togglePlatform(p.id) }}
                      style={{ background: C.bg, padding: '20px 18px', cursor: isExpandable ? 'pointer' : 'default' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.dimText }}>{p.name}</span>
                        {isExpandable && (
                          <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 9, color: C.gold }}>{isExpanded ? '▲' : '▼'}</span>
                        )}
                      </div>
                      <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 30, color: C.text, lineHeight: 1, marginBottom: 4 }}>
                        {fmtK(p.current)}
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: p.change >= 0 ? C.green : C.red, marginBottom: 8 }}>
                        {p.change >= 0 ? '+' : ''}{p.change.toFixed(1)}% YTD
                      </div>
                      <div style={{ height: 2, background: C.border, marginBottom: 6 }}>
                        <div style={{ height: '100%', width: `${pctTotal}%`, background: p.color }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted }}>{p.type}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>{pctTotal.toFixed(1)}%</span>
                      </div>

                      {/* Expanded data */}
                      {isExpandable && isExpanded && (
                        <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}
                          onClick={e => e.stopPropagation()}>
                          {isLoading ? (
                            <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted }}>Cargando…</div>
                          ) : error ? (
                            <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.red }}>{error}</div>
                          ) : data.length === 0 ? (
                            <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted }}>
                              {p.id === 'binance_futures' ? 'Sin posiciones abiertas.' : 'Sin balances.'}
                            </div>
                          ) : p.id === 'binance_futures' ? (
                            data.map((pos: any, i: number) => (
                              <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < data.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.text }}>{pos.symbol}</span>
                                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: parseFloat(pos.positionAmt) > 0 ? C.green : C.red }}>
                                    {parseFloat(pos.positionAmt) > 0 ? 'LONG' : 'SHORT'}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>
                                    PnL: <span style={{ color: parseFloat(pos.unRealizedProfit) >= 0 ? C.green : C.red }}>${parseFloat(pos.unRealizedProfit).toFixed(2)}</span>
                                  </span>
                                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>
                                    ${parseFloat(pos.entryPrice).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            data.map((b: any, i: number) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.text }}>{b.asset}</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.gold }}>{parseFloat(b.free).toFixed(6)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Summary table */}
            <div style={{ background: C.surface }}>
              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>TABLA RESUMEN</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['Plataforma', 'Tipo', 'Moneda', 'Valor actual', '% Portafolio'].map(h => (
                      <th key={h} style={{ padding: '10px 18px', textAlign: 'left', color: C.dimText, fontWeight: 400, letterSpacing: '0.15em', fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(212,175,55,0.02)' }}>
                      <td style={{ padding: '12px 18px', color: C.text }}>{p.name}</td>
                      <td style={{ padding: '12px 18px', color: C.dimText }}>{p.type}</td>
                      <td style={{ padding: '12px 18px', color: C.dimText }}>{p.currency}</td>
                      <td style={{ padding: '12px 18px', color: C.gold, fontWeight: 500 }}>{fmt(p.current)}</td>
                      <td style={{ padding: '12px 18px', color: C.dimText }}>{totalCurrent > 0 ? ((p.current / totalCurrent) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `1px solid ${C.gold}30` }}>
                    <td colSpan={3} style={{ padding: '12px 18px', color: C.gold, fontFamily: "'Bebas Neue', Impact", fontSize: 14, letterSpacing: '0.15em' }}>TOTAL</td>
                    <td style={{ padding: '12px 18px', color: C.gold, fontFamily: "'Bebas Neue', Impact", fontSize: 18 }}>{fmt(totalCurrent)}</td>
                    <td style={{ padding: '12px 18px', color: C.gold }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div ref={modalRef} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 32, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 20 }}>// EDITAR PORTAFOLIO</div>
            <p style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, marginBottom: 24, lineHeight: 1.6 }}>
              Introduce el valor actual en USD de cada plataforma. Los datos se guardan en tu cuenta.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
              {PLATFORM_META.map(p => (
                <div key={p.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>{p.name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, marginLeft: 'auto' }}>{p.currency}</span>
                  </div>
                  <input type="number" step="any" min="0" placeholder="0"
                    value={draftForm[p.id] || ''}
                    onChange={e => setDraftForm(f => ({ ...f, [p.id]: parseFloat(e.target.value) || 0 }))}
                    style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={savePortfolio} disabled={saving}
                style={{ flex: 1, padding: '12px', background: C.gold, color: C.bg, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'GUARDANDO…' : 'GUARDAR'}
              </button>
              <button onClick={() => setModalOpen(false)}
                style={{ padding: '12px 20px', background: 'transparent', color: C.dimText, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}