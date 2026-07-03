import { C, F, cardStyle, numberEmboss, regimeColor } from '@/app/lib/constants'

interface KpiStripProps {
  floatingPct: number
  winRate: number
  wins: number
  losses: number
  activeSignals: number
  totalModels: number
  regime: string
  leverage: number
}

function KpiCard({ label, value, valueColor, sub }: { label: string; value: string; valueColor: string; sub: string }) {
  return (
    <div style={{ ...cardStyle, background: C.surface, padding: '12px 16px', flex: 1, minWidth: 140 }}>
      <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.14em', color: C.textDim, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 22, fontWeight: 700, color: valueColor, textShadow: numberEmboss, marginTop: 4 }}>
        {value}
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, marginTop: 2 }}>
        {sub}
      </div>
    </div>
  )
}

export default function KpiStrip({ floatingPct, winRate, wins, losses, activeSignals, totalModels, regime, leverage }: KpiStripProps) {
  const floatColor = floatingPct >= 0 ? C.green : C.red
  const wrColor = winRate >= 60 ? C.green : winRate < 40 ? C.red : C.amber
  const levColor = leverage >= 4 ? C.red : leverage >= 2 ? C.amber : C.green

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      <KpiCard
        label="P&L Flotante"
        value={`${floatingPct >= 0 ? '+' : ''}${floatingPct.toFixed(2)}%`}
        valueColor={floatColor}
        sub="posiciones abiertas"
      />
      <KpiCard
        label="Win Rate"
        value={`${winRate.toFixed(0)}%`}
        valueColor={wrColor}
        sub={`${wins}W / ${losses}L`}
      />
      <KpiCard
        label="Señales"
        value={activeSignals.toString()}
        valueColor={activeSignals > 0 ? C.green : C.textDim}
        sub={`de ${totalModels} modelos`}
      />
      <KpiCard
        label="Régimen"
        value={regime}
        valueColor={regimeColor(regime)}
        sub={regime === 'BULL' ? 'tendencia alcista' : regime === 'BEAR' ? 'tendencia bajista' : 'lateral'}
      />
      <KpiCard
        label="Leverage"
        value={leverage > 0 ? `${leverage.toFixed(2)}x` : '0x'}
        valueColor={levColor}
        sub="notional / equity"
      />
    </div>
  )
}
