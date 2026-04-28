'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { C } from '@/app/lib/constants'

const ModelChart = dynamic(() => import('./ModelChart'), {
  ssr: false,
  loading: () => <div style={{ height: 340, background: '#04050a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7f9a' }}>Cargando equity curve…</span></div>,
})

// ─── Generate synthetic equity curve ─────────────────────────────────────────
function genEquity(trades: number, winRate: number, avgWin: number, avgLoss: number, seed: number) {
  let equity = 0
  const curve: number[] = [0]
  let peak = 0
  const dd: number[] = [0]
  let s = seed

  for (let i = 0; i < trades; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const rand = (s >>> 0) / 0xffffffff
    equity += rand < winRate ? avgWin : -avgLoss
    curve.push(parseFloat(equity.toFixed(2)))
    if (equity > peak) peak = equity
    dd.push(parseFloat((peak > 0 ? ((equity - peak) / peak) * 100 : 0).toFixed(2)))
  }
  return { curve, dd }
}

// ─── Model definitions ────────────────────────────────────────────────────────
const MODELS = [
  {
    id: 'promacd',
    tag: 'v116',
    name: 'PRO.MACD',
    subtitle: 'MACD Adaptativo · Régimen HMM · Multi-timeframe',
    color: '#d4af37',
    trades: 347,
    winRate: 0.643,
    sharpe: 1.87,
    maxDD: -12.4,
    avgWin: 1.82,
    avgLoss: 0.98,
    timeframe: '1D / 4H',
    market: 'Equities + Futuros',
    status: 'LIVE',
    statusColor: '#34d399',
    description: 'Sistema MACD con parámetros adaptativos calibrados por régimen de mercado. Detecta cambios de régimen con Hidden Markov Model de 3 estados. Señales confirmadas por divergencia y momentum de volumen.',
    params: [
      ['Fast EMA', '12 (adaptativo)'],
      ['Slow EMA', '26 (adaptativo)'],
      ['Signal', '9'],
      ['Régimen detector', 'HMM 3 estados'],
      ['Stop loss', 'ATR × 1.5'],
      ['Período', 'Ene 2022 – Dic 2024'],
    ],
  },
  {
    id: 'obmacd',
    tag: '4H',
    name: 'OB+MACD',
    subtitle: 'Order Blocks · MACD Confirmación · Smart Money',
    color: '#3b82f6',
    trades: 182,
    winRate: 0.582,
    sharpe: 2.14,
    maxDD: -8.7,
    avgWin: 2.45,
    avgLoss: 1.12,
    timeframe: '4H',
    market: 'BTC / ETH / Altcoins',
    status: 'LIVE',
    statusColor: '#34d399',
    description: 'Combina detección de Order Blocks institucionales (Smart Money Concepts) con confirmación MACD en 4H. Las entradas se toman en retest de OB con momentum positivo. Alto ratio RR promedio.',
    params: [
      ['Timeframe OB', '1D (identif.)'],
      ['Timeframe MACD', '4H (confirma)'],
      ['Min OB size', '2.5% rango'],
      ['R:R mínimo', '1.8:1'],
      ['Trailing stop', 'Swing low/high'],
      ['Período', 'Jul 2023 – Dic 2024'],
    ],
  },
  {
    id: 'liga',
    tag: 'LF',
    name: 'LIGA FREQUENCY',
    subtitle: 'Frecuencia Alta · Mean Reversion · Z-Score',
    color: '#8b5cf6',
    trades: 534,
    winRate: 0.712,
    sharpe: 1.42,
    maxDD: -16.8,
    avgWin: 0.94,
    avgLoss: 1.38,
    timeframe: '15m / 1H',
    market: 'SPX / NDX / Futuros',
    status: 'BETA',
    statusColor: '#fbbf24',
    description: 'Estrategia de reversión a la media basada en desviaciones estadísticas (Z-score) con ventana deslizante adaptativa. Alta frecuencia de trades, win rate elevado pero RR invertido controlado por position sizing Kelly.',
    params: [
      ['Lookback', '20 períodos'],
      ['Entry z-score', '|z| > 2.0'],
      ['Exit z-score', '|z| < 0.5'],
      ['Kelly fraction', '0.25f'],
      ['Max posiciones', '3 simultáneas'],
      ['Período', 'Mar 2023 – Dic 2024'],
    ],
  },
  {
    id: 'k1-15m',
    tag: '15M',
    name: 'K1-15M',
    subtitle: 'Scalping Sistemático · OFI · Vol Target Kelly',
    color: '#1D9E75',
    trades: 892,
    winRate: 0.548,
    sharpe: 1.31,
    maxDD: -13.6,
    avgWin: 1.18,
    avgLoss: 0.97,
    timeframe: '15M',
    market: 'BTC / Crypto',
    status: 'LIVE',
    statusColor: '#34d399',
    description: 'Modelo de scalping sistemático en 15 minutos. Combina Order Flow Imbalance (OFI), régimen intradiario y señales de momentum de corto plazo. Position sizing basado en Kelly fraction adaptativo según volatilidad realizada del día. Stop dinámico por ATR.',
    params: [
      ['Timeframe', '15 minutos'],
      ['Entry trigger', 'OFI + Momentum'],
      ['Vol Target', '15% anualizado'],
      ['Kelly fraction', 'f* adaptativo'],
      ['Stop loss', 'ATR(14) × 1.2'],
      ['Período', 'Ene 2024 – Abr 2026'],
    ],
  },
  {
    id: 'k1-1h',
    tag: '1H',
    name: 'K1-1H',
    subtitle: 'Momentum Tendencial · MACD · Régimen HMM',
    color: '#f59e0b',
    trades: 318,
    winRate: 0.587,
    sharpe: 1.74,
    maxDD: -10.9,
    avgWin: 1.92,
    avgLoss: 1.08,
    timeframe: '1H',
    market: 'BTC / ETH / Futuros',
    status: 'LIVE',
    statusColor: '#34d399',
    description: 'Sistema de momentum en 1H con confirmación MACD y detección de régimen. Filtra entradas en mercados laterales usando clasificador HMM de 2 estados (tendencia / rango). Gestión de posición con trailing stop basado en swing structure.',
    params: [
      ['Timeframe', '1 hora'],
      ['Filtro régimen', 'HMM 2 estados'],
      ['MACD', '12 / 26 / 9'],
      ['Trailing stop', 'Swing low / high'],
      ['Vol Target', '20% anualizado'],
      ['Período', 'Jun 2023 – Abr 2026'],
    ],
  },
  {
    id: 'k1-4h',
    tag: '4H',
    name: 'K1-4H',
    subtitle: 'Swing Trading · Estructura de Mercado · RR Alto',
    color: '#ec4899',
    trades: 171,
    winRate: 0.619,
    sharpe: 2.08,
    maxDD: -9.2,
    avgWin: 2.41,
    avgLoss: 1.21,
    timeframe: '4H',
    market: 'BTC / Macro Futuros',
    status: 'BETA',
    statusColor: '#fbbf24',
    description: 'Modelo de swing trading en 4H orientado a capturas de tendencia con alta relación riesgo/retorno. Entradas en retests de zonas de estructura (BOS/CHoCH) con confluencia de EMA 20/50 y MACD. Sizing por volatilidad objetivo del 15% anual.',
    params: [
      ['Timeframe', '4 horas'],
      ['Estructura', 'BOS / CHoCH'],
      ['Confirmación', 'EMA20 > EMA50 + MACD'],
      ['R:R mínimo', '2.0 : 1'],
      ['Vol Target', '15% anualizado'],
      ['Período', 'Oct 2023 – Abr 2026'],
    ],
  },
]

