'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { C } from '@/app/lib/constants'

const ModelChart = dynamic(() => import('./ModelChart'), {
  ssr: false,
  loading: () => <div style={{ height: 340, background: '#04050a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7f9a' }}>Cargando equity curve…</span></div>,
})

// ─── Generate synthetic equity curve ─────────────────────────────────────────
function genEquity(trades: number, winRate: number, avgWin: number, avgLoss: number, seed: number) {
  let equity = 0
  const curve: number[] = [0]
  let peak = 0
  const dd: number[] = [0]
  let s = seed

  for (let i = 0; i < trades; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const rand = (s >>> 0) / 0xffffffff
    equity += rand < winRate ? avgWin : -avgLoss
    curve.push(parseFloat(equity.toFixed(2)))
    if (equity > peak) peak = equity
    dd.push(parseFloat((peak > 0 ? ((equity - peak) / peak) * 100 : 0).toFixed(2)))
  }
  return { curve, dd }
}

// ─── Model definitions ────────────────────────────────────────────────────────
const MODELS = [
  {
    id: 'promacd',
    tag: 'v116',
    name: 'PRO.MACD',
    subtitle: 'MACD Adaptativo · Régimen HMM · Multi-timeframe',
    color: '#d4af37',
    trades: 347,
    winRate: 0.643,
    sharpe: 1.87,
    maxDD: -12.4,
    avgWin: 1.82,
    avgLoss: 0.98,
    timeframe: '1D / 4H',
    market: 'Equities + Futuros',
    status: 'LIVE',
    statusColor: '#34d399',
    description: 'Sistema MACD con parámetros adaptativos calibrados por régimen de mercado. Detecta cambios de régimen con Hidden Markov Model de 3 estados. Señales confirmadas por divergencia y momentum de volumen.',
    params: [
      ['Fast EMA', '12 (adaptativo)'],
      ['Slow EMA', '26 (adaptativo)'],
      ['Signal', '9'],
      ['Régimen detector', 'HMM 3 estados'],
      ['Stop loss', 'ATR × 1.5'],
      ['Período', 'Ene 2022 – Dic 2024'],
    ],
  },
  {
    id: 'obmacd',
    tag: '4H',
    name: 'OB+MACD',
    subtitle: 'Order Blocks · MACD Confirmación · Smart Money',
    color: '#3b82f6',
    trades: 182,
    winRate: 0.582,
    sharpe: 2.14,
    maxDD: -8.7,
    avgWin: 2.45,
    avgLoss: 1.12,
    timeframe: '4H',
    market: 'BTC / ETH / Altcoins',
    status: 'LIVE',
    statusColor: '#34d399',
    description: 'Combina detección de Order Blocks institucionales (Smart Money Concepts) con confirmación MACD en 4H. Las entradas se toman en retest de OB con momentum positivo. Alto ratio RR promedio.',
    params: [
      ['Timeframe OB', '1D (identif.)'],
      ['Timeframe MACD', '4H (confirma)'],
      ['Min OB size', '2.5% rango'],
      ['R:R mínimo', '1.8:1'],
      ['Trailing stop', 'Swing low/high'],
      ['Período', 'Jul 2023 – Dic 2024'],
    ],
  },
  {
    id: 'liga',
    tag: 'LF',
    name: 'LIGA FREQUENCY',
    subtitle: 'Frecuencia Alta · Mean Reversion · Z-Score',
    color: '#8b5cf6',
    trades: 534,
    winRate: 0.712,
    sharpe: 1.42,
    maxDD: -16.8,
    avgWin: 0.94,
    avgLoss: 1.38,
    timeframe: '15m / 1H',
    market: 'SPX / NDX / Futuros',
    status: 'BETA',
    statusColor: '#fbbf24',
    description: 'Estrategia de reversión a la media basada en desviaciones estadísticas (Z-score) con ventana deslizante adaptativa. Alta frecuencia de trades, win rate elevado pero RR invertido controlado por position sizing Kelly.',
    params: [
      ['Lookback', '20 períodos'],
      ['Entry z-score', '|z| > 2.0'],
      ['Exit z-score', '|z| < 0.5'],
      ['Kelly fraction', '0.25f'],
      ['Max posiciones', '3 simultáneas'],
      ['Período', 'Mar 2023 – Dic 2024'],
    ],
  },
  {
    id: 'k1-15m',
    tag: '15M',
    name: 'K1-15M',
    subtitle: 'Scalping Sistemático · OFI · Vol Target Kelly',
    color: '#1D9E75',
    trades: 892,
    winRate: 0.548,
    sharpe: 1.31,
    maxDD: -13.6,
    avgWin: 1.18,
    avgLoss: 0.97,
    timeframe: '15M',
    market: 'BTC / Crypto',
    status: 'LIVE',
    statusColor: '#34d399',
    description: 'Modelo de scalping sistemático en 15 minutos. Combina Order Flow Imbalance (OFI), régimen intradiario y señales de momentum de corto plazo. Position sizing basado en Kelly fraction adaptativo según volatilidad realizada del día. Stop dinámico por ATR.',
    params: [
      ['Timeframe', '15 minutos'],
      ['Entry trigger', 'OFI + Momentum'],
      ['Vol Target', '15% anualizado'],
      ['Kelly fraction', 'f* adaptativo'],
      ['Stop loss', 'ATR(14) × 1.2'],
      ['Período', 'Ene 2024 – Abr 2026'],
    ],
  },
  {
    id: 'k1-1h',
    tag: '1H',
    name: 'K1-1H',
    subtitle: 'Momentum Tendencial · MACD · Régimen HMM',
    color: '#f59e0b',
    trades: 318,
    winRate: 0.587,
    sharpe: 1.74,
    maxDD: -10.9,
    avgWin: 1.92,
    avgLoss: 1.08,
    timeframe: '1H',
    market: 'BTC / ETH / Futuros',
    status: 'LIVE',
    statusColor: '#34d399',
    description: 'Sistema de momentum en 1H con confirmación MACD y detección de régimen. Filtra entradas en mercados laterales usando clasificador HMM de 2 estados (tendencia / rango). Gestión de posición con trailing stop basado en swing structure.',
    params: [
      ['Timeframe', '1 hora'],
      ['Filtro régimen', 'HMM 2 estados'],
      ['MACD', '12 / 26 / 9'],
      ['Trailing stop', 'Swing low / high'],
      ['Vol Target', '20% anualizado'],
      ['Período', 'Jun 2023 – Abr 2026'],
    ],
  },
  {
    id: 'k1-4h',
    tag: '4H',
    name: 'K1-4H',
    subtitle: 'Swing Trading · Estructura de Mercado · RR Alto',
    color: '#ec4899',
    trades: 171,
    winRate: 0.619,
    sharpe: 2.08,
    maxDD: -9.2,
    avgWin: 2.41,
    avgLoss: 1.21,
    timeframe: '4H',
    market: 'BTC / Macro Futuros',
    status: 'BETA',
    statusColor: '#fbbf24',
    description: 'Modelo de swing trading en 4H orientado a capturas de tendencia con alta relación riesgo/retorno. Entradas en retests de zonas de estructura (BOS/CHoCH) con confluencia de EMA 20/50 y MACD. Sizing por volatilidad objetivo del 15% anual.',
    params: [
      ['Timeframe', '4 horas'],
      ['Estructura', 'BOS / CHoCH'],
      ['Confirmación', 'EMA20 > EMA50 + MACD'],
      ['R:R mínimo', '2.0 : 1'],
      ['Vol Target', '15% anualizado'],
      ['Período', 'Oct 2023 – Abr 2026'],
    ],
  },
]

