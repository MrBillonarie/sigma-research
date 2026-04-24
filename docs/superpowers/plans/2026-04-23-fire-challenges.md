# FIRE Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un sistema de retos diarios/semanales con puntos, niveles, insignias y auto-detección de sliders al FIRE Planner, con progreso persistido en Supabase.

**Architecture:** Panel debajo del simulador existente. Catálogo de retos hardcodeado en TypeScript. API route maneja toda la lógica de puntos/badges server-side. El componente `FireChallenges` recibe los valores actuales de los sliders como props y detecta cambios para auto-completar retos.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (PostgreSQL + Auth), React hooks (useRef para auto-detección), inline styles (consistente con el resto de la página FIRE).

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `supabase_schema.sql` | Modificar | Agregar tablas fire_progress, fire_completions, fire_badges |
| `app/(dashboard)/fire/challenges.ts` | Crear | Catálogo tipado de retos, badges, niveles |
| `app/api/fire-challenges/route.ts` | Crear | GET estado del usuario · POST completar reto |
| `app/(dashboard)/fire/FireChallengeCard.tsx` | Crear | Card individual de reto (pending/completed) |
| `app/(dashboard)/fire/FireBadges.tsx` | Crear | Grid de insignias desbloqueadas/bloqueadas |
| `app/(dashboard)/fire/FireChallenges.tsx` | Crear | Panel principal: stats, tabs, auto-detección sliders |
| `app/(dashboard)/fire/page.tsx` | Modificar | Importar y renderizar FireChallenges con props de sliders |

---

## Task 1: Tablas en Supabase

**Files:**
- Modify: `supabase_schema.sql`

- [ ] **Step 1: Agregar las 3 tablas al schema**

Abrir `supabase_schema.sql` y agregar al final (ya tiene las tablas de contacto como última sección):

```sql
-- ─── 11. FIRE PROGRESS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_progress (
  user_id       uuid  REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  points        int   DEFAULT 0,
  level         text  DEFAULT 'STARTER',
  streak_days   int   DEFAULT 0,
  streak_weeks  int   DEFAULT 0,
  last_daily_at date,
  last_weekly_at date,
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE fire_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fire_progress_own" ON fire_progress
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 12. FIRE COMPLETIONS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_completions (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  challenge_id   text        NOT NULL,
  challenge_type text        NOT NULL CHECK (challenge_type IN ('daily','weekly')),
  points_earned  int         NOT NULL,
  day_date       date,
  week_number    int,
  week_year      int,
  completed_at   timestamptz DEFAULT now()
);

ALTER TABLE fire_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fire_completions_own" ON fire_completions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 13. FIRE BADGES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fire_badges (
  user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_id  text NOT NULL,
  earned_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

ALTER TABLE fire_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fire_badges_own" ON fire_badges
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Aplicar el SQL en Supabase Dashboard**

Abrir `https://supabase.com/dashboard` → proyecto → SQL Editor → pegar solo las 3 secciones nuevas → Run.

Verificar que las 3 tablas aparecen en Table Editor.

---

## Task 2: Catálogo de retos y badges

**Files:**
- Create: `app/(dashboard)/fire/challenges.ts`

- [ ] **Step 1: Crear el archivo con el catálogo completo**

```typescript
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
```

- [ ] **Step 2: Verificar tipos**

```bash
cd c:/Users/Desktop/Desktop/TRADES/sigma-research-master
npx tsc --noEmit
```

Esperado: sin errores en el nuevo archivo.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/fire/challenges.ts supabase_schema.sql
git commit -m "feat: fire challenges catalog and db schema"
```

---

## Task 3: API Route — GET y POST

**Files:**
- Create: `app/api/fire-challenges/route.ts`

- [ ] **Step 1: Crear el directorio y el archivo**

```bash
mkdir -p "c:/Users/Desktop/Desktop/TRADES/sigma-research-master/app/api/fire-challenges"
```

- [ ] **Step 2: Escribir la route completa**

Crear `app/api/fire-challenges/route.ts`:

```typescript
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  ALL_CHALLENGES, WEEKLY_CHALLENGES,
  getLevelFromPoints, BADGES,
} from '@/app/(dashboard)/fire/challenges'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getISOWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return {
    week: Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7),
    year: d.getUTCFullYear(),
  }
}

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await sb.auth.getUser(token)
  if (error || !user) return null
  return user
}

