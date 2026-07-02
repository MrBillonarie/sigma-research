'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, AreaSeries } from 'lightweight-charts'
import { C, F } from '@/app/lib/constants'

// ── Symbol config ──────────────────────────────────────────────────────────────

const SYMBOLS = [
  { label: 'BTC',  pair: 'BTCUSDT',  ws: 'btcusdt'  },
  { label: 'ETH',  pair: 'ETHUSDT',  ws: 'ethusdt'  },
  { label: 'SOL',  pair: 'SOLUSDT',  ws: 'solusdt'  },
  { label: 'BNB',  pair: 'BNBUSDT',  ws: 'bnbusdt'  },
  { label: 'LTC',  pair: 'LTCUSDT',  ws: 'ltcusdt'  },
  { label: 'XAU',  pair: 'XAUUSDT',  ws: 'xauusdt'  },
  { label: 'WTI',  pair: 'WTIUSDT',  ws: 'wtiusdt'  },
] as const

type SymLabel = typeof SYMBOLS[number]['label']

const TIMEFRAMES = ['15m', '1h', '4h', '1d'] as const
type TF = typeof TIMEFRAMES[number]

// Binance interval strings
const TF_INTERVAL: Record<TF, string> = { '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' }

// ── Types ──────────────────────────────────────────────────────────────────────

