'use client'
import { memo, useMemo } from 'react'
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale,
  CategoryScale, Filler, Tooltip, Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

// Registro global — solo corre una vez por módulo, no en cada render
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

const C = {
  bg:      '#04050a',
  border:  '#1a1d2e',
  gold:    '#39e2e6',
  surface: '#0b0d14',
  dimText: '#7a7f9a',
  text:    '#e8e9f0',
  green:   '#34d399',
  red:     '#f87171',
}

interface Props {
  labels:    string[]
  equity:    number[]
  dd:        number[]
  color:     string
  modelName: string
  sharpe?:   number
  maxDD?:    number
  winRate?:  number
}

function ModelChartInner({ labels, equity, dd, color, modelName, sharpe, maxDD, winRate }: Props) {

  // Plugin memoizado — solo se recrea si cambia color o equity data
  const equityGradientPlugin = useMemo(() => ({
    id: 'equityGradient',
    beforeDatasetsDraw(chart: ChartJS) {
      const ctx    = chart.ctx
      const meta   = chart.getDatasetMeta(0)
      if (!meta.data.length) return
      const yScale = chart.scales['y']
      const zero   = yScale.getPixelForValue(0)
      const top    = chart.chartArea.top
      const bottom = chart.chartArea.bottom

      const gradAbove = ctx.createLinearGradient(0, top, 0, zero)
      gradAbove.addColorStop(0, `${color}28`)
      gradAbove.addColorStop(1, `${color}06`)

      const gradBelow = ctx.createLinearGradient(0, zero, 0, bottom)
      gradBelow.addColorStop(0, 'rgba(248,113,113,0.10)')
      gradBelow.addColorStop(1, 'rgba(248,113,113,0.02)')

      chart.data.datasets[0].backgroundColor = (ctx2: { dataIndex: number }) => {
        const v = equity[ctx2.dataIndex] ?? 0
        return v >= 0 ? gradAbove : gradBelow
      }
    },
  }), [color, equity])

  // Datasets memoizados — solo se recrea si cambia equity, dd, color o modelName
  const datasets = useMemo(() => [
    {
      label: `${modelName} · Equity`,
      data: equity,
      borderColor: color,
      backgroundColor: `${color}12`,
      borderWidth: 2.5,
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: color,
      tension: 0.3,
      yAxisID: 'y',
      order: 1,
    },
    {
      label: 'Drawdown',
      data: dd,
      borderColor: 'rgba(248,113,113,0.7)',
      backgroundColor: 'rgba(248,113,113,0.12)',
      borderWidth: 1.5,
      fill: { target: { value: 0 }, above: 'transparent', below: 'rgba(248,113,113,0.12)' },
      pointRadius: 0,
      pointHoverRadius: 3,
      tension: 0.3,
      yAxisID: 'y2',
      order: 2,
    },
  ], [equity, dd, color, modelName])

  return (
    <div style={{ background: C.bg }}>
      {/* Mini stats bar */}
      {(sharpe !== undefined || maxDD !== undefined || winRate !== undefined) && (
        <div style={{ display: 'flex', gap: 1, background: C.border, marginBottom: 1 }}>
          {[
            { label: 'Sharpe',   val: sharpe  != null ? sharpe.toFixed(2)  : '—', color: sharpe != null && sharpe >= 1.5 ? C.green : C.gold },
            { label: 'Max DD',   val: maxDD   != null ? `${maxDD.toFixed(1)}%`  : '—', color: C.red   },
            { label: 'Win Rate', val: winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—', color: winRate != null && winRate >= 0.55 ? C.green : C.dimText },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: C.surface, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.2em', color: C.dimText, textTransform: 'uppercase' }}>{s.label}</span>
              <span style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 16, color: s.color }}>{s.val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div style={{ height: 300, padding: '12px 12px 4px' }}>
        <Line
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          plugins={[equityGradientPlugin as any]}
          data={{ labels, datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeInOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                display: true,
                position: 'top',
                labels: {
                  color: C.dimText,
                  font: { family: 'monospace', size: 10 },
                  boxWidth: 16, padding: 14,
                  usePointStyle: true,
                  pointStyle: 'line',
                },
              },
              tooltip: {
                backgroundColor: '#111827',
                borderColor: C.border,
                borderWidth: 1,
                titleColor: color,
                bodyColor: C.text,
                titleFont: { family: 'monospace', size: 11, weight: 'bold' },
                bodyFont:  { family: 'monospace', size: 11 },
                padding: 12,
                cornerRadius: 4,
                callbacks: {
                  title: (items) => `Trade #${items[0].dataIndex + 1}`,
                  label: (i) => {
                    const v = i.parsed.y ?? 0
                    if (i.datasetIndex === 0) {
                      const sign = v >= 0 ? '+' : ''
                      return `  Equity   ${sign}${v.toFixed(2)}%`
                    }
                    return `  Drawdown ${v.toFixed(2)}%`
                  },
                },
              },
            },
            scales: {
              x: {
                ticks: {
                  color: C.dimText,
                  font: { family: 'monospace', size: 9 },
                  maxRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: 10,
                },
                grid: { color: 'rgba(255,255,255,0.03)' },
                border: { color: C.border },
              },
              y: {
                position: 'left',
                ticks: {
                  color: C.dimText,
                  font: { family: 'monospace', size: 9 },
                  callback: (v) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(0)}%`,
                },
                grid: { color: 'rgba(57,226,230,0.04)' },
                border: { color: C.border },
              },
              y2: {
                position: 'right',
                max: 0,
                ticks: {
                  color: 'rgba(248,113,113,0.6)',
                  font: { family: 'monospace', size: 9 },
                  callback: (v) => `${Number(v).toFixed(0)}%`,
                },
                grid: { display: false },
                border: { color: C.border },
              },
            },
          }}
        />
      </div>
    </div>
  )
}

export default memo(ModelChartInner)
