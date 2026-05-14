'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { C } from '@/app/lib/constants'
import { supabase } from '@/app/lib/supabase'
import type { Asset, MarketRegime } from '@/types/decision-engine'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Price { ticker: string; price: number; change: number }

interface MotorData {
  signals:      Asset[]
  regime:       MarketRegime
  regimeLabel:  string
  buyCount:     number
  sellCount:    number
  generatedAt:  string
}

// ─── Binance WebSocket ────────────────────────────────────────────────────────
const WS_TICKERS = ['btcusdt', 'ethusdt', 'bnbusdt', 'solusdt', 'avaxusdt', 'arbusdt']
const WS_URL     = `wss://stream.binance.com:9443/stream?streams=${WS_TICKERS.map(t => `${t}@miniTicker`).join('/')}`
const SYM_LABEL: Record<string, string> = {
  BTCUSDT: 'BTC', ETHUSDT: 'ETH', BNBUSDT: 'BNB',
  SOLUSDT: 'SOL', AVAXUSDT: 'AVAX', ARBUSDT: 'ARB',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(p: number) {
  return p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : p >= 1 ? p.toFixed(2) : p.toFixed(4)
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)   return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

function regimeColor(r: MarketRegime) {
  if (r === 'risk-on')  return C.green
  if (r === 'risk-off') return C.red
  return C.yellow
}

function signalColor(s: string) {
  if (s === 'comprar') return C.green
  if (s === 'reducir') return C.red
  return C.dimText
}

function signalLabel(s: string) {
  if (s === 'comprar') return 'COMPRAR'
  if (s === 'reducir') return 'REDUCIR'
  if (s === 'mantener') return 'MANTENER'
  return 'NEUTRAL'
}

function classLabel(c: string) {
  if (c === 'crypto')     return 'CRYPTO'
  if (c === 'etfs')       return 'ETF'
  if (c === 'fondos')     return 'FONDO'
  if (c === 'renta_fija') return 'RENTA FIJA'
  return c.toUpperCase()
}

const REFRESH_MS = 30 * 60 * 1000 // 30 min

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HudPage() {
  const [motor,      setMotor]      = useState<MotorData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [motorError, setMotorError] = useState<string | null>(null)
  const [lastFetch,  setLastFetch]  = useState<string | null>(null)
  const [profile,    setProfile]    = useState<'retail' | 'trader' | 'institucional'>('trader')
  const [prices,     setPrices]     = useState<Price[]>([])
  const [connected,  setConnected]  = useState(false)
  const [search,     setSearch]     = useState('')
  const [sigFilter,  setSigFilter]  = useState<'ALL' | 'comprar' | 'reducir'>('ALL')
  const [classFilter,setClassFilter]= useState<'ALL' | string>('ALL')

  // ── Leer perfil del usuario ──────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const p = data.user?.user_metadata?.perfil_trader
      if (p === 'retail' || p === 'institucional') setProfile(p)
    })
  }, [])

  // ── Fetch Motor signals ──────────────────────────────────────────────────
  const fetchMotor = useCallback(async () => {
    setMotorError(null)
    try {
      const res  = await fetch(`/api/motor/signals?profile=${profile}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const json = await res.json()
      if (json.ok) {
        setMotor({
          signals:     json.signals,
          regime:      json.regime,
          regimeLabel: json.regimeLabel,
          buyCount:    json.buyCount,
          sellCount:   json.sellCount,
          generatedAt: json.generatedAt,
        })
        setLastFetch(new Date().toISOString())
      } else {
        setMotorError(json.error ?? 'Error al cargar señales del Motor')
      }
    } catch (e) {
      setMotorError(e instanceof Error ? e.message : 'Sin conexión al Motor de Decisión')
    }
    finally  { setLoading(false) }
  }, [profile])

  useEffect(() => {
    fetchMotor()
    const id = setInterval(fetchMotor, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchMotor, profile])

  // ── Binance WebSocket ────────────────────────────────────────────────────
  useEffect(() => {
    let ws: WebSocket
    function connect() {
      ws = new WebSocket(WS_URL)
      ws.onopen    = () => setConnected(true)
      ws.onclose   = () => { setConnected(false); setTimeout(connect, 5000) }
      ws.onerror   = () => ws.close()
      ws.onmessage = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data as string) as { data: { s: string; c: string; o: string } }
          const { s: sym, c: closeStr, o: openStr } = msg.data
          const label  = SYM_LABEL[sym]
          if (!label) return
          const price  = parseFloat(closeStr)
          const open24 = parseFloat(openStr)
          const change = open24 > 0 ? ((price - open24) / open24) * 100 : 0
          setPrices(prev => {
            const idx  = prev.findIndex(p => p.ticker === label)
            const next = { ticker: label, price, change }
            if (idx === -1) return [...prev, next]
            const updated = [...prev]; updated[idx] = next; return updated
          })
        } catch {}
      }
    }
    connect()
    return () => ws?.close()
  }, [])

  // ── Derived ──────────────────────────────────────────────────────────────
  const signals    = motor?.signals ?? []
  const classes    = Array.from(new Set(signals.map(s => s.assetClass))).sort()
  const longCount  = motor?.buyCount  ?? 0
  const shortCount = motor?.sellCount ?? 0
  const bias       = longCount + shortCount > 0
    ? Math.round((longCount / (longCount + shortCount)) * 100) : 50

  const avgConf = signals.length
    ? Math.round(signals.reduce((a, s) => a + s.confidence, 0) / signals.length) : 0

  const visible = signals.filter(s => {
    if (search    && !s.name.toLowerCase().includes(search.toLowerCase()) &&
                     !s.ticker?.toLowerCase().includes(search.toLowerCase())) return false
    if (sigFilter   !== 'ALL' && s.signal !== sigFilter)    return false
    if (classFilter !== 'ALL' && s.assetClass !== classFilter) return false
    return true
  })

  const regime      = motor?.regime ?? 'neutral'
  const regimeLabel = motor?.regimeLabel ?? '—'

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono,'DM Mono',monospace)" }}>
      <div className="dash-content" style={{ maxWidth: 1400, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>
              {'// HUD · SEÑALES DEL MOTOR · SIGMA RESEARCH'}
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue',var(--font-bebas),Impact,sans-serif", fontSize: 'clamp(40px,5vw,72px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
              <span style={{ color: C.text }}>SIGNAL</span>{' '}
              <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>HUD</span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {lastFetch && (
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted }}>
                Actualizado: {new Date(lastFetch).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={fetchMotor}
              disabled={loading}
              style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', color: C.gold, background: `${C.gold}14`, border: `1px solid ${C.gold}44`, padding: '6px 14px', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? '⟳ CARGANDO…' : '↻ REFRESCAR'}
            </button>
          </div>
        </div>

        {/* ── Price bar ── */}
        <style>{`@keyframes sk{0%{background-position:-200% 0}100%{background-position:200% 0}}.sk{background:linear-gradient(90deg,${C.border} 25%,${C.surface} 50%,${C.border} 75%);background-size:200% 100%;animation:sk 1.4s ease infinite;border-radius:2px}`}</style>
        <div style={{ display: 'flex', gap: 1, background: C.border, marginBottom: 1, overflowX: 'auto' }}>
          {prices.length === 0
            ? WS_TICKERS.map(t => (
                <div key={t} style={{ background: C.surface, padding: '12px 18px', flex: '1 0 auto', minWidth: 100 }}>
                  <div className="sk" style={{ width: 30, height: 10, marginBottom: 8 }} />
                  <div className="sk" style={{ width: 60, height: 14, marginBottom: 6 }} />
                  <div className="sk" style={{ width: 40, height: 11 }} />
                </div>
              ))
            : prices.map(p => (
                <div key={p.ticker} style={{ background: C.surface, padding: '12px 18px', flex: '1 0 auto', minWidth: 100 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 4 }}>{p.ticker}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 14, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(p.price)}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: p.change >= 0 ? C.green : C.red, marginTop: 2 }}>
                    {p.change >= 0 ? '+' : ''}{p.change.toFixed(2)}%
                  </div>
                </div>
              ))
          }
        </div>

        {/* ── KPI cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 1, background: C.border, marginBottom: 1 }}>
          <div style={{ background: C.surface, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6 }}>RÉGIMEN DE MERCADO</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: regimeColor(regime), boxShadow: `0 0 8px ${regimeColor(regime)}`, flexShrink: 0 }} />
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: regimeColor(regime), fontWeight: 600 }}>
                {loading ? '—' : regimeLabel.toUpperCase()}
              </span>
            </div>
          </div>

          <div style={{ background: C.surface, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6 }}>BIAS DEL MOTOR</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.green }}>{longCount} COMPRAR</span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>vs</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.red }}>{shortCount} REDUCIR</span>
            </div>
            <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${bias}%`, background: bias >= 50 ? C.green : C.red, borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
          </div>

          <div style={{ background: C.surface, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6 }}>ACTIVOS ANALIZADOS</div>
            <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 40, color: C.gold, lineHeight: 1 }}>
              {loading ? '—' : signals.length}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, marginTop: 2 }}>
              {loading ? '' : `${longCount + shortCount} con señal activa`}
            </div>
          </div>

          <div style={{ background: C.surface, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6 }}>CONFIANZA PROMEDIO</div>
            <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 40, color: C.glow, lineHeight: 1 }}>
              {loading ? '—' : `${avgConf}%`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? C.green : C.red }} />
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: connected ? C.green : C.red }}>
                {connected ? 'BINANCE LIVE' : 'CONECTANDO…'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Main grid ── */}
        <style>{`@media(max-width:767px){.hud-main-grid{grid-template-columns:1fr !important}}`}</style>
        <div className="hud-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 1, background: C.border, minHeight: 500 }}>

          {/* ── Signal feed ── */}
          <div style={{ background: C.bg }}>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 1, background: C.border, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160, background: C.surface, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>⌕</span>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar activo…"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'monospace', fontSize: 11, color: C.text, minWidth: 0 }}
                />
                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontFamily: 'monospace', fontSize: 11, padding: 0 }}>✕</button>}
              </div>

              {(['ALL', 'comprar', 'reducir'] as const).map(f => (
                <button key={f} onClick={() => setSigFilter(f)}
                  style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.12em', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                    background: sigFilter === f ? (f === 'comprar' ? C.green : f === 'reducir' ? C.red : C.gold) : C.surface,
                    color:      sigFilter === f ? C.bg : C.dimText,
                  }}>
                  {f === 'ALL' ? 'TODOS' : f === 'comprar' ? 'COMPRAR' : 'REDUCIR'}
                </button>
              ))}

              {classes.map(cl => (
                <button key={cl} onClick={() => setClassFilter(classFilter === cl ? 'ALL' : cl)}
                  style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.12em', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                    background: classFilter === cl ? C.gold : C.surface,
                    color:      classFilter === cl ? C.bg : C.muted,
                  }}>
                  {classLabel(cl)}
                </button>
              ))}

              <div style={{ background: C.surface, padding: '8px 12px', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>{visible.length} activos</span>
              </div>
            </div>

            {/* Error del motor */}
            {motorError && (
              <div style={{ padding: '14px 20px', background: 'rgba(248,113,113,0.08)', borderBottom: `1px solid rgba(248,113,113,0.25)`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.15em', color: C.red, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', padding: '2px 8px', flexShrink: 0 }}>ERROR</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.red }}>{motorError}</span>
                <button onClick={fetchMotor} style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 10, color: C.gold, background: 'none', border: `1px solid ${C.gold}44`, cursor: 'pointer', padding: '4px 12px', flexShrink: 0 }}>REINTENTAR</button>
              </div>
            )}

            {/* Tabla */}
            <div style={{ overflowX: 'auto' }}>
              {loading ? (
                <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, letterSpacing: '0.15em' }}>CARGANDO SEÑALES DEL MOTOR…</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Activo', 'Clase', 'Señal', 'Score', 'Confianza', 'Ret. 30d', 'EV Neto', 'Conds', 'Hace'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: C.dimText, fontWeight: 400, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, letterSpacing: '0.15em' }}>
                            SIN RESULTADOS PARA EL FILTRO ACTUAL
                          </div>
                        </td>
                      </tr>
                    ) : visible.map((s, i) => {
                      const isBuy    = s.signal === 'comprar'
                      const isSell   = s.signal === 'reducir'
                      const sc       = signalColor(s.signal)
                      const scoreCol = s.score >= 65 ? C.green : s.score >= 45 ? C.yellow : C.red
                      const confCol  = s.confidence >= 70 ? C.green : s.confidence >= 50 ? C.yellow : C.red
                      const ret30Col = (s.return30d ?? 0) >= 0 ? C.green : C.red
                      const evCol    = (s.evNeto ?? 0) > 0 ? C.green : (s.evNeto ?? 0) < 0 ? C.red : C.dimText

                      return (
                        <tr key={s.id} style={{
                          borderBottom: `1px solid ${C.border}`,
                          background: i === 0 && (isBuy || isSell) ? `${sc}08` : 'transparent',
                          opacity: s.signal === 'mantener' || s.signal === 'neutral' ? 0.6 : 1,
                        }}>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ color: C.text, fontWeight: 600 }}>{s.name}</div>
                            {s.ticker && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{s.ticker}</div>}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ fontSize: 9, letterSpacing: '0.1em', color: C.dimText, background: `${C.border}`, padding: '2px 6px' }}>
                              {classLabel(s.assetClass)}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ color: sc, fontWeight: 700, letterSpacing: '0.1em', fontSize: 11 }}>
                              {signalLabel(s.signal)}
                              {s.signalChanged && <span style={{ marginLeft: 6, fontSize: 9, color: C.gold }}>● NUEVA</span>}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 40, height: 4, background: C.border }}>
                                <div style={{ height: '100%', width: `${s.score}%`, background: scoreCol }} />
                              </div>
                              <span style={{ color: scoreCol, minWidth: 24, fontSize: 11 }}>{s.score}</span>
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px', color: confCol, fontVariantNumeric: 'tabular-nums' }}>
                            {s.confidence}%
                          </td>
                          <td style={{ padding: '11px 14px', color: ret30Col, fontVariantNumeric: 'tabular-nums' }}>
                            {(s.return30d ?? 0) >= 0 ? '+' : ''}{(s.return30d ?? 0).toFixed(1)}%
                          </td>
                          <td style={{ padding: '11px 14px', color: evCol, fontVariantNumeric: 'tabular-nums' }}>
                            {(s.evNeto ?? 0) > 0 ? '+' : ''}{(s.evNeto ?? 0).toFixed(1)}%
                          </td>
                          <td style={{ padding: '11px 14px', color: C.dimText, fontSize: 11 }}>
                            {s.conditionsMet}/{s.conditionsTotal}
                          </td>
                          <td style={{ padding: '11px 14px', color: C.muted, fontSize: 11 }}>
                            {motor?.generatedAt ? timeAgo(motor.generatedAt) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Right panel ── */}
          <div style={{ background: C.surface, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>
                MODELOS ACTIVOS
              </span>
            </div>
            {[
              { tag: 'HMM-01',   name: 'REGIME DETECTOR',  status: true,  metric: '91.2% acc' },
              { tag: 'XGB-03',   name: 'MOMENTUM SCORE',   status: true,  metric: '2.41 sharpe' },
              { tag: 'STAT-05',  name: 'PAIRS TRADING',    status: true,  metric: '1.87 sharpe' },
              { tag: 'GARCH-02', name: 'VOL FORECASTER',   status: true,  metric: '0.031 MAE' },
              { tag: 'NLP-04',   name: 'SENTIMENT ALPHA',  status: false, metric: 'en revisión' },
            ].map(m => (
              <div key={m.tag} style={{ padding: '13px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.status ? C.green : C.muted, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.gold, letterSpacing: '0.1em' }}>{m.tag}</span>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: m.status ? C.text : C.muted }}>{m.name}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, marginTop: 2 }}>{m.metric}</div>
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: m.status ? C.green : C.muted, letterSpacing: '0.1em' }}>
                  {m.status ? 'ON' : 'OFF'}
                </span>
              </div>
            ))}

            <div style={{ padding: '16px 20px', marginTop: 'auto', borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 8 }}>ACCIONES RÁPIDAS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href="/motor-decision" style={{ display: 'block', padding: '10px 14px', border: `1px solid ${C.gold}44`, background: `${C.gold}10`, fontFamily: 'monospace', fontSize: 11, color: C.gold, textDecoration: 'none', textAlign: 'center', letterSpacing: '0.15em' }}>
                  VER MOTOR COMPLETO
                </Link>
                <Link href="/journal" style={{ display: 'block', padding: '10px 14px', border: `1px solid ${C.border}`, fontFamily: 'monospace', fontSize: 11, color: C.dimText, textDecoration: 'none', textAlign: 'center', letterSpacing: '0.15em' }}>
                  + AÑADIR AL JOURNAL
                </Link>
                <Link href="/calendario" style={{ display: 'block', padding: '10px 14px', border: `1px solid ${C.border}`, fontFamily: 'monospace', fontSize: 11, color: C.dimText, textDecoration: 'none', textAlign: 'center', letterSpacing: '0.15em' }}>
                  VER MACRO CALENDAR
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
