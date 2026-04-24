'use client'
import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
type Difficulty = 'FÁCIL' | 'MEDIO' | 'DIFÍCIL'
type GoalType   = 'amount' | 'days' | 'boolean'

interface DailyChallenge {
  id:        string
  icon:      string
  title:     string
  desc:      string
  amountBase: number          // 0 = no monetary component
  unitFn:    (amt: number) => string
  impactFn:  (amt: number) => string
}

interface WeeklyChallenge {
  id:         string
  difficulty: Difficulty
  title:      string
  desc:       string
  goalType:   GoalType
  goalMax:    number
  reward:     string
}

interface ChallengeStore {
  completed:      Record<string, string[]>
  maxStreak:      number
  totalCompleted: number
  totalSaved:     number
  weeklyProgress: Record<string, Record<string, number>>
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const GOLD   = '#F5C842'
const GREEN  = '#22c55e'
const ORANGE = '#f97316'
const MONO   = "var(--font-dm-mono,'DM Mono',monospace)"
const MUTED  = 'rgba(255,255,255,0.38)'
const DIM    = 'rgba(255,255,255,0.22)'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getToday(): string { return new Date().toISOString().split('T')[0] }

function getWeekKey(d = new Date()): string {
  const year  = d.getFullYear()
  const start = new Date(year, 0, 1)
  const week  = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
  return `${year}-W${week}`
}

function computeStreak(completed: Record<string, string[]>): number {
  const today = getToday()
  const hasToday = (completed[today]?.length ?? 0) > 0
  let streak = 0
  for (let i = hasToday ? 0 : 1; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    if ((completed[key]?.length ?? 0) > 0) streak++
    else break
  }
  return streak
}

function scaleAmt(ahorro: number, base: number): number {
  if (base === 0) return 0
  const factor = ahorro < 500 ? 0.5 : ahorro < 2000 ? 1 : 2
  return Math.max(1, Math.round(base * factor))
}

function fmtUSD(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${Math.round(n)}`
}

// ─── Challenge data ───────────────────────────────────────────────────────────
const DAILY: DailyChallenge[] = [
  // 0 Sun
  {
    id: 'sun', icon: '🗓️',
    title: 'Planifica la semana financiera',
    desc:  'Define tu presupuesto de la semana, revisa tus metas FIRE y ajusta el slider de ahorro si cambiaste ingresos.',
    amountBase: 0,
    unitFn:    () => 'Plan semanal listo',
    impactFn:  () => 'Planificación semanal reduce el gasto promedio un 23% según estudios conductuales',
  },
  // 1 Mon
  {
    id: 'mon', icon: '⚡',
    title: 'El café de hoy, al portafolio',
    desc:  'Transfiere al ahorro en vez de un gasto extra. Pequeño sacrificio, gran impacto compuesto.',
    amountBase: 2,
    unitFn:    (a) => `+${fmtUSD(a)} hoy`,
    impactFn:  (a) => {
      const yr  = fmtUSD(a * 365)
      const dec = fmtUSD(Math.round(a * 365 * ((Math.pow(1.08, 10) - 1) / 0.08)))
      return `Repetido 1 año → +${yr} · Al 8% anual en 10 años → +${dec}`
    },
  },
  // 2 Tue
  {
    id: 'tue', icon: '📵',
    title: 'Día sin compras impulsivas',
    desc:  'Pausa cualquier compra no planificada por 24h. Si mañana igual la quieres, entonces cómprala.',
    amountBase: 0,
    unitFn:    () => '$0 gasto impulsivo',
    impactFn:  () => 'El usuario promedio ahorra $18/mes practicando esta regla',
  },
  // 3 Wed
  {
    id: 'wed', icon: '📈',
    title: 'Revisa tu equity curve',
    desc:  'Abre el HUD y revisa el rendimiento de tus modelos activos. Toma nota de una mejora posible.',
    amountBase: 0,
    unitFn:    () => '1 insight de mercado',
    impactFn:  () => 'Traders que revisan métricas semanalmente mejoran su win rate un 12%',
  },
  // 4 Thu
  {
    id: 'thu', icon: '🎯',
    title: 'Busca ingresos extra hoy',
    desc:  'Vende algo que no uses, ofrece un servicio pequeño o negocia un descuento.',
    amountBase: 5,
    unitFn:    (a) => `+${fmtUSD(a)} ingreso extra`,
    impactFn:  (a) => `Si lo haces 2× semana → +${fmtUSD(a * 2 * 52)}/año al portafolio`,
  },
  // 5 Fri
  {
    id: 'fri', icon: '🧮',
    title: 'Calcula tu tasa de ahorro real',
    desc:  'Divide tu ahorro mensual entre tu ingreso total. Si es menor al 20%, ajusta un gasto esta semana.',
    amountBase: 0,
    unitFn:    () => 'Tasa de ahorro ≥ 20%',
    impactFn:  () => 'Subir del 10% al 20% de ahorro puede adelantar tu FIRE hasta 7 años',
  },
  // 6 Sat
  {
    id: 'sat', icon: '📚',
    title: 'Lee 10 páginas sobre finanzas',
    desc:  '"The Psychology of Money", "A Random Walk Down Wall Street" o cualquier libro financiero.',
    amountBase: 0,
    unitFn:    () => '10 páginas leídas',
    impactFn:  () => '1 libro/mes = 12 libros/año. El conocimiento es el activo que más compone',
  },
]

const WEEKLY_A: WeeklyChallenge[] = [
  {
    id: 'wa1', difficulty: 'FÁCIL',
    title: 'Ahorra $10 esta semana',
    desc:  'Divide en $1.43/día. Redondea vueltos, evita una compra pequeña o vende algo digital.',
    goalType: 'amount', goalMax: 10,
    reward: '🏆 +7 días de racha FIRE',
  },
  {
    id: 'wa2', difficulty: 'MEDIO',
    title: 'Genera $20 de ingreso extra',
    desc:  'Freelance, venta de objetos, cashback, descuentos negociados. Todo suma.',
    goalType: 'amount', goalMax: 20,
    reward: '🏆 +$20 al capital FIRE registrado',
  },
  {
    id: 'wa3', difficulty: 'DIFÍCIL',
    title: 'Sin ocio esta semana',
    desc:  'Cero streaming extra, salidas ni entretenimiento no esencial. Solo lo necesario.',
    goalType: 'days', goalMax: 7,
    reward: '🏆 Ahorro estimado $50–$80 esta semana',
  },
]

const WEEKLY_B: WeeklyChallenge[] = [
  {
    id: 'wb1', difficulty: 'FÁCIL',
    title: 'Sin delivery esta semana',
    desc:  'Cocina en casa todos los días. El ahorro promedio es $25–$40 vs. pedir a domicilio.',
    goalType: 'days', goalMax: 7,
    reward: '🏆 Ahorro estimado $30 directo al portafolio',
  },
  {
    id: 'wb2', difficulty: 'MEDIO',
    title: 'Optimiza 1 suscripción',
    desc:  'Cancela, baja de plan o negocia una suscripción. El ahorro promedio es $15/mes.',
    goalType: 'boolean', goalMax: 1,
    reward: '🏆 +$180/año proyectado',
  },
  {
    id: 'wb3', difficulty: 'DIFÍCIL',
    title: 'Sube tu ahorro mensual 5%',
    desc:  'Ajusta el slider de Ahorro Mensual en el FIRE Planner un 5% más alto y mantenlo esta semana.',
    goalType: 'boolean', goalMax: 1,
    reward: '🏆 Recalcular cuántos años adelantaste tu FIRE',
  },
]

const WEEKLY_SETS = [WEEKLY_A, WEEKLY_B]

const STORE_DEFAULT: ChallengeStore = {
  completed: {}, maxStreak: 0, totalCompleted: 0, totalSaved: 0, weeklyProgress: {},
}

// ─── Subcomponents ────────────────────────────────────────────────────────────
function DiffBadge({ d }: { d: Difficulty }) {
  const styles: Record<Difficulty, { bg: string; color: string }> = {
    'FÁCIL':   { bg: 'rgba(34,197,94,0.12)',   color: GREEN  },
    'MEDIO':   { bg: 'rgba(245,200,66,0.12)',   color: GOLD   },
    'DIFÍCIL': { bg: 'rgba(249,115,22,0.12)',   color: ORANGE },
  }
  const s = styles[d]
  return (
    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
      background: s.bg, color: s.color, borderRadius: 4, padding: '2px 7px' }}>
      {d}
    </span>
  )
}

function ProgressBar({ value, max, color = GOLD }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0)
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { ahorro: number; capital: number }

export default function FireChallenges({ ahorro, capital }: Props) {
  const [store,     setStore]     = useState<ChallengeStore>(STORE_DEFAULT)
  const [mounted,   setMounted]   = useState(false)
  const [showInput, setShowInput] = useState<string | null>(null)
  const [inputVal,  setInputVal]  = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fire_challenges')
      if (raw) setStore(JSON.parse(raw) as ChallengeStore)
    } catch { /* ignore */ }
    setMounted(true)
  }, [])

  const today    = getToday()
  const weekKey  = getWeekKey()
  const weekNum  = parseInt(weekKey.split('-W')[1])
  const dayOfWeek = new Date().getDay()

  const daily   = DAILY[dayOfWeek]
  const weeklys = WEEKLY_SETS[weekNum % WEEKLY_SETS.length]
  const amt     = scaleAmt(ahorro, daily.amountBase)

  const streak     = computeStreak(store.completed)
  const isDailyDone = store.completed[today]?.includes(daily.id) ?? false

  const weekProgress = store.weeklyProgress[weekKey] ?? {}

  // Check if capital is configured
  const isUnconfigured = capital === 0

  function persist(s: ChallengeStore) {
    setStore(s)
    try { localStorage.setItem('fire_challenges', JSON.stringify(s)) } catch { /* ignore */ }
  }

  function completeDaily() {
    if (isDailyDone) return
    const prev     = store.completed[today] ?? []
    const newComp  = { ...store.completed, [today]: [...prev, daily.id] }
    const newStreak = computeStreak(newComp)
    persist({
      ...store,
      completed:      newComp,
      maxStreak:      Math.max(store.maxStreak, newStreak),
      totalCompleted: store.totalCompleted + 1,
      totalSaved:     store.totalSaved + amt,
    })
  }

  function getWeeklyProgress(id: string): number { return weekProgress[id] ?? 0 }

  function addWeeklyProgress(ch: WeeklyChallenge, value: number) {
    const current = getWeeklyProgress(ch.id)
    const next    = Math.min(ch.goalMax, current + value)
    const wasComplete = current >= ch.goalMax
    const nowComplete = next >= ch.goalMax

    const newWeekProg = { ...weekProgress, [ch.id]: next }
    const newComp     = { ...store.completed }
    if (!wasComplete && nowComplete) {
      const prev = newComp[today] ?? []
      newComp[today] = [...prev, ch.id]
    }
    persist({
      ...store,
      completed:      newComp,
      weeklyProgress: { ...store.weeklyProgress, [weekKey]: newWeekProg },
      totalCompleted: !wasComplete && nowComplete ? store.totalCompleted + 1 : store.totalCompleted,
      totalSaved:     store.totalSaved + (ch.goalType === 'amount' ? value : 0),
      maxStreak:      Math.max(store.maxStreak, computeStreak(newComp)),
    })
    setShowInput(null)
    setInputVal('')
  }

  function handleRegister(ch: WeeklyChallenge) {
    if (ch.goalType === 'boolean') {
      addWeeklyProgress(ch, 1)
    } else if (ch.goalType === 'days') {
      addWeeklyProgress(ch, 1)
    } else {
      // amount: show input
      if (showInput === ch.id) {
        const v = parseFloat(inputVal)
        if (!isNaN(v) && v > 0) addWeeklyProgress(ch, v)
        else { setShowInput(null); setInputVal('') }
      } else {
        setShowInput(ch.id)
        setInputVal('')
      }
    }
  }

  // Yesterday message
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().split('T')[0]
  const missedYesterday = !isUnconfigured && streak === 0 && (store.completed[yesterdayKey] === undefined) && store.totalCompleted > 0

  // Perfect week banner
  const showPerfectBanner = streak >= 7

  if (!mounted) {
    return (
      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: DIM }}>Cargando retos…</span>
      </div>
    )
  }

  // ── Unconfigured state ───────────────────────────────────────────────────────
  if (isUnconfigured) {
    return (
      <div style={{ marginTop: 32 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.25em', color: GOLD, marginBottom: 20 }}>
          {'// RETOS FIRE · HOY & ESTA SEMANA'}
        </div>
        <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderLeft: `3px solid ${GOLD}`, borderRadius: 12, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 28 }}>⚙</span>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: '#e8e9f0', fontWeight: 600, marginBottom: 6 }}>
              Configura tu capital para activar retos personalizados
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>
              Ajusta el slider de Capital Actual arriba para ver retos adaptados a tu situación.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 40 }}>

      {/* Section header */}
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.25em', color: GOLD, marginBottom: 20 }}>
        {'// RETOS FIRE · HOY & ESTA SEMANA'}
      </div>

      {/* Perfect week banner */}
      {showPerfectBanner && (
        <div style={{ background: 'rgba(245,200,66,0.07)', border: `1px solid ${GOLD}44`, borderRadius: 10, padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🏆</span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: GOLD }}>
            ¡{streak} días de racha perfecta! Estás adelantando tu FIRE.
          </span>
        </div>
      )}

      {/* Missed yesterday banner */}
      {missedYesterday && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>💪</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>
            Ayer no completaste tu reto. Hoy puedes retomar la racha.
          </span>
        </div>
      )}

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ── Daily challenge ── */}
        <div style={{
          background: isDailyDone ? 'rgba(34,197,94,0.03)' : '#111111',
          border: `1px solid rgba(255,255,255,0.08)`,
          borderLeft: isDailyDone ? `3px solid ${GREEN}` : `3px solid ${GOLD}`,
          borderRadius: 12,
          padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: 14,
        } as React.CSSProperties}>
          {/* Eyebrow */}
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: isDailyDone ? GREEN : MUTED }}>
            {'// RETO DE HOY'}
          </div>
          {/* Icon + title */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>{daily.icon}</span>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 15, color: '#e8e9f0', fontWeight: 600, lineHeight: 1.3, marginBottom: 8 }}>
                {daily.title}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
                {daily.desc}
              </div>
            </div>
          </div>

          {/* Meta amount */}
          {daily.amountBase > 0 && (
            <div style={{ fontFamily: MONO, fontSize: 20, color: GOLD, fontWeight: 600 }}>
              {daily.unitFn(amt)}
            </div>
          )}
          {daily.amountBase === 0 && (
            <div style={{ fontFamily: MONO, fontSize: 13, color: DIM }}>
              Meta: {daily.unitFn(0)}
            </div>
          )}

          {/* FIRE impact */}
          <div style={{ fontFamily: MONO, fontSize: 11, color: GREEN, lineHeight: 1.6, background: 'rgba(34,197,94,0.05)', borderRadius: 6, padding: '8px 12px' }}>
            ↗ {daily.impactFn(amt)}
          </div>

          {/* Streak */}
          <div style={{ fontFamily: MONO, fontSize: 11, color: GOLD, letterSpacing: '0.06em' }}>
            🔥 RACHA: {streak} {streak === 1 ? 'día' : 'días'} seguidos
          </div>

          {/* Complete button */}
          <button
            onClick={completeDaily}
            disabled={isDailyDone}
            style={{
              padding: '11px 0', borderRadius: 8, fontFamily: MONO, fontSize: 11,
              fontWeight: 700, letterSpacing: '0.12em', cursor: isDailyDone ? 'default' : 'pointer',
              border: `1px solid ${isDailyDone ? GREEN : GOLD}`,
              color: isDailyDone ? GREEN : '#000',
              background: isDailyDone ? 'transparent' : GOLD,
              transition: 'all 0.2s',
            }}
          >
            {isDailyDone ? '✓ COMPLETADO' : '✓ MARCAR COMPLETADO'}
          </button>
        </div>

        {/* ── Weekly challenges ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {weeklys.map(ch => {
            const progress = getWeeklyProgress(ch.id)
            const isDone   = progress >= ch.goalMax
            const isShowing = showInput === ch.id

            let progressLabel = ''
            if (ch.goalType === 'amount')  progressLabel = `${fmtUSD(progress)} de ${fmtUSD(ch.goalMax)}`
            if (ch.goalType === 'days')    progressLabel = `${Math.round(progress)} de ${ch.goalMax} días`
            if (ch.goalType === 'boolean') progressLabel = isDone ? 'Completado' : 'Pendiente'

            return (
              <div key={ch.id} style={{
                background: isDone ? 'rgba(34,197,94,0.03)' : '#111111',
                border: '1px solid rgba(255,255,255,0.08)',
                borderLeft: isDone ? `3px solid ${GREEN}` : `2px solid rgba(255,255,255,0.06)`,
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {/* Eyebrow + badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: MUTED }}>
                    {'// RETO SEMANAL'}
                  </span>
                  <DiffBadge d={ch.difficulty} />
                </div>

                {/* Title + desc */}
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 13, color: '#e8e9f0', fontWeight: 600, marginBottom: 5 }}>
                    {ch.title}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                    {ch.desc}
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: isDone ? GREEN : DIM }}>
                      {progressLabel}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: DIM }}>
                      {Math.round((progress / ch.goalMax) * 100)}%
                    </span>
                  </div>
                  <ProgressBar value={progress} max={ch.goalMax} color={isDone ? GREEN : GOLD} />
                </div>

                {/* Reward */}
                <div style={{ fontFamily: MONO, fontSize: 10, color: GOLD }}>
                  {ch.reward}
                </div>

                {/* Input for amount type */}
                {isShowing && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="number"
                      value={inputVal}
                      onChange={e => setInputVal(e.target.value)}
                      placeholder="Monto $"
                      autoFocus
                      style={{
                        flex: 1, background: 'rgba(255,255,255,0.05)',
                        border: `1px solid ${GOLD}44`, borderRadius: 6,
                        padding: '7px 10px', color: '#e8e9f0',
                        fontFamily: MONO, fontSize: 12, outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => handleRegister(ch)}
                      style={{ padding: '7px 14px', background: GOLD, color: '#000', border: 'none', borderRadius: 6, fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => { setShowInput(null); setInputVal('') }}
                      style={{ padding: '7px 10px', background: 'transparent', color: MUTED, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontFamily: MONO, fontSize: 11, cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Register button */}
                {!isDone && !isShowing && (
                  <button
                    onClick={() => handleRegister(ch)}
                    style={{
                      padding: '9px 0', borderRadius: 8, fontFamily: MONO, fontSize: 10,
                      letterSpacing: '0.1em', cursor: 'pointer',
                      border: `1px solid rgba(255,255,255,0.12)`,
                      color: MUTED, background: 'transparent', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = GOLD; (e.currentTarget as HTMLElement).style.color = GOLD }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.color = MUTED }}
                  >
                    {ch.goalType === 'days' ? '✓ HOY LO HICE' : ch.goalType === 'boolean' ? '✓ COMPLETAR' : '+ REGISTRAR AVANCE'}
                  </button>
                )}

                {isDone && (
                  <div style={{ fontFamily: MONO, fontSize: 10, color: GREEN, letterSpacing: '0.1em', textAlign: 'center' }}>
                    ✓ RETO SEMANAL COMPLETADO
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{
        marginTop: 20, background: '#111', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10, padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap',
      }}>
        {[
          { emoji: '🔥', label: 'Racha actual',   val: `${streak} días`                           },
          { emoji: '🏆', label: 'Mejor racha',     val: `${store.maxStreak} días`                   },
          { emoji: '✓',  label: 'Completados',     val: `${store.totalCompleted} retos`             },
          { emoji: '💰', label: 'Ahorrado via retos', val: `$${Math.round(store.totalSaved)}`      },
        ].map((s, i, arr) => (
          <div key={s.label} style={{
            flex: 1, minWidth: 120, textAlign: 'center',
            borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            padding: '0 16px',
          }}>
            <div style={{ fontFamily: MONO, fontSize: 18, marginBottom: 4 }}>{s.emoji}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: GOLD, fontWeight: 600 }}>{s.val}</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

    </div>
  )
}
