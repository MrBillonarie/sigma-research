'use client'
import { useState } from 'react'
import Link from 'next/link'

const motivos = [
  'Plan Institutional — solicitud de acceso',
  'Demo personalizada',
  'Integración API',
  'Propuesta de colaboración',
  'Soporte técnico',
  'Otro',
]

export default function ContactoPage() {
  const [nombre,    setNombre]    = useState('')
  const [empresa,   setEmpresa]   = useState('')
  const [email,     setEmail]     = useState('')
  const [motivo,    setMotivo]    = useState(motivos[0])
  const [mensaje,   setMensaje]   = useState('')
  const [errors,    setErrors]    = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [apiError,  setApiError]  = useState('')

  function validate() {
    const e: Record<string, string> = {}
    if (!nombre.trim())                                e.nombre  = 'Campo obligatorio.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))   e.email   = 'Email no válido.'
    if (mensaje.trim().length < 10)                   e.mensaje = 'Mínimo 10 caracteres.'
    if (mensaje.trim().length > 2000)                 e.mensaje = 'Máximo 2000 caracteres.'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    setApiError('')
    if (Object.keys(e).length) return

    setLoading(true)
    try {
      const res = await fetch('/api/contacto', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nombre: nombre.trim(), empresa: empresa.trim(), email: email.trim(), motivo, mensaje: mensaje.trim() }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setApiError(data.error ?? 'Error al enviar. Intenta nuevamente.')
        return
      }
      setSubmitted(true)
      setNombre(''); setEmpresa(''); setEmail(''); setMensaje('')
    } catch {
      setApiError('Sin conexión. Verifica tu internet e intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-bg bg-grid-pattern bg-grid relative overflow-hidden">
      <div className="absolute inset-0 bg-radial-gold pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 pt-40 pb-24">

        {/* Header */}
        <div className="mb-16">
          <div className="section-label text-gold mb-4">{'// CONTACTO'}</div>
          <h1 className="display-heading text-6xl sm:text-8xl text-text leading-none mb-4">
            HABLA CON
            <br />
            <span className="gold-text">EL EQUIPO</span>
          </h1>
          <p className="terminal-text text-text-dim max-w-md">
            Responderemos en menos de 24 horas en días laborables.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-px bg-border">

          {/* Formulario */}
          <div className="bg-surface p-8 lg:p-12">
            {submitted ? (
              <div className="flex flex-col gap-6 h-full justify-center">
                <div className="section-label text-gold">{'// SOLICITUD RECIBIDA'}</div>
                <h2 className="display-heading text-5xl text-text">
                  EN COLA
                  <br />
                  <span className="gold-text">DE REVISIÓN</span>
                </h2>
                <p className="terminal-text text-text-dim leading-relaxed max-w-sm">
                  ✓ Mensaje enviado. Te responderemos pronto en{' '}
                  <span className="text-gold">{email || 'tu email'}</span>.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="self-start section-label text-text-dim hover:text-gold transition-colors"
                >
                  ← Enviar otro mensaje
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">

                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Nombre */}
                  <div className="flex flex-col gap-1.5">
                    <label className="section-label text-text-dim">Nombre *</label>
                    <input
                      type="text" required value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      placeholder="Tu nombre"
                      className="bg-bg border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
                    />
                    {errors.nombre && <span className="terminal-text text-red-400 text-xs">{errors.nombre}</span>}
                  </div>

                  {/* Empresa */}
                  <div className="flex flex-col gap-1.5">
                    <label className="section-label text-text-dim">Empresa <span className="text-muted normal-case">(opcional)</span></label>
                    <input
                      type="text" value={empresa}
                      onChange={e => setEmpresa(e.target.value)}
                      placeholder="Tu empresa o fondo"
                      className="bg-bg border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="section-label text-text-dim">Email *</label>
                  <input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@empresa.com"
                    className="bg-bg border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors"
                  />
                  {errors.email && <span className="terminal-text text-red-400 text-xs">{errors.email}</span>}
                </div>

                {/* Motivo */}
                <div className="flex flex-col gap-1.5">
                  <label className="section-label text-text-dim">Motivo de contacto</label>
                  <select
                    value={motivo} onChange={e => setMotivo(e.target.value)}
                    className="bg-bg border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text transition-colors appearance-none cursor-pointer"
                  >
                    {motivos.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {/* Mensaje */}
                <div className="flex flex-col gap-1.5">
                  <label className="section-label text-text-dim">Mensaje *</label>
                  <textarea
                    required rows={5} value={mensaje}
                    onChange={e => setMensaje(e.target.value)}
                    placeholder="Describe tu solicitud con el mayor detalle posible..."
                    className="bg-bg border border-border focus:border-gold/60 outline-none px-4 py-2.5 terminal-text text-text placeholder:text-muted transition-colors resize-none"
                  />
                  <div className="flex justify-between">
                    {errors.mensaje
                      ? <span className="terminal-text text-red-400 text-xs">{errors.mensaje}</span>
                      : <span />}
                    <span className={`terminal-text text-xs ${mensaje.length > 1800 ? 'text-gold' : 'text-muted'}`}>
                      {mensaje.length}/2000
                    </span>
                  </div>
                </div>

                {/* API error */}
                {apiError && (
                  <div className="terminal-text text-red-400 text-sm border border-red-400/20 bg-red-400/5 px-4 py-3">
                    ✗ {apiError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gold text-bg section-label py-3 hover:bg-gold-glow transition-colors duration-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'ENVIANDO...' : 'ENVIAR SOLICITUD'}
                </button>
              </form>
            )}
          </div>

          {/* Info lateral */}
          <div className="bg-bg p-8 lg:p-12 flex flex-col gap-10">
            <div>
              <div className="section-label text-gold mb-3">TIEMPO DE RESPUESTA</div>
              <p className="display-heading text-5xl text-text">{'< 24H'}</p>
              <p className="terminal-text text-text-dim text-sm mt-2">días laborables</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="section-label text-gold">IDEAL PARA</div>
              {[
                'Acceso al plan Institutional',
                'Demo personalizada del stack',
                'Evaluación de integración API',
                'Proyectos de investigación',
                'Colaboraciones institucionales',
              ].map(item => (
                <div key={item} className="flex items-start gap-2.5 terminal-text text-sm text-text-dim">
                  <span className="text-gold flex-shrink-0 mt-0.5">·</span>
                  {item}
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-8 flex flex-col gap-3">
              <div className="section-label text-gold mb-1">SOPORTE GENERAL</div>
              <a href="mailto:soporte@sigma-research.io" className="terminal-text text-sm text-text-dim hover:text-gold transition-colors">
                soporte@sigma-research.io
              </a>
              <Link href="/faq" className="terminal-text text-sm text-text-dim hover:text-gold transition-colors">
                → Ver preguntas frecuentes
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
