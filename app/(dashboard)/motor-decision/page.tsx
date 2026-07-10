'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import type { ProfileType, SignalsResponse } from '@/types/decision-engine'
import { usePortfolio } from '@/app/lib/usePortfolio'
import { supabase } from '@/app/lib/supabase'
import dynamic                  from 'next/dynamic'
import ProfileSelector          from './components/ProfileSelector'
import MetricCards              from './components/MetricCards'
import FlowIndicator            from './components/FlowIndicator'
import SignalTable              from './components/SignalTable'
import LiveRefreshIndicator     from '@/app/components/LiveRefreshIndicator'
import PageErrorBoundary        from '@/app/components/PageErrorBoundary'

const AllocationDonut = dynamic(() => import('./components/AllocationDonut'), {
  ssr:     false,
  loading: () => <div style={{ height:260, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontSize:11, color:'#7a7f9a' }}>Cargando gráfico…</div>,
})

const STORAGE_KEY   = 'sigma_motor_profile'
const AUTO_INTERVAL = 30 * 60 * 1000
const MONO = 'var(--font-dm-mono, monospace)'   // versión a nivel de módulo para los componentes free

// ─── CountUp — encendido de cifras ────────────────────────────────────────────
function useCountUp(target: number, dur = 1300) {
  const [v, setV] = useState(0)
  const fromRef = useRef(0)
  const vRef = useRef(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(target); fromRef.current = target; vRef.current = target
      return
    }
    const from = fromRef.current
    let raf = 0
    let t0: number | null = null
    const tick = (t: number) => {
      if (t0 === null) t0 = t
      const p = Math.min(1, (t - t0) / dur)
      const val = from + (target - from) * (1 - Math.pow(1 - p, 3))
      vRef.current = val
      setV(val)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); fromRef.current = vRef.current }
  }, [target, dur])
  return v
}

// ─── Reveal al scroll — cada sección entra una sola vez ───────────────────────
function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setOn(true); return }
    const io = new IntersectionObserver(es => {
      if (es[0].isIntersecting) { setOn(true); io.disconnect() }
    }, { threshold: 0.08 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className={on ? 'md-rv md-rv-in' : 'md-rv'}>{children}</div>
}

// ─── Vista free — "solo dirección" (el sizing/allocation es PRO) ──────────────
const SIG_META: Record<string, { lbl: string; c: string }> = {
  comprar:  { lbl: 'COMPRAR',  c: '#1D9E75' },
  reducir:  { lbl: 'REDUCIR',  c: '#f87171' },
  mantener: { lbl: 'MANTENER', c: '#7a7f9a' },
  neutral:  { lbl: 'NEUTRAL',  c: '#7a7f9a' },
}

function LockPanel({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(255,180,84,0.05), #0b0d14 60%)',
      border: '1px solid rgba(255,180,84,0.25)', borderRadius: 12,
      padding: '28px 24px', textAlign: 'center',
    }}>
      <div style={{ fontFamily: MONO, fontSize: 12, color: '#ffb454', letterSpacing: '0.12em', marginBottom: 8 }}>🔒 {title}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: '#7a7f9a', lineHeight: 1.7, maxWidth: 460, margin: '0 auto 14px' }}>{sub}</div>
      <a href="/planes" style={{
        display: 'inline-block', fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em',
        color: '#ffb454', border: '1px solid rgba(255,180,84,0.35)', borderRadius: 6,
        padding: '9px 20px', textDecoration: 'none',
      }}>ACTIVAR PRO →</a>
    </div>
  )
}