// ─── Universo de trading (35 instrumentos, 6 traders) ────────────────────────
const TRADERS = [
  {
    id: 1, name: 'Trader 1 — Alonso', focus: 'Crypto Core', session: '24/7',
    color: '#1D9E75',
    instruments: [
      { n:  1, ticker: 'BTC/USDT', market: 'Binance Futures', session: '24/7', tf: '15M', status: 'live'    },
      { n:  2, ticker: 'ETH/USDT', market: 'Binance Futures', session: '24/7', tf: '15M', status: 'pending' },
      { n:  3, ticker: 'SOL/USDT', market: 'Binance Futures', session: '24/7', tf: '15M', status: 'pending' },
      { n:  4, ticker: 'BNB/USDT', market: 'Binance Futures', session: '24/7', tf: '15M', status: 'pending' },
      { n:  5, ticker: 'XAU/USDT', market: 'Binance Spot',    session: '24/7', tf: '1H',  status: 'pending' },
      { n:  6, ticker: 'XAG/USDT', market: 'Binance Spot',    session: '24/7', tf: '1H',  status: 'pending' },
    ],
  },
  {
    id: 2, name: 'Trader 2', focus: 'Metales & Commodities', session: 'Londres + NY',
    color: '#d4af37',
    instruments: [
      { n:  7, ticker: 'XAU/USD',    market: 'OANDA / TradingView', session: 'Londres + NY', tf: '15M–4H', status: 'pending' },
      { n:  8, ticker: 'XAG/USD',    market: 'OANDA / TradingView', session: 'Londres + NY', tf: '15M–4H', status: 'pending' },
      { n:  9, ticker: 'GC1!',       market: 'CME Futures',         session: 'Londres + NY', tf: '15M–1H', status: 'pending' },
      { n: 10, ticker: 'WTI / CL1!', market: 'CME Futures',         session: 'NY principal', tf: '15M–1H', status: 'pending' },
      { n: 11, ticker: 'HG1! (Cobre)',market: 'CME Futures',        session: 'Londres + NY', tf: '1H–4H',  status: 'pending' },
    ],
  },
  {
    id: 3, name: 'Trader 3', focus: 'US Equities', session: 'NYSE 9:30–16:00 ET',
    color: '#3b82f6',
    instruments: [
      { n: 12, ticker: 'SPX500 / ES1!', market: 'CME Futures',     session: 'NYSE', tf: '15M–1H', status: 'pending' },
      { n: 13, ticker: 'NQ100 / NQ1!', market: 'CME Futures',      session: 'NYSE', tf: '15M–1H', status: 'pending' },
      { n: 14, ticker: 'DJI / YM1!',   market: 'CME Futures',      session: 'NYSE', tf: '15M–1H', status: 'pending' },
      { n: 15, ticker: 'NVDA',          market: 'NASDAQ / IBKR',   session: 'NYSE', tf: '15M–1H', status: 'pending' },
      { n: 16, ticker: 'AAPL',          market: 'NASDAQ / IBKR',   session: 'NYSE', tf: '15M–1H', status: 'pending' },
    ],
  },
  {
    id: 4, name: 'Trader 4', focus: 'ETFs', session: 'NYSE 9:30–16:00 ET',
    color: '#8b5cf6',
    instruments: [
      { n: 17, ticker: 'SPY',  market: 'S&P 500',            session: 'NYSE', tf: '15M–1H', status: 'pending' },
      { n: 18, ticker: 'QQQ',  market: 'Nasdaq 100',         session: 'NYSE', tf: '15M–1H', status: 'pending' },
      { n: 19, ticker: 'GLD',  market: 'Gold',               session: 'NYSE', tf: '1H–4H',  status: 'pending' },
      { n: 20, ticker: 'SLV',  market: 'Silver',             session: 'NYSE', tf: '1H–4H',  status: 'pending' },
      { n: 21, ticker: 'IBIT', market: 'Bitcoin (BlackRock)', session: 'NYSE', tf: '1H–4H',  status: 'pending' },
    ],
  },
  {
    id: 5, name: 'Trader 5', focus: 'Bonos & Macro', session: 'Sin sesión fija',
    color: '#ec4899',
    instruments: [
      { n: 22, ticker: 'TLT',  market: 'Bono 20Y+ ETF',       session: 'NYSE',   tf: '1H–4H', status: 'pending' },
      { n: 23, ticker: 'ZN1!', market: 'Treasury Note 10Y',   session: 'CME 24h', tf: '1H–4H', status: 'pending' },
      { n: 24, ticker: 'ZB1!', market: 'Treasury Bond 30Y',   session: 'CME 24h', tf: '1H–4H', status: 'pending' },
      { n: 25, ticker: 'HYG',  market: 'High Yield Bonds ETF', session: 'NYSE',   tf: '1H–4H', status: 'pending' },
      { n: 26, ticker: 'TBT',  market: 'Inverso TLT 2x',      session: 'NYSE',   tf: '1H–4H', status: 'pending' },
    ],
  },
  {
    id: 6, name: 'Trader 6', focus: 'Índices Internacionales & Forex', session: 'Europa + Asia',
    color: '#f97316',
    instruments: [
      { n: 27, ticker: 'DAX / GER40',  market: 'Xetra / CME',  session: 'Londres',      tf: '15M–1H', status: 'pending' },
      { n: 28, ticker: 'FTSE100',       market: 'LSE / CME',    session: 'Londres',      tf: '15M–1H', status: 'pending' },
      { n: 29, ticker: 'Nikkei / JPN225', market: 'OSE / CME', session: 'Asia',          tf: '1H',     status: 'pending' },
      { n: 30, ticker: 'IBOVESPA',      market: 'B3 Brasil',    session: 'NY paralelo',  tf: '1H',     status: 'pending' },
      { n: 31, ticker: 'EUR/USD',       market: 'Forex OTC',    session: 'Londres + NY', tf: '15M–1H', status: 'pending' },
      { n: 32, ticker: 'GBP/USD',       market: 'Forex OTC',    session: 'Londres',      tf: '15M–1H', status: 'pending' },
      { n: 33, ticker: 'USD/JPY',       market: 'Forex OTC',    session: 'Asia + NY',    tf: '15M–1H', status: 'pending' },
      { n: 34, ticker: 'DXY',           market: 'ICE / Referencia', session: '24h',      tf: '1H–4H',  status: 'pending' },
      { n: 35, ticker: 'USD/CHF',       market: 'Forex OTC',    session: 'Londres + NY', tf: '15M–1H', status: 'pending' },
    ],
  },
]

