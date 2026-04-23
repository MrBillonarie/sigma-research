export type ChallengeType = 'daily' | 'weekly'
export type DetectionMode = 'auto' | 'manual'

export interface Challenge {
  id: string
  type: ChallengeType
  detection: DetectionMode
  title: string
  points: number
  autoTrigger?: {
    field: 'ahorro' | 'gasto'
    threshold: number
    direction: 'up' | 'down'
    isPct?: boolean
  }
}

export interface Badge {
  id: string
  emoji: string
  name: string
  description: string
}

export const DAILY_CHALLENGES: Challenge[] = [
  {
    id: 'daily_visit',
    type: 'daily',
    detection: 'auto',
    title: 'Visitaste el FIRE Planner hoy',
    points: 10,
  },
  {
    id: 'daily_ahorro_up',
    type: 'daily',
    detection: 'auto',
    title: 'Subiste tu ahorro mensual $100+',
    points: 25,
    autoTrigger: { field: 'ahorro', threshold: 100, direction: 'up' },
  },
  {
    id: 'daily_no_impulse',
    type: 'daily',
    detection: 'manual',
    title: 'Evitaste una compra impulsiva',
    points: 15,
  },
  {
    id: 'daily_cocina',
    type: 'daily',
    detection: 'manual',
    title: 'Cocinaste en casa hoy',
    points: 10,
  },
  {
    id: 'daily_gastos',
    type: 'daily',
    detection: 'manual',
    title: 'Revisaste tus gastos del día',
    points: 10,
  },
]

export const WEEKLY_CHALLENGES: Challenge[] = [
  {
    id: 'week_ahorro_5pct',
    type: 'weekly',
    detection: 'auto',
    title: 'Subiste la tasa de ahorro 5%+',
    points: 50,
    autoTrigger: { field: 'ahorro', threshold: 5, direction: 'up', isPct: true },
  },
  {
    id: 'week_gasto_down',
    type: 'weekly',
    detection: 'auto',
    title: 'Redujiste tu gasto mensual FIRE',
    points: 40,
    autoTrigger: { field: 'gasto', threshold: 1, direction: 'down' },
  },
  {
    id: 'week_cancelar_sub',
    type: 'weekly',
    detection: 'manual',
    title: 'Cancelaste una suscripción',
    points: 60,
  },
  {
    id: 'week_transferencia',
    type: 'weekly',
    detection: 'manual',
    title: 'Transferiste dinero a inversiones',
    points: 75,
  },
  {
    id: 'week_leer_fire',
    type: 'weekly',
    detection: 'manual',
    title: 'Leíste sobre FIRE 15 minutos',
    points: 30,
  },
]

export const ALL_CHALLENGES = [...DAILY_CHALLENGES, ...WEEKLY_CHALLENGES]

export const BADGES: Badge[] = [
  { id: 'primer_paso',     emoji: '⚡', name: 'Primer paso',     description: 'Completa tu primer reto' },
  { id: 'on_fire',         emoji: '🔥', name: 'On Fire',         description: '7 días seguidos con retos' },
  { id: 'centenario',      emoji: '💰', name: 'Centenario',      description: 'Acumula 100 puntos' },
  { id: 'recortador',      emoji: '✂️', name: 'Recortador',      description: 'Cancela 3 suscripciones' },
  { id: 'fire_ready',      emoji: '🎯', name: 'FIRE Ready',      description: 'Completa todos los retos de una semana' },
  { id: 'silver_trader',   emoji: '🥈', name: 'Silver Trader',   description: 'Alcanza nivel SILVER' },
  { id: 'gold_trader',     emoji: '🥇', name: 'Gold Trader',     description: 'Alcanza nivel GOLD' },
  { id: 'diamond_trader',  emoji: '💎', name: 'Diamond Trader',  description: 'Alcanza nivel DIAMOND' },
  { id: 'imparable',       emoji: '🔥🔥', name: 'Imparable',    description: '30 días seguidos' },
  { id: 'ahorrador_elite', emoji: '🚀', name: 'Ahorrador Elite', description: 'Sube el ahorro 10 veces' },
]

export const LEVELS = [
  { name: 'STARTER', emoji: '🌱', min: 0,    max: 99 },
  { name: 'SILVER',  emoji: '🥈', min: 100,  max: 499 },
  { name: 'GOLD',    emoji: '🥇', min: 500,  max: 999 },
  { name: 'DIAMOND', emoji: '💎', min: 1000, max: Infinity },
] as const

export function getLevelFromPoints(points: number) {
  return LEVELS.find(l => points >= l.min && points <= l.max) ?? LEVELS[0]
}

export function getNextLevel(points: number) {
  const idx = LEVELS.findIndex(l => points >= l.min && points <= l.max)
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null
}
