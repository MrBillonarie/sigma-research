'use client'
import type { PortfolioMetrics } from '@/types/decision-engine'

interface Props {
  metrics:   PortfolioMetrics
  flowScore: number
  buyCount:  number
  sellCount: number
  holdCount: number
}

function Card({
  label, value, sub, color, icon,
}: { label: string; value: string; sub?: string; color: string; icon: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      background: '#0b0d14', border: '1px solid #1a1d2e',
      borderRadius: 10, padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 11, color: '#7a7f9a', fontFamily: 'monospace', letterSpacing: 0.5 }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 28, fontFamily: "'Bebas Neue', Impact, sans-serif",
        letterSpacing: 1, color,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#7a7f9a', marginTop: 4, fontFamily: 'monospace' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

export default function MetricCards({ metrics, flowScore, buyCount, sellCount, holdCount }: Props) {
  const ret   = metrics.expectedReturn
  const vol   = metrics.annualVolatility
  const sharpe = metrics.sharpeRatio

  const retColor   = ret   > 8  ? '#1D9E75' : ret   > 4  ? '#d4af37' : '#f87171'
  const sharpeColor = sharpe > 1 ? '#1D9E75' : sharpe > 0.5 ? '#d4af37' : '#f87171'
  const flowColor   = flowScore > 60 ? '#1D9E75' : flowScore > 40 ? '#d4af37' : '#f87171'

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <Card
        icon="📈" label="RETORNO ESPERADO"
        value={`${ret > 0 ? '+' : ''}${ret.toFixed(1)}%`}
        sub="Retorno anual proyectado"
        color={retColor}
      />
      <Card
        icon="〰️" label="VOLATILIDAD ANUAL"
        value={`${vol.toFixed(1)}%`}
        sub={`DD máx: ${metrics.maxDrawdown.toFixed(1)}%`}
        color="#378ADD"
      />
      <Card
        icon="⚖️" label="SHARPE RATIO"
        value={sharpe.toFixed(2)}
        sub="Mayor = mejor riesgo/retorno"
        color={sharpeColor}
      />
      <Card
        icon="🌊" label="SCORE FLUJO"
        value={`${flowScore}/100`}
        sub={`${buyCount} comprar · ${sellCount} reducir · ${holdCount} mantener`}
        color={flowColor}
      />
    </div>
  )
}
