'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { C } from '@/app/lib/constants'
import { supabase } from '@/app/lib/supabase'
import { useCalendarEvents } from '@/app/hooks/useCalendarEvents'
import type { MacroEvent } from '@/app/data/mockEvents'

// ─── Constantes de diseño ─────────────────────────────────────────────────────
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS   = ['L','M','X','J','V','S','D']

const IMPACT_COLOR: Record<string, string> = { HIGH: C.red, MED: C.yellow, LOW: C.green }
const IMPACT_LABEL: Record<string, string> = { HIGH: 'ALTO',  MED: 'MEDIO',   LOW: 'BAJO'  }

const CURRENCY_COLOR: Record<string, string> = {
  USD: '#60a5fa', EUR: '#a78bfa', GBP: '#f472b6',
  BTC: '#f7931a', ETH: '#8b949e', SOL: '#9945FF', JPY: '#86efac',
}

const EMPTY_FORM = {
  title: '', task_date: '', task_time: '09:00', description: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDaysInMonth(y: number, m: number)  { return new Date(y, m + 1, 0).getDate() }
function getFirstDayOfMonth(y: number, m: number) {
  const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1
}
// Día calendario en hora LOCAL del navegador, no UTC — `.toISOString().slice`
// corre el día para cualquier usuario detrás de UTC en las últimas horas del
// día (un trade de csv_trades cerca de medianoche hora Chile podía aparecer
// agrupado en el día siguiente, y "hoy" resaltado en el grid podía ser
// literalmente el día de mañana en ese mismo rango horario).
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isEventLive(e: MacroEvent, now: Date): boolean {
  try {
    const dt = new Date(`${e.event_date}T${e.event_time}:00`)
    return Math.abs(now.getTime() - dt.getTime()) <= 30 * 60 * 1000
  } catch { return false }
}

function formatLocalTime(date: string, time: string): string {
  try {
    const dt = new Date(`${date}T${time}:00`)
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
  } catch { return time }
}

function formatCountdown(date: string, time: string, now: Date): string {
  try {
    const target = new Date(`${date}T${time}:00`)
    const diff   = target.getTime() - now.getTime()
    if (diff <= 0) return 'PASADO'
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    const m = Math.floor((diff % 3600000)  / 60000)
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  } catch { return '—' }
}

function compareVsForecast(actual: string, forecast: string): 'up' | 'down' | null {
  const a = parseFloat(actual.replace(/[^-\d.]/g, ''))
  const f = parseFloat(forecast.replace(/[^-\d.]/g, ''))
  if (isNaN(a) || isNaN(f)) return null
  return a > f ? 'up' : a < f ? 'down' : null
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function LiveBadge() {
  return (
    <motion.span
      animate={{ opacity: [1, 0.15, 1] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
      style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.2em',
        color: C.green, background: C.green + '1a', padding:'2px 7px' }}
    >
      ● LIVE
    </motion.span>
  )
}

function ImpactPill({ impact }: { impact: string }) {
  const col = IMPACT_COLOR[impact] ?? C.dimText
  return (
    <span style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.15em',
      color: col, background: col + '1a', padding:'2px 7px' }}>
      {IMPACT_LABEL[impact] ?? impact}
    </span>
  )
}

function CurrencyBadge({ currency }: { currency: string }) {
  const col = CURRENCY_COLOR[currency] ?? C.dimText
  return (
    <span style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.15em',
      color: col, background: col + '1a', padding:'2px 7px' }}>
      {currency}
    </span>
  )
}

