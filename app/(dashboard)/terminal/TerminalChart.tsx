'use client'
import { useEffect, useRef } from 'react'
import { createChart, ColorType, CrosshairMode, AreaSeries, LineSeries } from 'lightweight-charts'

const C = { bg: '#04050a', border: '#1a1d2e', gold: '#39e2e6', surface: '#0b0d14', dimText: '#7a7f9a', text: '#e8e9f0' }

const fmt = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${(v / 1e3).toFixed(0)}K`

interface Props {
  labels: string[]
  total: number[]
  platforms: { name: string; data: number[]; color: string }[]
}

export default function TerminalChart({ labels, total, platforms }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !labels.length) return

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: C.bg },
        textColor: C.dimText,
        fontFamily: 'monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: C.border },
        horzLines: { color: C.border },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: C.gold + '50', labelBackgroundColor: C.surface },
        horzLine: { color: C.gold + '50', labelBackgroundColor: C.surface },
      },
      rightPriceScale: {
        borderColor: C.border,
      },
      timeScale: {
        borderColor: C.border,
      },
    })

    // Mapear labels a timestamps (un mes por punto, empezando hace N meses)
    const now = Date.now()
    const toTime = (i: number) =>
      Math.floor((now - (labels.length - 1 - i) * 30 * 24 * 3600 * 1000) / 1000) as unknown as import('lightweight-charts').Time

    // Serie principal — total patrimonio (área dorada) — API v5
    const totalSeries = chart.addSeries(AreaSeries, {
      lineColor: C.gold,
      topColor: C.gold + '28',
      bottomColor: C.gold + '04',
      lineWidth: 2,
      priceFormat: { type: 'custom', formatter: fmt },
    })
    totalSeries.setData(total.map((v, i) => ({ time: toTime(i), value: v })))

    // Series secundarias — plataformas (líneas) — API v5
    platforms.forEach(p => {
      const s = chart.addSeries(LineSeries, {
        color: p.color,
        lineWidth: 1,
        lineStyle: 1,
        priceFormat: { type: 'custom', formatter: fmt },
        lastValueVisible: false,
        priceLineVisible: false,
      })
      s.setData(p.data.map((v, i) => ({ time: toTime(i), value: v })))
    })

    chart.timeScale().fitContent()

    const ro = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect
      chart.applyOptions({ width })
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [labels, total, platforms])

  return (
    <div style={{ background: C.bg, padding: '12px 0 4px' }}>
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  )
}
