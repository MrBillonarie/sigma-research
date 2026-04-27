'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import type { ProfileType, SignalsResponse } from '@/types/decision-engine'
import { usePortfolio } from '@/app/lib/usePortfolio'
import ProfileSelector from './components/ProfileSelector'
import MetricCards     from './components/MetricCards'
import AllocationDonut from './components/AllocationDonut'
import FlowIndicator   from './components/FlowIndicator'
import SignalTable     from './components/SignalTable'

const STORAGE_KEY     = 'sigma_motor_profile'
const CAPITAL_KEY     = 'sigma_capital'
const AUTO_INTERVAL   = 30 * 60 * 1000

function fmt(n: number, cur: 'CLP' | 'USD'): string {
  if (cur === 'CLP') {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
    return `$${Math.round(n).toLocaleString('es-CL')}`
  }
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function CapitalInput({ capital, currency, portfolioUSD, synced, onChange, onSync }: {
  capital:      number
  currency:     'CLP' | 'USD'
  portfolioUSD: number
  synced:       boolean
  onChange:     (amount: number, cur: 'CLP' | 'USD') => void
  onSync:       () => void
}) {
  const MONO = 'var(--font-dm-mono, monospace)'
  const [raw, setRaw] = useState(capital > 0 ? capital.toString() : '')

  useEffect(() => {
    setRaw(capital > 0 ? capital.toFixed(currency === 'USD' ? 0 : 0) : '')
  }, [capital, currency])

  function handleAmount(val: string) {
    setRaw(val)
    const n = parseFloat(val.replace(/[^0-9.]/g, ''))
    if (!isNaN(n) && n >= 0) onChange(n, currency)
    else if (val === '' || val === '0') onChange(0, currency)
  }

  const hasPortfolio    = portfolioUSD > 0
  const portfolioLabel  = fmt(portfolioUSD, 'USD')

  return (
    <div style={{
      background: '#0b0d14', border: '1px solid #1a1d2e', borderRadius: 10,
      padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
    }}>
      {/* Input */}
      <div>
        <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: MONO, letterSpacing: 1, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          CAPITAL A INVERTIR
          {synced && (
            <span style={{ color: '#1D9E75', fontSize: 9, background: 'rgba(29,158,117,0.1)', border: '1px solid #1D9E7540', borderRadius: 3, padding: '1px 6px' }}>
              ⟳ DESDE TU PORTAFOLIO
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#7a7f9a', fontFamily: MONO }}>USD $</span>
          <input
            type="text"
            inputMode="numeric"
            value={raw}
            placeholder="0"
            onChange={e => handleAmount(e.target.value)}
            style={{
              background: '#04050a', border: `1px solid ${synced ? '#1D9E7550' : '#1a1d2e'}`, borderRadius: 6,
              padding: '6px 12px', color: '#1D9E75', fontSize: 14, fontFamily: MONO,
              width: 160, outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Botón sincronizar con portafolio */}
      {hasPortfolio && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, color: '#7a7f9a', fontFamily: MONO, letterSpacing: 1 }}>
            PORTAFOLIO TOTAL
          </div>
          <button onClick={onSync} style={{
            background: synced ? 'rgba(29,158,117,0.08)' : 'transparent',
            border: `1px solid ${synced ? '#1D9E75' : '#1a1d2e'}`,
            borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
            fontFamily: MONO, fontSize: 12,
            color: synced ? '#1D9E75' : '#e8e9f0',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 14 }}>{synced ? '✓' : '⟳'}</span>
            {portfolioLabel} USD
          </button>
          {!synced && (
            <div style={{ fontSize: 9, color: '#3a3f55', fontFamily: MONO }}>
              clic para usar este valor
            </div>
          )}
        </div>
      )}

      {capital > 0 && (
        <div style={{ fontSize: 11, color: '#7a7f9a', fontFamily: MONO, maxWidth: 280 }}>
          El motor distribuye tu capital según la asignación óptima y lo reparte
          entre activos <span style={{ color: '#1D9E75' }}>COMPRAR</span> ponderado por score.
        </div>
      )}
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
  const { totalUSD: portfolioUSD, ready: portfolioReady } = usePortfolio()

  const [profile,     setProfile]     = useState<ProfileType>('retail')
  const [data,        setData]        = useState<SignalsResponse | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [nextRefresh, setNextRefresh] = useState<number>(0)
  const [capital,     setCapital]     = useState(0)
  const [currency,    setCurrency]    = useState<'CLP' | 'USD'>('USD')
  const [synced,      setSynced]      = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ProfileType | null
      if (saved && ['retail', 'trader', 'institucional'].includes(saved)) setProfile(saved)
      const cap = localStorage.getItem(CAPITAL_KEY)
      if (cap) {
        const { amount, cur, fromPortfolio } = JSON.parse(cap)
        if (amount > 0) { setCapital(amount); setCurrency(cur); setSynced(!!fromPortfolio) }
      }
    } catch {}
  }, [])

  // Auto-sync con portafolio si no hay capital manual guardado
  useEffect(() => {
    if (!portfolioReady || portfolioUSD <= 0) return
    try {
      const cap = localStorage.getItem(CAPITAL_KEY)
      if (!cap) {
        setCapital(portfolioUSD)
        setCurrency('USD')
        setSynced(true)
      }
    } catch {}
  }, [portfolioReady, portfolioUSD])

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

  function handleCapitalChange(amount: number, cur: 'CLP' | 'USD') {
    setCapital(amount)
    setCurrency(cur)
    setSynced(false)
    try { localStorage.setItem(CAPITAL_KEY, JSON.stringify({ amount, cur, fromPortfolio: false })) } catch {}
  }

  function handleSyncPortfolio() {
    if (portfolioUSD <= 0) return
    setCapital(portfolioUSD)
    setCurrency('USD')
    setSynced(true)
    try { localStorage.setItem(CAPITAL_KEY, JSON.stringify({ amount: portfolioUSD, cur: 'USD', fromPortfolio: true })) } catch {}
  }

  const MONO  = 'var(--font-dm-mono, monospace)'
  const BEBAS = "'Bebas Neue', Impact, sans-serif"

  return (
    <div style={{
      minHeight: '100vh', background: '#04050a',
      padding: '88px 24px 64px', maxWidth: 1280, margin: '0 auto',
    }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        {/* Eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#1D9E75', boxShadow: '0 0 8px #1D9E75',
          }} className="sigma-blink" />
          <span style={{ fontSize: 10, color: '#1D9E75', fontFamily: MONO, letterSpacing: 1 }}>
            LIVE — MOTOR DE DECISIÓN
          </span>
        </div>

        {/* Title */}
        <h1 style={{ margin: '0 0 4px', fontSize: 32, fontFamily: BEBAS, letterSpacing: 2, color: '#e8e9f0' }}>
          SIGMA MOTOR FINANCIERO
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
            {autoRefresh
              ? `⏱ Auto: ${Math.ceil(nextRefresh / 60000)}m`
              : '⏱ Auto-refresh'}
          </button>

          {data && (
            <Link href="/motor-decision/reporte" style={{
              background: '#1D9E75', color: '#000', textDecoration: 'none',
              borderRadius: 7, padding: '8px 16px', fontSize: 11, fontWeight: 700, fontFamily: MONO,
            }}>
              📄 Ver Reporte
            </Link>
          )}

          {data && !loading && (
            <span style={{ fontSize: 10, color: '#3a3f55', fontFamily: MONO, marginLeft: 8 }}>
              {new Date(data.generatedAt).toLocaleString('es-CL')} · {data.totalAssets} activos
            </span>
          )}
        </div>
      </div>

      {/* ── Selector de perfil ──────────────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <SectionLabel>PERFIL DE INVERSOR</SectionLabel>
        <ProfileSelector
          selected={profile}
          profile={data?.profile}
          onChange={handleProfileChange}
          loading={loading}
        />
      </section>

      {/* ── Capital disponible ───────────────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <SectionLabel>CAPITAL A INVERTIR</SectionLabel>
        <CapitalInput
          capital={capital}
          currency={currency}
          portfolioUSD={portfolioUSD}
          synced={synced}
          onChange={handleCapitalChange}
          onSync={handleSyncPortfolio}
        />
      </section>

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
          <section style={{ marginBottom: 24 }}>
            <SectionLabel>MÉTRICAS DEL PORTAFOLIO</SectionLabel>
            <MetricCards
              metrics={data.metrics}
              flowScore={data.flowScore}
              buyCount={data.buyCount}
              sellCount={data.sellCount}
              holdCount={data.holdCount}
            />
          </section>

          {/* ── Donut + Flujo ────────────────────────────────────────────── */}
          <section style={{ marginBottom: 24 }}>
            <SectionLabel>ASIGNACIÓN Y FLUJO CROSS-MARKET</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <AllocationDonut allocation={data.allocation} metrics={data.metrics} capital={capital} currency={currency} />
              <FlowIndicator   signals={data.flowSignals}  flowScore={data.flowScore} />
            </div>
          </section>

          {/* ── Tabla de señales ─────────────────────────────────────────── */}
          <section style={{ marginBottom: 24 }}>
            <SectionLabel>SEÑALES POR ACTIVO</SectionLabel>
            <SignalTable assets={data.signals} capital={capital} currency={currency} allocation={data.allocation} />
          </section>

          {/* ── CTA Reporte ──────────────────────────────────────────────── */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(29,158,117,0.08), rgba(55,138,221,0.08))',
            border: '1px solid #1a1d2e', borderRadius: 12,
            padding: '24px', textAlign: 'center',
          }}>
            <h3 style={{
              margin: '0 0 8px', fontFamily: BEBAS, fontSize: 22,
              letterSpacing: 1, color: '#e8e9f0',
            }}>
              REPORTE EJECUTIVO LISTO
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#7a7f9a', fontFamily: MONO }}>
              Descarga el análisis completo con top 5 movimientos, señal Sigma IA y score de flujo cross-market
            </p>
            <Link href="/motor-decision/reporte"
              style={{
                display: 'inline-block',
                background: '#1D9E75', color: '#000',
                textDecoration: 'none', borderRadius: 8,
                padding: '10px 28px', fontSize: 13,
                fontWeight: 700, fontFamily: MONO,
              }}
            >
              📄 Generar y Descargar Reporte PDF
            </Link>
          </div>
        </>
      ) : null}

    </div>
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
