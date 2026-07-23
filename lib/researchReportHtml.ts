// Plantilla "Terminal" del SIGMA Research — genera el HTML de las 11 páginas en
// A4, listo para imprimir a PDF desde el navegador (Ctrl+P · márgenes por
// defecto, la propia página fija A4 sin margen).
//
// Portado de la simulación validada. Los datos duros llegan como parámetros
// (motor, calendario, Binance); los precios se traen de Yahoo aquí. Los huecos
// editoriales se rellenan con las narrativas de Claude cuando existen, o quedan
// marcados en ámbar para completar a mano.

import path from 'path'
import { readFileSync } from 'fs'
import { redactarNarrativas, type Narrativas } from './researchNarrativa'
import type { BinanceResumen } from './researchBinance'

// ─── Universo ────────────────────────────────────────────────────────────────

interface ActivoDef {
  sym: string; label: string; yahoo: string; motorSym: string | null
  grupo: 'BTC' | 'USA' | 'CROSS' | 'METALES' | 'ENERGIA'; dec: number; pct?: boolean
}

const UNIVERSO: ActivoDef[] = [
  { sym: 'BTC',   label: 'Bitcoin',  yahoo: 'BTC-USD',  motorSym: 'BTC', grupo: 'BTC',     dec: 2 },
  { sym: 'SPX',   label: 'S&P 500',  yahoo: '^GSPC',    motorSym: null,  grupo: 'USA',     dec: 2 },
  { sym: 'SPY',   label: 'SPY',      yahoo: 'SPY',      motorSym: null,  grupo: 'USA',     dec: 2 },
  { sym: 'QQQ',   label: 'QQQ',      yahoo: 'QQQ',      motorSym: null,  grupo: 'USA',     dec: 2 },
  { sym: 'VIX',   label: 'VIX',      yahoo: '^VIX',     motorSym: null,  grupo: 'CROSS',   dec: 2 },
  { sym: 'DXY',   label: 'DXY',      yahoo: 'DX-Y.NYB', motorSym: null,  grupo: 'CROSS',   dec: 3 },
  { sym: 'US10Y', label: 'UST 10Y',  yahoo: '^TNX',     motorSym: null,  grupo: 'CROSS',   dec: 3, pct: true },
  { sym: 'XAU',   label: 'Oro',      yahoo: 'GC=F',     motorSym: 'XAU', grupo: 'METALES', dec: 2 },
  { sym: 'GLD',   label: 'GLD',      yahoo: 'GLD',      motorSym: null,  grupo: 'METALES', dec: 2 },
  { sym: 'XAG',   label: 'Plata',    yahoo: 'SI=F',     motorSym: 'XAG', grupo: 'METALES', dec: 2 },
  { sym: 'SLV',   label: 'SLV',      yahoo: 'SLV',      motorSym: null,  grupo: 'METALES', dec: 2 },
  { sym: 'WTI',   label: 'WTI',      yahoo: 'CL=F',     motorSym: 'WTI', grupo: 'ENERGIA', dec: 3 },
  { sym: 'BRENT', label: 'Brent',    yahoo: 'BZ=F',     motorSym: null,  grupo: 'ENERGIA', dec: 3 },
]

// ─── Fechas ──────────────────────────────────────────────────────────────────

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MES3  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DIA3  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const addD = (d: Date, n: number): Date => { const o = new Date(d.getTime()); o.setUTCDate(o.getUTCDate() + n); return o }

function proximoLunes(hoy: Date): Date {
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()))
  const dow = d.getUTCDay()
  return dow === 1 ? d : addD(d, (8 - dow) % 7)
}

// ─── Yahoo ───────────────────────────────────────────────────────────────────

const YH = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com/', 'Origin': 'https://finance.yahoo.com',
}

interface Serie { t: number[]; c: number[]; hi: number[]; lo: number[] }

async function serie(symbol: string): Promise<Serie | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`
    const r = await fetch(url, { headers: YH, signal: AbortSignal.timeout(9000), cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json()
    const res = j?.chart?.result?.[0]
    const ts: number[] = res?.timestamp ?? []
    const q = res?.indicators?.quote?.[0] ?? {}
    const t: number[] = [], c: number[] = [], hi: number[] = [], lo: number[] = []
    for (let i = 0; i < ts.length; i++) {
      if (q.close?.[i] == null) continue
      t.push(ts[i] * 1000); c.push(q.close[i])
      hi.push(q.high?.[i] ?? q.close[i]); lo.push(q.low?.[i] ?? q.close[i])
    }
    return c.length ? { t, c, hi, lo } : null
  } catch {
    return null
  }
}

function variacion(s: Serie): { precio: number; dia: number | null; semana: number | null } {
  const n = s.c.length, precio = s.c[n - 1]
  const dia = n >= 2 ? ((precio - s.c[n - 2]) / s.c[n - 2]) * 100 : null
  const obj = s.t[n - 1] - 7 * 86400e3
  let idx = -1, mejor = Infinity
  for (let i = 0; i < n - 1; i++) { const d = Math.abs(s.t[i] - obj); if (d < mejor) { mejor = d; idx = i } }
  const semana = idx >= 0 ? ((precio - s.c[idx]) / s.c[idx]) * 100 : null
  return { precio, dia, semana }
}

// ─── Motor ───────────────────────────────────────────────────────────────────

export interface SignalVps {
  sym: string; tf?: string; strategy?: string; type?: string; grade?: string
  recommendation?: string; reason?: string; signal?: boolean
  price?: number; sl?: number; tp?: number; ev?: number | null
  current_dd_pct?: number | null; dd_kelly_mult?: number | null; wr?: number | null
}
export interface RegimeVps { regime?: string; rsi_w?: number; pct_vs_ema?: number }
export interface EventoRaw { title: string; impact: string; event_date: string; event_time?: string | null; description?: string | null; source?: string | null }

interface Lectura {
  estado: string; tf?: string; grade?: string; regimen: string | null
  ev: number | null; dd: number | null; ddMult: number | null
  rsi: number | null; vsEma: number | null
  estrategia?: string; freno: string | null; resumen: string
}

const ORDEN_G: Record<string, number> = { 'A+': 6, S: 5, A: 4, B: 3, C: 2, D: 1 }

function lecturaMotor(sym: string, signals: SignalVps[], regimes: Record<string, RegimeVps>): Lectura | null {
  const todas = signals.filter(s => s.sym === sym)
  if (!todas.length) return null
  const vetada = (s: SignalVps) => /no ejecuta/i.test(s.reason ?? '') || /BLOCKED/i.test(s.reason ?? '')
  const ejecutable = (s: SignalVps) => !!s.signal && s.recommendation === 'ACTIVAR' && !vetada(s)

  const cuatroH = todas.filter(s => s.tf === '4h')
  const pool = cuatroH.length ? cuatroH : todas
  const mejor = [...pool].sort((a, b) => {
    const e = Number(ejecutable(b)) - Number(ejecutable(a)); if (e) return e
    return (ORDEN_G[b.grade ?? ''] ?? 0) - (ORDEN_G[a.grade ?? ''] ?? 0)
  })[0]

  const reg = regimes[sym] ?? {}
  const go = ejecutable(mejor)
  const dir = /short/i.test(mejor.strategy ?? '') || /short/i.test(mejor.type ?? '') ? 'SHORT' : 'LONG'

  const p: string[] = []
  if (reg.regime)                   p.push(`Régimen ${reg.regime.toLowerCase()}`)
  if (mejor.grade)                  p.push(`grade ${mejor.grade}`)
  if (mejor.ev != null)             p.push(`EV ${mejor.ev.toFixed(2)}R`)
  if (mejor.wr != null)             p.push(`WR ${Math.round(mejor.wr)} %`)
  if (mejor.current_dd_pct != null) p.push(`DD ${mejor.current_dd_pct.toFixed(1)} %`)
  if (mejor.dd_kelly_mult != null)  p.push(`tamaño ${Math.round(mejor.dd_kelly_mult * 100)} %`)
  if (reg.pct_vs_ema != null)       p.push(`${reg.pct_vs_ema > 0 ? '+' : ''}${reg.pct_vs_ema.toFixed(1)} % vs EMA200`)

  let freno: string | null = null
  if (!go) {
    if (/no ejecuta/i.test(mejor.reason ?? ''))      freno = 'No es el campeón del slot'
    else if (/BLOCKED/i.test(mejor.reason ?? ''))    freno = 'Bloqueado por robustez'
    else if (mejor.recommendation === 'CONDICIONAL') freno = 'Condicional: paper-only en este régimen'
    else if (!mejor.signal)                          freno = 'Sin gatillo de entrada'
    else                                             freno = 'Sin permiso operativo'
  }

  return {
    estado: go ? `EJECUTAR ${dir}` : 'SIN TRADE',
    tf: mejor.tf, grade: mejor.grade, regimen: reg.regime ?? null,
    ev: mejor.ev ?? null, dd: mejor.current_dd_pct ?? null, ddMult: mejor.dd_kelly_mult ?? null,
    rsi: reg.rsi_w ?? null, vsEma: reg.pct_vs_ema ?? null,
    estrategia: mejor.strategy, freno, resumen: p.join('; ') + '.',
  }
}

// ─── Formato ─────────────────────────────────────────────────────────────────

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const num = (v: number | null | undefined, d = 2) => v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const pctS = (v: number | null | undefined, d = 2) => v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)} %`
const cls  = (v: number | null | undefined) => v == null ? 'fl' : Math.abs(v) < 0.15 ? 'fl' : v > 0 ? 'up' : 'dn'

