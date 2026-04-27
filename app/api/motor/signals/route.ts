export const revalidate = 300  // C: cache 5 min — antes era 0 (sin cache)

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import { processAsset, applyCrossSection, computeFlowSignals, computeFlowScore } from '@/lib/signalEngine'
import { computeAllocation, computeMetrics }                  from '@/lib/allocator'
import type { ProfileType, Profile, SignalsResponse }          from '@/types/decision-engine'

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

// ─── A: Crypto con datos reales de Binance ────────────────────────────────────
const CRYPTO_TICKERS = [
  { id: 'btc', name: 'Bitcoin',  ticker: 'BTC', symbol: 'BTCUSDT' },
  { id: 'eth', name: 'Ethereum', ticker: 'ETH', symbol: 'ETHUSDT' },
  { id: 'sol', name: 'Solana',   ticker: 'SOL', symbol: 'SOLUSDT' },
  { id: 'bnb', name: 'BNB',      ticker: 'BNB', symbol: 'BNBUSDT' },
]

async function fetchBinanceReturns(symbol: string): Promise<{ r1m: number; r3m: number; r1y: number }> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=365`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return { r1m: 0, r3m: 0, r1y: 0 }
    const data: [number, string, string, string, string, ...unknown[]][] = await res.json()
    if (data.length < 30) return { r1m: 0, r3m: 0, r1y: 0 }
    const closes = data.map(k => parseFloat(k[4]))
    const cur = closes[closes.length - 1]
    const p30  = closes[Math.max(0, closes.length - 30)]
    const p90  = closes[Math.max(0, closes.length - 90)]
    const p365 = closes[0]
    return {
      r1m: p30  > 0 ? ((cur - p30)  / p30)  * 100 : 0,
      r3m: p90  > 0 ? ((cur - p90)  / p90)  * 100 : 0,
      r1y: p365 > 0 ? ((cur - p365) / p365) * 100 : 0,
    }
  } catch {
    return { r1m: 0, r3m: 0, r1y: 0 }
  }
}

// ─── B: Renta fija con datos reales de Yahoo Finance ─────────────────────────
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
}

async function fetchYahooReturns(ticker: string): Promise<{ r1m: number; r3m: number; r1y: number }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1y&interval=1d`
    const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 300 } })
    if (!res.ok) return { r1m: 0, r3m: 0, r1y: 0 }
    const json = await res.json()
    const raw: (number | null)[] = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
    const closes = raw.filter((c): c is number => c != null && !isNaN(c))
    if (closes.length < 30) return { r1m: 0, r3m: 0, r1y: 0 }
    const cur  = closes[closes.length - 1]
    const p30  = closes[Math.max(0, closes.length - 22)]   // ~1 mes bursátil
    const p90  = closes[Math.max(0, closes.length - 63)]   // ~3 meses bursátiles
    const p365 = closes[0]
    return {
      r1m: p30  > 0 ? ((cur - p30)  / p30)  * 100 : 0,
      r3m: p90  > 0 ? ((cur - p90)  / p90)  * 100 : 0,
      r1y: p365 > 0 ? ((cur - p365) / p365) * 100 : 0,
    }
  } catch {
    return { r1m: 0, r3m: 0, r1y: 0 }
  }
}

