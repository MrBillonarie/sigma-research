// Constructor del borrador del SIGMA Research semanal.
//
// El informe que publica el equipo (ediciones #001-#014) tiene 10 paginas con
// una estructura estable. Este modulo arma todo lo que se puede derivar de
// datos duros; lo editorial y lo que vive fuera del sistema queda marcado como
// hueco explicito en vez de inventado.
//
// Reparto de responsabilidades:
//   AUTO  precios de los 13 activos + variacion dia/semana   -> Yahoo Finance
//   AUTO  calendario macro de la semana operativa            -> macro_events
//   AUTO  lectura del motor de BTC / XAU / XAG / WTI         -> VPS /api/public
//   AUTO  numero de edicion, semana operativa, corte, legal  -> calculado
//   HUECO lectura del panel de los otros 9 activos           -> Pine TradingView
//   HUECO narrativas de seccion, clave e idea de la semana   -> editorial
//
// El panel "SIGMA Terminal" corre como indicador Pine en TradingView y no
// publica API, por eso 9 de 13 activos no tienen lectura de motor automatica.

import { createClient } from '@supabase/supabase-js'

// ─── Universo fijo del research ───────────────────────────────────────────────

export type Grupo = 'BTC' | 'USA' | 'CROSS' | 'METALES' | 'ENERGIA'

export interface ActivoDef {
  sym:    string
  label:  string
  yahoo:  string
  /** Simbolo equivalente en el motor del VPS, si existe. */
  motor:  string | null
  grupo:  Grupo
  /** Decimales con los que el informe imprime este activo. */
  dec:    number
  /** El precio se expresa en % (rendimiento del bono, no un nivel). */
  esPct?: boolean
  /** Cotiza 24/7: el corte es sabado, no el cierre del viernes. */
  h24?:   boolean
}

export const UNIVERSO: ActivoDef[] = [
  { sym: 'BTC',   label: 'Bitcoin',            yahoo: 'BTC-USD',  motor: 'BTC', grupo: 'BTC',      dec: 2, h24: true },
  { sym: 'SPX',   label: 'S&P 500',            yahoo: '^GSPC',    motor: null,  grupo: 'USA',      dec: 2 },
  { sym: 'SPY',   label: 'SPY',                yahoo: 'SPY',      motor: null,  grupo: 'USA',      dec: 2 },
  { sym: 'QQQ',   label: 'QQQ',                yahoo: 'QQQ',      motor: null,  grupo: 'USA',      dec: 2 },
  { sym: 'VIX',   label: 'VIX',                yahoo: '^VIX',     motor: null,  grupo: 'CROSS',    dec: 2 },
  { sym: 'DXY',   label: 'DXY',                yahoo: 'DX-Y.NYB', motor: null,  grupo: 'CROSS',    dec: 3 },
  { sym: 'US10Y', label: 'UST 10Y',            yahoo: '^TNX',     motor: null,  grupo: 'CROSS',    dec: 3, esPct: true },
  { sym: 'XAU',   label: 'Oro (XAU)',          yahoo: 'GC=F',     motor: 'XAU', grupo: 'METALES',  dec: 2, h24: true },
  { sym: 'GLD',   label: 'GLD',                yahoo: 'GLD',      motor: null,  grupo: 'METALES',  dec: 2 },
  { sym: 'XAG',   label: 'Plata (XAG)',        yahoo: 'SI=F',     motor: 'XAG', grupo: 'METALES',  dec: 2, h24: true },
  { sym: 'SLV',   label: 'SLV',                yahoo: 'SLV',      motor: null,  grupo: 'METALES',  dec: 2 },
  { sym: 'WTI',   label: 'WTI',                yahoo: 'CL=F',     motor: 'WTI', grupo: 'ENERGIA',  dec: 3 },
  { sym: 'BRENT', label: 'Brent',              yahoo: 'BZ=F',     motor: null,  grupo: 'ENERGIA',  dec: 3 },
]

