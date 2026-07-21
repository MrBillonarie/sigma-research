'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/app/lib/supabase'
import { createNotification } from '@/app/lib/notify'
import FireBadges from './FireBadges'
import { BADGES, LEVELS, getLevelFromPoints, getNextLevel } from './challenges'
import { StreakFlame, LevelOrb, RankLadder, MissionIcon, WeeklyRing, useConfetti } from './FireVisuals'
import { getToday, getWeekKey, scaleAmt, fmtUSD, pickDaily } from './dailyChallenges'
import { C } from '@/app/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────
type Difficulty = 'FÁCIL' | 'MEDIO' | 'DIFÍCIL'
type GoalType   = 'amount' | 'days' | 'boolean'


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
  completed:          Record<string, string[]>
  maxStreak:          number
  totalCompleted:     number
  totalSaved:         number
  totalPoints:        number          // XP acumulada — alimenta LEVELS (challenges.ts)
  weeklyProgress:     Record<string, Record<string, number>>
  notifiedStreaks:    number[]        // hitos de racha (7/30/...) ya notificados
  notifiedMissedDate: string | null   // última fecha en que se avisó racha rota
  earnedBadges:       string[]        // ids de BADGES ya notificados como desbloqueados
  notifiedLevelIdx:   number          // índice más alto de LEVELS ya notificado
  lastAhorroSeen:     number | null   // último valor real del slider de ahorro visto
  lastGastoSeen:      number | null   // último valor real del slider de gasto visto
  streakFreezes:      number          // "protectores de racha" disponibles (se ganan al subir de nivel)
  frozenDates:        string[]        // fechas donde se usó un protector en vez de romper la racha
}

const STREAK_MILESTONES = [7, 30, 100, 365]
const VERIFIED_XP = 25
const DAILY_POINTS = 10
const WEEKLY_POINTS: Record<Difficulty, number> = { 'FÁCIL': 20, 'MEDIO': 35, 'DIFÍCIL': 50 }

// ─── Colors ───────────────────────────────────────────────────────────────────
const GOLD   = '#39e2e6'
const GREEN  = '#22c55e'
const ORANGE = '#f97316'
const MONO   = "var(--font-dm-mono,'DM Mono',monospace)"
const DISP   = "var(--font-bebas,'Bebas Neue',Impact,sans-serif)"
const MUTED  = 'rgba(255,255,255,0.38)'
const DIM    = 'rgba(255,255,255,0.22)'
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// ─── Helpers ─────────────────────────────────────────────────────────────────


function computeStreak(completed: Record<string, string[]>, frozen: string[] = []): number {
  const today = getToday()
  const hasToday = (completed[today]?.length ?? 0) > 0 || frozen.includes(today)
  let streak = 0
  for (let i = hasToday ? 0 : 1; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    if ((completed[key]?.length ?? 0) > 0 || frozen.includes(key)) streak++
    else break
  }
  return streak
}



// Meses para alcanzar target a interés mensual compuesto — resolución mensual
// solo para este cálculo de "cuánto adelantaste tu fecha", el resto de la
// página sigue usando project() en años, no se toca esa lógica.
function monthsToTarget(capital: number, ahorro: number, retornoPct: number, target: number, maxMonths = 720): number | null {
  if (capital >= target) return 0
  const rMonthly = retornoPct / 100 / 12
  let c = capital
  for (let mth = 1; mth <= maxMonths; mth++) {
    c = c * (1 + rMonthly) + ahorro
    if (c >= target) return mth
  }
  return null
}


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

const WEEKLY_C: WeeklyChallenge[] = [
  {
    id: 'wc1', difficulty: 'FÁCIL',
    title: 'Aprende sobre un instrumento de inversión nuevo',
    desc:  'ETFs, bonos, REITs, cripto — elige uno y entiende cómo funciona antes del domingo.',
    goalType: 'boolean', goalMax: 1,
    reward: '🏆 Más conocimiento = mejores decisiones de inversión',
  },
  {
    id: 'wc2', difficulty: 'MEDIO',
    title: 'Automatiza tu ahorro con transferencia programada',
    desc:  'Configura una transferencia automática recurrente hacia tu ahorro o inversión.',
    goalType: 'boolean', goalMax: 1,
    reward: '🏆 El ahorro automático es ~3x más consistente que el manual',
  },
  {
    id: 'wc3', difficulty: 'DIFÍCIL',
    title: 'Genera $40 de ingreso extra esta semana',
    desc:  'Freelance, venta de objetos, servicios — todo lo que generes esta semana cuenta.',
    goalType: 'amount', goalMax: 40,
    reward: '🏆 +$40 al capital FIRE registrado',
  },
]

const WEEKLY_D: WeeklyChallenge[] = [
  {
    id: 'wd1', difficulty: 'FÁCIL',
    title: 'Revisa tu equity curve 3 veces esta semana',
    desc:  'Abre el HUD y revisa tu drawdown/rendimiento al menos 3 días distintos.',
    goalType: 'days', goalMax: 3,
    reward: '🏆 Los traders disciplinados revisan métricas, no solo ganancias',
  },
  {
    id: 'wd2', difficulty: 'MEDIO',
    title: 'Sin compras no esenciales 5 días',
    desc:  'Solo lo necesario: comida, transporte, cuentas fijas. Nada más por 5 días.',
    goalType: 'days', goalMax: 5,
    reward: '🏆 Ahorro estimado $40–$60 esta semana',
  },
  {
    id: 'wd3', difficulty: 'DIFÍCIL',
    title: 'Baja tu gasto mensual FIRE un 5%',
    desc:  'Ajusta el slider de Gasto Mensual FIRE un 5% más bajo y mantenlo esta semana.',
    goalType: 'boolean', goalMax: 1,
    reward: '🏆 Recalcular cuánto adelantaste tu FIRE',
  },
]