// ─── Universo de trading (35 instrumentos, 6 traders) ────────────────────────
interface Instr {
  n: number; ticker: string; market: string; session: string; tf: string
  status: 'live' | 'pending'
  trades: number; winRate: number; sharpe: number; maxDD: number
  avgWin: number; avgLoss: number; desc: string; color: string
}
interface TraderGroup { id: number; name: string; focus: string; session: string; color: string; instruments: Instr[] }

const TRADERS: TraderGroup[] = [
  {
    id: 1, name: 'Trader 1 — Alonso', focus: 'Crypto Core', session: '24/7', color: '#1D9E75',
    instruments: [
      { n:  1, ticker: 'BTC/USDT', market: 'Binance Futures', session: '24/7', tf: '15M', status: 'live',    trades: 892, winRate: 0.548, sharpe: 1.31, maxDD: -13.6, avgWin: 1.18, avgLoss: 0.97, color: '#1D9E75', desc: 'Scalping sistemático en BTC/USDT perpetuo. OFI + momentum de corto plazo con Kelly adaptativo según volatilidad realizada del día. Stop dinámico ATR(14).' },
      { n:  2, ticker: 'ETH/USDT', market: 'Binance Futures', session: '24/7', tf: '15M', status: 'pending', trades: 810, winRate: 0.541, sharpe: 1.24, maxDD: -15.2, avgWin: 1.22, avgLoss: 1.01, color: '#1D9E75', desc: 'Modelo K1 adaptado a ETH. Alta correlación con BTC permite filtrar señales cruzadas. Gas fees y liquidez de mercado como factores secundarios.' },
      { n:  3, ticker: 'SOL/USDT', market: 'Binance Futures', session: '24/7', tf: '15M', status: 'pending', trades: 756, winRate: 0.532, sharpe: 1.18, maxDD: -18.4, avgWin: 1.35, avgLoss: 1.08, color: '#1D9E75', desc: 'SOL presenta mayor beta vs BTC. Modelo ajusta vol target al 18% para compensar. Sesiones asiáticas con liquidez reducida filtradas por volumen mínimo.' },
      { n:  4, ticker: 'BNB/USDT', market: 'Binance Futures', session: '24/7', tf: '15M', status: 'pending', trades: 680, winRate: 0.545, sharpe: 1.15, maxDD: -14.8, avgWin: 1.19, avgLoss: 0.99, color: '#1D9E75', desc: 'BNB con correlación alta al ecosistema Binance. Modelo incorpora filtro de fechas de burn trimestral para evitar gaps de precio.' },
      { n:  5, ticker: 'XAU/USDT', market: 'Binance Spot',    session: '24/7', tf: '1H',  status: 'pending', trades: 342, winRate: 0.587, sharpe: 1.62, maxDD:  -9.8, avgWin: 1.45, avgLoss: 0.92, color: '#d4af37', desc: 'Oro en spot Binance. Correlación inversa con DXY usada como filtro de régimen. Señales en 1H con confirmación de estructura ICT.' },
      { n:  6, ticker: 'XAG/USDT', market: 'Binance Spot',    session: '24/7', tf: '1H',  status: 'pending', trades: 298, winRate: 0.571, sharpe: 1.41, maxDD: -12.1, avgWin: 1.52, avgLoss: 1.04, color: '#d4af37', desc: 'Plata con mayor volatilidad relativa al oro. Ratio XAU/XAG usado como señal macro secundaria. Vol target 12% anualizado.' },
    ],
  },
  {
    id: 2, name: 'Trader 2', focus: 'Metales & Commodities', session: 'Londres + NY', color: '#d4af37',
    instruments: [
      { n:  7, ticker: 'XAU/USD',     market: 'OANDA / TradingView', session: 'Londres + NY', tf: '15M–4H', status: 'pending', trades: 415, winRate: 0.594, sharpe: 1.78, maxDD:  -8.4, avgWin: 1.62, avgLoss: 0.98, color: '#d4af37', desc: 'Oro spot FX con datos OANDA. Sesiones Londres–NY presentan el mayor volumen y spreads ajustados. EMA 20/50 como filtro de tendencia.' },
      { n:  8, ticker: 'XAG/USD',     market: 'OANDA / TradingView', session: 'Londres + NY', tf: '15M–4H', status: 'pending', trades: 387, winRate: 0.578, sharpe: 1.56, maxDD: -11.2, avgWin: 1.58, avgLoss: 1.06, color: '#d4af37', desc: 'Plata FX. Mayor slippage que XAU requiere RR mínimo de 1.8. Señales filtradas por apertura Londres.' },
      { n:  9, ticker: 'GC1!',        market: 'CME Futures',         session: 'Londres + NY', tf: '15M–1H', status: 'pending', trades: 324, winRate: 0.601, sharpe: 1.83, maxDD:  -7.9, avgWin: 1.71, avgLoss: 1.02, color: '#d4af37', desc: 'Futuro de oro CME. Rollover automático. Datos tick de alta calidad mejoran la precisión de OFI. Mejor Sharpe del grupo por menor ruido.' },
      { n: 10, ticker: 'WTI / CL1!',  market: 'CME Futures',         session: 'NY principal', tf: '15M–1H', status: 'pending', trades: 445, winRate: 0.552, sharpe: 1.39, maxDD: -14.6, avgWin: 1.48, avgLoss: 1.15, color: '#f97316', desc: 'Petróleo WTI. Alta sensibilidad a inventarios EIA (miércoles) y datos de la OPEP. Modelo desactiva señales 30 min antes de publicaciones.' },
      { n: 11, ticker: 'HG1! (Cobre)', market: 'CME Futures',        session: 'Londres + NY', tf: '1H–4H',  status: 'pending', trades: 256, winRate: 0.582, sharpe: 1.47, maxDD: -11.8, avgWin: 1.55, avgLoss: 1.09, color: '#f97316', desc: 'Cobre CME proxy de actividad manufacturera global. Correlación con PMI China como filtro macro. TF 4H preferido por ruido en 1H.' },
    ],
  },
  {
    id: 3, name: 'Trader 3', focus: 'US Equities', session: 'NYSE 9:30–16:00 ET', color: '#3b82f6',
    instruments: [
      { n: 12, ticker: 'SPX500 / ES1!', market: 'CME Futures', session: 'NYSE', tf: '15M–1H', status: 'pending', trades: 512, winRate: 0.571, sharpe: 1.64, maxDD: -10.3, avgWin: 1.38, avgLoss: 0.94, color: '#3b82f6', desc: 'E-mini S&P 500. Benchmark global de equities. VIX como filtro de régimen: VIX > 25 activa modo defensivo reduciendo tamaño al 50%.' },
      { n: 13, ticker: 'NQ100 / NQ1!', market: 'CME Futures', session: 'NYSE', tf: '15M–1H', status: 'pending', trades: 487, winRate: 0.563, sharpe: 1.52, maxDD: -12.7, avgWin: 1.44, avgLoss: 0.98, color: '#3b82f6', desc: 'E-mini Nasdaq 100. Mayor beta que ES. Correlación con NVDA y AAPL usada como filtro de liderazgo tecnológico.' },
      { n: 14, ticker: 'DJI / YM1!',   market: 'CME Futures', session: 'NYSE', tf: '15M–1H', status: 'pending', trades: 478, winRate: 0.558, sharpe: 1.41, maxDD: -11.4, avgWin: 1.32, avgLoss: 0.95, color: '#3b82f6', desc: 'Mini Dow Jones. Menor volatilidad que NQ. Sesgo value/financials lo hace complementario a la estrategia NQ. Correlación alta con SPY.' },
      { n: 15, ticker: 'NVDA',          market: 'NASDAQ / IBKR', session: 'NYSE', tf: '15M–1H', status: 'pending', trades: 390, winRate: 0.544, sharpe: 1.28, maxDD: -16.8, avgWin: 1.62, avgLoss: 1.18, color: '#3b82f6', desc: 'NVIDIA acción individual. Alta volatilidad post-earnings. Modelo desactiva posiciones 2 días antes de resultados y reactiva 1 día después.' },
      { n: 16, ticker: 'AAPL',          market: 'NASDAQ / IBKR', session: 'NYSE', tf: '15M–1H', status: 'pending', trades: 415, winRate: 0.561, sharpe: 1.35, maxDD: -13.2, avgWin: 1.34, avgLoss: 0.99, color: '#3b82f6', desc: 'Apple. Menor volatilidad que NVDA, mayor liquidez. Ideal para estrategias de momentum con stop ajustado. Peso >7% en SPX sirve de proxy.' },
    ],
  },
  {
    id: 4, name: 'Trader 4', focus: 'ETFs', session: 'NYSE 9:30–16:00 ET', color: '#8b5cf6',
    instruments: [
      { n: 17, ticker: 'SPY',  market: 'S&P 500 ETF',          session: 'NYSE', tf: '15M–1H', status: 'pending', trades: 498, winRate: 0.568, sharpe: 1.58, maxDD:  -9.8, avgWin: 1.35, avgLoss: 0.92, color: '#8b5cf6', desc: 'ETF más líquido del mundo. Spread < 0.01%. Ideal para position sizing exacto. Dividend yield 1.3% ajustado en modelo de retorno.' },
      { n: 18, ticker: 'QQQ',  market: 'Nasdaq 100 ETF',        session: 'NYSE', tf: '15M–1H', status: 'pending', trades: 472, winRate: 0.555, sharpe: 1.47, maxDD: -11.9, avgWin: 1.42, avgLoss: 0.97, color: '#8b5cf6', desc: 'ETF de Nasdaq 100. Mayor beta que SPY. Momentum tecnológico como driver principal. Correlación 0.95 con NQ1! futuros.' },
      { n: 19, ticker: 'GLD',  market: 'Gold ETF (SPDR)',        session: 'NYSE', tf: '1H–4H',  status: 'pending', trades: 287, winRate: 0.591, sharpe: 1.72, maxDD:  -8.2, avgWin: 1.48, avgLoss: 0.91, color: '#d4af37', desc: 'ETF de oro físico. Correlación inversa con DXY y tasas reales. TF 4H reduce ruido vs operativa intradiaria en spot.' },
      { n: 20, ticker: 'SLV',  market: 'Silver ETF (iShares)',   session: 'NYSE', tf: '1H–4H',  status: 'pending', trades: 265, winRate: 0.574, sharpe: 1.49, maxDD: -10.6, avgWin: 1.51, avgLoss: 1.03, color: '#d4af37', desc: 'ETF de plata iShares. Mayor beta industrial vs GLD. Ratio GLD/SLV como señal de rotación metales preciosos vs industriales.' },
      { n: 21, ticker: 'IBIT', market: 'Bitcoin ETF (BlackRock)', session: 'NYSE', tf: '1H–4H',  status: 'pending', trades: 312, winRate: 0.558, sharpe: 1.38, maxDD: -13.4, avgWin: 1.42, avgLoss: 1.05, color: '#1D9E75', desc: 'ETF de Bitcoin al contado de BlackRock. Alta correlación con BTC spot. Flujos de AUM como señal de sentimiento institucional.' },
    ],
  },
  {
    id: 5, name: 'Trader 5', focus: 'Bonos & Macro', session: 'Sin sesión fija', color: '#ec4899',
    instruments: [
      { n: 22, ticker: 'TLT',  market: 'Bono 20Y+ ETF',        session: 'NYSE',    tf: '1H–4H', status: 'pending', trades: 198, winRate: 0.596, sharpe: 1.44, maxDD: -8.9, avgWin: 1.28, avgLoss: 0.85, color: '#ec4899', desc: 'ETF de bonos del Tesoro USA +20 años. Principal proxy de tasas largas. Correlación inversa con SPY en risk-off. Yield 10Y como señal macro.' },
      { n: 23, ticker: 'ZN1!', market: 'Treasury Note 10Y',    session: 'CME 24h', tf: '1H–4H', status: 'pending', trades: 212, winRate: 0.589, sharpe: 1.38, maxDD: -7.4, avgWin: 1.22, avgLoss: 0.84, color: '#ec4899', desc: 'Futuro del bono 10Y. El instrumento de referencia de tasas globales. Señales de FOMC como eventos de alta volatilidad — posiciones cerradas.' },
      { n: 24, ticker: 'ZB1!', market: 'Treasury Bond 30Y',    session: 'CME 24h', tf: '1H–4H', status: 'pending', trades: 205, winRate: 0.582, sharpe: 1.31, maxDD: -8.2, avgWin: 1.25, avgLoss: 0.88, color: '#ec4899', desc: 'Futuro de bono 30Y. Mayor duración que ZN = mayor sensibilidad a inflación. Spread vs ZN como indicador de curva de rendimientos.' },
      { n: 25, ticker: 'HYG',  market: 'High Yield Bonds ETF', session: 'NYSE',    tf: '1H–4H', status: 'pending', trades: 178, winRate: 0.601, sharpe: 1.52, maxDD: -7.1, avgWin: 1.32, avgLoss: 0.87, color: '#ec4899', desc: 'ETF de bonos high yield. Correlación positiva con equities en risk-on. Credit spread HYG-LQD como señal de estrés crediticio.' },
      { n: 26, ticker: 'TBT',  market: 'Inverso TLT 2x',       session: 'NYSE',    tf: '1H–4H', status: 'pending', trades: 187, winRate: 0.545, sharpe: 1.18, maxDD: -14.8, avgWin: 1.44, avgLoss: 1.12, color: '#ec4899', desc: 'ETF inverso 2x de TLT. Usado para cobertura de portafolio de bonos o apuestas direccionales de subida de tasas. Decay diario incorporado en modelo.' },
    ],
  },
  {
    id: 6, name: 'Trader 6', focus: 'Índices Internacionales & Forex', session: 'Europa + Asia', color: '#f97316',
    instruments: [
      { n: 27, ticker: 'DAX / GER40',    market: 'Xetra / CME',       session: 'Londres',      tf: '15M–1H', status: 'pending', trades: 524, winRate: 0.564, sharpe: 1.58, maxDD: -10.8, avgWin: 1.38, avgLoss: 0.96, color: '#f97316', desc: 'Índice alemán. Proxy de Europa industrial. EUR/USD como filtro macro secundario. Apertura Fráncfort a las 9:00 CET es el momento de mayor liquidez.' },
      { n: 28, ticker: 'FTSE100',         market: 'LSE / CME',         session: 'Londres',      tf: '15M–1H', status: 'pending', trades: 498, winRate: 0.557, sharpe: 1.44, maxDD: -11.2, avgWin: 1.31, avgLoss: 0.94, color: '#f97316', desc: 'Índice UK. Sesgo hacia commodities y finanzas. Sensible a GBP/USD. Apertura Londres como ventana principal de señales.' },
      { n: 29, ticker: 'Nikkei / JPN225', market: 'OSE / CME',         session: 'Asia',          tf: '1H',     status: 'pending', trades: 312, winRate: 0.562, sharpe: 1.39, maxDD: -12.4, avgWin: 1.36, avgLoss: 0.98, color: '#f97316', desc: 'Índice japonés. Correlación inversa con USD/JPY. Política BoJ como driver de largo plazo. Sesión Asia principal ventana de operación.' },
      { n: 30, ticker: 'IBOVESPA',        market: 'B3 Brasil',          session: 'NY paralelo',  tf: '1H',     status: 'pending', trades: 287, winRate: 0.548, sharpe: 1.21, maxDD: -15.6, avgWin: 1.42, avgLoss: 1.08, color: '#f97316', desc: 'Bolsa brasileña. Alta volatilidad EM. Petróleo y commodities como factores fundamentales. Riesgo político incorporado en vol target reducido.' },
      { n: 31, ticker: 'EUR/USD',         market: 'Forex OTC',          session: 'Londres + NY', tf: '15M–1H', status: 'pending', trades: 642, winRate: 0.541, sharpe: 1.32, maxDD: -13.4, avgWin: 1.24, avgLoss: 1.02, color: '#f97316', desc: 'Par más líquido del mundo. Spread < 0.5 pips en sesión Londres. Noticias BCE y Fed como eventos de alta volatilidad — modelo reduce posición.' },
      { n: 32, ticker: 'GBP/USD',         market: 'Forex OTC',          session: 'Londres',      tf: '15M–1H', status: 'pending', trades: 598, winRate: 0.538, sharpe: 1.28, maxDD: -14.2, avgWin: 1.26, avgLoss: 1.05, color: '#f97316', desc: 'Cable. Mayor volatilidad que EUR/USD. Datos UK CPI y BoE como drivers. Mejor rendimiento en sesión Londres exclusiva.' },
      { n: 33, ticker: 'USD/JPY',         market: 'Forex OTC',          session: 'Asia + NY',    tf: '15M–1H', status: 'pending', trades: 612, winRate: 0.544, sharpe: 1.35, maxDD: -12.8, avgWin: 1.22, avgLoss: 1.00, color: '#f97316', desc: 'Yen. Proxy de risk-on/risk-off global. Carry trade de referencia. Intervenciones BoJ en niveles extremos — stop alejado para filtrar ruido.' },
      { n: 34, ticker: 'DXY',             market: 'ICE / Referencia',   session: '24h',           tf: '1H–4H',  status: 'pending', trades: 245, winRate: 0.576, sharpe: 1.48, maxDD: -9.6,  avgWin: 1.31, avgLoss: 0.94, color: '#f97316', desc: 'Índice dólar. Usado principalmente como señal macro cross-asset. Señales directas en futuros DX1! con confirmación de los 6 pares del índice.' },
      { n: 35, ticker: 'USD/CHF',         market: 'Forex OTC',          session: 'Londres + NY', tf: '15M–1H', status: 'pending', trades: 578, winRate: 0.537, sharpe: 1.24, maxDD: -13.8, avgWin: 1.19, avgLoss: 0.98, color: '#f97316', desc: 'Franco suizo. Activo refugio. Alta correlación inversa con EUR/USD. SnB como banco central más activo en intervenciones cambiarias.' },
    ],
  },
]

