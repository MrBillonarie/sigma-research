export type RiskLevel = 'Muy bajo' | 'Bajo' | 'Medio' | 'Alto' | 'Muy alto'

export const RISK_COLOR: Record<RiskLevel, string> = {
  'Muy bajo': '#166534',
  'Bajo':     '#34d399',
  'Medio':    '#fbbf24',
  'Alto':     '#f97316',
  'Muy alto': '#f87171',
}

export interface DepositOption {
  plataforma: string; moneda: string; plazo: string
  apy: number; minUSD: number; risk: RiskLevel; url: string
  liveKey?: string
}
export const DEPOSITOS: DepositOption[] = [
  { plataforma: 'Binance Earn', moneda: 'USDT',  plazo: '30 días',  apy: 5.2, minUSD: 10,    risk: 'Bajo',     url: 'https://www.binance.com/es/earn', liveKey: 'deposit:binance:usdt' },
  { plataforma: 'OKX Earn',     moneda: 'USDC',  plazo: '60 días',  apy: 6.1, minUSD: 10,    risk: 'Bajo',     url: 'https://www.okx.com/earn',         liveKey: 'deposit:okx:usdc'     },
  { plataforma: 'Bybit Savings',moneda: 'BTC',   plazo: 'Flexible', apy: 3.8, minUSD: 1,     risk: 'Bajo',     url: 'https://www.bybit.com/earn',       liveKey: 'deposit:bybit:btc'    },
  { plataforma: 'Binance Earn', moneda: 'USDC',  plazo: '90 días',  apy: 7.4, minUSD: 10,    risk: 'Bajo',     url: 'https://www.binance.com/es/earn', liveKey: 'deposit:binance:usdc' },
  { plataforma: 'Banco local',  moneda: 'USD',   plazo: '90 días',  apy: 4.5, minUSD: 1_000, risk: 'Muy bajo', url: '#' },
  { plataforma: 'Bybit Savings',moneda: 'USDT',  plazo: 'Flexible', apy: 4.2, minUSD: 1,     risk: 'Bajo',     url: 'https://www.bybit.com/earn',       liveKey: 'deposit:bybit:usdt'   },
]

export interface StakingOption {
  activo: string; apyMin: number; apyMax: number; lockup: string
  plataforma: string; risk: RiskLevel; url: string; liveKey?: string
}
export const STAKING: StakingOption[] = [
  { activo: 'ETH',   apyMin: 3.0, apyMax: 4.2,  lockup: 'Flexible', plataforma: 'Lido / Rocket Pool',   risk: 'Bajo',   url: 'https://lido.fi',                          liveKey: 'staking:eth'  },
  { activo: 'BNB',   apyMin: 5.0, apyMax: 8.0,  lockup: '7–30 días',plataforma: 'Binance / Venus',       risk: 'Bajo',   url: 'https://www.binance.com/es/earn'                                   },
  { activo: 'SOL',   apyMin: 6.0, apyMax: 7.5,  lockup: 'Flexible', plataforma: 'Marinade / Jito',       risk: 'Bajo',   url: 'https://marinade.finance',                 liveKey: 'staking:sol'  },
  { activo: 'CAKE',  apyMin: 10,  apyMax: 25,   lockup: 'Variable', plataforma: 'PancakeSwap',            risk: 'Medio',  url: 'https://pancakeswap.finance',              liveKey: 'staking:cake' },
  { activo: 'MATIC', apyMin: 4.0, apyMax: 6.0,  lockup: 'Flexible', plataforma: 'Polygon nativo',         risk: 'Bajo',   url: 'https://staking.polygon.technology'                                },
  { activo: 'ADA',   apyMin: 3.5, apyMax: 5.0,  lockup: 'Flexible', plataforma: 'Cardano nativo',         risk: 'Bajo',   url: 'https://cardano.org'                                               },
]

export interface DefiOption {
  protocolo: string; activo: string; apySupply: number; tvlM: number
  audited: boolean; chain: string; tipo: string; risk: RiskLevel; url: string; liveKey?: string
}
export const DEFI_EARN: DefiOption[] = [
  { protocolo: 'Aave V3',   activo: 'USDC',   apySupply: 4.8,  tvlM: 2100, audited: true,  chain: 'Multi',  tipo: 'Lending', risk: 'Bajo',   url: 'https://app.aave.com',        liveKey: 'defi:aave:usdc'     },
  { protocolo: 'Venus',     activo: 'BNB',    apySupply: 6.2,  tvlM: 800,  audited: true,  chain: 'BSC',    tipo: 'Lending', risk: 'Bajo',   url: 'https://venus.io',            liveKey: 'defi:venus:bnb'     },
  { protocolo: 'Compound',  activo: 'USDT',   apySupply: 3.9,  tvlM: 1500, audited: true,  chain: 'ETH',    tipo: 'Lending', risk: 'Bajo',   url: 'https://compound.finance',    liveKey: 'defi:compound:usdt' },
  { protocolo: 'Beefy',     activo: 'BNB-LP', apySupply: 18.4, tvlM: 120,  audited: true,  chain: 'BSC',    tipo: 'Vault',   risk: 'Medio',  url: 'https://beefy.finance',       liveKey: 'defi:beefy:bnb'     },
  { protocolo: 'Yearn V3',  activo: 'USDC',   apySupply: 7.1,  tvlM: 450,  audited: true,  chain: 'ETH',    tipo: 'Vault',   risk: 'Bajo',   url: 'https://yearn.fi',            liveKey: 'defi:yearn:usdc'    },
  { protocolo: 'Autofarm',  activo: 'CAKE',   apySupply: 22.0, tvlM: 60,   audited: true,  chain: 'BSC',    tipo: 'Vault',   risk: 'Medio',  url: 'https://autofarm.network'                                   },
]

