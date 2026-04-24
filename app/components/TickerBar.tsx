'use client'
import { useEffect, useRef, useState } from 'react'

// Traditional markets — static, delayed data
const STATIC: { sym: string; price: string; chg: string; up: boolean }[] = [
  { sym: 'SPX',  price: '5,234.18',  chg: '+0.82%', up: true  },
  { sym: 'NDX',  price: '18,291.44', chg: '+1.12%', up: true  },
  { sym: 'VIX',  price: '14.32',     chg: '-3.10%', up: false },
  { sym: 'GOLD', price: '2,341.50',  chg: '+0.21%', up: true  },
  { sym: 'DXY',  price: '104.21',    chg: '+0.08%', up: true  },
  { sym: 'TNX',  price: '4.31',      chg: '+0.02',  up: true  },
]

const CRYPTO_STREAMS = 'btcusdt@miniTicker/ethusdt@miniTicker/solusdt@miniTicker/bnbusdt@miniTicker/xrpusdt@miniTicker'
const WS_URL = `wss://stream.binance.com:9443/stream?streams=${CRYPTO_STREAMS}`

const LABELS: Record<string, string> = {
  BTCUSDT: 'BTC', ETHUSDT: 'ETH', SOLUSDT: 'SOL', BNBUSDT: 'BNB', XRPUSDT: 'XRP',
}

const DECIMALS: Record<string, number> = {
  BTCUSDT: 2, ETHUSDT: 2, SOLUSDT: 2, BNBUSDT: 2, XRPUSDT: 4,
}

interface CryptoTick {
  price: string
  chg: string
  up: boolean
  flash: 'green' | 'red' | null
}

function fmtPrice(val: number, decimals: number) {
  return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export default function TickerBar() {
  const [crypto, setCrypto] = useState<Record<string, CryptoTick>>({})
  const wsRef    = useRef<WebSocket | null>(null)
  const prevRef  = useRef<Record<string, number>>({})
  const flashRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data)
        const d   = msg.data
        if (!d || !d.s) return

        const sym      = d.s as string
        const close    = parseFloat(d.c)
        const open     = parseFloat(d.o)
        const pctChg   = ((close - open) / open) * 100
        const up       = close >= open
        const decimals = DECIMALS[sym] ?? 2
        const prev     = prevRef.current[sym]
        const direction: 'green' | 'red' | null =
          prev === undefined ? null : close > prev ? 'green' : close < prev ? 'red' : null

        prevRef.current[sym] = close

        setCrypto(c => ({
          ...c,
          [sym]: {
            price: fmtPrice(close, decimals),
            chg:   `${pctChg >= 0 ? '+' : ''}${pctChg.toFixed(2)}%`,
            up,
            flash: direction,
          },
        }))

        // Clear flash after 600ms
        if (direction) {
          clearTimeout(flashRef.current[sym])
          flashRef.current[sym] = setTimeout(() => {
            setCrypto(c => c[sym] ? { ...c, [sym]: { ...c[sym], flash: null } } : c)
          }, 650)
        }
      }

      ws.onclose = () => {
        // Reconnect after 3 s
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => wsRef.current?.close()
  }, [])

  const cryptoItems = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'].map(sym => {
    const t = crypto[sym]
    return { sym: LABELS[sym], price: t?.price ?? '—', chg: t?.chg ?? '—', up: t?.up ?? true, flash: t?.flash ?? null, live: true }
  })

  const all = [...STATIC.map(s => ({ ...s, flash: null as null, live: false })), ...cryptoItems]
  const doubled = [...all, ...all]

  return (
    <div className="w-full overflow-hidden bg-surface border-y border-border py-2 select-none">
      <div className="flex animate-ticker whitespace-nowrap" style={{ width: 'max-content' }}>
        {doubled.map((t, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-2 px-5 terminal-text transition-none ${
              t.flash === 'green' ? 'animate-flash-green' :
              t.flash === 'red'   ? 'animate-flash-red'   : ''
            }`}
          >
            {/* Live dot */}
            {t.live && (
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse-slow flex-shrink-0" />
            )}
            <span className="text-text-dim text-xs">{t.sym}</span>
            <span className="text-text text-xs tabular-nums">{t.price}</span>
            <span className={`text-xs tabular-nums ${t.up ? 'text-emerald-400' : 'text-red-400'}`}>
              {t.chg}
            </span>
            <span className="text-border">|</span>
          </span>
        ))}
      </div>
    </div>
  )
}
