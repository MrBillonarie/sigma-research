'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'

type Perfil = 'retail' | 'trader' | 'institucional'

const PERFILES = [
  { id: 'retail' as Perfil,        label: 'INVERSOR',      desc: 'Ahorro a largo plazo, FIRE, portafolio pasivo.',        icon: '◈' },
  { id: 'trader' as Perfil,        label: 'TRADER ACTIVO', desc: 'Operaciones frecuentes, señales, journal de trades.',   icon: '⚡' },
  { id: 'institucional' as Perfil, label: 'INSTITUCIONAL', desc: 'Gestión de fondos, análisis cuantitativo avanzado.',    icon: '∑' },
]

export default function OnboardingPage() {
  const router  = useRouter()
  const [step,   setStep]   = useState(1)
  const [nombre, setNombre] = useState('')
  const [perfil, setPerfil] = useState<Perfil>('trader')
  const [apiKey, setApiKey] = useState('')
  const [secret, setSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      // Si ya completó onboarding, ir al home
      if (data.user.user_metadata?.onboarding_done) { router.replace('/home'); return }
      setUserId(data.user.id)
      setNombre(data.user.user_metadata?.nombre ?? '')
    })
  }, [router])

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setStep(2)
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setStep(3)
  }

  async function handleFinish() {
    setSaving(true)
    // Guardar nombre + perfil en metadata
    await supabase.auth.updateUser({
      data: { nombre: nombre.trim() || undefined, perfil_trader: perfil, onboarding_done: true },
    })
    // Guardar Binance keys si se proporcionaron
    if (apiKey && secret && userId) {
      await supabase.from('user_config').upsert(
        { user_id: userId, binance_api_key: apiKey, binance_api_secret: secret },
        { onConflict: 'user_id' }
      )
    }
    setSaving(false)
    router.replace('/home')
  }

  return (
    <main className="min-h-screen bg-bg bg-grid-pattern bg-grid flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-7 h-7 border border-gold flex items-center justify-center">
            <span className="display-heading text-gold text-sm leading-none">Σ</span>
          </div>
          <span className="display-heading text-xl tracking-widest text-text">SIGMA RESEARCH</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 flex items-center justify-center border text-xs section-label transition-colors ${
                s < step  ? 'bg-gold border-gold text-bg' :
                s === step ? 'border-gold text-gold' :
                'border-border text-muted'
              }`}>
                {s < step ? '✓' : s}
              </div>
              {s < 3 && <div className={`flex-1 h-px ${s < step ? 'bg-gold' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        <div className="glass-card p-8 shadow-card">

          {/* ── Paso 1: Perfil ── */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="flex flex-col gap-6">
              <div>
                <div className="section-label text-gold mb-1">{'// PASO 1 DE 3'}</div>
                <h2 className="display-heading text-3xl text-text mb-1">CUÉNTANOS SOBRE TI</h2>
                <p className="terminal-text text-text-dim text-sm">Personalizamos la plataforma según tu perfil.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="section-label text-text-dim text-xs">¿Cómo te llamas?</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="section-label text-text-dim text-xs">¿Cuál es tu perfil?</label>
                {PERFILES.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPerfil(p.id)}
                    className={`flex items-center gap-4 p-4 border text-left transition-colors ${
                      perfil === p.id ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/40'
                    }`}
                  >
                    <span className={`text-xl w-8 text-center ${perfil === p.id ? 'text-gold' : 'text-muted'}`}>{p.icon}</span>
                    <div>
                      <div className={`section-label text-xs ${perfil === p.id ? 'text-gold' : 'text-text'}`}>{p.label}</div>
                      <div className="terminal-text text-xs text-text-dim mt-0.5">{p.desc}</div>
                    </div>
                    {perfil === p.id && <span className="ml-auto text-gold text-sm">✓</span>}
                  </button>
                ))}
              </div>

              <button type="submit" className="bg-gold text-bg section-label py-3 hover:bg-gold-glow transition-colors">
                CONTINUAR →
              </button>
            </form>
          )}

          {/* ── Paso 2: Binance ── */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="flex flex-col gap-6">
              <div>
                <div className="section-label text-gold mb-1">{'// PASO 2 DE 3'}</div>
                <h2 className="display-heading text-3xl text-text mb-1">CONECTAR BINANCE</h2>
                <p className="terminal-text text-text-dim text-sm">Opcional — puedes hacerlo más tarde en tu perfil.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="section-label text-text-dim text-xs">API Key</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Tu Binance API Key"
                  className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors font-mono text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="section-label text-text-dim text-xs">API Secret</label>
                <input
                  type="password"
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  placeholder="Tu Binance API Secret"
                  className="bg-surface border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
                />
              </div>

              <div className="border border-gold/20 bg-gold/5 px-4 py-3">
                <p className="terminal-text text-xs text-text-dim leading-relaxed">
                  Usa permisos de <span className="text-gold">solo lectura</span>. Sigma nunca ejecuta órdenes. Puedes cambiar las keys en cualquier momento desde tu perfil.
                </p>
              </div>

              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-gold text-bg section-label py-3 hover:bg-gold-glow transition-colors">
                  {apiKey && secret ? 'GUARDAR Y CONTINUAR →' : 'OMITIR POR AHORA →'}
                </button>
              </div>
            </form>
          )}

          {/* ── Paso 3: Bienvenida ── */}
          {step === 3 && (
            <div className="flex flex-col gap-6">
              <div>
                <div className="section-label text-gold mb-1">{'// PASO 3 DE 3'}</div>
                <h2 className="display-heading text-3xl text-text mb-1">TODO LISTO</h2>
                <p className="terminal-text text-text-dim text-sm">
                  Bienvenido{nombre ? `, ${nombre}` : ''} a Sigma Research.
                </p>
              </div>

              <div className="flex flex-col gap-px bg-border">
                {[
                  { icon: '◈', label: 'Dashboard personalizado',    desc: 'KPIs, señales y portafolio en tiempo real' },
                  { icon: '⚡', label: 'HUD de señales live',        desc: 'Binance WebSocket · régimen de mercado' },
                  { icon: '∑',  label: 'Motor de decisión',          desc: `Optimizado para perfil ${PERFILES.find(p => p.id === perfil)?.label}` },
                  { icon: '◎', label: 'Calculadora FIRE',           desc: 'Simulaciones Monte Carlo · planificación' },
                ].map(item => (
                  <div key={item.label} className="bg-surface px-5 py-4 flex items-center gap-4">
                    <span className="text-gold text-lg w-6 text-center">{item.icon}</span>
                    <div>
                      <div className="terminal-text text-sm text-text">{item.label}</div>
                      <div className="terminal-text text-xs text-text-dim">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleFinish}
                disabled={saving}
                className="bg-gold text-bg section-label py-3 hover:bg-gold-glow transition-colors disabled:opacity-50"
              >
                {saving ? 'CONFIGURANDO…' : 'IR AL DASHBOARD →'}
              </button>
            </div>
          )}
        </div>

        <p className="terminal-text text-center text-xs text-muted mt-6">
          Puedes ajustar todo esto más tarde en{' '}
          <Link href="/perfil" className="text-gold hover:text-gold-glow transition-colors">tu perfil</Link>
        </p>
      </div>
    </main>
  )
}