export interface LpOption {
  par: string; dex: string; feeApr: number; farmApr: number; risk: RiskLevel; url: string; liveKey?: string
}
export const LP_POOLS: LpOption[] = [
  { par: 'BNB/USDT',  dex: 'PancakeSwap', feeApr: 8.2,  farmApr: 6.4,  risk: 'Medio', url: 'https://pancakeswap.finance', liveKey: 'lp:bnb-usdt:pcake'  },
  { par: 'ETH/USDC',  dex: 'Uniswap V3',  feeApr: 12.1, farmApr: 0,    risk: 'Medio', url: 'https://app.uniswap.org',     liveKey: 'lp:eth-usdc:uni'    },
  { par: 'CAKE/BNB',  dex: 'PancakeSwap', feeApr: 15.3, farmApr: 22.1, risk: 'Alto',  url: 'https://pancakeswap.finance'                                 },
  { par: 'WBTC/ETH',  dex: 'Uniswap V3',  feeApr: 9.8,  farmApr: 0,    risk: 'Medio', url: 'https://app.uniswap.org',     liveKey: 'lp:wbtc-eth:uni'    },
  { par: 'USDT/USDC', dex: 'PancakeSwap', feeApr: 4.1,  farmApr: 2.8,  risk: 'Bajo',  url: 'https://pancakeswap.finance', liveKey: 'lp:usdt-usdc:pcake' },
  { par: 'BTC/USDC',  dex: 'Uniswap V3',  feeApr: 11.4, farmApr: 0,    risk: 'Medio', url: 'https://app.uniswap.org'                                     },
]

export interface DivOption {
  token: string; protocolo: string; tipo: string; yieldMin: number; yieldMax: number; freq: string; risk: RiskLevel; url: string; liveKey?: string
}
export const DIV_CRYPTO: DivOption[] = [
  { token: 'GMX',  protocolo: 'GMX.io',        tipo: 'ETH/AVAX fees', yieldMin: 8,  yieldMax: 15, freq: 'Tiempo real', risk: 'Medio', url: 'https://gmx.io',               liveKey: 'div:gmx'  },
  { token: 'GNS',  protocolo: 'Gains.trade',   tipo: 'DAI fees',      yieldMin: 10, yieldMax: 20, freq: 'Diario',      risk: 'Medio', url: 'https://gains.trade'                               },
  { token: 'dYdX', protocolo: 'dYdX',          tipo: 'USDC fees',     yieldMin: 5,  yieldMax: 12, freq: 'Semanal',     risk: 'Medio', url: 'https://dydx.exchange'                             },
  { token: 'VELO', protocolo: 'Velodrome',      tipo: 'Fees + bribes', yieldMin: 15, yieldMax: 40, freq: 'Semanal',     risk: 'Alto',  url: 'https://velodrome.finance',    liveKey: 'div:velo' },
]
export const DIV_TRADFI: DivOption[] = [
  { token: 'VYM',  protocolo: 'Vanguard ETF',  tipo: 'Dividendo',     yieldMin: 2.8, yieldMax: 3.5, freq: 'Trimestral', risk: 'Muy bajo', url: 'https://finance.yahoo.com/quote/VYM',  liveKey: 'tradfi:vym'  },
  { token: 'SCHD', protocolo: 'Schwab ETF',    tipo: 'Dividendo',     yieldMin: 3.2, yieldMax: 4.0, freq: 'Trimestral', risk: 'Muy bajo', url: 'https://finance.yahoo.com/quote/SCHD', liveKey: 'tradfi:schd' },
  { token: 'REITs',protocolo: 'Inmobiliario',  tipo: 'Arriendo',      yieldMin: 4.0, yieldMax: 7.0, freq: 'Trimestral', risk: 'Bajo',     url: '#'                                                          },
]

export interface BotOption {
  estrategia: string; descripcion: string; retMin: number; retMax: number; risk: RiskLevel; url: string }
export const BOTS: BotOption[] = [
  { estrategia: 'Grid Bot',    descripcion: 'Compra/venta automática en rango de precio definido',  retMin: 10, retMax: 30, risk: 'Medio', url: 'https://www.binance.com/es/trading-bots' },
  { estrategia: 'DCA Bot',     descripcion: 'Compra periódica automatizada reduciendo precio medio',retMin: 0,  retMax: 0,  risk: 'Bajo',  url: 'https://www.binance.com/es/trading-bots' },
  { estrategia: 'Arbitraje',   descripcion: 'Aprovecha diferencias de precio entre DEXs',          retMin: 5,  retMax: 15, risk: 'Medio', url: '#' },
  { estrategia: 'Rebalanceo',  descripcion: 'Mantiene el % objetivo de cada activo en portafolio', retMin: 0,  retMax: 0,  risk: 'Bajo',  url: '#' },
]

export type PositionCategory = 'Depósito' | 'Staking' | 'DeFi' | 'LP' | 'Dividendo' | 'Bot'
export const CATEGORY_ICON: Record<PositionCategory, string> = {
  'Depósito':  '🏦',
  'Staking':   '💎',
  'DeFi':      '🌾',
  'LP':        '💱',
  'Dividendo': '📊',
  'Bot':       '🤖',
}
