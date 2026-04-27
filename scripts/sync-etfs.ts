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
  { ticker: 'VTI',  nombre: 'Vanguard Total Stock Market ETF',          indice: 'CRSP US Total Market',              exposicion: 'USA',           sector: null,              expense_ratio: 0.03,  aum: 450e9,   dividend_yield: 1.30 },
  { ticker: 'VOO',  nombre: 'Vanguard S&P 500 ETF',                     indice: 'S&P 500',                           exposicion: 'USA',           sector: null,              expense_ratio: 0.03,  aum: 580e9,   dividend_yield: 1.30 },
  { ticker: 'SPY',  nombre: 'SPDR S&P 500 ETF Trust',                   indice: 'S&P 500',                           exposicion: 'USA',           sector: null,              expense_ratio: 0.09,  aum: 600e9,   dividend_yield: 1.25 },
  { ticker: 'IVV',  nombre: 'iShares Core S&P 500 ETF',                 indice: 'S&P 500',                           exposicion: 'USA',           sector: null,              expense_ratio: 0.03,  aum: 560e9,   dividend_yield: 1.25 },
  { ticker: 'QQQ',  nombre: 'Invesco QQQ Trust',                        indice: 'NASDAQ-100',                        exposicion: 'USA',           sector: 'Tecnología',      expense_ratio: 0.20,  aum: 310e9,   dividend_yield: 0.60 },
  { ticker: 'IWM',  nombre: 'iShares Russell 2000 ETF',                 indice: 'Russell 2000',                      exposicion: 'USA',           sector: null,              expense_ratio: 0.19,  aum: 55e9,    dividend_yield: 1.20 },
  { ticker: 'DIA',  nombre: 'SPDR Dow Jones Industrial Average ETF',    indice: 'Dow Jones Industrial Average',      exposicion: 'USA',           sector: null,              expense_ratio: 0.16,  aum: 32e9,    dividend_yield: 1.80 },
  { ticker: 'MDY',  nombre: 'SPDR S&P MidCap 400 ETF',                  indice: 'S&P MidCap 400',                    exposicion: 'USA',           sector: null,              expense_ratio: 0.23,  aum: 18e9,    dividend_yield: 1.50 },
  { ticker: 'SCHB', nombre: 'Schwab U.S. Broad Market ETF',             indice: 'Dow Jones US Broad Market',         exposicion: 'USA',           sector: null,              expense_ratio: 0.03,  aum: 30e9,    dividend_yield: 1.40 },
  { ticker: 'RSP',  nombre: 'Invesco S&P 500 Equal Weight ETF',         indice: 'S&P 500 Equal Weight',              exposicion: 'USA',           sector: null,              expense_ratio: 0.20,  aum: 45e9,    dividend_yield: 1.50 },
  // ── Internacional / Global ──────────────────────────────────────────────────
  { ticker: 'VEA',  nombre: 'Vanguard FTSE Developed Markets ETF',      indice: 'FTSE Developed ex US',              exposicion: 'Global ex USA', sector: null,              expense_ratio: 0.05,  aum: 120e9,   dividend_yield: 3.20 },
  { ticker: 'VWO',  nombre: 'Vanguard FTSE Emerging Markets ETF',       indice: 'FTSE Emerging Markets',             exposicion: 'Emergentes',    sector: null,              expense_ratio: 0.08,  aum: 80e9,    dividend_yield: 3.00 },
  { ticker: 'VXUS', nombre: 'Vanguard Total International Stock ETF',   indice: 'FTSE Global ex US',                 exposicion: 'Global ex USA', sector: null,              expense_ratio: 0.07,  aum: 80e9,    dividend_yield: 3.10 },
  { ticker: 'EEM',  nombre: 'iShares MSCI Emerging Markets ETF',        indice: 'MSCI Emerging Markets',             exposicion: 'Emergentes',    sector: null,              expense_ratio: 0.70,  aum: 20e9,    dividend_yield: 2.50 },
  { ticker: 'ACWI', nombre: 'iShares MSCI ACWI ETF',                    indice: 'MSCI ACWI',                         exposicion: 'Global',        sector: null,              expense_ratio: 0.32,  aum: 20e9,    dividend_yield: 1.80 },
  { ticker: 'VT',   nombre: 'Vanguard Total World Stock ETF',           indice: 'FTSE Global All Cap',               exposicion: 'Global',        sector: null,              expense_ratio: 0.07,  aum: 45e9,    dividend_yield: 2.00 },
  // ── País / Región ───────────────────────────────────────────────────────────
  { ticker: 'EWJ',  nombre: 'iShares MSCI Japan ETF',                   indice: 'MSCI Japan',                        exposicion: 'Japón',         sector: null,              expense_ratio: 0.50,  aum: 14e9,    dividend_yield: 1.50 },
  { ticker: 'EWG',  nombre: 'iShares MSCI Germany ETF',                 indice: 'MSCI Germany',                      exposicion: 'Europa',        sector: null,              expense_ratio: 0.50,  aum: 2e9,     dividend_yield: 2.50 },
  { ticker: 'EWU',  nombre: 'iShares MSCI United Kingdom ETF',          indice: 'MSCI UK',                           exposicion: 'Europa',        sector: null,              expense_ratio: 0.50,  aum: 3e9,     dividend_yield: 3.50 },
  { ticker: 'EWA',  nombre: 'iShares MSCI Australia ETF',               indice: 'MSCI Australia',                    exposicion: 'Global ex USA', sector: null,              expense_ratio: 0.50,  aum: 2e9,     dividend_yield: 4.00 },
  { ticker: 'INDA', nombre: 'iShares MSCI India ETF',                   indice: 'MSCI India',                        exposicion: 'Emergentes',    sector: null,              expense_ratio: 0.64,  aum: 7e9,     dividend_yield: 0.50 },
  { ticker: 'MCHI', nombre: 'iShares MSCI China ETF',                   indice: 'MSCI China',                        exposicion: 'China',         sector: null,              expense_ratio: 0.59,  aum: 4e9,     dividend_yield: 1.50 },
  { ticker: 'FXI',  nombre: 'iShares China Large-Cap ETF',              indice: 'FTSE China 50',                     exposicion: 'China',         sector: null,              expense_ratio: 0.74,  aum: 7e9,     dividend_yield: 2.00 },
  { ticker: 'EWC',  nombre: 'iShares MSCI Canada ETF',                  indice: 'MSCI Canada',                       exposicion: 'Global ex USA', sector: null,              expense_ratio: 0.50,  aum: 2.5e9,   dividend_yield: 3.00 },
  { ticker: 'EWY',  nombre: 'iShares MSCI South Korea ETF',             indice: 'MSCI South Korea',                  exposicion: 'Emergentes',    sector: null,              expense_ratio: 0.55,  aum: 4e9,     dividend_yield: 1.50 },
  { ticker: 'EWT',  nombre: 'iShares MSCI Taiwan ETF',                  indice: 'MSCI Taiwan',                       exposicion: 'Emergentes',    sector: null,              expense_ratio: 0.57,  aum: 5e9,     dividend_yield: 2.50 },
  { ticker: 'IEUR', nombre: 'iShares Core MSCI Europe ETF',             indice: 'MSCI Europe IMI',                   exposicion: 'Europa',        sector: null,              expense_ratio: 0.09,  aum: 7e9,     dividend_yield: 3.20 },
  // ── Latinoamérica / Chile ───────────────────────────────────────────────────
  { ticker: 'ECH',  nombre: 'iShares MSCI Chile ETF',                   indice: 'MSCI Chile',                        exposicion: 'Chile',         sector: null,              expense_ratio: 0.57,  aum: 0.4e9,   dividend_yield: 3.00 },
  { ticker: 'ILF',  nombre: 'iShares Latin America 40 ETF',             indice: 'S&P Latin America 40',              exposicion: 'Latam',         sector: null,              expense_ratio: 0.47,  aum: 0.4e9,   dividend_yield: 4.00 },
  { ticker: 'EWZ',  nombre: 'iShares MSCI Brazil ETF',                  indice: 'MSCI Brazil',                       exposicion: 'Brasil',        sector: null,              expense_ratio: 0.57,  aum: 5e9,     dividend_yield: 8.00 },
  { ticker: 'EWW',  nombre: 'iShares MSCI Mexico ETF',                  indice: 'MSCI Mexico',                       exposicion: 'Latam',         sector: null,              expense_ratio: 0.50,  aum: 0.8e9,   dividend_yield: 3.50 },
  { ticker: 'GXG',  nombre: 'Global X MSCI Colombia ETF',               indice: 'MSCI Golden Dragon Colombia',       exposicion: 'Latam',         sector: null,              expense_ratio: 0.56,  aum: 0.1e9,   dividend_yield: 4.00 },
  { ticker: 'EPU',  nombre: 'iShares MSCI Peru ETF',                    indice: 'MSCI All Peru Capped',              exposicion: 'Latam',         sector: null,              expense_ratio: 0.57,  aum: 0.1e9,   dividend_yield: 5.00 },
  // ── Bonos USA ───────────────────────────────────────────────────────────────
  { ticker: 'BND',  nombre: 'Vanguard Total Bond Market ETF',           indice: 'Bloomberg US Agg Float',            exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.03,  aum: 110e9,   dividend_yield: 3.50 },
  { ticker: 'AGG',  nombre: 'iShares Core U.S. Aggregate Bond ETF',     indice: 'Bloomberg US Aggregate',            exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.03,  aum: 100e9,   dividend_yield: 3.50 },
  { ticker: 'TLT',  nombre: 'iShares 20+ Year Treasury Bond ETF',       indice: 'ICE US Treasury 20+',               exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.15,  aum: 40e9,    dividend_yield: 3.80 },
  { ticker: 'IEF',  nombre: 'iShares 7-10 Year Treasury Bond ETF',      indice: 'ICE US Treasury 7-10Y',             exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.15,  aum: 30e9,    dividend_yield: 4.00 },
  { ticker: 'SHY',  nombre: 'iShares 1-3 Year Treasury Bond ETF',       indice: 'ICE US Treasury 1-3Y',              exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.15,  aum: 25e9,    dividend_yield: 4.50 },
  { ticker: 'GOVT', nombre: 'iShares U.S. Treasury Bond ETF',           indice: 'ICE US Treasury Core',              exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.05,  aum: 30e9,    dividend_yield: 4.00 },
  { ticker: 'TIP',  nombre: 'iShares TIPS Bond ETF',                    indice: 'Bloomberg US TIPS',                 exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.19,  aum: 20e9,    dividend_yield: 3.50 },
  { ticker: 'LQD',  nombre: 'iShares iBoxx Investment Grade Corp Bond', indice: 'Markit iBoxx USD Liquid IG',        exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.14,  aum: 30e9,    dividend_yield: 5.00 },
  { ticker: 'HYG',  nombre: 'iShares iBoxx High Yield Corp Bond ETF',   indice: 'Markit iBoxx USD Liquid HY',        exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.49,  aum: 15e9,    dividend_yield: 6.00 },
  { ticker: 'VCIT', nombre: 'Vanguard Intermediate-Term Corp Bond ETF', indice: 'Bloomberg 5-10Y Corp Bond',         exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.04,  aum: 45e9,    dividend_yield: 4.50 },
  { ticker: 'VCSH', nombre: 'Vanguard Short-Term Corp Bond ETF',        indice: 'Bloomberg 1-5Y Corp Bond',          exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.04,  aum: 40e9,    dividend_yield: 4.80 },
  { ticker: 'MUB',  nombre: 'iShares National Muni Bond ETF',           indice: 'S&P National AMT-Free Muni',        exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.05,  aum: 35e9,    dividend_yield: 3.00 },
  { ticker: 'EMB',  nombre: 'iShares J.P. Morgan USD EM Bond ETF',      indice: 'JPM EMBI Global Core',              exposicion: 'Emergentes',    sector: 'Renta Fija',      expense_ratio: 0.39,  aum: 15e9,    dividend_yield: 5.50 },
  { ticker: 'BNDX', nombre: 'Vanguard Total International Bond ETF',    indice: 'Bloomberg Global ex-USD Float Adj', exposicion: 'Global ex USA', sector: 'Renta Fija',      expense_ratio: 0.07,  aum: 50e9,    dividend_yield: 3.00 },
  // ── Sectores ────────────────────────────────────────────────────────────────
  { ticker: 'XLK',  nombre: 'Technology Select Sector SPDR ETF',        indice: 'S&P Tech Select Sector',            exposicion: 'USA',           sector: 'Tecnología',      expense_ratio: 0.10,  aum: 65e9,    dividend_yield: 0.70 },
  { ticker: 'XLF',  nombre: 'Financial Select Sector SPDR ETF',         indice: 'S&P Financial Select',              exposicion: 'USA',           sector: 'Finanzas',        expense_ratio: 0.10,  aum: 40e9,    dividend_yield: 2.00 },
  { ticker: 'XLE',  nombre: 'Energy Select Sector SPDR ETF',            indice: 'S&P Energy Select',                 exposicion: 'USA',           sector: 'Energía',         expense_ratio: 0.10,  aum: 30e9,    dividend_yield: 3.50 },
  { ticker: 'XLV',  nombre: 'Health Care Select Sector SPDR ETF',       indice: 'S&P Health Care Select',            exposicion: 'USA',           sector: 'Salud',           expense_ratio: 0.10,  aum: 35e9,    dividend_yield: 1.50 },
  { ticker: 'XLI',  nombre: 'Industrial Select Sector SPDR ETF',        indice: 'S&P Industrial Select',             exposicion: 'USA',           sector: 'Industria',       expense_ratio: 0.10,  aum: 20e9,    dividend_yield: 1.50 },
  { ticker: 'XLP',  nombre: 'Consumer Staples Select Sector SPDR ETF',  indice: 'S&P Cons. Staples Select',          exposicion: 'USA',           sector: 'Consumo Básico',  expense_ratio: 0.10,  aum: 15e9,    dividend_yield: 2.80 },
  { ticker: 'XLY',  nombre: 'Consumer Discretionary Select Sector SPDR',indice: 'S&P Cons. Disc. Select',            exposicion: 'USA',           sector: 'Consumo Discr.',  expense_ratio: 0.10,  aum: 25e9,    dividend_yield: 0.80 },
  { ticker: 'XLB',  nombre: 'Materials Select Sector SPDR ETF',         indice: 'S&P Materials Select',              exposicion: 'USA',           sector: 'Materiales',      expense_ratio: 0.10,  aum: 7e9,     dividend_yield: 2.00 },
  { ticker: 'XLU',  nombre: 'Utilities Select Sector SPDR ETF',         indice: 'S&P Utilities Select',              exposicion: 'USA',           sector: 'Utilities',       expense_ratio: 0.10,  aum: 15e9,    dividend_yield: 3.00 },
  { ticker: 'XLC',  nombre: 'Communication Services Select Sector SPDR',indice: 'S&P Comm. Services Select',         exposicion: 'USA',           sector: 'Comunicaciones',  expense_ratio: 0.10,  aum: 20e9,    dividend_yield: 0.80 },
  { ticker: 'XLRE', nombre: 'Real Estate Select Sector SPDR ETF',       indice: 'S&P Real Estate Select',            exposicion: 'USA',           sector: 'Real Estate',     expense_ratio: 0.10,  aum: 5e9,     dividend_yield: 3.50 },
  { ticker: 'IBB',  nombre: 'iShares Biotechnology ETF',                indice: 'NYSE Biotechnology',                exposicion: 'USA',           sector: 'Biotecnología',   expense_ratio: 0.44,  aum: 8e9,     dividend_yield: 0.50 },
  { ticker: 'XBI',  nombre: 'SPDR S&P Biotech ETF',                     indice: 'S&P Biotechnology Select',          exposicion: 'USA',           sector: 'Biotecnología',   expense_ratio: 0.35,  aum: 7e9,     dividend_yield: 0.30 },
  { ticker: 'ITB',  nombre: 'iShares U.S. Home Construction ETF',       indice: 'Dow Jones US Select Home Construction', exposicion: 'USA',      sector: 'Construcción',    expense_ratio: 0.40,  aum: 2e9,     dividend_yield: 0.50 },
  // ── Dividendos ───────────────────────────────────────────────────────────────
  { ticker: 'SCHD', nombre: 'Schwab U.S. Dividend Equity ETF',          indice: 'Dow Jones US Dividend 100',         exposicion: 'USA',           sector: 'Dividendos',      expense_ratio: 0.06,  aum: 60e9,    dividend_yield: 3.80 },
  { ticker: 'VYM',  nombre: 'Vanguard High Dividend Yield ETF',         indice: 'FTSE High Dividend Yield',          exposicion: 'USA',           sector: 'Dividendos',      expense_ratio: 0.06,  aum: 55e9,    dividend_yield: 3.20 },
  { ticker: 'NOBL', nombre: 'ProShares S&P 500 Dividend Aristocrats',   indice: 'S&P 500 Dividend Aristocrats',      exposicion: 'USA',           sector: 'Dividendos',      expense_ratio: 0.35,  aum: 11e9,    dividend_yield: 2.00 },
  { ticker: 'HDV',  nombre: 'iShares Core High Dividend ETF',           indice: 'Morningstar Dividend Yield Focus',  exposicion: 'USA',           sector: 'Dividendos',      expense_ratio: 0.08,  aum: 10e9,    dividend_yield: 3.80 },
  { ticker: 'DVY',  nombre: 'iShares Select Dividend ETF',              indice: 'Dow Jones US Select Dividend',      exposicion: 'USA',           sector: 'Dividendos',      expense_ratio: 0.38,  aum: 17e9,    dividend_yield: 4.50 },
  // ── Temáticos ───────────────────────────────────────────────────────────────
  { ticker: 'ARKK', nombre: 'ARK Innovation ETF',                       indice: null,                                exposicion: 'USA',           sector: 'Tecnología',      expense_ratio: 0.75,  aum: 6e9,     dividend_yield: 0.00 },
  { ticker: 'ICLN', nombre: 'iShares Global Clean Energy ETF',          indice: 'S&P Global Clean Energy',           exposicion: 'Global',        sector: 'Energía Limpia',  expense_ratio: 0.40,  aum: 2e9,     dividend_yield: 1.50 },
  { ticker: 'SOXX', nombre: 'iShares Semiconductor ETF',                indice: 'ICE Semiconductor',                 exposicion: 'USA',           sector: 'Semiconductores', expense_ratio: 0.35,  aum: 12e9,    dividend_yield: 0.70 },
  { ticker: 'HACK', nombre: 'ETFMG Prime Cyber Security ETF',           indice: 'Prime Cyber Defense',               exposicion: 'Global',        sector: 'Ciberseguridad',  expense_ratio: 0.60,  aum: 1e9,     dividend_yield: 0.30 },
  { ticker: 'BOTZ', nombre: 'Global X Robotics & Artificial Intelligence ETF', indice: 'Indxx Global Robotics and AI', exposicion: 'Global',     sector: 'Robótica & IA',   expense_ratio: 0.68,  aum: 2e9,     dividend_yield: 0.30 },
  { ticker: 'CIBR', nombre: 'First Trust Cybersecurity ETF',            indice: 'Nasdaq CEA Cybersecurity',          exposicion: 'Global',        sector: 'Ciberseguridad',  expense_ratio: 0.60,  aum: 6e9,     dividend_yield: 0.20 },
  { ticker: 'LIT',  nombre: 'Global X Lithium & Battery Tech ETF',      indice: 'Solactive Global Lithium',          exposicion: 'Global',        sector: 'Energía Limpia',  expense_ratio: 0.75,  aum: 1.5e9,   dividend_yield: 1.50 },
  { ticker: 'DRIV', nombre: 'Global X Autonomous & Electric Vehicles ETF', indice: 'Solactive Autonomous & EV',     exposicion: 'Global',        sector: 'Tecnología',      expense_ratio: 0.68,  aum: 0.4e9,   dividend_yield: 0.50 },
  { ticker: 'CLOU', nombre: 'Global X Cloud Computing ETF',             indice: 'Indxx Global Cloud Computing',      exposicion: 'Global',        sector: 'Tecnología',      expense_ratio: 0.68,  aum: 0.5e9,   dividend_yield: 0.00 },
  { ticker: 'JETS', nombre: 'U.S. Global Jets ETF',                     indice: 'U.S. Global Jets',                  exposicion: 'USA',           sector: 'Aerolíneas',      expense_ratio: 0.60,  aum: 1.5e9,   dividend_yield: 0.50 },
  { ticker: 'ESGU', nombre: 'iShares MSCI USA ESG Select ETF',          indice: 'MSCI USA Extended ESG Select',      exposicion: 'USA',           sector: null,              expense_ratio: 0.10,  aum: 14e9,    dividend_yield: 1.20 },
  { ticker: 'ESGD', nombre: 'iShares MSCI EAFE ESG Select ETF',         indice: 'MSCI EAFE Extended ESG Select',     exposicion: 'Global ex USA', sector: null,              expense_ratio: 0.20,  aum: 5e9,     dividend_yield: 2.50 },
  // ── Real Estate ─────────────────────────────────────────────────────────────
  { ticker: 'VNQ',  nombre: 'Vanguard Real Estate ETF',                 indice: 'MSCI US IMI Real Estate',           exposicion: 'USA',           sector: 'Real Estate',     expense_ratio: 0.13,  aum: 35e9,    dividend_yield: 4.00 },
  { ticker: 'VNQI', nombre: 'Vanguard Global ex-US Real Estate ETF',    indice: 'S&P Global ex-US Property',         exposicion: 'Global ex USA', sector: 'Real Estate',     expense_ratio: 0.12,  aum: 4e9,     dividend_yield: 4.50 },
  // ── Commodities / Metales ───────────────────────────────────────────────────
  { ticker: 'GLD',  nombre: 'SPDR Gold Shares',                         indice: null,                                exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 0.40,  aum: 70e9,    dividend_yield: 0.00 },
  { ticker: 'IAU',  nombre: 'iShares Gold Trust',                       indice: null,                                exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 0.25,  aum: 30e9,    dividend_yield: 0.00 },
  { ticker: 'SLV',  nombre: 'iShares Silver Trust',                     indice: null,                                exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 0.50,  aum: 11e9,    dividend_yield: 0.00 },
  { ticker: 'GDX',  nombre: 'VanEck Gold Miners ETF',                   indice: 'NYSE Arca Gold Miners',             exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 0.51,  aum: 13e9,    dividend_yield: 1.50 },
  { ticker: 'GDXJ', nombre: 'VanEck Junior Gold Miners ETF',            indice: 'MVIS Global Junior Gold Miners',    exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 0.52,  aum: 5e9,     dividend_yield: 1.00 },
  { ticker: 'DBC',  nombre: 'Invesco DB Commodity Index Tracking Fund', indice: 'DBIQ Optimum Yield Diversified',    exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 0.85,  aum: 1.5e9,   dividend_yield: 0.00 },
  { ticker: 'USO',  nombre: 'United States Oil Fund',                   indice: 'WTI Crude Oil Futures',             exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 0.60,  aum: 1.5e9,   dividend_yield: 0.00 },
  { ticker: 'UNG',  nombre: 'United States Natural Gas Fund',           indice: 'Natural Gas Futures',               exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 1.11,  aum: 0.5e9,   dividend_yield: 0.00 },
  // ── Factor / Smart Beta ──────────────────────────────────────────────────────
  { ticker: 'VTV',  nombre: 'Vanguard Value ETF',                       indice: 'CRSP US Large Cap Value',           exposicion: 'USA',           sector: null,              expense_ratio: 0.04,  aum: 115e9,   dividend_yield: 2.20 },
  { ticker: 'VUG',  nombre: 'Vanguard Growth ETF',                      indice: 'CRSP US Large Cap Growth',          exposicion: 'USA',           sector: null,              expense_ratio: 0.04,  aum: 130e9,   dividend_yield: 0.50 },
  { ticker: 'QUAL', nombre: 'iShares MSCI USA Quality Factor ETF',      indice: 'MSCI USA Sector Neutral Quality',   exposicion: 'USA',           sector: null,              expense_ratio: 0.15,  aum: 35e9,    dividend_yield: 1.30 },
  { ticker: 'MTUM', nombre: 'iShares MSCI USA Momentum Factor ETF',     indice: 'MSCI USA Momentum SR',              exposicion: 'USA',           sector: null,              expense_ratio: 0.15,  aum: 10e9,    dividend_yield: 1.00 },
  { ticker: 'USMV', nombre: 'iShares MSCI USA Min Vol Factor ETF',      indice: 'MSCI USA Minimum Volatility',       exposicion: 'USA',           sector: null,              expense_ratio: 0.15,  aum: 25e9,    dividend_yield: 1.60 },
  { ticker: 'VOOG', nombre: 'Vanguard S&P 500 Growth ETF',              indice: 'S&P 500 Growth',                    exposicion: 'USA',           sector: null,              expense_ratio: 0.10,  aum: 10e9,    dividend_yield: 0.50 },
  { ticker: 'VOOV', nombre: 'Vanguard S&P 500 Value ETF',               indice: 'S&P 500 Value',                     exposicion: 'USA',           sector: null,              expense_ratio: 0.10,  aum: 5e9,     dividend_yield: 2.50 },
  { ticker: 'VBR',  nombre: 'Vanguard Small-Cap Value ETF',             indice: 'CRSP US Small Cap Value',           exposicion: 'USA',           sector: null,              expense_ratio: 0.07,  aum: 25e9,    dividend_yield: 2.00 },
  { ticker: 'VBK',  nombre: 'Vanguard Small-Cap Growth ETF',            indice: 'CRSP US Small Cap Growth',          exposicion: 'USA',           sector: null,              expense_ratio: 0.07,  aum: 15e9,    dividend_yield: 0.50 },
  // ── Apalancados 3x ──────────────────────────────────────────────────────────
  { ticker: 'TQQQ', nombre: 'ProShares UltraPro QQQ (3x)',              indice: 'NASDAQ-100 3x',                     exposicion: 'USA',           sector: 'Apalancado',      expense_ratio: 0.88,  aum: 22e9,    dividend_yield: 0.00 },
  { ticker: 'UPRO', nombre: 'ProShares UltraPro S&P500 (3x)',           indice: 'S&P 500 3x',                        exposicion: 'USA',           sector: 'Apalancado',      expense_ratio: 0.92,  aum: 4e9,     dividend_yield: 0.00 },
  { ticker: 'SPXL', nombre: 'Direxion Daily S&P 500 Bull 3x',           indice: 'S&P 500 3x',                        exposicion: 'USA',           sector: 'Apalancado',      expense_ratio: 0.92,  aum: 3e9,     dividend_yield: 0.00 },
  { ticker: 'SOXL', nombre: 'Direxion Daily Semiconductor Bull 3x',     indice: 'ICE Semiconductor 3x',              exposicion: 'USA',           sector: 'Apalancado',      expense_ratio: 0.91,  aum: 8e9,     dividend_yield: 0.00 },
  { ticker: 'TECL', nombre: 'Direxion Daily Technology Bull 3x',        indice: 'S&P Tech Select 3x',                exposicion: 'USA',           sector: 'Apalancado',      expense_ratio: 0.94,  aum: 3e9,     dividend_yield: 0.00 },
  { ticker: 'TNA',  nombre: 'Direxion Daily Small Cap Bull 3x',         indice: 'Russell 2000 3x',                   exposicion: 'USA',           sector: 'Apalancado',      expense_ratio: 1.07,  aum: 1.5e9,   dividend_yield: 0.00 },
  { ticker: 'TMF',  nombre: 'Direxion Daily 20+ Year Treasury Bull 3x', indice: 'ICE US Treasury 20+ 3x',            exposicion: 'USA',           sector: 'Apalancado',      expense_ratio: 1.06,  aum: 2e9,     dividend_yield: 0.00 },
  { ticker: 'SSO',  nombre: 'ProShares Ultra S&P500 (2x)',              indice: 'S&P 500 2x',                        exposicion: 'USA',           sector: 'Apalancado',      expense_ratio: 0.90,  aum: 4e9,     dividend_yield: 0.00 },
  { ticker: 'QLD',  nombre: 'ProShares Ultra QQQ (2x)',                 indice: 'NASDAQ-100 2x',                     exposicion: 'USA',           sector: 'Apalancado',      expense_ratio: 0.95,  aum: 5e9,     dividend_yield: 0.00 },
  { ticker: 'UDOW', nombre: 'ProShares UltraPro Dow30 (3x)',            indice: 'Dow Jones 3x',                      exposicion: 'USA',           sector: 'Apalancado',      expense_ratio: 0.95,  aum: 0.7e9,   dividend_yield: 0.00 },
  { ticker: 'LABU', nombre: 'Direxion Daily S&P Biotech Bull 3x',       indice: 'S&P Biotech 3x',                    exposicion: 'USA',           sector: 'Apalancado',      expense_ratio: 1.04,  aum: 1.2e9,   dividend_yield: 0.00 },
  // ── Inversos ────────────────────────────────────────────────────────────────
  { ticker: 'SH',   nombre: 'ProShares Short S&P500',                   indice: 'S&P 500 -1x',                       exposicion: 'USA',           sector: 'Inverso',         expense_ratio: 0.89,  aum: 2e9,     dividend_yield: 0.00 },
  { ticker: 'PSQ',  nombre: 'ProShares Short QQQ',                      indice: 'NASDAQ-100 -1x',                    exposicion: 'USA',           sector: 'Inverso',         expense_ratio: 0.95,  aum: 0.8e9,   dividend_yield: 0.00 },
  { ticker: 'SQQQ', nombre: 'ProShares UltraPro Short QQQ (3x)',        indice: 'NASDAQ-100 -3x',                    exposicion: 'USA',           sector: 'Inverso',         expense_ratio: 0.99,  aum: 5e9,     dividend_yield: 0.00 },
  { ticker: 'SPXS', nombre: 'Direxion Daily S&P 500 Bear 3x',           indice: 'S&P 500 -3x',                       exposicion: 'USA',           sector: 'Inverso',         expense_ratio: 1.08,  aum: 1e9,     dividend_yield: 0.00 },
  { ticker: 'SOXS', nombre: 'Direxion Daily Semiconductor Bear 3x',     indice: 'ICE Semiconductor -3x',             exposicion: 'USA',           sector: 'Inverso',         expense_ratio: 1.05,  aum: 1.5e9,   dividend_yield: 0.00 },
  { ticker: 'DOG',  nombre: 'ProShares Short Dow30',                    indice: 'Dow Jones -1x',                     exposicion: 'USA',           sector: 'Inverso',         expense_ratio: 0.95,  aum: 0.3e9,   dividend_yield: 0.00 },
  { ticker: 'RWM',  nombre: 'ProShares Short Russell2000',              indice: 'Russell 2000 -1x',                  exposicion: 'USA',           sector: 'Inverso',         expense_ratio: 0.95,  aum: 0.3e9,   dividend_yield: 0.00 },
  { ticker: 'TBF',  nombre: 'ProShares Short 20+ Year Treasury',        indice: 'ICE US Treasury 20+ -1x',           exposicion: 'USA',           sector: 'Inverso',         expense_ratio: 0.96,  aum: 0.5e9,   dividend_yield: 0.00 },
  // ── Cripto ──────────────────────────────────────────────────────────────────
  { ticker: 'IBIT', nombre: 'iShares Bitcoin Trust ETF',                indice: 'Bitcoin Spot',                      exposicion: 'Global',        sector: 'Cripto',          expense_ratio: 0.25,  aum: 55e9,    dividend_yield: 0.00 },
  { ticker: 'FBTC', nombre: 'Fidelity Wise Origin Bitcoin Fund',        indice: 'Bitcoin Spot',                      exposicion: 'Global',        sector: 'Cripto',          expense_ratio: 0.25,  aum: 18e9,    dividend_yield: 0.00 },
  { ticker: 'ARKB', nombre: 'ARK 21Shares Bitcoin ETF',                 indice: 'Bitcoin Spot',                      exposicion: 'Global',        sector: 'Cripto',          expense_ratio: 0.21,  aum: 4e9,     dividend_yield: 0.00 },
  { ticker: 'BITB', nombre: 'Bitwise Bitcoin ETF',                      indice: 'Bitcoin Spot',                      exposicion: 'Global',        sector: 'Cripto',          expense_ratio: 0.20,  aum: 3e9,     dividend_yield: 0.00 },
  { ticker: 'GBTC', nombre: 'Grayscale Bitcoin Trust ETF',              indice: 'Bitcoin Spot',                      exposicion: 'Global',        sector: 'Cripto',          expense_ratio: 1.50,  aum: 20e9,    dividend_yield: 0.00 },
  { ticker: 'ETHA', nombre: 'iShares Ethereum Trust ETF',               indice: 'Ethereum Spot',                     exposicion: 'Global',        sector: 'Cripto',          expense_ratio: 0.25,  aum: 3e9,     dividend_yield: 0.00 },
  { ticker: 'FETH', nombre: 'Fidelity Ethereum Fund',                   indice: 'Ethereum Spot',                     exposicion: 'Global',        sector: 'Cripto',          expense_ratio: 0.25,  aum: 1e9,     dividend_yield: 0.00 },
  { ticker: 'BITO', nombre: 'ProShares Bitcoin Strategy ETF',           indice: 'Bitcoin Futures',                   exposicion: 'Global',        sector: 'Cripto',          expense_ratio: 0.95,  aum: 2e9,     dividend_yield: 0.00 },
  // ── IA / Semiconductores avanzado ───────────────────────────────────────────
  { ticker: 'SMH',  nombre: 'VanEck Semiconductor ETF',                 indice: 'MVIS US Listed Semiconductor',      exposicion: 'USA',           sector: 'Semiconductores', expense_ratio: 0.35,  aum: 22e9,    dividend_yield: 0.60 },
  { ticker: 'AIQ',  nombre: 'Global X Artificial Intelligence & Tech',  indice: 'Indxx Artificial Intelligence',     exposicion: 'Global',        sector: 'Robótica & IA',   expense_ratio: 0.68,  aum: 1e9,     dividend_yield: 0.30 },
  { ticker: 'IRBO', nombre: 'iShares Robotics and AI Multisector ETF',  indice: 'NYSE FactSet Global Robotics & AI', exposicion: 'Global',        sector: 'Robótica & IA',   expense_ratio: 0.47,  aum: 0.5e9,   dividend_yield: 0.20 },
  { ticker: 'SKYY', nombre: 'First Trust Cloud Computing ETF',          indice: 'ISE Cloud Computing',               exposicion: 'Global',        sector: 'Tecnología',      expense_ratio: 0.60,  aum: 3e9,     dividend_yield: 0.20 },
  { ticker: 'WCLD', nombre: 'WisdomTree Cloud Computing Fund',          indice: 'BVP Nasdaq Emerging Cloud',         exposicion: 'USA',           sector: 'Tecnología',      expense_ratio: 0.45,  aum: 0.5e9,   dividend_yield: 0.00 },
  { ticker: 'FINX', nombre: 'Global X FinTech ETF',                     indice: 'Indxx Global Fintech Thematic',     exposicion: 'Global',        sector: 'Finanzas',        expense_ratio: 0.68,  aum: 0.4e9,   dividend_yield: 0.20 },
  { ticker: 'KOMP', nombre: 'SPDR S&P Kensho New Economies Composite',  indice: 'S&P Kensho New Economies',          exposicion: 'USA',           sector: 'Tecnología',      expense_ratio: 0.20,  aum: 1.5e9,   dividend_yield: 0.30 },
  // ── ARK ETFs ─────────────────────────────────────────────────────────────────
  { ticker: 'ARKW', nombre: 'ARK Next Generation Internet ETF',         indice: null,                                exposicion: 'Global',        sector: 'Tecnología',      expense_ratio: 0.88,  aum: 1.5e9,   dividend_yield: 0.00 },
  { ticker: 'ARKG', nombre: 'ARK Genomic Revolution ETF',               indice: null,                                exposicion: 'Global',        sector: 'Biotecnología',   expense_ratio: 0.75,  aum: 2e9,     dividend_yield: 0.00 },
  { ticker: 'ARKF', nombre: 'ARK Fintech Innovation ETF',               indice: null,                                exposicion: 'Global',        sector: 'Finanzas',        expense_ratio: 0.75,  aum: 0.8e9,   dividend_yield: 0.00 },
  { ticker: 'ARKQ', nombre: 'ARK Autonomous Technology & Robotics ETF', indice: null,                                exposicion: 'Global',        sector: 'Robótica & IA',   expense_ratio: 0.75,  aum: 0.6e9,   dividend_yield: 0.00 },
  { ticker: 'ARKX', nombre: 'ARK Space Exploration & Innovation ETF',   indice: null,                                exposicion: 'Global',        sector: 'Tecnología',      expense_ratio: 0.75,  aum: 0.3e9,   dividend_yield: 0.00 },
  // ── Más sectores USA ─────────────────────────────────────────────────────────
  { ticker: 'KRE',  nombre: 'SPDR S&P Regional Banking ETF',            indice: 'S&P Regional Banks Select',         exposicion: 'USA',           sector: 'Finanzas',        expense_ratio: 0.35,  aum: 4e9,     dividend_yield: 3.50 },
  { ticker: 'KBE',  nombre: 'SPDR S&P Bank ETF',                        indice: 'S&P Banks Select Industry',         exposicion: 'USA',           sector: 'Finanzas',        expense_ratio: 0.35,  aum: 2e9,     dividend_yield: 3.00 },
  { ticker: 'XOP',  nombre: 'SPDR S&P Oil & Gas Exploration ETF',       indice: 'S&P Oil & Gas E&P Select',          exposicion: 'USA',           sector: 'Energía',         expense_ratio: 0.35,  aum: 3e9,     dividend_yield: 2.50 },
  { ticker: 'OIH',  nombre: 'VanEck Oil Services ETF',                  indice: 'MVIS US Listed Oil Services 25',    exposicion: 'USA',           sector: 'Energía',         expense_ratio: 0.35,  aum: 2e9,     dividend_yield: 1.50 },
  { ticker: 'PAVE', nombre: 'Global X US Infrastructure Development',   indice: 'Indxx US Infrastructure Dev.',      exposicion: 'USA',           sector: 'Industria',       expense_ratio: 0.47,  aum: 7e9,     dividend_yield: 0.50 },
  { ticker: 'MOO',  nombre: 'VanEck Agribusiness ETF',                  indice: 'MVIS Global Agribusiness',          exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 0.56,  aum: 1e9,     dividend_yield: 1.50 },
  { ticker: 'KWEB', nombre: 'KraneShares CSI China Internet ETF',       indice: 'CSI Overseas China Internet',       exposicion: 'China',         sector: 'Tecnología',      expense_ratio: 0.70,  aum: 5e9,     dividend_yield: 0.50 },
  { ticker: 'ESPO', nombre: 'VanEck Video Gaming and eSports ETF',      indice: 'MVIS Global Video Gaming & eSports',exposicion: 'Global',        sector: 'Tecnología',      expense_ratio: 0.55,  aum: 0.4e9,   dividend_yield: 0.30 },
  { ticker: 'HERO', nombre: 'Global X Video Games & Esports ETF',       indice: 'Solactive Video Games & eSports',   exposicion: 'Global',        sector: 'Tecnología',      expense_ratio: 0.50,  aum: 0.3e9,   dividend_yield: 0.20 },
  // ── Volatilidad ──────────────────────────────────────────────────────────────
  { ticker: 'VXX',  nombre: 'iPath Series B S&P 500 VIX Short-Term',   indice: 'S&P 500 VIX Short-Term Futures',    exposicion: 'USA',           sector: 'Volatilidad',     expense_ratio: 0.89,  aum: 0.5e9,   dividend_yield: 0.00 },
  { ticker: 'VIXY', nombre: 'ProShares VIX Short-Term Futures ETF',     indice: 'S&P 500 VIX Short-Term Futures',    exposicion: 'USA',           sector: 'Volatilidad',     expense_ratio: 0.85,  aum: 0.3e9,   dividend_yield: 0.00 },
  { ticker: 'SVXY', nombre: 'ProShares Short VIX Short-Term Futures',   indice: 'S&P 500 VIX Short-Term -0.5x',     exposicion: 'USA',           sector: 'Volatilidad',     expense_ratio: 0.95,  aum: 0.4e9,   dividend_yield: 0.00 },
  // ── Covered Call / Income ────────────────────────────────────────────────────
  { ticker: 'JEPI', nombre: 'JPMorgan Equity Premium Income ETF',       indice: 'S&P 500 Covered Call',             exposicion: 'USA',           sector: 'Dividendos',      expense_ratio: 0.35,  aum: 35e9,    dividend_yield: 7.50 },
  { ticker: 'JEPQ', nombre: 'JPMorgan Nasdaq Equity Premium Income',    indice: 'NASDAQ-100 Covered Call',          exposicion: 'USA',           sector: 'Dividendos',      expense_ratio: 0.35,  aum: 15e9,    dividend_yield: 9.00 },
  { ticker: 'QYLD', nombre: 'Global X Nasdaq 100 Covered Call ETF',     indice: 'CBOE NASDAQ-100 BuyWrite',         exposicion: 'USA',           sector: 'Dividendos',      expense_ratio: 0.60,  aum: 8e9,     dividend_yield: 11.00},
  { ticker: 'XYLD', nombre: 'Global X S&P 500 Covered Call ETF',        indice: 'CBOE S&P 500 BuyWrite',            exposicion: 'USA',           sector: 'Dividendos',      expense_ratio: 0.60,  aum: 2.5e9,   dividend_yield: 9.00 },
  { ticker: 'RYLD', nombre: 'Global X Russell 2000 Covered Call ETF',   indice: 'CBOE Russell 2000 BuyWrite',       exposicion: 'USA',           sector: 'Dividendos',      expense_ratio: 0.60,  aum: 1.5e9,   dividend_yield: 12.00},
  // ── Más dividendos ───────────────────────────────────────────────────────────
  { ticker: 'DGRO', nombre: 'iShares Core Dividend Growth ETF',         indice: 'Morningstar US Dividend Growth',    exposicion: 'USA',           sector: 'Dividendos',      expense_ratio: 0.08,  aum: 25e9,    dividend_yield: 2.50 },
  { ticker: 'SPYD', nombre: 'SPDR Portfolio S&P 500 High Dividend ETF', indice: 'S&P 500 High Dividend',             exposicion: 'USA',           sector: 'Dividendos',      expense_ratio: 0.07,  aum: 7e9,     dividend_yield: 4.20 },
  { ticker: 'SPHD', nombre: 'Invesco S&P 500 High Div Low Volatility',  indice: 'S&P 500 High Div Low Volatility',  exposicion: 'USA',           sector: 'Dividendos',      expense_ratio: 0.30,  aum: 3e9,     dividend_yield: 4.50 },
  { ticker: 'SDY',  nombre: 'SPDR S&P Dividend ETF',                    indice: 'S&P High Yield Dividend Aristocrats',exposicion: 'USA',          sector: 'Dividendos',      expense_ratio: 0.35,  aum: 20e9,    dividend_yield: 2.80 },
  // ── Más bonos ────────────────────────────────────────────────────────────────
  { ticker: 'BIL',  nombre: 'SPDR Bloomberg 1-3 Month T-Bill ETF',      indice: 'Bloomberg 1-3 Month T-Bill',        exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.14,  aum: 35e9,    dividend_yield: 5.20 },
  { ticker: 'SGOV', nombre: 'iShares 0-3 Month Treasury Bond ETF',      indice: 'ICE 0-3 Month US Treasury',         exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.09,  aum: 30e9,    dividend_yield: 5.10 },
  { ticker: 'SHV',  nombre: 'iShares Short Treasury Bond ETF',          indice: 'ICE Short US Treasury',             exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.15,  aum: 20e9,    dividend_yield: 5.00 },
  { ticker: 'VGLT', nombre: 'Vanguard Long-Term Treasury ETF',          indice: 'Bloomberg US Long Treasury',        exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.04,  aum: 8e9,     dividend_yield: 4.20 },
  { ticker: 'VGIT', nombre: 'Vanguard Intermediate-Term Treasury ETF',  indice: 'Bloomberg US 3-10Y Treasury',       exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.04,  aum: 15e9,    dividend_yield: 4.00 },
  { ticker: 'VGSH', nombre: 'Vanguard Short-Term Treasury ETF',         indice: 'Bloomberg US 1-3Y Treasury',        exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.04,  aum: 14e9,    dividend_yield: 4.50 },
  { ticker: 'VTIP', nombre: 'Vanguard Short-Term Inflation-Protected',  indice: 'Bloomberg 0-5Y TIPS',               exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.04,  aum: 12e9,    dividend_yield: 3.50 },
  { ticker: 'FLOT', nombre: 'iShares Floating Rate Bond ETF',           indice: 'Bloomberg US Floating Rate',        exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.15,  aum: 8e9,     dividend_yield: 5.50 },
  { ticker: 'JNK',  nombre: 'SPDR Bloomberg High Yield Bond ETF',       indice: 'Bloomberg High Yield Very Liquid',  exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.40,  aum: 8e9,     dividend_yield: 6.50 },
  { ticker: 'BKLN', nombre: 'Invesco Senior Loan ETF',                  indice: 'Morningstar LSTA US Leveraged Loan',exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.65,  aum: 5e9,     dividend_yield: 8.50 },
  { ticker: 'PCY',  nombre: 'Invesco Emerging Markets Sovereign Debt',  indice: 'DB Emerging Market USD Liquid Bal.',exposicion: 'Emergentes',    sector: 'Renta Fija',      expense_ratio: 0.50,  aum: 1e9,     dividend_yield: 5.50 },
  { ticker: 'ANGL', nombre: 'VanEck Fallen Angel High Yield Bond ETF',  indice: 'ICE US Fallen Angel HY 10% Const.', exposicion: 'USA',           sector: 'Renta Fija',      expense_ratio: 0.35,  aum: 3e9,     dividend_yield: 5.80 },
  // ── Más internacionales ──────────────────────────────────────────────────────
  { ticker: 'VGK',  nombre: 'Vanguard FTSE Europe ETF',                 indice: 'FTSE Developed Europe All Cap',     exposicion: 'Europa',        sector: null,              expense_ratio: 0.09,  aum: 20e9,    dividend_yield: 3.50 },
  { ticker: 'EWI',  nombre: 'iShares MSCI Italy ETF',                   indice: 'MSCI Italy 25/50',                  exposicion: 'Europa',        sector: null,              expense_ratio: 0.50,  aum: 0.8e9,   dividend_yield: 3.50 },
  { ticker: 'EWP',  nombre: 'iShares MSCI Spain ETF',                   indice: 'MSCI Spain 25/50',                  exposicion: 'Europa',        sector: null,              expense_ratio: 0.50,  aum: 0.5e9,   dividend_yield: 4.50 },
  { ticker: 'EWQ',  nombre: 'iShares MSCI France ETF',                  indice: 'MSCI France',                       exposicion: 'Europa',        sector: null,              expense_ratio: 0.50,  aum: 0.5e9,   dividend_yield: 3.00 },
  { ticker: 'EWL',  nombre: 'iShares MSCI Switzerland ETF',             indice: 'MSCI Switzerland 25/50',            exposicion: 'Europa',        sector: null,              expense_ratio: 0.50,  aum: 1e9,     dividend_yield: 3.00 },
  { ticker: 'EWD',  nombre: 'iShares MSCI Sweden ETF',                  indice: 'MSCI Sweden',                       exposicion: 'Europa',        sector: null,              expense_ratio: 0.50,  aum: 0.4e9,   dividend_yield: 3.50 },
  { ticker: 'EIS',  nombre: 'iShares MSCI Israel ETF',                  indice: 'MSCI Israel Capped',                exposicion: 'Global ex USA', sector: null,              expense_ratio: 0.59,  aum: 0.3e9,   dividend_yield: 2.00 },
  { ticker: 'EZA',  nombre: 'iShares MSCI South Africa ETF',            indice: 'MSCI South Africa',                 exposicion: 'Emergentes',    sector: null,              expense_ratio: 0.59,  aum: 0.4e9,   dividend_yield: 5.00 },
  { ticker: 'THD',  nombre: 'iShares MSCI Thailand ETF',                indice: 'MSCI Thailand IMI 25/50',           exposicion: 'Emergentes',    sector: null,              expense_ratio: 0.59,  aum: 0.3e9,   dividend_yield: 2.50 },
  { ticker: 'HEWJ', nombre: 'iShares Currency Hedged MSCI Japan ETF',   indice: 'MSCI Japan 100% Hedged USD',        exposicion: 'Japón',         sector: null,              expense_ratio: 0.49,  aum: 2e9,     dividend_yield: 2.00 },
  { ticker: 'HEDJ', nombre: 'WisdomTree Europe Hedged Equity Fund',     indice: 'WisdomTree Europe Hedged Equity',   exposicion: 'Europa',        sector: null,              expense_ratio: 0.58,  aum: 1e9,     dividend_yield: 3.00 },
  { ticker: 'EPP',  nombre: 'iShares MSCI Pacific ex Japan ETF',        indice: 'MSCI Pacific ex-Japan',             exposicion: 'Global ex USA', sector: null,              expense_ratio: 0.48,  aum: 2e9,     dividend_yield: 4.00 },
  { ticker: 'ENZL', nombre: 'iShares MSCI New Zealand ETF',             indice: 'MSCI New Zealand IMI 25/50',        exposicion: 'Global ex USA', sector: null,              expense_ratio: 0.50,  aum: 0.2e9,   dividend_yield: 4.00 },
  // ── Más commodities ──────────────────────────────────────────────────────────
  { ticker: 'PDBC', nombre: 'Invesco Optimum Yield Diversified Commodity',indice:'DBIQ Diversified Commodity Index',  exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 0.59,  aum: 4e9,     dividend_yield: 0.00 },
  { ticker: 'GLDM', nombre: 'SPDR Gold MiniShares Trust',               indice: null,                                exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 0.10,  aum: 10e9,    dividend_yield: 0.00 },
  { ticker: 'PPLT', nombre: 'Aberdeen Physical Platinum Shares ETF',    indice: null,                                exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 0.60,  aum: 0.5e9,   dividend_yield: 0.00 },
  { ticker: 'PALL', nombre: 'Aberdeen Physical Palladium Shares ETF',   indice: null,                                exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 0.60,  aum: 0.2e9,   dividend_yield: 0.00 },
  { ticker: 'CPER', nombre: 'United States Copper Index Fund',          indice: 'SummerHaven Copper Index',          exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 0.97,  aum: 0.2e9,   dividend_yield: 0.00 },
  { ticker: 'WEAT', nombre: 'Teucrium Wheat Fund',                      indice: 'Wheat Futures',                     exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 1.04,  aum: 0.2e9,   dividend_yield: 0.00 },
  { ticker: 'CORN', nombre: 'Teucrium Corn Fund',                       indice: 'Corn Futures',                      exposicion: 'Global',        sector: 'Commodities',     expense_ratio: 1.04,  aum: 0.1e9,   dividend_yield: 0.00 },
  // ── Multi-asset / Balanceados ────────────────────────────────────────────────
  { ticker: 'AOR',  nombre: 'iShares Core Growth Allocation ETF',       indice: null,                                exposicion: 'Global',        sector: null,              expense_ratio: 0.15,  aum: 2e9,     dividend_yield: 2.50 },
  { ticker: 'AOM',  nombre: 'iShares Core Moderate Allocation ETF',     indice: null,                                exposicion: 'Global',        sector: null,              expense_ratio: 0.15,  aum: 1.5e9,   dividend_yield: 2.80 },
  { ticker: 'AOA',  nombre: 'iShares Core Aggressive Allocation ETF',   indice: null,                                exposicion: 'Global',        sector: null,              expense_ratio: 0.15,  aum: 1e9,     dividend_yield: 2.00 },
  { ticker: 'AOK',  nombre: 'iShares Core Conservative Allocation ETF', indice: null,                                exposicion: 'Global',        sector: null,              expense_ratio: 0.15,  aum: 0.8e9,   dividend_yield: 3.00 },
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