function FreeDirectionTable({ data }: { data: SignalsResponse }) {
  const rows = [...data.signals].sort((a, b) => {
    const order = (s: string) => (s === 'comprar' ? 0 : s === 'reducir' ? 1 : 2)
    return order(a.signal) - order(b.signal)
  })
  return (
    <div style={{ background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
      <div style={{ height: 2, background: 'linear-gradient(90deg, rgba(57,226,230,0.85), rgba(79,146,255,0.4) 45%, transparent 82%)' }} />
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
        <thead>
          <tr style={{ background: '#0e1019' }}>
            {['Activo', 'Señal', '30D', '90D', '1A'].map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '11px 16px', fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: '#7a7f9a', fontWeight: 400, borderBottom: '1px solid #252840' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(a => {
            const m = SIG_META[a.signal] ?? SIG_META.neutral
            const ret = (v: number) => <span style={{ fontFamily: MONO, fontSize: 11, color: v > 0 ? '#1D9E75' : v < 0 ? '#f87171' : '#7a7f9a' }}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</span>
            return (
              <tr key={a.id} style={{ borderBottom: '1px solid #1a1d2e' }}>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 12, color: '#e8e9f0' }}>{a.ticker ?? a.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: '#6b7688' }}>{a.category ?? a.assetClass}</div>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: m.c, background: `${m.c}18`, border: `1px solid ${m.c}40`, borderRadius: 4, padding: '2px 8px', letterSpacing: '0.06em' }}>{m.lbl}</span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>{ret(a.return30d)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>{ret(a.return90d)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>{ret(a.return1y)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1d2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: '#7a7f9a' }}>🔒 Sizing, score, EV y montos sugeridos por activo — plan PRO</span>
        <a href="/planes" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: '#ffb454', textDecoration: 'none', whiteSpace: 'nowrap' }}>VER SEÑAL COMPLETA →</a>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1,2,3].map(i => (
        <div key={i} className="animate-pulse" style={{
          height: i === 1 ? 80 : i === 2 ? 120 : 300,
          background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 10,
        }} />
      ))}
    </div>
  )
}

