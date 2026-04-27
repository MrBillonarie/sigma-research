export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  ALL_CHALLENGES, WEEKLY_CHALLENGES,
  getLevelFromPoints,
} from '@/app/(dashboard)/fire/challenges'

function makeSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

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

async function getAuthUser(req: NextRequest, sb: ReturnType<typeof makeSb>) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await sb.auth.getUser(token)
  if (error || !user) return null
  return user
}

// ─── GET: load user challenge state ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sb = makeSb()
  try {
    const user = await getAuthUser(req, sb)
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
  const sb = makeSb()
  try {
    const user = await getAuthUser(req, sb)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let challenge_id: string
    try {
      const body = await req.json()
      challenge_id = body?.challenge_id
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    if (!challenge_id || typeof challenge_id !== 'string') {
      return NextResponse.json({ error: 'challenge_id required' }, { status: 400 })
    }

    const challenge = ALL_CHALLENGES.find(c => c.id === challenge_id)
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })

    const today = new Date().toISOString().split('T')[0]
    const { week, year } = getISOWeek(new Date())

    // Check for duplicate
    const baseQuery = sb
      .from('fire_completions')
      .select('id')
      .eq('user_id', user.id)
      .eq('challenge_id', challenge_id)

    const { data: existing } = await (
      challenge.type === 'daily'
        ? baseQuery.eq('day_date', today)
        : baseQuery.eq('week_number', week).eq('week_year', year)
    ).maybeSingle()

    if (existing) return NextResponse.json({ error: 'Already completed' }, { status: 409 })

    // Insert completion
    const { error: insertError } = await sb.from('fire_completions').insert({
      user_id: user.id,
      challenge_id,
      challenge_type: challenge.type,
      points_earned: challenge.points,
      day_date: challenge.type === 'daily' ? today : null,
      week_number: challenge.type === 'weekly' ? week : null,
      week_year: challenge.type === 'weekly' ? year : null,
    })
    if (insertError) {
      if ((insertError as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Already completed' }, { status: 409 })
      }
      console.error('[POST /api/fire-challenges] completion insert error', insertError)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

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
        if (diffDays === 0) { /* same day, streak unchanged */ }
        else if (diffDays === 1) streakDays = streakDays + 1
        else streakDays = 1
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

    const { error: upsertError } = await sb.from('fire_progress').upsert(updatePayload, { onConflict: 'user_id' })
    if (upsertError) {
      console.error('[POST /api/fire-challenges] fire_progress upsert error', upsertError)
    }

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
        const { error: badgeError } = await sb.from('fire_badges').insert({ user_id: user.id, badge_id: badgeId })
        if (badgeError && (badgeError as { code?: string }).code !== '23505') {
          console.error('[POST /api/fire-challenges] badge insert error', badgeError)
        } else if (!badgeError) {
          newBadges.push(badgeId)
        }
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