// ─── C: ETFs globales — 45 tickers cubiertos por Yahoo Finance ───────────────
// Doble función: (1) refrescar retornos de ETFs ya en Supabase con datos live,
// (2) agregar como nuevos activos los que Supabase no tenga.
const EXTRA_ETFS = [
  // Core USA
  { id: 'spy',  name: 'S&P 500 ETF',              ticker: 'SPY',  category: 'Renta Variable USA'   },
  { id: 'qqq',  name: 'Nasdaq 100 ETF',            ticker: 'QQQ',  category: 'Tecnología USA'        },
  { id: 'vti',  name: 'Mercado Total USA',          ticker: 'VTI',  category: 'Renta Variable USA'   },
  { id: 'dia',  name: 'Dow Jones ETF',              ticker: 'DIA',  category: 'Renta Variable USA'   },
  { id: 'iwm',  name: 'Russell 2000 ETF',           ticker: 'IWM',  category: 'Small Cap USA'         },
  // Internacional
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
  // Sectores USA
  { id: 'xlk',  name: 'Tecnología S&P ETF',        ticker: 'XLK',  category: 'Sector Tecnología'     },
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
  { id: 'vnq',  name: 'Real Estate USA ETF',        ticker: 'VNQ',  category: 'Real Estate'           },
  // Temáticos
  { id: 'arkk', name: 'ARK Innovation ETF',         ticker: 'ARKK', category: 'Innovación'            },
  { id: 'botz', name: 'Robótica e IA ETF',          ticker: 'BOTZ', category: 'Robótica / IA'         },
  { id: 'lit',  name: 'Litio y Baterías ETF',       ticker: 'LIT',  category: 'Energía Limpia'        },
  { id: 'icln', name: 'Energía Limpia ETF',         ticker: 'ICLN', category: 'Energía Limpia'        },
  { id: 'cibr', name: 'Ciberseguridad ETF',         ticker: 'CIBR', category: 'Ciberseguridad'        },
  { id: 'driv', name: 'Vehículos Eléctricos ETF',   ticker: 'DRIV', category: 'EVs'                   },
  { id: 'clou', name: 'Cloud Computing ETF',        ticker: 'CLOU', category: 'Cloud'                 },
  // Factor
  { id: 'qual', name: 'Calidad MSCI USA ETF',       ticker: 'QUAL', category: 'Factor Calidad'        },
  { id: 'mtum', name: 'Momentum MSCI USA ETF',      ticker: 'MTUM', category: 'Factor Momentum'       },
  { id: 'usmv', name: 'Min Volatilidad USA ETF',    ticker: 'USMV', category: 'Factor Baja Vol'       },
  { id: 'vtv',  name: 'Valor Vanguard ETF',         ticker: 'VTV',  category: 'Factor Valor'          },
  { id: 'vug',  name: 'Crecimiento Vanguard ETF',   ticker: 'VUG',  category: 'Factor Crecimiento'    },
  // Commodities
  { id: 'gld',  name: 'Oro SPDR ETF',               ticker: 'GLD',  category: 'Commodities'           },
  { id: 'slv',  name: 'Plata iShares ETF',          ticker: 'SLV',  category: 'Commodities'           },
]

