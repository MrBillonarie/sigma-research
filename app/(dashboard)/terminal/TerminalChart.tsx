'use client'
import { useEffect, useRef } from 'react'
import { C } from '@/app/lib/constants'
import { createChart, ColorType, CrosshairMode, AreaSeries, LineSeries } from 'lightweight-charts'


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
        background: { type: ColorType.VerticalGradient, topColor: '#081324', bottomColor: '#04070f' },
        textColor: C.dimText,
        fontFamily: 'monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(57,226,230,0.045)' },
        horzLines: { color: 'rgba(57,226,230,0.055)' },
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

    // Serie principal — total patrimonio (área acento) — API v5
    const totalSeries = chart.addSeries(AreaSeries, {
      lineColor: C.glow,
      topColor: 'rgba(57,226,230,0.22)',
      bottomColor: 'rgba(57,226,230,0.00)',
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
    <div style={{ position: 'relative' }}>
      {/* Leyenda — total + plataformas */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 16px',
        padding: '10px 14px 8px',
        background: 'linear-gradient(180deg, #081324, rgba(8,19,36,0))',
      }}>
        {[{ name: 'TOTAL', color: C.glow }, ...platforms].map(p => (
          <span key={p.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 2, background: p.color, borderRadius: 1, flexShrink: 0 }} />
            <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.12em', color: p.name === 'TOTAL' ? C.text : C.dimText, textTransform: 'uppercase' }}>
              {p.name}
            </span>
          </span>
        ))}
      </div>
      <div ref={containerRef} style={{ width: '100%' }} />
      {/* Watermark Σ — decorativo, no intercepta el mouse */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', zIndex: 1,
      }}>
        <span style={{ fontFamily: "var(--font-bebas,'Bebas Neue',Impact,sans-serif)", fontSize: 90, lineHeight: 1, color: 'rgba(57,226,230,0.04)' }}>Σ</span>
      </div>
    </div>
  )
}
