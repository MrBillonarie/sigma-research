// Resultados reales de la cuenta de Binance Futures del motor, para el bloque
// "Resultados del motor · últimos 7 días" del research.
//
// Las claves salen del propio motor (única fuente de verdad); nunca se
// modifican ni se copian. Orden de preferencia:
//   1. process.env.SIGMA_BINANCE_API_KEY / _SECRET   (override explícito)
//   2. engine/config/secrets.json                    (lo que ya usa el motor)
// Uso estrictamente de solo lectura: income + userTrades firmados con GET.

import crypto from 'crypto'
import { readFileSync } from 'fs'

const FAPI = 'https://fapi.binance.com'
const SECRETS_PATH = process.env.SIGMA_SECRETS_PATH ?? '/opt/sigma/engine/config/secrets.json'

export interface BinanceOp {
  sym:   string   // sin sufijo USDT
  dir:   'LONG' | 'SHORT'
  t:     number   // ms del cierre
  entry: number
  exit:  number
  rpnl:  number   // P&L realizado (USDT), suma de fills de la posición
  comm:  number
}

export interface BinanceResumen {
  ok:        boolean
  error:     string | null
  balance:   number | null
  ops:       BinanceOp[]
  nOps:      number
  wins:      number
  wr:        number         // %
  pnlBruto:  number         // REALIZED_PNL
  comision:  number         // COMMISSION (negativo)
  funding:   number
  neto:      number         // bruto + comisión + funding
  transfer:  number         // movimientos de capital, NO son resultado
}

function creds(): { key: string; secret: string } | null {
  const k = process.env.SIGMA_BINANCE_API_KEY
  const s = process.env.SIGMA_BINANCE_API_SECRET
  if (k && s) return { key: k, secret: s }
  try {
    const j = JSON.parse(readFileSync(SECRETS_PATH, 'utf8'))
    if (j.BINANCE_API_KEY && j.BINANCE_API_SECRET) {
      return { key: j.BINANCE_API_KEY, secret: j.BINANCE_API_SECRET }
    }
  } catch { /* sin secrets legibles: se resuelve como cuenta no disponible */ }
  return null
}

function firmar(secret: string, query: string): string {
  return crypto.createHmac('sha256', secret).update(query).digest('hex')
}

async function firmado(path: string, params: Record<string, string | number>, c: { key: string; secret: string }) {
  const q = new URLSearchParams({ ...params, timestamp: String(Date.now()), recvWindow: '5000' } as Record<string, string>).toString()
  const sig = firmar(c.secret, q)
  const res = await fetch(`${FAPI}${path}?${q}&signature=${sig}`, {
    headers: { 'X-MBX-APIKEY': c.key },
    signal: AbortSignal.timeout(9000),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Binance ${path} ${res.status}`)
  return res.json()
}

/**
 * Reconstruye operaciones cerradas a partir de los fills: una posición cierra
 * en el fill con realizedPnl != 0; el lado de ese fill da la dirección (SELL
 * cierra un largo, BUY un corto) y el P&L es la suma de los fills del grupo.
 */
function reconstruir(fills: { t: number; side: string; price: number; qty: number; rpnl: number; comm: number }[], sym: string): BinanceOp[] {
  const ops: BinanceOp[] = []
  const orden = [...fills].sort((a, b) => a.t - b.t)
  let grupo: typeof orden = []
  for (const f of orden) {
    grupo.push(f)
    if (f.rpnl !== 0) {
      ops.push({
        sym: sym.replace(/USDT$/, ''),
        dir: f.side === 'SELL' ? 'LONG' : 'SHORT',
        t: f.t, entry: grupo[0].price, exit: f.price,
        rpnl: grupo.reduce((s, x) => s + x.rpnl, 0),
        comm: grupo.reduce((s, x) => s + x.comm, 0),
      })
      grupo = []
    }
  }
  return ops
}

const vacio = (error: string | null): BinanceResumen => ({
  ok: false, error, balance: null, ops: [], nOps: 0, wins: 0, wr: 0,
  pnlBruto: 0, comision: 0, funding: 0, neto: 0, transfer: 0,
})

export async function resultadosBinance(dias = 7): Promise<BinanceResumen> {
  const c = creds()
  if (!c) return vacio('Sin credenciales de Binance disponibles.')

  try {
    const desde = Date.now() - dias * 86_400_000

    const [bal, inc] = await Promise.all([
      firmado('/fapi/v2/balance', {}, c) as Promise<{ asset: string; balance: string }[]>,
      firmado('/fapi/v1/income', { startTime: desde, limit: 1000 }, c) as Promise<{ time: number; incomeType: string; symbol?: string; income: string }[]>,
    ])

    const usdt = bal.find(b => b.asset === 'USDT')
    const agg = { pnlBruto: 0, comision: 0, funding: 0, transfer: 0 }
    for (const r of inc) {
      const v = parseFloat(r.income)
      if (r.incomeType === 'REALIZED_PNL')   agg.pnlBruto += v
      else if (r.incomeType === 'COMMISSION') agg.comision += v
      else if (r.incomeType === 'FUNDING_FEE') agg.funding += v
      else if (r.incomeType === 'TRANSFER')   agg.transfer += v
    }

    // Solo los símbolos que tuvieron P&L realizado necesitan sus fills.
    const syms = Array.from(new Set(inc.filter(r => r.incomeType === 'REALIZED_PNL' && r.symbol).map(r => r.symbol!)))
    const ops: BinanceOp[] = []
    for (const sym of syms) {
      try {
        const ut = await firmado('/fapi/v1/userTrades', { symbol: sym, startTime: desde, limit: 500 }, c) as
          { time: number; side: string; price: string; qty: string; realizedPnl: string; commission: string }[]
        ops.push(...reconstruir(
          ut.map(x => ({ t: x.time, side: x.side, price: +x.price, qty: +x.qty, rpnl: +x.realizedPnl, comm: +x.commission })),
          sym,
        ))
      } catch { /* un símbolo que falle no invalida el resto del resumen */ }
    }
    ops.sort((a, b) => b.t - a.t)

    const wins = ops.filter(o => o.rpnl > 0).length
    return {
      ok: true, error: null,
      balance: usdt ? parseFloat(usdt.balance) : null,
      ops, nOps: ops.length, wins,
      wr: ops.length ? (wins / ops.length) * 100 : 0,
      pnlBruto: agg.pnlBruto, comision: agg.comision, funding: agg.funding,
      neto: agg.pnlBruto + agg.comision + agg.funding,
      transfer: agg.transfer,
    }
  } catch (e) {
    return vacio(e instanceof Error ? e.message : String(e))
  }
}
