'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ProfileType, Report, SignalsResponse } from '@/types/decision-engine'
import { generateReport } from '@/lib/reportGen'
import ReportView from '../components/ReportView'

const STORAGE_KEY = 'sigma_motor_profile'

export default function ReportePage() {
  const router = useRouter()
  const [report,  setReport]  = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let profile: ProfileType = 'retail'
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ProfileType | null
      if (saved && ['retail','trader','institucional'].includes(saved)) profile = saved
    } catch {}

    async function load() {
      try {
        const res  = await fetch(`/api/motor/signals?profile=${profile}`)
        if (!res.ok) throw new Error('Error cargando señales')
        const data = await res.json() as SignalsResponse

        const rep = generateReport(
          data.profile,
          data.signals,
          data.allocation,
          data.metrics,
          data.flowSignals,
          data.flowScore,
        )
        setReport(rep)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const BEBAS = "'Bebas Neue', Impact, sans-serif"
  const MONO  = 'monospace'

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#04050a',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid #1a1d2e',
          borderTopColor: '#1D9E75',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: '#7a7f9a', fontFamily: MONO, fontSize: 12 }}>
          Generando reporte...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', background: '#04050a',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
      }}>
        <div style={{ fontSize: 36 }}>⚠️</div>
        <h2 style={{ margin: 0, color: '#f87171', fontFamily: BEBAS, letterSpacing: 1 }}>
          Error generando reporte
        </h2>
        <p style={{ color: '#7a7f9a', fontFamily: MONO, fontSize: 12, textAlign: 'center' }}>{error}</p>
        <Link href="/motor-decision" style={{
          background: '#1D9E75', color: '#000', textDecoration: 'none',
          borderRadius: 7, padding: '8px 20px', fontSize: 12, fontWeight: 700, fontFamily: MONO,
        }}>
          ← Volver al Motor
        </Link>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#04050a',
      padding: '88px 24px 64px', maxWidth: 900, margin: '0 auto',
    }}>
      {/* Breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 24, fontSize: 11, fontFamily: MONO, color: '#7a7f9a',
      }}>
        <Link href="/motor-decision" style={{ color: '#378ADD', textDecoration: 'none' }}>
          ← Motor de Decisión
        </Link>
        <span>/</span>
        <span>Reporte Semanal</span>
      </div>

      {report && (
        <ReportView
          report={report}
          onClose={() => router.push('/motor-decision')}
        />
      )}

      {/* Programación domingo */}
      <div style={{
        marginTop: 20, padding: '14px 18px',
        background: '#0b0d14', border: '1px solid #1a1d2e',
        borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 20 }}>🕕</div>
        <div>
          <div style={{ fontSize: 11, color: '#7a7f9a', fontFamily: MONO }}>PUBLICACIÓN PROGRAMADA</div>
          <div style={{ fontSize: 12, color: '#e8e9f0', marginTop: 3 }}>
            Domingos 17:45 hora Chile — generación automática para X (Twitter) + LinkedIn
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#1D9E75', fontFamily: MONO }}>
          Siguiente: domingo 18:00 —{'>'}
        </div>
      </div>
    </div>
  )
}
