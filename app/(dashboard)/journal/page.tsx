'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/app/lib/supabase'
import { C } from '@/app/lib/constants'
import Papa from 'papaparse'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

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

type FormState = Omit<Trade, 'id' | 'pnl_usd' | 'pnl_pct' | 'resultado'>
type MainFilter = 'ALL' | 'LONG' | 'SHORT' | 'ANÁLISIS'

// ── Static data ───────────────────────────────────────────────────────────────

const EMPTY: FormState = {
  fecha: new Date().toISOString().slice(0, 10),
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
  equityCurve: { date: string; equity: number }[]
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
  const equityCurve: { date: string; equity: number }[] = []

  for (let i = 0; i < realTrades.length; i++) {
    equity += realTrades[i].pnl_neto
    if (equity > peak) peak = equity
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0
    if (dd > maxDD) { maxDD = dd; maxDDIdx = i }
    equityCurve.push({ date: realTrades[i].timestamp.slice(0, 10), equity: parseFloat(equity.toFixed(2)) })
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
  fontVariantNumeric: 'tabular-nums', width: '100%',
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, padding: '14px 16px' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 26, color: color || C.gold, lineHeight: 1 }}>{value}</div>
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

// ── Main component ────────────────────────────────────────────────────────────

export default function JournalPage() {
  // Manual trades state
  const [trades, setTrades] = useState<Trade[]>([])
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<MainFilter>('ALL')
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

  // Load manual trades
  useEffect(() => {
    supabase.from('trades').select('*').order('fecha', { ascending: false })
      .then(({ data }) => { if (data) setTrades(data as Trade[]); setLoading(false) })
  }, [])

  // Load csv_trades
  useEffect(() => {
    supabase.from('csv_trades').select('*').order('timestamp', { ascending: true })
      .then(({ data }) => { if (data) setCsvTrades(data as CsvTrade[]) })
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

      const dates = csvParsed.map(t => new Date(t.timestamp).getTime())
      await supabase.from('csv_imports').insert({
        user_id: user.id,
        filename: csvFile.name,
        total_trades: newTrades.length,
        date_from: new Date(Math.min(...dates)).toISOString(),
        date_to: new Date(Math.max(...dates)).toISOString(),
        imported_at: new Date().toISOString(),
      })

      const { data: fresh } = await supabase.from('csv_trades').select('*').order('timestamp', { ascending: true })
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
    const { pnl_usd, pnl_pct } = calcPnl(form.entry_price, form.exit_price, form.lado, form.size_usd)
    const resultado = autoResultado(pnl_usd)
    const payload = { ...form, pnl_usd, pnl_pct, resultado }

    if (editing) {
      const { error } = await supabase.from('trades').update(payload).eq('id', editing)
      if (!error) { setTrades(ts => ts.map(t => t.id === editing ? { ...t, ...payload } : t)); setEditing(null) }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('trades').insert({ ...payload, user_id: user?.id }).select().single()
      if (!error && data) setTrades(ts => [data as Trade, ...ts])
    }

    setSaving(false)
    setForm({ ...EMPTY, fecha: new Date().toISOString().slice(0, 10) })
  }

  function handleEdit(t: Trade) {
    setEditing(t.id)
    setForm({ fecha: t.fecha, par: t.par, lado: t.lado, entry_price: t.entry_price, exit_price: t.exit_price, sl: t.sl, tp: t.tp, size_usd: t.size_usd, notas: t.notas })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id: string) {
    await supabase.from('trades').delete().eq('id', id)
    setTrades(ts => ts.filter(t => t.id !== id))
    if (editing === id) { setEditing(null); setForm({ ...EMPTY }) }
  }

  // ── Derived data ────────────────────────────────────────────────────────────

  const visible = useMemo(() =>
    filter === 'ALL' ? trades : filter === 'ANÁLISIS' ? [] : trades.filter(t => t.lado === filter),
    [trades, filter])

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
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>
            {'// JOURNAL · REGISTRO DE TRADES'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',var(--font-bebas),Impact,sans-serif", fontSize: 'clamp(40px,5vw,72px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ color: C.text }}>TRADE</span>{' '}
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>JOURNAL</span>
          </h1>
        </div>

        {/* Manual stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 1, background: C.border, marginBottom: 1 }}>
          {[
            { label: 'Total trades', value: stats.total.toString(), color: C.gold },
            { label: 'Win Rate', value: `${stats.winRate}%`, color: stats.winRate >= 50 ? C.green : C.red },
            { label: 'P&L Total', value: fmt(stats.pnl), color: stats.pnl >= 0 ? C.green : C.red },
            { label: 'Mejor trade', value: trades.length ? fmt(stats.best) : '—', color: C.green },
            { label: 'Peor trade', value: trades.length ? fmt(stats.worst) : '—', color: C.red },
            { label: 'Tamaño medio', value: trades.length ? `$${fmtN(stats.avgSize)}` : '—', color: C.dimText },
          ].map(s => (
            <div key={s.label} style={{ background: C.surface, padding: '16px 18px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── CSV Import ──────────────────────────────────────────────────────── */}
        <div style={{ background: C.surface, border: `1px dashed ${C.gold}50`, padding: '20px 24px', marginBottom: 1 }}>
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
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '24px', marginBottom: 1 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: editing ? C.yellow : C.gold, marginBottom: 16 }}>
            {editing ? '// EDITAR TRADE' : '// NUEVO TRADE'}
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16, marginBottom: 16 }}>
              <Field label="Fecha">
                <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Par">
                <input type="text" placeholder="BTC/USDT" value={form.par} onChange={e => setForm(f => ({ ...f, par: e.target.value.toUpperCase() }))} style={{ ...inputStyle, borderColor: errors.par ? C.red : C.border }} />
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
                <input type="number" step="any" min="0" placeholder="0.00" value={form.entry_price || ''} onChange={e => setForm(f => ({ ...f, entry_price: parseFloat(e.target.value) || 0 }))} style={{ ...inputStyle, borderColor: errors.entry_price ? C.red : C.border }} />
                {errors.entry_price && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.red }}>{errors.entry_price}</span>}
              </Field>
              <Field label="Salida ($)">
                <input type="number" step="any" min="0" placeholder="0.00" value={form.exit_price || ''} onChange={e => setForm(f => ({ ...f, exit_price: parseFloat(e.target.value) || 0 }))} style={{ ...inputStyle, borderColor: errors.exit_price ? C.red : C.border }} />
                {errors.exit_price && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.red }}>{errors.exit_price}</span>}
              </Field>
              <Field label="Tamaño (USD)">
                <input type="number" step="any" min="0" placeholder="500" value={form.size_usd || ''} onChange={e => setForm(f => ({ ...f, size_usd: parseFloat(e.target.value) || 0 }))} style={{ ...inputStyle, borderColor: errors.size_usd ? C.red : C.border }} />
                {errors.size_usd && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.red }}>{errors.size_usd}</span>}
              </Field>
              <Field label="Stop Loss ($)">
                <input type="number" step="any" min="0" placeholder="opcional" value={form.sl || ''} onChange={e => setForm(f => ({ ...f, sl: parseFloat(e.target.value) || null }))} style={inputStyle} />
              </Field>
              <Field label="Take Profit ($)">
                <input type="number" step="any" min="0" placeholder="opcional" value={form.tp || ''} onChange={e => setForm(f => ({ ...f, tp: parseFloat(e.target.value) || null }))} style={inputStyle} />
              </Field>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Field label="Notas">
                <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Setup, contexto, lección aprendida…" rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving} style={{ padding: '10px 28px', background: C.gold, color: C.bg, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'GUARDANDO…' : editing ? 'ACTUALIZAR' : 'GUARDAR TRADE'}
              </button>
              {editing && (
                <button type="button" onClick={() => { setEditing(null); setForm({ ...EMPTY }) }} style={{ padding: '10px 20px', background: 'transparent', color: C.dimText, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
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
              <button onClick={exportTradesCSV}
                style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', border: 'none', cursor: 'pointer', background: C.surface, color: C.gold }}>
                ↓ EXPORTAR CSV
              </button>
            )}
            <div style={{ background: C.surface, padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>
              {filter === 'ANÁLISIS' ? `${csvTradesSorted.length} trades CSV` : `${visible.length} trade${visible.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ANÁLISIS TAB                                                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {filter === 'ANÁLISIS' && analytics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

            {/* 1 — RESUMEN EJECUTIVO */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px' }}>
              <SectionHeader>{'// 1 · RESUMEN EJECUTIVO'}</SectionHeader>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 1, background: C.border }}>
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
            </div>

            {/* 2 — EQUITY CURVE */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px' }}>
              <SectionHeader>{'// 2 · EQUITY CURVE'}</SectionHeader>
              {analytics.equityCurve.length > 1 ? (
                <div style={{ height: 280 }}>
                  <Line
                    data={{
                      labels: analytics.equityCurve.map(p => p.date),
                      datasets: [{
                        label: 'PnL Acumulado',
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
                        fill: true,
                        tension: 0.3,
                        borderWidth: 1.5,
                        pointRadius: analytics.equityCurve.map((_, i) => i === analytics.maxDrawdownIdx ? 6 : 0),
                        pointBackgroundColor: analytics.equityCurve.map((_, i) => i === analytics.maxDrawdownIdx ? C.red : C.gold),
                        pointBorderColor: analytics.equityCurve.map((_, i) => i === analytics.maxDrawdownIdx ? C.red : C.gold),
                      }],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip: chartTooltipDefaults },
                      scales: {
                        x: { ...xScaleDefaults, ticks: { ...xScaleDefaults.ticks, maxTicksLimit: 10 } },
                        y: { ...yScaleDefaults, ticks: { ...yScaleDefaults.ticks, callback: (v: number | string) => `$${Number(v).toFixed(0)}` } },
                      },
                    }}
                  />
                </div>
              ) : (
                <div style={{ padding: 32, textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: C.muted }}>Insuficientes datos para graficar</div>
              )}
            </div>

            {/* 3 — DISTRIBUCIÓN PnL */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px' }}>
              <SectionHeader>{'// 3 · DISTRIBUCIÓN PnL'}</SectionHeader>
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
            </div>

            {/* 4 — BREAKDOWN */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px' }}>
              <SectionHeader>{'// 4 · BREAKDOWN POR DIMENSIÓN'}</SectionHeader>
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
            </div>

            {/* 5 — COSTOS OPERATIVOS */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px' }}>
              <SectionHeader>{'// 5 · COSTOS OPERATIVOS'}</SectionHeader>
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
                <div style={{ padding: '14px 16px', background: C.bg, border: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText, marginBottom: 4, letterSpacing: '0.15em' }}>COSTOS / PnL BRUTO</div>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: C.red }}>
                    {analytics.pnlBruto !== 0
                      ? `${Math.abs(((analytics.totalCommissions + analytics.totalFunding) / analytics.pnlBruto) * 100).toFixed(1)}%`
                      : '—'}
                  </div>
                </div>
                <div style={{ padding: '14px 16px', background: C.bg, border: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText, marginBottom: 4, letterSpacing: '0.15em' }}>PROYECCIÓN ANUAL COSTOS</div>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: C.red }}>
                    {(() => {
                      const sorted = [...csvTrades].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                      if (!sorted.length) return '—'
                      const days = Math.max(1, (new Date(sorted[sorted.length - 1].timestamp).getTime() - new Date(sorted[0].timestamp).getTime()) / 86_400_000)
                      const dailyCost = (Math.abs(analytics.totalCommissions) + Math.abs(analytics.totalFunding)) / days
                      return fmtUsdPlain(dailyCost * 365)
                    })()}
                  </div>
                </div>
                <div style={{ padding: '14px 16px', background: C.bg, border: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText, marginBottom: 4, letterSpacing: '0.15em' }}>TOTAL COMISIONES</div>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: C.red }}>{fmtUsdPlain(analytics.totalCommissions)}</div>
                </div>
                <div style={{ padding: '14px 16px', background: C.bg, border: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText, marginBottom: 4, letterSpacing: '0.15em' }}>TOTAL FUNDING FEES</div>
                  <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: analytics.totalFunding >= 0 ? C.green : C.red }}>{fmtUsdPlain(analytics.totalFunding)}</div>
                </div>
              </div>
            </div>

            {/* 6 — TRADES RECONSTRUIDOS */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 24px' }}>
              <SectionHeader>{'// 6 · TRADES RECONSTRUIDOS'}</SectionHeader>
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
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: isLiq ? `${C.red}18` : isSmallLoss ? `${C.yellow}08` : 'transparent' }}>
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
            </div>

          </div>
        )}

        {/* ── Manual trades table ─────────────────────────────────────────────── */}
        {filter !== 'ANÁLISIS' && (
          <div style={{ background: C.surface }}>
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
                      return (
                        <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : `${C.gold}03` }}>
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

      </div>
    </div>
  )
}
