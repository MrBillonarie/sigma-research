'use client'
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale,
  CategoryScale, Filler, Tooltip, Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

const C = { bg: '#04050a', border: '#1a1d2e', gold: '#d4af37', surface: '#0b0d14', dimText: '#7a7f9a' }

const fmt = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1e3).toFixed(0)}K`

interface Props { labels: string[]; total: number[]; platforms: { name: string; data: number[]; color: string }[] }

export default function TerminalChart({ labels, total, platforms }: Props) {
  const datasets = [
    {
      label: 'Total Patrimonio',
      data: total,
      borderColor: C.gold,
      backgroundColor: 'rgba(212,175,55,0.07)',
      borderWidth: 2.5,
      fill: true,
      pointRadius: 0,
      tension: 0.35,
      order: 1,
    },
    ...platforms.map(p => ({
      label: p.name,
      data: p.data,
      borderColor: p.color,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderDash: [4, 3],
      fill: false,
      pointRadius: 0,
      tension: 0.35,
      order: 2,
    })),
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
            legend: {
              display: true, position: 'top',
              labels: { color: C.dimText, font: { family: 'monospace', size: 10 }, boxWidth: 18, padding: 14 },
            },
            tooltip: {
              backgroundColor: C.surface, borderColor: C.border, borderWidth: 1,
              titleColor: C.gold, bodyColor: '#e8e9f0',
              titleFont: { family: 'monospace', size: 11 },
              bodyFont: { family: 'monospace', size: 11 },
              padding: 10,
              callbacks: { label: (i) => ` ${i.dataset.label}: ${fmt(i.parsed.y ?? 0)}` },
            },
          },
          scales: {
            x: { ticks: { color: C.dimText, font: { family: 'monospace', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 13 }, grid: { color: 'rgba(212,175,55,0.05)' }, border: { color: C.border } },
            y: { ticks: { color: C.dimText, font: { family: 'monospace', size: 10 }, callback: (v) => fmt(Number(v)) }, grid: { color: 'rgba(212,175,55,0.05)' }, border: { color: C.border } },
          },
        }}
      />
    </div>
  )
}
