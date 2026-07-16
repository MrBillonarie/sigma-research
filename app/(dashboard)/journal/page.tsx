'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/app/lib/supabase'
import { usePortfolio } from '@/app/lib/usePortfolio'
import { C, cardStyle, numberEmboss } from '@/app/lib/constants'

// chart.js + react-chartjs-2 pesan ~70kB y solo hacen falta cuando el usuario
// realmente ve un gráfico — se cargan en un chunk aparte en vez de ir en el
// bundle inicial de /journal.
const chartLoading = () => <div style={{ height: '100%', minHeight: 120 }} />
const Line = dynamic(() => import('./JournalCharts').then(m => m.Line), { ssr: false, loading: chartLoading })
const Bar = dynamic(() => import('./JournalCharts').then(m => m.Bar), { ssr: false, loading: chartLoading })

// ── Types ─────────────────────────────────────────────────────────────────────

interface Trade {
  id: string
  fecha: string
  par: string
  lado: 'LONG' | 'SHORT'
  entry_price: number
  exit_price: number
  sl: number | null
  tp: number | null
  size_usd: number
  pnl_usd: number
  pnl_pct: number
  resultado: 'WIN' | 'LOSS' | 'BREAKEVEN' | null
  notas: string
}

interface CsvTrade {
  id?: string
  user_id?: string
  timestamp: string
  symbol: string
  pnl_bruto: number
  commission: number
  funding_fee: number
  pnl_neto: number
  tipo: 'WIN' | 'LOSS' | 'LIQUIDATION' | 'FUNDING'
  raw_txids: string[]
}

interface ParsedEvent {
  time: Date
  tipo: string
  cantidad: number
  symbol: string
  txid: string
}

// Trade real del motor (cerrado o abierto), tal como lo entrega
// /api/motor/journal — pnl_pct ya es neto (descontada comisión).
interface MotorTrade {
  sym: string; tf: string; direction: 'long' | 'short'; strategy: string; grade: string
  entry: number; exit_price?: number; sl: number; tp: number
  opened_at: string; closed_at?: string; status: string; pnl_pct: number
}
// Trade del motor ya escalado al capital del usuario, en orden cronológico.
interface ScaledTrade extends MotorTrade {
  pnlUsd: number; equityBefore: number; equityAfter: number
}

type FormState = Omit<Trade, 'id' | 'pnl_usd' | 'pnl_pct' | 'resultado'>
type MainFilter = 'ALL' | 'LONG' | 'SHORT' | 'ANÁLISIS'

// ── Static data ───────────────────────────────────────────────────────────────

// `toISOString().slice(0,10)` da la fecha en UTC, no la del usuario — alguien
// en Chile que registra un trade entre ~21:00 y 23:59 hora local vería el
// formulario precargado con la fecha de MAÑANA, porque en ese rango horario
// UTC ya cambió de día. Esto usa los getters locales del navegador.
function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const EMPTY: FormState = {
  fecha: todayLocal(),
  par: '', lado: 'LONG',
  entry_price: 0, exit_price: 0,
  sl: null, tp: null, size_usd: 0, notas: '',
}

const DOW_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const PAGE_SIZE = 25

// ── CSV parsing helpers ───────────────────────────────────────────────────────

function parseBinanceDate(s: string): Date {
  const [datePart, timePart = '00:00:00'] = s.trim().split(' ')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, mi, se] = timePart.split(':').map(Number)
  const year = y < 100 ? 2000 + y : y
  return new Date(Date.UTC(year, m - 1, d, h, mi, se))
}

function col(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) if (row[k] !== undefined) return row[k].trim()
  return ''
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/,/g, '').trim()) || 0
}

async function parseCsvFile(file: File): Promise<ParsedEvent[]> {
  const { default: Papa } = await import('papaparse')
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      transformHeader: (h: string) => h.replace(/^\uFEFF/, '').trim(),
      complete: (results) => {
        try {
          const RELEVANT = new Set(['REALIZED_PNL', 'COMMISSION', 'FUNDING_FEE', 'INSURANCE_CLEAR'])
          const events: ParsedEvent[] = results.data
            .filter(row => {
              const tipo = col(row, 'Tipo', 'Type', 'type')
              return RELEVANT.has(tipo)
            })
            .map(row => ({
              time: parseBinanceDate(col(row, 'Hora', 'Time', 'time')),
              tipo: col(row, 'Tipo', 'Type', 'type'),
              cantidad: parseAmount(col(row, 'Cantidad', 'Amount', 'amount')),
              symbol: col(row, 'Símbolo', 'Symbol', 'symbol', 'Simbolo'),
              txid: col(row, 'ID de transacción', 'Transaction ID', 'tradeId', 'txid', 'TXID'),
            }))
          resolve(events)
        } catch (e) { reject(e) }
      },
      error: reject,
    })
  })
}

