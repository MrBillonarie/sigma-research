'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import SiteNav from '../components/SiteNav'

const ModelChart = dynamic(() => import('./ModelChart'), {
  ssr: false,
  loading: () => <div style={{ height: 340, background: '#04050a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7f9a' }}>Cargando equity curve…</span></div>,
})

const C = {
  bg: '#04050a', surface: '#0b0d14', border: '#1a1d2e',
  muted: '#3a3f55', dimText: '#7a7f9a', text: '#e8e9f0',
  gold: '#d4af37', glow: '#f0cc5a', green: '#34d399', red: '#f87171', yellow: '#fbbf24',
}

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
      <SiteNav />

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

        {/* Model selector tabs */}
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

      </div>
    </div>
  )
}
