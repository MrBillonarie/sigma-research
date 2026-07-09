'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, AreaSeries } from 'lightweight-charts'
import { C, F, cardStyle, numberEmboss } from '@/app/lib/constants'

// ── Symbol config ──────────────────────────────────────────────────────────────

interface SymCfg {
  label: string
  src: 'binance' | 'yahoo'   // yahoo: sin par en Binance — klines vía /api/market/klines
  pair?: string
  ws?: string
}

const SYMBOLS: SymCfg[] = [
  // Motor 1 — crypto (Binance spot)
  { label: 'BTC',  src: 'binance', pair: 'BTCUSDT', ws: 'btcusdt' },
  { label: 'ETH',  src: 'binance', pair: 'ETHUSDT', ws: 'ethusdt' },
  { label: 'SOL',  src: 'binance', pair: 'SOLUSDT', ws: 'solusdt' },
  { label: 'BNB',  src: 'binance', pair: 'BNBUSDT', ws: 'bnbusdt' },
  { label: 'LTC',  src: 'binance', pair: 'LTCUSDT', ws: 'ltcusdt' },
  // Motor 2 — commodities (futuros vía Yahoo)
  { label: 'XAU',  src: 'yahoo' },
  { label: 'WTI',  src: 'yahoo' },
  // Motor 3 — S&P 500 stocks (Yahoo)
  { label: 'AAPL', src: 'yahoo' },
  { label: 'NVDA', src: 'yahoo' },
  { label: 'TSLA', src: 'yahoo' },
  { label: 'JPM',  src: 'yahoo' },
  { label: 'XOM',  src: 'yahoo' },
  // Motor 4 — índices (ETFs vía Yahoo)
  { label: 'SPY',  src: 'yahoo' },
  { label: 'QQQ',  src: 'yahoo' },
  { label: 'IWM',  src: 'yahoo' },
  { label: 'XLE',  src: 'yahoo' },
]

// Agrupación visual por motor (mismos labels que el rail de precios del HUD)
const SYMBOL_GROUPS = [
  { tag: 'M1 · CRYPTO', labels: ['BTC', 'ETH', 'SOL', 'BNB', 'LTC'] },
  { tag: 'M2 · COMM',   labels: ['XAU', 'WTI'] },
  { tag: 'M3 · STOCKS', labels: ['AAPL', 'NVDA', 'TSLA', 'JPM', 'XOM'] },
  { tag: 'M4 · ÍNDICES', labels: ['SPY', 'QQQ', 'IWM', 'XLE'] },
]

type SymLabel = string

const TIMEFRAMES = ['15m', '1h', '4h', '1d'] as const
type TF = typeof TIMEFRAMES[number]

// Binance interval strings
const TF_INTERVAL: Record<TF, string> = { '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' }

// ── Types ──────────────────────────────────────────────────────────────────────