// ─── GET: load user challenge state ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today = new Date().toISOString().split('T')[0]
    const { week, year } = getISOWeek(new Date())

    // Get or create progress
    let { data: prog } = await sb
      .from('fire_progress')
      .select()
      .eq('user_id', user.id)
      .single()

    if (!prog) {
      const { data: newProg } = await sb
        .from('fire_progress')
        .insert({ user_id: user.id })
        .select()
        .single()
      prog = newProg
    }

    // Recalculate streak: if last_daily_at was more than 1 day ago, reset
    let streakDays = prog?.streak_days ?? 0
    if (prog?.last_daily_at) {
      const lastDate = new Date(prog.last_daily_at)
      const todayDate = new Date(today)
      const diffDays = Math.floor(
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (diffDays > 1) {
        streakDays = 0
        await sb
          .from('fire_progress')
          .update({ streak_days: 0 })
          .eq('user_id', user.id)
      }
    }

    const [todayRes, weekRes, badgesRes] = await Promise.all([
      sb.from('fire_completions')
        .select('challenge_id, points_earned')
        .eq('user_id', user.id)
        .eq('challenge_type', 'daily')
        .eq('day_date', today),
      sb.from('fire_completions')
        .select('challenge_id, points_earned')
        .eq('user_id', user.id)
        .eq('challenge_type', 'weekly')
        .eq('week_number', week)
        .eq('week_year', year),
      sb.from('fire_badges')
        .select('badge_id, earned_at')
        .eq('user_id', user.id),
    ])

    return NextResponse.json({
      progress: { ...prog, streak_days: streakDays },
      todayCompletions: todayRes.data ?? [],
      weekCompletions: weekRes.data ?? [],
      badges: (badgesRes.data ?? []).map(b => b.badge_id),
    })
  } catch (err) {
    console.error('[GET /api/fire-challenges]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// ─── POST: complete a challenge ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { challenge_id } = await req.json()

    const challenge = ALL_CHALLENGES.find(c => c.id === challenge_id)
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })

    const today = new Date().toISOString().split('T')[0]
    const { week, year } = getISOWeek(new Date())

    // Check for duplicate
    const dupQuery = sb
      .from('fire_completions')
      .select('id')
      .eq('user_id', user.id)
      .eq('challenge_id', challenge_id)

    const { data: existing } = await (
      challenge.type === 'daily'
        ? dupQuery.eq('day_date', today)
        : dupQuery.eq('week_number', week).eq('week_year', year)
    ).maybeSingle()

    if (existing) return NextResponse.json({ error: 'Already completed' }, { status: 409 })

    // Insert completion
    await sb.from('fire_completions').insert({
      user_id: user.id,
      challenge_id,
      challenge_type: challenge.type,
      points_earned: challenge.points,
      day_date: challenge.type === 'daily' ? today : null,
      week_number: challenge.type === 'weekly' ? week : null,
      week_year: challenge.type === 'weekly' ? year : null,
    })

    // Get current progress
    let { data: prog } = await sb
      .from('fire_progress')
      .select()
      .eq('user_id', user.id)
      .single()

    if (!prog) {
      const { data: newProg } = await sb
        .from('fire_progress')
        .insert({ user_id: user.id })
        .select()
        .single()
      prog = newProg
    }

    const currentPoints: number = prog?.points ?? 0
    const currentLevel: string = prog?.level ?? 'STARTER'
    const newPoints = currentPoints + challenge.points
    const newLevel = getLevelFromPoints(newPoints).name

    // Calculate streak
    let streakDays: number = prog?.streak_days ?? 0
    if (challenge.type === 'daily') {
      const lastDaily: string | null = prog?.last_daily_at ?? null
      if (!lastDaily) {
        streakDays = 1
      } else {
        const diffDays = Math.floor(
          (new Date(today).getTime() - new Date(lastDaily).getTime()) / (1000 * 60 * 60 * 24)
        )
        if (diffDays === 0) streakDays = streakDays       // same day already counted
        else if (diffDays === 1) streakDays = streakDays + 1  // next day = continue streak
        else streakDays = 1                                    // gap = reset
      }
    }

    // Update progress
    const updatePayload: Record<string, unknown> = {
      user_id: user.id,
      points: newPoints,
      level: newLevel,
      streak_days: streakDays,
      updated_at: new Date().toISOString(),
    }
    if (challenge.type === 'daily') updatePayload.last_daily_at = today
    if (challenge.type === 'weekly') updatePayload.last_weekly_at = today

    await sb.from('fire_progress').upsert(updatePayload, { onConflict: 'user_id' })

    // ─── Badge evaluation ─────────────────────────────────────────────────────
    const [allCompRes, badgesRes, weekCompRes] = await Promise.all([
      sb.from('fire_completions').select('challenge_id').eq('user_id', user.id),
      sb.from('fire_badges').select('badge_id').eq('user_id', user.id),
      sb.from('fire_completions')
        .select('challenge_id')
        .eq('user_id', user.id)
        .eq('challenge_type', 'weekly')
        .eq('week_number', week)
        .eq('week_year', year),
    ])

    const allIds = (allCompRes.data ?? []).map(c => c.challenge_id)
    const earned = new Set((badgesRes.data ?? []).map(b => b.badge_id))
    const thisWeekIds = new Set((weekCompRes.data ?? []).map(c => c.challenge_id))
    const allWeeklyIds = WEEKLY_CHALLENGES.map(c => c.id)
    const fireReady = allWeeklyIds.every(id => thisWeekIds.has(id))

    const checks: [string, boolean][] = [
      ['primer_paso',     allIds.length === 1],
      ['on_fire',         streakDays >= 7],
      ['centenario',      newPoints >= 100 && currentPoints < 100],
      ['recortador',      allIds.filter(id => id === 'week_cancelar_sub').length >= 3],
      ['fire_ready',      fireReady],
      ['silver_trader',   newLevel === 'SILVER' && currentLevel !== 'SILVER'],
      ['gold_trader',     newLevel === 'GOLD'   && currentLevel !== 'GOLD'],
      ['diamond_trader',  newLevel === 'DIAMOND' && currentLevel !== 'DIAMOND'],
      ['imparable',       streakDays >= 30],
      ['ahorrador_elite', allIds.filter(id => id === 'daily_ahorro_up').length >= 10],
    ]

    const newBadges: string[] = []
    for (const [badgeId, condition] of checks) {
      if (condition && !earned.has(badgeId)) {
        await sb.from('fire_badges').insert({ user_id: user.id, badge_id: badgeId })
        newBadges.push(badgeId)
      }
    }

    return NextResponse.json({
      ok: true,
      points_earned: challenge.points,
      new_total: newPoints,
      new_level: newLevel,
      new_badges: newBadges,
      streak_days: streakDays,
    })
  } catch (err) {
    console.error('[POST /api/fire-challenges]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/api/fire-challenges/route.ts
git commit -m "feat: fire challenges API route GET and POST"
```

---

## Task 4: FireChallengeCard component

**Files:**
- Create: `app/(dashboard)/fire/FireChallengeCard.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
import type { Challenge } from './challenges'

const C = {
  bg: '#04050a', surface: '#0b0d14', border: '#1a1d2e',
  dimText: '#7a7f9a', text: '#e8e9f0',
  gold: '#d4af37', green: '#34d399', muted: '#3a3f55',
}

interface Props {
  challenge: Challenge
  completed: boolean
  completing: boolean
  onComplete: () => void
}

export default function FireChallengeCard({ challenge, completed, completing, onComplete }: Props) {
  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${completed ? C.green : C.border}`,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      opacity: completed ? 0.65 : 1,
      transition: 'border-color 0.2s, opacity 0.2s',
    }}>
      {/* Status indicator */}
      <div style={{
        width: 20,
        height: 20,
        borderRadius: completed ? '50%' : 4,
        background: completed ? C.green : 'transparent',
        border: completed ? 'none' : `1px solid ${C.muted}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s',
      }}>
        {completed && <span style={{ color: '#000', fontSize: 11 }}>✓</span>}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', color: completed ? C.green : (challenge.detection === 'auto' ? C.dimText : C.muted), marginBottom: 2 }}>
          {completed
            ? 'COMPLETADO' + (challenge.detection === 'auto' ? ' · AUTO' : '')
            : challenge.detection === 'auto' ? 'AUTO-DETECCIÓN' : 'MANUAL'
          }
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text }}>
          {challenge.title}
        </div>
      </div>

      {/* Points + action */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontFamily: "'Bebas Neue', Impact, sans-serif",
          fontSize: 15,
          color: completed ? C.green : C.gold,
          marginBottom: completed || challenge.detection === 'auto' ? 0 : 6,
        }}>
          +{challenge.points} PTS
        </div>
        {!completed && challenge.detection === 'manual' && (
          <button
            onClick={onComplete}
            disabled={completing}
            style={{
              background: C.gold,
              color: '#000',
              border: 'none',
              fontFamily: 'monospace',
              fontSize: 9,
              letterSpacing: '0.1em',
              padding: '4px 10px',
              cursor: completing ? 'not-allowed' : 'pointer',
              opacity: completing ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {completing ? '…' : 'MARCAR ✓'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

---

## Task 5: FireBadges component

**Files:**
- Create: `app/(dashboard)/fire/FireBadges.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
import { BADGES } from './challenges'

const C = {
  bg: '#04050a', surface: '#0b0d14', border: '#1a1d2e',
  dimText: '#7a7f9a', text: '#e8e9f0', gold: '#d4af37', green: '#34d399',
}

interface Props {
  earnedBadges: string[]
}

export default function FireBadges({ earnedBadges }: Props) {
  const earned = new Set(earnedBadges)

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 16 }}>
        {earnedBadges.length}/{BADGES.length} INSIGNIAS DESBLOQUEADAS
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
        {BADGES.map(badge => {
          const isEarned = earned.has(badge.id)
          return (
            <div
              key={badge.id}
              title={badge.description}
              style={{
                background: isEarned ? 'rgba(212,175,55,0.06)' : C.bg,
                border: `1px solid ${isEarned ? 'rgba(212,175,55,0.4)' : C.border}`,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                opacity: isEarned ? 1 : 0.35,
                transition: 'opacity 0.2s',
              }}
            >
              <span style={{ fontSize: 22 }}>{badge.emoji}</span>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: isEarned ? C.gold : C.dimText, fontWeight: isEarned ? 600 : 400 }}>
                {badge.name}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, lineHeight: 1.4 }}>
                {badge.description}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/fire/FireChallengeCard.tsx app/\(dashboard\)/fire/FireBadges.tsx
git commit -m "feat: FireChallengeCard and FireBadges components"
```

---

## Task 6: FireChallenges — panel principal

**Files:**
- Create: `app/(dashboard)/fire/FireChallenges.tsx`

- [ ] **Step 1: Crear el componente principal**

```tsx
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

  // Capture initial slider values once on mount for auto-detection
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
    // Capture initial slider values
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

    if (!res.ok) return  // 409 already completed — ignore silently

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
        ? new Set([...prev.todayIds, challengeId])
        : prev.todayIds,
      weekIds: challenge.type === 'weekly'
        ? new Set([...prev.weekIds, challengeId])
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

    const aorroDelta = ahorro - initAhorro.current
    const gastoDelta = initGasto.current - gasto  // positive = decreased
    const ahorroPct  = initAhorro.current > 0 ? (aorroDelta / initAhorro.current) * 100 : 0

    if (aorroDelta >= 100 && !autoFired.current.has('daily_ahorro_up') && !state.todayIds.has('daily_ahorro_up')) {
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

  if (!state.progress) return null  // not logged in

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

      {/* ── Toast ───────────────────────────────────────────────────────── */}
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

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
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
            sub: fireYear ? `Fecha FIRE: ${new Date().getFullYear() + fireYear}` : 'Sigue completando retos',
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

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
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

      {/* ── Content ─────────────────────────────────────────────────────── */}
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
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/fire/FireChallenges.tsx
git commit -m "feat: FireChallenges main panel with auto-detection and toast"
```

---

## Task 7: Integrar en la página FIRE

**Files:**
- Modify: `app/(dashboard)/fire/page.tsx`

- [ ] **Step 1: Agregar import dinámico de FireChallenges**

Al inicio de `app/(dashboard)/fire/page.tsx`, después del import de `FireChart`:

```typescript
const FireChallenges = dynamic(() => import('./FireChallenges'), {
  ssr: false,
  loading: () => (
    <div style={{ borderTop: '1px solid #1a1d2e', padding: 32, textAlign: 'center' }}>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#7a7f9a' }}>Cargando retos…</span>
    </div>
  ),
})
```

- [ ] **Step 2: Renderizar FireChallenges al final del return**

En `page.tsx`, después del cierre del div principal (la línea con `</div>` que cierra el `gridTemplateColumns: '300px 1fr'`), agregar `FireChallenges` antes del cierre del contenedor exterior:

```tsx
        {/* Challenges panel */}
        <FireChallenges ahorro={ahorro} gasto={gasto} fireYear={fireYear} />
```

El return completo del final de la página queda así:

```tsx
      </div>  {/* cierra main grid */}

      {/* Challenges panel */}
      <FireChallenges ahorro={ahorro} gasto={gasto} fireYear={fireYear} />

    </div>  {/* cierra max-width container */}
  </div>   {/* cierra min-h-screen */}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/fire/page.tsx
git commit -m "feat: integrate FireChallenges panel into FIRE page"
```

---

## Task 8: Verificación manual

- [ ] **Step 1: Levantar el servidor de desarrollo**

```bash
npm run dev
```

Abrir http://localhost:3000 y navegar a `/fire`.

- [ ] **Step 2: Verificar carga inicial**

- Panel de retos aparece debajo del simulador
- Stats bar muestra 0 puntos, 🌱 STARTER, racha 0
- Tab "Retos Diarios" muestra los 5 retos
- El reto "Visitaste el FIRE Planner hoy" se marca automáticamente en ~1 segundo
- Toast aparece: "+10 pts"

- [ ] **Step 3: Verificar auto-detección de sliders**

- Mover el slider "Ahorro mensual" desde su valor inicial (ej: 1500) hasta 1600 o más
- El reto "Subiste tu ahorro mensual $100+" debe marcarse automáticamente
- Toast aparece con los puntos

- [ ] **Step 4: Verificar reto manual**

- Hacer click en "MARCAR ✓" en "Evitaste una compra impulsiva"
- El card se marca como completado
- Los puntos en el stats bar se actualizan

- [ ] **Step 5: Verificar tab de insignias**

- Hacer click en "INSIGNIAS"
- Ver badges desbloqueados (⚡ Primer paso debe estar ganado) resaltados en dorado
- Los badges bloqueados aparecen opacados

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "feat: FIRE challenges system complete - daily/weekly challenges, points, badges, auto-detection"
```
