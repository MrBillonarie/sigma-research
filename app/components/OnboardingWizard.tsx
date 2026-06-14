'use client'
import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '@/app/lib/useOnboarding'

const MONO  = 'var(--font-dm-mono, monospace)'
const BEBAS = "'Bebas Neue', Impact, sans-serif"
const GOLD  = '#d4af37'

// ─── Paso 1: Objetivo ─────────────────────────────────────────────────────────
const OBJETIVOS = [
  { id: 'fire',       label: 'Independencia Financiera',  desc: 'Quiero alcanzar FIRE y calcular mi número.',         icon: '🔥' },
  { id: 'trading',    label: 'Trading Activo',             desc: 'Opero mercados y quiero señales cuantitativas.',     icon: '⚡' },
  { id: 'cuantitativo', label: 'Análisis Cuantitativo',   desc: 'Me interesa investigación y modelos de mercado.',    icon: '∑' },
]

// ─── Paso 2: Plataformas ──────────────────────────────────────────────────────
const PLATAFORMAS = [
  { id: 'binance',   label: 'Binance',   icon: '₿' },
  { id: 'ibkr',      label: 'IBKR',      icon: '📊' },
  { id: 'fintual',   label: 'Fintual',   icon: '🇨🇱' },
  { id: 'santander', label: 'Santander', icon: '🏦' },
  { id: 'cash',      label: 'Efectivo',  icon: '💵' },
]

// ─── Destino por objetivo ─────────────────────────────────────────────────────
const OBJETIVO_HREF: Record<string, string> = {
  fire:         '/fire',
  trading:      '/hud',
  cuantitativo: '/motor-decision',
}

