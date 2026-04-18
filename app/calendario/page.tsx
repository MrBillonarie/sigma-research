'use client'
import { useState, useMemo } from 'react'

const C = {
  bg:      '#04050a',
  surface: '#0b0d14',
  border:  '#1a1d2e',
  muted:   '#3a3f55',
  dimText: '#7a7f9a',
  text:    '#e8e9f0',
  gold:    '#d4af37',
  glow:    '#f0cc5a',
  green:   '#34d399',
  red:     '#f87171',
  yellow:  '#fbbf24',
} as const

type Impact = 'HIGH' | 'MED' | 'LOW'

interface MacroEvent {
  date:    string   // YYYY-MM-DD
  time:    string
  country: string
  title:   string
  impact:  Impact
  prev?:   string
  est?:    string
}

// ─── Eventos 2025 ─────────────────────────────────────────────────────────────
const EVENTS: MacroEvent[] = [
  // Abril
  { date: '2025-04-02', time: '08:30', country: 'US', title: 'ADP Employment',          impact: 'MED', prev: '140K',  est: '118K' },
  { date: '2025-04-03', time: '08:30', country: 'US', title: 'NFP (Non-Farm Payrolls)', impact: 'HIGH', prev: '151K', est: '138K' },
  { date: '2025-04-03', time: '08:30', country: 'US', title: 'Unemployment Rate',        impact: 'HIGH', prev: '4.1%', est: '4.1%' },
  { date: '2025-04-10', time: '08:30', country: 'US', title: 'CPI (YoY)',               impact: 'HIGH', prev: '2.8%', est: '2.6%' },
  { date: '2025-04-10', time: '08:30', country: 'US', title: 'Core CPI (YoY)',          impact: 'HIGH', prev: '3.1%', est: '3.0%' },
  { date: '2025-04-11', time: '08:30', country: 'US', title: 'PPI (MoM)',               impact: 'MED', prev: '0.0%', est: '-0.2%' },
  { date: '2025-04-16', time: '08:30', country: 'US', title: 'Retail Sales (MoM)',      impact: 'HIGH', prev: '-0.9%',est: '1.3%' },
  { date: '2025-04-17', time: '08:30', country: 'US', title: 'Initial Jobless Claims',  impact: 'MED', prev: '223K', est: '225K' },
  { date: '2025-04-23', time: '09:45', country: 'US', title: 'S&P Global PMI (Flash)',  impact: 'MED', prev: '52.5', est: '52.0' },
  { date: '2025-04-25', time: '08:30', country: 'US', title: 'GDP Q1 (Prelim)',         impact: 'HIGH', prev: '2.4%', est: '0.8%' },
  { date: '2025-04-25', time: '08:30', country: 'US', title: 'PCE Price Index (YoY)',   impact: 'HIGH', prev: '2.5%', est: '2.3%' },
  { date: '2025-04-30', time: '14:00', country: 'US', title: 'FOMC Meeting (Día 1)',    impact: 'HIGH' },
  // Mayo
  { date: '2025-05-01', time: '14:00', country: 'US', title: 'FOMC Decision + Presser', impact: 'HIGH', prev: '4.25–4.50%', est: '4.25–4.50%' },
  { date: '2025-05-02', time: '08:30', country: 'US', title: 'NFP (Non-Farm Payrolls)', impact: 'HIGH', prev: '228K', est: '135K' },
  { date: '2025-05-07', time: '08:30', country: 'US', title: 'ADP Employment',          impact: 'MED' },
  { date: '2025-05-13', time: '08:30', country: 'US', title: 'CPI (YoY)',               impact: 'HIGH' },
  { date: '2025-05-15', time: '08:30', country: 'US', title: 'PPI (MoM)',               impact: 'MED' },
  { date: '2025-05-15', time: '08:30', country: 'US', title: 'Retail Sales',            impact: 'HIGH' },
  { date: '2025-05-21', time: '14:00', country: 'US', title: 'FOMC Minutes',            impact: 'HIGH' },
  { date: '2025-05-22', time: '08:30', country: 'US', title: 'Initial Jobless Claims',  impact: 'MED' },
  { date: '2025-05-29', time: '08:30', country: 'US', title: 'GDP Q1 (Revisado)',       impact: 'HIGH' },
  { date: '2025-05-30', time: '08:30', country: 'US', title: 'PCE Price Index',         impact: 'HIGH' },
  // Junio
  { date: '2025-06-04', time: '08:30', country: 'US', title: 'ADP Employment',          impact: 'MED' },
  { date: '2025-06-06', time: '08:30', country: 'US', title: 'NFP (Non-Farm Payrolls)', impact: 'HIGH' },
  { date: '2025-06-11', time: '08:30', country: 'US', title: 'CPI (YoY)',               impact: 'HIGH' },
  { date: '2025-06-17', time: '14:00', country: 'US', title: 'FOMC Decision',           impact: 'HIGH' },
  { date: '2025-06-17', time: '14:30', country: 'US', title: 'Fed Press Conference',    impact: 'HIGH' },
  { date: '2025-06-18', time: '08:30', country: 'US', title: 'Retail Sales',            impact: 'HIGH' },
  { date: '2025-06-25', time: '08:30', country: 'US', title: 'GDP Q1 (Final)',          impact: 'MED' },
  { date: '2025-06-27', time: '08:30', country: 'US', title: 'PCE Price Index',         impact: 'HIGH' },
  // Crypto-specific
  { date: '2025-04-18', time: '00:00', country: '₿',  title: 'Bitcoin Options Expiry',  impact: 'HIGH' },
  { date: '2025-05-30', time: '00:00', country: '₿',  title: 'Bitcoin Options Expiry',  impact: 'HIGH' },
  { date: '2025-06-27', time: '00:00', country: '₿',  title: 'Bitcoin Options Expiry',  impact: 'HIGH' },
]

