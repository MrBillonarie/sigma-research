'use client'
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale,
  CategoryScale, Filler, Tooltip, Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

const C = { bg: '#04050a', border: '#1a1d2e', gold: '#d4af37', surface: '#0b0d14', dimText: '#7a7f9a', text: '#e8e9f0' }

const fmt = (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1e3).toFixed(0)}K`

interface Props { labels: string[]; acum: number[]; target: number; fireYear: number | null }

export default function FireChart({ labels, acum, target, fireYear }: Props) {
  const targetLine = Array(labels.length).fill(target)

  // Mark FIRE year point
  const firePoint = acum.map((v, i) => {
    const yr = parseInt(labels[i])
    return fireYear !== null && yr === fireYear ? v : null
  })

  const datasets = [
    {
      label: 'Capital proyectado',
      data: acum,
      borderColor: C.gold,
      backgroundColor: 'rgba(212,175,55,0.08)',
      borderWidth: 2.5,
      fill: true,
      pointRadius: 0,
      tension: 0.3,
      order: 2,
    },
    {
      label: `Meta FIRE (${fmt(target)})`,
      data: targetLine,
      borderColor: 'rgba(212,175,55,0.4)',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderDash: [8, 4],
      fill: false,
      pointRadius: 0,
      order: 1,
    },
    {
      label: 'Año FIRE',
      data: firePoint,
      borderColor: '#34d399',
      backgroundColor: '#34d399',
      borderWidth: 0,
      pointRadius: firePoint.map(v => v !== null ? 8 : 0),
      pointBackgroundColor: '#34d399',
      pointBorderColor: '#04050a',
      pointBorderWidth: 2,
      fill: false,
      showLine: false,
      order: 0,
    },
  ]

  return (
    <div style={{ height: 320, padding: '12px 12px 4px', background: C.bg }}>
      <Line
        data={{ labels, datasets }}
        options={{
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 500 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: true, position: 'top', labels: { color: C.dimText, font: { family: 'monospace', size: 10 }, boxWidth: 18, padding: 14, filter: (i) => !!i.text } },
            tooltip: {
              backgroundColor: C.surface, borderColor: C.border, borderWidth: 1,
              titleColor: C.gold, bodyColor: C.text,
              titleFont: { family: 'monospace', size: 11 }, bodyFont: { family: 'monospace', size: 11 }, padding: 10,
              callbacks: {
                label: (i) => {
                  const v = i.parsed.y
                  if (v === null || v === undefined) return ''
                  return ` ${i.dataset.label}: ${fmt(v)}`
                },
              },
            },
          },
          scales: {
            x: { ticks: { color: C.dimText, font: { family: 'monospace', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 15 }, grid: { color: 'rgba(212,175,55,0.05)' }, border: { color: C.border } },
            y: { ticks: { color: C.dimText, font: { family: 'monospace', size: 10 }, callback: (v) => fmt(Number(v)) }, grid: { color: 'rgba(212,175,55,0.05)' }, border: { color: C.border } },
          },
        }}
      />
    </div>
  )
}