export default function OnboardingWizard() {
  const router                                   = useRouter()
  const { showWizard, savePrefs, completeOnboarding } = useOnboarding()
  const [step,     setStep]     = useState(0)
  const [objetivo, setObjetivo] = useState<string | null>(null)
  const [plats,    setPlats]    = useState<string[]>([])
  const [saving,   setSaving]   = useState(false)

  const handleComplete = useCallback(async () => {
    setSaving(true)
    const perfil = objetivo === 'trading' ? 'trader' : objetivo === 'cuantitativo' ? 'institucional' : 'retail'
    await savePrefs({ objetivo, plataformas: plats, perfil, onboarding_step: 3 })
    await completeOnboarding()
    setSaving(false)
    router.push(OBJETIVO_HREF[objetivo ?? 'fire'] ?? '/home')
  }, [objetivo, plats, savePrefs, completeOnboarding, router])

  const steps = useMemo(() => [
    { label: 'Objetivo',    completed: objetivo !== null },
    { label: 'Plataformas', completed: true },
    { label: 'Listo',       completed: false },
  ], [objetivo])

  if (!showWizard) return null

  return (
    <>
      {/* Overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(4,5,10,0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}>
        <div style={{
          background: '#0b0d14',
          border: '1px solid #1a1d2e',
          borderRadius: 14,
          width: '100%',
          maxWidth: 520,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '20px 28px',
            borderBottom: '1px solid #1a1d2e',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 22, fontFamily: MONO, color: GOLD }}>Σ</span>
            <div>
              <div style={{ fontFamily: BEBAS, fontSize: 16, letterSpacing: 2, color: '#e8e9f0' }}>
                BIENVENIDO A SIGMA RESEARCH
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#7a7f9a', letterSpacing: 1 }}>
                Configuración inicial — 2 minutos
              </div>
            </div>
          </div>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 8, padding: '16px 28px 0', alignItems: 'center' }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: i === step ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i < step ? GOLD : i === step ? GOLD : '#1a1d2e',
                  transition: 'all 0.3s ease',
                  opacity: i < step ? 0.5 : 1,
                }} />
                {i < steps.length - 1 && (
                  <div style={{ width: 20, height: 1, background: '#1a1d2e' }} />
                )}
              </div>
            ))}
            <span style={{ fontFamily: MONO, fontSize: 10, color: '#7a7f9a', marginLeft: 8 }}>
              {step + 1} / 3
            </span>
          </div>

          {/* Content */}
          <div style={{ padding: '20px 28px 28px' }}>

            {/* ── Paso 0: Objetivo ─────────────────────────────────────── */}
            {step === 0 && (
              <div>
                <p style={{ margin: '0 0 18px', fontFamily: MONO, fontSize: 12, color: '#7a7f9a', lineHeight: 1.6 }}>
                  ¿Cuál es tu objetivo principal como inversor?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {OBJETIVOS.map(o => (
                    <button
                      key={o.id}
                      onClick={() => setObjetivo(o.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 18px',
                        background: objetivo === o.id ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${objetivo === o.id ? 'rgba(212,175,55,0.40)' : '#1a1d2e'}`,
                        borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{o.icon}</span>
                      <div>
                        <div style={{ fontFamily: MONO, fontSize: 12, color: objetivo === o.id ? GOLD : '#e8e9f0', fontWeight: objetivo === o.id ? 700 : 400 }}>
                          {o.label}
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 10, color: '#7a7f9a', marginTop: 3, lineHeight: 1.5 }}>
                          {o.desc}
                        </div>
                      </div>
                      {objetivo === o.id && (
                        <span style={{ marginLeft: 'auto', color: GOLD, fontSize: 14 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Paso 1: Plataformas ───────────────────────────────────── */}
            {step === 1 && (
              <div>
                <p style={{ margin: '0 0 18px', fontFamily: MONO, fontSize: 12, color: '#7a7f9a', lineHeight: 1.6 }}>
                  ¿En qué plataformas tienes inversiones? (selecciona todas las que apliquen)
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {PLATAFORMAS.map(p => {
                    const selected = plats.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => setPlats(v => selected ? v.filter(x => x !== p.id) : [...v, p.id])}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 16px',
                          background: selected ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${selected ? 'rgba(212,175,55,0.40)' : '#1a1d2e'}`,
                          borderRadius: 8, cursor: 'pointer',
                          fontFamily: MONO, fontSize: 12,
                          color: selected ? GOLD : '#e8e9f0',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                        {selected && <span style={{ color: GOLD, fontSize: 10 }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
                <p style={{ margin: '16px 0 0', fontFamily: MONO, fontSize: 10, color: '#3a3f55' }}>
                  Puedes cambiar esto en cualquier momento desde tu perfil.
                </p>
              </div>
            )}

            {/* ── Paso 2: Resumen ───────────────────────────────────────── */}
            {step === 2 && (
              <div>
                <p style={{ margin: '0 0 18px', fontFamily: MONO, fontSize: 12, color: '#7a7f9a', lineHeight: 1.6 }}>
                  Todo listo. Te llevamos directo a tu herramienta principal.
                </p>
                <div style={{
                  background: 'rgba(212,175,55,0.05)',
                  border: '1px solid rgba(212,175,55,0.18)',
                  borderRadius: 10,
                  padding: '16px 20px',
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  {objetivo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: '#7a7f9a', width: 90 }}>OBJETIVO</span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: GOLD }}>
                        {OBJETIVOS.find(o => o.id === objetivo)?.label}
                      </span>
                    </div>
                  )}
                  {plats.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: '#7a7f9a', width: 90, paddingTop: 2 }}>PLATAFORMAS</span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: '#e8e9f0' }}>
                        {plats.map(p => PLATAFORMAS.find(x => x.id === p)?.label).filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: '#7a7f9a', width: 90 }}>DESTINO</span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: '#1D9E75' }}>
                      {OBJETIVO_HREF[objetivo ?? 'fire'] ?? '/home'}
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer actions */}
          <div style={{
            padding: '0 28px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            {step > 0 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  background: 'transparent', border: '1px solid #1a1d2e',
                  borderRadius: 7, padding: '9px 18px',
                  color: '#7a7f9a', fontFamily: MONO, fontSize: 11, cursor: 'pointer',
                }}
              >
                ← Atrás
              </button>
            ) : (
              <button
                onClick={handleComplete}
                style={{
                  background: 'transparent', border: 'none',
                  color: '#3a3f55', fontFamily: MONO, fontSize: 10, cursor: 'pointer',
                }}
              >
                Omitir
              </button>
            )}

            {step < 2 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 0 && !objetivo}
                style={{
                  background: step === 0 && !objetivo ? '#1a1d2e' : GOLD,
                  color: step === 0 && !objetivo ? '#3a3f55' : '#04050a',
                  border: 'none', borderRadius: 7, padding: '10px 24px',
                  fontFamily: MONO, fontSize: 12, fontWeight: 700,
                  cursor: step === 0 && !objetivo ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.08em',
                  transition: 'all 0.15s',
                }}
              >
                Siguiente →
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={saving}
                style={{
                  background: saving ? '#1a1d2e' : '#1D9E75',
                  color: saving ? '#3a3f55' : '#000',
                  border: 'none', borderRadius: 7, padding: '10px 24px',
                  fontFamily: MONO, fontSize: 12, fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.08em',
                }}
              >
                {saving ? 'Guardando...' : 'Comenzar →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
