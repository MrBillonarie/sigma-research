'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { ProfileType, SignalsResponse } from '@/types/decision-engine'
import ProfileSelector from './components/ProfileSelector'
import MetricCards     from './components/MetricCards'
import AllocationDonut from './components/AllocationDonut'
import FlowIndicator   from './components/FlowIndicator'
import SignalTable     from './components/SignalTable'

const STORAGE_KEY = 'sigma_motor_profile'

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1,2,3].map(i => (
        <div key={i} className="animate-pulse" style={{
          height: i === 1 ? 80 : i === 2 ? 120 : 300,
          background: '#0b0d14', border: '1px solid #1a1d2e',
          borderRadius: 10,
        }} />
      ))}
    </div>
  )
}

export default function MotorDecisionPage() {
  const [profile,  setProfile]  = useState<ProfileType>('retail')
  const [data,     setData]     = useState<SignalsResponse | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  // Cargar perfil guardado
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ProfileType | null
      if (saved && ['retail', 'trader', 'institucional'].includes(saved)) {
        setProfile(saved)
      }
    } catch {}
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

  useEffect(() => {
    fetchSignals(profile)
  }, [profile, fetchSignals])

  function handleProfileChange(p: ProfileType) {
    setProfile(p)
    try { localStorage.setItem(STORAGE_KEY, p) } catch {}
  }

  const MONO  = 'var(--font-dm-mono, monospace)'
  const BEBAS = "'Bebas Neue', Impact, sans-serif"

  return (
    <div style={{
      minHeight: '100vh', background: '#04050a',
      padding: '24px 20px', maxWidth: 1280, margin: '0 auto',
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
          <button
            onClick={() => fetchSignals(profile)}
            disabled={loading}
            style={{
              background: 'transparent', border: '1px solid #1a1d2e', borderRadius: 7,
              padding: '8px 14px', color: '#7a7f9a',
              fontSize: 11, fontFamily: MONO, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '⏳ Calculando...' : '↻ Actualizar'}
          </button>
          {data && (
            <Link href="/motor-decision/reporte"
              style={{
                background: '#1D9E75', color: '#000', textDecoration: 'none',
                borderRadius: 7, padding: '8px 16px',
                fontSize: 11, fontWeight: 700, fontFamily: MONO,
              }}
            >
              📄 Ver Reporte
            </Link>
          )}
          {data && !loading && (
            <span style={{ fontSize: 10, color: '#3a3f55', fontFamily: MONO, marginLeft: 8 }}>
              Actualizado: {new Date(data.generatedAt).toLocaleString('es-CL')} · {data.totalAssets} activos
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
              <AllocationDonut allocation={data.allocation} metrics={data.metrics} />
              <FlowIndicator   signals={data.flowSignals}  flowScore={data.flowScore} />
            </div>
          </section>

          {/* ── Tabla de señales ─────────────────────────────────────────── */}
          <section style={{ marginBottom: 24 }}>
            <SectionLabel>SEÑALES POR ACTIVO</SectionLabel>
            <SignalTable assets={data.signals} />
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
