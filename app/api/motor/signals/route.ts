export const revalidate = 300

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import {
  processAsset, applyCrossSection, applyCorrelationPenalty,
  computeFlowSignals, computeFlowScore, detectMarketRegime,
} from '@/lib/signalEngine'
import { computeAllocation, computeMetrics, applyProfileSizing } from '@/lib/allocator'
import type { ProfileType, Profile, SignalsResponse, Asset, SignalType, MarketRegime } from '@/types/decision-engine'

// ─── Perfiles ─────────────────────────────────────────────────────────────────
const PROFILES: Record<ProfileType, Profile> = {
  retail: {
    type: 'retail', label: 'Retail',
    maxCrypto: 5, maxEquity: 70, minFixedIncome: 20,
    riskTolerance: 35, benchmarkReturn: 6,
    description: 'Perfil conservador con énfasis en preservación del capital.',
    horizonte: 'largo plazo (3-5 años)',
  },
  trader: {
    type: 'trader', label: 'Trader Activo',
    maxCrypto: 30, maxEquity: 90, minFixedIncome: 5,
    riskTolerance: 75, benchmarkReturn: 15,
    description: 'Perfil agresivo con tolerancia a alta volatilidad y rotación activa.',
    horizonte: 'corto-medio plazo (3-12 meses)',
  },
  institucional: {
    type: 'institucional', label: 'Institucional',
    maxCrypto: 10, maxEquity: 60, minFixedIncome: 30,
    riskTolerance: 50, benchmarkReturn: 8,
    description: 'Perfil equilibrado con enfoque en rentabilidad ajustada al riesgo.',
    horizonte: 'medio plazo (1-3 años)',
  },
}

// ─── Crypto desde Binance ─────────────────────────────────────────────────────
const CRYPTO_TICKERS = [
  { id: 'btc', name: 'Bitcoin',  ticker: 'BTC', symbol: 'BTCUSDT' },
  { id: 'eth', name: 'Ethereum', ticker: 'ETH', symbol: 'ETHUSDT' },
  { id: 'sol', name: 'Solana',   ticker: 'SOL', symbol: 'SOLUSDT' },
  { id: 'bnb', name: 'BNB',      ticker: 'BNB', symbol: 'BNBUSDT' },
]

async function fetchBinanceReturns(symbol: string): Promise<{ r1m: number; r3m: number; r1y: number; price: number }> {
  const EMPTY = { r1m: 0, r3m: 0, r1y: 0, price: 0 }
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=365`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return EMPTY
    const data: [number, string, string, string, string, ...unknown[]][] = await res.json()
    if (data.length < 30) return EMPTY
    const closes = data.map(k => parseFloat(k[4]))
    const cur    = closes[closes.length - 1]
    const p30    = closes[Math.max(0, closes.length - 30)]
    const p90    = closes[Math.max(0, closes.length - 90)]
    const p365   = closes[0]
    return {
      r1m:   p30  > 0 ? ((cur - p30)  / p30)  * 100 : 0,
      r3m:   p90  > 0 ? ((cur - p90)  / p90)  * 100 : 0,
      r1y:   p365 > 0 ? ((cur - p365) / p365) * 100 : 0,
      price: cur,
    }
  } catch {
    return EMPTY
  }
}

// ─── Yahoo Finance: retornos + últimos 28 cierres para RSI real ───────────────
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
}

interface YahooData {
  r1m: number; r3m: number; r1y: number
  closes28: number[]   // últimos 28 cierres diarios → RSI Wilder real
}

// ─── Dividend yields en batch (una sola llamada para todos los tickers) ────────
// Yahoo Finance v7 quote acepta múltiples símbolos → muy eficiente.
// Retorna Map<TICKER_UPPER, yield%> p.ej. 'SPY' → 1.3 (= 1.3% anual)
async function fetchDividendYields(tickers: string[]): Promise<Map<string, number>> {
  try {
    const symbols = tickers.slice(0, 120).join(',')
    const url     = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`
    const res     = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 3600 } })
    if (!res.ok) return new Map()
    const json   = await res.json()
    const result = new Map<string, number>()
    for (const q of json?.quoteResponse?.result ?? []) {
      const y = q.trailingAnnualDividendYield as number | undefined
      if (y && y > 0) result.set((q.symbol as string).toUpperCase(), Math.round(y * 1000) / 10)
    }
    return result
  } catch {
    return new Map()
  }
}