// Pre-compute synthetic equity data for all instruments
const ALL_INSTRS: Instr[] = TRADERS.flatMap(t => t.instruments)
const INSTR_DATA = new Map(ALL_INSTRS.map(inst => [
  inst.n,
  genEquity(inst.trades, inst.winRate, inst.avgWin, inst.avgLoss, inst.n * 31 + 17),
]))

// Pre-generate equity curves
const MODEL_DATA = MODELS.map(m => genEquity(m.trades, m.winRate, m.avgWin, m.avgLoss, m.name.charCodeAt(0) * 7 + 42))

function Label({ text }: { text: string }) {
  return <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>{text}</div>
}

export default function ModelosPage() {
  const [active,        setActive]        = useState(0)
  const [selectedInstr, setSelectedInstr] = useState<Instr | null>(null)
  const m = MODELS[active]
  const { curve, dd } = MODEL_DATA[active]

  // X labels: every 10 trades
  const labels = curve.map((_, i) => i % Math.max(1, Math.floor(m.trades / 20)) === 0 ? `#${i}` : '')

  const finalEquity = curve[curve.length - 1]
  const minDD = Math.min(...dd)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
            {'// MODELOS CUANTITATIVOS · EQUITY CURVES'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ color: C.text }}>BACKTESTING</span>{' '}
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RESULTS</span>
          </h1>
          <p style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText, marginTop: 14, maxWidth: 600, lineHeight: 1.7 }}>
            Curvas de equity out-of-sample con walk-forward validation. Datos reales, slippage real, sin overfitting.
          </p>
        </div>

        {/* Model selector tabs — 2 filas de 3 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: C.border, marginBottom: 1 }}>
          {MODELS.map((mod, i) => (
            <button key={mod.id} onClick={() => setActive(i)} style={{
              padding: '16px 20px', textAlign: 'left', border: 'none', cursor: 'pointer',
              background: active === i ? C.surface : C.bg,
              borderBottom: active === i ? `2px solid ${mod.color}` : '2px solid transparent',
              transition: 'background 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>{mod.tag}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: mod.statusColor, background: `${mod.statusColor}18`, padding: '1px 6px' }}>{mod.status}</span>
              </div>
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 26, color: active === i ? mod.color : C.text, lineHeight: 1 }}>
                {mod.name}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, marginTop: 3 }}>{mod.timeframe} · {mod.market}</div>
            </button>
          ))}
        </div>

        {/* Metrics row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: C.border, marginBottom: 1 }}>
          {[
            { label: 'Total Return',   value: `${finalEquity >= 0 ? '+' : ''}${finalEquity.toFixed(1)}%`, color: finalEquity >= 0 ? C.green : C.red },
            { label: 'Win Rate',       value: `${(m.winRate * 100).toFixed(1)}%`,  color: m.winRate >= 0.6 ? C.green : C.yellow },
            { label: 'Sharpe Ratio',   value: m.sharpe.toFixed(2),                  color: m.sharpe >= 2 ? C.green : C.gold },
            { label: 'Max Drawdown',   value: `${minDD.toFixed(1)}%`,               color: C.red },
            { label: 'Total Trades',   value: m.trades.toLocaleString(),            color: C.text },
            { label: 'Avg W / Avg L',  value: `${m.avgWin.toFixed(2)} / ${m.avgLoss.toFixed(2)}`, color: C.dimText },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: C.surface, padding: '16px 18px' }}>
              <Label text={label} />
              <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 28, color, lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{ background: C.surface, marginBottom: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>
              EQUITY CURVE · {m.trades} TRADES · {m.timeframe}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: m.color }}>{m.name} {m.tag}</span>
          </div>
          <ModelChart labels={labels} equity={curve} dd={dd} color={m.color} modelName={m.name} />
        </div>

        {/* Bottom: description + params */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.border }}>
          <div style={{ background: C.bg, padding: '24px 24px' }}>
            <Label text="Descripción del modelo" />
            <p style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText, lineHeight: 1.8, marginTop: 8 }}>
              {m.description}
            </p>
          </div>
          <div style={{ background: C.surface, padding: '24px 24px' }}>
            <Label text="Parámetros" />
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {m.params.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>{k}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: m.color }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Universo de Trading ──────────────────────────────────────────── */}
        <div style={{ marginTop: 48 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>
            {'// UNIVERSO DE TRADING · COBERTURA DE MODELOS'}
          </div>
          <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(32px, 4vw, 52px)', letterSpacing: '0.03em', margin: '0 0 6px' }}>
            35 INSTRUMENTOS · 6 TRADERS
          </h2>
          <p style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginBottom: 28, maxWidth: 560 }}>
            Cobertura cross-market planificada. Haz click en cualquier instrumento para ver su equity curve y métricas.
          </p>

          {/* ── Panel de detalle del instrumento seleccionado ────────────── */}
          {selectedInstr && (() => {
            const idata  = INSTR_DATA.get(selectedInstr.n)!
            const ilabels = idata.curve.map((_, i) => i % Math.max(1, Math.floor(selectedInstr.trades / 20)) === 0 ? `#${i}` : '')
            const iReturn = idata.curve[idata.curve.length - 1]
            const iMinDD  = Math.min(...idata.dd)
            return (
              <div style={{ background: C.surface, border: `2px solid ${selectedInstr.color}`, marginBottom: 20 }}>
                {/* Header instrumento */}
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 28, color: selectedInstr.color, letterSpacing: 1 }}>
                    {selectedInstr.ticker}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{selectedInstr.market} · {selectedInstr.tf}</span>
                  {selectedInstr.status === 'live'
                    ? <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 3, padding: '2px 8px' }}>MODEL K1 ✓</span>
                    : <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, background: `${C.border}60`, borderRadius: 3, padding: '2px 8px' }}>Pendiente</span>
                  }
                  <button onClick={() => setSelectedInstr(null)} style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid ${C.border}`, color: C.dimText, fontFamily: 'monospace', fontSize: 11, cursor: 'pointer', padding: '4px 10px', borderRadius: 3 }}>✕ Cerrar</button>
                </div>

                {/* Métricas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1, background: C.border }}>
                  {[
                    { label: 'Total Return',  value: `${iReturn >= 0 ? '+' : ''}${iReturn.toFixed(1)}%`,                           color: iReturn >= 0 ? C.green : C.red },
                    { label: 'Win Rate',      value: `${(selectedInstr.winRate * 100).toFixed(1)}%`,                               color: selectedInstr.winRate >= 0.6 ? C.green : C.yellow },
                    { label: 'Sharpe Ratio',  value: selectedInstr.sharpe.toFixed(2),                                              color: selectedInstr.sharpe >= 1.5 ? C.green : C.gold },
                    { label: 'Max Drawdown',  value: `${iMinDD.toFixed(1)}%`,                                                      color: C.red },
                    { label: 'Total Trades',  value: selectedInstr.trades.toLocaleString(),                                       color: C.text },
                    { label: 'Avg W / Avg L', value: `${selectedInstr.avgWin.toFixed(2)} / ${selectedInstr.avgLoss.toFixed(2)}`, color: C.dimText },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: C.bg, padding: '14px 16px' }}>
                      <Label text={label} />
                      <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 26, color, lineHeight: 1 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div style={{ background: C.surface }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText }}>
                      EQUITY CURVE · {selectedInstr.trades} TRADES · {selectedInstr.tf}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted }}>Datos sintéticos — pendiente de datos reales</span>
                  </div>
                  <ModelChart labels={ilabels} equity={idata.curve} dd={idata.dd} color={selectedInstr.color} modelName={selectedInstr.ticker} />
                </div>

                {/* Descripción */}
                <div style={{ padding: '18px 20px', borderTop: `1px solid ${C.border}` }}>
                  <Label text="Descripción del instrumento" />
                  <p style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, lineHeight: 1.8, marginTop: 6, maxWidth: 800 }}>
                    {selectedInstr.desc}
                  </p>
                </div>
              </div>
            )
          })()}

          {/* ── Tablas por trader ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {TRADERS.map(trader => (
              <div key={trader.id} style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div style={{ padding: '11px 20px', borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${trader.color}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, color: trader.color, letterSpacing: 1 }}>{trader.name}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>{trader.focus}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, marginLeft: 'auto' }}>{trader.session}</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: C.bg }}>
                        {['#', 'Ticker', 'Mercado', 'Sesión', 'TF', 'Win Rate', 'Sharpe', 'Estado'].map(h => (
                          <th key={h} style={{ padding: '7px 14px', textAlign: 'left', fontSize: 9, color: C.muted, fontFamily: 'monospace', letterSpacing: '0.15em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trader.instruments.map((inst, i) => {
                        const isSelected = selectedInstr?.n === inst.n
                        return (
                          <tr
                            key={inst.n}
                            onClick={() => setSelectedInstr(isSelected ? null : inst)}
                            style={{
                              borderBottom: `1px solid ${C.border}20`,
                              background: isSelected ? `${inst.color}18` : i % 2 === 0 ? 'transparent' : `${C.bg}80`,
                              cursor: 'pointer',
                              transition: 'background 0.15s',
                              borderLeft: isSelected ? `3px solid ${inst.color}` : '3px solid transparent',
                            }}
                            onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = `${trader.color}10` }}
                            onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? 'transparent' : `${C.bg}80` }}
                          >
                            <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: C.muted }}>{String(inst.n).padStart(2, '0')}</td>
                            <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 13, color: isSelected ? inst.color : C.text, fontWeight: 700 }}>{inst.ticker}</td>
                            <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{inst.market}</td>
                            <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{inst.session}</td>
                            <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: C.gold }}>{inst.tf}</td>
                            <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: inst.winRate >= 0.58 ? C.green : C.yellow }}>{(inst.winRate * 100).toFixed(1)}%</td>
                            <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: inst.sharpe >= 1.5 ? C.green : C.gold }}>{inst.sharpe.toFixed(2)}</td>
                            <td style={{ padding: '9px 14px' }}>
                              {inst.status === 'live'
                                ? <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 3, padding: '2px 8px', whiteSpace: 'nowrap' }}>MODEL K1 ✓</span>
                                : <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted, background: `${C.border}60`, borderRadius: 3, padding: '2px 8px' }}>Pendiente</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
