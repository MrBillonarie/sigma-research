'use client'
import { useEffect, useState } from 'react'

interface Stats {
  wr?: number; pf?: number; n_trades?: number; return_pct?: number; regime?: string
}

export default function StatBar() {
  const [stats, setStats] = useState<Stats>({})

  useEffect(() => {
    fetch('/api/vps/signals')
      .then(r => r.json())
      .then((d: { portfolio?: { wr?: number; pf?: number; n_trades?: number; return_pct?: number }; regime?: string }) => {
        const p = d?.portfolio ?? {}
        setStats({
          wr: p.wr != null ? (p.wr <= 1 ? p.wr * 100 : p.wr) : undefined,
          pf: p.pf,
          n_trades: p.n_trades,
          return_pct: p.return_pct,
          regime: d?.regime,
        })
      })
      .catch(() => {})
  }, [])

  const items = [
    { label: 'WIN RATE',     value: stats.wr !== undefined   ? `${stats.wr.toFixed(1)}%`    : '—' },
    { label: 'PROFIT FACTOR',value: stats.pf !== undefined   ? `${stats.pf.toFixed(2)}x`    : '—' },
    { label: 'RETORNO LIVE', value: stats.return_pct !== undefined ? `${stats.return_pct >= 0 ? '+' : ''}${stats.return_pct.toFixed(1)}%` : '—' },
    { label: 'TRADES PAPEL', value: stats.n_trades !== undefined ? `${stats.n_trades}+`     : '—' },
    { label: 'RÉGIMEN',      value: stats.regime ?? '…' },
  ]

  return (
    <div className="bg-surface border-t border-border">
      <div className="max-w-7xl mx-auto flex flex-wrap">
        {items.map((item, i) => (
          <div
            key={item.label}
            className="flex-1 min-w-[120px] px-5 py-3 border-r border-border last:border-r-0"
            style={{ borderRight: i < items.length - 1 ? '1px solid var(--color-border, #1a1d2e)' : 'none' }}
          >
            <div className="section-label text-text-dim text-xs mb-1">{item.label}</div>
            <div className="display-heading text-gold text-lg">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
