'use client'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { Allocation, PortfolioMetrics } from '@/types/decision-engine'

ChartJS.register(ArcElement, Tooltip, Legend)

const COLORS = {
  fondos:     '#1D9E75',
  etfs:       '#378ADD',
  renta_fija: '#d4af37',
  crypto:     '#a78bfa',
}

const LABELS = {
  fondos:     'Fondos Mutuos',
  etfs:       'ETFs Globales',
  renta_fija: 'Renta Fija',
  crypto:     'Crypto',
}

function fmt(n: number, cur: 'CLP' | 'USD'): string {
  if (cur === 'CLP') {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
    return `$${Math.round(n).toLocaleString('es-CL')}`
  }
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

interface Props {
  allocation: Allocation
  metrics:    PortfolioMetrics
  capital?:   number
  currency?:  'CLP' | 'USD'
}

export default function AllocationDonut({ allocation, metrics, capital = 0, currency = 'CLP' }: Props) {
  const keys   = Object.keys(allocation) as (keyof Allocation)[]
  const values = keys.map(k => allocation[k])
  const colors = keys.map(k => COLORS[k])
  const labels = keys.map(k => LABELS[k])

  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor:  colors,
      borderColor:      colors.map(c => c + '55'),
      borderWidth:      2,
      hoverOffset:      6,
    }],
  }

  const options = {
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => {
            const pct = `${ctx.label}: ${ctx.parsed}%`
            if (capital > 0) {
              const amount = fmt(capital * ctx.parsed / 100, currency)
              return ` ${pct} = ${amount}`
            }
            return ` ${pct}`
          },
        },
        backgroundColor: '#0b0d14',
        borderColor:     '#1a1d2e',
        borderWidth:     1,
        titleColor:      '#e8e9f0',
        bodyColor:       '#7a7f9a',
      },
    },
  }

  return (
    <div style={{
      background: '#0b0d14', border: '1px solid #1a1d2e',
      borderRadius: 10, padding: 20,
    }}>
      <h3 style={{
        margin: '0 0 16px', fontSize: 12, color: '#7a7f9a',
        fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase',
      }}>
        ASIGNACIÓN ÓPTIMA
        {capital > 0 && (
          <span style={{ marginLeft: 8, color: '#1D9E75' }}>
            · {fmt(capital, currency)} total
          </span>
        )}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        {/* Donut */}
        <div style={{ width: 180, height: 180, position: 'relative', flexShrink: 0 }}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Doughnut data={data} options={options as any} />
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)', textAlign: 'center',
          }}>
            <div style={{
              fontSize: 22, fontFamily: "'Bebas Neue', Impact, sans-serif",
              color: metrics.expectedReturn > 0 ? '#1D9E75' : '#f87171',
            }}>
              {metrics.expectedReturn > 0 ? '+' : ''}{metrics.expectedReturn.toFixed(1)}%
            </div>
            <div style={{ fontSize: 9, color: '#7a7f9a', fontFamily: 'monospace' }}>RET. ESP.</div>
          </div>
        </div>

        {/* Leyenda */}
        <div style={{ flex: 1, minWidth: 160 }}>
          {keys.map(k => {
            const amount = capital > 0 ? capital * allocation[k] / 100 : 0
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: COLORS[k], flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#e8e9f0' }}>{LABELS[k]}</div>
                  {capital > 0 && (
                    <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: 'monospace' }}>
                      {fmt(amount, currency)}
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 18, fontFamily: "'Bebas Neue', Impact, sans-serif",
                  color: COLORS[k], minWidth: 42, textAlign: 'right',
                }}>
                  {allocation[k]}%
                </div>
              </div>
            )
          })}
          <div style={{
            marginTop: 12, paddingTop: 12,
            borderTop: '1px solid #1a1d2e',
            fontSize: 11, color: '#7a7f9a', fontFamily: 'monospace',
          }}>
            Sharpe: <span style={{ color: '#e8e9f0' }}>{metrics.sharpeRatio.toFixed(2)}</span>
            &nbsp;·&nbsp;
            Vol: <span style={{ color: '#e8e9f0' }}>{metrics.annualVolatility.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