export const GRUPO_TITULO: Record<Grupo, string> = {
  BTC:     'Bitcoin',
  USA:     'USA — SPX / SPY / QQQ',
  CROSS:   'Cross Asset — VIX / DXY / US10Y',
  METALES: 'Metales — Oro y Plata',
  ENERGIA: 'Energía — WTI y Brent',
}

// ─── Tipos del borrador ───────────────────────────────────────────────────────

export interface LecturaMotor {
  regimen:  string | null
  estado:   string            // 'EJECUTAR LONG' | 'EJECUTAR SHORT' | 'SIN TRADE'
  grade:    string | null
  ev:       number | null
  ddPct:    number | null
  ddMult:   number | null
  entrada:  number | null
  sl:       number | null
  tp:       number | null
  rsiSem:   number | null
  vsEma200: number | null
  razon:    string | null
  /** Frase lista para la columna "Lectura del motor" del panel. */
  resumen:  string
}

export interface PanelRow {
  sym:        string
  label:      string
  grupo:      Grupo
  precio:     number | null
  precioTxt:  string
  chgDia:     number | null
  chgSemana:  number | null
  /** null = activo sin cobertura del motor; hay que leerlo del panel Pine. */
  motor:      LecturaMotor | null
  /** true cuando el dato de precio no se pudo obtener. */
  falla:      boolean
}

export interface EventoRow {
  fecha:    string   // 2026-07-29
  dia:      string   // 'Mié 29'
  evento:   string
  horaET:   string
  impacto:  string   // 'Muy alto' | 'Alto' | 'Medio' | 'Bajo'
  lectura:  string
  fuente:   string
}

export interface Hueco {
  seccion: string
  campo:   string
  motivo:  string
}

export interface ResearchDraft {
  numero:        number
  titulo:        string
  fechaPub:      string   // ISO — domingo/lunes de publicacion
  semanaTexto:   string   // 'Semana operativa del 27 al 31 de julio de 2026'
  corteTexto:    string
  universoTexto: string
  regimenGlobal: string | null
  panel:         PanelRow[]
  eventos:       EventoRow[]
  conteo:        { total: number; conTrade: number; sinTrade: number; sinCobertura: number }
  descripcion:   string
  huecos:        Hueco[]
  generadoEn:    string
  avisos:        string[]
}

// ─── Fechas ───────────────────────────────────────────────────────────────────

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DIAS3 = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number): Date {
  const o = new Date(d.getTime())
  o.setUTCDate(o.getUTCDate() + n)
  return o
}

/**
 * Lunes de la proxima semana operativa. El informe se publica el domingo y
 * cubre la semana siguiente, asi que desde cualquier dia se busca el proximo
 * lunes; si hoy ya es lunes se asume que se esta generando tarde y se cubre
 * esa misma semana.
 */
export function proximoLunes(hoy = new Date()): Date {
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()))
  const dow = d.getUTCDay()            // 0 dom … 6 sab
  if (dow === 1) return d
  return addDays(d, (8 - dow) % 7)
}

/** 'del 27 al 31 de julio de 2026' — colapsa el mes cuando la semana lo cruza. */
function rangoSemana(lun: Date, vie: Date): string {
  const mLun = MESES[lun.getUTCMonth()], mVie = MESES[vie.getUTCMonth()]
  if (mLun === mVie) return `del ${lun.getUTCDate()} al ${vie.getUTCDate()} de ${mVie} de ${vie.getUTCFullYear()}`
  return `del ${lun.getUTCDate()} de ${mLun} al ${vie.getUTCDate()} de ${mVie} de ${vie.getUTCFullYear()}`
}

// ─── Precios (Yahoo) ──────────────────────────────────────────────────────────

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
}

interface SerieDiaria { t: number[]; c: number[] }