const WEEKLY_SETS = [WEEKLY_A, WEEKLY_B, WEEKLY_C, WEEKLY_D]

const STORE_DEFAULT: ChallengeStore = {
  completed: {}, maxStreak: 0, totalCompleted: 0, totalSaved: 0, totalPoints: 0, weeklyProgress: {},
  notifiedStreaks: [], notifiedMissedDate: null, earnedBadges: [], notifiedLevelIdx: 0,
  lastAhorroSeen: null, lastGastoSeen: null, streakFreezes: 0, frozenDates: [],
}

// ─── Server sync (Supabase `fire_challenges`) ──────────────────────────────────
// Espejo de ChallengeStore para que un cron sepa si cumpliste tu misión del día
// sin que abras /fire — antes esto vivía solo en localStorage, invisible al
// servidor. Server gana si ya existe fila (multi-dispositivo); si no, se sube
// lo que había en localStorage la primera vez que carga logueado.
function storeToRow(s: ChallengeStore, userId: string) {
  return {
    user_id:              userId,
    completed:            s.completed,
    weekly_progress:      s.weeklyProgress,
    max_streak:           s.maxStreak,
    total_completed:      s.totalCompleted,
    total_saved:          s.totalSaved,
    total_points:         s.totalPoints,
    notified_streaks:     s.notifiedStreaks,
    notified_missed_date: s.notifiedMissedDate,
    earned_badges:        s.earnedBadges,
    notified_level_idx:   s.notifiedLevelIdx,
    last_ahorro_seen:     s.lastAhorroSeen,
    last_gasto_seen:      s.lastGastoSeen,
    streak_freezes:       s.streakFreezes,
    frozen_dates:         s.frozenDates,
  }
}

function rowToStore(r: Record<string, unknown>): ChallengeStore {
  return {
    completed:          (r.completed as ChallengeStore['completed']) ?? {},
    weeklyProgress:     (r.weekly_progress as ChallengeStore['weeklyProgress']) ?? {},
    maxStreak:          (r.max_streak as number) ?? 0,
    totalCompleted:     (r.total_completed as number) ?? 0,
    totalSaved:         (r.total_saved as number) ?? 0,
    totalPoints:        (r.total_points as number) ?? 0,
    notifiedStreaks:    (r.notified_streaks as number[]) ?? [],
    notifiedMissedDate: (r.notified_missed_date as string | null) ?? null,
    earnedBadges:       (r.earned_badges as string[]) ?? [],
    notifiedLevelIdx:   (r.notified_level_idx as number) ?? 0,
    lastAhorroSeen:     (r.last_ahorro_seen as number | null) ?? null,
    lastGastoSeen:      (r.last_gasto_seen as number | null) ?? null,
    streakFreezes:      (r.streak_freezes as number) ?? 0,
    frozenDates:        (r.frozen_dates as string[]) ?? [],
  }
}

// Las 10 BADGES ya tienen fuente de datos real: silver/gold/diamond_trader se
// activaron al conectar LEVELS/totalPoints, y recortador cuenta cuántas
// semanas distintas completaste el reto de "optimiza 1 suscripción" (wb2).
function computeEarnedBadges(store: ChallengeStore): string[] {
  const earned: string[] = []
  if (store.totalCompleted >= 1)  earned.push('primer_paso')
  if (store.maxStreak >= 7)       earned.push('on_fire')
  if (store.maxStreak >= 30)      earned.push('imparable')
  if (store.totalPoints >= 100)   earned.push('centenario')
  if (store.totalSaved >= 500)    earned.push('ahorrador_elite')
  if (store.totalPoints >= LEVELS[1].min) earned.push('silver_trader')
  if (store.totalPoints >= LEVELS[2].min) earned.push('gold_trader')
  if (store.totalPoints >= LEVELS[3].min) earned.push('diamond_trader')
  const anyWeekComplete = Object.entries(store.weeklyProgress).some(([wk, progress]) => {
    const wn  = parseInt(wk.split('-W')[1])
    const set = WEEKLY_SETS[wn % WEEKLY_SETS.length]
    return set.every(ch => (progress[ch.id] ?? 0) >= ch.goalMax)
  })
  if (anyWeekComplete) earned.push('fire_ready')
  const subCancelWeeks = Object.values(store.weeklyProgress).filter(wp => (wp['wb2'] ?? 0) >= 1).length
  if (subCancelWeeks >= 3) earned.push('recortador')
  return earned
}

// ─── Subcomponents ────────────────────────────────────────────────────────────
// Dificultad como 1–3 puntos encendidos, no como badge de texto.
const DIFF_COLOR: Record<Difficulty, string> = { 'FÁCIL': GREEN, 'MEDIO': GOLD, 'DIFÍCIL': ORANGE }
const DIFF_LEVEL: Record<Difficulty, number> = { 'FÁCIL': 1, 'MEDIO': 2, 'DIFÍCIL': 3 }
function DiffDots({ d }: { d: Difficulty }) {
  const lvl = DIFF_LEVEL[d], col = DIFF_COLOR[d]
  return (
    <span title={d} style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: i <= lvl ? col : C.border2,
          boxShadow: i <= lvl ? `0 0 6px ${col}` : 'none',
        }} />
      ))}
    </span>
  )
}