interface Kline { time: number; value: number }
interface Stats { price: number; change24h: number; volume24h: number }

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtPrice(v: number): string {
  if (v >= 1000) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (v >= 1)    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  return v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

function fmtVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

// ── PriceChart component ───────────────────────────────────────────────────────

interface ChartProps {
  data: Kline[]
  livePrice: number | null
}

function PriceChart({ data, livePrice }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<ReturnType<typeof createChart> | null>(null)
  const seriesRef    = useRef<ReturnType<typeof chartRef.current extends null ? never : (typeof chartRef.current)['addSeries']> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: C.bg },
        textColor:  C.dimText,
        fontFamily: 'monospace',
        fontSize:   10,
      },
      grid: {
        vertLines: { color: C.border },
        horzLines: { color: C.border },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: C.gold + '50', labelBackgroundColor: C.surface },
        horzLine: { color: C.gold + '50', labelBackgroundColor: C.surface },
      },
      rightPriceScale: { borderColor: C.border },
      timeScale:       { borderColor: C.border },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series = (chart as any).addSeries(AreaSeries, {
      lineColor:   C.gold,
      topColor:    C.gold + '28',
      bottomColor: C.gold + '04',
      lineWidth:   2,
    })

    chartRef.current  = chart
    seriesRef.current = series

    if (data.length) {
      series.setData(data)
      chart.timeScale().fitContent()
    }

    const ro = new ResizeObserver(entries => {
      chart.applyOptions({ width: entries[0].contentRect.width })
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current  = null
      seriesRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount only — data updates handled below

  // Update data when symbol/TF changes
  useEffect(() => {
    if (!seriesRef.current || !data.length) return
    seriesRef.current.setData(data)
    chartRef.current?.timeScale().fitContent()
  }, [data])

  // Update live price candle
  useEffect(() => {
    if (!seriesRef.current || !livePrice || !data.length) return
    const last = data[data.length - 1]
    seriesRef.current.update({ time: last.time, value: livePrice })
  }, [livePrice, data])

  return (
    <div style={{ background: C.bg, borderTop: `1px solid ${C.border}` }}>
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TerminalPage() {
  const [sym,       setSym]       = useState<SymLabel>('BTC')
  const [tf,        setTf]        = useState<TF>('4h')
  const [klines,    setKlines]    = useState<Kline[]>([])
  const [stats,     setStats]     = useState<Stats | null>(null)
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const symConfig = SYMBOLS.find(s => s.label === sym)!

  // ── Fetch historical klines ──────────────────────────────────────────────────

  const fetchKlines = useCallback(async (pair: string, interval: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=150`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Binance ${res.status}`)
      const raw: [number, string, string, string, string, string][] = await res.json()
      const data: Kline[] = raw.map(k => ({
        time:  Math.floor(k[0] / 1000) as unknown as number,
        value: parseFloat(k[4]), // close price
      }))
      setKlines(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos')
      setKlines([])
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Fetch 24h ticker stats ───────────────────────────────────────────────────

  const fetchStats = useCallback(async (pair: string) => {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`)
      if (!res.ok) return
      const d = await res.json()
      setStats({
        price:    parseFloat(d.lastPrice),
        change24h: parseFloat(d.priceChangePercent),
        volume24h: parseFloat(d.quoteVolume),
      })
    } catch {
      // stats are non-critical — fail silently
    }
  }, [])

  // Reload on symbol / timeframe change
  useEffect(() => {
    setLivePrice(null)
    setStats(null)
    fetchKlines(symConfig.pair, TF_INTERVAL[tf])
    fetchStats(symConfig.pair)
  }, [sym, tf, symConfig.pair, fetchKlines, fetchStats])

  // ── Live price WebSocket ─────────────────────────────────────────────────────

  useEffect(() => {
    let ws: WebSocket
    let dead = false

    function connect() {
      if (dead) return
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symConfig.ws}@miniTicker`)
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data)
          const p = parseFloat(d.c)
          if (!isNaN(p)) {
            setLivePrice(p)
            setStats(prev => prev ? { ...prev, price: p } : prev)
          }
        } catch {}
      }
      ws.onerror = () => ws.close()
      ws.onclose = () => { if (!dead) setTimeout(connect, 5000) }
    }

    connect()
    return () => { dead = true; ws?.close() }
  }, [symConfig.ws])

  // ── Styles ────────────────────────────────────────────────────────────────────

  const mono: React.CSSProperties = { fontFamily: F.mono }

  function btnSym(active: boolean): React.CSSProperties {
    return {
      ...mono,
      fontSize: 11,
      letterSpacing: '0.12em',
      padding: '6px 14px',
      border: `1px solid ${active ? C.gold : C.border}`,
      background: active ? C.gold + '18' : 'transparent',
      color: active ? C.gold : C.dimText,
      cursor: 'pointer',
      borderRadius: 4,
      transition: 'all 0.15s',
    }
  }

  function btnTf(active: boolean): React.CSSProperties {
    return {
      ...mono,
      fontSize: 10,
      letterSpacing: '0.1em',
      padding: '4px 12px',
      border: `1px solid ${active ? C.gold : C.border}`,
      background: active ? C.gold + '15' : 'transparent',
      color: active ? C.gold : C.dimText,
      cursor: 'pointer',
      borderRadius: 3,
      transition: 'all 0.15s',
    }
  }

  const displayPrice = livePrice ?? stats?.price ?? null
  const change24h    = stats?.change24h ?? null
  const changeColor  = change24h === null ? C.dimText : change24h >= 0 ? C.green : C.red

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, ...mono }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 64px' }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.25em', color: C.dimText, marginBottom: 6 }}>
            {'// SIGMA RESEARCH · TERMINAL'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
            <h1 style={{
              fontFamily: F.display,
              fontSize: 'clamp(32px,4.5vw,52px)',
              letterSpacing: '0.05em',
              margin: 0,
              lineHeight: 1,
            }}>
              <span style={{ color: C.gold }}>{sym}</span>
              <span style={{ color: C.dimText, fontSize: '0.55em', marginLeft: 10 }}>/ USDT</span>
            </h1>

            {/* Live price block */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              {displayPrice !== null ? (
                <>
                  <span style={{ fontFamily: F.display, fontSize: 'clamp(22px,3vw,34px)', color: C.text, letterSpacing: '0.03em' }}>
                    ${fmtPrice(displayPrice)}
                  </span>
                  {change24h !== null && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: changeColor }}>
                      {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                    </span>
                  )}
                  <span style={{ fontSize: 8, color: C.green, letterSpacing: '0.15em' }}>
                    {livePrice ? '● LIVE' : ''}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 13, color: C.muted }}>—</span>
              )}
            </div>
          </div>

          {/* 24h volume */}
          {stats?.volume24h ? (
            <div style={{ fontSize: 10, color: C.dimText, marginTop: 6 }}>
              Vol 24h&nbsp;
              <span style={{ color: C.text }}>{fmtVol(stats.volume24h)}</span>
            </div>
          ) : null}
        </div>

        {/* ── Symbol selector ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {SYMBOLS.map(s => (
            <button key={s.label} style={btnSym(sym === s.label)} onClick={() => setSym(s.label)}>
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Timeframe selector ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {TIMEFRAMES.map(t => (
            <button key={t} style={btnTf(tf === t)} onClick={() => setTf(t)}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Chart ─────────────────────────────────────────────────────────── */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', background: C.bg }}>
          {loading && (
            <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: C.dimText, letterSpacing: '0.2em' }}>CARGANDO DATOS…</span>
            </div>
          )}
          {error && !loading && (
            <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 10, color: C.red, letterSpacing: '0.15em' }}>ERROR AL CARGAR</span>
              <span style={{ fontSize: 10, color: C.dimText }}>{error}</span>
              <span style={{ fontSize: 9, color: C.muted }}>Este par podría no estar disponible en Binance</span>
            </div>
          )}
          {!loading && !error && klines.length > 0 && (
            <PriceChart data={klines} livePrice={livePrice} />
          )}
        </div>

        {/* ── Stats footer ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 1,
          marginTop: 1,
          background: C.border,
          border: `1px solid ${C.border}`,
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          overflow: 'hidden',
        }}>
          {[
            {
              label: 'PRECIO',
              value: displayPrice !== null ? `$${fmtPrice(displayPrice)}` : '—',
              color: C.text,
            },
            {
              label: 'CAMBIO 24H',
              value: change24h !== null ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%` : '—',
              color: changeColor,
            },
            {
              label: 'VOLUMEN 24H',
              value: stats?.volume24h ? fmtVol(stats.volume24h) : '—',
              color: C.text,
            },
            {
              label: 'PAR',
              value: symConfig.pair,
              color: C.dimText,
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: C.surface,
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: 8, letterSpacing: '0.25em', color: C.muted, marginBottom: 5 }}>{label}</div>
              <div style={{ fontFamily: F.display, fontSize: 18, color, lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
