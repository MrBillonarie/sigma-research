'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/app/lib/supabase'
import {
  DAILY_CHALLENGES, WEEKLY_CHALLENGES, ALL_CHALLENGES,
  BADGES, getLevelFromPoints, getNextLevel,
  type Challenge,
} from './challenges'
import FireChallengeCard from './FireChallengeCard'
import FireBadges from './FireBadges'

const C = {
  bg: '#04050a', surface: '#0b0d14', border: '#1a1d2e',
  muted: '#3a3f55', dimText: '#7a7f9a', text: '#e8e9f0',
  gold: '#d4af37', glow: '#f0cc5a', green: '#34d399', yellow: '#fbbf24',
}

interface Props {
  ahorro: number
  gasto: number
  fireYear: number | null
}

interface ChallengesState {
  progress: {
    points: number
    level: string
    streak_days: number
    streak_weeks: number
  } | null
  todayIds: Set<string>
  weekIds: Set<string>
  badges: string[]
}

type Tab = 'daily' | 'weekly' | 'badges'

export default function FireChallenges({ ahorro, gasto, fireYear }: Props) {
  const [tab, setTab]         = useState<Tab>('daily')
  const [state, setState]     = useState<ChallengesState>({ progress: null, todayIds: new Set(), weekIds: new Set(), badges: [] })
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)
  const [toast, setToast]     = useState<string | null>(null)

  const initAhorro = useRef<number | null>(null)
  const initGasto  = useRef<number | null>(null)
  const autoFired  = useRef<Set<string>>(new Set())

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const res = await fetch('/api/fire-challenges', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) { setLoading(false); return }

    const data = await res.json()
    setState({
      progress: data.progress,
      todayIds: new Set((data.todayCompletions as { challenge_id: string }[]).map(c => c.challenge_id)),
      weekIds:  new Set((data.weekCompletions  as { challenge_id: string }[]).map(c => c.challenge_id)),
      badges:   data.badges as string[],
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    initAhorro.current = ahorro
    initGasto.current  = gasto
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const completeChallenge = useCallback(async (challengeId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    setCompleting(challengeId)
    const res = await fetch('/api/fire-challenges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ challenge_id: challengeId }),
    })
    setCompleting(null)

    if (!res.ok) return

    const data = await res.json() as {
      points_earned: number
      new_total: number
      new_level: string
      new_badges: string[]
      streak_days: number
    }

    const challenge = ALL_CHALLENGES.find(c => c.id === challengeId)!
    setState(prev => ({
      progress: {
        points: data.new_total,
        level: data.new_level,
        streak_days: data.streak_days,
        streak_weeks: prev.progress?.streak_weeks ?? 0,
      },
      todayIds: challenge.type === 'daily'
        ? new Set(Array.from(prev.todayIds).concat(challengeId))
        : prev.todayIds,
      weekIds: challenge.type === 'weekly'
        ? new Set(Array.from(prev.weekIds).concat(challengeId))
        : prev.weekIds,
      badges: [...prev.badges, ...data.new_badges],
    }))

    if (data.new_badges.length > 0) {
      const b = BADGES.find(b => b.id === data.new_badges[0])
      showToast(`${b?.emoji ?? '🏆'} ¡Badge: ${b?.name ?? data.new_badges[0]}! +${data.points_earned} pts`)
    } else {
      showToast(`+${data.points_earned} pts`)
    }
  }, [])

  // Auto-trigger visit challenge on load
  useEffect(() => {
    if (loading || state.todayIds.has('daily_visit')) return
    if (autoFired.current.has('daily_visit')) return
    autoFired.current.add('daily_visit')
    completeChallenge('daily_visit')
  }, [loading, state.todayIds, completeChallenge])

  // Auto-detect slider changes
  useEffect(() => {
    if (loading || initAhorro.current === null || initGasto.current === null) return

    const ahorroDelta = ahorro - initAhorro.current
    const gastoDelta = initGasto.current - gasto
    const ahorroPct  = initAhorro.current > 0 ? (ahorroDelta / initAhorro.current) * 100 : 0

    if (ahorroDelta >= 100 && !autoFired.current.has('daily_ahorro_up') && !state.todayIds.has('daily_ahorro_up')) {
      autoFired.current.add('daily_ahorro_up')
      completeChallenge('daily_ahorro_up')
    }
    if (ahorroPct >= 5 && !autoFired.current.has('week_ahorro_5pct') && !state.weekIds.has('week_ahorro_5pct')) {
      autoFired.current.add('week_ahorro_5pct')
      completeChallenge('week_ahorro_5pct')
    }
    if (gastoDelta > 0 && !autoFired.current.has('week_gasto_down') && !state.weekIds.has('week_gasto_down')) {
      autoFired.current.add('week_gasto_down')
      completeChallenge('week_gasto_down')
    }
  }, [ahorro, gasto, loading, state.todayIds, state.weekIds, completeChallenge])

  if (loading) return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: 32, textAlign: 'center' }}>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText }}>Cargando retos…</span>
    </div>
  )

  if (!state.progress) return null

  const pts      = state.progress.points
  const level    = getLevelFromPoints(pts)
  const nextLvl  = getNextLevel(pts)
  const ptsToNext = nextLvl ? nextLvl.min - pts : 0

  const dailyDone   = DAILY_CHALLENGES.filter(c => state.todayIds.has(c.id)).length
  const weeklyDone  = WEEKLY_CHALLENGES.filter(c => state.weekIds.has(c.id)).length

  const TABS: { id: Tab; label: string; count: string }[] = [
    { id: 'daily',   label: 'RETOS DIARIOS',   count: `${dailyDone}/${DAILY_CHALLENGES.length}` },
    { id: 'weekly',  label: 'RETOS SEMANALES', count: `${weeklyDone}/${WEEKLY_CHALLENGES.length}` },
    { id: 'badges',  label: 'INSIGNIAS',        count: `${state.badges.length}/${BADGES.length}` },
  ]

  const challenges: Challenge[] = tab === 'daily' ? DAILY_CHALLENGES : tab === 'weekly' ? WEEKLY_CHALLENGES : []
  const completedIds = tab === 'daily' ? state.todayIds : state.weekIds

  return (
    <div style={{ borderTop: `2px solid ${C.gold}`, marginTop: 1 }}>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          background: C.surface, border: `1px solid ${C.gold}`,
          padding: '10px 18px', fontFamily: 'monospace', fontSize: 13,
          color: C.gold, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          {toast}
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: C.border }}>
        {[
          {
            label: 'PUNTOS TOTALES',
            value: pts.toLocaleString(),
            sub: `${level.emoji} ${level.name}${nextLvl ? ` · ${ptsToNext} para ${nextLvl.name}` : ''}`,
            color: C.gold,
          },
          {
            label: 'RACHA DIARIA',
            value: `🔥 ${state.progress.streak_days}`,
            sub: state.progress.streak_days >= 7 ? '¡Imparable!' : 'días seguidos',
            color: C.yellow,
          },
          {
            label: 'ESTA SEMANA',
            value: `${weeklyDone}/${WEEKLY_CHALLENGES.length}`,
            sub: weeklyDone === WEEKLY_CHALLENGES.length ? '✓ Semana completa' : 'retos completados',
            color: C.green,
          },
          {
            label: 'INSIGNIAS',
            value: `${state.badges.length}/${BADGES.length}`,
            sub: fireYear ? `Fecha FIRE: ${new Date().getFullYear() + fireYear}` : 'Completa retos para avanzar',
            color: C.dimText,
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: C.surface, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.2em', color: C.dimText, marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 32, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 1, background: C.border }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '10px 16px', border: 'none', cursor: 'pointer',
              background: tab === t.id ? C.surface : C.bg,
              borderBottom: tab === t.id ? `2px solid ${C.gold}` : '2px solid transparent',
              transition: 'background 0.15s',
            }}
          >
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', color: tab === t.id ? C.gold : C.dimText }}>
              {t.label}
            </span>
            <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 10, color: tab === t.id ? C.green : C.muted }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: C.surface }}>
        {tab === 'badges' ? (
          <FireBadges earnedBadges={state.badges} />
        ) : (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {challenges.map(challenge => (
              <FireChallengeCard
                key={challenge.id}
                challenge={challenge}
                completed={completedIds.has(challenge.id)}
                completing={completing === challenge.id}
                onComplete={() => completeChallenge(challenge.id)}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
