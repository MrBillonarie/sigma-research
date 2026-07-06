'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'

interface Ticker { symbol: string; price: number; change24h: number }
interface Tokens { G: string; BG: string; S: string; B: string; T: string; D: string; M: string }
type Flash = 'up' | 'down' | null

const BINANCE_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
const POLL_MS = 20_000

export default function MotorVivoPanel({
  tokens, regimeNode, regimeGlow, bayesianConfirmed, bayesianWatching, lastDecisionLabel, initialTickers,
}: {
  tokens: Tokens
  regimeNode: ReactNode
  regimeGlow: string
  bayesianConfirmed: number
  bayesianWatching: number
  lastDecisionLabel: string
  initialTickers: Ticker[]
}) {
  const { G, S, B, T, M } = tokens

  const rootRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const [tickers, setTickers] = useState(initialTickers)
  const [flash, setFlash] = useState<Record<string, Flash>>({})
  const prevPrices = useRef<Record<string, number>>(
    Object.fromEntries(initialTickers.map(t => [t.symbol, t.price]))
  )
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (initialTickers.length === 0) return
    const poll = async () => {
      try {
        const symbols = encodeURIComponent(JSON.stringify(BINANCE_SYMBOLS))
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`, { cache: 'no-store' })
        if (!res.ok) return
        const raw: Array<{ symbol: string; lastPrice: string; priceChangePercent: string }> = await res.json()
        const next: Ticker[] = raw.map(t => ({
          symbol: t.symbol.replace('USDT', ''),
          price: parseFloat(t.lastPrice),
          change24h: parseFloat(t.priceChangePercent),
        }))
        next.forEach(t => {
          const prev = prevPrices.current[t.symbol]
          if (prev != null && t.price !== prev) {
            const dir: Flash = t.price > prev ? 'up' : 'down'
            setFlash(f => ({ ...f, [t.symbol]: dir }))
            clearTimeout(flashTimers.current[t.symbol])
            flashTimers.current[t.symbol] = setTimeout(() => {
              setFlash(f => ({ ...f, [t.symbol]: null }))
            }, 900)
          }
          prevPrices.current[t.symbol] = t.price
        })
        setTickers(next)
      } catch {
        // Binance puede fallar por CORS/red — se mantienen los precios ya
        // renderizados por el server, sin mostrar error al usuario.
      }
    }
    const id = setInterval(poll, POLL_MS)
    const timers = flashTimers.current
    return () => { clearInterval(id); Object.values(timers).forEach(clearTimeout) }
  }, [initialTickers])

  const rows = tickers.length > 0 ? tickers : [
    { symbol: 'BTC', price: 0, change24h: 0 },
    { symbol: 'ETH', price: 0, change24h: 0 },
    { symbol: 'SOL', price: 0, change24h: 0 },
    { symbol: 'BNB', price: 0, change24h: 0 },
  ]

  return (
    <div
      ref={rootRef}
      style={{
        border: `1px solid ${visible ? `${regimeGlow}45` : B}`,
        boxShadow: visible ? `0 0 0 1px ${regimeGlow}18, 0 0 40px -8px ${regimeGlow}35` : 'none',
        transition: 'border-color 0.9s ease, box-shadow 0.9s ease',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 1, background: B }}>

        {/* Panel izquierdo: status del engine */}
        <div style={{ background: S, padding: '32px 28px', position: 'relative', overflow: 'hidden', isolation: 'isolate' }}>
          {/* Watermark de marca — Σ tenue, llena el espacio muerto del panel */}
          <div style={{
            position: 'absolute', right: -16, bottom: -54, zIndex: -1,
            fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 220, lineHeight: 1,
            color: G, opacity: 0.12, pointerEvents: 'none', userSelect: 'none',
          }}>
            Σ
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2fd39a', boxShadow: '0 0 8px #2fd39a', flexShrink: 0 }} />
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#2fd39a', letterSpacing: '0.25em' }}>SIGMA ENGINE · ACTIVO</span>
          </div>

          {([
            { k: 'RÉGIMEN MERCADO',   node: regimeNode, v: null },
            { k: 'EDGES CONFIRMADOS', node: null, v: `${bayesianConfirmed} modelo${bayesianConfirmed !== 1 ? 's' : ''}` },
            { k: 'EN OBSERVACIÓN',    node: null, v: `${bayesianWatching} activo${bayesianWatching !== 1 ? 's' : ''}` },
            { k: 'ÚLTIMA DECISIÓN',   node: null, v: lastDecisionLabel },
          ] as Array<{ k: string; node: ReactNode | null; v: string | null }>).map(({ k, node, v }) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid ${B}` }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: M, letterSpacing: '0.2em' }}>{k}</span>
              {node ?? <span style={{ fontFamily: 'monospace', fontSize: 11, color: T }}>{v}</span>}
            </div>
          ))}

          <p style={{ fontFamily: 'monospace', fontSize: 11, color: M, lineHeight: 1.85, marginTop: 22, borderLeft: `2px solid ${G}30`, paddingLeft: 14 }}>
            El motor evalúa posiciones cada ciclo y solo activa modelos<br />
            que superan el gate out-of-sample y el filtro Bayesiano.
          </p>
        </div>

        {/* Panel derecho: scanner de precios en vivo */}
        <div style={{ background: S, padding: '32px 28px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: M, letterSpacing: '0.3em', marginBottom: 20 }}>{'// SCANNER · TIEMPO REAL'}</div>

          {rows.map(t => {
            const f = flash[t.symbol]
            return (
              <div key={t.symbol} style={{
                padding: '13px 8px', margin: '0 -8px', borderBottom: `1px solid ${B}`,
                display: 'flex', alignItems: 'center', gap: 14,
                background: f === 'up' ? 'rgba(52,211,153,0.10)' : f === 'down' ? 'rgba(248,113,113,0.10)' : 'transparent',
                transition: 'background-color 0.7s ease',
              }}>
                <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 22, color: T, width: 44, flexShrink: 0 }}>{t.symbol}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: T, flex: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {t.price > 0 ? `$${t.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 10, width: 68, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: t.change24h >= 0 ? '#2fd39a' : '#ff5d6c' }}>
                  {t.price > 0 ? `${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(2)}%` : '—'}
                </span>
                {/* Señal bloqueada — chip tipo vidrio esmerilado con candado, visible completa solo en dashboard */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: 8,
                  padding: '4px 8px', letterSpacing: '0.15em', color: G,
                  border: `1px solid ${G}30`, background: `${G}0d`, backdropFilter: 'blur(2px)', flexShrink: 0,
                }}>
                  <svg width="8" height="9" viewBox="0 0 8 9" fill="none" aria-hidden="true">
                    <path d="M2 4V2.5a2 2 0 0 1 4 0V4M1.3 4h5.4a.6.6 0 0 1 .6.6v3.3a.6.6 0 0 1-.6.6H1.3a.6.6 0 0 1-.6-.6V4.6a.6.6 0 0 1 .6-.6Z" stroke={G} strokeWidth="0.8" />
                  </svg>
                  <span style={{ filter: 'blur(2.5px)' }}>SEÑAL</span>
                </div>
              </div>
            )
          })}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${B}` }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: M, lineHeight: 1.85, marginBottom: 14 }}>
              SEÑALES COMPLETAS BUY / SELL / HOLD<br />
              DISPONIBLES EN DASHBOARD DESPUÉS DEL REGISTRO
            </div>
            <Link href="/registro" className="gold-cta" style={{ display: 'inline-block', fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.2em', color: tokens.BG, background: `linear-gradient(135deg, ${G}, #2f6bd6)`, padding: '10px 20px', textDecoration: 'none', boxShadow: 'none' }}>
              VER SEÑALES COMPLETAS →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