function reconstructTrades(events: ParsedEvent[]): CsvTrade[] {
  const pnlEvents = events.filter(e => e.tipo === 'REALIZED_PNL').sort((a, b) => a.time.getTime() - b.time.getTime())
  const commEvents = events.filter(e => e.tipo === 'COMMISSION')
  const liquidEvents = events.filter(e => e.tipo === 'INSURANCE_CLEAR')
  const fundingEvents = events.filter(e => e.tipo === 'FUNDING_FEE')

  const trades: CsvTrade[] = []
  const used = new Set<number>()

  for (let i = 0; i < pnlEvents.length; i++) {
    if (used.has(i)) continue
    const anchor = pnlEvents[i]
    const group: ParsedEvent[] = [anchor]
    used.add(i)

    for (let j = i + 1; j < pnlEvents.length; j++) {
      if (used.has(j)) continue
      const ev = pnlEvents[j]
      if (ev.symbol !== anchor.symbol) continue
      if (ev.time.getTime() - anchor.time.getTime() > 5 * 60 * 1000) break
      group.push(ev)
      used.add(j)
    }

    const pnl_bruto = group.reduce((s, e) => s + e.cantidad, 0)
    const t0 = group[0].time.getTime()
    const t1 = group[group.length - 1].time.getTime()

    const commission = commEvents
      .filter(c => c.symbol === anchor.symbol && c.time.getTime() >= t0 - 120_000 && c.time.getTime() <= t1 + 120_000)
      .reduce((s, c) => s + c.cantidad, 0)

    const pnl_neto = pnl_bruto + commission
    const txids = group.map(e => e.txid).filter(Boolean)

    trades.push({
      timestamp: group[0].time.toISOString(),
      symbol: anchor.symbol,
      pnl_bruto,
      commission,
      funding_fee: 0,
      pnl_neto,
      tipo: pnl_neto >= 0 ? 'WIN' : 'LOSS',
      raw_txids: txids,
    })
  }

  for (const ev of liquidEvents) {
    trades.push({
      timestamp: ev.time.toISOString(),
      symbol: ev.symbol,
      pnl_bruto: ev.cantidad,
      commission: 0,
      funding_fee: 0,
      pnl_neto: ev.cantidad,
      tipo: 'LIQUIDATION',
      raw_txids: [ev.txid].filter(Boolean),
    })
  }

  for (const ev of fundingEvents) {
    trades.push({
      timestamp: ev.time.toISOString(),
      symbol: ev.symbol,
      pnl_bruto: 0,
      commission: 0,
      funding_fee: ev.cantidad,
      pnl_neto: ev.cantidad,
      tipo: 'FUNDING',
      raw_txids: [ev.txid].filter(Boolean),
    })
  }

  return trades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

// ── Analytics computation ─────────────────────────────────────────────────────

interface Analytics {
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  profitFactor: number
  pnlBruto: number
  totalCommissions: number
  totalFunding: number
  pnlNeto: number
  maxDrawdownPct: number
  maxDrawdownIdx: number
  expectancy: number
  sharpe: number
  equityCurve: { date: string; equity: number; win: boolean }[]
  bySymbol: { symbol: string; trades: number; wins: number; pnlNeto: number }[]
  byHour: { hour: number; trades: number; wins: number }[]
  byDow: { dow: number; trades: number; wins: number; pnlNeto: number }[]
  byMonth: { month: string; trades: number; wins: number; pnlNeto: number; pnlBruto: number; pf: number }[]
  histBins: { label: string; count: number; positive: boolean }[]
}

function computeAnalytics(allTrades: CsvTrade[]): Analytics {
  const realTrades = allTrades.filter(t => t.tipo === 'WIN' || t.tipo === 'LOSS').sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const liquidations = allTrades.filter(t => t.tipo === 'LIQUIDATION')
  const totalFunding = allTrades.filter(t => t.tipo === 'FUNDING').reduce((s, t) => s + t.funding_fee, 0)

  const allForStats = [...realTrades, ...liquidations]
  const wins = allForStats.filter(t => t.pnl_neto > 0)
  const losses = allForStats.filter(t => t.pnl_neto <= 0)
  const totalTrades = allForStats.length

  const sumWins = wins.reduce((s, t) => s + t.pnl_neto, 0)
  const sumLosses = Math.abs(losses.reduce((s, t) => s + t.pnl_neto, 0))
  const profitFactor = sumLosses > 0 ? sumWins / sumLosses : sumWins > 0 ? 999 : 0

  const pnlBruto = realTrades.reduce((s, t) => s + t.pnl_bruto, 0)
  const totalCommissions = realTrades.reduce((s, t) => s + t.commission, 0)
  const pnlNeto = realTrades.reduce((s, t) => s + t.pnl_neto, 0) + totalFunding

  // Equity curve + max drawdown
  let equity = 0, peak = 0, maxDD = 0, maxDDIdx = 0
  const equityCurve: { date: string; equity: number; win: boolean }[] = []

  for (let i = 0; i < realTrades.length; i++) {
    equity += realTrades[i].pnl_neto
    if (equity > peak) peak = equity
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0
    if (dd > maxDD) { maxDD = dd; maxDDIdx = i }
    equityCurve.push({ date: realTrades[i].timestamp.slice(0, 10), equity: parseFloat(equity.toFixed(2)), win: realTrades[i].pnl_neto > 0 })
  }

  // Sharpe (annualised, rf=0)
  const dailyMap: Record<string, number> = {}
  for (const t of realTrades) {
    const day = t.timestamp.slice(0, 10)
    dailyMap[day] = (dailyMap[day] || 0) + t.pnl_neto
  }
  const dailyVals = Object.values(dailyMap)
  const mean = dailyVals.reduce((s, v) => s + v, 0) / (dailyVals.length || 1)
  const variance = dailyVals.reduce((s, v) => s + (v - mean) ** 2, 0) / (dailyVals.length || 1)
  const sharpe = Math.sqrt(variance) > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0

  const expectancy = totalTrades > 0 ? pnlNeto / totalTrades : 0

  // By symbol
  const symMap: Record<string, { trades: number; wins: number; pnlNeto: number }> = {}
  for (const t of allForStats) {
    if (!symMap[t.symbol]) symMap[t.symbol] = { trades: 0, wins: 0, pnlNeto: 0 }
    symMap[t.symbol].trades++
    if (t.pnl_neto > 0) symMap[t.symbol].wins++
    symMap[t.symbol].pnlNeto += t.pnl_neto
  }
  const bySymbol = Object.entries(symMap).map(([symbol, v]) => ({ symbol, ...v })).sort((a, b) => b.pnlNeto - a.pnlNeto)

  // By hour
  const hourMap: Record<number, { trades: number; wins: number }> = {}
  for (const t of allForStats) {
    const h = new Date(t.timestamp).getUTCHours()
    if (!hourMap[h]) hourMap[h] = { trades: 0, wins: 0 }
    hourMap[h].trades++
    if (t.pnl_neto > 0) hourMap[h].wins++
  }
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, ...(hourMap[h] || { trades: 0, wins: 0 }) }))

  // By day of week
  const dowMap: Record<number, { trades: number; wins: number; pnlNeto: number }> = {}
  for (const t of allForStats) {
    const d = new Date(t.timestamp).getUTCDay()
    if (!dowMap[d]) dowMap[d] = { trades: 0, wins: 0, pnlNeto: 0 }
    dowMap[d].trades++
    if (t.pnl_neto > 0) dowMap[d].wins++
    dowMap[d].pnlNeto += t.pnl_neto
  }
  const byDow = Array.from({ length: 7 }, (_, d) => ({ dow: d, ...(dowMap[d] || { trades: 0, wins: 0, pnlNeto: 0 }) }))

  // By month
  const monthMap: Record<string, { trades: number; wins: number; pnlNeto: number; pnlBruto: number; lossSum: number }> = {}
  for (const t of allForStats) {
    const m = t.timestamp.slice(0, 7)
    if (!monthMap[m]) monthMap[m] = { trades: 0, wins: 0, pnlNeto: 0, pnlBruto: 0, lossSum: 0 }
    monthMap[m].trades++
    if (t.pnl_neto > 0) monthMap[m].wins++
    else monthMap[m].lossSum += Math.abs(t.pnl_neto)
    monthMap[m].pnlNeto += t.pnl_neto
    monthMap[m].pnlBruto += t.pnl_bruto
  }
  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month, trades: v.trades, wins: v.wins, pnlNeto: v.pnlNeto, pnlBruto: v.pnlBruto,
      pf: v.lossSum > 0 ? Math.abs(wins.filter(t => t.timestamp.startsWith(month)).reduce((s, t) => s + t.pnl_neto, 0)) / v.lossSum : 0,
    }))

  // PnL histogram (bins of $0.50)
  const pnlVals = allForStats.map(t => t.pnl_neto)
  const minVal = pnlVals.length ? Math.min(...pnlVals) : -1
  const maxVal = pnlVals.length ? Math.max(...pnlVals) : 1
  const BIN = 0.5
  const nBins = Math.min(Math.ceil((maxVal - minVal) / BIN) + 1, 80)
  const histBins = Array.from({ length: nBins }, (_, i) => {
    const lo = minVal + i * BIN
    const hi = lo + BIN
    return { label: `$${lo.toFixed(1)}`, count: pnlVals.filter(v => v >= lo && v < hi).length, positive: lo >= 0 }
  })

  return {
    totalTrades, wins: wins.length, losses: losses.length,
    winRate: totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0,
    profitFactor, pnlBruto, totalCommissions, totalFunding, pnlNeto,
    maxDrawdownPct: maxDD, maxDrawdownIdx: maxDDIdx,
    expectancy, sharpe, equityCurve,
    bySymbol, byHour, byDow, byMonth, histBins,
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtUsd(v: number): string {
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${v >= 0 ? '+' : '-'}$${abs}`
}
function fmtUsdPlain(v: number): string {
  return `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtN(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmt(v: number): string {
  return `${v >= 0 ? '+' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function elapsedSince(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  const days = Math.floor(hrs / 24)
  return `${days}d ${hrs % 24}h`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>{label}</span>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, outline: 'none',
  color: C.text, fontFamily: 'monospace', fontSize: 13, padding: '9px 12px',
  fontVariantNumeric: 'tabular-nums', width: '100%', borderRadius: C.radiusSm,
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

function MetricCard({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div style={{ ...cardStyle, background: C.bg, padding: '14px 16px' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 26, color: color || C.gold, lineHeight: 1, textShadow: numberEmboss }}>{value}</div>
      {sub && <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function SectionHeader({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 16 }}>
      {children}
    </div>
  )
}

// ─── Sección de ANÁLISIS con numeración visual — mismo lenguaje narrativo
// que ya usamos para los motores en /modelos (número grande y pálido + título).
function AnalysisSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...cardStyle, background: C.surface, padding: '20px 24px', display: 'flex', gap: 18 }}>
      <span style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 34, color: `${C.gold}40`, lineHeight: 1, flexShrink: 0, minWidth: 30 }}>{n}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <SectionHeader>{title}</SectionHeader>
        {children}
      </div>
    </div>
  )
}

// Intensidad del acento de color por resultado — escala con la magnitud del
// movimiento, no solo binario ganó/perdió. `magnitude` ya viene normalizado 0..1.
function resultAccent(magnitude: number, color: string): { border: string; bg: string } {
  const t = Math.min(Math.max(magnitude, 0), 1)
  const alpha = Math.round(8 + t * 22).toString(16).padStart(2, '0') // 08..1e
  return { border: color, bg: `${color}${alpha}` }
}

// ── CountUp — anima de valor previo → target con ease-out cúbico ─────────────
function useCountUp(target: number, dur = 1100) {
  const [v, setV] = useState(0)
  const vRef    = useRef(0)
  const fromRef = useRef(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      vRef.current = target; fromRef.current = target; setV(target)
      return
    }
    const from = fromRef.current
    let raf = 0
    let t0: number | null = null
    const tick = (t: number) => {
      if (t0 === null) t0 = t
      const p = Math.min(1, (t - t0) / dur)
      const val = from + (target - from) * (1 - Math.pow(1 - p, 3))
      vRef.current = val
      setV(val)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); fromRef.current = vRef.current }
  }, [target, dur])
  return v
}

function CountText({ target, format }: { target: number; format: (v: number) => string }) {
  const v = useCountUp(target)
  return <>{format(v)}</>
}

// ── Barra SL → Entrada → TP del trade abierto (posición del precio en vivo) ──
function OpenLevelBar({ entry, sl, tp, pnlPct, direction }: {
  entry: number; sl: number; tp: number; pnlPct: number; direction: 'long' | 'short'
}) {
  if (!entry || !sl || !tp) return null
  const price = direction === 'long' ? entry * (1 + pnlPct / 100) : entry * (1 - pnlPct / 100)
  const lo = Math.min(sl, tp), hi = Math.max(sl, tp)
  const span = hi - lo || 1
  const pos = (v: number) => Math.min(98, Math.max(2, ((v - lo) / span) * 100))
  const slLeft = sl < tp
  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ position: 'relative', height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${slLeft ? C.red : C.green}30, ${C.border} 45%, ${C.border} 55%, ${slLeft ? C.green : C.red}30)` }}>
        {/* entrada */}
        <div style={{ position: 'absolute', top: -3, left: `${pos(entry)}%`, transform: 'translateX(-50%)', width: 2, height: 12, background: C.dimText }} />
        {/* precio actual */}
        <div className="j-price" style={{
          position: 'absolute', top: -4, left: `${pos(price)}%`, transform: 'translateX(-50%)',
          width: 14, height: 14, borderRadius: '50%',
          background: pnlPct >= 0 ? C.green : C.red,
          boxShadow: `0 0 12px ${pnlPct >= 0 ? C.green : C.red}`,
          border: `2px solid ${C.bg}`, transition: 'left 0.6s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 9, color: C.muted, marginTop: 6 }}>
        <span style={{ color: slLeft ? C.red : C.green }}>{slLeft ? 'SL' : 'TP'} ${fmtN(lo)}</span>
        <span style={{ color: C.dimText }}>entrada ${fmtN(entry)}</span>
        <span style={{ color: slLeft ? C.green : C.red }}>{slLeft ? 'TP' : 'SL'} ${fmtN(hi)}</span>
      </div>
    </div>
  )
}

// ── Equity curve cinematográfica — canvas con trazo progresivo, valle del
// max drawdown sombreado y punto final pulsante. ──────────────────────────────
function EquityCanvas({ curve, ddIdx, ddPct }: {
  curve: { date: string; equity: number; win: boolean }[]; ddIdx: number; ddPct: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hoverRef  = useRef<number | null>(null)
  const dataRef   = useRef({ curve, ddIdx, ddPct })
  const startRef  = useRef(0)

  useEffect(() => {
    dataRef.current = { curve, ddIdx, ddPct }
    startRef.current = typeof performance !== 'undefined' ? performance.now() : 0
  }, [curve, ddIdx, ddPct])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0, visible = true, W = 0, H = 0
    const ML = 64, MR = 20, MT = 20, MB = 26

    function resize() {
      if (!cv) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = cv.clientWidth; H = cv.clientHeight
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(cv)
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting }, { threshold: 0.05 }); io.observe(cv)

    function scene(now: number) {
      const { curve: A, ddIdx: DD, ddPct: DDP } = dataRef.current
      const n = A.length
      if (n < 2 || W === 0) return
      const p = reduced ? 1 : 1 - Math.pow(1 - Math.min(1, (now - startRef.current) / 1300), 3)
      const pulse = reduced ? 0 : Math.sin(now / 480)

      const vals = A.map(a => a.equity)
      let minV = Math.min(0, ...vals), maxV = Math.max(...vals)
      const pad = (maxV - minV) * 0.1 || 1
      minV -= pad; maxV += pad
      const xs = (i: number) => ML + (i / (n - 1)) * (W - ML - MR)
      const ys = (v: number) => MT + (1 - (v - minV) / (maxV - minV)) * (H - MT - MB)

      ctx!.clearRect(0, 0, W, H)

      // grid + labels y
      ctx!.font = '9px monospace'; ctx!.textAlign = 'right'
      for (let g = 0; g <= 4; g++) {
        const v = minV + ((maxV - minV) / 4) * g
        const y = ys(v)
        ctx!.strokeStyle = 'rgba(57,226,230,0.06)'; ctx!.lineWidth = 1; ctx!.setLineDash([3, 5])
        ctx!.beginPath(); ctx!.moveTo(ML, y); ctx!.lineTo(W - MR, y); ctx!.stroke(); ctx!.setLineDash([])
        ctx!.fillStyle = C.dimText
        ctx!.fillText(`$${Math.round(v).toLocaleString('en-US')}`, ML - 8, y + 3)
      }
      // labels x (~6 fechas)
      ctx!.textAlign = 'center'
      const stepX = Math.max(1, Math.floor((n - 1) / 6))
      for (let i = 0; i < n; i += stepX) {
        ctx!.fillStyle = C.muted
        ctx!.fillText(A[i].date.slice(5), xs(i), H - 8)
      }
      // línea de cero si hay negativos
      if (minV < 0) {
        const zy = ys(0)
        ctx!.strokeStyle = 'rgba(232,233,240,0.14)'; ctx!.setLineDash([5, 5])
        ctx!.beginPath(); ctx!.moveTo(ML, zy); ctx!.lineTo(W - MR, zy); ctx!.stroke(); ctx!.setLineDash([])
      }

      // valle del max drawdown — región sombreada del pico previo al fondo
      if (DDP > 0.5 && DD > 0) {
        let peakIdx = 0
        for (let i = 1; i <= DD; i++) if (A[i].equity > A[peakIdx].equity) peakIdx = i
        if (peakIdx < DD) {
          const x0 = xs(peakIdx), x1 = xs(DD)
          ctx!.fillStyle = 'rgba(248,113,113,0.07)'
          ctx!.fillRect(x0, MT, x1 - x0, H - MT - MB)
          ctx!.font = '600 9px monospace'; ctx!.textAlign = 'center'
          ctx!.fillStyle = C.red
          ctx!.fillText(`MAX DD -${DDP.toFixed(1)}%`, (x0 + x1) / 2, H - MB - 6)
        }
      }

      // trazo progresivo con clip
      const revealX = ML + p * (W - ML - MR)
      ctx!.save()
      ctx!.beginPath(); ctx!.rect(ML - 2, 0, revealX - ML + 4, H); ctx!.clip()
      // área
      const grad = ctx!.createLinearGradient(0, MT, 0, H - MB)
      grad.addColorStop(0, 'rgba(57,226,230,0.28)')
      grad.addColorStop(1, 'rgba(57,226,230,0.02)')
      ctx!.beginPath()
      ctx!.moveTo(xs(0), ys(Math.max(0, minV) === 0 && minV < 0 ? 0 : minV))
      ctx!.lineTo(xs(0), ys(A[0].equity))
      for (let i = 1; i < n; i++) ctx!.lineTo(xs(i), ys(A[i].equity))
      ctx!.lineTo(xs(n - 1), ys(minV < 0 ? 0 : minV))
      ctx!.closePath()
      ctx!.fillStyle = grad
      ctx!.fill()
      // línea con glow
      ctx!.save()
      ctx!.shadowColor = C.gold; ctx!.shadowBlur = 10
      ctx!.strokeStyle = C.glow; ctx!.lineWidth = 2.2; ctx!.lineJoin = 'round'
      ctx!.beginPath()
      ctx!.moveTo(xs(0), ys(A[0].equity))
      for (let i = 1; i < n; i++) ctx!.lineTo(xs(i), ys(A[i].equity))
      ctx!.stroke()
      ctx!.restore()
      ctx!.restore()

      // punto final pulsante + etiqueta
      if (p >= 0.98) {
        const fx = xs(n - 1), fy = ys(A[n - 1].equity)
        ctx!.strokeStyle = `rgba(57,226,230,${0.35 - pulse * 0.15})`
        ctx!.lineWidth = 1.5
        ctx!.beginPath(); ctx!.arc(fx, fy, 7 + pulse * 2.5, 0, Math.PI * 2); ctx!.stroke()
        ctx!.save()
        ctx!.shadowColor = C.gold; ctx!.shadowBlur = 10
        ctx!.fillStyle = C.glow
        ctx!.beginPath(); ctx!.arc(fx, fy, 3.5, 0, Math.PI * 2); ctx!.fill()
        ctx!.restore()
        const lbl = `${A[n - 1].equity >= 0 ? '+' : '-'}$${Math.abs(Math.round(A[n - 1].equity)).toLocaleString('en-US')}`
        ctx!.font = '700 11px monospace'
        ctx!.textAlign = 'right'
        ctx!.fillStyle = A[n - 1].equity >= 0 ? C.green : C.red
        ctx!.fillText(lbl, fx - 12, Math.max(fy - 10, MT + 12))
      }

      // hover crosshair + tooltip
      const hi = hoverRef.current
      if (hi !== null && hi >= 0 && hi < n) {
        const hx = xs(hi), hv = A[hi].equity, hy = ys(hv)
        ctx!.strokeStyle = 'rgba(232,233,240,0.14)'; ctx!.lineWidth = 1
        ctx!.beginPath(); ctx!.moveTo(hx, MT); ctx!.lineTo(hx, H - MB); ctx!.stroke()
        ctx!.fillStyle = A[hi].win ? C.green : C.red
        ctx!.beginPath(); ctx!.arc(hx, hy, 3.5, 0, Math.PI * 2); ctx!.fill()
        const delta = hi > 0 ? hv - A[hi - 1].equity : hv
        const lines = [A[hi].date, `PnL acum: ${hv >= 0 ? '+' : '-'}$${Math.abs(hv).toFixed(2)}`, `trade: ${delta >= 0 ? '+' : '-'}$${Math.abs(delta).toFixed(2)}`]
        ctx!.font = '600 10px monospace'
        const bw = Math.max(...lines.map(t => ctx!.measureText(t).width)) + 20
        let bx = hx + 12
        if (bx + bw > W - 6) bx = hx - bw - 12
        ctx!.fillStyle = 'rgba(11,13,20,0.95)'
        ctx!.fillRect(bx, MT + 6, bw, 52)
        ctx!.strokeStyle = 'rgba(57,226,230,0.35)'
        ctx!.strokeRect(bx + 0.5, MT + 6.5, bw - 1, 51)
        ctx!.textAlign = 'left'
        ctx!.fillStyle = C.dimText; ctx!.fillText(lines[0], bx + 10, MT + 21)
        ctx!.fillStyle = C.glow;    ctx!.fillText(lines[1], bx + 10, MT + 37)
        ctx!.fillStyle = delta >= 0 ? C.green : C.red
        ctx!.fillText(lines[2], bx + 10, MT + 52)
      }
    }

    function loop(now: number) {
      if (visible && !document.hidden) scene(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    function onMove(e: MouseEvent) {
      const r = cv!.getBoundingClientRect()
      const n = dataRef.current.curve.length
      const x = e.clientX - r.left
      const L = 64, R = r.width - 20
      if (x < L - 6 || x > R + 6 || n < 2) { hoverRef.current = null; return }
      hoverRef.current = Math.round(((x - L) / (R - L)) * (n - 1))
    }
    function onLeave() { hoverRef.current = null }
    cv.addEventListener('mousemove', onMove)
    cv.addEventListener('mouseleave', onLeave)
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
      cv.removeEventListener('mousemove', onMove)
      cv.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <div style={{ height: 280 }}>
      <canvas ref={canvasRef} role="img" aria-label="Curva de equity acumulada de los trades del journal" style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }} />
    </div>
  )
}

// ── Mapa de calor por hora (24 celdas) ────────────────────────────────────────
function HourHeat({ byHour }: { byHour: { hour: number; trades: number; wins: number }[] }) {
  const maxN = Math.max(1, ...byHour.map(r => r.trades))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
      {byHour.map(r => {
        const wr = r.trades > 0 ? (r.wins / r.trades) * 100 : 0
        const int = r.trades > 0 ? 0.14 + (r.trades / maxN) * 0.5 : 0
        const color = wr >= 50 ? C.green : C.red
        return (
          <div key={r.hour}
            title={r.trades > 0 ? `${String(r.hour).padStart(2, '0')}:00 UTC · ${r.trades} trades · ${wr.toFixed(0)}% WR` : `${String(r.hour).padStart(2, '0')}:00 UTC · sin trades`}
            style={{
              padding: '7px 4px', textAlign: 'center', borderRadius: 3, cursor: 'default',
              background: r.trades > 0 ? `${color}${Math.round(int * 255).toString(16).padStart(2, '0')}` : `${C.border}40`,
              border: `1px solid ${r.trades > 0 ? `${color}50` : C.border}`,
            }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: r.trades > 0 ? C.text : C.muted }}>{String(r.hour).padStart(2, '0')}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: r.trades > 0 ? color : C.muted }}>
              {r.trades > 0 ? `${wr.toFixed(0)}%` : '·'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Mapa de calor por día de semana (7 celdas) ────────────────────────────────
function DowHeat({ byDow }: { byDow: { dow: number; trades: number; wins: number; pnlNeto: number }[] }) {
  const maxP = Math.max(1, ...byDow.map(r => Math.abs(r.pnlNeto)))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
      {byDow.map(r => {
        const wr = r.trades > 0 ? (r.wins / r.trades) * 100 : 0
        const pos = r.pnlNeto >= 0
        const color = pos ? C.green : C.red
        const int = r.trades > 0 ? 0.14 + (Math.abs(r.pnlNeto) / maxP) * 0.5 : 0
        return (
          <div key={r.dow}
            title={r.trades > 0 ? `${DOW_NAMES[r.dow]} · ${r.trades} trades · ${wr.toFixed(0)}% WR · ${fmtUsd(r.pnlNeto)}` : `${DOW_NAMES[r.dow]} · sin trades`}
            style={{
              padding: '8px 4px', textAlign: 'center', borderRadius: 3, cursor: 'default',
              background: r.trades > 0 ? `${color}${Math.round(int * 255).toString(16).padStart(2, '0')}` : `${C.border}40`,
              border: `1px solid ${r.trades > 0 ? `${color}50` : C.border}`,
            }}>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: r.trades > 0 ? C.text : C.muted }}>{DOW_NAMES[r.dow]}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: r.trades > 0 ? color : C.muted }}>
              {r.trades > 0 ? `${wr.toFixed(0)}%` : '·'}
            </div>
            {r.trades > 0 && (
              <div style={{ fontFamily: 'monospace', fontSize: 8, color: C.dimText }}>{r.pnlNeto >= 0 ? '+' : '-'}${Math.abs(Math.round(r.pnlNeto))}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function JournalPage() {
  // Manual trades state
  const [trades, setTrades] = useState<Trade[]>([])
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [filter,       setFilter]       = useState<MainFilter>('ALL')
  const [search,       setSearch]       = useState('')
  const [resultFilter, setResultFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'BREAKEVEN'>('ALL')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // CSV import state
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvParsed, setCsvParsed] = useState<CsvTrade[] | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvProcessing, setCsvProcessing] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvImportMsg, setCsvImportMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // CSV trades from Supabase
  const [csvTrades, setCsvTrades] = useState<CsvTrade[]>([])
  const [csvPage, setCsvPage] = useState(0)

  // Sección secundaria (manual + CSV) colapsada por defecto — la vista
  // principal ahora es el registro del motor escalado al capital del usuario.
  const [showManual, setShowManual] = useState(false)

  // ── Motor en vivo × capital del usuario ─────────────────────────────────────
  const { totalUSD: portfolioCapital, ready: portfolioReady } = usePortfolio()
  const [motorClosed,  setMotorClosed]  = useState<MotorTrade[]>([])
  const [motorOpen,    setMotorOpen]    = useState<MotorTrade[]>([])
  const [motorLoading, setMotorLoading] = useState(true)
  const [motorError,   setMotorError]   = useState<string | null>(null)
  const [motorPage,    setMotorPage]    = useState(0)

  const fetchMotorJournal = useCallback(async () => {
    try {
      const res = await fetch('/api/motor/journal', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { closed?: MotorTrade[]; open?: MotorTrade[] }
      setMotorClosed(data.closed ?? [])
      setMotorOpen(data.open ?? [])
      setMotorError(null)
    } catch {
      setMotorError('Sin conexión al motor. Intenta más tarde.')
    }
    setMotorLoading(false)
  }, [])

  // Fetch inicial + poll cada 60s para que el trade abierto se sienta en vivo
  useEffect(() => {
    fetchMotorJournal()
    const id = setInterval(fetchMotorJournal, 60_000)
    return () => clearInterval(id)
  }, [fetchMotorJournal])

  // Load manual trades and sync to localStorage for dashboard
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      supabase.from('trades').select('*').eq('user_id', user.id).order('fecha', { ascending: false })
        .then(({ data }) => {
          if (data) {
            setTrades(data as Trade[])
            try { localStorage.setItem('sigma_trades', JSON.stringify(data)) } catch {}
          }
          setLoading(false)
        })
    })
  }, [])

  // Load csv_trades
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('csv_trades').select('*').eq('user_id', user.id).order('timestamp', { ascending: true })
        .then(({ data }) => { if (data) setCsvTrades(data as CsvTrade[]) })
    })
  }, [])

  // ── CSV handlers ────────────────────────────────────────────────────────────

  async function handleProcessCsv() {
    if (!csvFile) return
    setCsvProcessing(true)
    setCsvError(null)
    setCsvImportMsg(null)
    try {
      const events = await parseCsvFile(csvFile)
      if (!events.length) throw new Error('No se encontraron eventos válidos. Verifica que el CSV sea de Binance Futures Transaction History.')
      const reconstructed = reconstructTrades(events)
      if (!reconstructed.filter(t => t.tipo !== 'FUNDING').length) throw new Error('No se pudieron reconstruir trades. El CSV necesita eventos REALIZED_PNL.')
      setCsvParsed(reconstructed)
    } catch (e) {
      setCsvError(e instanceof Error ? e.message : 'Error procesando el CSV')
    }
    setCsvProcessing(false)
  }

  async function handleConfirmImport() {
    if (!csvParsed || !csvFile) return
    setCsvImporting(true)
    setCsvError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      // Dedup by existing TXIDs
      const { data: existing } = await supabase.from('csv_trades').select('raw_txids').eq('user_id', user.id)
      const existingTxids = new Set<string>()
      if (existing) for (const row of existing) if (Array.isArray(row.raw_txids)) row.raw_txids.forEach((t: string) => existingTxids.add(t))

      const newTrades = csvParsed.filter(t => !t.raw_txids.some(id => existingTxids.has(id)))
      if (newTrades.length === 0) {
        setCsvError('Este CSV ya fue importado (todos los TXIDs existen en la base de datos).')
        setCsvImporting(false)
        return
      }

      const { error: insertErr } = await supabase.from('csv_trades').insert(newTrades.map(t => ({ ...t, user_id: user.id })))
      if (insertErr) throw new Error(insertErr.message)

      const dates = csvParsed.map(t => new Date(t.timestamp).getTime()).filter(d => !isNaN(d))
      const dateFrom = dates.length ? new Date(Math.min(...dates)).toISOString() : new Date().toISOString()
      const dateTo   = dates.length ? new Date(Math.max(...dates)).toISOString() : new Date().toISOString()
      const { error: importErr } = await supabase.from('csv_imports').insert({
        user_id: user.id,
        filename: csvFile.name,
        total_trades: newTrades.length,
        date_from: dateFrom,
        date_to: dateTo,
        imported_at: new Date().toISOString(),
      })
      // los trades ya se guardaron arriba; el registro de import es secundario
      if (importErr) console.error('[journal] no se guardó el registro de import:', importErr.message)

      const { data: fresh } = await supabase.from('csv_trades').select('*').eq('user_id', user.id).order('timestamp', { ascending: true })
      if (fresh) setCsvTrades(fresh as CsvTrade[])

      setCsvImportMsg(`✓ ${newTrades.length} trades importados correctamente.`)
      setCsvParsed(null)
      setCsvFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setCsvPage(0)
      setFilter('ANÁLISIS')
    } catch (e) {
      setCsvError(e instanceof Error ? e.message : 'Error al guardar en base de datos')
    }
    setCsvImporting(false)
  }

  // ── Analytics ───────────────────────────────────────────────────────────────

  const analytics = useMemo(() => csvTrades.length ? computeAnalytics(csvTrades) : null, [csvTrades])

  // ── Motor escalado al capital del usuario ───────────────────────────────────

  // Capital de referencia — mismo patrón que /lp-defi: sin patrimonio
  // registrado se usa $1.000 de demo para poder mostrar la página igual.
  const motorCapital = portfolioCapital > 0 ? portfolioCapital : 1000

  // El motor sizea cada trade con Kelly como % de SU equity en ese momento,
  // así que pnl_pct es independiente de la base de capital — componer esa
  // misma secuencia, en orden cronológico, sobre el capital del usuario
  // reproduce exactamente qué le habría pasado a SU plata siguiendo al motor.
  const scaledTrades = useMemo<ScaledTrade[]>(() => {
    let equity = motorCapital
    return motorClosed.map(t => {
      const equityBefore = equity
      // Una cuenta liquidada (equity en 0) no puede seguir operando — el %
      // deja de aplicarse en vez de "revivir" capital de la nada, que
      // invertiría visualmente el signo de los trades siguientes.
      const pnlUsd = equityBefore > 0 ? equityBefore * (t.pnl_pct / 100) : 0
      equity = Math.max(0, equityBefore + pnlUsd)
      return { ...t, pnlUsd, equityBefore, equityAfter: equity }
    })
  }, [motorClosed, motorCapital])

  const motorEquityFinal = scaledTrades.length ? scaledTrades[scaledTrades.length - 1].equityAfter : motorCapital
  const motorLiquidated  = scaledTrades.some(t => t.equityAfter === 0 && t.equityBefore > 0)

  // Trade(s) abiertos — P&L flotante sobre la equity actual, no realizado.
  const scaledOpen = useMemo(() =>
    motorOpen.map(t => ({ ...t, pnlUsd: motorEquityFinal * (t.pnl_pct / 100) })),
    [motorOpen, motorEquityFinal])

  // Reutiliza computeAnalytics() (ya probado con CSV) mapeando las filas
  // escaladas a su misma forma — da win rate/PF/drawdown/Sharpe/equity curve/
  // breakdowns sin duplicar lógica. Comisión/funding siempre 0: pnl_pct del
  // motor ya viene neto.
  const motorAsCsv = useMemo<CsvTrade[]>(() => scaledTrades.map(t => ({
    timestamp: t.closed_at ?? t.opened_at,
    symbol: t.sym,
    pnl_bruto: t.pnlUsd,
    commission: 0,
    funding_fee: 0,
    pnl_neto: t.pnlUsd,
    tipo: t.pnl_pct >= 0 ? 'WIN' : 'LOSS',
    raw_txids: [],
  })), [scaledTrades])

  const motorAnalytics = useMemo(() => motorAsCsv.length ? computeAnalytics(motorAsCsv) : null, [motorAsCsv])

  const scaledTradesDesc = useMemo(() => [...scaledTrades].reverse(), [scaledTrades])
  const motorPageData    = scaledTradesDesc.slice(motorPage * PAGE_SIZE, (motorPage + 1) * PAGE_SIZE)
  const motorTotalPages  = Math.ceil(scaledTradesDesc.length / PAGE_SIZE)

  // ── Manual trade handlers ───────────────────────────────────────────────────

  function calcPnl(entry: number, exit: number, lado: 'LONG' | 'SHORT', size: number) {
    if (!entry || !exit || !size) return { pnl_usd: 0, pnl_pct: 0 }
    const mult = lado === 'LONG' ? 1 : -1
    const pnl_pct = mult * ((exit - entry) / entry) * 100
    return { pnl_usd: (pnl_pct / 100) * size, pnl_pct }
  }

  function autoResultado(pnl: number): 'WIN' | 'LOSS' | 'BREAKEVEN' {
    if (pnl > 0.01) return 'WIN'
    if (pnl < -0.01) return 'LOSS'
    return 'BREAKEVEN'
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.par.trim()) e.par = 'Requerido'
    if (!form.entry_price) e.entry_price = 'Debe ser > 0'
    if (!form.exit_price) e.exit_price = 'Debe ser > 0'
    if (!form.size_usd) e.size_usd = 'Debe ser > 0'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    setSaveError(null)
    const { pnl_usd, pnl_pct } = calcPnl(form.entry_price, form.exit_price, form.lado, form.size_usd)
    const resultado = autoResultado(pnl_usd)
    const payload = { ...form, pnl_usd, pnl_pct, resultado }

    let ok = false

    if (editing) {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { setSaving(false); return }
      // Filtrar por id Y user_id — protección doble si RLS falla
      const { error } = await supabase.from('trades').update(payload).eq('id', editing).eq('user_id', u.id)
      if (!error) {
        setTrades(ts => ts.map(t => t.id === editing ? { ...t, ...payload } : t))
        setEditing(null)
        ok = true
      } else {
        setSaveError(error.message)
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSaving(false); return }
      const { data, error } = await supabase.from('trades').insert({ ...payload, user_id: user.id }).select().single()
      if (!error && data) {
        setTrades(ts => {
          const next = [data as Trade, ...ts]
          try { localStorage.setItem('sigma_trades', JSON.stringify(next)) } catch {}
          return next
        })
        ok = true
      } else if (error) {
        setSaveError(error.message)
      }
    }

    setSaving(false)
    // Solo limpiar el formulario si de verdad se guardó — si falló, el usuario
    // necesita ver sus datos intactos y el mensaje de error, no un form vacío.
    if (ok) setForm({ ...EMPTY, fecha: todayLocal() })
  }

  function handleEdit(t: Trade) {
    setEditing(t.id)
    setForm({ fecha: t.fecha, par: t.par, lado: t.lado, entry_price: t.entry_price, exit_price: t.exit_price, sl: t.sl, tp: t.tp, size_usd: t.size_usd, notas: t.notas })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Filtrar por id Y user_id — nunca borrar trades de otro usuario
    await supabase.from('trades').delete().eq('id', id).eq('user_id', user.id)
    setTrades(ts => ts.filter(t => t.id !== id))
    try { localStorage.setItem('sigma_trades', JSON.stringify(trades.filter(t => t.id !== id))) } catch {}
    if (editing === id) { setEditing(null); setForm({ ...EMPTY }) }
  }

  // ── Derived data ────────────────────────────────────────────────────────────

  const visible = useMemo(() => {
    if (filter === 'ANÁLISIS') return []
    let r = filter === 'ALL' ? trades : trades.filter(t => t.lado === filter)
    if (search.trim())          r = r.filter(t => t.par.toUpperCase().includes(search.trim().toUpperCase()))
    if (resultFilter !== 'ALL') r = r.filter(t => t.resultado === resultFilter)
    if (dateFrom)               r = r.filter(t => t.fecha >= dateFrom)
    if (dateTo)                 r = r.filter(t => t.fecha <= dateTo)
    return r
  }, [trades, filter, search, resultFilter, dateFrom, dateTo])

  const stats = useMemo(() => {
    if (!trades.length) return { total: 0, wins: 0, winRate: 0, pnl: 0, best: 0, worst: 0, avgSize: 0 }
    const wins = trades.filter(t => t.resultado === 'WIN').length
    const pnls = trades.map(t => t.pnl_usd)
    return {
      total: trades.length, wins,
      winRate: Math.round((wins / trades.length) * 100),
      pnl: pnls.reduce((a, b) => a + b, 0),
      best: Math.max(...pnls), worst: Math.min(...pnls),
      avgSize: trades.reduce((a, t) => a + (t.size_usd || 0), 0) / trades.length,
    }
  }, [trades])

  const csvTradesSorted = useMemo(() =>
    [...csvTrades].filter(t => t.tipo !== 'FUNDING').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [csvTrades])
  const csvPageData = csvTradesSorted.slice(csvPage * PAGE_SIZE, (csvPage + 1) * PAGE_SIZE)
  const csvTotalPages = Math.ceil(csvTradesSorted.length / PAGE_SIZE)

  const csvPreviewTrades = csvParsed ? csvParsed.filter(t => t.tipo !== 'FUNDING') : []
  const csvPreviewFunding = csvParsed ? csvParsed.filter(t => t.tipo === 'FUNDING').reduce((s, t) => s + t.funding_fee, 0) : 0

  function exportTradesCSV() {
    if (!trades.length) return
    const headers = ['Fecha', 'Par', 'Lado', 'Entrada', 'Salida', 'SL', 'TP', 'Tamaño USD', 'PnL USD', 'PnL %', 'Resultado', 'Notas']
    const rows = trades.map(t => [
      t.fecha, t.par, t.lado,
      t.entry_price, t.exit_price,
      t.sl ?? '', t.tp ?? '',
      t.size_usd, t.pnl_usd.toFixed(2), t.pnl_pct.toFixed(2),
      t.resultado ?? '', `"${(t.notas ?? '').replace(/"/g, '""')}"`,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `sigma-journal-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportPDF() {
    if (!trades.length) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const now = new Date()
    const dateStr = now.toLocaleDateString('es-CL')
    const W = 210

    // ─ Header
    doc.setFillColor(4, 5, 10)
    doc.rect(0, 0, W, 40, 'F')
    doc.setTextColor(57,226,230)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('SIGMA RESEARCH', 14, 16)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('PERFORMANCE REPORT — JOURNAL', 14, 23)
    doc.setTextColor(122, 127, 154)
    doc.text(`Generado: ${dateStr}`, 14, 30)
    doc.text(`Trades analizados: ${stats.total}`, W - 14, 30, { align: 'right' })

    // ─ KPI grid
    const kpis = [
      { label: 'WIN RATE',      value: `${stats.winRate}%`,                         color: stats.winRate >= 50 ? '#34d399' : '#f87171' },
      { label: 'PNL TOTAL',     value: `${stats.pnl >= 0 ? '+' : ''}$${Math.round(stats.pnl).toLocaleString('es-CL')}`, color: stats.pnl >= 0 ? '#34d399' : '#f87171' },
      { label: 'BEST TRADE',    value: `+$${Math.round(stats.best).toLocaleString('es-CL')}`, color: '#34d399' },
      { label: 'WORST TRADE',   value: `$${Math.round(stats.worst).toLocaleString('es-CL')}`, color: '#f87171' },
      { label: 'TOTAL TRADES',  value: String(stats.total),                          color: '#39e2e6' },
      { label: 'AVG SIZE',      value: `$${Math.round(stats.avgSize).toLocaleString('es-CL')}`, color: '#7a7f9a' },
    ]
    const colW = (W - 28) / 3
    kpis.forEach((k, i) => {
      const col = i % 3, row = Math.floor(i / 3)
      const x = 14 + col * (colW + 4), y = 50 + row * 24
      doc.setFillColor(11, 13, 20)
      doc.rect(x, y, colW, 20, 'F')
      doc.setTextColor(122, 127, 154); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
      doc.text(k.label, x + 4, y + 7)
      const [r, g, b] = k.color.match(/\w\w/g)!.map(h => parseInt(h, 16))
      doc.setTextColor(r, g, b); doc.setFontSize(14); doc.setFont('helvetica', 'bold')
      doc.text(k.value, x + 4, y + 16)
    })

    // ─ Recent trades table
    let y = 106
    doc.setTextColor(57,226,230); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('// ÚLTIMOS 20 TRADES', 14, y)
    y += 6
    doc.setFillColor(26, 29, 46)
    doc.rect(14, y, W - 28, 6, 'F')
    doc.setTextColor(122, 127, 154); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    const cols = [14, 34, 64, 84, 104, 134, 160]
    const headers2 = ['FECHA', 'PAR', 'LADO', 'ENTRY', 'EXIT', 'PNL USD', 'RESULTADO']
    headers2.forEach((h, i) => doc.text(h, cols[i], y + 4))
    y += 8

    const recent = [...trades].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 20)
    for (const t of recent) {
      if (y > 270) break
      const isWin = t.resultado === 'WIN'
      doc.setFillColor(isWin ? 11 : 20, isWin ? 20 : 11, isWin ? 15 : 11)
      doc.rect(14, y - 3, W - 28, 6, 'F')
      doc.setTextColor(232, 233, 240); doc.setFontSize(7)
      doc.text(t.fecha?.slice(5) ?? '', cols[0], y + 1)
      doc.text(t.par ?? '', cols[1], y + 1)
      const ladoColor = t.lado === 'LONG' ? [52, 211, 153] : [248, 113, 113]
      doc.setTextColor(ladoColor[0], ladoColor[1], ladoColor[2])
      doc.text(t.lado ?? '', cols[2], y + 1)
      doc.setTextColor(232, 233, 240)
      doc.text(String(t.entry_price ?? '—'), cols[3], y + 1)
      doc.text(String(t.exit_price ?? '—'), cols[4], y + 1)
      const pnlColor = (t.pnl_usd ?? 0) >= 0 ? [52, 211, 153] : [248, 113, 113]
      doc.setTextColor(pnlColor[0], pnlColor[1], pnlColor[2])
      doc.text(`${(t.pnl_usd ?? 0) >= 0 ? '+' : ''}$${Math.round(t.pnl_usd ?? 0)}`, cols[5], y + 1)
      const resColor = isWin ? [52, 211, 153] : [248, 113, 113]
      doc.setTextColor(resColor[0], resColor[1], resColor[2])
      doc.text(t.resultado ?? '—', cols[6], y + 1)
      y += 6
    }

    // ─ Footer
    doc.setTextColor(58, 63, 85); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.text('SIGMA RESEARCH · SURVIVE FIRST · WIN AFTER', W / 2, 287, { align: 'center' })

    doc.save(`sigma-report-${now.toISOString().slice(0, 10)}.pdf`)
  }

  function exportMotorCSV() {
    if (!scaledTrades.length) return
    const headers = ['Abierto', 'Cerrado', 'Símbolo', 'TF', 'Dirección', 'Estrategia', 'Grade', 'Entry', 'Exit', 'PnL %', 'PnL USD (tu capital)', 'Equity', 'Estado']
    const rows = scaledTrades.map(t => [
      t.opened_at, t.closed_at ?? '', t.sym, t.tf, t.direction.toUpperCase(), t.strategy, t.grade,
      t.entry, t.exit_price ?? '', t.pnl_pct.toFixed(2), t.pnlUsd.toFixed(2), t.equityAfter.toFixed(2), t.status,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `sigma-motor-journal-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportMotorPDF() {
    if (!motorAnalytics || !scaledTrades.length) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const now = new Date()
    const dateStr = now.toLocaleDateString('es-CL')
    const W = 210

    doc.setFillColor(4, 5, 10)
    doc.rect(0, 0, W, 40, 'F')
    doc.setTextColor(57,226,230)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('SIGMA RESEARCH', 14, 16)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('MOTOR EN VIVO × TU CAPITAL — JOURNAL', 14, 23)
    doc.setTextColor(122, 127, 154)
    doc.text(`Generado: ${dateStr}`, 14, 30)
    doc.text(`Capital base: $${Math.round(motorCapital).toLocaleString('es-CL')}`, W - 14, 30, { align: 'right' })

    const kpis = [
      { label: 'WIN RATE',      value: `${motorAnalytics.winRate.toFixed(1)}%`, color: motorAnalytics.winRate >= 50 ? '#34d399' : '#f87171' },
      { label: 'PROFIT FACTOR', value: motorAnalytics.profitFactor >= 999 ? '∞' : motorAnalytics.profitFactor.toFixed(2), color: motorAnalytics.profitFactor >= 1 ? '#34d399' : '#f87171' },
      { label: 'PNL NETO',      value: `${motorAnalytics.pnlNeto >= 0 ? '+' : ''}$${Math.round(motorAnalytics.pnlNeto).toLocaleString('es-CL')}`, color: motorAnalytics.pnlNeto >= 0 ? '#34d399' : '#f87171' },
      { label: 'MAX DRAWDOWN',  value: `${motorAnalytics.maxDrawdownPct.toFixed(1)}%`, color: '#f87171' },
      { label: 'TOTAL TRADES',  value: String(motorAnalytics.totalTrades), color: '#39e2e6' },
      { label: 'EQUITY ACTUAL', value: `$${Math.round(motorEquityFinal).toLocaleString('es-CL')}`, color: '#39e2e6' },
    ]
    const colW = (W - 28) / 3
    kpis.forEach((k, i) => {
      const col = i % 3, row = Math.floor(i / 3)
      const x = 14 + col * (colW + 4), y = 50 + row * 24
      doc.setFillColor(11, 13, 20)
      doc.rect(x, y, colW, 20, 'F')
      doc.setTextColor(122, 127, 154); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
      doc.text(k.label, x + 4, y + 7)
      const [r, g, b] = k.color.match(/\w\w/g)!.map(h => parseInt(h, 16))
      doc.setTextColor(r, g, b); doc.setFontSize(14); doc.setFont('helvetica', 'bold')
      doc.text(k.value, x + 4, y + 16)
    })

    let y = 106
    doc.setTextColor(57,226,230); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('// ÚLTIMOS 20 TRADES DEL MOTOR', 14, y)
    y += 6
    doc.setFillColor(26, 29, 46)
    doc.rect(14, y, W - 28, 6, 'F')
    doc.setTextColor(122, 127, 154); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    const cols = [14, 36, 60, 90, 120, 150, 175]
    const headers2 = ['CERRADO', 'SÍMBOLO', 'DIR', 'ESTRATEGIA', 'PNL %', 'PNL USD', 'EQUITY']
    headers2.forEach((h, i) => doc.text(h, cols[i], y + 4))
    y += 8

    const recent = [...scaledTrades].reverse().slice(0, 20)
    for (const t of recent) {
      if (y > 270) break
      const isWin = t.pnl_pct >= 0
      doc.setFillColor(isWin ? 11 : 20, isWin ? 20 : 11, isWin ? 15 : 11)
      doc.rect(14, y - 3, W - 28, 6, 'F')
      doc.setTextColor(232, 233, 240); doc.setFontSize(7)
      doc.text((t.closed_at ?? t.opened_at).slice(5, 16).replace('T', ' '), cols[0], y + 1)
      doc.text(t.sym, cols[1], y + 1)
      const dirColor = t.direction === 'long' ? [52, 211, 153] : [248, 113, 113]
      doc.setTextColor(dirColor[0], dirColor[1], dirColor[2])
      doc.text(t.direction.toUpperCase(), cols[2], y + 1)
      doc.setTextColor(232, 233, 240)
      doc.text(t.strategy.replace(/_/g, ' '), cols[3], y + 1)
      const pnlColor = isWin ? [52, 211, 153] : [248, 113, 113]
      doc.setTextColor(pnlColor[0], pnlColor[1], pnlColor[2])
      doc.text(`${isWin ? '+' : ''}${t.pnl_pct.toFixed(2)}%`, cols[4], y + 1)
      doc.text(`${t.pnlUsd >= 0 ? '+' : ''}$${Math.round(t.pnlUsd)}`, cols[5], y + 1)
      doc.setTextColor(122, 127, 154)
      doc.text(`$${Math.round(t.equityAfter).toLocaleString('es-CL')}`, cols[6], y + 1)
      y += 6
    }

    doc.setTextColor(58, 63, 85); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.text('SIGMA RESEARCH · SURVIVE FIRST · WIN AFTER', W / 2, 287, { align: 'center' })

    doc.save(`sigma-motor-report-${now.toISOString().slice(0, 10)}.pdf`)
  }

  // ── Chart options ────────────────────────────────────────────────────────────

  const chartTooltipDefaults = {
    backgroundColor: C.surface, borderColor: C.border, borderWidth: 1,
    titleColor: C.dimText, bodyColor: C.text, padding: 8,
  }
  const xScaleDefaults = { ticks: { color: C.dimText, font: { family: 'monospace', size: 10 } }, grid: { color: '#1a1b23' } }
  const yScaleDefaults = { ticks: { color: C.dimText, font: { family: 'monospace', size: 10 } }, grid: { color: '#1a1b23' } }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono,'DM Mono',monospace)" }}>
      <style>{`
        .j-input:focus{border-color:${C.gold}!important;box-shadow:0 0 0 1px ${C.gold}33}
        .j-ping { animation: jPing 1.6s cubic-bezier(0,0,.2,1) infinite }
        @keyframes jPing { 75%,100% { transform:scale(2.4); opacity:0 } }
        .j-breathe { animation: jBreathe 2.4s ease-in-out infinite }
        @keyframes jBreathe { 0%,100% { transform:scale(1) } 50% { transform:scale(1.035) } }
        .j-live-sweep { position:absolute; top:0; bottom:0; width:45%; left:-60%; pointer-events:none;
          background:linear-gradient(105deg,transparent,${C.gold}0a,transparent);
          animation: jSweep 5.5s ease-in-out infinite }
        @keyframes jSweep { 0%,55% { left:-60% } 85%,100% { left:115% } }
        .j-in { animation: jIn .38s ease both }
        @keyframes jIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
        @media (prefers-reduced-motion: reduce) {
          .j-ping, .j-breathe, .j-live-sweep, .j-in { animation:none }
        }
      `}</style>
      <div className="dash-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>
              {'// JOURNAL · MOTOR EN VIVO × TU CAPITAL'}
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue',var(--font-bebas),Impact,sans-serif", fontSize: 'clamp(40px,5vw,72px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
              <span style={{ color: C.text }}>TRADE</span>{' '}
              <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#2f6bd6)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>JOURNAL</span>
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={exportMotorCSV}
              disabled={!scaledTrades.length}
              style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${C.border}`, color: C.dimText, fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', cursor: scaledTrades.length ? 'pointer' : 'not-allowed', opacity: scaledTrades.length ? 1 : 0.4 }}
            >↓ CSV</button>
            <button
              onClick={exportMotorPDF}
              disabled={!scaledTrades.length}
              style={{ padding: '8px 16px', background: scaledTrades.length ? `${C.gold}18` : 'transparent', border: `1px solid ${scaledTrades.length ? C.gold : C.border}`, color: scaledTrades.length ? C.gold : C.muted, fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', cursor: scaledTrades.length ? 'pointer' : 'not-allowed', opacity: scaledTrades.length ? 1 : 0.5 }}
            >↓ PDF REPORT</button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* MOTOR EN VIVO × CAPITAL DEL USUARIO — sección primaria             */}
        {/* ════════════════════════════════════════════════════════════════════ */}

        {/* Apartado dedicado a explicar qué es esto — orienta a quien llega
            por primera vez, antes de mostrarle ningún número. */}
        <div style={{ ...cardStyle, background: C.surface, border: `1px dashed ${C.gold}50`, padding: '18px 22px', marginBottom: 16 }}>
          <SectionHeader>{'// ¿QUÉ ES ESTE JOURNAL?'}</SectionHeader>
          <p style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, lineHeight: 1.8, margin: '0 0 8px' }}>
            No es un diario que tú llenas — es el registro real de <strong style={{ color: C.text }}>SIGMA ENGINE</strong>. Cada trade que ves abajo es una operación que el motor efectivamente ejecutó; su retorno % se aplica en cadena sobre <strong style={{ color: C.gold }}>tu capital</strong> (el de <a href="/portafolio" style={{ color: C.gold, textDecoration: 'none' }}>tu portafolio</a>), no sobre la cuenta paper interna del motor.
          </p>
          <p style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, lineHeight: 1.8, margin: 0 }}>
            El conteo arranca desde el día que creaste tu cuenta — no se te atribuyen operaciones del motor anteriores a tu ingreso. El trade abierto (si hay uno) muestra P&L flotante en vivo y se actualiza cada minuto. Es una simulación con fines informativos: el motor no gestiona capital de terceros.
          </p>
        </div>

        {portfolioCapital === 0 && portfolioReady && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            background: `${C.gold}14`, border: `1px solid ${C.gold}50`,
            padding: '12px 16px', marginBottom: 16, borderRadius: C.radiusSm,
          }}>
            <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.2em', color: C.gold, background: `${C.gold}22`, padding: '3px 8px', flexShrink: 0 }}>
              CAPITAL DE REFERENCIA
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, lineHeight: 1.5 }}>
              Mostrando el motor sobre <strong style={{ color: C.gold }}>$1.000</strong> de referencia. Configura tu portafolio para ver tu capital real.
            </span>
            <a href="/portafolio" style={{ fontFamily: 'monospace', fontSize: 10, color: C.gold, textDecoration: 'none', border: `1px solid ${C.gold}44`, padding: '4px 10px', flexShrink: 0 }}>
              IR A PORTAFOLIO →
            </a>
          </div>
        )}

        {motorError && (
          <div style={{ padding: '14px 18px', background: `${C.red}12`, border: `1px solid ${C.red}40`, marginBottom: 16, fontFamily: 'monospace', fontSize: 11, color: C.red, borderRadius: C.radiusSm }}>
            ⚠ {motorError}
          </div>
        )}

        {motorLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="animate-pulse" style={{ ...cardStyle, background: C.surface, height: 80 }} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>

            {/* Trade(s) abierto — en vivo, P&L flotante sobre tu capital */}
            {scaledOpen.map((t, i) => {
              const slPct = t.entry > 0 ? Math.abs(((t.sl - t.entry) / t.entry) * 100) : 0
              const tpPct = t.entry > 0 ? Math.abs(((t.tp - t.entry) / t.entry) * 100) : 0
              return (
              <div key={i} className="j-live" style={{ ...cardStyle, background: `linear-gradient(160deg,${C.gold}0c,${C.surface} 55%)`, borderLeft: `3px solid ${C.gold}`, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden' }}>
                {/* barrido sutil de fondo — la tarjeta está viva */}
                <div className="j-live-sweep" aria-hidden />
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20, position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
                      <span className="j-ping" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: C.gold, opacity: 0.5 }} />
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.gold, boxShadow: `0 0 8px ${C.gold}` }} />
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.2em', color: C.gold }}>EN VIVO · NO REALIZADO</span>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: C.text }}>{t.sym}</div>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, padding: '2px 8px', color: t.direction === 'long' ? C.green : C.red, background: `${t.direction === 'long' ? C.green : C.red}12`, border: `1px solid ${t.direction === 'long' ? C.green : C.red}40` }}>
                    {t.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                  </span>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>{t.strategy.replace(/_/g, ' ')} · {t.grade} · {t.tf}</div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div className="j-breathe" style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 30, color: t.pnlUsd >= 0 ? C.green : C.red, textShadow: `${numberEmboss}, 0 0 18px ${t.pnlUsd >= 0 ? C.green : C.red}40` }}>
                      {fmt(t.pnlUsd)}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>{t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct.toFixed(2)}%</div>
                  </div>
                </div>
                {/* Dónde va el precio dentro del rango SL → TP */}
                <OpenLevelBar entry={t.entry} sl={t.sl} tp={t.tp} pnlPct={t.pnl_pct} direction={t.direction} />
                {/* Pequeño resumen de la posición — contexto, no solo el P&L */}
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, paddingTop: 8, borderTop: `1px solid ${C.border}`, position: 'relative' }}>
                  Abierta hace {elapsedSince(t.opened_at)} · Entry <span style={{ color: C.text }}>${fmtN(t.entry)}</span>
                  {' · '}SL <span style={{ color: C.red }}>${fmtN(t.sl)}</span> <span style={{ color: C.muted }}>(-{slPct.toFixed(1)}%)</span>
                  {' · '}TP <span style={{ color: C.green }}>${fmtN(t.tp)}</span> <span style={{ color: C.muted }}>(+{tpPct.toFixed(1)}%)</span>
                </div>
              </div>
              )
            })}

            {motorAnalytics ? (
              <>
                {/* Resumen ejecutivo */}
                <AnalysisSection n={1} title="RESUMEN EJECUTIVO">
                  {motorLiquidated && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${C.red}12`, border: `1px solid ${C.red}40`, padding: '10px 14px', marginBottom: 14 }}>
                      <span style={{ color: C.red, fontSize: 14, flexShrink: 0 }}>⚠</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, lineHeight: 1.6 }}>
                        Tu capital simulado llegó a <strong style={{ color: C.red }}>$0</strong> en una operación con pérdida ≥100%. Los trades posteriores del motor no pueden recuperar capital que ya no existe — por eso la equity se mantiene en $0 desde ese punto.
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 10 }}>
                    <MetricCard label="Capital base" value={`$${fmtN(motorCapital)}`} sub={portfolioCapital > 0 ? 'tu portafolio' : 'referencia'} />
                    <MetricCard label="Total Trades" value={<CountText target={motorAnalytics.totalTrades} format={v => Math.round(v).toString()} />} />
                    <MetricCard label="Win Rate" value={<CountText target={motorAnalytics.winRate} format={v => `${v.toFixed(1)}%`} />} color={motorAnalytics.winRate >= 50 ? C.green : C.red} />
                    <MetricCard label="Profit Factor" value={motorAnalytics.profitFactor >= 999 ? '∞' : <CountText target={motorAnalytics.profitFactor} format={v => v.toFixed(2)} />} color={motorAnalytics.profitFactor >= 1.5 ? C.green : motorAnalytics.profitFactor >= 1 ? C.yellow : C.red} />
                    <MetricCard label="PnL Neto" value={<CountText target={motorAnalytics.pnlNeto} format={fmtUsd} />} color={motorAnalytics.pnlNeto >= 0 ? C.green : C.red} />
                    <MetricCard label="Max Drawdown" value={<CountText target={motorAnalytics.maxDrawdownPct} format={v => `${v.toFixed(1)}%`} />} color={C.red} />
                    <MetricCard label="Expectancy" value={fmtUsd(motorAnalytics.expectancy)} sub="por trade" color={motorAnalytics.expectancy >= 0 ? C.green : C.red} />
                    <MetricCard label="Sharpe Ratio" value={motorAnalytics.sharpe.toFixed(2)} sub="anualizado rf=0" color={motorAnalytics.sharpe >= 1 ? C.green : motorAnalytics.sharpe >= 0 ? C.yellow : C.red} />
                    <MetricCard label="Equity actual" value={<CountText target={motorEquityFinal} format={v => `$${fmtN(v)}`} />} color={C.gold} />
                  </div>
                </AnalysisSection>

                {/* Equity curve */}
                <AnalysisSection n={2} title="EQUITY CURVE — TU CAPITAL SIGUIENDO AL MOTOR">
                  {motorAnalytics.equityCurve.length > 1 ? (
                    <EquityCanvas
                      curve={motorAnalytics.equityCurve}
                      ddIdx={motorAnalytics.maxDrawdownIdx}
                      ddPct={motorAnalytics.maxDrawdownPct}
                    />
                  ) : (
                    <div style={{ padding: 32, textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: C.muted }}>Insuficientes datos para graficar</div>
                  )}
                </AnalysisSection>

                {/* Distribución PnL */}
                <AnalysisSection n={3} title="DISTRIBUCIÓN PnL">
                  <div style={{ height: Math.min(400, Math.max(200, motorAnalytics.histBins.length * 18)) }}>
                    <Bar
                      data={{
                        labels: motorAnalytics.histBins.map(b => b.label),
                        datasets: [{
                          label: 'Frecuencia', data: motorAnalytics.histBins.map(b => b.count),
                          backgroundColor: motorAnalytics.histBins.map(b => b.positive ? `${C.green}70` : `${C.red}70`),
                          borderColor: motorAnalytics.histBins.map(b => b.positive ? C.green : C.red), borderWidth: 1,
                        }],
                      }}
                      options={{
                        indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: chartTooltipDefaults },
                        scales: { x: xScaleDefaults, y: { ...yScaleDefaults, ticks: { ...yScaleDefaults.ticks, font: { family: 'monospace', size: 9 } } } },
                      }}
                    />
                  </div>
                </AnalysisSection>

                {/* Breakdown por dimensión */}
                <AnalysisSection n={4} title="BREAKDOWN POR DIMENSIÓN">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 20 }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: '0.15em', marginBottom: 8 }}>POR SÍMBOLO</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
                        <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          {['Símbolo', 'N', 'WR%', 'PnL'].map(h => <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: C.muted, fontWeight: 400, fontSize: 9 }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {motorAnalytics.bySymbol.slice(0, 10).map(row => (
                            <tr key={row.symbol} style={{ borderBottom: `1px solid ${C.border}20` }}>
                              <td style={{ padding: '5px 8px', color: C.text }}>{row.symbol}</td>
                              <td style={{ padding: '5px 8px', color: C.dimText }}>{row.trades}</td>
                              <td style={{ padding: '5px 8px', color: row.wins / row.trades >= 0.5 ? C.green : C.red }}>{((row.wins / row.trades) * 100).toFixed(0)}%</td>
                              <td style={{ padding: '5px 8px', color: row.pnlNeto >= 0 ? C.green : C.red }}>{fmtUsd(row.pnlNeto)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: '0.15em', marginBottom: 8 }}>
                        POR HORA UTC <span style={{ color: C.muted, letterSpacing: 0 }}>· color = win rate · brillo = actividad</span>
                      </div>
                      <HourHeat byHour={motorAnalytics.byHour} />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: '0.15em', marginBottom: 8 }}>
                        POR DÍA DE SEMANA <span style={{ color: C.muted, letterSpacing: 0 }}>· color = PnL · brillo = magnitud</span>
                      </div>
                      <DowHeat byDow={motorAnalytics.byDow} />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: '0.15em', marginBottom: 8 }}>POR MES</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
                        <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          {['Mes', 'N', 'WR%', 'PnL Neto'].map(h => <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: C.muted, fontWeight: 400, fontSize: 9 }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {motorAnalytics.byMonth.map(row => {
                            const wr = row.trades > 0 ? (row.wins / row.trades) * 100 : 0
                            return (
                              <tr key={row.month} style={{ borderBottom: `1px solid ${C.border}20` }}>
                                <td style={{ padding: '5px 8px', color: C.text }}>{row.month}</td>
                                <td style={{ padding: '5px 8px', color: C.dimText }}>{row.trades}</td>
                                <td style={{ padding: '5px 8px', color: wr >= 50 ? C.green : C.red }}>{wr.toFixed(0)}%</td>
                                <td style={{ padding: '5px 8px', color: row.pnlNeto >= 0 ? C.green : C.red }}>{fmtUsd(row.pnlNeto)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </AnalysisSection>

                {/* Tabla de trades del motor */}
                <AnalysisSection n={5} title="TRADES DEL MOTOR">
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          {['Cerrado', 'Símbolo', 'Dir', 'Estrategia', 'Grade', 'PnL %', 'PnL USD', 'Equity', 'Estado'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: C.dimText, fontWeight: 400, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody key={`mp-${motorPage}`}>
                        {motorPageData.map((t, i) => {
                          const isWin = t.pnl_pct >= 0
                          const accentColor = isWin ? C.green : C.red
                          const accent = resultAccent(Math.abs(t.pnl_pct) / 8, accentColor)
                          const baseBg = i % 2 === 1 ? C.surface2 : 'transparent'
                          return (
                            <tr key={`${t.sym}-${t.opened_at}`} className="j-in" style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${accent.border}`, background: baseBg, transition: 'background 0.15s', animationDelay: `${Math.min(i, 14) * 35}ms` }}
                              onMouseEnter={e => (e.currentTarget.style.background = accent.bg)}
                              onMouseLeave={e => (e.currentTarget.style.background = baseBg)}>
                              <td style={{ padding: '10px 14px', color: C.dimText, whiteSpace: 'nowrap' }}>{(t.closed_at ?? '').slice(0, 16).replace('T', ' ')}</td>
                              <td style={{ padding: '10px 14px', color: C.text, fontWeight: 600 }}>{t.sym}</td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 10, padding: '2px 7px', color: t.direction === 'long' ? C.green : C.red, background: `${t.direction === 'long' ? C.green : C.red}12`, border: `1px solid ${t.direction === 'long' ? C.green : C.red}35` }}>
                                  {t.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', color: C.dimText }}>{t.strategy.replace(/_/g, ' ')}</td>
                              <td style={{ padding: '10px 14px', color: C.gold }}>{t.grade}</td>
                              <td style={{ padding: '10px 14px', color: isWin ? C.green : C.red, fontVariantNumeric: 'tabular-nums' }}>{isWin ? '+' : ''}{t.pnl_pct.toFixed(2)}%</td>
                              <td style={{ padding: '10px 14px', color: isWin ? C.green : C.red, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(t.pnlUsd)}</td>
                              <td style={{ padding: '10px 14px', color: C.dimText, fontVariantNumeric: 'tabular-nums' }}>${fmtN(t.equityAfter)}</td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{ fontSize: 10, letterSpacing: '0.1em', padding: '2px 6px', border: `1px solid ${accentColor}40`, color: accentColor }}>{t.status}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {motorTotalPages > 1 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
                      <button onClick={() => setMotorPage(p => Math.max(0, p - 1))} disabled={motorPage === 0}
                        style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${C.border}`, color: C.dimText, fontFamily: 'monospace', fontSize: 11, cursor: motorPage === 0 ? 'default' : 'pointer', opacity: motorPage === 0 ? 0.4 : 1 }}>
                        ← PREV
                      </button>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>{motorPage + 1} / {motorTotalPages}</span>
                      <button onClick={() => setMotorPage(p => Math.min(motorTotalPages - 1, p + 1))} disabled={motorPage === motorTotalPages - 1}
                        style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${C.border}`, color: C.dimText, fontFamily: 'monospace', fontSize: 11, cursor: motorPage === motorTotalPages - 1 ? 'default' : 'pointer', opacity: motorPage === motorTotalPages - 1 ? 0.4 : 1 }}>
                        NEXT →
                      </button>
                    </div>
                  )}
                </AnalysisSection>
              </>
            ) : (
              <div style={{ padding: 48, textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: C.muted, ...cardStyle, background: C.surface }}>
                Aún no hay trades del motor desde que te uniste. Tu journal se va a ir llenando en vivo a medida que el motor opere — sin atribuirte operaciones anteriores a tu cuenta.
              </div>
            )}
          </div>
        )}

        {/* Toggle sección secundaria */}
        <button
          onClick={() => setShowManual(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'space-between',
            padding: '12px 18px', marginBottom: showManual ? 16 : 32, background: C.surface, border: `1px solid ${C.border}`,
            color: C.dimText, fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', cursor: 'pointer',
          }}
        >
          <span>{'// TUS TRADES (MANUAL + CSV PROPIO)'}</span>
          <span>{showManual ? '▾ OCULTAR' : '▸ MOSTRAR'}</span>
        </button>

        {showManual && (
        <>
        {/* Manual stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total trades', value: stats.total.toString(), color: C.gold },
            { label: 'Win Rate', value: `${stats.winRate}%`, color: stats.winRate >= 50 ? C.green : C.red },
            { label: 'P&L Total', value: fmt(stats.pnl), color: stats.pnl >= 0 ? C.green : C.red },
            { label: 'Mejor trade', value: trades.length ? fmt(stats.best) : '—', color: C.green },
            { label: 'Peor trade', value: trades.length ? fmt(stats.worst) : '—', color: C.red },
            { label: 'Tamaño medio', value: trades.length ? `$${fmtN(stats.avgSize)}` : '—', color: C.dimText },
          ].map(s => (
            <div key={s.label} style={{ ...cardStyle, background: C.surface, padding: '16px 18px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: s.color, lineHeight: 1, textShadow: numberEmboss }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── CSV Import ──────────────────────────────────────────────────────── */}
        <div style={{ ...cardStyle, background: C.surface, border: `1px dashed ${C.gold}50`, padding: '20px 24px', marginBottom: 24 }}>
          <SectionHeader>{'// IMPORTAR CSV BINANCE FUTURES'}</SectionHeader>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer' }}
            >
              ↑ SELECCIONAR CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) { setCsvFile(f); setCsvParsed(null); setCsvError(null); setCsvImportMsg(null) }
              }}
            />
            {csvFile && (
              <>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📄 {csvFile.name}
                </span>
                <button
                  onClick={handleProcessCsv}
                  disabled={csvProcessing}
                  style={{ padding: '9px 18px', background: C.gold, color: C.bg, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', border: 'none', cursor: csvProcessing ? 'wait' : 'pointer', opacity: csvProcessing ? 0.7 : 1 }}
                >
                  {csvProcessing ? 'PROCESANDO…' : 'PROCESAR'}
                </button>
              </>
            )}
          </div>

          {csvError && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: `${C.red}15`, border: `1px solid ${C.red}40`, fontFamily: 'monospace', fontSize: 11, color: C.red }}>
              ⚠ {csvError}
            </div>
          )}
          {csvImportMsg && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: `${C.green}15`, border: `1px solid ${C.green}40`, fontFamily: 'monospace', fontSize: 11, color: C.green }}>
              {csvImportMsg} Abriendo tab ANÁLISIS…
            </div>
          )}

          {/* Preview table */}
          {csvParsed && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', color: C.dimText, marginBottom: 10 }}>
                PREVIEW — {csvPreviewTrades.length} trades reconstruidos · Funding total: {fmtUsd(csvPreviewFunding)}
                {csvParsed.filter(t => t.tipo === 'LIQUIDATION').length > 0 && ` · ${csvParsed.filter(t => t.tipo === 'LIQUIDATION').length} liquidaciones`}
              </div>
              <div style={{ overflowX: 'auto', marginBottom: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Fecha', 'Símbolo', 'PnL Bruto', 'Comisión', 'PnL Neto', 'Tipo'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: C.dimText, fontWeight: 400, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreviewTrades.slice(0, 5).map((t, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '8px 12px', color: C.dimText, whiteSpace: 'nowrap' }}>{t.timestamp.slice(0, 16).replace('T', ' ')}</td>
                        <td style={{ padding: '8px 12px', color: C.text }}>{t.symbol}</td>
                        <td style={{ padding: '8px 12px', color: t.pnl_bruto >= 0 ? C.green : C.red }}>{fmtUsd(t.pnl_bruto)}</td>
                        <td style={{ padding: '8px 12px', color: C.red }}>{fmtUsd(t.commission)}</td>
                        <td style={{ padding: '8px 12px', color: t.pnl_neto >= 0 ? C.green : C.red, fontWeight: 600 }}>{fmtUsd(t.pnl_neto)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: 10, letterSpacing: '0.1em', padding: '2px 6px', border: `1px solid ${t.tipo === 'WIN' ? C.green : t.tipo === 'LOSS' ? C.red : C.yellow}40`, color: t.tipo === 'WIN' ? C.green : t.tipo === 'LOSS' ? C.red : C.yellow }}>
                            {t.tipo}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleConfirmImport}
                disabled={csvImporting}
                style={{ padding: '10px 24px', background: C.green, color: C.bg, fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', border: 'none', cursor: csvImporting ? 'wait' : 'pointer', opacity: csvImporting ? 0.7 : 1 }}
              >
                {csvImporting ? 'IMPORTANDO…' : `✓ CONFIRMAR IMPORTACIÓN (${csvPreviewTrades.length} trades)`}
              </button>
            </div>
          )}
        </div>

        {/* ── Manual trade form ───────────────────────────────────────────────── */}
        <div style={{ ...cardStyle, background: C.surface, padding: '24px', marginBottom: 24 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: editing ? C.yellow : C.gold, marginBottom: 16 }}>
            {editing ? '// EDITAR TRADE' : '// NUEVO TRADE'}
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16, marginBottom: 16 }}>
              <Field label="Fecha">
                <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className="j-input" style={inputStyle} />
              </Field>
              <Field label="Par">
                <input type="text" placeholder="BTC/USDT" value={form.par} onChange={e => setForm(f => ({ ...f, par: e.target.value.toUpperCase() }))} className="j-input" style={{ ...inputStyle, borderColor: errors.par ? C.red : C.border }} />
                {errors.par && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.red }}>{errors.par}</span>}
              </Field>
              <Field label="Dirección">
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['LONG', 'SHORT'] as const).map(d => (
                    <button key={d} type="button" onClick={() => setForm(f => ({ ...f, lado: d }))}
                      style={{ flex: 1, padding: '9px', fontFamily: 'monospace', fontSize: 12, cursor: 'pointer', border: `1px solid ${form.lado === d ? (d === 'LONG' ? C.green : C.red) : C.border}`, background: form.lado === d ? (d === 'LONG' ? `${C.green}15` : `${C.red}15`) : C.surface, color: form.lado === d ? (d === 'LONG' ? C.green : C.red) : C.dimText, letterSpacing: '0.1em' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Entrada ($)">
                <input type="number" step="any" min="0" placeholder="0.00" value={form.entry_price || ''} onChange={e => setForm(f => ({ ...f, entry_price: parseFloat(e.target.value) || 0 }))} className="j-input" style={{ ...inputStyle, borderColor: errors.entry_price ? C.red : C.border }} />
                {errors.entry_price && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.red }}>{errors.entry_price}</span>}
              </Field>
              <Field label="Salida ($)">
                <input type="number" step="any" min="0" placeholder="0.00" value={form.exit_price || ''} onChange={e => setForm(f => ({ ...f, exit_price: parseFloat(e.target.value) || 0 }))} className="j-input" style={{ ...inputStyle, borderColor: errors.exit_price ? C.red : C.border }} />
                {errors.exit_price && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.red }}>{errors.exit_price}</span>}
              </Field>
              <Field label="Tamaño (USD)">
                <input type="number" step="any" min="0" placeholder="500" value={form.size_usd || ''} onChange={e => setForm(f => ({ ...f, size_usd: parseFloat(e.target.value) || 0 }))} className="j-input" style={{ ...inputStyle, borderColor: errors.size_usd ? C.red : C.border }} />
                {errors.size_usd && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.red }}>{errors.size_usd}</span>}
              </Field>
              <Field label="Stop Loss ($)">
                <input type="number" step="any" min="0" placeholder="opcional" value={form.sl || ''} onChange={e => setForm(f => ({ ...f, sl: parseFloat(e.target.value) || null }))} className="j-input" style={inputStyle} />
              </Field>
              <Field label="Take Profit ($)">
                <input type="number" step="any" min="0" placeholder="opcional" value={form.tp || ''} onChange={e => setForm(f => ({ ...f, tp: parseFloat(e.target.value) || null }))} className="j-input" style={inputStyle} />
              </Field>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Field label="Notas">
                <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Setup, contexto, lección aprendida…" rows={2} className="j-input" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </Field>
            </div>
            {saveError && (
              <div style={{ marginBottom: 14, padding: '10px 14px', background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: C.radiusSm, fontFamily: 'monospace', fontSize: 11, color: C.red }}>
                ⚠ No se pudo guardar: {saveError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving} style={{ padding: '10px 28px', background: C.gold, color: C.bg, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'GUARDANDO…' : editing ? 'ACTUALIZAR' : 'GUARDAR TRADE'}
              </button>
              {editing && (
                <button type="button" onClick={() => { setEditing(null); setForm({ ...EMPTY }); setSaveError(null) }} style={{ padding: '10px 20px', background: 'transparent', color: C.dimText, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
                  CANCELAR
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 1, background: C.border, marginBottom: 1 }}>
          {(['ALL', 'LONG', 'SHORT'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '10px 20px', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', border: 'none', cursor: 'pointer', background: filter === f ? C.gold : C.surface, color: filter === f ? C.bg : C.dimText }}>
              {f === 'ALL' ? 'TODOS' : f}
            </button>
          ))}
          {csvTrades.length > 0 && (
            <button onClick={() => setFilter('ANÁLISIS')}
              style={{ padding: '10px 20px', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', border: 'none', cursor: 'pointer', background: filter === 'ANÁLISIS' ? C.gold : C.surface, color: filter === 'ANÁLISIS' ? C.bg : C.dimText }}>
              ANÁLISIS
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            {trades.length > 0 && filter !== 'ANÁLISIS' && (
              <>
                <button onClick={exportTradesCSV}
                  style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', border: 'none', cursor: 'pointer', background: C.surface, color: C.gold }}>
                  ↓ EXPORTAR CSV
                </button>
                <button onClick={exportPDF}
                  style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', border: 'none', cursor: 'pointer', background: C.surface, color: C.gold }}>
                  ↓ EXPORTAR PDF
                </button>
              </>
            )}
            <div style={{ background: C.surface, padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>
              {filter === 'ANÁLISIS' ? `${csvTradesSorted.length} trades CSV` : `${visible.length} trade${visible.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>

        {/* ── Barra de búsqueda y filtros ─────────────────────────────────────── */}
        {filter !== 'ANÁLISIS' && (
          <div style={{ display: 'flex', gap: 1, background: C.border, marginBottom: 1, flexWrap: 'wrap' }}>
            {/* Búsqueda por par */}
            <div style={{ flex: '1 1 160px', background: C.surface, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>⌕</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="BTC, ETH, SOL…"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'monospace', fontSize: 11, color: C.text, minWidth: 0 }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, color: C.muted, padding: 0 }}>✕</button>
              )}
            </div>
            {/* Filtro resultado */}
            {(['ALL', 'WIN', 'LOSS', 'BREAKEVEN'] as const).map(r => (
              <button key={r} onClick={() => setResultFilter(r)}
                style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', border: 'none', cursor: 'pointer',
                  background: resultFilter === r
                    ? r === 'WIN' ? C.green : r === 'LOSS' ? C.red : r === 'BREAKEVEN' ? C.yellow : C.gold
                    : C.surface,
                  color: resultFilter === r ? C.bg : C.dimText,
                }}>
                {r === 'ALL' ? 'RESULTADO' : r}
              </button>
            ))}
            {/* Desde */}
            <div style={{ background: C.surface, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, whiteSpace: 'nowrap' }}>DESDE</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'monospace', fontSize: 11, color: C.text, colorScheme: 'dark', width: 120 }} />
            </div>
            {/* Hasta */}
            <div style={{ background: C.surface, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, whiteSpace: 'nowrap' }}>HASTA</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'monospace', fontSize: 11, color: C.text, colorScheme: 'dark', width: 120 }} />
            </div>
            {/* Reset filtros */}
            {(search || resultFilter !== 'ALL' || dateFrom || dateTo) && (
              <button onClick={() => { setSearch(''); setResultFilter('ALL'); setDateFrom(''); setDateTo('') }}
                style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', border: 'none', cursor: 'pointer', background: C.surface, color: C.gold }}>
                LIMPIAR ✕
              </button>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ANÁLISIS TAB                                                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {filter === 'ANÁLISIS' && analytics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 1 — RESUMEN EJECUTIVO */}
            <AnalysisSection n={1} title="RESUMEN EJECUTIVO">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 10 }}>
                <MetricCard label="Total Trades" value={analytics.totalTrades.toString()} />
                <MetricCard label="Win Rate" value={`${analytics.winRate.toFixed(1)}%`} color={analytics.winRate >= 50 ? C.green : C.red} />
                <MetricCard label="Profit Factor" value={analytics.profitFactor >= 999 ? '∞' : analytics.profitFactor.toFixed(2)} color={analytics.profitFactor >= 1.5 ? C.green : analytics.profitFactor >= 1 ? C.yellow : C.red} />
                <MetricCard label="PnL Bruto" value={fmtUsd(analytics.pnlBruto)} color={analytics.pnlBruto >= 0 ? C.green : C.red} />
                <MetricCard label="Comisiones" value={fmtUsd(analytics.totalCommissions)} color={C.red} />
                <MetricCard label="Funding Fee" value={fmtUsd(analytics.totalFunding)} color={analytics.totalFunding >= 0 ? C.green : C.red} />
                <MetricCard label="PnL Neto" value={fmtUsd(analytics.pnlNeto)} color={analytics.pnlNeto >= 0 ? C.green : C.red} />
                <MetricCard label="Max Drawdown" value={`${analytics.maxDrawdownPct.toFixed(1)}%`} color={C.red} />
                <MetricCard label="Expectancy" value={fmtUsd(analytics.expectancy)} sub="por trade" color={analytics.expectancy >= 0 ? C.green : C.red} />
                <MetricCard label="Sharpe Ratio" value={analytics.sharpe.toFixed(2)} sub="anualizado rf=0" color={analytics.sharpe >= 1 ? C.green : analytics.sharpe >= 0 ? C.yellow : C.red} />
              </div>
            </AnalysisSection>

            {/* 2 — EQUITY CURVE */}
            <AnalysisSection n={2} title="EQUITY CURVE">
              {analytics.equityCurve.length > 1 ? (() => {
                // Benchmark: normalizar SPX al mismo origen que equity curve
                const n = analytics.equityCurve.length
                const finalEquity = analytics.equityCurve[n - 1].equity
                // Approximate SPX CAGR ~12% annualised — scale to match starting point
                const spxBenchmark = analytics.equityCurve.map((_, i) => {
                  const pct = i / (n - 1)
                  return parseFloat((finalEquity * pct * 0.5).toFixed(2))
                })
                // Halo estático del punto final — "tu posición actual", sin loop/animación
                const haloData = analytics.equityCurve.map((p, i) => i === n - 1 ? p.equity : null)
                return (
                <div style={{ height: 280 }}>
                  <Line
                    data={{
                      labels: analytics.equityCurve.map(p => p.date),
                      datasets: [
                        {
                          label: 'halo',
                          data: haloData,
                          borderColor: 'transparent',
                          backgroundColor: 'transparent',
                          pointRadius: analytics.equityCurve.map((_, i) => i === n - 1 ? 16 : 0),
                          pointBackgroundColor: `${C.gold}22`,
                          pointBorderColor: 'transparent',
                          order: 3,
                        },
                        {
                          label: 'glow',
                          data: analytics.equityCurve.map(p => p.equity),
                          borderColor: `${C.gold}30`,
                          backgroundColor: 'transparent',
                          fill: false, tension: 0.3, borderWidth: 7,
                          pointRadius: 0,
                          order: 2,
                        },
                        {
                          label: 'Tu PnL',
                          data: analytics.equityCurve.map(p => p.equity),
                          borderColor: C.gold,
                          backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
                            const { chart } = ctx
                            const { ctx: c2d, chartArea } = chart
                            if (!chartArea) return `${C.gold}20`
                            const g = c2d.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
                            g.addColorStop(0, `${C.gold}45`)
                            g.addColorStop(1, `${C.gold}00`)
                            return g
                          },
                          fill: true, tension: 0.3, borderWidth: 2,
                          // Cada trade cerrado marcado por su propio resultado — la curva
                          // cuenta la historia, no solo el dorado de marca.
                          pointRadius: analytics.equityCurve.map((_, i) => i === n - 1 ? 6 : i === analytics.maxDrawdownIdx ? 5 : 3),
                          pointBackgroundColor: analytics.equityCurve.map((p, i) => i === n - 1 ? C.gold : i === analytics.maxDrawdownIdx ? C.red : (p.win ? C.green : C.red)),
                          pointBorderColor: analytics.equityCurve.map((p, i) => i === n - 1 ? '#fff7d6' : i === analytics.maxDrawdownIdx ? C.red : (p.win ? C.green : C.red)),
                          pointBorderWidth: analytics.equityCurve.map((_, i) => i === n - 1 ? 2 : 1),
                          order: 1,
                        },
                        {
                          label: 'SPX Benchmark',
                          data: spxBenchmark,
                          borderColor: C.blue + '66',
                          backgroundColor: 'transparent',
                          fill: false, tension: 0.3, borderWidth: 1,
                          borderDash: [4, 4],
                          pointRadius: 0,
                          order: 4,
                        },
                      ],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: true,
                          labels: {
                            color: C.dimText, font: { family: 'monospace', size: 10 }, boxWidth: 14,
                            filter: item => item.text !== 'halo' && item.text !== 'glow',
                          },
                        },
                        tooltip: { ...chartTooltipDefaults, filter: item => item.dataset.label !== 'halo' && item.dataset.label !== 'glow' },
                      },
                      scales: {
                        x: { ...xScaleDefaults, ticks: { ...xScaleDefaults.ticks, maxTicksLimit: 10 } },
                        y: { ...yScaleDefaults, ticks: { ...yScaleDefaults.ticks, callback: (v: number | string) => `$${Number(v).toFixed(0)}` } },
                      },
                    }}
                  />
                </div>
                )
              })() : (
                <div style={{ padding: 32, textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: C.muted }}>Insuficientes datos para graficar</div>
              )}
            </AnalysisSection>

            {/* 3 — DISTRIBUCIÓN PnL */}
            <AnalysisSection n={3} title="DISTRIBUCIÓN PnL">
              {(() => {
                const pnlVals = analytics.histBins.map(b => b.count)
                const meanVal = analytics.totalTrades > 0
                  ? csvTrades.filter(t => t.tipo !== 'FUNDING').reduce((s, t) => s + t.pnl_neto, 0) / analytics.totalTrades
                  : 0
                return (
                  <div>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, marginBottom: 10 }}>
                      Media: <span style={{ color: C.gold }}>{fmtUsd(meanVal)}</span>
                      &nbsp;·&nbsp; Wins: <span style={{ color: C.green }}>{analytics.wins}</span>
                      &nbsp;·&nbsp; Losses: <span style={{ color: C.red }}>{analytics.losses}</span>
                    </div>
                    <div style={{ height: Math.min(400, Math.max(200, analytics.histBins.length * 18)) }}>
                      <Bar
                        data={{
                          labels: analytics.histBins.map(b => b.label),
                          datasets: [{
                            label: 'Frecuencia',
                            data: pnlVals,
                            backgroundColor: analytics.histBins.map(b => b.positive ? `${C.green}70` : `${C.red}70`),
                            borderColor: analytics.histBins.map(b => b.positive ? C.green : C.red),
                            borderWidth: 1,
                          }],
                        }}
                        options={{
                          indexAxis: 'y' as const,
                          responsive: true, maintainAspectRatio: false,
                          plugins: { legend: { display: false }, tooltip: chartTooltipDefaults },
                          scales: { x: xScaleDefaults, y: { ...yScaleDefaults, ticks: { ...yScaleDefaults.ticks, font: { family: 'monospace', size: 9 } } } },
                        }}
                      />
                    </div>
                  </div>
                )
              })()}
            </AnalysisSection>

            {/* 4 — BREAKDOWN */}
            <AnalysisSection n={4} title="BREAKDOWN POR DIMENSIÓN">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 20 }}>

                {/* By symbol */}
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: '0.15em', marginBottom: 8 }}>POR SÍMBOLO</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Símbolo', 'N', 'WR%', 'PnL'].map(h => <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: C.muted, fontWeight: 400, fontSize: 9 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {analytics.bySymbol.slice(0, 10).map(row => (
                        <tr key={row.symbol} style={{ borderBottom: `1px solid ${C.border}20` }}>
                          <td style={{ padding: '5px 8px', color: C.text }}>{row.symbol.replace('USDT', '')}/USDT</td>
                          <td style={{ padding: '5px 8px', color: C.dimText }}>{row.trades}</td>
                          <td style={{ padding: '5px 8px', color: row.wins / row.trades >= 0.5 ? C.green : C.red }}>{((row.wins / row.trades) * 100).toFixed(0)}%</td>
                          <td style={{ padding: '5px 8px', color: row.pnlNeto >= 0 ? C.green : C.red }}>{fmtUsd(row.pnlNeto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* By hour */}
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: '0.15em', marginBottom: 8 }}>POR HORA UTC (top activas)</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Hora', 'N', 'WR%'].map(h => <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: C.muted, fontWeight: 400, fontSize: 9 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {analytics.byHour.filter(r => r.trades > 0).sort((a, b) => b.trades - a.trades).slice(0, 10).map(row => {
                        const wr = (row.wins / row.trades) * 100
                        return (
                          <tr key={row.hour} style={{ borderBottom: `1px solid ${C.border}20`, background: wr >= 60 ? `${C.green}08` : 'transparent' }}>
                            <td style={{ padding: '5px 8px', color: C.text }}>{String(row.hour).padStart(2, '0')}:00</td>
                            <td style={{ padding: '5px 8px', color: C.dimText }}>{row.trades}</td>
                            <td style={{ padding: '5px 8px', color: wr >= 50 ? C.green : C.red }}>{wr.toFixed(0)}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* By day of week */}
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: '0.15em', marginBottom: 8 }}>POR DÍA DE SEMANA</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Día', 'N', 'WR%', 'PnL'].map(h => <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: C.muted, fontWeight: 400, fontSize: 9 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {analytics.byDow.filter(r => r.trades > 0).map(row => {
                        const wr = (row.wins / row.trades) * 100
                        return (
                          <tr key={row.dow} style={{ borderBottom: `1px solid ${C.border}20`, background: row.pnlNeto > 0 ? `${C.green}08` : 'transparent' }}>
                            <td style={{ padding: '5px 8px', color: C.text }}>{DOW_NAMES[row.dow]}</td>
                            <td style={{ padding: '5px 8px', color: C.dimText }}>{row.trades}</td>
                            <td style={{ padding: '5px 8px', color: wr >= 50 ? C.green : C.red }}>{wr.toFixed(0)}%</td>
                            <td style={{ padding: '5px 8px', color: row.pnlNeto >= 0 ? C.green : C.red }}>{fmtUsd(row.pnlNeto)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* By month */}
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, letterSpacing: '0.15em', marginBottom: 8 }}>POR MES</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Mes', 'N', 'WR%', 'PnL Neto', 'PF'].map(h => <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: C.muted, fontWeight: 400, fontSize: 9 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {analytics.byMonth.map(row => {
                        const wr = row.trades > 0 ? (row.wins / row.trades) * 100 : 0
                        return (
                          <tr key={row.month} style={{ borderBottom: `1px solid ${C.border}20` }}>
                            <td style={{ padding: '5px 8px', color: C.text }}>{row.month}</td>
                            <td style={{ padding: '5px 8px', color: C.dimText }}>{row.trades}</td>
                            <td style={{ padding: '5px 8px', color: wr >= 50 ? C.green : C.red }}>{wr.toFixed(0)}%</td>
                            <td style={{ padding: '5px 8px', color: row.pnlNeto >= 0 ? C.green : C.red }}>{fmtUsd(row.pnlNeto)}</td>
                            <td style={{ padding: '5px 8px', color: row.pf >= 1 ? C.green : C.red }}>{row.pf.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            </AnalysisSection>

            {/* 5 — COSTOS OPERATIVOS */}
            <AnalysisSection n={5} title="COSTOS OPERATIVOS">
              {analytics.byMonth.length > 0 ? (
                <div style={{ height: 220, marginBottom: 20 }}>
                  <Bar
                    data={{
                      labels: analytics.byMonth.map(m => m.month),
                      datasets: [
                        { label: 'PnL Bruto', data: analytics.byMonth.map(m => m.pnlBruto), backgroundColor: `${C.green}55`, borderColor: C.green, borderWidth: 1 },
                        { label: 'PnL Neto', data: analytics.byMonth.map(m => m.pnlNeto), backgroundColor: `${C.gold}55`, borderColor: C.gold, borderWidth: 1 },
                      ],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { labels: { color: C.dimText, font: { family: 'monospace', size: 10 } } }, tooltip: chartTooltipDefaults },
                      scales: {
                        x: xScaleDefaults,
                        y: { ...yScaleDefaults, ticks: { ...yScaleDefaults.ticks, callback: (v: number | string) => `$${Number(v).toFixed(0)}` } },
                      },
                    }}
                  />
                </div>
              ) : null}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                <div style={{ ...cardStyle, padding: '14px 16px', background: C.bg }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText, marginBottom: 4, letterSpacing: '0.15em' }}>COSTOS / PnL BRUTO</div>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: C.red, textShadow: numberEmboss }}>
                    {analytics.pnlBruto !== 0
                      ? `${Math.abs(((analytics.totalCommissions + analytics.totalFunding) / analytics.pnlBruto) * 100).toFixed(1)}%`
                      : '—'}
                  </div>
                </div>
                <div style={{ ...cardStyle, padding: '14px 16px', background: C.bg }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText, marginBottom: 4, letterSpacing: '0.15em' }}>PROYECCIÓN ANUAL COSTOS</div>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: C.red, textShadow: numberEmboss }}>
                    {(() => {
                      const sorted = [...csvTrades].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                      if (!sorted.length) return '—'
                      const days = Math.max(1, (new Date(sorted[sorted.length - 1].timestamp).getTime() - new Date(sorted[0].timestamp).getTime()) / 86_400_000)
                      const dailyCost = (Math.abs(analytics.totalCommissions) + Math.abs(analytics.totalFunding)) / days
                      return fmtUsdPlain(dailyCost * 365)
                    })()}
                  </div>
                </div>
                <div style={{ ...cardStyle, padding: '14px 16px', background: C.bg }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText, marginBottom: 4, letterSpacing: '0.15em' }}>TOTAL COMISIONES</div>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: C.red, textShadow: numberEmboss }}>{fmtUsdPlain(analytics.totalCommissions)}</div>
                </div>
                <div style={{ ...cardStyle, padding: '14px 16px', background: C.bg }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText, marginBottom: 4, letterSpacing: '0.15em' }}>TOTAL FUNDING FEES</div>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: analytics.totalFunding >= 0 ? C.green : C.red, textShadow: numberEmboss }}>{fmtUsdPlain(analytics.totalFunding)}</div>
                </div>
              </div>
            </AnalysisSection>

            {/* 6 — TRADES RECONSTRUIDOS */}
            <AnalysisSection n={6} title="TRADES RECONSTRUIDOS">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Fecha', 'Símbolo', 'PnL Bruto', 'Comisión', 'PnL Neto', 'Resultado'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: C.dimText, fontWeight: 400, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPageData.map((t, i) => {
                      const isLiq = t.tipo === 'LIQUIDATION'
                      const isSmallLoss = t.tipo === 'LOSS' && Math.abs(t.pnl_neto) < 0.5
                      const accentColor = isLiq ? C.yellow : t.pnl_neto >= 0 ? C.green : C.red
                      const accent = resultAccent(Math.abs(t.pnl_neto) / 15, accentColor)
                      const baseBg = isLiq ? `${C.red}18` : isSmallLoss ? `${C.yellow}08` : (i % 2 === 1 ? C.surface2 : 'transparent')
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${accent.border}`, background: baseBg, transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = accent.bg)}
                          onMouseLeave={e => (e.currentTarget.style.background = baseBg)}>
                          <td style={{ padding: '10px 14px', color: C.dimText, whiteSpace: 'nowrap' }}>{t.timestamp.slice(0, 16).replace('T', ' ')}</td>
                          <td style={{ padding: '10px 14px', color: C.text }}>{t.symbol}</td>
                          <td style={{ padding: '10px 14px', color: t.pnl_bruto >= 0 ? C.green : C.red, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(t.pnl_bruto)}</td>
                          <td style={{ padding: '10px 14px', color: t.commission < 0 ? C.red : C.dimText, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(t.commission)}</td>
                          <td style={{ padding: '10px 14px', color: t.pnl_neto >= 0 ? C.green : C.red, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(t.pnl_neto)}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 10, letterSpacing: '0.1em', padding: '2px 6px', border: `1px solid ${isLiq ? C.yellow : t.tipo === 'WIN' ? C.green : C.red}40`, color: isLiq ? C.yellow : t.tipo === 'WIN' ? C.green : C.red }}>
                              {t.tipo}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {csvTotalPages > 1 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
                  <button onClick={() => setCsvPage(p => Math.max(0, p - 1))} disabled={csvPage === 0}
                    style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${C.border}`, color: C.dimText, fontFamily: 'monospace', fontSize: 11, cursor: csvPage === 0 ? 'default' : 'pointer', opacity: csvPage === 0 ? 0.4 : 1 }}>
                    ← PREV
                  </button>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>{csvPage + 1} / {csvTotalPages}</span>
                  <button onClick={() => setCsvPage(p => Math.min(csvTotalPages - 1, p + 1))} disabled={csvPage === csvTotalPages - 1}
                    style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${C.border}`, color: C.dimText, fontFamily: 'monospace', fontSize: 11, cursor: csvPage === csvTotalPages - 1 ? 'default' : 'pointer', opacity: csvPage === csvTotalPages - 1 ? 0.4 : 1 }}>
                    NEXT →
                  </button>
                </div>
              )}
            </AnalysisSection>

          </div>
        )}

        {/* ── Manual trades table ─────────────────────────────────────────────── */}
        {filter !== 'ANÁLISIS' && (
          <div style={{ ...cardStyle, background: C.surface, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '1px', background: C.border }}>
                <style>{`@keyframes skj{0%{background-position:-200% 0}100%{background-position:200% 0}}.skj{background:linear-gradient(90deg,${C.border} 25%,${C.surface} 50%,${C.border} 75%);background-size:200% 100%;animation:skj 1.4s ease infinite;border-radius:2px}`}</style>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ background: C.bg, padding: '14px 14px', display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div className="skj" style={{ width: 70, height: 10, flexShrink: 0 }} />
                    <div className="skj" style={{ width: 80, height: 10, flexShrink: 0 }} />
                    <div className="skj" style={{ width: 50, height: 10, flexShrink: 0 }} />
                    <div className="skj" style={{ width: 70, height: 10, flexShrink: 0 }} />
                    <div className="skj" style={{ width: 70, height: 10, flexShrink: 0 }} />
                    <div className="skj" style={{ flex: 1, height: 10 }} />
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: C.muted }}>No hay trades. Añade el primero arriba.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {['Fecha', 'Par', 'Dir', 'Entrada', 'Salida', 'SL', 'TP', 'Tamaño', 'P&L', '%', 'Resultado', 'Notas', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: C.dimText, fontWeight: 400, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((t, i) => {
                      const resColor = t.resultado === 'WIN' ? C.green : t.resultado === 'LOSS' ? C.red : C.yellow
                      const accent = resultAccent(Math.abs(t.pnl_pct ?? 0) / 8, resColor)
                      const baseBg = i % 2 === 1 ? C.surface2 : 'transparent'
                      return (
                        <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${accent.border}`, background: baseBg, transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = accent.bg)}
                          onMouseLeave={e => (e.currentTarget.style.background = baseBg)}>
                          <td style={{ padding: '12px 14px', color: C.dimText, whiteSpace: 'nowrap' }}>{t.fecha}</td>
                          <td style={{ padding: '12px 14px', color: C.text, fontWeight: 600 }}>{t.par}</td>
                          <td style={{ padding: '12px 14px', color: t.lado === 'LONG' ? C.green : C.red, fontWeight: 700 }}>{t.lado}</td>
                          <td style={{ padding: '12px 14px', color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmtN(t.entry_price)}</td>
                          <td style={{ padding: '12px 14px', color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmtN(t.exit_price)}</td>
                          <td style={{ padding: '12px 14px', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{t.sl ? fmtN(t.sl) : '—'}</td>
                          <td style={{ padding: '12px 14px', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{t.tp ? fmtN(t.tp) : '—'}</td>
                          <td style={{ padding: '12px 14px', color: C.dimText, fontVariantNumeric: 'tabular-nums' }}>${fmtN(t.size_usd)}</td>
                          <td style={{ padding: '12px 14px', color: t.pnl_usd >= 0 ? C.green : C.red, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(t.pnl_usd)}</td>
                          <td style={{ padding: '12px 14px', color: t.pnl_pct >= 0 ? C.green : C.red, fontVariantNumeric: 'tabular-nums' }}>{t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct?.toFixed(2)}%</td>
                          <td style={{ padding: '12px 14px' }}>
                            {t.resultado && (
                              <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: resColor, border: `1px solid ${resColor}40`, padding: '2px 7px' }}>{t.resultado}</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px', color: C.dimText, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notas || '—'}</td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <button onClick={() => handleEdit(t)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.dimText, fontFamily: 'monospace', fontSize: 10, padding: '4px 10px', cursor: 'pointer', marginRight: 6 }}>EDITAR</button>
                            <button onClick={() => handleDelete(t.id)} style={{ background: 'transparent', border: `1px solid ${C.red}30`, color: C.red, fontFamily: 'monospace', fontSize: 10, padding: '4px 10px', cursor: 'pointer' }}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        </>
        )}

      </div>
    </div>
  )
}