const impactColor: Record<Impact, string> = {
  HIGH: C.red,
  MED:  C.yellow,
  LOW:  C.green,
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS   = ['L','M','X','J','V','S','D']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1  // Mon=0
}

export default function CalendarioPage() {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<string | null>(null)

  function prevMonth() { if (month === 0) { setYear(y => y-1); setMonth(11) } else setMonth(m => m-1) }
  function nextMonth() { if (month === 11) { setYear(y => y+1); setMonth(0) } else setMonth(m => m+1) }

  const eventsByDate = useMemo(() => {
    const map: Record<string, MacroEvent[]> = {}
    EVENTS.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return map
  }, [])

  const days      = getDaysInMonth(year, month)
  const firstDay  = getFirstDayOfMonth(year, month)
  const todayStr  = today.toISOString().slice(0, 10)

  const selectedEvents = selected ? (eventsByDate[selected] ?? []) : []

  // Upcoming events (next 14 days from today)
  const upcoming = useMemo(() => {
    const limit = new Date(today)
    limit.setDate(limit.getDate() + 14)
    return EVENTS
      .filter(e => e.date >= todayStr && e.date <= limit.toISOString().slice(0,10))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .slice(0, 10)
  }, [todayStr])

  function maxImpact(evts: MacroEvent[]): Impact {
    if (evts.some(e => e.impact === 'HIGH')) return 'HIGH'
    if (evts.some(e => e.impact === 'MED'))  return 'MED'
    return 'LOW'
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono,'DM Mono',monospace)" }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>
            {'// MACRO CALENDAR · EVENTOS ECONÓMICOS'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',var(--font-bebas),Impact,sans-serif", fontSize: 'clamp(40px,5vw,72px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ color: C.text }}>MACRO</span>{' '}
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CALENDAR</span>
          </h1>
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 1, background: C.border, alignItems: 'start' }}>

          {/* Calendar */}
          <div style={{ background: C.bg }}>
            {/* Navigation */}
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={prevMonth}
                style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.dimText, fontFamily: 'monospace', fontSize: 16, padding: '4px 12px', cursor: 'pointer' }}>
                ‹
              </button>
              <span style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 24, color: C.text, letterSpacing: '0.1em' }}>
                {MONTHS[month]} {year}
              </span>
              <button onClick={nextMonth}
                style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.dimText, fontFamily: 'monospace', fontSize: 16, padding: '4px 12px', cursor: 'pointer' }}>
                ›
              </button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: `1px solid ${C.border}` }}>
              {DAYS.map(d => (
                <div key={d} style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, background: C.surface }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, background: C.border }}>
              {/* Empty cells */}
              {Array.from({ length: firstDay }, (_, i) => (
                <div key={`e-${i}`} style={{ background: C.bg, minHeight: 72 }} />
              ))}

              {/* Day cells */}
              {Array.from({ length: days }, (_, i) => {
                const day    = i + 1
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const evts   = eventsByDate[dateStr] ?? []
                const isToday = dateStr === todayStr
                const isSel   = dateStr === selected

                return (
                  <div
                    key={day}
                    onClick={() => setSelected(isSel ? null : (evts.length ? dateStr : null))}
                    style={{
                      background: isSel ? `${C.gold}12` : isToday ? `${C.gold}08` : C.bg,
                      minHeight: 72, padding: '8px', cursor: evts.length ? 'pointer' : 'default',
                      border: isSel ? `1px solid ${C.gold}40` : isToday ? `1px solid ${C.gold}20` : '1px solid transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: isToday ? C.gold : C.dimText, marginBottom: 4, fontWeight: isToday ? 700 : 400 }}>
                      {day}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {evts.slice(0, 3).map((e, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: impactColor[e.impact], flexShrink: 0 }} />
                          <span style={{ fontFamily: 'monospace', fontSize: 9, color: C.dimText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.title.split(' ').slice(0,2).join(' ')}
                          </span>
                        </div>
                      ))}
                      {evts.length > 3 && (
                        <span style={{ fontFamily: 'monospace', fontSize: 9, color: C.muted }}>+{evts.length - 3} más</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 20 }}>
              {([['HIGH', C.red, 'Alto impacto'], ['MED', C.yellow, 'Medio'], ['LOW', C.green, 'Bajo']] as const).map(([k, col, label]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Selected day detail */}
            {selected && selectedEvents.length > 0 && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: '20px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.gold, marginBottom: 14 }}>
                  EVENTOS — {selected}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedEvents.map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '12px', background: C.surface, border: `1px solid ${C.border}` }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: impactColor[e.impact], flexShrink: 0, marginTop: 4 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.text, fontWeight: 600 }}>{e.title}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>{e.time} ET</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted }}>{e.country}</span>
                          {e.prev && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>Prev: {e.prev}</span>}
                          {e.est  && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.yellow }}>Est: {e.est}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upcoming sidebar */}
          <div style={{ background: C.surface }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>
                PRÓXIMOS 14 DÍAS
              </span>
            </div>
            {upcoming.length === 0 ? (
              <div style={{ padding: '24px 20px', fontFamily: 'monospace', fontSize: 11, color: C.muted }}>Sin eventos próximos.</div>
            ) : upcoming.map((e, i) => (
              <div key={i} style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                onClick={() => setSelected(e.date)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: impactColor[e.impact], flexShrink: 0 }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>
                    {e.date.slice(5)} · {e.time} ET
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: e.country === '₿' ? C.gold : C.muted, marginLeft: 'auto' }}>{e.country}</span>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.text, marginLeft: 15 }}>{e.title}</div>
                {(e.prev || e.est) && (
                  <div style={{ display: 'flex', gap: 12, marginLeft: 15, marginTop: 3 }}>
                    {e.prev && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText }}>Prev: {e.prev}</span>}
                    {e.est  && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.yellow }}>Est: {e.est}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