interface Kline { time: number; value: number }
interface Stats {
  price: number
  change24h: number
  volume24h: number
  high24h?: number
  low24h?: number
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtPrice(v: number): string {
  if (v >= 1000) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (v >= 1)    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  return v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

// Versión corta para espacios reducidos (rango 24h)
function fmtPriceShort(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(1)}K`
  if (v >= 1000)  return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (v >= 1)     return v.toFixed(2)
  return v.toFixed(4)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef    = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.VerticalGradient, topColor: '#081324', bottomColor: '#04070f' },
        textColor:  C.dimText,
        fontFamily: 'monospace',
        fontSize:   10,
      },
      grid: {
        vertLines: { color: 'rgba(57,226,230,0.045)' },
        horzLines: { color: 'rgba(57,226,230,0.055)' },
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
      lineColor:   C.glow,
      topColor:    'rgba(57,226,230,0.22)',
      bottomColor: 'rgba(57,226,230,0.00)',
      lineWidth:   2,
      priceLineColor: C.gold + '80',
      crosshairMarkerBorderColor: C.glow,
      crosshairMarkerBackgroundColor: C.bg,
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
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%' }} />
      {/* Watermark Σ — decorativo, no intercepta el mouse */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 2,
        pointerEvents: 'none', zIndex: 1,
      }}>
        <span style={{ fontFamily: F.display, fontSize: 110, lineHeight: 1, color: 'rgba(57,226,230,0.045)' }}>Σ</span>
        <span style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.45em', color: 'rgba(57,226,230,0.07)' }}>SIGMA RESEARCH</span>
      </div>
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

  // Deep-link: /terminal?symbol=AAPL (usado por la búsqueda del sidebar)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('symbol')?.toUpperCase()
    if (q && SYMBOLS.some(s => s.label === q)) setSym(q)
  }, [])

  // ── Fetch historical klines ──────────────────────────────────────────────────

  const fetchKlines = useCallback(async (cfg: SymCfg, interval: string) => {
    setLoading(true)
    setError(null)
    try {
      if (cfg.src === 'yahoo') {
        const res = await fetch(`/api/market/klines?symbol=${cfg.label}&tf=${interval}`)
        if (!res.ok) throw new Error(`Datos ${res.status}`)
        const d = await res.json()
        const data: Kline[] = Array.isArray(d.klines) ? d.klines : []
        setKlines(data)
        if (d.price != null) {
          setStats({ price: d.price, change24h: d.change24h ?? 0, volume24h: d.volume24h ?? 0 })
        }
      } else {
        const url = `https://api.binance.com/api/v3/klines?symbol=${cfg.pair}&interval=${interval}&limit=150`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Binance ${res.status}`)
        const raw: [number, string, string, string, string, string][] = await res.json()
        const data: Kline[] = raw.map(k => ({
          time:  Math.floor(k[0] / 1000) as unknown as number,
          value: parseFloat(k[4]), // close price
        }))
        setKlines(data)
      }
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
        price:     parseFloat(d.lastPrice),
        change24h: parseFloat(d.priceChangePercent),
        volume24h: parseFloat(d.quoteVolume),
        high24h:   parseFloat(d.highPrice),
        low24h:    parseFloat(d.lowPrice),
      })
    } catch {
      // stats are non-critical — fail silently
    }
  }, [])

  // Reload on symbol / timeframe change
  useEffect(() => {
    setLivePrice(null)
    setStats(null)
    fetchKlines(symConfig, TF_INTERVAL[tf])
    if (symConfig.src === 'binance' && symConfig.pair) fetchStats(symConfig.pair)
    // Yahoo no tiene WebSocket — refrescar por polling
    if (symConfig.src === 'yahoo') {
      const id = setInterval(() => fetchKlines(symConfig, TF_INTERVAL[tf]), 60_000)
      return () => clearInterval(id)
    }
  }, [sym, tf, symConfig, fetchKlines, fetchStats])

  // ── Live price WebSocket (solo símbolos Binance) ────────────────────────────

  useEffect(() => {
    if (symConfig.src !== 'binance' || !symConfig.ws) return
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

  // ── Derived ───────────────────────────────────────────────────────────────────

  const mono: React.CSSProperties = { fontFamily: F.mono }

  const displayPrice = livePrice ?? stats?.price ?? null
  const change24h    = stats?.change24h ?? null
  const changeColor  = change24h === null ? C.dimText : change24h >= 0 ? C.green : C.red
  const hasRange     = stats?.high24h != null && stats?.low24h != null && stats.high24h > stats.low24h
  const rangePct     = hasRange && displayPrice !== null
    ? Math.min(100, Math.max(0, ((displayPrice - stats!.low24h!) / (stats!.high24h! - stats!.low24h!)) * 100))
    : null

  const cardBgSoft = 'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.008))'
  const filoStyle: React.CSSProperties = {
    height: 2,
    background: 'linear-gradient(90deg, rgba(57,226,230,0.85), rgba(79,146,255,0.4) 45%, transparent 82%)',
  }

  return (
    <div id="sigma-terminal" style={{ minHeight: '100vh', background: C.bg, color: C.text, ...mono }}>
      <style>{`
        @keyframes term-pulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
        @keyframes term-shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }

        #sigma-terminal .tsym, #sigma-terminal .ttf {
          font-family: var(--font-dm-mono,'DM Mono','Courier New',monospace);
          cursor: pointer;
          transition: border-color .15s, color .15s, box-shadow .15s, background .15s;
          border: 1px solid ${C.border};
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008));
          color: ${C.dimText};
        }
        #sigma-terminal .tsym {
          font-size: 11px; letter-spacing: .12em;
          padding: 6px 14px; border-radius: 8px;
        }
        #sigma-terminal .ttf {
          font-size: 10px; letter-spacing: .1em;
          padding: 4px 12px; border-radius: 6px;
        }
        #sigma-terminal .tsym:hover, #sigma-terminal .ttf:hover {
          border-color: ${C.border2}; color: ${C.text};
        }
        #sigma-terminal .tsym.on, #sigma-terminal .ttf.on {
          border-color: rgba(57,226,230,0.55);
          background: linear-gradient(180deg, rgba(57,226,230,0.16), rgba(57,226,230,0.04));
          color: ${C.glow};
          box-shadow: 0 0 18px rgba(57,226,230,0.16), inset 0 1px 0 rgba(255,255,255,0.06);
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 64px' }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 22 }}>
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
              <span style={{
                background: `linear-gradient(100deg, ${C.glow}, #4f92ff)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>{sym}</span>
              <span style={{ color: C.dimText, fontSize: '0.55em', marginLeft: 10 }}>/ {symConfig.src === 'binance' ? 'USDT' : 'USD'}</span>
            </h1>

            {/* Live price block */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              {displayPrice !== null ? (
                <>
                  <span style={{
                    fontFamily: F.display,
                    fontSize: 'clamp(22px,3vw,34px)',
                    color: C.text,
                    letterSpacing: '0.03em',
                    textShadow: numberEmboss,
                  }}>
                    ${fmtPrice(displayPrice)}
                  </span>
                  {change24h !== null && (
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: changeColor,
                      padding: '2px 9px', borderRadius: 999,
                      border: `1px solid ${changeColor}40`,
                      background: `${changeColor}14`,
                    }}>
                      {change24h >= 0 ? '▲ +' : '▼ '}{change24h.toFixed(2)}%
                    </span>
                  )}
                  {livePrice && (
                    <span style={{ fontSize: 8, color: C.green, letterSpacing: '0.15em', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', background: C.green,
                        boxShadow: `0 0 8px ${C.green}`,
                        animation: 'term-pulse 1.6s ease-in-out infinite',
                      }} />
                      LIVE
                    </span>
                  )}
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

        {/* ── Symbol selector (agrupado por motor) ───────────────────────────── */}
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 16 }}>
          {SYMBOL_GROUPS.map(g => (
            <div key={g.tag}>
              <div style={{ fontSize: 8, letterSpacing: '0.25em', color: C.muted, marginBottom: 6 }}>{g.tag}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {g.labels.map(label => (
                  <button
                    key={label}
                    className={`tsym${sym === label ? ' on' : ''}`}
                    onClick={() => setSym(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Chart card ─────────────────────────────────────────────────────── */}
        <div style={{ ...cardStyle, overflow: 'hidden', background: C.surface }}>
          <div style={filoStyle} />

          {/* Toolbar del chart: par + fuente a la izquierda, timeframes a la derecha */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 10,
            padding: '10px 14px',
            borderBottom: `1px solid ${C.border}`,
            background: 'linear-gradient(90deg, rgba(57,226,230,0.05), rgba(255,255,255,0.015) 45%)',
          }}>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', color: C.dimText }}>
              <span style={{ color: C.glow }}>{symConfig.pair ?? `${symConfig.label}/USD`}</span>
              <span style={{ color: C.muted }}>&nbsp;·&nbsp;{symConfig.src === 'binance' ? 'BINANCE SPOT · WS LIVE' : 'YAHOO FINANCE · 60s'}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {TIMEFRAMES.map(t => (
                <button key={t} className={`ttf${tf === t ? ' on' : ''}`} onClick={() => setTf(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div style={{
              height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(90deg, ${C.surface} 25%, ${C.surface2} 50%, ${C.surface} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'term-shimmer 1.6s linear infinite',
            }}>
              <span style={{ fontSize: 10, color: C.dimText, letterSpacing: '0.2em' }}>CARGANDO DATOS…</span>
            </div>
          )}
          {error && !loading && (
            <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 10, color: C.red, letterSpacing: '0.15em' }}>ERROR AL CARGAR</span>
              <span style={{ fontSize: 10, color: C.dimText }}>{error}</span>
              <span style={{ fontSize: 9, color: C.muted }}>Este par podría no estar disponible en Binance</span>
            </div>
          )}
          {!loading && !error && klines.length > 0 && (
            <PriceChart data={klines} livePrice={livePrice} />
          )}
        </div>

        {/* ── Stats cards ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
          marginTop: 14,
        }}>
          {/* PRECIO — tratamiento hero */}
          <div style={{
            ...cardStyle,
            border: `1px solid ${C.gold}40`,
            boxShadow: `${C.shadowCard}, ${C.glowGoldSm}`,
            background: `linear-gradient(160deg, ${C.gold}14, ${C.surface} 60%)`,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 8, letterSpacing: '0.25em', color: C.dimText, marginBottom: 6 }}>PRECIO</div>
            <div style={{ fontFamily: F.display, fontSize: 20, color: C.glow, lineHeight: 1, textShadow: numberEmboss }}>
              {displayPrice !== null ? `$${fmtPrice(displayPrice)}` : '—'}
            </div>
          </div>

          {/* CAMBIO 24H */}
          <div style={{ ...cardStyle, backgroundColor: C.surface, backgroundImage: cardBgSoft, padding: '14px 16px' }}>
            <div style={{ fontSize: 8, letterSpacing: '0.25em', color: C.muted, marginBottom: 6 }}>CAMBIO 24H</div>
            <div style={{ fontFamily: F.display, fontSize: 20, color: changeColor, lineHeight: 1, textShadow: numberEmboss }}>
              {change24h !== null ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%` : '—'}
            </div>
          </div>

          {/* VOLUMEN 24H */}
          <div style={{ ...cardStyle, backgroundColor: C.surface, backgroundImage: cardBgSoft, padding: '14px 16px' }}>
            <div style={{ fontSize: 8, letterSpacing: '0.25em', color: C.muted, marginBottom: 6 }}>VOLUMEN 24H</div>
            <div style={{ fontFamily: F.display, fontSize: 20, color: C.text, lineHeight: 1, textShadow: numberEmboss }}>
              {stats?.volume24h ? fmtVol(stats.volume24h) : '—'}
            </div>
          </div>

          {/* RANGO 24H — barra con posición del precio (solo Binance) */}
          {hasRange && rangePct !== null && (
            <div style={{ ...cardStyle, backgroundColor: C.surface, backgroundImage: cardBgSoft, padding: '14px 16px' }}>
              <div style={{ fontSize: 8, letterSpacing: '0.25em', color: C.muted, marginBottom: 9 }}>RANGO 24H</div>
              <div style={{ position: 'relative', height: 4, borderRadius: 2, background: C.border2, marginBottom: 7 }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: '100%',
                  width: `${rangePct}%`, borderRadius: 2,
                  background: `linear-gradient(90deg, ${C.goldDim}, ${C.gold})`,
                }} />
                <div style={{
                  position: 'absolute', top: -3, left: `calc(${rangePct}% - 5px)`,
                  width: 10, height: 10, borderRadius: '50%',
                  background: C.glow, boxShadow: `0 0 8px ${C.gold}`,
                  border: `2px solid ${C.bg}`,
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.dimText }}>
                <span>{fmtPriceShort(stats!.low24h!)}</span>
                <span>{fmtPriceShort(stats!.high24h!)}</span>
              </div>
            </div>
          )}

          {/* PAR */}
          <div style={{ ...cardStyle, backgroundColor: C.surface, backgroundImage: cardBgSoft, padding: '14px 16px' }}>
            <div style={{ fontSize: 8, letterSpacing: '0.25em', color: C.muted, marginBottom: 6 }}>PAR</div>
            <div style={{ fontFamily: F.display, fontSize: 20, color: C.dimText, lineHeight: 1 }}>
              {symConfig.pair ?? `${symConfig.label}/USD`}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