function SkeletonCell() {
  return (
    <div className="cal-shimmer" style={{ background: C.surface, minHeight:76,
      borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }} />
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CalendarioPage() {
  const { events, loading, error, usingMock, createTask, updateTask, deleteTask } = useCalendarEvents()

  // ── Reloj en vivo (para badge LIVE) ──
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // ── Navegación ──
  const todayMemo  = useMemo(() => new Date(), [])
  const [year,  setYear]  = useState(() => todayMemo.getFullYear())
  const [month, setMonth] = useState(() => todayMemo.getMonth())
  const todayStr = useMemo(() => localDateKey(todayMemo), [todayMemo])

  function prevMonth() { if (month === 0) { setYear(y => y-1); setMonth(11) } else setMonth(m => m-1) }
  function nextMonth() { if (month === 11) { setYear(y => y+1); setMonth(0)  } else setMonth(m => m+1) }

  // ── Filtros ──
  const [fCurrency, setFCurrency] = useState('ALL')
  const [fType,     setFType]     = useState('ALL')
  const [fImpact,   setFImpact]   = useState('ALL')
  const [fLiveOnly, setFLiveOnly] = useState(false)

  // ── Modal de detalle ──
  const [selectedDate,  setSelectedDate]  = useState<string | null>(null)
  const [detailEvent,   setDetailEvent]   = useState<MacroEvent | null>(null)

  // ── P&L diario del Journal (mismo origen de datos que /tax) ──
  const [pnlByDate, setPnlByDate] = useState<Record<string, { pnl: number; count: number }>>({})
  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) return
      const [manualRes, csvRes] = await Promise.all([
        supabase.from('trades').select('fecha, pnl_usd').eq('user_id', user.id),
        supabase.from('csv_trades').select('timestamp, pnl_neto').eq('user_id', user.id),
      ])
      if (!active) return
      const map: Record<string, { pnl: number; count: number }> = {}
      for (const t of manualRes.data ?? []) {
        if (!t.fecha) continue
        const d = map[t.fecha] ?? (map[t.fecha] = { pnl: 0, count: 0 })
        d.pnl += t.pnl_usd ?? 0; d.count++
      }
      for (const t of csvRes.data ?? []) {
        const date = t.timestamp ? localDateKey(new Date(t.timestamp)) : undefined
        if (!date) continue
        const d = map[date] ?? (map[date] = { pnl: 0, count: 0 })
        d.pnl += t.pnl_neto ?? 0; d.count++
      }
      setPnlByDate(map)
    })
    return () => { active = false }
  }, [])

  // ── Modal add/edit ──
  const [showForm,     setShowForm]     = useState(false)
  const [editTarget,   setEditTarget]   = useState<MacroEvent | null>(null)
  const [form,         setForm]         = useState({ ...EMPTY_FORM })
  const [confirmDel,   setConfirmDel]   = useState(false)
  const [formError,    setFormError]    = useState<string | null>(null)
  const [formLoading,  setFormLoading]  = useState(false)

  // ─── Datos derivados ────────────────────────────────────────────────────────

  const filtered = useMemo(() => events.filter(e => {
    if (fCurrency !== 'ALL' && e.currency !== fCurrency) return false
    if (fType     !== 'ALL' && e.type     !== fType)     return false
    if (fImpact   !== 'ALL' && e.impact   !== fImpact)   return false
    if (fLiveOnly && !isEventLive(e, now))               return false
    return true
  }), [events, fCurrency, fType, fImpact, fLiveOnly, now])

  const byDate = useMemo(() => {
    const m: Record<string, MacroEvent[]> = {}
    filtered.forEach(e => { if (!m[e.event_date]) m[e.event_date] = []; m[e.event_date].push(e) })
    return m
  }, [filtered])

  const upcoming = useMemo(() => {
    const limit = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10)
    return filtered.filter(e => e.event_date >= todayStr && e.event_date <= limit)
  }, [filtered, now, todayStr])

  // Próximo evento HIGH para countdown
  const nextHigh = useMemo(() =>
    filtered.find(e => e.impact === 'HIGH' && e.event_date >= todayStr) ?? null,
    [filtered, todayStr]
  )

  // Eventos del día seleccionado
  const dayEvents = useMemo(() =>
    selectedDate ? (byDate[selectedDate] ?? []) : [],
    [byDate, selectedDate]
  )

  // Agrupar upcoming por fecha
  const upcomingByDay = useMemo(() => {
    const groups: { date: string; items: MacroEvent[] }[] = []
    const seen = new Set<string>()
    upcoming.forEach(e => {
      if (!seen.has(e.event_date)) {
        seen.add(e.event_date)
        groups.push({ date: e.event_date, items: upcoming.filter(u => u.event_date === e.event_date) })
      }
    })
    return groups
  }, [upcoming])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function openAdd() {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM, task_date: selectedDate ?? '' })
    setFormError(null); setConfirmDel(false)
    setShowForm(true)
  }

  function openEdit(e: MacroEvent) {
    if (!e.is_task) return // las noticias reales no son editables por el usuario
    setEditTarget(e)
    setForm({ title: e.title, task_date: e.event_date, task_time: e.event_time,
      description: e.description ?? '' })
    setFormError(null); setConfirmDel(false)
    setShowForm(true)
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.task_date) {
      setFormError('Título y fecha son obligatorios.'); return
    }
    setFormLoading(true); setFormError(null)
    try {
      if (editTarget) {
        await updateTask(editTarget.id, { ...form })
      } else {
        await createTask({ ...form })
      }
      setShowForm(false)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete() {
    if (!editTarget) return
    setFormLoading(true)
    try {
      await deleteTask(editTarget.id)
      setShowForm(false); setDetailEvent(null)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setFormLoading(false); setConfirmDel(false)
    }
  }

  async function toggleTaskDone(e: MacroEvent) {
    try {
      await updateTask(e.id, { done: !e.done })
      setDetailEvent(prev => prev && prev.id === e.id ? { ...prev, done: !e.done, actual: !e.done ? 'Hecho' : '' } : prev)
    } catch {}
  }

  const closeModals = useCallback(() => {
    setDetailEvent(null); setSelectedDate(null); setShowForm(false)
  }, [])

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeModals() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeModals])

  // ─── Calendar grid helpers ───────────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay    = getFirstDayOfMonth(year, month)

  // ─── Render ──────────────────────────────────────────────────────────────────
  const mono: React.CSSProperties = { fontFamily:"var(--font-dm-mono,'DM Mono',monospace)" }

  return (
    <>
      {/* ── CSS animations ── */}
      <style>{`
        @keyframes cal-ping   { 75%,100%{ transform:scale(2.1);opacity:0 } }
        @keyframes cal-shimmer{ 0%{background-position:-200% 0}100%{background-position:200% 0} }
        .cal-shimmer{ background:linear-gradient(90deg,${C.border} 25%,${C.surface} 50%,${C.border} 75%);
          background-size:200% 100%; animation:cal-shimmer 1.4s ease infinite; }
        .cal-cell{ transition:background .12s ease; cursor:pointer; }
        .cal-cell:hover{ background:${C.gold}08 !important; }
        .cal-dot-ping{ animation:cal-ping 1.6s cubic-bezier(0,0,.2,1) infinite; }
        .filter-pill{ transition:background .12s,color .12s; cursor:pointer; }
        .filter-pill:hover{ opacity:0.85; }
        .upcoming-row{ transition:background .1s; cursor:pointer; }
        .upcoming-row:hover{ background:${C.gold}08; }
        .form-input{ background:${C.bg}; border:1px solid ${C.border}; color:${C.text};
          font-family:monospace; font-size:12px; padding:8px 10px; width:100%; outline:none;
          transition:border-color .15s; }
        .form-input:focus{ border-color:${C.gold}66; }
        select.form-input option{ background:${C.surface}; }
      `}</style>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {detailEvent && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeModals}
            style={{ position:'fixed', inset:0, zIndex:9990, background:'rgba(4,5,10,.88)',
              backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center',
              padding:'16px' }}
          >
            <motion.div
              initial={{ scale:0.96, y:8 }} animate={{ scale:1, y:0 }} exit={{ scale:0.96, y:8 }}
              transition={{ duration:0.14 }}
              onClick={e => e.stopPropagation()}
              style={{ width:'100%', maxWidth:520, background:C.surface,
                border:`1px solid ${C.border}`, boxShadow:`0 24px 80px rgba(0,0,0,.6)`,
                overflow:'hidden' }}
            >
              {/* Header */}
              <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`,
                display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                    {detailEvent.is_task ? (
                      <span style={{ fontFamily:'monospace', fontSize:9, color:C.gold,
                        background:C.gold+'1a', padding:'2px 7px', letterSpacing:'0.12em' }}>MI TAREA</span>
                    ) : (
                      <>
                        <ImpactPill impact={detailEvent.impact} />
                        <CurrencyBadge currency={detailEvent.currency} />
                      </>
                    )}
                    {isEventLive(detailEvent, now) && <LiveBadge />}
                  </div>
                  <div style={{ ...mono, fontSize:15, color:C.text, fontWeight:600 }}>{detailEvent.title}</div>
                </div>
                <button onClick={closeModals} style={{ background:'none', border:'none',
                  color:C.dimText, fontSize:18, cursor:'pointer', padding:'0 4px', flexShrink:0 }}>×</button>
              </div>

              {/* Body */}
              <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
                {/* Fecha/hora */}
                <div style={{ display:'flex', gap:20 }}>
                  <div>
                    <div style={{ ...mono, fontSize:9, color:C.dimText, letterSpacing:'0.18em',
                      textTransform:'uppercase', marginBottom:3 }}>FECHA</div>
                    <div style={{ ...mono, fontSize:12, color:C.text }}>{detailEvent.event_date}</div>
                  </div>
                  <div>
                    <div style={{ ...mono, fontSize:9, color:C.dimText, letterSpacing:'0.18em',
                      textTransform:'uppercase', marginBottom:3 }}>HORA (LOCAL)</div>
                    <div style={{ ...mono, fontSize:12, color:C.text }}>
                      {formatLocalTime(detailEvent.event_date, detailEvent.event_time)}
                    </div>
                  </div>
                  <div>
                    <div style={{ ...mono, fontSize:9, color:C.dimText, letterSpacing:'0.18em',
                      textTransform:'uppercase', marginBottom:3 }}>FUENTE</div>
                    <div style={{ ...mono, fontSize:12, color:C.dimText }}>{detailEvent.source}</div>
                  </div>
                </div>

                {/* Prev / Forecast / Actual */}
                {(detailEvent.previous || detailEvent.forecast || detailEvent.actual !== undefined) && (
                  <div style={{ display:'flex', gap:16, background:C.bg, padding:'12px 14px',
                    border:`1px solid ${C.border}` }}>
                    {detailEvent.previous && (
                      <div>
                        <div style={{ ...mono, fontSize:9, color:C.dimText, letterSpacing:'0.15em',
                          textTransform:'uppercase', marginBottom:3 }}>ANTERIOR</div>
                        <div style={{ ...mono, fontSize:13, color:C.dimText }}>{detailEvent.previous}</div>
                      </div>
                    )}
                    {detailEvent.forecast && (
                      <div>
                        <div style={{ ...mono, fontSize:9, color:C.dimText, letterSpacing:'0.15em',
                          textTransform:'uppercase', marginBottom:3 }}>PRONÓSTICO</div>
                        <div style={{ ...mono, fontSize:13, color:C.yellow }}>{detailEvent.forecast}</div>
                      </div>
                    )}
                    <div>
                      <div style={{ ...mono, fontSize:9, color:C.dimText, letterSpacing:'0.15em',
                        textTransform:'uppercase', marginBottom:3 }}>{detailEvent.is_task ? 'ESTADO' : 'ACTUAL'}</div>
                      {detailEvent.is_task ? (
                        <button
                          onClick={() => toggleTaskDone(detailEvent)}
                          style={{ ...mono, fontSize:11,
                            background: detailEvent.done ? C.green+'1a' : 'transparent',
                            border:`1px solid ${detailEvent.done ? C.green+'66' : C.border}`,
                            color: detailEvent.done ? C.green : C.dimText,
                            padding:'3px 9px', cursor:'pointer' }}>
                          {detailEvent.done ? '✓ HECHO' : 'MARCAR COMO HECHO'}
                        </button>
                      ) : detailEvent.actual ? (() => {
                        const dir = compareVsForecast(detailEvent.actual, detailEvent.forecast ?? '')
                        return (
                          <span style={{ ...mono, fontSize:13,
                            color: dir==='up' ? C.green : dir==='down' ? C.red : C.text }}>
                            {dir==='up' ? '↑ ' : dir==='down' ? '↓ ' : ''}{detailEvent.actual}
                          </span>
                        )
                      })() : (
                        <span style={{ ...mono, fontSize:11, color:C.muted }}>Pendiente</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Descripción */}
                {detailEvent.description && (
                  <div>
                    <div style={{ ...mono, fontSize:9, color:C.dimText, letterSpacing:'0.18em',
                      textTransform:'uppercase', marginBottom:5 }}>ANÁLISIS DE IMPACTO</div>
                    <div style={{ ...mono, fontSize:11, color:C.dimText, lineHeight:1.6 }}>
                      {detailEvent.description}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer: acciones solo si es tarea propia */}
              {detailEvent.is_task && (
                <div style={{ padding:'12px 20px', borderTop:`1px solid ${C.border}`,
                  display:'flex', gap:8 }}>
                  <button onClick={() => { openEdit(detailEvent); setDetailEvent(null) }}
                    style={{ ...mono, fontSize:10, letterSpacing:'0.12em',
                      background:'none', border:`1px solid ${C.border}`, color:C.gold,
                      padding:'6px 14px', cursor:'pointer' }}>
                    EDITAR TAREA
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add / Edit Modal ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.15 }}
            onClick={() => setShowForm(false)}
            style={{ position:'fixed', inset:0, zIndex:9991, background:'rgba(4,5,10,.9)',
              backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center',
              padding:'16px' }}
          >
            <motion.div
              initial={{ scale:0.96, y:8 }} animate={{ scale:1, y:0 }} exit={{ scale:0.96, y:8 }}
              transition={{ duration:0.14 }}
              onClick={e => e.stopPropagation()}
              style={{ width:'100%', maxWidth:500, background:C.surface,
                border:`1px solid ${C.border}`, maxHeight:'90vh', overflowY:'auto' }}
            >
              {/* Header */}
              <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`,
                display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ ...mono, fontSize:10, letterSpacing:'0.25em',
                  textTransform:'uppercase', color:C.gold }}>
                  {editTarget ? 'EDITAR TAREA' : '+ NUEVA TAREA'}
                </span>
                <button onClick={() => setShowForm(false)}
                  style={{ background:'none', border:'none', color:C.dimText, fontSize:18, cursor:'pointer' }}>×</button>
              </div>

              {/* Form */}
              <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:14 }}>
                {/* Título */}
                <div>
                  <label style={{ ...mono, fontSize:9, color:C.dimText, letterSpacing:'0.18em',
                    textTransform:'uppercase', display:'block', marginBottom:5 }}>TÍTULO *</label>
                  <input className="form-input" value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="ej. Revisar posiciones abiertas" />
                </div>

                {/* Fecha + Hora */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ ...mono, fontSize:9, color:C.dimText, letterSpacing:'0.18em',
                      textTransform:'uppercase', display:'block', marginBottom:5 }}>FECHA *</label>
                    <input type="date" className="form-input" value={form.task_date}
                      onChange={e => setForm(p => ({ ...p, task_date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ ...mono, fontSize:9, color:C.dimText, letterSpacing:'0.18em',
                      textTransform:'uppercase', display:'block', marginBottom:5 }}>HORA</label>
                    <input type="time" className="form-input" value={form.task_time}
                      onChange={e => setForm(p => ({ ...p, task_time: e.target.value }))} />
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <label style={{ ...mono, fontSize:9, color:C.dimText, letterSpacing:'0.18em',
                    textTransform:'uppercase', display:'block', marginBottom:5 }}>DESCRIPCIÓN</label>
                  <textarea className="form-input" rows={3} value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Notas opcionales..."
                    style={{ resize:'vertical', minHeight:68 }} />
                </div>

                {/* Error */}
                {formError && (
                  <div style={{ ...mono, fontSize:11, color:C.red, background:C.red+'12',
                    padding:'8px 12px', border:`1px solid ${C.red}33` }}>{formError}</div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.border}`,
                display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                {editTarget && (
                  confirmDel ? (
                    <div style={{ display:'flex', gap:8 }}>
                      <span style={{ ...mono, fontSize:10, color:C.red }}>¿Confirmar eliminación?</span>
                      <button onClick={handleDelete} disabled={formLoading}
                        style={{ ...mono, fontSize:10, background:C.red, color:'#fff',
                          border:'none', padding:'4px 12px', cursor:'pointer' }}>
                        {formLoading ? '...' : 'ELIMINAR'}
                      </button>
                      <button onClick={() => setConfirmDel(false)}
                        style={{ ...mono, fontSize:10, background:'none',
                          border:`1px solid ${C.border}`, color:C.dimText, padding:'4px 10px', cursor:'pointer' }}>
                        CANCELAR
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDel(true)}
                      style={{ ...mono, fontSize:10, background:'none',
                        border:`1px solid ${C.red}44`, color:C.red, padding:'6px 12px', cursor:'pointer',
                        letterSpacing:'0.12em' }}>
                      ELIMINAR
                    </button>
                  )
                )}
                {!editTarget && <span />}
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setShowForm(false)}
                    style={{ ...mono, fontSize:10, background:'none', border:`1px solid ${C.border}`,
                      color:C.dimText, padding:'6px 14px', cursor:'pointer', letterSpacing:'0.12em' }}>
                    CANCELAR
                  </button>
                  <button onClick={handleSubmit} disabled={formLoading}
                    style={{ ...mono, fontSize:10, background:C.gold, color:'#000',
                      border:'none', padding:'6px 16px', cursor:formLoading?'wait':'pointer',
                      letterSpacing:'0.12em', fontWeight:700, opacity:formLoading?0.6:1 }}>
                    {formLoading ? 'GUARDANDO...' : editTarget ? 'GUARDAR' : 'CREAR TAREA'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page layout ── */}
      <div style={{ minHeight:'100vh', background:C.bg, color:C.text, ...mono }}>
        <div style={{ maxWidth:1320, margin:'0 auto', padding:'72px 24px 56px' }}>

          {/* ── Header ── */}
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:11, letterSpacing:'0.3em', textTransform:'uppercase',
              color:C.gold, marginBottom:8 }}>
              {'// MACRO CALENDAR · EVENTOS ECONÓMICOS'}
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
              <h1 style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:'clamp(40px,5vw,68px)',
                lineHeight:0.93, letterSpacing:'0.03em', margin:0 }}>
                <span style={{ color:C.text }}>MACRO</span>{' '}
                <span style={{ background:`linear-gradient(135deg,${C.gold},${C.glow})`,
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>CALENDAR</span>
              </h1>
              <div style={{ display:'flex', alignItems:'center', gap:10, paddingBottom:6 }}>
                {usingMock && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 10, letterSpacing: '0.12em', color: '#f59e0b',
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                    padding: '4px 10px',
                  }}>
                    <svg width="8" height="8" viewBox="0 0 8 8" style={{ flexShrink: 0 }}>
                      <circle cx="4" cy="4" r="3.5" fill="none" stroke="#f59e0b" strokeWidth="1"/>
                      <line x1="4" y1="2" x2="4" y2="4.5" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round"/>
                      <circle cx="4" cy="6" r="0.6" fill="#f59e0b"/>
                    </svg>
                    EVENTOS DE REFERENCIA — los datos reales se cargan vía SQuant Desk
                  </span>
                )}
                {error && !usingMock && (
                  <span style={{ fontSize:9, color:C.red, background:C.red+'12', padding:'3px 8px' }}>
                    {error}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── FilterBar ── */}
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:20,
            padding:'10px 14px', background:C.surface, border:`1px solid ${C.border}` }}>

            {/* Divisas */}
            <span style={{ fontSize:9, color:C.dimText, letterSpacing:'0.18em', marginRight:4 }}>DIVISA</span>
            {['ALL','USD','EUR','GBP','BTC','ETH'].map(c => (
              <button key={c} className="filter-pill"
                onClick={() => setFCurrency(c)}
                style={{ fontSize:9, letterSpacing:'0.15em', border:`1px solid ${fCurrency===c ? C.gold+'66' : C.border}`,
                  background: fCurrency===c ? C.gold+'14' : 'transparent',
                  color: fCurrency===c ? C.gold : C.dimText,
                  padding:'3px 9px', cursor:'pointer' }}>
                {c === 'ALL' ? 'TODAS' : c}
              </button>
            ))}

            <div style={{ width:1, height:16, background:C.border, margin:'0 4px' }} />

            {/* Tipo */}
            <span style={{ fontSize:9, color:C.dimText, letterSpacing:'0.18em', marginRight:4 }}>TIPO</span>
            {[['ALL','TODOS'],['MACRO','MACRO'],['CRYPTO','CRYPTO']].map(([v,l]) => (
              <button key={v} className="filter-pill"
                onClick={() => setFType(v)}
                style={{ fontSize:9, letterSpacing:'0.15em', border:`1px solid ${fType===v ? C.gold+'66' : C.border}`,
                  background: fType===v ? C.gold+'14' : 'transparent',
                  color: fType===v ? C.gold : C.dimText,
                  padding:'3px 9px', cursor:'pointer' }}>
                {l}
              </button>
            ))}

            <div style={{ width:1, height:16, background:C.border, margin:'0 4px' }} />

            {/* Impacto */}
            <span style={{ fontSize:9, color:C.dimText, letterSpacing:'0.18em', marginRight:4 }}>IMPACTO</span>
            {[['ALL','TODOS'],['HIGH','ALTO'],['MED','MEDIO'],['LOW','BAJO']].map(([v,l]) => {
              const col = v === 'ALL' ? C.gold : IMPACT_COLOR[v]
              return (
                <button key={v} className="filter-pill"
                  onClick={() => setFImpact(v)}
                  style={{ fontSize:9, letterSpacing:'0.15em',
                    border:`1px solid ${fImpact===v ? col+'88' : C.border}`,
                    background: fImpact===v ? col+'14' : 'transparent',
                    color: fImpact===v ? col : C.dimText,
                    padding:'3px 9px', cursor:'pointer' }}>
                  {l}
                </button>
              )
            })}

            <div style={{ width:1, height:16, background:C.border, margin:'0 4px' }} />

            {/* Live toggle */}
            <button className="filter-pill"
              onClick={() => setFLiveOnly(v => !v)}
              style={{ fontSize:9, letterSpacing:'0.15em',
                border:`1px solid ${fLiveOnly ? C.green+'66' : C.border}`,
                background: fLiveOnly ? C.green+'14' : 'transparent',
                color: fLiveOnly ? C.green : C.dimText,
                padding:'3px 9px', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
              {fLiveOnly && <span className="cal-dot-ping" style={{ display:'inline-block', width:5, height:5,
                borderRadius:'50%', background:C.green }} />}
              LIVE
            </button>
          </div>

          {/* ── Main grid: Calendar + Upcoming ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:1,
            background:C.border, alignItems:'start' }}>

            {/* ─── Calendar column ─── */}
            <div style={{ background:C.bg, display:'flex', flexDirection:'column' }}>

              {/* Nav bar */}
              <div style={{ padding:'12px 18px', borderBottom:`1px solid ${C.border}`,
                display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <button onClick={prevMonth}
                  style={{ background:'transparent', border:`1px solid ${C.border}`,
                    color:C.dimText, fontSize:16, padding:'4px 12px', cursor:'pointer' }}>‹</button>
                <span style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:26,
                  color:C.text, letterSpacing:'0.1em' }}>
                  {MONTHS[month]} {year}
                </span>
                <button onClick={nextMonth}
                  style={{ background:'transparent', border:`1px solid ${C.border}`,
                    color:C.dimText, fontSize:16, padding:'4px 12px', cursor:'pointer' }}>›</button>
              </div>

              {/* Day headers */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)',
                borderBottom:`1px solid ${C.border}` }}>
                {DAYS.map(d => (
                  <div key={d} style={{ padding:'7px', textAlign:'center', fontSize:10,
                    letterSpacing:'0.2em', color:C.dimText, background:C.surface }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)',
                borderLeft:`1px solid ${C.border}`, borderTop:`1px solid ${C.border}` }}>
                {/* Celdas vacías al inicio del mes */}
                {Array.from({ length: firstDay }, (_, i) => (
                  <div key={`empty-${i}`} style={{ background:C.bg, minHeight:80,
                    borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }} />
                ))}

                {/* Celdas de días */}
                {loading
                  ? Array.from({ length: daysInMonth }, (_, i) => <SkeletonCell key={i} />)
                  : Array.from({ length: daysInMonth }, (_, i) => {
                    const day     = i + 1
                    const ds      = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                    const evts    = byDate[ds] ?? []
                    const isToday = ds === todayStr
                    const isSel   = ds === selectedDate
                    const hasHigh = evts.some(e => e.impact === 'HIGH')
                    const hasLive = evts.some(e => isEventLive(e, now))
                    const dayPnl  = pnlByDate[ds]

                    return (
                      <div
                        key={day}
                        className="cal-cell"
                        onClick={() => {
                          if (evts.length === 0) { setSelectedDate(dayPnl ? (isSel ? null : ds) : null); return }
                          if (evts.length === 1) { setDetailEvent(evts[0]); setSelectedDate(ds) }
                          else setSelectedDate(isSel ? null : ds)
                        }}
                        style={{
                          background: isSel ? C.gold+'12' : isToday ? C.gold+'07' : C.bg,
                          minHeight:80, padding:'7px 8px', cursor: (evts.length || dayPnl) ? 'pointer' : 'default',
                          borderRight:`1px solid ${C.border}`,
                          borderBottom:`1px solid ${C.border}`,
                          outline: isToday ? `1px solid ${C.gold}22` : 'none',
                          outlineOffset:'-1px',
                          position:'relative',
                        }}
                      >
                        {/* Número del día */}
                        <div style={{ fontSize:12, color:isToday ? C.gold : C.dimText,
                          marginBottom:5, fontWeight:isToday?700:400,
                          display:'flex', alignItems:'center', gap:5 }}>
                          {day}
                          {hasLive && (
                            <span className="cal-dot-ping" style={{ position:'relative',
                              display:'inline-block', width:5, height:5,
                              borderRadius:'50%', background:C.green }} />
                          )}
                        </div>

                        {/* Event dots */}
                        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                          {evts.slice(0, 3).map((e, idx) => {
                            const col = e.is_task ? C.gold : (IMPACT_COLOR[e.impact] ?? C.dimText)
                            const published = e.is_task ? !!e.done : !!e.actual
                            return (
                              <div key={idx} style={{ display:'flex', alignItems:'center', gap:4 }}>
                                {/* Tarea = cuadrado dorado · Noticia: solid = publicado, outline = pendiente */}
                                <span style={{
                                  width:6, height:6, flexShrink:0,
                                  borderRadius: e.is_task ? 1 : '50%',
                                  background: published ? col : 'transparent',
                                  border: published ? 'none' : `1.5px solid ${col}`,
                                }} />
                                <span style={{ fontSize:9, color:C.dimText,
                                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                                  maxWidth:60 }}>
                                  {e.title.split(' ').slice(0,2).join(' ')}
                                </span>
                              </div>
                            )
                          })}
                          {evts.length > 3 && (
                            <span style={{ fontSize:9, color:C.muted }}>+{evts.length-3} más</span>
                          )}
                        </div>

                        {/* Borde rojo-pulsante si HIGH este día */}
                        {hasHigh && !isSel && (
                          <div style={{ position:'absolute', top:0, left:0, bottom:0,
                            width:2, background:C.red+'66' }} />
                        )}

                        {/* P&L neto del día (Journal) */}
                        {dayPnl && (
                          <span style={{ position:'absolute', top:6, right:7,
                            fontSize:9, fontFamily:'monospace', fontWeight:600,
                            color: dayPnl.pnl >= 0 ? C.green : C.red }}>
                            {dayPnl.pnl >= 0 ? '+' : '-'}${Math.round(Math.abs(dayPnl.pnl)).toLocaleString('es-CL')}
                          </span>
                        )}
                      </div>
                    )
                  })
                }
              </div>

              {/* Leyenda */}
              <div style={{ padding:'11px 18px', borderTop:`1px solid ${C.border}`,
                display:'flex', gap:20, flexWrap:'wrap' }}>
                {([['HIGH',C.red,'Alto impacto'],['MED',C.yellow,'Medio'],['LOW',C.green,'Bajo']] as const).map(([k,col,l]) => (
                  <div key={k} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:col }} />
                    <span style={{ fontSize:10, color:C.dimText }}>{l}</span>
                  </div>
                ))}
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:'transparent',
                    border:`1.5px solid ${C.dimText}` }} />
                  <span style={{ fontSize:10, color:C.dimText }}>Pendiente publicación</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:C.green }} />
                  <span style={{ fontSize:10, color:C.dimText }}>En curso (LIVE)</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:8, height:8, borderRadius:1, background:C.gold }} />
                  <span style={{ fontSize:10, color:C.dimText }}>Mi tarea</span>
                </div>
              </div>

              {/* Resumen de trading del día seleccionado (Journal) */}
              <AnimatePresence>
                {selectedDate && pnlByDate[selectedDate] && (
                  <motion.div
                    initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                    exit={{ opacity:0, height:0 }} transition={{ duration:0.2 }}
                    style={{ borderTop:`1px solid ${C.border}`, overflow:'hidden' }}
                  >
                    <div style={{ padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                      <div>
                        <span style={{ fontSize:10, letterSpacing:'0.22em', color:C.gold, textTransform:'uppercase' }}>
                          TRADING — {selectedDate}
                        </span>
                        <div style={{ fontSize:12, color:C.dimText, marginTop:4 }}>
                          {pnlByDate[selectedDate].count} trade{pnlByDate[selectedDate].count !== 1 ? 's' : ''} ·{' '}
                          <span style={{ color: pnlByDate[selectedDate].pnl >= 0 ? C.green : C.red, fontWeight:600 }}>
                            P&amp;L neto: {pnlByDate[selectedDate].pnl >= 0 ? '+' : '-'}${Math.round(Math.abs(pnlByDate[selectedDate].pnl)).toLocaleString('es-CL')}
                          </span>
                        </div>
                      </div>
                      <a href="/journal" style={{ fontSize:10, color:C.gold, textDecoration:'underline', fontFamily:'monospace', whiteSpace:'nowrap' }}>
                        Ver en Journal →
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Panel de eventos del día seleccionado */}
              <AnimatePresence>
                {selectedDate && dayEvents.length > 1 && (
                  <motion.div
                    initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                    exit={{ opacity:0, height:0 }} transition={{ duration:0.2 }}
                    style={{ borderTop:`1px solid ${C.border}`, overflow:'hidden' }}
                  >
                    <div style={{ padding:'16px 18px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                        marginBottom:12 }}>
                        <span style={{ fontSize:10, letterSpacing:'0.22em', color:C.gold,
                          textTransform:'uppercase' }}>
                          EVENTOS — {selectedDate}
                        </span>
                        <button onClick={() => setSelectedDate(null)}
                          style={{ background:'none', border:'none', color:C.dimText,
                            cursor:'pointer', fontSize:14 }}>×</button>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {dayEvents.map((e, i) => (
                          <div key={i}
                            onClick={() => setDetailEvent(e)}
                            style={{ display:'flex', gap:12, padding:'11px 14px',
                              background:C.surface, border:`1px solid ${C.border}`,
                              cursor:'pointer', transition:'background .12s' }}
                            onMouseEnter={el => (el.currentTarget as HTMLElement).style.background = C.gold+'08'}
                            onMouseLeave={el => (el.currentTarget as HTMLElement).style.background = C.surface}
                          >
                            <span style={{ width:7, height:7, flexShrink:0,
                              borderRadius: e.is_task ? 1 : '50%',
                              background: (e.is_task ? e.done : e.actual) ? (e.is_task ? C.gold : IMPACT_COLOR[e.impact]) : 'transparent',
                              border: (e.is_task ? e.done : e.actual) ? 'none' : `1.5px solid ${e.is_task ? C.gold : IMPACT_COLOR[e.impact]}`,
                              marginTop:4 }} />
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', justifyContent:'space-between',
                                alignItems:'flex-start', gap:8, marginBottom:4 }}>
                                <span style={{ fontSize:12, color:C.text }}>{e.title}</span>
                                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                                  {isEventLive(e, now) && <LiveBadge />}
                                  {e.is_task ? (
                                    <span style={{ fontFamily:'monospace', fontSize:9, color:C.gold,
                                      background:C.gold+'1a', padding:'1px 6px', letterSpacing:'0.1em' }}>MI TAREA</span>
                                  ) : (
                                    <ImpactPill impact={e.impact} />
                                  )}
                                </div>
                              </div>
                              <div style={{ display:'flex', gap:14 }}>
                                <span style={{ fontSize:10, color:C.dimText }}>{e.event_time}{e.is_task ? '' : ' ET'}</span>
                                {!e.is_task && <CurrencyBadge currency={e.currency} />}
                                {e.forecast && <span style={{ fontSize:10, color:C.yellow }}>Est: {e.forecast}</span>}
                                {e.actual && <span style={{ fontSize:10, color:C.green }}>Act: {e.actual}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ─── Upcoming sidebar ─── */}
            <div style={{ background:C.surface, display:'flex', flexDirection:'column' }}>

              {/* Header + botón */}
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  marginBottom: nextHigh ? 10 : 0 }}>
                  <span style={{ fontSize:10, letterSpacing:'0.22em', textTransform:'uppercase',
                    color:C.dimText }}>
                    PRÓXIMOS 14 DÍAS
                  </span>
                  <button onClick={openAdd}
                    style={{ fontSize:9, letterSpacing:'0.15em', fontWeight:700,
                      background:C.gold, color:'#000', border:'none',
                      padding:'5px 11px', cursor:'pointer' }}>
                    + TAREA
                  </button>
                </div>

                {/* Countdown al próximo HIGH */}
                {nextHigh && (
                  <div style={{ background:C.red+'10', border:`1px solid ${C.red}33`,
                    padding:'8px 10px', marginTop:10 }}>
                    <div style={{ fontSize:9, color:C.red, letterSpacing:'0.15em',
                      textTransform:'uppercase', marginBottom:3 }}>
                      PRÓXIMO HIGH IMPACT
                    </div>
                    <div style={{ fontSize:11, color:C.text, marginBottom:2,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {nextHigh.title}
                    </div>
                    <div style={{ fontSize:13, color:C.red, fontFamily:"'Bebas Neue',Impact,sans-serif",
                      letterSpacing:'0.08em' }}>
                      {formatCountdown(nextHigh.event_date, nextHigh.event_time, now)}
                    </div>
                  </div>
                )}
              </div>

              {/* Lista de eventos */}
              <div style={{ overflowY:'auto', maxHeight:'calc(100vh - 280px)' }}>
                {/* Banner visible cuando se usan datos de referencia */}
                {!loading && usingMock && (
                  <div style={{
                    margin:'10px 12px 0', padding:'10px 12px',
                    background:'rgba(245,158,11,0.07)',
                    border:'1px solid rgba(245,158,11,0.30)',
                    display:'flex', alignItems:'flex-start', gap:8,
                  }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" style={{ flexShrink:0, marginTop:1 }}>
                      <circle cx="6.5" cy="6.5" r="6" fill="none" stroke="#f59e0b" strokeWidth="1.2"/>
                      <line x1="6.5" y1="3.5" x2="6.5" y2="7.5" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round"/>
                      <circle cx="6.5" cy="9.5" r="0.8" fill="#f59e0b"/>
                    </svg>
                    <span style={{ fontFamily:'monospace', fontSize:10, color:'#f59e0b', lineHeight:1.5 }}>
                      Mostrando eventos de referencia. Los datos en tiempo real requieren configuración de API (FRED / CoinMarketCal).
                    </span>
                  </div>
                )}
                {loading ? (
                  Array.from({ length: 5 }, (_, i) => (
                    <div key={i} style={{ padding:'14px 16px', borderBottom:`1px solid ${C.border}` }}>
                      <div className="cal-shimmer" style={{ height:10, width:'60%', marginBottom:6, borderRadius:2 }} />
                      <div className="cal-shimmer" style={{ height:8, width:'40%', borderRadius:2 }} />
                    </div>
                  ))
                ) : upcomingByDay.length === 0 ? (
                  <div style={{ padding:'24px 16px', fontSize:11, color:C.muted }}>
                    Sin eventos próximos.
                  </div>
                ) : upcomingByDay.map(({ date, items }) => (
                  <div key={date}>
                    {/* Cabecera de día */}
                    <div style={{ padding:'8px 16px 4px', background:C.bg,
                      borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:9, letterSpacing:'0.2em', color:C.gold,
                        textTransform:'uppercase' }}>
                        {date.slice(5)} · {MONTHS[parseInt(date.slice(5,7))-1].slice(0,3).toUpperCase()}
                      </span>
                    </div>
                    {items.map((e, i) => (
                      <div key={i} className="upcoming-row"
                        onClick={() => { setDetailEvent(e); setSelectedDate(e.event_date) }}
                        style={{ padding:'10px 16px', borderBottom:`1px solid ${C.border}` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                          <span style={{
                            width:6, height:6, flexShrink:0,
                            borderRadius: e.is_task ? 1 : '50%',
                            background: (e.is_task ? e.done : e.actual) ? (e.is_task ? C.gold : IMPACT_COLOR[e.impact]) : 'transparent',
                            border: (e.is_task ? e.done : e.actual) ? 'none' : `1.5px solid ${e.is_task ? C.gold : IMPACT_COLOR[e.impact]}`,
                          }} />
                          <span style={{ fontSize:10, color:C.dimText }}>{e.event_time}{e.is_task ? '' : ' ET'}</span>
                          {e.is_task ? (
                            <span style={{ fontFamily:'monospace', fontSize:9, color:C.gold,
                              background:C.gold+'1a', padding:'1px 6px', letterSpacing:'0.1em' }}>MI TAREA</span>
                          ) : (
                            <CurrencyBadge currency={e.currency} />
                          )}
                          {isEventLive(e, now) && <LiveBadge />}
                        </div>
                        <div style={{ fontSize:11, color:C.text, marginLeft:13, marginBottom:3 }}>
                          {e.title}
                        </div>
                        {(e.forecast || e.actual) && (
                          <div style={{ display:'flex', gap:12, marginLeft:13 }}>
                            {e.forecast && <span style={{ fontSize:10, color:C.yellow }}>Est: {e.forecast}</span>}
                            {e.actual   && <span style={{ fontSize:10, color:C.green }}>Act: {e.actual}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