// Instrumentos de renta fija: TLT + LQD vía Yahoo; BTP y PDBC con fallback estático
const RF_BASE = [
  { id: 'tbond-10y', name: 'T-Bond USA 10 años',   ticker: 'TLT',  yahooTicker: 'TLT',  r1m: 0.8,  r3m: -1.4, r1y: 4.4 },
  { id: 'corp-ig',   name: 'Corporativo IG Global', ticker: 'LQD',  yahooTicker: 'LQD',  r1m: 0.5,  r3m:  1.6, r1y: 6.1 },
  { id: 'btp-5y',    name: 'BTP Chile 5 años',      ticker: 'BTP5', yahooTicker: null,   r1m: 0.4,  r3m:  1.2, r1y: 5.2 },
  { id: 'bcch-pdr',  name: 'Pagaré BCCh 90d',       ticker: 'PDBC', yahooTicker: null,   r1m: 0.38, r3m:  1.1, r1y: 4.6 },
]

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const profileType = (searchParams.get('profile') ?? 'retail') as ProfileType
  const profile     = PROFILES[profileType] ?? PROFILES.retail

  const db = sb()

  // Fondos, ETFs, crypto y RF en paralelo
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
      .limit(40),
    // A: fetch crypto returns live from Binance
    ...CRYPTO_TICKERS.map(c => fetchBinanceReturns(c.symbol)),
  ])

  // B: fetch RF + TODOS los EXTRA_ETFS desde Yahoo en paralelo
  // Se usan para: (1) refrescar retornos de ETFs ya en Supabase, (2) agregar los nuevos
  const [rfReturns, allExtraReturns] = await Promise.all([
    Promise.all(RF_BASE.map(r => r.yahooTicker ? fetchYahooReturns(r.yahooTicker) : Promise.resolve(null))),
    Promise.all(EXTRA_ETFS.map(e => fetchYahooReturns(e.ticker))),
  ])

  // Mapa ticker → retornos Yahoo (solo si el fetch devolvió datos reales)
  const yahooMap = new Map<string, { r1m: number; r3m: number; r1y: number }>()
  EXTRA_ETFS.forEach((e, i) => {
    const ret = allExtraReturns[i]
    if (ret.r1m !== 0 || ret.r3m !== 0 || ret.r1y !== 0) yahooMap.set(e.ticker.toUpperCase(), ret)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFondos = (fondosRes.data ?? []).map((f: any) => ({
    id: f.id, name: f.nombre, assetClass: 'fondos' as const,
    category: f.categoria ?? 'General',
    r1m: Number(f.rent_1m  ?? 0),
    r3m: Number(f.rent_3m  ?? 0),
    r1y: Number(f.rent_12m ?? 0),
  }))

  // ETFs de Supabase, con retornos refreshados desde Yahoo si están disponibles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawEtfs = (etfsRes.data ?? []).map((e: any) => {
    const live = yahooMap.get((e.ticker ?? '').toUpperCase())
    return {
      id: e.ticker, name: e.nombre, ticker: e.ticker, assetClass: 'etfs' as const,
      category: e.exposicion ?? e.sector ?? 'Global',
      r1m: live ? live.r1m : Number(e.rent_1m  ?? 0),
      r3m: live ? live.r3m : Number(e.rent_3m  ?? 0),
      r1y: live ? live.r1y : Number(e.rent_12m ?? 0),
    }
  })

  // Merge Binance live data into crypto (fallback to 0 if fetch failed)
  const rawCrypto = CRYPTO_TICKERS.map((c, i) => {
    const live = cryptoResults[i] as { r1m: number; r3m: number; r1y: number }
    const hasLive = live.r1m !== 0 || live.r3m !== 0 || live.r1y !== 0
    return {
      id: c.id, name: c.name, ticker: c.ticker, assetClass: 'crypto' as const,
      r1m: hasLive ? live.r1m : 0,
      r3m: hasLive ? live.r3m : 0,
      r1y: hasLive ? live.r1y : 0,
    }
  })

  // Merge Yahoo live data into RF (use live if available, else fallback)
  const rawRF = RF_BASE.map((r, i) => {
    const live = rfReturns[i]
    const hasLive = live && (live.r1m !== 0 || live.r3m !== 0 || live.r1y !== 0)
    return {
      id: r.id, name: r.name, ticker: r.ticker, assetClass: 'renta_fija' as const,
      r1m: hasLive ? live!.r1m : r.r1m,
      r3m: hasLive ? live!.r3m : r.r3m,
      r1y: hasLive ? live!.r1y : r.r1y,
    }
  })

  // ETFs extra: solo los que NO están en Supabase, con datos Yahoo
  const supabaseTickers = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (etfsRes.data ?? []).map((e: any) => (e.ticker ?? '').toUpperCase()).filter(Boolean)
  )
  const rawExtraEtfs = EXTRA_ETFS
    .filter(e => !supabaseTickers.has(e.ticker.toUpperCase()))
    .map(e => {
      const ret = yahooMap.get(e.ticker.toUpperCase())
      if (!ret) return null
      return { id: e.id, name: e.name, ticker: e.ticker, assetClass: 'etfs' as const, category: e.category, ...ret }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)

  const allAssets = applyCrossSection(
    [...rawFondos, ...rawEtfs, ...rawExtraEtfs, ...rawCrypto, ...rawRF].map(processAsset)
  )

  const allocation  = computeAllocation(allAssets, profile)
  const metrics     = computeMetrics(allocation, allAssets)
  const flowSignals = computeFlowSignals(allAssets)
  const flowScore   = computeFlowScore(allAssets)

  const body: SignalsResponse = {
    ok: true, profile, signals: allAssets,
    allocation, metrics, flowSignals, flowScore,
    totalAssets: allAssets.length,
    buyCount:    allAssets.filter(a => a.signal === 'comprar').length,
    sellCount:   allAssets.filter(a => a.signal === 'reducir').length,
    holdCount:   allAssets.filter(a => a.signal === 'mantener' || a.signal === 'neutral').length,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(body)
}
