// Valores tomados 1:1 de dashboard.py (.kpi-strip/.kpi-card/...) + el reskin
// Black&Gold que hud/page.tsx ya aplicaba sobre el scrape (fondo #0b0d14,
// gold #39e2e6, letter-spacing .18em en label) -- esto es el resultado final
// que el usuario ve hoy, replicado nativo, sin reinterpretar el diseno.
const KPI = {
  bg: '#0b0d14',
  border: '#1a1d2e',
  gold: '#39e2e6',
  labelColor: '#7a7f9a',
  subColor: '#7a8db5',
  text: '#e2e8f8',
  red: '#f44336',
  amber: '#f59e0b',
  mono: "'IBM Plex Mono', monospace",
}

interface KpiStripProps {
  equity: number
  equitySub: string
  realizedPct: number
  realizedSub: string
  floatingPct: number
  floatingSub: string
  winRate: number
  winRateSub: string
  activeSignals: number
  totalModels: number
  regime: string
  leverage: number
  leverageSub: string
}

function valueColor(v: number): string {
  if (v > 0) return KPI.gold
  if (v < 0) return KPI.red
  return KPI.text
}

function KpiCard({ label, value, valueColor: vc, sub }: { label: string; value: string; valueColor: string; sub: string }) {
  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      background: KPI.bg, border: `1px solid ${KPI.border}`, borderRadius: 8,
      padding: '18px 20px', margin: 3, overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, rgba(57,226,230,0.75), transparent 70%)`,
      }} />
      <div style={{
        fontFamily: KPI.mono, fontSize: 8, fontWeight: 600, letterSpacing: '.18em',
        textTransform: 'uppercase', color: KPI.labelColor, marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: KPI.mono, fontSize: 28, fontWeight: 700, letterSpacing: '-.04em',
        marginBottom: 4, lineHeight: 1, color: vc, textShadow: '0 0 14px currentColor',
      }}>
        {value}
      </div>
      <div style={{ fontFamily: KPI.mono, fontSize: 10, color: KPI.subColor }}>
        {sub}
      </div>
    </div>
  )
}

export default function KpiStrip({
  equity, equitySub, realizedPct, realizedSub, floatingPct, floatingSub,
  winRate, winRateSub, activeSignals, totalModels, regime, leverage, leverageSub,
}: KpiStripProps) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0,
      background: 'transparent',
      border: `1px solid rgba(201,162,39,.22)`, borderTop: `2px solid ${KPI.gold}`,
      borderRadius: 3,
      boxShadow: '0 0 0 1px rgba(0,0,0,.55) inset, 0 12px 32px -16px rgba(0,0,0,.9), 0 0 60px -30px rgba(201,162,39,.12)',
      marginBottom: 20, overflow: 'hidden',
    }}>
      <KpiCard label="Equity Total" value={`$${Math.round(equity).toLocaleString()}`} valueColor={KPI.text} sub={equitySub} />
      <KpiCard label="Capital Realizado" value={`${realizedPct >= 0 ? '+' : ''}${realizedPct.toFixed(2)}%`} valueColor={valueColor(realizedPct)} sub={realizedSub} />
      <KpiCard label="P&L Flotante" value={`${floatingPct >= 0 ? '+' : ''}${floatingPct.toFixed(2)}%`} valueColor={valueColor(floatingPct)} sub={floatingSub} />
      <KpiCard label="Win Rate" value={`${winRate.toFixed(0)}%`} valueColor={winRate >= 50 ? KPI.gold : KPI.amber} sub={winRateSub} />
      <KpiCard label="Señales Activas" value={activeSignals.toString()} valueColor={activeSignals > 0 ? KPI.gold : KPI.text} sub={`de ${totalModels} modelos`} />
      <KpiCard label="Régimen BTC" value={regime} valueColor={regime === 'BULL' ? KPI.gold : regime === 'BEAR' ? KPI.red : KPI.amber} sub={regime === 'BULL' ? 'tendencia alcista' : regime === 'BEAR' ? 'tendencia bajista' : 'lateral'} />
      <KpiCard label="Apalancamiento" value={leverage > 0 ? `${leverage.toFixed(2)}x` : '0x'} valueColor={leverage >= 4 ? KPI.red : leverage >= 2 ? KPI.amber : KPI.gold} sub={leverageSub} />
    </div>
  )
}
