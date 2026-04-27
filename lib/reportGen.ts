import type {
  Asset, Report, Profile, Allocation,
  PortfolioMetrics, FlowSignal, TopMove, SignalType,
} from '@/types/decision-engine'


function buildReason(a: Asset): string {
  if (a.signal === 'comprar') {
    if (a.rsi < 40)
      return `RSI oversold (${a.rsi.toFixed(0)}) con flujo neto positivo — momentum de entrada.`
    return `Momentum positivo +${a.return30d.toFixed(1)}% 30d con aceleración de flujos de capital.`
  }
  if (a.signal === 'reducir') {
    if (a.rsi > 70)
      return `RSI sobrecomprado (${a.rsi.toFixed(0)}) con flujo neto negativo — toma de ganancias recomendada.`
    return `Desaceleración -${Math.abs(a.return30d).toFixed(1)}% 30d, momentum negativo confirma salida.`
  }
  if (a.signal === 'mantener')
    return `Perfil riesgo/retorno equilibrado. Score ${a.score}/100 dentro del rango del perfil.`
  return `Sin señal direccional clara. Retorno 30d: ${a.return30d.toFixed(1)}%. Esperar confirmación.`
}

function getTop5Moves(assets: Asset[]): TopMove[] {
  const priority: Record<SignalType, number> = { comprar: 3, reducir: 2, mantener: 1, neutral: 0 }
  return [...assets]
    .sort((a, b) => {
      const diff = priority[b.signal] - priority[a.signal]
      return diff !== 0 ? diff : b.score - a.score
    })
    .slice(0, 5)
    .map(a => ({
      asset:      a.name,
      assetClass: a.assetClass,
      action:     a.signal,
      reason:     buildReason(a),
      score:      a.score,
      return1y:   a.return1y,
    }))
}

function getSigmaIASignal(assets: Asset[], flowScore: number): string {
  const crypto    = assets.filter(a => a.assetClass === 'crypto')
  const avgCScore = crypto.length
    ? crypto.reduce((s, a) => s + a.score, 0) / crypto.length
    : 50

  if (flowScore > 70 && avgCScore > 65)
    return '🟢 BULLISH — Flujo de capital entrando en el mercado. Señales de acumulación en crypto y renta variable. Aumentar exposición gradualmente.'
  if (flowScore < 35 || avgCScore < 35)
    return '🔴 BEARISH — Salida de capital detectada en múltiples mercados. Presión vendedora dominante. Refugio en renta fija de corto plazo recomendado.'
  if (flowScore > 55)
    return '🟡 NEUTRAL-BULLISH — Mercado mixto con sesgo alcista. Mantener exposición actual, priorizar activos con señal COMPRAR.'
  return '🟡 NEUTRO — Mercado en consolidación lateral. Preferir activos defensivos con momentum positivo sostenido.'
}

function buildSummary(
  profile: Profile,
  allocation: Allocation,
  metrics: PortfolioMetrics,
  flowScore: number,
): string {
  const risk     = { retail: 'conservador', trader: 'activo de alto riesgo', institucional: 'institucional balanceado' }[profile.type]
  const flowDesc = flowScore > 60 ? 'flujos positivos de capital' : flowScore < 40 ? 'salida de capital generalizada' : 'flujos mixtos con señales divergentes'

  return (
    `Para un perfil ${risk} con horizonte ${profile.horizonte}, el Motor Sigma detecta ${flowDesc} ` +
    `en los mercados cross-market (score de flujo: ${flowScore}/100).\n\n` +
    `La asignación óptima calculada es: ${allocation.fondos}% Fondos Mutuos, ${allocation.etfs}% ETFs Globales, ` +
    `${allocation.renta_fija}% Renta Fija y ${allocation.crypto}% Crypto — dentro de los límites del perfil ` +
    `(máx. crypto ${profile.maxCrypto}%, mín. renta fija ${profile.minFixedIncome}%).\n\n` +
    `Métricas proyectadas: Retorno esperado ${metrics.expectedReturn.toFixed(1)}% anual, ` +
    `volatilidad ${metrics.annualVolatility.toFixed(1)}% anual, Sharpe ratio ${metrics.sharpeRatio.toFixed(2)}. ` +
    `Drawdown máximo estimado: ${metrics.maxDrawdown.toFixed(1)}%.`
  )
}

export function generateReport(
  profile:     Profile,
  assets:      Asset[],
  allocation:  Allocation,
  metrics:     PortfolioMetrics,
  flowSignals: FlowSignal[],
  flowScore:   number,
): Report {
  return {
    generatedAt:   new Date().toISOString(),
    profile,
    topMoves:      getTop5Moves(assets),
    sigmaIASignal: getSigmaIASignal(assets, flowScore),
    flowScore,
    summary:       buildSummary(profile, allocation, metrics, flowScore),
    allocation,
    metrics,
    flowSignals,
  }
}

// ─── Formateo de fecha en español ─────────────────────────────────────────────
export function formatDateES(iso: string): string {
  const d = new Date(iso)
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const DIAS  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}, ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
}
