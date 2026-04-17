'use client'
import { useState } from 'react'

const tiers = [
  {
    name: 'TERMINAL',
    price: 'Gratis',
    period: '',
    description: 'Acceso básico a screeners y datos diferidos 15min.',
    features: [
      'Screener con 12 filtros',
      'Datos diferidos 15 min',
      'FIRE Calculator básico',
      'Alertas: 3/día',
    ],
    cta: 'CREAR CUENTA',
    highlight: false,
  },
  {
    name: 'PRO',
    price: '$49',
    period: '/mes',
    description: 'Acceso completo a PRO.MACD, señales en tiempo real y modelos ML.',
    features: [
      'Todo de TERMINAL',
      'PRO.MACD tiempo real',
      'Señales con probabilidad',
      'Régimen de mercado live',
      'Alertas ilimitadas',
      'FIRE Monte Carlo completo',
    ],
    cta: 'EMPEZAR PRO',
    highlight: true,
  },
  {
    name: 'INSTITUTIONAL',
    price: 'Custom',
    period: '',
    description: 'API completa, modelos personalizados y soporte dedicado.',
    features: [
      'Todo de PRO',
      'API acceso completo',
      'Todos los modelos ML',
      'HUD Portfolio Risk',
      'Backtesting personalizado',
      'Soporte dedicado',
    ],
    cta: 'CONTACTAR',
    highlight: false,
  },
]

export default function Cta() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) setSubmitted(true)
  }

  return (
    <section id="cta" className="bg-surface py-24 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-20 text-center">
          <div className="section-label text-gold mb-4">{'// ACCESO A LA PLATAFORMA'}</div>
          <h2 className="display-heading text-5xl sm:text-8xl text-text mb-6">
            EMPIEZA A
            <br />
            <span className="gold-text">OPERAR CON</span>
            <br />
            DATOS REALES
          </h2>
          <p className="terminal-text text-text-dim max-w-xl mx-auto">
            Accede a la misma infraestructura analítica que usan los mejores gestores de activos.
          </p>
        </div>

        {/* Pricing grid */}
        <div className="grid md:grid-cols-3 gap-px bg-border mb-20">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`p-8 flex flex-col gap-6 relative ${
                tier.highlight ? 'bg-bg animate-glow-pulse' : 'bg-bg'
              }`}
            >
              {tier.highlight && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold-gradient" />
              )}

              <div>
                <div className={`section-label mb-1 ${tier.highlight ? 'text-gold' : 'text-text-dim'}`}>
                  {tier.name}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`display-heading text-5xl ${tier.highlight ? 'gold-text' : 'text-text'}`}>
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="terminal-text text-text-dim">{tier.period}</span>
                  )}
                </div>
                <p className="terminal-text text-text-dim text-sm mt-2">{tier.description}</p>
              </div>

              <ul className="space-y-2.5 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 terminal-text text-sm text-text">
                    <span className={`flex-shrink-0 mt-0.5 ${tier.highlight ? 'text-gold' : 'text-text-dim'}`}>
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="#"
                className={`text-center display-heading text-xl tracking-widest py-3 transition-all duration-200 ${
                  tier.highlight
                    ? 'bg-gold text-bg hover:bg-gold-glow shadow-gold-lg'
                    : 'border border-border text-text-dim hover:border-gold hover:text-gold'
                }`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Email signup */}
        <div className="max-w-2xl mx-auto text-center">
          <div className="section-label text-gold mb-4">{'// LISTA DE ESPERA'}</div>
          <h3 className="display-heading text-4xl text-text mb-6">
            ACCESO ANTICIPADO
          </h3>

          {submitted ? (
            <div className="glass-card p-8">
              <div className="display-heading text-3xl text-gold mb-2">REGISTRADO</div>
              <p className="terminal-text text-text-dim">
                Te contactaremos en las próximas 48h con tu acceso.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-px">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="flex-1 bg-bg border border-border px-4 py-3 terminal-text text-text placeholder-text-dim focus:outline-none focus:border-gold transition-colors"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-gold text-bg display-heading text-lg tracking-widest hover:bg-gold-glow transition-colors whitespace-nowrap"
              >
                UNIRME
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