async function fetchYahooData(ticker: string): Promise<YahooData> {
  const EMPTY: YahooData = { r1m: 0, r3m: 0, r1y: 0, closes28: [] }
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1y&interval=1d`
    const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 300 } })
    if (!res.ok) return EMPTY
    const json = await res.json()
    const raw: (number | null)[] = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
    const closes = raw.filter((c): c is number => c != null && !isNaN(c))
    if (closes.length < 30) return EMPTY
    const cur  = closes[closes.length - 1]
    const p30  = closes[Math.max(0, closes.length - 22)]
    const p90  = closes[Math.max(0, closes.length - 63)]
    const p365 = closes[0]
    return {
      r1m:     p30  > 0 ? ((cur - p30)  / p30)  * 100 : 0,
      r3m:     p90  > 0 ? ((cur - p90)  / p90)  * 100 : 0,
      r1y:     p365 > 0 ? ((cur - p365) / p365) * 100 : 0,
      closes28: closes.slice(-28),
    }
  } catch {
    return EMPTY
  }
}

// ─── ETFs globales cubiertos por Yahoo Finance ────────────────────────────────
const EXTRA_ETFS = [
  { id: 'spy',  name: 'S&P 500 ETF',              ticker: 'SPY',  category: 'Renta Variable USA'   },
  { id: 'qqq',  name: 'Nasdaq 100 ETF',            ticker: 'QQQ',  category: 'Tecnología USA'        },
  { id: 'vti',  name: 'Mercado Total USA',          ticker: 'VTI',  category: 'Renta Variable USA'   },
  { id: 'dia',  name: 'Dow Jones ETF',              ticker: 'DIA',  category: 'Renta Variable USA'   },
  { id: 'iwm',  name: 'Russell 2000 ETF',           ticker: 'IWM',  category: 'Small Cap USA'         },
  { id: 'vea',  name: 'Mercados Desarrollados',     ticker: 'VEA',  category: 'Internacional'         },
  { id: 'vwo',  name: 'Mercados Emergentes VWO',    ticker: 'VWO',  category: 'Emergentes'            },
  { id: 'vgk',  name: 'Europa ETF Vanguard',        ticker: 'VGK',  category: 'Europa'                },
  { id: 'ewj',  name: 'Japón ETF iShares',          ticker: 'EWJ',  category: 'Asia Desarrollada'     },
  { id: 'ewz',  name: 'Brasil ETF iShares',         ticker: 'EWZ',  category: 'Latinoamérica'         },
  { id: 'fxi',  name: 'China Large Cap ETF',        ticker: 'FXI',  category: 'China'                 },
  { id: 'inda', name: 'India ETF iShares',          ticker: 'INDA', category: 'India'                 },
  { id: 'ewt',  name: 'Taiwán ETF iShares',         ticker: 'EWT',  category: 'Asia'                  },
  { id: 'ewy',  name: 'Corea ETF iShares',          ticker: 'EWY',  category: 'Asia'                  },
  { id: 'ewg',  name: 'Alemania ETF iShares',       ticker: 'EWG',  category: 'Europa'                },
  { id: 'ewa',  name: 'Australia ETF iShares',      ticker: 'EWA',  category: 'Asia Pac'              },
  { id: 'ilt',  name: 'Latinoamérica ETF',          ticker: 'ILF',  category: 'Latinoamérica'         },
  { id: 'xlk',  name: 'Tecnología S&P ETF',         ticker: 'XLK',  category: 'Sector Tecnología'     },
  { id: 'xle',  name: 'Energía S&P ETF',            ticker: 'XLE',  category: 'Sector Energía'        },
  { id: 'xlv',  name: 'Salud S&P ETF',              ticker: 'XLV',  category: 'Sector Salud'          },
  { id: 'xlf',  name: 'Finanzas S&P ETF',           ticker: 'XLF',  category: 'Sector Finanzas'       },
  { id: 'xli',  name: 'Industriales S&P ETF',       ticker: 'XLI',  category: 'Sector Industrial'     },
  { id: 'xlb',  name: 'Materiales S&P ETF',         ticker: 'XLB',  category: 'Sector Materiales'     },
  { id: 'xlp',  name: 'Consumo Básico S&P ETF',     ticker: 'XLP',  category: 'Sector Consumo Básico' },
  { id: 'xly',  name: 'Consumo Disc. S&P ETF',      ticker: 'XLY',  category: 'Sector Consumo'        },
  { id: 'xlc',  name: 'Comunicaciones S&P ETF',     ticker: 'XLC',  category: 'Sector Comm.'          },
  { id: 'xlre', name: 'Real Estate S&P ETF',        ticker: 'XLRE', category: 'Real Estate'           },
  { id: 'xlu',  name: 'Utilities S&P ETF',          ticker: 'XLU',  category: 'Sector Utilities'      },
  { id: 'soxx', name: 'Semiconductores ETF',         ticker: 'SOXX', category: 'Semicond.'             },
  { id: 'vnq',  name: 'Real Estate USA ETF',         ticker: 'VNQ',  category: 'Real Estate'           },
  { id: 'arkk', name: 'ARK Innovation ETF',          ticker: 'ARKK', category: 'Innovación'            },
  { id: 'botz', name: 'Robótica e IA ETF',           ticker: 'BOTZ', category: 'Robótica / IA'         },
  { id: 'lit',  name: 'Litio y Baterías ETF',        ticker: 'LIT',  category: 'Energía Limpia'        },
  { id: 'icln', name: 'Energía Limpia ETF',          ticker: 'ICLN', category: 'Energía Limpia'        },
  { id: 'cibr', name: 'Ciberseguridad ETF',          ticker: 'CIBR', category: 'Ciberseguridad'        },
  { id: 'driv', name: 'Vehículos Eléctricos ETF',    ticker: 'DRIV', category: 'EVs'                   },
  { id: 'clou', name: 'Cloud Computing ETF',         ticker: 'CLOU', category: 'Cloud'                 },
  { id: 'qual', name: 'Calidad MSCI USA ETF',        ticker: 'QUAL', category: 'Factor Calidad'        },
  { id: 'mtum', name: 'Momentum MSCI USA ETF',       ticker: 'MTUM', category: 'Factor Momentum'       },
  { id: 'usmv', name: 'Min Volatilidad USA ETF',     ticker: 'USMV', category: 'Factor Baja Vol'       },
  { id: 'vtv',  name: 'Valor Vanguard ETF',          ticker: 'VTV',  category: 'Factor Valor'          },
  { id: 'vug',  name: 'Crecimiento Vanguard ETF',    ticker: 'VUG',  category: 'Factor Crecimiento'    },
  { id: 'gld',  name: 'Oro SPDR ETF',                ticker: 'GLD',  category: 'Commodities'           },
  { id: 'slv',  name: 'Plata iShares ETF',           ticker: 'SLV',  category: 'Commodities'           },
]

const RF_BASE = [
  { id: 'tbond-10y', name: 'T-Bond USA 10 años',    ticker: 'TLT',  yahooTicker: 'TLT',  r1m: 0.8,  r3m: -1.4, r1y: 4.4 },
  { id: 'corp-ig',   name: 'Corporativo IG Global',  ticker: 'LQD',  yahooTicker: 'LQD',  r1m: 0.5,  r3m:  1.6, r1y: 6.1 },
  { id: 'btp-5y',    name: 'BTP Chile 5 años',       ticker: 'BTP5', yahooTicker: null,   r1m: 0.4,  r3m:  1.2, r1y: 5.2 },
  { id: 'bcch-pdr',  name: 'Pagaré BCCh 90d',        ticker: 'PDBC', yahooTicker: null,   r1m: 0.38, r3m:  1.1, r1y: 4.6 },
]

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// ─── Guardar historial de señales con contexto completo ───────────────────────
// Incluye price_at_signal, conditions_met y regime para el ciclo de retroalimentación:
// 22+ días después /api/motor/accuracy mide si la señal acertó.
async function saveSignalHistory(
  assets:      Asset[],
  profileType: ProfileType,
  regime:      string,
  db:          ReturnType<typeof sb>,
) {
  try {
    const rows = assets
      .filter(a => a.signal === 'comprar' || a.signal === 'reducir')
      .map(a => ({
        ticker:           a.ticker ?? a.id,
        name:             a.name,
        asset_class:      a.assetClass,
        signal:           a.signal,
        score:            a.score,
        r1m:              a.return30d,
        r1y:              a.return1y,
        profile:          profileType,
        generated_at:     new Date().toISOString(),
        price_at_signal:  a.priceAtSignal ?? null,
        conditions_met:   a.conditionsMet,
        conditions_total: a.conditionsTotal,
        regime,
      }))
    if (rows.length) await db.from('signal_history').insert(rows)
  } catch {
    // no-op: historial es opcional, no debe romper la respuesta principal
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const profileType = (searchParams.get('profile') ?? 'retail') as ProfileType
  const profile     = PROFILES[profileType] ?? PROFILES.retail
  const db          = sb()

  const [fondosRes, etfsRes, ...cryptoResults] = await Promise.all([
    db.from('fondos_mutuos')
      .select('id, nombre, categoria, rent_1m, rent_3m, rent_12m')
      .eq('activo', true)
      .not('rent_12m', 'is', null)
      .order('rent_12m', { ascending: false })
      .limit(80),
    db.from('etfs')
      .select('ticker, nombre, exposicion, sector, rent_1m, rent_3m, rent_12m')
      .not('rent_12m', 'is', null)
      .order('rent_12m', { ascending: false })
      .limit(200),
    ...CRYPTO_TICKERS.map(c => fetchBinanceReturns(c.symbol)),
  ])

  // Yahoo: RF + ETFs extra (retornos + closes28) + dividend yields en batch
  const allYahooTickers = [
    ...EXTRA_ETFS.map(e => e.ticker),
    ...RF_BASE.filter(r => r.yahooTicker).map(r => r.yahooTicker!),
  ]
  const [rfData, allExtraData, dividendYields] = await Promise.all([
    Promise.all(RF_BASE.map(r => r.yahooTicker ? fetchYahooData(r.yahooTicker) : Promise.resolve(null))),
    Promise.all(EXTRA_ETFS.map(e => fetchYahooData(e.ticker))),
    fetchDividendYields(allYahooTickers),
  ])

  // ─── Régimen de mercado ───────────────────────────────────────────────────
  // SPY = índice 0 en EXTRA_ETFS; TLT = índice 0 en RF_BASE (yahooTicker: 'TLT')
  const spyData = allExtraData[0]
  const tltData = rfData[0]
  const regime: MarketRegime = detectMarketRegime(
    spyData?.closes28 ?? [],
    spyData?.r1m ?? 0,
    tltData?.r1m ?? 0,
  )

  // ─── Señales previas (últimos 7 días) para detectar cambios ──────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: prevRows } = await db
    .from('signal_history')
    .select('ticker, signal')
    .gte('generated_at', sevenDaysAgo)
    .order('generated_at', { ascending: false })
  const prevSignalMap = new Map<string, SignalType>()
  for (const row of (prevRows ?? [])) {
    if (!prevSignalMap.has(row.ticker)) {
      prevSignalMap.set(row.ticker, row.signal as SignalType)
    }
  }

  // Mapa ticker → YahooData (solo si hay datos reales)
  const yahooMap = new Map<string, YahooData>()
  EXTRA_ETFS.forEach((e, i) => {
    const d = allExtraData[i]
    if (d.r1m !== 0 || d.r3m !== 0 || d.r1y !== 0) yahooMap.set(e.ticker.toUpperCase(), d)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFondos = (fondosRes.data ?? []).map((f: any) => ({
    id: f.id, name: f.nombre, assetClass: 'fondos' as const,
    category: f.categoria ?? 'General',
    r1m: Number(f.rent_1m  ?? 0),
    r3m: Number(f.rent_3m  ?? 0),
    r1y: Number(f.rent_12m ?? 0),
    // fondos no tienen precio diario disponible → RSI simulado
  }))

  // ETFs Supabase con retornos frescos de Yahoo y closes28 para RSI real
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawEtfs = (etfsRes.data ?? []).map((e: any) => {
    const tk   = (e.ticker ?? '').toUpperCase()
    const live = yahooMap.get(tk)
    return {
      id: e.ticker, name: e.nombre, ticker: e.ticker, assetClass: 'etfs' as const,
      category: e.exposicion ?? e.sector ?? 'Global',
      r1m:           live ? live.r1m      : Number(e.rent_1m  ?? 0),
      r3m:           live ? live.r3m      : Number(e.rent_3m  ?? 0),
      r1y:           live ? live.r1y      : Number(e.rent_12m ?? 0),
      closes28:      live ? live.closes28 : undefined,
      dividendYield: dividendYields.get(tk),
    }
  })

  const rawCrypto = CRYPTO_TICKERS.map((c, i) => {
    const live = cryptoResults[i] as { r1m: number; r3m: number; r1y: number; price: number }
    return {
      id: c.id, name: c.name, ticker: c.ticker, assetClass: 'crypto' as const,
      r1m: live.r1m, r3m: live.r3m, r1y: live.r1y,
      priceAtSignal: live.price > 0 ? live.price : undefined,
    }
  })

  const rawRF = RF_BASE.map((r, i) => {
    const live = rfData[i]
    const has  = live && (live.r1m !== 0 || live.r3m !== 0 || live.r1y !== 0)
    return {
      id: r.id, name: r.name, ticker: r.ticker, assetClass: 'renta_fija' as const,
      r1m:           has ? live!.r1m      : r.r1m,
      r3m:           has ? live!.r3m      : r.r3m,
      r1y:           has ? live!.r1y      : r.r1y,
      closes28:      has ? live!.closes28 : undefined,
      dividendYield: r.ticker ? dividendYields.get(r.ticker.toUpperCase()) : undefined,
    }
  })

  const supabaseTickers = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (etfsRes.data ?? []).map((e: any) => (e.ticker ?? '').toUpperCase()).filter(Boolean)
  )
  const rawExtraEtfs = EXTRA_ETFS
    .filter(e => !supabaseTickers.has(e.ticker.toUpperCase()))
    .map(e => {
      const d = yahooMap.get(e.ticker.toUpperCase())
      if (!d) return null
      return {
        id: e.id, name: e.name, ticker: e.ticker, assetClass: 'etfs' as const,
        category: e.category, r1m: d.r1m, r3m: d.r3m, r1y: d.r1y, closes28: d.closes28,
        dividendYield: dividendYields.get(e.ticker.toUpperCase()),
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)

  // Pipeline: procesar (con régimen) → cross-section → penalización correlación
  const pipeline = applyCorrelationPenalty(
    applyCrossSection(
      [...rawFondos, ...rawEtfs, ...rawExtraEtfs, ...rawCrypto, ...rawRF]
        .map(raw => processAsset(raw, regime))
    )
  )

  // Marcar activos cuya señal cambió + aplicar sizing ajustado por perfil
  const allAssets: Asset[] = pipeline.map(a => {
    const tk      = a.ticker ?? a.id
    const prev    = prevSignalMap.get(tk)
    const changed = prev && prev !== a.signal
      ? { signalChanged: true as const, prevSignal: prev }
      : {}
    return applyProfileSizing({ ...a, ...changed }, profile)
  })

  const allocation  = computeAllocation(allAssets, profile)
  const metrics     = computeMetrics(allocation, allAssets)
  const flowSignals = computeFlowSignals(allAssets)
  const flowScore   = computeFlowScore(allAssets)

  // Guardar señales BUY/SELL en historial con contexto completo (async, no bloquea)
  saveSignalHistory(allAssets, profileType, regime, db)

  const REGIME_LABELS: Record<MarketRegime, string> = {
    'risk-on':  'Risk-On',
    'risk-off': 'Risk-Off',
    'neutral':  'Neutral',
  }

  const body: SignalsResponse = {
    ok: true, profile, signals: allAssets,
    allocation, metrics, flowSignals, flowScore,
    totalAssets: allAssets.length,
    buyCount:    allAssets.filter(a => a.signal === 'comprar').length,
    sellCount:   allAssets.filter(a => a.signal === 'reducir').length,
    holdCount:   allAssets.filter(a => a.signal === 'mantener' || a.signal === 'neutral').length,
    generatedAt: new Date().toISOString(),
    regime,
    regimeLabel: REGIME_LABELS[regime],
  }

  return NextResponse.json(body)
}