export default function MotorDecisionPage() {
  const { totalUSD: portfolioUSD } = usePortfolio()

  const [profile,     setProfile]     = useState<ProfileType>('retail')
  const [data,        setData]        = useState<SignalsResponse | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [nextRefresh, setNextRefresh] = useState<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  // Prioridad: localStorage → user_metadata.perfil_trader → default 'retail'
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ProfileType | null
      if (saved && ['retail', 'trader', 'institucional'].includes(saved)) return
    } catch {}
    // Si no hay preferencia guardada, usar el perfil del onboarding
    supabase.auth.getUser().then(({ data }) => {
      const p = data.user?.user_metadata?.perfil_trader as ProfileType | undefined
      if (p && ['retail', 'trader', 'institucional'].includes(p)) setProfile(p)
    })
  }, [])

  const fetchSignals = useCallback(async (p: ProfileType) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/motor/signals?profile=${p}`)
      if (!res.ok) throw new Error('Error del servidor')
      const json = await res.json() as SignalsResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSignals(profile) }, [profile, fetchSignals])

  // I: auto-refresh every 30 min
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (countRef.current)    clearInterval(countRef.current)
    if (!autoRefresh) return
    setNextRefresh(AUTO_INTERVAL)
    intervalRef.current = setInterval(() => { fetchSignals(profile); setNextRefresh(AUTO_INTERVAL) }, AUTO_INTERVAL)
    countRef.current    = setInterval(() => setNextRefresh(n => Math.max(0, n - 1000)), 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countRef.current)    clearInterval(countRef.current)
    }
  }, [autoRefresh, profile, fetchSignals])

  function handleProfileChange(p: ProfileType) {
    setProfile(p)
    try { localStorage.setItem(STORAGE_KEY, p) } catch {}
  }

  const BEBAS = "'Bebas Neue', Impact, sans-serif"

  // Color del régimen — tiñe el ambiente de toda la página
  const regimeColor = data?.regime === 'risk-on' ? '#1D9E75' : data?.regime === 'risk-off' ? '#f87171' : '#7a7f9a'
  // Encendido: el capital cuenta desde 0 al cargar
  const animCapital = useCountUp(portfolioUSD, 1400)

  return (
    <PageErrorBoundary section="Motor de Decisión">
    <div className="dash-content" style={{
      minHeight: '100vh', background: '#04050a',
      paddingBottom: '64px', maxWidth: 1280, margin: '0 auto', width: '100%',
      position: 'relative',
    }}>
      <style>{`
        .md-rv { opacity: 0; transform: translateY(14px); transition: opacity .55s ease, transform .55s ease; }
        .md-rv-in { opacity: 1; transform: none; }
        .md-regime { animation: mdRegime 2.4s ease-in-out infinite; }
        @keyframes mdRegime { 0%,100% { box-shadow: 0 0 10px var(--rc, transparent); } 50% { box-shadow: 0 0 22px var(--rc, transparent); } }
        @media (prefers-reduced-motion: reduce) {
          .md-rv { opacity: 1; transform: none; transition: none; }
          .md-regime { animation: none; }
        }
      `}</style>

      {/* Ambiente del régimen — glow superior que respira con el mercado */}
      <div aria-hidden style={{
        position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
        width: 900, height: 420, pointerEvents: 'none',
        background: `radial-gradient(ellipse at 50% 0%, ${regimeColor}14, transparent 65%)`,
        transition: 'background 1.2s ease',
      }} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28, position: 'relative' }}>
        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#1D9E75', boxShadow: '0 0 8px #1D9E75',
          }} className="sigma-blink" />
          <span style={{ fontSize: 10, color: '#1D9E75', fontFamily: MONO, letterSpacing: 1 }}>
            LIVE — MOTOR DE DECISIÓN
          </span>
          <span style={{ fontSize: 9, fontFamily: MONO, letterSpacing: '0.15em', color: '#39e2e6', background: 'rgba(57,226,230,0.10)', border: '1px solid rgba(57,226,230,0.25)', padding: '2px 8px', borderRadius: 3 }}>
            {profile.toUpperCase()}
          </span>
          {data && (
            <span className="md-regime" style={{
              fontSize: 11, fontFamily: MONO, letterSpacing: 1, fontWeight: 700,
              padding: '4px 14px', borderRadius: 4,
              background: `${regimeColor}18`,
              color: regimeColor,
              border: `1px solid ${regimeColor}55`,
              ['--rc' as string]: `${regimeColor}30`,
            }}>
              {data.regime === 'risk-on' ? '▲' : data.regime === 'risk-off' ? '▼' : '◆'} {data.regimeLabel}
            </span>
          )}
        </div>

        {/* Title — estilo landing */}
        <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(38px, 5vw, 60px)', fontFamily: BEBAS, letterSpacing: '0.03em', lineHeight: 0.95 }}>
          <span style={{ color: '#e8e9f0' }}>SIGMA MOTOR</span>{' '}
          <span style={{ background: 'linear-gradient(135deg,#39e2e6,#5eeaf0,#2f6bd6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            FINANCIERO
          </span>
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#7a7f9a', fontFamily: MONO }}>
          Rotación cross-market · Flujo de capital · Señales de decisión
        </p>

        {/* Buttons — row below title */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => fetchSignals(profile)} disabled={loading} style={{
            background: 'transparent', border: '1px solid #1a1d2e', borderRadius: 7,
            padding: '8px 14px', color: '#7a7f9a', fontSize: 11, fontFamily: MONO,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '⏳ Calculando...' : '↻ Actualizar'}
          </button>

          {/* I: Auto-refresh toggle */}
          <button onClick={() => setAutoRefresh(v => !v)} style={{
            background: autoRefresh ? 'rgba(29,158,117,0.12)' : 'transparent',
            border: `1px solid ${autoRefresh ? '#1D9E75' : '#1a1d2e'}`, borderRadius: 7,
            padding: '8px 14px', color: autoRefresh ? '#1D9E75' : '#7a7f9a',
            fontSize: 11, fontFamily: MONO, cursor: 'pointer',
          }}>
            {autoRefresh ? '⏸ Auto-refresh' : '⏱ Auto-refresh'}
          </button>

          {/* Indicador de countdown cuando auto-refresh está activo */}
          {autoRefresh && (
            <LiveRefreshIndicator
              loading={loading}
              nextRefreshMs={nextRefresh}
              intervalMs={AUTO_INTERVAL}
              onRefresh={() => fetchSignals(profile)}
            />
          )}

          {data && (
            <Link href="/motor-decision/reporte" style={{
              background: '#1D9E75', color: '#000', textDecoration: 'none',
              borderRadius: 7, padding: '8px 16px', fontSize: 11, fontWeight: 700, fontFamily: MONO,
            }}>
              📄 Ver Reporte
            </Link>
          )}
          <Link href="/motor-decision/accuracy" style={{
            background: 'transparent', border: '1px solid #378ADD40', textDecoration: 'none',
            borderRadius: 7, padding: '8px 14px', fontSize: 11, fontFamily: MONO, color: '#378ADD',
          }}>
            📈 Accuracy
          </Link>

          {data && !loading && (
            <span style={{ fontSize: 10, color: '#3a3f55', fontFamily: MONO, marginLeft: 8 }}>
              {new Date(data.generatedAt).toLocaleString('es-CL')} · {data.totalAssets} activos
            </span>
          )}
        </div>
      </div>

      {/* ── Selector de perfil ──────────────────────────────────────────── */}
      <Reveal>
      <section style={{ marginBottom: 24 }}>
        <SectionLabel>PERFIL DE INVERSOR</SectionLabel>
        <ProfileSelector
          selected={profile}
          profile={data?.profile}
          onChange={handleProfileChange}
          loading={loading}
        />
      </section>
      </Reveal>

      {/* ── Capital disponible ───────────────────────────────────────────── */}
      <Reveal>
      <section style={{ marginBottom: 24 }}>
        <SectionLabel>CAPITAL DISPONIBLE</SectionLabel>
        <div style={{
          background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 10,
          padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: MONO, letterSpacing: 1, marginBottom: 4 }}>
              PORTAFOLIO TOTAL
            </div>
            <div style={{ fontSize: 28, fontFamily: BEBAS, letterSpacing: 1, color: portfolioUSD > 0 ? '#1D9E75' : '#3a3f55' }}>
              {portfolioUSD > 0
                ? `$${Math.round(animCapital).toLocaleString('en-US')} USD`
                : '— Sin datos de portafolio'}
            </div>
          </div>
          {portfolioUSD > 0 && (
            <>
              <div style={{ width: 1, height: 40, background: '#1a1d2e', flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: '#7a7f9a', fontFamily: MONO }}>
                El motor distribuye este capital según la asignación óptima<br />
                y muestra cuánto poner en cada activo con señal{' '}
                <span style={{ color: '#1D9E75', fontWeight: 700 }}>COMPRAR</span>.
              </div>
            </>
          )}
          {portfolioUSD <= 0 && (
            <div style={{ fontSize: 11, color: '#7a7f9a', fontFamily: MONO }}>
              Ingresa tu capital en la página{' '}
              <a href="/portafolio" style={{ color: '#378ADD', textDecoration: 'none' }}>Portafolio</a>
              {' '}para ver los montos sugeridos.
            </div>
          )}
        </div>
      </section>
      </Reveal>

      {error && (
        <div style={{
          background: 'rgba(248,113,113,0.1)',
          border: '1px solid #f87171', borderRadius: 8,
          padding: '12px 16px', marginBottom: 20,
          color: '#f87171', fontSize: 12, fontFamily: MONO,
        }}>
          ⚠ Error cargando señales: {error}. Verifica la conexión a la base de datos.
        </div>
      )}

      {loading && !data ? (
        <LoadingSkeleton />
      ) : data ? (
        <>
          {/* ── KPIs ─────────────────────────────────────────────────────── */}
          <Reveal>
          <section style={{ marginBottom: 24 }}>
            <SectionLabel>MÉTRICAS DEL PORTAFOLIO</SectionLabel>
            {data.gated || !data.metrics ? (
              <LockPanel
                title="MÉTRICAS Y ASIGNACIÓN ÓPTIMA · PRO"
                sub="Retorno esperado, volatilidad, Sharpe, drawdown y el reparto óptimo del capital por clase de activo son parte del plan PRO."
              />
            ) : (
              <MetricCards
                metrics={data.metrics}
                flowScore={data.flowScore}
                buyCount={data.buyCount}
                sellCount={data.sellCount}
                holdCount={data.holdCount}
                capital={portfolioUSD}
              />
            )}
          </section>
          </Reveal>

          {/* ── Donut + Flujo ────────────────────────────────────────────── */}
          <Reveal>
          <section style={{ marginBottom: 24 }}>
            <SectionLabel>ASIGNACIÓN Y FLUJO CROSS-MARKET</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {data.gated || !data.metrics
                ? <LockPanel title="ASIGNACIÓN ÓPTIMA · PRO" sub="El motor reparte tu capital entre fondos, ETFs, renta fija y crypto según el régimen. Disponible en PRO." />
                : <AllocationDonut allocation={data.allocation} metrics={data.metrics} capital={portfolioUSD} currency="USD" />}
              <FlowIndicator signals={data.flowSignals} flowScore={data.flowScore} />
            </div>
          </section>
          </Reveal>

          {/* ── Tabla de señales ─────────────────────────────────────────── */}
          <Reveal>
          <section style={{ marginBottom: 24 }}>
            <SectionLabel>SEÑALES POR ACTIVO</SectionLabel>
            {data.gated
              ? <FreeDirectionTable data={data} />
              : <SignalTable assets={data.signals} capital={portfolioUSD} currency="USD" allocation={data.allocation} />}
          </section>
          </Reveal>

          {/* ── CTA Reporte ──────────────────────────────────────────────── */}
          <Reveal>
          <div style={{
            background: data.gated
              ? 'linear-gradient(135deg, rgba(255,180,84,0.06), rgba(55,138,221,0.06))'
              : 'linear-gradient(135deg, rgba(29,158,117,0.08), rgba(55,138,221,0.08))',
            border: '1px solid #1a1d2e', borderRadius: 12,
            padding: '24px', textAlign: 'center',
          }}>
            <h3 style={{
              margin: '0 0 8px', fontFamily: BEBAS, fontSize: 22,
              letterSpacing: 1, color: '#e8e9f0',
            }}>
              {data.gated ? 'EL REPORTE EJECUTIVO ES PRO' : 'REPORTE EJECUTIVO LISTO'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#7a7f9a', fontFamily: MONO }}>
              {data.gated
                ? 'Top 5 movimientos, señal Sigma IA, asignación óptima y score de flujo cross-market en un PDF descargable.'
                : 'Descarga el análisis completo con top 5 movimientos, señal Sigma IA y score de flujo cross-market'}
            </p>
            {data.gated ? (
              <Link href="/planes" style={{
                display: 'inline-block', background: 'transparent', color: '#ffb454',
                textDecoration: 'none', borderRadius: 8, padding: '10px 28px',
                fontSize: 12, fontWeight: 700, fontFamily: MONO, letterSpacing: '0.14em',
                border: '1px solid rgba(255,180,84,0.4)',
              }}>
                🔒 ACTIVAR PRO →
              </Link>
            ) : (
              <Link href="/motor-decision/reporte" style={{
                display: 'inline-block', background: '#1D9E75', color: '#000',
                textDecoration: 'none', borderRadius: 8, padding: '10px 28px',
                fontSize: 13, fontWeight: 700, fontFamily: MONO,
              }}>
                📄 Generar y Descargar Reporte PDF
              </Link>
            )}
          </div>
          </Reveal>
        </>
      ) : null}

    </div>
    </PageErrorBoundary>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 10, fontSize: 10, color: '#7a7f9a',
      fontFamily: 'monospace', letterSpacing: 1.5,
      textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ height: 1, width: 20, background: '#1a1d2e' }} />
      {children}
      <div style={{ height: 1, flex: 1, background: '#1a1d2e' }} />
    </div>
  )
}
