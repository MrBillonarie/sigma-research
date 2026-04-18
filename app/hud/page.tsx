'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const C = {
  bg:      '#04050a',
  surface: '#0b0d14',
  border:  '#1a1d2e',
  muted:   '#3a3f55',
  dimText: '#7a7f9a',
  text:    '#e8e9f0',
  gold:    '#d4af37',
  glow:    '#f0cc5a',
  green:   '#34d399',
  red:     '#f87171',
  yellow:  '#fbbf24',
  purple:  '#a78bfa',
} as const

// ─── Types ────────────────────────────────────────────────────────────────────
type Direction = 'LONG' | 'SHORT' | 'NEUTRAL'
type Timeframe = '15m' | '1H' | '4H' | '1D'
type Strength  = 'FUERTE' | 'MODERADA' | 'DÉBIL'

interface Signal {
  id:         number
  ticker:     string
  direction:  Direction
  timeframe:  Timeframe
  confidence: number
  entry:      number
  tp:         number
  sl:         number
  strength:   Strength
  model:      string
  ts:         number
}

interface Price {
  ticker: string
  price:  number
  change: number
  prev:   number
}

// ─── Seed data ────────────────────────────────────────────────────────────────
const BASE_PRICES: Record<string, number> = {
  'BTC/USDT': 84_200, 'ETH/USDT': 3_180, 'BNB/USDT': 590,
  'SOL/USDT': 148,    'AVAX/USDT': 36,   'ARB/USDT': 1.12,
}

const SIGNAL_POOL: Omit<Signal, 'id' | 'ts'>[] = [
  { ticker: 'BTC/USDT', direction: 'LONG',  timeframe: '4H', confidence: 87, entry: 83_900, tp: 86_500, sl: 82_400, strength: 'FUERTE',   model: 'HMM-01' },
  { ticker: 'ETH/USDT', direction: 'LONG',  timeframe: '1D', confidence: 74, entry:  3_150, tp:  3_400, sl:  3_000, strength: 'MODERADA', model: 'XGB-03' },
  { ticker: 'BNB/USDT', direction: 'SHORT', timeframe: '1H', confidence: 68, entry:    595, tp:    570, sl:    610, strength: 'MODERADA', model: 'XGB-03' },
  { ticker: 'SOL/USDT', direction: 'LONG',  timeframe: '4H', confidence: 81, entry:    145, tp:    162, sl:    138, strength: 'FUERTE',   model: 'HMM-01' },
  { ticker: 'BTC/USDT', direction: 'SHORT', timeframe: '15m',confidence: 61, entry: 84_400, tp: 83_100, sl: 85_200, strength: 'DÉBIL',    model: 'STAT-05' },
  { ticker: 'AVAX/USDT',direction: 'LONG',  timeframe: '1H', confidence: 72, entry:     35, tp:     40, sl:     33, strength: 'MODERADA', model: 'GARCH-02' },
  { ticker: 'ARB/USDT', direction: 'SHORT', timeframe: '4H', confidence: 78, entry:   1.14, tp:   1.00, sl:   1.22, strength: 'FUERTE',   model: 'XGB-03' },
  { ticker: 'ETH/USDT', direction: 'SHORT', timeframe: '1H', confidence: 65, entry:  3_200, tp:  3_050, sl:  3_280, strength: 'DÉBIL',    model: 'STAT-05' },
]

function dirColor(d: Direction) {
  if (d === 'LONG')    return C.green
  if (d === 'SHORT')   return C.red
  return C.yellow
}

function strengthColor(s: Strength) {
  if (s === 'FUERTE')   return C.green
  if (s === 'MODERADA') return C.yellow
  return C.muted
}