// ─── Gráficos ────────────────────────────────────────────────────────────────

function sparkline(s: number[], w = 200, h = 26, signo: number | null = null): string {
  const c = s.slice(-22)
  const min = Math.min(...c), max = Math.max(...c), span = (max - min) || 1
  const X = (i: number) => (i / (c.length - 1)) * w
  const Y = (v: number) => h - 1.5 - ((v - min) / span) * (h - 3)
  const sube = signo != null ? signo >= 0 : c[c.length - 1] >= c[0]
  const col = sube ? '#2fd39a' : '#ff5d6c'
  const pts = c.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="spark">
    <polygon points="0,${h} ${pts} ${w},${h}" fill="${col}" opacity=".16"/>
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.3" stroke-linejoin="round"/>
    <circle cx="${X(c.length - 1).toFixed(1)}" cy="${Y(c[c.length - 1]).toFixed(1)}" r="1.9" fill="${col}"/>
  </svg>`
}

function nivelesDe(s: Serie): [string, number, string][] {
  const hi = s.hi, lo = s.lo, n = hi.length
  const ult = (k: number) => ({ max: Math.max(...hi.slice(-k)), min: Math.min(...lo.slice(-k)) })
  const a = ult(Math.min(60, n)), b = ult(Math.min(12, n)), c = ult(Math.min(30, n))
  return [
    ['Resistencia mayor',     a.max, 'r'],
    ['Resistencia inmediata', b.max, 'r'],
    ['Precio al corte',       s.c[n - 1], 'p'],
    ['Soporte inmediato',     b.min, 's'],
    ['Soporte intermedio',    c.min, 's'],
    ['Base del rango',        a.min, 's'],
  ]
}

function escalera(niveles: [string, number, string][], dec: number): string {
  const W = 300, H = 128, XV = W - 52, MIN_SEP = 8.5
  const vs = niveles.map(n => n[1])
  const min = Math.min(...vs), max = Math.max(...vs), span = (max - min) || 1
  const Y = (v: number) => 8 + (1 - (v - min) / span) * (H - 18)
  const orden = niveles.map((n, i) => ({ i, y: Y(n[1]) })).sort((a, b) => a.y - b.y)
  const yTexto = new Array(niveles.length)
  let previo = -Infinity
  for (const o of orden) { const y = Math.max(o.y, previo + MIN_SEP); yTexto[o.i] = y; previo = y }

  let out = `<svg viewBox="0 0 ${W} ${H}" class="ladder">`
  niveles.forEach(([etq, val, tipo], i) => {
    const y = Y(val), yt = yTexto[i], esP = tipo === 'p'
    const col = esP ? '#39e2e6' : tipo === 'r' ? '#ff5d6c' : '#2fd39a'
    out += `<line x1="92" y1="${y.toFixed(1)}" x2="${XV - 6}" y2="${y.toFixed(1)}" stroke="${col}"
      stroke-width="${esP ? 1.6 : .9}" opacity="${esP ? 1 : .45}" ${esP ? '' : 'stroke-dasharray="2.5 2.5"'}/>`
    if (Math.abs(yt - y) > 1.2) out += `<line x1="88" y1="${yt.toFixed(1)}" x2="92" y2="${y.toFixed(1)}" stroke="${col}" stroke-width=".6" opacity=".5"/>`
    out += `<text x="86" y="${(yt + 2.2).toFixed(1)}" text-anchor="end" fill="${esP ? '#e8e9f0' : '#7a7f9a'}" class="lb">${esc(etq)}</text>
      <text x="${W}" y="${(yt + 2.2).toFixed(1)}" text-anchor="end" fill="${col}" class="lv">${num(val, dec)}</text>`
  })
  return out + '</svg>'
}

// ─── Bloques ─────────────────────────────────────────────────────────────────

interface PanelRow extends ActivoDef {
  serie: Serie | null; precio: number | null; dia: number | null; semana: number | null; motor: Lectura | null
}

function barraRango(p: PanelRow): string {
  if (!p.serie) return ''
  const hi = p.serie.hi.slice(-60), lo = p.serie.lo.slice(-60)
  const max = Math.max(...hi), min = Math.min(...lo)
  const pos = Math.max(0, Math.min(1, ((p.precio ?? min) - min) / ((max - min) || 1)))
  const col = pos > .66 ? '#ff5d6c' : pos < .34 ? '#2fd39a' : '#39e2e6'
  return `<div class="rg">
    <span class="rg-s">${p.sym}</span>
    <span class="rg-n dim">${num(min, p.dec)}</span>
    <span class="rg-b"><span class="rg-t"></span><span class="rg-m" style="left:${(pos * 100).toFixed(1)}%;background:${col}"></span></span>
    <span class="rg-n dim">${num(max, p.dec)}</span>
    <span class="rg-p" style="color:${col}">${Math.round(pos * 100)} %</span>
  </div>`
}

interface EventoRow { dia: string; evento: string; hora: string; impacto: string; lectura: string; fuente: string }

function lineaSemana(eventos: EventoRow[], lun: Date): string {
  const dias = [0, 1, 2, 3, 4].map(i => {
    const d = addD(lun, i)
    const evs = eventos.filter(e => e.dia.endsWith(` ${d.getUTCDate()}`))
    const hot = evs.some(e => e.impacto === 'Muy alto')
    return `<div class="dw ${evs.length ? (hot ? 'hot' : 'on') : ''}">
      <div class="dw-d">${DIA3[d.getUTCDay()]} ${d.getUTCDate()}</div>
      <div class="dw-c">${evs.map(e => `<span class="dw-e">${esc(e.evento.split('(')[0].trim())}</span>`).join('') ||
        '<span class="dw-x">sin datos programados</span>'}</div>
    </div>`
  }).join('')
  return `<div class="wk">${dias}</div>`
}

const slot = (que: string) =>
  `<div class="slot"><span class="slot-t">Narrativa · pendiente</span><span class="slot-h">${esc(que)}</span></div>`

const callout = (titulo: string, texto: string) =>
  `<div class="callout"><div class="co-t">${esc(titulo)}</div><div class="co-b">${texto}</div></div>`

/** Narrativa de Claude → párrafos; si no hay, cae al hueco en ámbar. */
function parrafos(t: string): string {
  return t.split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join('')
}
function bloqueNarr(texto: string | undefined, instruccion: string): string {
  return texto ? `<div class="narr">${parrafos(texto)}</div>` : slot(instruccion)
}
function calloutNarr(titulo: string, texto: string | undefined, ph: string): string {
  return callout(titulo, texto ? esc(texto) : `<span class="ph">[ ${ph} ]</span>`)
}

// ─── Entrada ─────────────────────────────────────────────────────────────────

export interface InformeInput {
  ultimoNumero: number
  regimenGlobal: string | null
  signals: SignalVps[]
  regimes: Record<string, RegimeVps>
  eventos: EventoRaw[]
  binance: BinanceResumen
  /** Narrativas ya redactadas; si se omite y `conNarrativa` es true, las escribe Claude. */
  narrativas?: Narrativas | null
  /** Pedir a Claude que redacte las narrativas a partir de los datos calculados. */
  conNarrativa?: boolean
  hoy?: Date
}

export interface InformeSalida {
  html: string
  numero: number
  semana: string
  conMotor: number
  ejecutables: number
  precios: number
  faltantes: string[]
  narrativaError: string | null
}

const FUENTE = (nombre: string) => path.join(process.cwd(), 'lib', 'fonts', nombre)
const b64 = (nombre: string) => 'data:font/woff2;base64,' + readFileSync(FUENTE(nombre)).toString('base64')

export async function generarInformeHtml(input: InformeInput): Promise<InformeSalida> {
  const hoy = input.hoy ?? new Date()
  const lun = proximoLunes(hoy)
  const vie = addD(lun, 4)
  const vieCorte = addD(lun, -3)
  const sabCorte = addD(lun, -2)
  const NUMERO = input.ultimoNumero + 1
  const NUM3 = String(NUMERO).padStart(3, '0')
  const rango = `${lun.getUTCDate()} al ${vie.getUTCDate()} de ${MESES[vie.getUTCMonth()]} de ${vie.getUTCFullYear()}`

  // Precios (en paralelo)
  const series = await Promise.all(UNIVERSO.map(async a => ({ def: a, serie: await serie(a.yahoo) })))
  const panel: PanelRow[] = series.map(({ def, serie: s }) => {
    const v = s ? variacion(s) : { precio: null, dia: null, semana: null }
    return { ...def, serie: s, ...v, motor: def.motorSym ? lecturaMotor(def.motorSym, input.signals, input.regimes) : null }
  })
  const P = Object.fromEntries(panel.map(p => [p.sym, p]))
  const conMotor = panel.filter(p => p.motor)
  const ejecutables = conMotor.filter(p => p.motor!.estado !== 'SIN TRADE')
  const faltantes = panel.filter(p => p.precio == null).map(p => p.sym)

  const IMP: Record<string, string> = { HIGH: 'Alto', MED: 'Medio', LOW: 'Bajo' }
  const eventos: EventoRow[] = input.eventos.map(e => {
    const d = new Date(`${e.event_date}T12:00:00Z`)
    return {
      dia: `${DIA3[d.getUTCDay()]} ${d.getUTCDate()}`,
      evento: e.title, hora: (e.event_time ?? '').slice(0, 5) || '—',
      impacto: /FOMC/i.test(e.title) ? 'Muy alto' : (IMP[e.impact] ?? 'Medio'),
      lectura: e.description ?? '', fuente: e.source ?? '',
    }
  })

  // ── Narrativas (Claude) — se piden con el panel y Binance ya resueltos ─────
  let N: Partial<Narrativas> = input.narrativas ?? {}
  let narrativaError: string | null = null
  if (input.conNarrativa && !input.narrativas) {
    const resumen = {
      edicion: NUM3, semana: rango, regimenGlobal: input.regimenGlobal,
      panel: panel.map(p => ({
        sym: p.sym, label: p.label, grupo: p.grupo, precio: p.precio,
        variacionDia: p.dia, variacionSemana: p.semana,
        motor: p.motor ? { estado: p.motor.estado, regimen: p.motor.regimen, freno: p.motor.freno, resumen: p.motor.resumen } : 'panel Pine (sin motor)',
      })),
      eventos: input.eventos.map(e => ({ fecha: e.event_date, evento: e.title, impacto: e.impact, fuente: e.source })),
      binance: input.binance.ok
        ? { operaciones: input.binance.nOps, aciertoPct: Math.round(input.binance.wr), netoUSDT: input.binance.neto, brutoUSDT: input.binance.pnlBruto }
        : 'sin datos de la cuenta esta semana',
    }
    const r = await redactarNarrativas(resumen)
    if (r.narrativas) N = r.narrativas
    narrativaError = r.error
  }

  // ── Bloques compartidos ───────────────────────────────────────────────────
  const pieHtml = `<div class="pie"><span>Solo fines educativos · No constituye asesoramiento financiero</span><span>SIGMA Research ${NUM3}</span></div>`
  const pagina = (n: number, seccion: string, cuerpo: string, portada = false) => {
    const cab = portada ? '' : `<div class="cab"><span class="kick">${esc(seccion)}</span><span class="dim">PG ${String(n).padStart(2, '0')} · BTC / USA / METALES / ENERGÍA</span></div>`
    return `<section class="page${portada ? ' portada' : ''}"><div class="rail"></div><div class="grid"></div><div class="inner">${cab}${cuerpo}<div class="mt"></div>${pieHtml}</div></section>`
  }
  const titulo = (no: string, t: string, sub: string) =>
    `<div class="th"><div class="sec-no">${no}</div><div><div class="h2">${esc(t)}</div><div class="sub">${esc(sub)}</div></div></div>`

  const top4 = [...panel].filter(p => p.semana != null && p.serie)
    .sort((a, b) => Math.abs(b.semana!) - Math.abs(a.semana!)).slice(0, 4)
  const tiraSpark = top4.map(p => `<div class="spk"><span class="spk-s">${p.sym}</span><span class="spk-c">${sparkline(p.serie!.c, 200, 26, p.semana)}</span><span class="spk-v ${cls(p.semana)}">${pctS(p.semana, 1)}</span></div>`).join('')

  // ── PG 01 · Portada ───────────────────────────────────────────────────────
  const tiles = panel.map(p => `<div class="tile"><div class="t-s">${p.sym}</div><div class="t-v">${num(p.precio, p.pct ? 3 : (p.precio != null && p.precio > 1000 ? 2 : p.dec))}${p.pct ? ' %' : ''}</div><div class="t-d ${cls(p.semana)}">${pctS(p.semana, 1)} sem</div></div>`).join('')
  const agenda = eventos.slice(0, 5).map(e => `<div class="ag"><span class="ag-d ${e.impacto === 'Muy alto' ? 'hot' : ''}">${esc(e.dia)}</span><span class="ag-e">${esc(e.evento)}</span><span class="ag-h">${esc(e.hora)} ET</span></div>`).join('')
  const pg01 = pagina(1, '', `
    <div class="cab"><span class="kick">SIGMA Research</span><span class="dim">Edición #${NUM3}</span></div>
    <div class="mega">BTC / USA<br><em>METALES</em><br>ENERGÍA</div>
    <div class="meta">
      <div class="meta-1">Semana operativa del ${rango}</div>
      <div class="meta-2">Universo: ${UNIVERSO.map(a => a.sym).join(', ')}</div>
      <div class="meta-3">Corte: bolsa, índices y tasas al cierre del viernes ${vieCorte.getUTCDate()} ${MES3[vieCorte.getUTCMonth()]}; BTC / XAU / XAG sábado ${sabCorte.getUTCDate()} ${MES3[sabCorte.getUTCMonth()]}, hora panel.</div>
    </div>
    <div class="blk"><div class="kick mb">La agenda</div>${agenda}</div>
    <div class="mt"></div>
    <div class="tiles">${tiles}</div>
    <div class="cierre">Reporte cuantitativo basado en niveles, calendario macro, lectura SIGMA y gestión cross-asset.<br>Método sobre opinión · Documento informativo · No constituye asesoramiento financiero</div>
  `, true)

  // ── PG 02 · Sección 01 ────────────────────────────────────────────────────
  const filasEv = eventos.map(e => `<div class="tr tr-ev"><span class="c-a">${esc(e.dia)}</span><span>${esc(e.evento)}</span><span class="c-h">${esc(e.hora)}</span><span class="imp ${e.impacto === 'Muy alto' ? 'hot' : e.impacto === 'Alto' ? 'warm' : ''}">${esc(e.impacto)}</span><span class="dim">${esc(e.lectura)}</span></div>`).join('')
  const pg02 = pagina(2, 'Sección 01', `
    ${titulo('01', 'Eventos clave de la semana', eventos.map(e => e.evento.split(' ')[0]).slice(0, 4).join(', '))}
    <div class="th-ev tr-ev thead"><span>Día</span><span>Evento</span><span>Hora ET</span><span>Impacto</span><span>Lectura operativa</span></div>
    ${filasEv}
    <div class="blk"><div class="kick mb">Cómo se reparte la semana</div>${lineaSemana(eventos, lun)}</div>
    <div class="kick mb mt-6">Qué está en juego</div>
    ${Array.from(new Set(eventos.map(e => e.fuente))).filter(Boolean).map(f => {
      const evs = eventos.filter(e => e.fuente === f)
      return `<div class="tr tr-f"><span class="c-a">${esc(f)}</span><span class="dim">${esc(evs.map(e => e.evento).join(' · '))} — ${evs.length === 1 ? 'un dato' : evs.length + ' datos'} esta semana.</span></div>`
    }).join('')}
    ${calloutNarr('Clave de la semana', N.clave, 'una frase — la escribe marketing')}
  `)

  // ── PG 03 · Sección 02 ────────────────────────────────────────────────────
  const filasPanel = panel.map(p => {
    const m = p.motor
    const chip = m ? `<span class="chip ${m.estado === 'SIN TRADE' ? 'no' : 'go'}">${m.estado}</span>` : `<span class="chip pine">PANEL PINE</span>`
    const lect = m ? esc(m.resumen) : '<span class="ph">[ leer del panel en TradingView ]</span>'
    return `<div class="tr tr-pn"><span class="c-a">${p.sym}</span>${chip}<span class="tab ${cls(p.semana)}">${pctS(p.semana, 1)}</span><span class="dim">${lect}</span></div>`
  }).join('')
  const pg03 = pagina(3, 'Sección 02', `
    ${titulo('02', 'Estado actual del mercado', `Cierre viernes ${vieCorte.getUTCDate()} ${MES3[vieCorte.getUTCMonth()]} y corte 24/7 del sábado ${sabCorte.getUTCDate()}`)}
    ${bloqueNarr(N.estado, 'Dos párrafos: qué hizo la semana en renta variable, energía, metales y tasas.')}
    <div class="kick mb mt-6">Lectura del panel · ${panel.length} activos</div>
    <div class="th-pn tr-pn thead"><span>Activo</span><span>Estado</span><span>Semana</span><span>Lectura del motor</span></div>
    ${filasPanel}
    <div class="blk"><div class="kick mb">Los cuatro movimientos de la semana</div>${tiraSpark}</div>
    ${calloutNarr('Lectura general', N.lecturaGeneral, `${conMotor.length}/${panel.length} con motor, ${ejecutables.length} ejecutables — cierre editorial`)}
  `)

  // ── PG 04 · Resultados del motor (Binance real) ───────────────────────────
  const B = input.binance
  const CL = -4 * 3600e3
  const fHora = (t: number) => { const d = new Date(t + CL); return `${DIA3[d.getUTCDay()]} ${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
  const decDe = (sym: string) => (P[sym]?.dec ?? (sym === 'BTC' ? 0 : 2))
  const fUSDT = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`

  const curvaBinance = () => {
    const cron = [...B.ops].sort((a, b) => a.t - b.t)
    let acc = 0
    const s = cron.map(o => (acc += o.rpnl)); s.unshift(0)
    const w = 200, h = 30
    const min = Math.min(0, ...s), max = Math.max(0, ...s), span = (max - min) || 1
    const X = (i: number) => (i / (s.length - 1)) * w
    const Y = (v: number) => h - 1.5 - ((v - min) / span) * (h - 3)
    const y0 = Y(0)
    const pts = s.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
    const fin = s[s.length - 1] ?? 0
    const col = fin >= 0 ? '#2fd39a' : '#ff5d6c'
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="spark" style="height:14mm">
      <line x1="0" y1="${y0.toFixed(1)}" x2="${w}" y2="${y0.toFixed(1)}" stroke="#2b3346" stroke-width=".5" stroke-dasharray="2 2"/>
      <polygon points="0,${y0.toFixed(1)} ${pts} ${w},${y0.toFixed(1)}" fill="${col}" opacity=".14"/>
      <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.4" stroke-linejoin="round"/>
      <circle cx="${X(s.length - 1).toFixed(1)}" cy="${Y(fin).toFixed(1)}" r="2" fill="${col}"/></svg>`
  }

  const porSim = (() => {
    const m = new Map<string, { n: number; w: number; pnl: number }>()
    for (const o of B.ops) { const g = m.get(o.sym) ?? { n: 0, w: 0, pnl: 0 }; g.n++; g.w += o.rpnl > 0 ? 1 : 0; g.pnl += o.rpnl; m.set(o.sym, g) }
    return Array.from(m.entries()).sort((a, b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl))
  })()
  const maxAbs = Math.max(...porSim.map(([, g]) => Math.abs(g.pnl)), 0.01)
  const barras = porSim.map(([sym, g]) => {
    const pos = g.pnl >= 0, col = pos ? '#2fd39a' : '#ff5d6c', ancho = (Math.abs(g.pnl) / maxAbs) * 50
    return `<div class="bs"><span class="bs-s">${sym}</span><span class="bs-n dim">${g.n} op${g.n > 1 ? 's' : ''} · ${Math.round(g.w / g.n * 100)} %</span><span class="bs-t"><span class="bs-b" style="width:${ancho.toFixed(1)}%;${pos ? 'left:50%' : 'right:50%'};background:${col}"></span><span class="bs-0"></span></span><span class="bs-v ${pos ? 'up' : 'dn'}">${fUSDT(g.pnl)}</span></div>`
  }).join('')
  const MOSTRAR = 13
  const filasBin = [...B.ops].sort((a, b) => Math.abs(b.rpnl) - Math.abs(a.rpnl)).slice(0, MOSTRAR).map(o => `<div class="tr tr-tb"><span class="c-a">${o.sym}</span><span class="dir ${o.dir === 'LONG' ? 'lg' : 'sh'}">${o.dir}</span><span class="dim tab">${num(o.entry, decDe(o.sym))}</span><span class="dim tab">${num(o.exit, decDe(o.sym))}</span><span class="tab ${o.rpnl >= 0 ? 'up' : 'dn'}">${fUSDT(o.rpnl)}</span><span class="dim c-h">${fHora(o.t)}</span></div>`).join('')
  const restoBin = B.ops.length - MOSTRAR

  const pgTrades = !B.ok || B.ops.length === 0
    ? pagina(4, 'Resultados', `
      ${titulo('◆', 'Resultados del motor', 'Cuenta real · Binance Futures · últimos 7 días')}
      ${slot(`Sin datos de la cuenta de Binance esta vez${B.error ? ` (${esc(B.error)})` : ''}. Se completa cuando el motor vuelva a operar.`)}
    `)
    : pagina(4, 'Resultados', `
      ${titulo('◆', 'Resultados del motor', 'Cuenta real · Binance Futures · últimos 7 días')}
      <div class="stats">
        <div class="stat"><div class="st-s">Operaciones</div><div class="st-v">${B.nOps}</div><div class="st-d dim">cerradas en 7 días</div></div>
        <div class="stat"><div class="st-s">Aciertos</div><div class="st-v ${B.wr >= 50 ? 'up' : 'fl'}">${B.wr.toFixed(0)} %</div><div class="st-d dim">${B.wins} de ${B.nOps}</div></div>
        <div class="stat"><div class="st-s">Resultado neto</div><div class="st-v ${B.neto >= 0 ? 'up' : 'dn'}">${fUSDT(B.neto)}</div><div class="st-d dim">USDT, tras comisiones</div></div>
        <div class="stat"><div class="st-s">P&amp;L bruto</div><div class="st-v ${B.pnlBruto >= 0 ? 'up' : 'dn'}">${fUSDT(B.pnlBruto)}</div><div class="st-d dim">comisión ${fUSDT(B.comision)}</div></div>
      </div>
      <div class="cols" style="margin-top:6mm">
        <div><div class="kick mb">P&amp;L acumulado de la semana</div>${curvaBinance()}<div class="nota">P&amp;L realizado en USDT, operación tras operación. Cuenta de futuros del motor; saldo al corte ${num(B.balance, 0)} USDT.</div></div>
        <div><div class="kick mb">Por instrumento</div>${barras}</div>
      </div>
      <div class="kick mb mt-6">Las operaciones que movieron la semana</div>
      <div class="th-tb tr-tb thead"><span>Activo</span><span>Dirección</span><span>Entrada</span><span>Salida</span><span>P&amp;L</span><span>Cierre</span></div>
      ${filasBin}
      ${restoBin > 0 ? `<div class="resto dim">+ ${restoBin} operaciones más de menor cuantía (todas en el neto de arriba).</div>` : ''}
      ${calloutNarr('Cómo leerlo', N.resultados, `${B.nOps} operaciones, ${B.wr.toFixed(0)} % de acierto, ${fUSDT(B.neto)} USDT netos — comentario de la semana`)}
    `)

  // ── PG 05 · Bitcoin ───────────────────────────────────────────────────────
  const btc = P.BTC, mb = btc?.motor
  const pg05btc = pagina(5, 'Sección 03', `
    ${titulo('03', 'Bitcoin', 'BTC/USDT perpetuo · marco de 4 horas')}
    <div class="stats">
      <div class="stat"><div class="st-s">Precio al corte</div><div class="st-v">${num(btc?.precio, 2)}</div><div class="st-d ${cls(btc?.dia)}">sesión ${pctS(btc?.dia, 2)} · semana ${pctS(btc?.semana, 1)}</div></div>
      <div class="stat"><div class="st-s">Valor esperado</div><div class="st-v ${mb?.ev == null ? 'fl' : mb.ev > 0 ? 'up' : 'dn'}">${mb?.ev == null ? '—' : mb.ev.toFixed(2) + 'R'}</div><div class="st-d dim">${mb?.ev == null ? 'sin EV publicado' : mb.ev > 0 ? 'positivo' : 'negativo: no compensa'}</div></div>
      <div class="stat"><div class="st-s">Drawdown modelo</div><div class="st-v">${mb?.ddMult == null ? '—' : Math.round(mb.ddMult * 100) + ' %'}</div><div class="st-d dim">${mb?.dd == null ? '' : 'DD actual ' + mb.dd.toFixed(1) + ' %'}</div></div>
    </div>
    ${bloqueNarr(N.btc, 'Dos párrafos: cómo se comportó BTC frente al resto del tablero.')}
    <div class="cols">
      <div><div class="kick mb">Niveles</div>${btc?.serie ? escalera(nivelesDe(btc.serie), 0) : ''}<div class="nota">Derivados de máximos y mínimos de 12, 30 y 60 sesiones. Ajustar en el gráfico si el marcado difiere.</div></div>
      <div><div class="kick mb">Lectura del motor</div>
        <ul class="bul">
          <li>Estado: <b>${esc(mb?.estado ?? '—')}</b>${mb?.freno ? ` — ${esc(mb.freno)}` : ''}.</li>
          <li>Régimen ${esc(mb?.regimen?.toLowerCase() ?? '—')}${mb?.rsi != null ? `, RSI semanal ${mb.rsi.toFixed(1)}` : ''}.</li>
          <li>Estrategia evaluada: ${esc(mb?.estrategia ?? '—')} en ${esc(mb?.tf ?? '—')}, grade ${esc(mb?.grade ?? '—')}.</li>
          <li>${mb?.vsEma != null ? `Precio ${mb.vsEma > 0 ? '+' : ''}${mb.vsEma.toFixed(1)} % respecto de la EMA200.` : 'Sin referencia de EMA200.'}</li>
        </ul>
        ${btc?.serie ? `<div class="spk-blk">${sparkline(btc.serie.c, 200, 34, btc.semana)}</div><div class="nota">Cierres de las últimas 22 sesiones.</div>` : ''}
      </div>
    </div>
    ${btc?.serie ? `<div class="kick mb mt-6">Contexto de las últimas 30 sesiones</div>
    <div class="stats">
      <div class="stat"><div class="st-s">Rango 30 sesiones</div><div class="st-v">${num(Math.min(...btc.serie.lo.slice(-30)), 0)}<span class="st-u"> – ${num(Math.max(...btc.serie.hi.slice(-30)), 0)}</span></div><div class="st-d dim">mínimo y máximo</div></div>
      <div class="stat"><div class="st-s">RSI semanal</div><div class="st-v ${mb?.rsi == null ? 'fl' : mb.rsi > 55 ? 'up' : mb.rsi < 45 ? 'dn' : 'fl'}">${mb?.rsi == null ? '—' : mb.rsi.toFixed(1)}</div><div class="st-d dim">${mb?.rsi == null ? '' : mb.rsi < 45 ? 'zona débil' : mb.rsi > 55 ? 'zona fuerte' : 'zona neutra'}</div></div>
      <div class="stat"><div class="st-s">Respecto de EMA200</div><div class="st-v ${cls(mb?.vsEma)}">${mb?.vsEma == null ? '—' : pctS(mb.vsEma, 1)}</div><div class="st-d dim">${esc(mb?.regimen?.toLowerCase() ?? '')}</div></div>
    </div>` : ''}
    ${calloutNarr('Diferencia clave', N.diferenciaBtc, 'qué distingue a BTC del resto esta semana')}
  `)

  // ── Páginas de grupo ──────────────────────────────────────────────────────
  const paginaGrupo = (n: number, secNo: string, tit: string, sub: string, syms: string[], narr: string | undefined) => {
    const ps = syms.map(s => P[s]).filter(Boolean) as PanelRow[]
    const stats = ps.map(p => `<div class="stat"><div class="st-s">${p.sym}${p.label.toUpperCase() !== p.sym ? ' · ' + esc(p.label) : ''}</div><div class="st-v">${num(p.precio, p.pct ? 3 : p.dec)}${p.pct ? ' %' : ''}</div><div class="st-d ${cls(p.semana)}">semana ${pctS(p.semana, 1)}</div></div>`).join('')
    const filas = ps.map(p => {
      const m = p.motor
      return `<div class="tr tr-g"><span class="c-a">${p.sym}</span><span class="dim">${m ? esc(m.regimen ?? '—') : '<span class="ph">[ panel Pine ]</span>'}</span><span class="tab ${cls(p.dia)}">${pctS(p.dia, 2)}</span><span class="tab ${cls(p.semana)}">${pctS(p.semana, 1)}</span><span class="dim">${m ? esc(m.freno ?? m.estado) : '<span class="ph">[ estado del panel ]</span>'}</span></div>`
    }).join('')
    const sparks = ps.map(p => `<div class="spk"><span class="spk-s">${p.sym}</span><span class="spk-c">${p.serie ? sparkline(p.serie.c, 200, 26, p.semana) : ''}</span><span class="spk-v ${cls(p.semana)}">${pctS(p.semana, 1)}</span></div>`).join('')
    return pagina(n, `Sección ${secNo}`, `
      ${titulo(secNo, tit, sub)}
      <div class="stats">${stats}</div>
      ${bloqueNarr(narr, 'Dos párrafos sobre el grupo: qué pasó y qué mira el motor.')}
      <div class="th-g tr-g thead"><span>Activo</span><span>Régimen</span><span>Sesión</span><span>Semana</span><span>Estado / freno</span></div>
      ${filas}
      <div class="blk"><div class="kick mb">Comportamiento de las últimas sesiones</div>${sparks}</div>
      <div class="blk"><div class="kick mb">Posición dentro del rango de 60 sesiones</div>${ps.map(barraRango).join('')}<div class="nota">0 % = mínimo del rango; 100 % = máximo. Verde abajo, rojo arriba.</div></div>
    `)
  }
  const pg06 = paginaGrupo(6, '04', 'USA — SPX / SPY / QQQ', 'Renta variable y validación de riesgo', ['SPX','SPY','QQQ'], N.usa)
  const pg07 = paginaGrupo(7, '05', 'Cross Asset — VIX / DXY / US10Y', 'Volatilidad, dólar y tasas como filtros', ['VIX','DXY','US10Y'], N.cross)
  const pg08 = paginaGrupo(8, '06', 'Metales — Oro y Plata', 'XAU/GLD y XAG/SLV · marco de 4 horas', ['XAU','GLD','XAG','SLV'], N.metales)
  const pg09 = paginaGrupo(9, '07', 'Energía — WTI y Brent', 'Crudo, geopolítica y régimen', ['WTI','BRENT'], N.energia)

  // ── PG 10 · Modelo quant ──────────────────────────────────────────────────
  const pg10 = pagina(10, 'Sección 08', `
    ${titulo('08', 'Modelo quant de la semana', `${ejecutables.length} de ${conMotor.length} activos con permiso operativo`)}
    <div class="stats">
      <div class="stat"><div class="st-s">Con lectura del motor</div><div class="st-v">${conMotor.length}<span class="st-u">/${panel.length}</span></div><div class="st-d dim">el resto, panel Pine</div></div>
      <div class="stat"><div class="st-s">Ejecutables</div><div class="st-v up">${ejecutables.length}</div><div class="st-d dim">estructura completa</div></div>
      <div class="stat"><div class="st-s">En pausa</div><div class="st-v">${conMotor.length - ejecutables.length}</div><div class="st-d dim">sin permiso operativo</div></div>
    </div>
    <div class="kick mb">Estado de los ${panel.length} activos del universo</div>
    ${panel.map(p => {
      const m = p.motor
      return `<div class="tr tr-q"><span class="c-a">${p.sym}</span><span class="chip ${!m ? 'pine' : m.estado === 'SIN TRADE' ? 'no' : 'go'}">${m ? m.estado : 'PANEL PINE'}</span><span class="tab ${cls(p.semana)}">${pctS(p.semana, 1)}</span><span class="dim">${m ? esc(m.freno ?? 'Estructura completa, sin frenos activos') : '<span class="ph">[ estado y freno, del panel en TradingView ]</span>'}</span></div>`
    }).join('')}
    ${calloutNarr('Idea de la semana', N.idea, 'la tesis metodológica de la edición')}
  `)

  // ── PG 11 · Fuentes ───────────────────────────────────────────────────────
  const fuentes: [string, string][] = [
    ['Lectura SIGMA', 'Panel SIGMA Terminal sobre TradingView; estados 4 h aplicados a los 13 activos del universo.'],
    ['Motor SIGMA', `Señales, régimen, grade, valor esperado y control de drawdown para ${conMotor.map(p => p.sym).join(', ') || '—'}.`],
    ['Datos de mercado', 'Yahoo Finance, último cierre disponible al corte declarado en portada.'],
    ['Resultados', 'Cuenta real de Binance Futures del motor (P&L realizado de los últimos 7 días).'],
    ['Calendario macro', 'Fechas oficiales de FOMC, BLS, BEA y EIA cargadas en el calendario del sistema.'],
  ]
  const glosario: [string, string][] = [
    ['EJECUTAR', 'La estrategia tiene estructura de entrada completa y permiso de riesgo. Es una referencia metodológica, no una orden.'],
    ['SIN TRADE', 'El motor puede tener opinión direccional, pero falta estructura, timing o permiso de riesgo.'],
    ['Valor esperado (EV)', 'Retorno medio de la señal medido en múltiplos de riesgo (R). Negativo significa que no compensa.'],
    ['Drawdown y tamaño', 'Tras rachas adversas el motor recorta el tamaño teórico: 100 %, 75 %, 50 % o 25 %.'],
    ['Régimen', 'Lectura de fondo del activo (bull, bear, rango o transición) sobre su EMA de 200 períodos.'],
    ['Panel Pine', 'Activo fuera del universo del motor: su estado se lee del panel SIGMA Terminal en TradingView.'],
  ]
  const pg11 = pagina(11, 'Sección 09', `
    ${titulo('09', 'Fuentes, disclaimer y redes', 'Cierre del reporte y bases de información')}
    <div class="th-f tr-f thead"><span>Fuente</span><span>Uso en el reporte</span></div>
    ${fuentes.map(([a, b]) => `<div class="tr tr-f"><span class="c-a">${esc(a)}</span><span class="dim">${esc(b)}</span></div>`).join('')}
    <div class="disc"><div class="co-t">Disclaimer</div><p>Este documento es elaborado por SIGMA Research con fines exclusivamente informativos y educativos. No constituye asesoramiento financiero, recomendación de inversión ni oferta de compra o venta. Los niveles y señales del panel son referencias metodológicas de un modelo en desarrollo y validación; se publican por transparencia y no deben interpretarse como instrucciones operativas. Los índices de confluencia no representan probabilidades de éxito. Operar instrumentos apalancados implica riesgo de pérdida total del capital. Cada lector es responsable de sus propias decisiones y debe considerar asesoría profesional independiente si corresponde. Los datos provienen de fuentes consideradas confiables al momento del corte, pero SIGMA Research no garantiza su exactitud ni asume responsabilidad por errores u omisiones de terceros.</p></div>
    <div class="mt-6"><div class="kick mb">Cómo leer el panel</div>${glosario.map(([a, b]) => `<div class="tr tr-f"><span class="c-a">${esc(a)}</span><span class="dim">${esc(b)}</span></div>`).join('')}</div>
    <div class="redes"><div class="kick mb">SIGMA Research en redes</div><div class="rd">Instagram @sigmacapitalclub · Discord · WhatsApp · Telegram · LinkedIn · X @SQuantDesk</div></div>
    <div class="prox">SIGMA RESEARCH · EDICIÓN #${NUM3} · PRÓXIMA EDICIÓN: SEMANA DEL ${addD(lun, 7).getUTCDate()} AL ${addD(vie, 7).getUTCDate()} DE ${MESES[addD(vie, 7).getUTCMonth()].toUpperCase()}</div>
  `)

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>SIGMA Research #${NUM3}</title>
<style>
@font-face{font-family:'Bebas';src:url(${b64('bebas-neue.woff2')}) format('woff2');font-weight:400;font-display:block}
@font-face{font-family:'DMM';src:url(${b64('dm-mono-300.woff2')}) format('woff2');font-weight:300;font-display:block}
@font-face{font-family:'DMM';src:url(${b64('dm-mono-400.woff2')}) format('woff2');font-weight:400;font-display:block}
@font-face{font-family:'DMM';src:url(${b64('dm-mono-500.woff2')}) format('woff2');font-weight:500;font-display:block}
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#080a0f}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:'DMM',monospace;font-weight:300;color:#e8e9f0}
.page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#080a0f;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
.rail{position:absolute;left:0;top:0;bottom:0;width:7mm;background:linear-gradient(180deg,#39e2e6 0,#39e2e6 22%,#202634 22%,#202634 100%);opacity:.85}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(57,226,230,.05) .2mm,transparent .2mm),linear-gradient(90deg,rgba(57,226,230,.05) .2mm,transparent .2mm);background-size:11mm 11mm}
.inner{position:relative;height:100%;padding:15mm 15mm 12mm 20mm;display:flex;flex-direction:column}
.mt{margin-top:auto}
.cab{display:flex;justify-content:space-between;align-items:baseline;font-size:6.4pt;letter-spacing:.16em;text-transform:uppercase;padding-bottom:2.5mm;border-bottom:.2mm solid #202634}
.kick{color:#39e2e6;text-transform:uppercase;font-weight:500;font-size:6.4pt;letter-spacing:.18em}
.mb{display:block;margin-bottom:2mm}.mt-6{margin-top:6mm}.dim{color:#7a7f9a}.tab{font-variant-numeric:tabular-nums}
.up{color:#2fd39a}.dn{color:#ff5d6c}.fl{color:#7a7f9a}.ph{color:#ffb454;opacity:.85}
.pie{display:flex;justify-content:space-between;font-size:6pt;color:#7a7f9a;letter-spacing:.06em;border-top:.2mm solid #202634;padding-top:2.5mm;margin-top:4mm}
.portada .inner{padding-top:18mm}
.mega{font-family:'Bebas';font-size:56pt;line-height:.9;margin-top:16mm;letter-spacing:.01em}.mega em{font-style:normal;color:#39e2e6}
.meta{margin-top:12mm;display:flex;flex-direction:column;gap:2mm}
.meta-1{font-size:9pt;color:#e8e9f0}.meta-2{font-size:7.4pt;color:#7a7f9a}.meta-3{font-size:6.4pt;color:#7a7f9a;letter-spacing:.05em;line-height:1.5}
.blk{margin-top:10mm}
.ag{display:grid;grid-template-columns:20mm 1fr 24mm;gap:3mm;align-items:baseline;padding:1.5mm 0;border-bottom:.2mm solid #161c27;font-size:7.4pt}
.ag-d{color:#7a7f9a;font-weight:500}.ag-d.hot{color:#39e2e6}.ag-e{color:#c3c9d8}.ag-h{color:#7a7f9a;text-align:right;font-size:6.6pt}
.tiles{display:grid;grid-template-columns:repeat(5,1fr);gap:2.4mm;margin-top:8mm}
.tile{background:#0e1119;border:.2mm solid #202634;border-radius:1.6mm;padding:2.6mm 2.8mm}
.t-s{font-size:5.8pt;color:#7a7f9a;letter-spacing:.14em;text-transform:uppercase;font-weight:500}
.t-v{font-family:'Bebas';font-size:16pt;line-height:1.05;margin-top:.6mm;font-variant-numeric:tabular-nums}.t-d{font-size:5.8pt;margin-top:.4mm}
.cierre{font-size:6pt;color:#7a7f9a;text-align:center;line-height:1.7;margin-top:6mm;letter-spacing:.04em}
.th{display:flex;gap:5mm;align-items:flex-start;margin-top:9mm}
.sec-no{font-family:'Bebas';font-size:40pt;line-height:.9;color:#39e2e6;opacity:.3}
.h2{font-family:'Bebas';font-size:26pt;line-height:1}.sub{font-size:7.4pt;color:#7a7f9a;margin-top:.8mm}
.slot{border:.3mm dashed rgba(255,180,84,.45);border-radius:1.4mm;background:rgba(255,180,84,.05);padding:3mm 3.5mm;margin-top:5mm;display:flex;flex-direction:column;gap:1mm}
.slot-t{font-size:5.8pt;letter-spacing:.18em;text-transform:uppercase;color:#ffb454;font-weight:500}.slot-h{font-size:7pt;color:#9aa0b4}
.narr{margin-top:5mm;display:flex;flex-direction:column;gap:2mm}
.narr p{font-size:7.4pt;color:#c3c9d8;line-height:1.6;text-align:justify}
.thead{color:#39e2e6;border-bottom:.25mm solid #39e2e6;font-weight:500;text-transform:uppercase;font-size:5.8pt;letter-spacing:.14em;padding-bottom:1.4mm;margin-top:5mm}
.tr{border-bottom:.2mm solid #161c27;padding:1.5mm 0;font-size:7pt;align-items:center}
.tr-ev,.th-ev{display:grid;grid-template-columns:14mm 42mm 14mm 15mm 1fr;gap:2.5mm}
.tr-pn,.th-pn{display:grid;grid-template-columns:14mm 26mm 15mm 1fr;gap:2.5mm}
.tr-g,.th-g{display:grid;grid-template-columns:16mm 22mm 18mm 18mm 1fr;gap:2.5mm}
.tr-q{display:grid;grid-template-columns:16mm 26mm 16mm 1fr;gap:2.5mm;border-bottom:.2mm solid #161c27;padding:1.5mm 0;font-size:7pt;align-items:center}
.tr-f,.th-f{display:grid;grid-template-columns:36mm 1fr;gap:3mm}
.c-a{font-weight:500}.c-h{color:#7a7f9a;font-size:6.4pt}
.imp{font-size:6.4pt;color:#7a7f9a}.imp.hot{color:#ff5d6c;font-weight:500}.imp.warm{color:#ffb454}
.chip{border:.2mm solid;border-radius:1mm;padding:.3mm 1.6mm;font-size:5.8pt;font-weight:500;letter-spacing:.1em;white-space:nowrap;justify-self:start}
.chip.go{color:#39e2e6;border-color:#39e2e6;background:rgba(57,226,230,.1)}.chip.no{color:#7a7f9a;border-color:#2b3346}.chip.pine{color:#ffb454;border-color:rgba(255,180,84,.5)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:3mm;margin-top:6mm}
.stat{background:#0e1119;border:.2mm solid #202634;border-radius:1.6mm;padding:3mm 3.2mm}
.st-s{font-size:5.8pt;color:#7a7f9a;letter-spacing:.14em;text-transform:uppercase;font-weight:500}
.st-v{font-family:'Bebas';font-size:22pt;line-height:1.05;margin-top:.8mm;font-variant-numeric:tabular-nums}.st-u{font-size:12pt;color:#7a7f9a}.st-d{font-size:6.2pt;margin-top:.6mm}
.callout{border-left:1.2mm solid #39e2e6;background:rgba(57,226,230,.07);padding:3mm 3.5mm;margin-top:5mm}
.co-t{font-size:5.8pt;letter-spacing:.18em;text-transform:uppercase;color:#39e2e6;font-weight:500;margin-bottom:1.2mm}.co-b{font-size:7.2pt;color:#d5dae6;line-height:1.55}
.spk{display:grid;grid-template-columns:14mm 1fr 18mm;gap:3mm;align-items:center;padding:1mm 0}
.spk-s{font-size:6.4pt;color:#7a7f9a;font-weight:500;letter-spacing:.1em}
.spark{display:block;width:100%;height:6mm}.spk-v{font-size:6.8pt;text-align:right;font-variant-numeric:tabular-nums}
.spk-blk{margin-top:4mm}.spk-blk .spark{height:10mm}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:7mm;margin-top:6mm}
.ladder{display:block;width:100%;height:42mm}.ladder .lb{font:400 4.6pt 'DMM',monospace}.ladder .lv{font:500 5.4pt 'DMM',monospace;font-variant-numeric:tabular-nums}
.nota{font-size:5.6pt;color:#7a7f9a;margin-top:2mm;line-height:1.5}
.bul{list-style:none;display:flex;flex-direction:column;gap:1.6mm}
.bul li{font-size:7pt;color:#c3c9d8;padding-left:3.5mm;position:relative;line-height:1.5}
.bul li::before{content:"";position:absolute;left:0;top:1.5mm;width:1.4mm;height:1.4mm;background:#39e2e6}.bul b{font-weight:500;color:#e8e9f0}
.dir{font-size:5.8pt;font-weight:500;letter-spacing:.1em}.dir.lg{color:#2fd39a}.dir.sh{color:#ff5d6c}
.tr-tb,.th-tb{display:grid;grid-template-columns:14mm 16mm 22mm 22mm 20mm 1fr;gap:2mm}
.resto{font-size:6.2pt;padding:1.6mm 0;font-style:italic}
.bs{display:grid;grid-template-columns:12mm 20mm 1fr 14mm;gap:2mm;align-items:center;padding:1mm 0;font-size:6.4pt}
.bs-s{font-weight:500;color:#c3c9d8;letter-spacing:.08em}.bs-n{font-size:5.6pt}
.bs-t{position:relative;height:3mm;background:#0e1119;border:.2mm solid #202634;border-radius:.6mm}
.bs-0{position:absolute;left:50%;top:0;bottom:0;width:.2mm;background:#2b3346}
.bs-b{position:absolute;top:.4mm;bottom:.4mm;border-radius:.4mm}.bs-v{text-align:right;font-variant-numeric:tabular-nums;font-weight:500}
.rg{display:grid;grid-template-columns:14mm 20mm 1fr 20mm 12mm;gap:2.5mm;align-items:center;padding:1.2mm 0;font-size:6.4pt}
.rg-s{font-weight:500;color:#c3c9d8;letter-spacing:.08em}.rg-n{font-variant-numeric:tabular-nums;font-size:6pt}.rg-n:nth-of-type(2){text-align:right}
.rg-b{position:relative;height:2.6mm;background:#0e1119;border:.2mm solid #202634;border-radius:1.3mm}
.rg-t{position:absolute;left:0;right:0;top:50%;height:.2mm;background:#202634}
.rg-m{position:absolute;top:50%;width:1.8mm;height:1.8mm;border-radius:50%;transform:translate(-50%,-50%)}.rg-p{text-align:right;font-variant-numeric:tabular-nums;font-weight:500}
.wk{display:grid;grid-template-columns:repeat(5,1fr);gap:2mm}
.dw{background:#0e1119;border:.2mm solid #202634;border-radius:1.4mm;padding:2.2mm 2.4mm;min-height:20mm}
.dw.on{border-color:#2b3346}.dw.hot{border-color:rgba(57,226,230,.55);background:rgba(57,226,230,.06)}
.dw-d{font-size:6pt;letter-spacing:.14em;text-transform:uppercase;color:#7a7f9a;font-weight:500;margin-bottom:1.6mm}.dw.hot .dw-d{color:#39e2e6}
.dw-c{display:flex;flex-direction:column;gap:1.2mm}.dw-e{font-size:6pt;color:#c3c9d8;line-height:1.35}.dw-x{font-size:5.6pt;color:#4a5163;font-style:italic}
.disc{margin-top:6mm;border:.2mm solid #202634;border-radius:1.6mm;padding:3.5mm}.disc p{font-size:6.4pt;color:#9aa0b4;line-height:1.65;text-align:justify;margin-top:1.5mm}
.redes{margin-top:6mm}.rd{font-size:7pt;color:#c3c9d8}
.prox{margin-top:6mm;text-align:center;font-size:6.2pt;letter-spacing:.16em;color:#39e2e6;border-top:.2mm solid #202634;border-bottom:.2mm solid #202634;padding:2.5mm 0}
@media screen{body{padding:8mm;display:flex;flex-direction:column;align-items:center;gap:8mm}.page{box-shadow:0 4px 30px rgba(0,0,0,.6)}}
</style></head><body>
${pg01}${pg02}${pg03}${pgTrades}${pg05btc}${pg06}${pg07}${pg08}${pg09}${pg10}${pg11}
</body></html>`

  return {
    html, numero: NUMERO, semana: rango,
    conMotor: conMotor.length, ejecutables: ejecutables.length,
    precios: panel.filter(p => p.precio != null).length, faltantes, narrativaError,
  }
}