async function yahooDiario(symbol: string): Promise<SerieDiaria | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`
    const res = await fetch(url, { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(9000), cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    const r = json?.chart?.result?.[0]
    const ts: number[]           = r?.timestamp ?? []
    const cl: (number | null)[]  = r?.indicators?.quote?.[0]?.close ?? []
    const t: number[] = [], c: number[] = []
    for (let i = 0; i < ts.length; i++) {
      if (cl[i] == null || !Number.isFinite(cl[i] as number)) continue
      t.push(ts[i] * 1000)
      c.push(cl[i] as number)
    }
    return c.length ? { t, c } : null
  } catch {
    return null
  }
}

/**
 * Variacion diaria y semanal. La semanal se mide contra la barra mas cercana a
 * 7 dias atras (no "5 barras atras"): con feriados de bolsa, contar barras
 * desplaza la ventana y compara viernes contra jueves de otra semana.
 */
function variaciones(s: SerieDiaria): { precio: number; dia: number | null; semana: number | null } {
  const n = s.c.length
  const precio = s.c[n - 1]
  const dia = n >= 2 ? ((precio - s.c[n - 2]) / s.c[n - 2]) * 100 : null

  const objetivo = s.t[n - 1] - 7 * 86400_000
  let idx = -1, mejor = Infinity
  for (let i = 0; i < n - 1; i++) {
    const d = Math.abs(s.t[i] - objetivo)
    if (d < mejor) { mejor = d; idx = i }
  }
  const semana = idx >= 0 ? ((precio - s.c[idx]) / s.c[idx]) * 100 : null
  return { precio, dia, semana }
}

function fmtPrecio(v: number | null, dec: number, esPct?: boolean): string {
  if (v == null) return '—'
  const s = v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
  return esPct ? `${s}%` : s
}

// ─── Lectura del motor (VPS) ──────────────────────────────────────────────────

interface SignalVps {
  sym: string; grade?: string; recommendation?: string; reason?: string
  signal?: boolean; price?: number; sl?: number; tp?: number; ev?: number | null
  current_dd_pct?: number | null; dd_kelly_mult?: number | null; type?: string
}

interface RegimeVps { regime?: string; rsi_w?: number; pct_vs_ema?: number }

async function leerMotor(): Promise<{
  signals: SignalVps[]
  regimes: Record<string, RegimeVps>
  regimenGlobal: string | null
  error: string | null
}> {
  const base = process.env.VPS_INTERNAL ?? process.env.VPS_URL ?? 'http://127.0.0.1:8080'
  try {
    const [rPub, rReg] = await Promise.all([
      fetch(`${base}/api/public`, { signal: AbortSignal.timeout(9000), cache: 'no-store' }),
      fetch(`${base}/api/regime`, { signal: AbortSignal.timeout(9000), cache: 'no-store' }),
    ])
    const pub = rPub.ok ? await rPub.json() : {}
    const reg = rReg.ok ? await rReg.json() : {}
    return {
      signals: [...(pub.signals ?? []), ...(pub.top_models ?? [])],
      regimes: reg ?? {},
      regimenGlobal: typeof pub.regime === 'string' ? pub.regime : null,
      error: rPub.ok ? null : `VPS /api/public ${rPub.status}`,
    }
  } catch (e) {
    return { signals: [], regimes: {}, regimenGlobal: null, error: String(e) }
  }
}

function armarLectura(sym: string, sigs: SignalVps[], reg: RegimeVps | undefined): LecturaMotor {
  // De todas las senales del simbolo interesa la mas avanzada: una activable
  // manda sobre una en espera, y entre iguales gana la de mejor grade.
  const ORDEN_GRADE: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 }
  const mias = sigs.filter(s => s.sym === sym)
  const mejor = mias.sort((a, b) => {
    const act = Number(!!b.signal) - Number(!!a.signal)
    if (act !== 0) return act
    return (ORDEN_GRADE[b.grade ?? ''] ?? 0) - (ORDEN_GRADE[a.grade ?? ''] ?? 0)
  })[0]

  const activable = !!mejor?.signal && mejor?.recommendation === 'ACTIVAR'
  const dir = (mejor?.type ?? '').toUpperCase().includes('SHORT') ? 'SHORT' : 'LONG'
  const estado = activable ? `EJECUTAR ${dir}` : 'SIN TRADE'

  const partes: string[] = []
  if (reg?.regime)                     partes.push(`Régimen ${reg.regime.toLowerCase()}`)
  if (mejor?.grade)                    partes.push(`grade ${mejor.grade}`)
  if (mejor?.ev != null)               partes.push(`EV ${mejor.ev.toFixed(2)}R`)
  if (mejor?.current_dd_pct != null)   partes.push(`DD ${mejor.current_dd_pct.toFixed(1)}%`)
  if (mejor?.dd_kelly_mult != null)    partes.push(`tamaño ${Math.round(mejor.dd_kelly_mult * 100)}%`)
  if (reg?.pct_vs_ema != null)         partes.push(`${reg.pct_vs_ema > 0 ? '+' : ''}${reg.pct_vs_ema.toFixed(1)}% vs EMA200`)

  return {
    regimen:  reg?.regime ?? null,
    estado,
    grade:    mejor?.grade ?? null,
    ev:       mejor?.ev ?? null,
    ddPct:    mejor?.current_dd_pct ?? null,
    ddMult:   mejor?.dd_kelly_mult ?? null,
    entrada:  activable ? (mejor?.price ?? null) : null,
    sl:       activable ? (mejor?.sl ?? null)    : null,
    tp:       activable ? (mejor?.tp ?? null)    : null,
    rsiSem:   reg?.rsi_w ?? null,
    vsEma200: reg?.pct_vs_ema ?? null,
    razon:    mejor?.reason ?? null,
    resumen:  partes.length ? `${partes.join('; ')}.` : 'Sin lectura del motor al corte.',
  }
}

// ─── Calendario macro ─────────────────────────────────────────────────────────

const IMPACTO_ES: Record<string, string> = { HIGH: 'Alto', MED: 'Medio', LOW: 'Bajo' }

async function leerEventos(desde: string, hasta: string): Promise<{ eventos: EventoRow[]; error: string | null }> {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data, error } = await sb
      .from('macro_events')
      .select('title,impact,event_date,event_time,description,source')
      .gte('event_date', desde)
      .lte('event_date', hasta)
      .order('event_date', { ascending: true })
    if (error) return { eventos: [], error: error.message }

    const eventos = (data ?? []).map(e => {
      const d = new Date(`${e.event_date}T12:00:00Z`)
      // El FOMC domina cualquier otra cosa de la semana: el informe lo marca
      // siempre por encima de la escala HIGH/MED/LOW.
      const esFomc = /FOMC/i.test(e.title ?? '')
      return {
        fecha:   e.event_date as string,
        dia:     `${DIAS3[d.getUTCDay()]} ${d.getUTCDate()}`,
        evento:  e.title as string,
        horaET:  (e.event_time as string | null)?.slice(0, 5) ?? '—',
        impacto: esFomc ? 'Muy alto' : (IMPACTO_ES[e.impact as string] ?? 'Medio'),
        lectura: (e.description as string | null) ?? '',
        fuente:  (e.source as string | null) ?? '',
      }
    })
    return { eventos, error: null }
  } catch (e) {
    return { eventos: [], error: String(e) }
  }
}

// ─── Constructor ──────────────────────────────────────────────────────────────

export async function construirBorrador(opts: {
  numero: number
  hoy?: Date
}): Promise<ResearchDraft> {
  const hoy = opts.hoy ?? new Date()
  const lun = proximoLunes(hoy)
  const vie = addDays(lun, 4)
  // El corte es el cierre del viernes anterior al lunes de apertura; para los
  // activos 24/7 el informe corta el sabado.
  const vieCorte = addDays(lun, -3)
  const sabCorte = addDays(lun, -2)

  const avisos: string[] = []

  const [motor, cal, series] = await Promise.all([
    leerMotor(),
    leerEventos(iso(lun), iso(vie)),
    Promise.all(UNIVERSO.map(async a => ({ def: a, serie: await yahooDiario(a.yahoo) }))),
  ])

  if (motor.error) avisos.push(`Motor no disponible: ${motor.error}. La lectura de BTC/XAU/XAG/WTI queda vacía.`)
  if (cal.error)   avisos.push(`Calendario macro no disponible: ${cal.error}.`)
  if (!cal.error && cal.eventos.length === 0) {
    avisos.push('No hay eventos macro cargados para esa semana — revisar el cron de calendario o cargarlos a mano.')
  }

  const panel: PanelRow[] = series.map(({ def, serie }) => {
    if (!serie) {
      avisos.push(`Sin precio de ${def.sym} (Yahoo ${def.yahoo}).`)
      return {
        sym: def.sym, label: def.label, grupo: def.grupo,
        precio: null, precioTxt: '—', chgDia: null, chgSemana: null,
        motor: def.motor ? armarLectura(def.motor, motor.signals, motor.regimes[def.motor]) : null,
        falla: true,
      }
    }
    const v = variaciones(serie)
    return {
      sym: def.sym, label: def.label, grupo: def.grupo,
      precio: v.precio,
      precioTxt: fmtPrecio(v.precio, def.dec, def.esPct),
      chgDia: v.dia, chgSemana: v.semana,
      motor: def.motor ? armarLectura(def.motor, motor.signals, motor.regimes[def.motor]) : null,
      falla: false,
    }
  })

  const conCobertura = panel.filter(p => p.motor)
  const conTrade     = conCobertura.filter(p => p.motor!.estado !== 'SIN TRADE').length

  const huecos: Hueco[] = [
    ...panel.filter(p => !p.motor).map(p => ({
      seccion: 'Sección 02 — Lectura del panel',
      campo:   `Estado y lectura de ${p.sym}`,
      motivo:  'Fuera del universo del motor: se lee del panel Pine en TradingView.',
    })),
    { seccion: 'Sección 01', campo: 'CLAVE DE LA SEMANA',      motivo: 'Editorial.' },
    { seccion: 'Sección 02', campo: 'Narrativa + LECTURA GENERAL', motivo: 'Editorial.' },
    { seccion: 'Sección 03', campo: 'Narrativa BTC + niveles',  motivo: 'Los niveles de soporte/resistencia se marcan en el gráfico.' },
    { seccion: 'Sección 04', campo: 'Narrativa USA',            motivo: 'Editorial.' },
    { seccion: 'Sección 05', campo: 'Narrativa Cross Asset',    motivo: 'Editorial.' },
    { seccion: 'Sección 06', campo: 'Narrativa Metales',        motivo: 'Editorial.' },
    { seccion: 'Sección 07', campo: 'Narrativa Energía',        motivo: 'Editorial.' },
    { seccion: 'Sección 08', campo: 'Modelo quant + IDEA DE LA SEMANA', motivo: 'Editorial.' },
  ]

  const num3 = String(opts.numero).padStart(3, '0')

  return {
    numero:        opts.numero,
    titulo:        `SIGMA Research #${num3}`,
    fechaPub:      iso(addDays(lun, -1)),   // domingo previo
    semanaTexto:   `Semana operativa ${rangoSemana(lun, vie)}`,
    corteTexto:    `Corte: bolsa, índices y tasas al cierre viernes ${vieCorte.getUTCDate()} ${MESES[vieCorte.getUTCMonth()].slice(0, 3)}; BTC/XAU/XAG sábado ${sabCorte.getUTCDate()} ${MESES[sabCorte.getUTCMonth()].slice(0, 3)}, hora panel.`,
    universoTexto: `Universo: ${UNIVERSO.map(a => a.sym).join(', ')}`,
    regimenGlobal: motor.regimenGlobal,
    panel,
    eventos:       cal.eventos,
    conteo: {
      total:        panel.length,
      conTrade,
      sinTrade:     conCobertura.length - conTrade,
      sinCobertura: panel.length - conCobertura.length,
    },
    descripcion:   `Research semanal ${rangoSemana(lun, vie)}. Universo de ${UNIVERSO.length} activos: BTC, renta variable EE.UU., cross asset, metales y energía. Calendario macro, lectura del motor y gestión cross-asset.`,
    huecos,
    generadoEn:    new Date().toISOString(),
    avisos,
  }
}
