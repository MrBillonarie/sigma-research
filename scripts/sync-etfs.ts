/**
 * Sync ETFs internacionales → Supabase
 * Precios e historial: Yahoo Finance v8/chart (público, sin auth)
 * Datos estáticos (AUM, expense ratio, yield): hardcodeados — rara vez cambian
 * Uso: npx tsx scripts/sync-etfs.ts
 */

import { loadEnvConfig } from '@next/env'
import { createClient }  from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const now   = () => new Date().toLocaleTimeString('es-CL')

// ─── Lista curada con datos estáticos ─────────────────────────────────────────
// expense_ratio en %, aum en USD, dividend_yield en %
const ETF_LIST = [
  // ── Mercado amplio USA ──────────────────────────────────────────────────────
  { ticker: 'VTI',  nombre: 'Vanguard Total Stock Market ETF',          indice: 'CRSP US Total Market',              exposicion: 'USA',           sector: null,             expense_ratio: 0.03,  aum: 450e9,  dividend_yield: 1.30 },
  { ticker: 'VOO',  nombre: 'Vanguard S&P 500 ETF',                     indice: 'S&P 500',                           exposicion: 'USA',           sector: null,             expense_ratio: 0.03,  aum: 580e9,  dividend_yield: 1.30 },
  { ticker: 'SPY',  nombre: 'SPDR S&P 500 ETF Trust',                   indice: 'S&P 500',                           exposicion: 'USA',           sector: null,             expense_ratio: 0.09,  aum: 600e9,  dividend_yield: 1.25 },
  { ticker: 'IVV',  nombre: 'iShares Core S&P 500 ETF',                 indice: 'S&P 500',                           exposicion: 'USA',           sector: null,             expense_ratio: 0.03,  aum: 560e9,  dividend_yield: 1.25 },
  { ticker: 'QQQ',  nombre: 'Invesco QQQ Trust',                        indice: 'NASDAQ-100',                        exposicion: 'USA',           sector: 'Tecnología',     expense_ratio: 0.20,  aum: 310e9,  dividend_yield: 0.60 },
  { ticker: 'IWM',  nombre: 'iShares Russell 2000 ETF',                 indice: 'Russell 2000',                      exposicion: 'USA',           sector: null,             expense_ratio: 0.19,  aum: 55e9,   dividend_yield: 1.20 },
  // ── Internacional / Global ──────────────────────────────────────────────────
  { ticker: 'VEA',  nombre: 'Vanguard FTSE Developed Markets ETF',      indice: 'FTSE Developed ex US',              exposicion: 'Global ex USA', sector: null,             expense_ratio: 0.05,  aum: 120e9,  dividend_yield: 3.20 },
  { ticker: 'VWO',  nombre: 'Vanguard FTSE Emerging Markets ETF',       indice: 'FTSE Emerging Markets',             exposicion: 'Emergentes',    sector: null,             expense_ratio: 0.08,  aum: 80e9,   dividend_yield: 3.00 },
  { ticker: 'VXUS', nombre: 'Vanguard Total International Stock ETF',   indice: 'FTSE Global ex US',                 exposicion: 'Global ex USA', sector: null,             expense_ratio: 0.07,  aum: 80e9,   dividend_yield: 3.10 },
  { ticker: 'EEM',  nombre: 'iShares MSCI Emerging Markets ETF',        indice: 'MSCI Emerging Markets',             exposicion: 'Emergentes',    sector: null,             expense_ratio: 0.70,  aum: 20e9,   dividend_yield: 2.50 },
  { ticker: 'ACWI', nombre: 'iShares MSCI ACWI ETF',                    indice: 'MSCI ACWI',                         exposicion: 'Global',        sector: null,             expense_ratio: 0.32,  aum: 20e9,   dividend_yield: 1.80 },
  { ticker: 'VT',   nombre: 'Vanguard Total World Stock ETF',           indice: 'FTSE Global All Cap',               exposicion: 'Global',        sector: null,             expense_ratio: 0.07,  aum: 45e9,   dividend_yield: 2.00 },
  // ── Latinoamérica / Chile ───────────────────────────────────────────────────
  { ticker: 'ECH',  nombre: 'iShares MSCI Chile ETF',                   indice: 'MSCI Chile',                        exposicion: 'Chile',         sector: null,             expense_ratio: 0.57,  aum: 0.4e9,  dividend_yield: 3.00 },
  { ticker: 'ILF',  nombre: 'iShares Latin America 40 ETF',             indice: 'S&P Latin America 40',              exposicion: 'Latam',         sector: null,             expense_ratio: 0.47,  aum: 0.4e9,  dividend_yield: 4.00 },
  { ticker: 'EWZ',  nombre: 'iShares MSCI Brazil ETF',                  indice: 'MSCI Brazil',                       exposicion: 'Brasil',        sector: null,             expense_ratio: 0.57,  aum: 5e9,    dividend_yield: 8.00 },
  // ── Bonos ───────────────────────────────────────────────────────────────────
  { ticker: 'BND',  nombre: 'Vanguard Total Bond Market ETF',           indice: 'Bloomberg US Agg Float',            exposicion: 'USA',           sector: 'Renta Fija',     expense_ratio: 0.03,  aum: 110e9,  dividend_yield: 3.50 },
  { ticker: 'AGG',  nombre: 'iShares Core U.S. Aggregate Bond ETF',     indice: 'Bloomberg US Aggregate',            exposicion: 'USA',           sector: 'Renta Fija',     expense_ratio: 0.03,  aum: 100e9,  dividend_yield: 3.50 },
  { ticker: 'TLT',  nombre: 'iShares 20+ Year Treasury Bond ETF',       indice: 'ICE US Treasury 20+',               exposicion: 'USA',           sector: 'Renta Fija',     expense_ratio: 0.15,  aum: 40e9,   dividend_yield: 3.80 },
  { ticker: 'SHY',  nombre: 'iShares 1-3 Year Treasury Bond ETF',       indice: 'ICE US Treasury 1-3Y',              exposicion: 'USA',           sector: 'Renta Fija',     expense_ratio: 0.15,  aum: 25e9,   dividend_yield: 4.50 },
  { ticker: 'HYG',  nombre: 'iShares iBoxx High Yield Corp Bond ETF',   indice: 'Markit iBoxx USD Liquid HY',        exposicion: 'USA',           sector: 'Renta Fija',     expense_ratio: 0.49,  aum: 15e9,   dividend_yield: 6.00 },
  { ticker: 'EMB',  nombre: 'iShares J.P. Morgan USD EM Bond ETF',      indice: 'JPM EMBI Global Core',              exposicion: 'Emergentes',    sector: 'Renta Fija',     expense_ratio: 0.39,  aum: 15e9,   dividend_yield: 5.50 },
  // ── Sectores ────────────────────────────────────────────────────────────────
  { ticker: 'XLK',  nombre: 'Technology Select Sector SPDR ETF',        indice: 'S&P Tech Select Sector',            exposicion: 'USA',           sector: 'Tecnología',     expense_ratio: 0.10,  aum: 65e9,   dividend_yield: 0.70 },
  { ticker: 'XLF',  nombre: 'Financial Select Sector SPDR ETF',         indice: 'S&P Financial Select',              exposicion: 'USA',           sector: 'Finanzas',       expense_ratio: 0.10,  aum: 40e9,   dividend_yield: 2.00 },
  { ticker: 'XLE',  nombre: 'Energy Select Sector SPDR ETF',            indice: 'S&P Energy Select',                 exposicion: 'USA',           sector: 'Energía',        expense_ratio: 0.10,  aum: 30e9,   dividend_yield: 3.50 },
  { ticker: 'XLV',  nombre: 'Health Care Select Sector SPDR ETF',       indice: 'S&P Health Care Select',            exposicion: 'USA',           sector: 'Salud',          expense_ratio: 0.10,  aum: 35e9,   dividend_yield: 1.50 },
  { ticker: 'XLI',  nombre: 'Industrial Select Sector SPDR ETF',        indice: 'S&P Industrial Select',             exposicion: 'USA',           sector: 'Industria',      expense_ratio: 0.10,  aum: 20e9,   dividend_yield: 1.50 },
  { ticker: 'XLP',  nombre: 'Consumer Staples Select Sector SPDR ETF',  indice: 'S&P Cons. Staples Select',          exposicion: 'USA',           sector: 'Consumo Básico', expense_ratio: 0.10,  aum: 15e9,   dividend_yield: 2.80 },
  // ── Temáticos ───────────────────────────────────────────────────────────────
  { ticker: 'ARKK', nombre: 'ARK Innovation ETF',                       indice: null,                                exposicion: 'USA',           sector: 'Tecnología',     expense_ratio: 0.75,  aum: 6e9,    dividend_yield: 0.00 },
  { ticker: 'ICLN', nombre: 'iShares Global Clean Energy ETF',          indice: 'S&P Global Clean Energy',           exposicion: 'Global',        sector: 'Energía Limpia', expense_ratio: 0.40,  aum: 2e9,    dividend_yield: 1.50 },
  { ticker: 'SOXX', nombre: 'iShares Semiconductor ETF',                indice: 'ICE Semiconductor',                 exposicion: 'USA',           sector: 'Semiconductores',expense_ratio: 0.35,  aum: 12e9,   dividend_yield: 0.70 },
  { ticker: 'HACK', nombre: 'ETFMG Prime Cyber Security ETF',           indice: 'Prime Cyber Defense',               exposicion: 'Global',        sector: 'Ciberseguridad', expense_ratio: 0.60,  aum: 1e9,    dividend_yield: 0.30 },
  // ── Real Estate ─────────────────────────────────────────────────────────────
  { ticker: 'VNQ',  nombre: 'Vanguard Real Estate ETF',                 indice: 'MSCI US IMI Real Estate',           exposicion: 'USA',           sector: 'Real Estate',    expense_ratio: 0.13,  aum: 35e9,   dividend_yield: 4.00 },
  { ticker: 'VNQI', nombre: 'Vanguard Global ex-US Real Estate ETF',    indice: 'S&P Global ex-US Property',         exposicion: 'Global ex USA', sector: 'Real Estate',    expense_ratio: 0.12,  aum: 4e9,    dividend_yield: 4.50 },
  // ── Commodities / Metales ───────────────────────────────────────────────────
  { ticker: 'GLD',  nombre: 'SPDR Gold Shares',                         indice: null,                                exposicion: 'Global',        sector: 'Commodities',    expense_ratio: 0.40,  aum: 70e9,   dividend_yield: 0.00 },
  { ticker: 'IAU',  nombre: 'iShares Gold Trust',                       indice: null,                                exposicion: 'Global',        sector: 'Commodities',    expense_ratio: 0.25,  aum: 30e9,   dividend_yield: 0.00 },
  { ticker: 'SLV',  nombre: 'iShares Silver Trust',                     indice: null,                                exposicion: 'Global',        sector: 'Commodities',    expense_ratio: 0.50,  aum: 11e9,   dividend_yield: 0.00 },
  { ticker: 'DBC',  nombre: 'Invesco DB Commodity Index Tracking Fund', indice: 'DBIQ Optimum Yield Diversified',    exposicion: 'Global',        sector: 'Commodities',    expense_ratio: 0.85,  aum: 1.5e9,  dividend_yield: 0.00 },
  // ── Factor ──────────────────────────────────────────────────────────────────
  { ticker: 'VTV',  nombre: 'Vanguard Value ETF',                       indice: 'CRSP US Large Cap Value',           exposicion: 'USA',           sector: null,             expense_ratio: 0.04,  aum: 115e9,  dividend_yield: 2.20 },
  { ticker: 'VUG',  nombre: 'Vanguard Growth ETF',                      indice: 'CRSP US Large Cap Growth',          exposicion: 'USA',           sector: null,             expense_ratio: 0.04,  aum: 130e9,  dividend_yield: 0.50 },
  { ticker: 'QUAL', nombre: 'iShares MSCI USA Quality Factor ETF',      indice: 'MSCI USA Sector Neutral Quality',   exposicion: 'USA',           sector: null,             expense_ratio: 0.15,  aum: 35e9,   dividend_yield: 1.30 },
  { ticker: 'MTUM', nombre: 'iShares MSCI USA Momentum Factor ETF',     indice: 'MSCI USA Momentum SR',              exposicion: 'USA',           sector: null,             expense_ratio: 0.15,  aum: 10e9,   dividend_yield: 1.00 },
]

