'use client'
import { memo, useMemo } from 'react'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { SimResult } from './types'

// Registro global — solo corre una vez por módulo, no en cada render
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

// ─── Palette ──────────────────────────────────────────────────────────────────
const GOLD     = '#d4af37'
const GREEN    = '#34d399'
const RED      = '#f87171'
const BG       = '#04050a'
const SURFACE  = '#0b0d14'
const BORDER   = '#1a1d2e'
const TEXT_DIM = '#7a7f9a'
const TEXT     = '#e8e9f0'
const MUTED    = '#3a3f55'

const fmt = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1e3).toFixed(0)}K`

const fmtFull = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`

interface Props {
  result: SimResult
  capital: number
  target: number
  years: number
  nSims: number
}

function McChartInner({ result, capital, target, years, nSims }: Props) {
  const n = result.labels.length

  const datasets = useMemo(() => {
    const pathDatasets = result.samplePaths.map((path, i) => ({
      label: i === 0 ? 'Trayectorias' : '',
      data: path,
      borderColor: 'rgba(212,175,55,0.055)',
      backgroundColor: 'transparent',
      borderWidth: 0.75,
      pointRadius: 0,
      fill: false as const,
      tension: 0,
      order: 10,
    }))

    return [
      {
        label: 'P90 Optimista',
        data: result.p90,
        borderColor: GREEN,
        backgroundColor: 'rgba(212,175,55,0.06)',
        borderWidth: 1.5,
        borderDash: [5, 4],
        pointRadius: 0,
        fill: '+1' as const,
        tension: 0.25,
        order: 3,
      },
      {
        label: 'P10 Pesimista',
        data: result.p10,
        borderColor: RED,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [5, 4],
        pointRadius: 0,
        fill: false as const,
        tension: 0.25,
        order: 3,
      },
      {
        label: 'P50 Mediana',
        data: result.p50,
        borderColor: GOLD,
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false as const,
        tension: 0.25,
        order: 2,
      },
      {
        label: `Objetivo FIRE (${fmt(target)})`,
        data: Array(n).fill(target),
        borderColor: 'rgba(212,175,55,0.4)',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderDash: [10, 5],
        pointRadius: 0,
        fill: false as const,
        order: 1,
      },
      {
        label: `Capital inicial (${fmt(capital)})`,
        data: Array(n).fill(capital),
        borderColor: `${MUTED}55`,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderDash: [3, 5],
        pointRadius: 0,
        fill: false as const,
        order: 1,
      },
      ...pathDatasets,
      {
        // Zona de éxito — relleno invisible en el borde, solo el wash verde
        // por encima del objetivo. Detrás del P90/P10 (order 3) para que esas
        // líneas se vean nítidas sobre el fondo, no al revés.
        label: '',
        data: Array(n).fill(target),
        borderColor: 'transparent',
        backgroundColor: 'rgba(52,211,153,0.045)',
        borderWidth: 0,
        pointRadius: 0,
        fill: 'end' as const,
        order: 7,
      },
    ]
  }, [result, capital, target, n])

  return (
    <div style={{ height: 440, padding: '14px 14px 4px', background: BG, position: 'relative' }}>
      {/* Cono de incertidumbre — resplandor estático desde el punto de partida
          (capital hoy, t=0) que se abre hacia la derecha; visualiza que la
          incertidumbre crece con el tiempo, sin tocar ninguna línea de datos. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 55% 85% at 2% 50%, rgba(212,175,55,0.10), transparent 70%)',
      }} />
      <Line
        style={{ position: 'relative', zIndex: 1 }}
        data={{ labels: result.labels, datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 300 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: TEXT_DIM,
                font: { family: 'monospace', size: 10 },
                boxWidth: 20,
                padding: 14,
                // Solo el primer dataset de trayectorias trae label ('Trayectorias');
                // el resto trae '' a propósito para no listarse 59 veces en la leyenda.
                // Filtrar por texto no vacío basta — no depende del índice/orden de
                // los datasets, así que no se rompe si se agrega o reordena alguno.
                filter: (item) => !!item.text,
              },
            },
            tooltip: {
              backgroundColor: SURFACE,
              borderColor: BORDER,
              borderWidth: 1,
              titleColor: GOLD,
              bodyColor: TEXT,
              titleFont: { family: 'monospace', size: 11 },
              bodyFont: { family: 'monospace', size: 11 },
              padding: 10,
              filter: (item) => {
                const lbl = item.dataset.label ?? ''
                return lbl !== '' && !lbl.startsWith('Trayectoria')
              },
              callbacks: {
                title: (items) => `${result.labels[items[0].dataIndex] || items[0].dataIndex + ' meses'}`,
                label: (item) => {
                  const lbl = item.dataset.label
                  if (!lbl) return ''
                  return ` ${lbl}: ${fmtFull(item.parsed.y ?? 0)}`
                },
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: TEXT_DIM,
                font: { family: 'monospace', size: 10 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: years + 1,
              },
              grid: { color: 'rgba(212,175,55,0.05)' },
              border: { color: BORDER },
            },
            y: {
              ticks: {
                color: TEXT_DIM,
                font: { family: 'monospace', size: 10 },
                callback: (v) => fmt(Number(v)),
              },
              grid: { color: 'rgba(212,175,55,0.05)' },
              border: { color: BORDER },
            },
          },
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: MUTED }}>
          {nSims.toLocaleString()} simulaciones · {result.samplePaths.length} paths visibles · {years * 12} pasos mensuales
        </span>
      </div>
    </div>
  )
}

export default memo(McChartInner)
