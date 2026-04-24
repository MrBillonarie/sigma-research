'use client'
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale,
  CategoryScale, Filler, Tooltip, Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

const C = { bg: '#04050a', border: '#1a1d2e', gold: '#d4af37', surface: '#0b0d14', dimText: '#7a7f9a', text: '#e8e9f0' }

interface Props {
  labels: string[]
  equity: number[]
  dd: number[]
  color: string
  modelName: string
}

export default function ModelChart({ labels, equity, dd, color, modelName }: Props) {
  const datasets = [
    {
      label: `${modelName} · Equity`,
      data: equity,
      borderColor: color,
      backgroundColor: `${color}12`,
      borderWidth: 2,
      fill: true,
      pointRadius: 0,
      tension: 0.25,
      yAxisID: 'y',
    },
    {
      label: 'Drawdown',
      data: dd,
      borderColor: '#f87171',
      backgroundColor: 'rgba(248,113,113,0.06)',
      borderWidth: 1,
      fill: true,
      pointRadius: 0,
      tension: 0.25,
      yAxisID: 'y2',
      borderDash: [4, 3],
    },
  ]

  return (
    <div style={{ height: 340, padding: '12px 12px 4px', background: C.bg }}>
      <Line
        data={{ labels, datasets }}
        options={{
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 400 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: true, position: 'top', labels: { color: C.dimText, font: { family: 'monospace', size: 10 }, boxWidth: 18, padding: 14 } },
            tooltip: {
              backgroundColor: C.surface, borderColor: C.border, borderWidth: 1,
              titleColor: C.gold, bodyColor: C.text,
              titleFont: { family: 'monospace', size: 11 }, bodyFont: { family: 'monospace', size: 11 }, padding: 10,
              callbacks: {
                label: (i) => {
                  const v = i.parsed.y ?? 0
                  return i.datasetIndex === 0
                    ? ` Equity: ${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
                    : ` DD: ${v.toFixed(2)}%`
                },
              },
            },
          },
          scales: {
            x: { ticks: { color: C.dimText, font: { family: 'monospace', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { color: 'rgba(212,175,55,0.05)' }, border: { color: C.border } },
            y: {
              position: 'left',
              ticks: { color: C.dimText, font: { family: 'monospace', size: 10 }, callback: (v) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(0)}%` },
              grid: { color: 'rgba(212,175,55,0.05)' }, border: { color: C.border },
            },
            y2: {
              position: 'right',
              ticks: { color: '#f87171', font: { family: 'monospace', size: 10 }, callback: (v) => `${Number(v).toFixed(0)}%` },
              grid: { display: false }, border: { color: C.border },
            },
          },
        }}
      />
    </div>
  )
}