// ─── Yahoo Finance v8/chart — único endpoint que funciona sin auth ─────────────
async function fetchYahooChart(ticker: string): Promise<{
  history: { date: string; price: number }[]
  precio:  number | null
  volumen: number | null
}> {
  const to   = Math.floor(Date.now() / 1000)
  const from = to - 365 * 3 * 24 * 3600
  const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${from}&period2=${to}&interval=1mo`
  const res  = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const result     = json?.chart?.result?.[0]
  const meta       = result?.meta ?? {}
  const timestamps: number[] = result?.timestamp ?? []
  const closes: number[]     = result?.indicators?.adjclose?.[0]?.adjclose ?? []

  const history = timestamps
    .map((t, i) => ({ date: new Date(t * 1000).toISOString().split('T')[0], price: closes[i] }))
    .filter(d => d.price > 0)

  const precio  = meta.regularMarketPrice ?? history[history.length - 1]?.price ?? null
  const volumen = meta.regularMarketVolume ?? null

  return { history, precio, volumen }
}

function pct(current: number, past: number | undefined): number | null {
  if (!past || past <= 0) return null
  return +((current / past - 1) * 100).toFixed(2)
}

function priceAt(history: { date: string; price: number }[], daysAgo: number): number | undefined {
  const target = Date.now() - daysAgo * 86_400_000
  let best: { date: string; price: number } | undefined
  let bestDiff = Infinity
  for (const d of history) {
    const diff = Math.abs(new Date(d.date).getTime() - target)
    if (diff < bestDiff) { bestDiff = diff; best = d }
  }
  return best?.price
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('━━━ Sync ETFs → Supabase ━━━')
  console.log(`Inicio: ${now()}`)
  console.log(`Total ETFs: ${ETF_LIST.length}\n`)

  let synced = 0, errors = 0

  for (const etf of ETF_LIST) {
    process.stdout.write(`[${etf.ticker.padEnd(5)}] `)

    try {
      const { history, precio, volumen } = await fetchYahooChart(etf.ticker)
      await sleep(400)

      const nowP     = precio
      const rent_1m  = nowP ? pct(nowP, priceAt(history, 30))      : null
      const rent_3m  = nowP ? pct(nowP, priceAt(history, 90))      : null
      const rent_12m = nowP ? pct(nowP, priceAt(history, 365))     : null
      const rent_3a  = nowP ? pct(nowP, priceAt(history, 365 * 3)) : null

      const row = {
        ticker:         etf.ticker,
        nombre:         etf.nombre,
        indice:         etf.indice,
        exposicion:     etf.exposicion,
        sector:         etf.sector,
        divisa:         'USD',
        aum:            etf.aum,
        volumen_avg:    volumen,
        expense_ratio:  etf.expense_ratio,
        dividend_yield: etf.dividend_yield,
        precio,
        rent_1m, rent_3m, rent_12m, rent_3a,
        updated_at: new Date().toISOString(),
      }

      const { error } = await db.from('etfs').upsert(row, { onConflict: 'ticker' })
      if (error) throw error

      const r12    = rent_12m != null ? `${rent_12m > 0 ? '+' : ''}${rent_12m.toFixed(1)}% 12M` : 'sin 12M'
      const aumStr = etf.aum >= 1e9 ? `AUM $${(etf.aum / 1e9).toFixed(0)}B` : `AUM $${(etf.aum / 1e6).toFixed(0)}M`
      process.stdout.write(`✓  $${precio?.toFixed(2).padStart(7)} · ${r12.padEnd(12)} · ${aumStr}\n`)
      synced++

    } catch (e) {
      process.stdout.write(`✗  ${String(e).slice(0, 70)}\n`)
      errors++
    }
  }

  console.log(`\n━━━ Completado ${now()} ━━━`)
  console.log(`✓ ${synced} ETFs sincronizados · ✗ ${errors} errores`)
}

main().catch(console.error)