// Íconos de línea inline (sin emoji) para etiquetas y el ticker de stats.
function LineIcon({ d, size = 14, style }: { d: string; size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
      <path d={d} />
    </svg>
  )
}
const PATH = {
  flame:   'M10 2c1 3-2 4-2 7a4 4 0 108 0c0-1.5-1-2-1-2 .5 2-1 3-1 3 .5-3-2-4-2-6-1 1-2 2-2 4a2 2 0 104 0',
  spark:   'M10 2v3M10 15v3M2 10h3M15 10h3M4.9 4.9l2.1 2.1M13 13l2.1 2.1M15.1 4.9L13 7M7 13l-2.1 2.1',
  arrowUp: 'M5 13l7.5-7.5M12.5 5.5H6.5M12.5 5.5v6',
  bars:    'M3 9h4v8H3zM8 5h4v12H8zM13 11h4v6h-4z',
  check:   'M4 10.5l4 4 8-9',
  shield:  'M10 2.5l6 2.5v5c0 4.4-2.8 7.1-6 8-3.2-.9-6-3.6-6-8V5z',
  clock:   'M10 3a7 7 0 100 14 7 7 0 000-14zM10 6.2V10l2.6 1.8',
  trophy:  'M6 3.5h8v3a4 4 0 01-8 0zM6 4.5H3.5v1a2.5 2.5 0 002.5 2.5M14 4.5h2.5v1A2.5 2.5 0 0114 8M10 10.5v3M7 16.5h6',
  share:   'M6 11.5l8-4.5M6 11.5l8 4.5M6 11.5a2 2 0 10-4 0 2 2 0 004 0zM18 6a2 2 0 10-4 0 2 2 0 004 0zM18 16a2 2 0 10-4 0 2 2 0 004 0z',
  gear:    'M10 2.5l1.2 2.1 2.4-.4.4 2.4 2.1 1.2-1.5 1.9 1.5 1.9-2.1 1.2-.4 2.4-2.4-.4L10 17.5l-1.2-2.1-2.4.4-.4-2.4-2.1-1.2L5.4 10 3.9 8.1 6 6.9l.4-2.4 2.4.4z',
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { ahorro: number; gasto: number; capital: number; retorno: number; target: number }

export default function FireChallenges({ ahorro, gasto, capital, retorno, target }: Props) {
  const [store,     setStore]     = useState<ChallengeStore>(STORE_DEFAULT)
  const [mounted,   setMounted]   = useState(false)
  const [showInput, setShowInput] = useState<string | null>(null)
  const [inputVal,  setInputVal]  = useState('')
  const [userId,    setUserId]    = useState<string | null>(null)
  const [serverSynced, setServerSynced] = useState(false)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completeBtnRef = useRef<HTMLButtonElement>(null)
  const { fire: fireConfetti, node: confettiNode } = useConfetti()

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fire_challenges')
      if (raw) setStore({ ...STORE_DEFAULT, ...(JSON.parse(raw) as ChallengeStore) })
    } catch { /* ignore */ }
    setMounted(true)
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setServerSynced(true); return }
      setUserId(data.user.id)
      supabase.from('fire_challenges').select('*').eq('user_id', data.user.id).maybeSingle()
        .then(({ data: row }) => {
          if (row) setStore({ ...STORE_DEFAULT, ...rowToStore(row) })
          setServerSynced(true)
        })
    })
  }, [])

  // Sube el store a Supabase (debounced) cada vez que cambia — así el cron
  // diario puede ver tu progreso real sin depender de que abras /fire.
  // serverSynced evita pisar la fila del servidor con STORE_DEFAULT antes de
  // que termine de cargar el fetch inicial de arriba.
  useEffect(() => {
    if (!mounted || !userId || !serverSynced) return
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      supabase.from('fire_challenges').upsert(storeToRow(store, userId), { onConflict: 'user_id' }).then(() => {})
    }, 800)
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current) }
  }, [store, mounted, userId, serverSynced])

  const today    = getToday()
  const weekKey  = getWeekKey()
  const weekNum  = parseInt(weekKey.split('-W')[1])
  const dayOfWeek = new Date().getDay()

  const daily   = pickDaily()
  const weeklys = WEEKLY_SETS[weekNum % WEEKLY_SETS.length]
  const amt     = scaleAmt(ahorro, daily.amountBase)

  // Cuántos meses adelantaste tu fecha de libertad gracias a lo ahorrado vía
  // retos — conecta el juego de hábitos directo con tu número personal.
  const monthsAdvanced = useMemo(() => {
    if (target <= 0 || store.totalSaved <= 0) return 0
    const baseline = monthsToTarget(capital, ahorro, retorno, target)
    const boosted  = monthsToTarget(capital + store.totalSaved, ahorro, retorno, target)
    if (baseline === null || boosted === null) return 0
    return Math.max(0, baseline - boosted)
  }, [capital, ahorro, retorno, target, store.totalSaved])

  const streak     = computeStreak(store.completed, store.frozenDates)
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
    const newStreak = computeStreak(newComp, store.frozenDates)
    persist({
      ...store,
      completed:      newComp,
      maxStreak:      Math.max(store.maxStreak, newStreak),
      totalCompleted: store.totalCompleted + 1,
      totalSaved:     store.totalSaved + amt,
      totalPoints:    store.totalPoints + DAILY_POINTS,
    })
    if (userId) {
      createNotification({
        userId,
        title:       'Reto diario completado',
        body:        `${daily.title} — ${daily.unitFn(amt)}. Racha: ${newStreak} ${newStreak === 1 ? 'día' : 'días'}.`,
        type:        'fire',
        accionLabel: 'Ver FIRE',
        accionHref:  '/fire',
      })
    }
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
      totalPoints:    !wasComplete && nowComplete ? store.totalPoints + WEEKLY_POINTS[ch.difficulty] : store.totalPoints,
      maxStreak:      Math.max(store.maxStreak, computeStreak(newComp, store.frozenDates)),
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

  function shareProgress() {
    const text = `🔥 Llevo ${streak} ${streak === 1 ? 'día' : 'días'} de racha y nivel ${currentLevel.name} ${currentLevel.emoji} en mi FIRE Planner de SquantDesk. ¡A construir libertad financiera!`
    const url  = 'https://squantdesk.com/fire'
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank')
  }

  // Yesterday message
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().split('T')[0]
  const missedYesterday = !isUnconfigured && streak === 0 && (store.completed[yesterdayKey] === undefined) && store.totalCompleted > 0

  // Perfect week banner
  const showPerfectBanner = streak >= 7

  // Nivel / XP — LEVELS ya definido en challenges.ts, antes sin usar
  const currentLevel = getLevelFromPoints(store.totalPoints)
  const nextLevel     = getNextLevel(store.totalPoints)
  const levelPct      = nextLevel
    ? Math.min(100, ((store.totalPoints - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100)
    : 100

  // ── Notificaciones pasivas: racha rota/protegida, hitos, insignias, nivel,
  // y retos VERIFICADOS (ahorro/gasto real, no un clic de honor system) ──────
  // Todo se detecta comparando contra lo ya notificado en el store (persistido
  // en localStorage), así cada evento avisa una única vez, no en cada render.
  useEffect(() => {
    if (!mounted || !userId || isUnconfigured) return

    const newMilestones = STREAK_MILESTONES.filter(m => streak >= m && !store.notifiedStreaks.includes(m))
    const canFreeze      = missedYesterday && store.streakFreezes > 0 && !store.frozenDates.includes(yesterdayKey)
    const trueBreak       = missedYesterday && !canFreeze && store.notifiedMissedDate !== yesterdayKey
    const newBadgeIds    = computeEarnedBadges(store).filter(id => !store.earnedBadges.includes(id))
    const currentLevelIdx = LEVELS.indexOf(getLevelFromPoints(store.totalPoints))
    const leveledUp        = currentLevelIdx > store.notifiedLevelIdx

    // Verificado contra tus propios sliders reales (ahorro/gasto), no un clic
    const ahorroVerified = store.lastAhorroSeen !== null && ahorro >= store.lastAhorroSeen + 100
    const gastoVerified  = store.lastGastoSeen  !== null && gasto  <= store.lastGastoSeen - 50
    const baselineInit   = store.lastAhorroSeen === null || store.lastGastoSeen === null

    const nothingToDo = newMilestones.length === 0 && !canFreeze && !trueBreak && newBadgeIds.length === 0
      && !leveledUp && !ahorroVerified && !gastoVerified && !baselineInit
    if (nothingToDo) return

    for (const m of newMilestones) {
      createNotification({
        userId,
        title:       `¡Racha de ${m} días!`,
        body:        `Llevas ${m} días seguidos completando retos FIRE. Sigue así para adelantar tu libertad financiera.`,
        type:        'fire',
        urgente:     true,
        accionLabel: 'Ver FIRE',
        accionHref:  '/fire',
      })
    }

    if (canFreeze) {
      createNotification({
        userId,
        title:       '🛡️ Racha protegida',
        body:        `Ayer no completaste un reto, pero usamos un protector de racha para que no se rompa. Te quedan ${store.streakFreezes - 1}.`,
        type:        'fire',
        accionLabel: 'Ver FIRE',
        accionHref:  '/fire',
      })
    } else if (trueBreak) {
      createNotification({
        userId,
        title:       'Se rompió tu racha FIRE',
        body:        'No completaste tu reto de ayer y no tenías protectores disponibles. Hoy puedes empezar una nueva racha.',
        type:        'fire',
        accionLabel: 'Ver FIRE',
        accionHref:  '/fire',
      })
    }

    for (const id of newBadgeIds) {
      const badge = BADGES.find(b => b.id === id)
      if (!badge) continue
      createNotification({
        userId,
        title:       '¡Insignia desbloqueada!',
        body:        `${badge.emoji} ${badge.name} — ${badge.description}`,
        type:        'fire',
        urgente:     true,
        accionLabel: 'Ver FIRE',
        accionHref:  '/fire',
      })
    }

    if (leveledUp) {
      const lvl = LEVELS[currentLevelIdx]
      createNotification({
        userId,
        title:       `¡Subiste a nivel ${lvl.name}!`,
        body:        `${lvl.emoji} Alcanzaste ${store.totalPoints} XP en tus retos FIRE. Ganaste +1 protector de racha 🛡️.`,
        type:        'fire',
        urgente:     true,
        accionLabel: 'Ver FIRE',
        accionHref:  '/fire',
      })
    }

    if (ahorroVerified) {
      createNotification({
        userId,
        title:       '✅ Verificado: subiste tu ahorro real',
        body:        `Tu ahorro mensual real subió a ${fmtUSD(ahorro)}. No fue un clic — lo vimos en tu propio slider. +${VERIFIED_XP} XP.`,
        type:        'fire',
        accionLabel: 'Ver FIRE',
        accionHref:  '/fire',
      })
    }

    if (gastoVerified) {
      createNotification({
        userId,
        title:       '✅ Verificado: bajaste tu gasto real',
        body:        `Tu gasto mensual FIRE bajó a ${fmtUSD(gasto)}. +${VERIFIED_XP} XP.`,
        type:        'fire',
        accionLabel: 'Ver FIRE',
        accionHref:  '/fire',
      })
    }

    persist({
      ...store,
      notifiedStreaks:    [...store.notifiedStreaks, ...newMilestones],
      frozenDates:        canFreeze ? [...store.frozenDates, yesterdayKey] : store.frozenDates,
      streakFreezes:      Math.min(3, (canFreeze ? store.streakFreezes - 1 : store.streakFreezes) + (leveledUp ? 1 : 0)),
      notifiedMissedDate: trueBreak ? yesterdayKey : store.notifiedMissedDate,
      earnedBadges:       [...store.earnedBadges, ...newBadgeIds],
      notifiedLevelIdx:   leveledUp ? currentLevelIdx : store.notifiedLevelIdx,
      totalPoints:        store.totalPoints + (ahorroVerified ? VERIFIED_XP : 0) + (gastoVerified ? VERIFIED_XP : 0),
      lastAhorroSeen:     ahorro,
      lastGastoSeen:      gasto,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, userId, isUnconfigured, streak, missedYesterday, yesterdayKey, store, ahorro, gasto])

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
      <div style={{ marginTop: 40 }}>
        <SectionLabel />
        <div style={{
          background: `linear-gradient(168deg,rgba(57,226,230,.06),${C.surface2} 45%,#0a0d14)`,
          border: `1px solid ${C.border}`, borderRadius: 12, padding: '24px 28px',
          display: 'flex', alignItems: 'center', gap: 18, position: 'relative', overflow: 'hidden',
        }}>
          <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, background: `linear-gradient(180deg,${C.glow},${C.blue})` }} />
          <span style={{ color: GOLD, marginLeft: 6 }}><LineIcon d={PATH.gear} size={26} /></span>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 6 }}>
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

  // Tira de la semana: qué días ya tienen al menos un reto completado.
  const weekStrip = ['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((letter, i) => {
    const d = new Date(); d.setDate(d.getDate() - dayOfWeek + i)
    const key = d.toISOString().split('T')[0]
    return { letter, done: (store.completed[key]?.length ?? 0) > 0, isToday: i === dayOfWeek }
  })

  // Escalera de impacto: para retos con monto, proyecta hoy → 1 año → 10 años.
  const decade = (v: number) => v * 365 * ((Math.pow(1.08, 10) - 1) / 0.08)
  const ladder = daily.amountBase > 0
    ? [
        { k: 'Hoy',             v: `+${fmtUSD(amt)}`,             d: 'al portafolio',          c: GOLD },
        { k: 'Repetido 1 año',  v: `+${fmtUSD(amt * 365)}`,       d: '365 días seguidos',      c: C.glow },
        { k: 'En 10 años',      v: `+${fmtUSD(decade(amt))}`,     d: 'al 8% anual compuesto',  c: GREEN },
      ]
    : null

  const levelIdx = LEVELS.indexOf(currentLevel)

  return (
    <div style={{ marginTop: 40 }}>
      <style>{`
        .fch-wd{width:19px;height:19px;border-radius:6px;display:flex;align-items:center;justify-content:center;
          font-size:8px;font-family:${MONO};color:${C.muted};background:#0c1018;border:1px solid ${C.border2};
          box-shadow:inset 0 -2px 0 rgba(0,0,0,.5)}
        .fch-wd.done{color:#04060b;background:linear-gradient(180deg,#3ee0a8,${GREEN});border-color:transparent;
          box-shadow:0 2px 0 #0d6b4d, inset 0 1px 0 rgba(255,255,255,.4)}
        .fch-wd.today{color:#04060b;background:linear-gradient(180deg,#7df3f7,${GOLD});border-color:transparent;
          box-shadow:0 2px 0 #12707a, 0 0 12px rgba(57,226,230,.6), inset 0 1px 0 rgba(255,255,255,.45)}
        .fch-btn{position:relative;padding:14px 0;border-radius:10px;font-family:${MONO};font-size:11.5px;
          font-weight:700;letter-spacing:.14em;cursor:pointer;border:none;color:#04060b;
          background:linear-gradient(180deg,#7df3f7,${GOLD} 55%,#1fa6ad);
          box-shadow:0 6px 0 #12707a, 0 16px 28px -10px rgba(57,226,230,.6), inset 0 1px 0 rgba(255,255,255,.5);
          transition:transform .09s, box-shadow .09s, background .2s}
        .fch-btn:hover{transform:translateY(-1px);box-shadow:0 7px 0 #12707a, 0 20px 34px -10px rgba(57,226,230,.7), inset 0 1px 0 rgba(255,255,255,.5)}
        .fch-btn:active{transform:translateY(5px);box-shadow:0 1px 0 #12707a, 0 8px 16px -10px rgba(57,226,230,.5), inset 0 1px 0 rgba(255,255,255,.4)}
        .fch-btn.done{background:linear-gradient(180deg,#3ee0a8,${GREEN} 55%,#159169);cursor:default;
          box-shadow:0 6px 0 #0d6b4d, 0 16px 28px -10px rgba(47,211,154,.5), inset 0 1px 0 rgba(255,255,255,.45)}
        .fch-step{position:relative;border-radius:10px;padding:13px 15px 12px;overflow:hidden;
          background:linear-gradient(180deg,#151b26,#0c1119);border:1px solid ${C.border2};
          box-shadow:0 6px 0 -2px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07)}
        .fch-step::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--sc)}
        .fch-step.s2{transform:translateY(-5px)}
        .fch-step.s3{transform:translateY(-10px);box-shadow:0 9px 0 -2px rgba(0,0,0,.6), 0 0 26px -10px rgba(47,211,154,.5), inset 0 1px 0 rgba(255,255,255,.09)}
        @media(max-width:720px){.fch-step.s2,.fch-step.s3{transform:none}}
        .fch-status{display:grid;grid-template-columns:150px 168px 1fr auto;align-items:center}
        @media(max-width:900px){.fch-status{grid-template-columns:1fr 1fr}}
        .fch-cell{padding:16px 20px;position:relative}
        .fch-cell + .fch-cell::before{content:'';position:absolute;left:0;top:16%;bottom:16%;width:1px;background:${C.border}}
        .fch-main{display:flex;gap:22px;padding:22px 26px 20px 28px}
        @media(max-width:640px){.fch-main{flex-direction:column;gap:16px}}
        .fch-ladder{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}
        @media(max-width:720px){.fch-ladder{grid-template-columns:1fr}}
        .fch-week{display:flex;justify-content:space-between;gap:22px;position:relative;margin-top:6px}
        .fch-week::before{content:'';position:absolute;left:60px;right:60px;top:44px;height:1px;
          background:linear-gradient(90deg,transparent,${C.border2} 15%,${C.border2} 85%,transparent)}
        @media(max-width:720px){.fch-week{flex-direction:column;gap:26px}.fch-week::before{display:none}}
        .fch-wm{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;gap:9px}
        .fch-reg{font-family:${MONO};font-size:10px;letter-spacing:.1em;padding:8px 14px;border-radius:7px;cursor:pointer;
          border:1px solid ${C.border2};color:${C.dimText};background:transparent;transition:all .15s}
        .fch-reg:hover{border-color:${GOLD};color:${GOLD};box-shadow:0 0 14px rgba(57,226,230,.22)}
        .fch-share{font-family:${MONO};font-size:9px;letter-spacing:.1em;color:${C.dimText};background:transparent;
          border:1px solid ${C.border2};border-radius:6px;padding:9px 13px;cursor:pointer;white-space:nowrap;
          display:flex;align-items:center;gap:7px;transition:all .15s}
        .fch-share:hover{border-color:${GOLD};color:${GOLD};box-shadow:0 0 14px rgba(57,226,230,.25)}
        .fch-tick{display:flex;flex-wrap:wrap;margin-top:26px;padding:16px 22px;
          background:linear-gradient(180deg,${C.surface2},${C.surface});border-radius:10px;border:1px solid ${C.border};
          box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
        .fch-ts{padding:0 20px;border-left:1px solid ${C.border};display:flex;align-items:center;gap:10px}
        .fch-ts:first-child{border-left:none;padding-left:0}
      `}</style>

      <SectionLabel />

      {/* ── Barra de estado: llama de racha · esfera de nivel · escalera de rangos ── */}
      <div style={{
        position: 'relative', borderRadius: 14, overflow: 'hidden',
        background: `linear-gradient(180deg,${C.surface2},#0a0d14)`, border: `1px solid ${C.border}`,
        boxShadow: '0 18px 40px -24px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.05)',
      }}>
        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 3, background: `linear-gradient(90deg,${ORANGE},${GOLD},transparent 85%)` }} />
        <div className="fch-status">
          <div className="fch-cell">
            <StreakFlame height={78} color={ORANGE} />
            <div style={{ textAlign: 'center', marginTop: -6 }}>
              <div style={{ fontFamily: DISP, fontSize: 30, color: ORANGE, lineHeight: 1, textShadow: '0 0 18px rgba(255,180,84,.5)' }}>{streak}</div>
              <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.dimText }}>
                {streak === 1 ? 'día de racha' : 'días de racha'}
              </div>
            </div>
          </div>
          <div className="fch-cell">
            <LevelOrb pct={levelPct} height={96} />
            <div style={{ textAlign: 'center', marginTop: -8 }}>
              <div style={{ fontFamily: DISP, fontSize: 19, color: GOLD, letterSpacing: '0.04em' }}>{currentLevel.name}</div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.dimText }}>
                {store.totalPoints} XP{nextLevel ? ` · ${nextLevel.min - store.totalPoints} para ${nextLevel.name}` : ' · nivel máximo'}
              </div>
            </div>
          </div>
          <div className="fch-cell">
            <RankLadder ranks={LEVELS.map(l => ({ name: l.name, color: l.color }))} currentIdx={levelIdx} height={88} />
          </div>
          <div className="fch-cell">
            <button className="fch-share" onClick={shareProgress} title="Compartir tu progreso en Telegram">
              <LineIcon d={PATH.share} size={12} /> COMPARTIR
            </button>
          </div>
        </div>
      </div>

      {/* ── Misión de hoy ── */}
      <div style={{ marginTop: 34 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: GOLD }}><LineIcon d={PATH.spark} /></span>MISIÓN DE HOY
        </div>
        <div style={{
          position: 'relative', borderRadius: 14, overflow: 'hidden',
          background: `linear-gradient(168deg,rgba(57,226,230,.09),${C.surface2} 42%,#0a0d14)`,
          border: `1px solid ${isDailyDone ? 'rgba(47,211,154,.3)' : 'rgba(57,226,230,.26)'}`,
          boxShadow: `0 26px 52px -28px rgba(0,0,0,.95), 0 0 32px -14px ${isDailyDone ? 'rgba(47,211,154,.3)' : 'rgba(57,226,230,.3)'}, inset 0 1px 0 rgba(255,255,255,.08)`,
        }}>
          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 3, background: `linear-gradient(90deg,${C.glow},${GOLD} 35%,transparent 78%)` }} />
          <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 5, background: isDailyDone ? `linear-gradient(180deg,#3ee0a8,${GREEN})` : `linear-gradient(180deg,${C.glow},${C.blue})`, boxShadow: `inset -1px 0 0 rgba(0,0,0,.55), 0 0 16px ${isDailyDone ? 'rgba(47,211,154,.5)' : 'rgba(57,226,230,.5)'}` }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 20px 11px 24px', flexWrap: 'wrap', borderBottom: `1px solid ${C.border}`, background: 'linear-gradient(90deg,rgba(57,226,230,.07),transparent 55%)' }}>
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.glow }}>
              {DAY_NAMES[dayOfWeek]} · misión diaria
            </span>
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', color: '#04060b', background: `linear-gradient(180deg,#7df3f7,${GOLD})`, borderRadius: 20, padding: '3px 10px', fontWeight: 700, boxShadow: '0 2px 8px -2px rgba(57,226,230,.7)' }}>
              +{DAILY_POINTS} XP
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              {weekStrip.map((w, i) => (
                <span key={i} className={`fch-wd${w.isToday ? ' today' : w.done ? ' done' : ''}`}>{w.letter}</span>
              ))}
            </div>
          </div>

          <div className="fch-main">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, flexShrink: 0 }}>
              <MissionIcon glyph={daily.glyph} size={76} color={isDailyDone ? GREEN : GOLD} />
              <span style={{ width: 58, height: 7, borderRadius: '50%', background: `radial-gradient(closest-side,${isDailyDone ? 'rgba(47,211,154,.35)' : 'rgba(57,226,230,.35)'},transparent 75%)` }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: DISP, fontSize: 26, letterSpacing: '0.02em', color: C.text, lineHeight: 1.05, marginBottom: 7 }}>
                {daily.title}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11.5, color: C.dimText, lineHeight: 1.65, maxWidth: '62ch' }}>
                {daily.desc}
              </div>

              {ladder ? (
                <div className="fch-ladder">
                  {ladder.map((s, i) => (
                    <div key={s.k} className={`fch-step s${i + 1}`} style={{ ['--sc' as string]: s.c }}>
                      <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.dimText }}>{s.k}</div>
                      <div style={{ fontFamily: DISP, fontSize: 30, lineHeight: 1.05, color: s.c, marginTop: 3, textShadow: '0 2px 6px rgba(0,0,0,.7)' }}>{s.v}</div>
                      <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted, marginTop: 2 }}>{s.d}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="fch-ladder" style={{ gridTemplateColumns: 'minmax(0,220px) 1fr' }}>
                  <div className="fch-step s1" style={{ ['--sc' as string]: GOLD }}>
                    <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.dimText }}>Meta de hoy</div>
                    <div style={{ fontFamily: DISP, fontSize: 22, lineHeight: 1.15, color: GOLD, marginTop: 3 }}>{daily.unitFn(0)}</div>
                  </div>
                  <div className="fch-step s2" style={{ ['--sc' as string]: GREEN }}>
                    <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.dimText }}>Por qué importa</div>
                    <div style={{ fontFamily: MONO, fontSize: 11.5, color: GREEN, lineHeight: 1.6, marginTop: 5 }}>{daily.impactFn(0)}</div>
                  </div>
                </div>
              )}

              {daily.amountBase > 0 && ahorro > 0 && (
                <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 12 }}>
                  ≈ {((amt / ahorro) * 100).toFixed(1)}% de tu ahorro mensual
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '0 26px 22px 28px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 11, color: ORANGE, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
              <LineIcon d={PATH.flame} size={13} />
              RACHA: {streak} {streak === 1 ? 'día' : 'días'} seguidos
            </span>
            <button
              ref={completeBtnRef}
              className={`fch-btn${isDailyDone ? ' done' : ''}`}
              style={{ flex: 1, minWidth: 230 }}
              disabled={isDailyDone}
              onClick={() => { if (!isDailyDone) { completeDaily(); fireConfetti(completeBtnRef.current) } }}
            >
              {isDailyDone ? '✓ COMPLETADO' : '✓ MARCAR COMPLETADO'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Racha rota / semana perfecta ── */}
      {showPerfectBanner && (
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderRadius: 10, background: 'rgba(57,226,230,0.07)', border: `1px solid ${GOLD}44` }}>
          <span style={{ color: GOLD }}><LineIcon d={PATH.trophy} size={18} /></span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: GOLD }}>
            ¡{streak} días de racha perfecta! Estás adelantando tu FIRE.
          </span>
        </div>
      )}
      {missedYesterday && (
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}` }}>
          <span style={{ color: C.muted }}><LineIcon d={PATH.clock} size={15} /></span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>
            Ayer no completaste tu reto. Hoy puedes retomar la racha.
          </span>
        </div>
      )}

      {/* ── Misiones de la semana ── */}
      <div style={{ marginTop: 34 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: GOLD }}><LineIcon d={PATH.arrowUp} /></span>MISIONES DE ESTA SEMANA
        </div>
        <div className="fch-week">
          {weeklys.map(ch => {
            const progress = getWeeklyProgress(ch.id)
            const isDone = progress >= ch.goalMax
            const isShowing = showInput === ch.id
            const col = isDone ? GREEN : DIFF_COLOR[ch.difficulty]
            let progressLabel = ''
            if (ch.goalType === 'amount')  progressLabel = `${fmtUSD(progress)} de ${fmtUSD(ch.goalMax)}`
            if (ch.goalType === 'days')    progressLabel = `${Math.round(progress)} de ${ch.goalMax} días`
            if (ch.goalType === 'boolean') progressLabel = isDone ? 'Completado' : 'Pendiente'
            return (
              <div key={ch.id} className="fch-wm">
                <WeeklyRing pct={ch.goalMax > 0 ? progress / ch.goalMax : 0} color={col} size={88} />
                <div style={{ fontFamily: MONO, fontSize: 12, color: C.text, fontWeight: 600, maxWidth: '22ch' }}>{ch.title}</div>
                <DiffDots d={ch.difficulty} />
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.dimText, maxWidth: '26ch', lineHeight: 1.6 }}>{ch.desc}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: isDone ? GREEN : C.muted }}>{progressLabel}</div>
                {ch.goalType === 'amount' && ahorro > 0 && !isDone && (
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted }}>
                    ≈ {((ch.goalMax / ahorro) * 100).toFixed(1)}% de tu ahorro mensual
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10, color: GREEN, maxWidth: '26ch' }}>
                  <LineIcon d={PATH.arrowUp} size={11} />{ch.reward.replace(/^🏆\s*/, '')}
                </div>

                {isShowing && (
                  <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 220 }}>
                    <input
                      type="number" value={inputVal} onChange={e => setInputVal(e.target.value)}
                      placeholder="Monto $" autoFocus
                      style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.05)', border: `1px solid ${GOLD}44`, borderRadius: 6, padding: '7px 10px', color: C.text, fontFamily: MONO, fontSize: 12, outline: 'none' }}
                    />
                    <button onClick={() => handleRegister(ch)} style={{ padding: '7px 13px', background: GOLD, color: '#04060b', border: 'none', borderRadius: 6, fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+</button>
                    <button onClick={() => { setShowInput(null); setInputVal('') }} style={{ padding: '7px 10px', background: 'transparent', color: MUTED, border: `1px solid ${C.border2}`, borderRadius: 6, fontFamily: MONO, fontSize: 11, cursor: 'pointer' }}>✕</button>
                  </div>
                )}
                {!isDone && !isShowing && (
                  <button className="fch-reg" onClick={() => handleRegister(ch)}>
                    {ch.goalType === 'days' ? '✓ HOY LO HICE' : ch.goalType === 'boolean' ? '✓ COMPLETAR' : '+ REGISTRAR AVANCE'}
                  </button>
                )}
                {isDone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10, color: GREEN, letterSpacing: '0.1em' }}>
                    <LineIcon d={PATH.check} size={12} /> COMPLETADO
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Ticker de stats ── */}
      <div className="fch-tick">
        {[
          { icon: PATH.bars,    label: 'XP total',            val: `${store.totalPoints}` },
          { icon: PATH.flame,   label: 'Mejor racha',         val: `${store.maxStreak}d` },
          { icon: PATH.check,   label: 'Completados',         val: `${store.totalCompleted}` },
          { icon: PATH.arrowUp, label: 'Ahorrado via retos',  val: `$${Math.round(store.totalSaved)}` },
          { icon: PATH.clock,   label: 'Adelantaste tu FIRE', val: monthsAdvanced > 0 ? `${monthsAdvanced}m` : '—' },
          { icon: PATH.shield,  label: 'Protectores',         val: `${store.streakFreezes}/3` },
        ].map(s => (
          <div key={s.label} className="fch-ts">
            <span style={{ color: GOLD }}><LineIcon d={s.icon} size={16} /></span>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.dimText }}>{s.label}</div>
              <div style={{ fontFamily: DISP, fontSize: 21, color: C.text }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Insignias ── */}
      <FireBadges earnedBadges={store.earnedBadges} />

      {confettiNode}
    </div>
  )
}

// Encabezado de sección compartido por el estado configurado y el vacío.
function SectionLabel() {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
      <span aria-hidden style={{ width: 3, height: 19, borderRadius: 2, background: `linear-gradient(180deg,${C.glow},${C.blue})`, boxShadow: `0 0 8px ${GOLD}80` }} />
      <span style={{ fontFamily: DISP, fontSize: 20, letterSpacing: '0.03em', color: C.text }}>RETOS FIRE</span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>hoy &amp; esta semana</span>
    </div>
  )
}