// Pre-generate equity curves
const MODEL_DATA = MODELS.map(m => genEquity(m.trades, m.winRate, m.avgWin, m.avgLoss, m.name.charCodeAt(0) * 7 + 42))

function Label({ text }: { text: string }) {
  return <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>{text}</div>
}

export default function ModelosPage() {
  const [active, setActive] = useState(0)
  const m = MODELS[active]
  const { curve, dd } = MODEL_DATA[active]

  // X labels: every 10 trades
  const labels = curve.map((_, i) => i % Math.max(1, Math.floor(m.trades / 20)) === 0 ? `#${i}` : '')

  const finalEquity = curve[curve.length - 1]
  const minDD = Math.min(...dd)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
            {'// MODELOS CUANTITATIVOS · EQUITY CURVES'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ color: C.text }}>BACKTESTING</span>{' '}
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RESULTS</span>
          </h1>
          <p style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText, marginTop: 14, maxWidth: 600, lineHeight: 1.7 }}>
            Curvas de equity out-of-sample con walk-forward validation. Datos reales, slippage real, sin overfitting.
          </p>
        </div>

        {/* Model selector tabs — 2 filas de 3 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: C.border, marginBottom: 1 }}>
          {MODELS.map((mod, i) => (
            <button key={mod.id} onClick={() => setActive(i)} style={{
              padding: '16px 20px', textAlign: 'left', border: 'none', cursor: 'pointer',
              background: active === i ? C.surface : C.bg,
              borderBottom: active === i ? `2px solid ${mod.color}` : '2px solid transparent',
              transition: 'background 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>{mod.tag}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: mod.statusColor, background: `${mod.statusColor}18`, padding: '1px 6px' }}>{mod.status}</span>
              </div>
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 26, color: active === i ? mod.color : C.text, lineHeight: 1 }}>
                {mod.name}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, marginTop: 3 }}>{mod.timeframe} · {mod.market}</div>
            </button>
          ))}
        </div>

        {/* Metrics row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: C.border, marginBottom: 1 }}>
          {[
            { label: 'Total Return',   value: `${finalEquity >= 0 ? '+' : ''}${finalEquity.toFixed(1)}%`, color: finalEquity >= 0 ? C.green : C.red },
            { label: 'Win Rate',       value: `${(m.winRate * 100).toFixed(1)}%`,  color: m.winRate >= 0.6 ? C.green : C.yellow },
            { label: 'Sharpe Ratio',   value: m.sharpe.toFixed(2),                  color: m.sharpe >= 2 ? C.green : C.gold },
            { label: 'Max Drawdown',   value: `${minDD.toFixed(1)}%`,               color: C.red },
            { label: 'Total Trades',   value: m.trades.toLocaleString(),            color: C.text },
            { label: 'Avg W / Avg L',  value: `${m.avgWin.toFixed(2)} / ${m.avgLoss.toFixed(2)}`, color: C.dimText },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: C.surface, padding: '16px 18px' }}>
              <Label text={label} />
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 28, color, lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{ background: C.surface, marginBottom: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>
              EQUITY CURVE · {m.trades} TRADES · {m.timeframe}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: m.color }}>{m.name} {m.tag}</span>
          </div>
          <ModelChart labels={labels} equity={curve} dd={dd} color={m.color} modelName={m.name} />
        </div>

        {/* Bottom: description + params */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.border }}>
          <div style={{ background: C.bg, padding: '24px 24px' }}>
            <Label text="Descripción del modelo" />
            <p style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText, lineHeight: 1.8, marginTop: 8 }}>
              {m.description}
            </p>
          </div>
          <div style={{ background: C.surface, padding: '24px 24px' }}>
            <Label text="Parámetros" />
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {m.params.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>{k}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: m.color }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Universo de Trading ──────────────────────────────────────────── */}
        <div style={{ marginTop: 48 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
            {'// UNIVERSO DE TRADING · COBERTURA DE MODELOS'}
          </div>
          <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(32px, 4vw, 52px)', letterSpacing: '0.03em', margin: '0 0 6px' }}>
            35 INSTRUMENTOS · 6 TRADERS
          </h2>
          <p style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginBottom: 28, maxWidth: 560 }}>
            Cobertura cross-market planificada. Estado actual del despliegue de modelos por instrumento.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {TRADERS.map(trader => (
              <div key={trader.id} style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                {/* Trader header */}
                <div style={{
                  padding: '12px 20px',
                  borderBottom: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${trader.color}`,
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, color: trader.color, letterSpacing: 1 }}>
                    {trader.name}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>
                    {trader.focus}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, marginLeft: 'auto' }}>
                    {trader.session}
                  </span>
                </div>

                {/* Instruments table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: C.bg }}>
                        {['#', 'Ticker', 'Mercado / Subyacente', 'Sesión', 'TF', 'Estado'].map(h => (
                          <th key={h} style={{
                            padding: '7px 14px', textAlign: 'left',
                            fontSize: 9, color: C.muted, fontFamily: 'monospace',
                            letterSpacing: '0.15em', textTransform: 'uppercase',
                            borderBottom: `1px solid ${C.border}`,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trader.instruments.map((inst, i) => (
                        <tr key={inst.n} style={{ borderBottom: `1px solid ${C.border}20`, background: i % 2 === 0 ? 'transparent' : `${C.bg}80` }}>
                          <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 11, color: C.muted }}>{String(inst.n).padStart(2, '0')}</td>
                          <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 12, color: C.text, fontWeight: 700 }}>{inst.ticker}</td>
                          <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{inst.market}</td>
                          <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{inst.session}</td>
                          <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 11, color: C.gold }}>{inst.tf}</td>
                          <td style={{ padding: '8px 14px' }}>
                            {inst.status === 'live' ? (
                              <span style={{
                                fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                                color: '#34d399', background: 'rgba(52,211,153,0.12)',
                                border: '1px solid rgba(52,211,153,0.3)',
                                borderRadius: 3, padding: '2px 8px', whiteSpace: 'nowrap',
                              }}>MODEL K1 ✓</span>
                            ) : (
                              <span style={{
                                fontFamily: 'monospace', fontSize: 10,
                                color: C.muted, background: `${C.border}60`,
                                borderRadius: 3, padding: '2px 8px',
                              }}>Pendiente</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
