'use client'

// TODO: conectar a API real
const tickers = [
  { sym: 'SPX', val: '5,234.18', chg: '+0.82%', up: true },
  { sym: 'NDX', val: '18,291.44', chg: '+1.12%', up: true },
  { sym: 'BTC', val: '67,420.00', chg: '-0.34%', up: false },
  { sym: 'GOLD', val: '2,341.50', chg: '+0.21%', up: true },
  { sym: 'VIX', val: '14.32', chg: '-3.10%', up: false },
  { sym: 'DXY', val: '104.21', chg: '+0.08%', up: true },
  { sym: 'TNX', val: '4.31%', chg: '+0.02', up: true },
  { sym: 'NVDA', val: '874.00', chg: '+2.41%', up: true },
  { sym: 'TSLA', val: '178.12', chg: '-1.23%', up: false },
  { sym: 'QQQ', val: '448.90', chg: '+1.05%', up: true },
]

export default function TickerBar() {
  const doubled = [...tickers, ...tickers]

  return (
    <div className="w-full overflow-hidden bg-surface border-y border-border py-2">
      <div className="flex animate-ticker whitespace-nowrap" style={{ width: 'max-content' }}>
        {doubled.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-6 terminal-text">
            <span className="text-text-dim">{t.sym}</span>
            <span className="text-text font-medium">{t.val}</span>
            <span className={t.up ? 'text-emerald-400' : 'text-red-400'}>{t.chg}</span>
            <span className="text-border">|</span>
          </span>
        ))}
      </div>
    </div>
  )
}