function fmtPrice(p: number) {
  return p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : p >= 1 ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : p.toFixed(4)
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)  return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HudPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [prices,  setPrices]  = useState<Price[]>([])
  const [tick,    setTick]    = useState(0)
  const [regime,  setRegime]  = useState<{ label: string; color: string; adx: number }>({
    label: 'LATERAL NORMAL', color: C.yellow, adx: 18,
  })

  // ── Init signals & prices ─────────────────────────────────────────────────
  useEffect(() => {
    const initial = SIGNAL_POOL.slice(0, 5).map((s, i) => ({
      ...s, id: i + 1, ts: Date.now() - (i * 7 * 60_000),
    }))
    setSignals(initial)

    setPrices(Object.entries(BASE_PRICES).map(([ticker, price]) => ({
      ticker, price, prev: price, change: (Math.random() - 0.48) * 2,
    })))
  }, [])

  // ── Live price simulation ─────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setPrices(prev => prev.map(p => {
        const delta = p.price * (Math.random() - 0.498) * 0.003
        const next  = p.price + delta
        const change = ((next - p.prev) / p.prev) * 100
        return { ...p, price: next, change }
      }))
      setTick(t => t + 1)
    }, 2000)
    return () => clearInterval(id)
  }, [])

  // ── New signal every ~30s ─────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const template = SIGNAL_POOL[Math.floor(Math.random() * SIGNAL_POOL.length)]
      const newSig: Signal = { ...template, id: Date.now(), ts: Date.now() }
      setSignals(prev => [newSig, ...prev].slice(0, 20))

      const adx = Math.floor(Math.random() * 40) + 5
      setRegime(
        adx < 15  ? { label: 'LATERAL TIGHT',  color: C.green,  adx } :
        adx <= 25 ? { label: 'LATERAL NORMAL', color: C.yellow, adx } :
                    { label: 'TRENDING',        color: C.red,    adx }
      )
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const longCount  = signals.filter(s => s.direction === 'LONG').length
  const shortCount = signals.filter(s => s.direction === 'SHORT').length
  const bias = longCount + shortCount > 0
    ? Math.round((longCount / (longCount + shortCount)) * 100)
    : 50

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono,'DM Mono',monospace)" }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>
            {'// HUD · SEÑALES EN VIVO · SIGMA RESEARCH'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',var(--font-bebas),Impact,sans-serif", fontSize: 'clamp(40px,5vw,72px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ color: C.text }}>SIGNAL</span>{' '}
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>HUD</span>
          </h1>
        </div>

        {/* ── Live price bar ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 1, background: C.border, marginBottom: 1, overflowX: 'auto' }}>
          {prices.map(p => (
            <div key={p.ticker} style={{ background: C.surface, padding: '12px 18px', flex: '1 0 auto', minWidth: 120 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 4 }}>
                {p.ticker.replace('/USDT', '')}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                {fmtPrice(p.price)}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: p.change >= 0 ? C.green : C.red, marginTop: 2 }}>
                {p.change >= 0 ? '+' : ''}{p.change.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>

        {/* ── Regime + bias ─────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 1, background: C.border, marginBottom: 1 }}>
          <div style={{ background: C.surface, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6 }}>RÉGIMEN DE MERCADO</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: regime.color, boxShadow: `0 0 8px ${regime.color}`, flexShrink: 0 }} />
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: regime.color, fontWeight: 600 }}>{regime.label}</span>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, marginTop: 4 }}>ADX {regime.adx}</div>
          </div>

          <div style={{ background: C.surface, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6 }}>BIAS DEL MERCADO</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.green }}>{longCount} LONG</span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>vs</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.red }}>{shortCount} SHORT</span>
            </div>
            <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${bias}%`, background: bias >= 50 ? C.green : C.red, borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
          </div>

          <div style={{ background: C.surface, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6 }}>SEÑALES ACTIVAS</div>
            <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 40, color: C.gold, lineHeight: 1 }}>{signals.length}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, marginTop: 2 }}>Última: {signals[0] ? timeAgo(signals[0].ts) : '—'}</div>
          </div>

          <div style={{ background: C.surface, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6 }}>CONFIANZA PROMEDIO</div>
            <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 40, color: C.glow, lineHeight: 1 }}>
              {signals.length ? Math.round(signals.reduce((a, s) => a + s.confidence, 0) / signals.length) : 0}%
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, marginTop: 2 }}>Últimas {signals.length} señales</div>
          </div>
        </div>

        {/* ── Main grid: signals + detail ───────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 1, background: C.border, minHeight: 500 }}>

          {/* Signal feed */}
          <div style={{ background: C.bg }}>
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>
                FEED DE SEÑALES
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, animation: 'pulse 2s infinite' }} />
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.green }}>EN VIVO</span>
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['Par', 'Dirección', 'TF', 'Entrada', 'TP', 'SL', 'Confianza', 'Modelo', 'Hace'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: C.dimText, fontWeight: 400, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {signals.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}`, background: i === 0 ? `${C.gold}08` : 'transparent', opacity: i === 0 ? 1 : Math.max(0.4, 1 - i * 0.06) }}>
                      <td style={{ padding: '12px 16px', color: C.text, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.ticker}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: dirColor(s.direction), fontWeight: 700, letterSpacing: '0.1em' }}>{s.direction}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: C.dimText }}>{s.timeframe}</td>
                      <td style={{ padding: '12px 16px', color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(s.entry)}</td>
                      <td style={{ padding: '12px 16px', color: C.green, fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(s.tp)}</td>
                      <td style={{ padding: '12px 16px', color: C.red, fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(s.sl)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: C.border, minWidth: 50 }}>
                            <div style={{ height: '100%', width: `${s.confidence}%`, background: s.confidence >= 75 ? C.green : s.confidence >= 60 ? C.yellow : C.red }} />
                          </div>
                          <span style={{ color: s.confidence >= 75 ? C.green : s.confidence >= 60 ? C.yellow : C.red, minWidth: 32 }}>{s.confidence}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: C.purple, fontSize: 11 }}>{s.model}</td>
                      <td style={{ padding: '12px 16px', color: C.muted, fontSize: 11 }}>{timeAgo(s.ts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right panel: model status */}
          <div style={{ background: C.surface, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>
                MODELOS ACTIVOS
              </span>
            </div>
            {[
              { tag: 'HMM-01',  name: 'REGIME DETECTOR',  status: true,  metric: '91.2% acc' },
              { tag: 'XGB-03',  name: 'MOMENTUM SCORE',   status: true,  metric: '2.41 sharpe' },
              { tag: 'STAT-05', name: 'PAIRS TRADING',    status: true,  metric: '1.87 sharpe' },
              { tag: 'GARCH-02',name: 'VOL FORECASTER',   status: true,  metric: '0.031 MAE' },
              { tag: 'NLP-04',  name: 'SENTIMENT ALPHA',  status: false, metric: 'en revisión' },
            ].map(m => (
              <div key={m.tag} style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                <Link href="/journal" style={{ display: 'block', padding: '10px 14px', border: `1px solid ${C.border}`, fontFamily: 'monospace', fontSize: 11, color: C.gold, textDecoration: 'none', textAlign: 'center', letterSpacing: '0.15em' }}>
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
