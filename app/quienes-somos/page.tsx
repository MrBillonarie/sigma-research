import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Quiénes Somos — Sigma Research',
  description:
    'Conoce el equipo y la misión de Sigma Research: democratizar las herramientas cuantitativas institucionales para inversores independientes.',
}

const valores = [
  {
    tag: 'V-01',
    name: 'RIGOR CUANTITATIVO',
    description:
      'Cada señal, modelo y métrica pasa por validación estadística rigurosa. Usamos walk-forward out-of-sample testing como estándar mínimo, nunca overfitting conveniente.',
  },
  {
    tag: 'V-02',
    name: 'TRANSPARENCIA',
    description:
      'Publicamos metodologías, hiperparámetros y resultados de backtest completos. Si un modelo falla en producción, lo documentamos y lo comunicamos.',
  },
  {
    tag: 'V-03',
    name: 'DATOS REALES',
    description:
      'Trabajamos exclusivamente con datos de mercado reales: tick data, order book, filings SEC, macro series. Sin proxies sintéticos ni supuestos optimistas.',
  },
  {
    tag: 'V-04',
    name: 'INDEPENDENCIA',
    description:
      'Sin conflictos de interés. No gestionamos capital de terceros ni operamos las mismas posiciones que recomendamos. Nuestra única fuente de ingresos es la suscripción.',
  },
]

const redes = [
  {
    label: 'Discord',
    href: 'https://discord.gg/6gdN5rNH',
    desc: 'Comunidad de traders',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
  },
  {
    label: 'X / Twitter',
    href: 'https://x.com/SQuantDesk',
    desc: '@SQuantDesk',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    label: 'Telegram',
    href: 'https://t.me/+oFjTIa6CrstkMTJh',
    desc: 'Canal de señales',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/sigma-quant-desk-02b620403/',
    desc: 'Sigma Quant Desk',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
]

export default function QuienesSomosPage() {
  return (
    <main className="bg-bg min-h-screen">

      {/* ── HERO ── */}
      <section className="pt-40 pb-24 px-6 bg-grid-pattern bg-grid relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="section-label text-gold mb-6">{'// SIGMA RESEARCH'}</div>
          <h1 className="display-heading text-6xl sm:text-8xl lg:text-[9rem] text-text leading-none mb-8">
            QUIÉNES
            <br />
            <span className="gold-text">SOMOS</span>
          </h1>
          <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-xl">
            Un equipo de cuantitativos e ingenieros de datos con una convicción simple:
            las mejores herramientas analíticas no deberían ser exclusivas de los grandes fondos.
          </p>
        </div>
      </section>

      {/* ── MISIÓN ── */}
      <section className="py-24 px-6 bg-surface">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="section-label text-gold mb-4">{'// MISIÓN'}</div>
            <h2 className="display-heading text-5xl sm:text-7xl text-text mb-6">
              DEMOCRATIZAR
              <br />
              <span className="gold-text">EL EDGE</span>
              <br />
              INSTITUCIONAL
            </h2>
          </div>
          <div className="flex flex-col gap-5">
            <p className="terminal-text text-text-dim leading-relaxed">
              Durante décadas, las herramientas cuantitativas de alto rendimiento —modelos de
              regímenes de mercado, forecasting de volatilidad, análisis de factor investing— han
              estado reservadas a hedge funds y mesas propietarias con presupuestos de ocho cifras.
            </p>
            <p className="terminal-text text-text-dim leading-relaxed">
              Sigma Research nació para cambiar eso. Construimos y mantenemos un stack analítico
              de grado institucional y lo ponemos al alcance de inversores independientes,
              family offices y equipos de gestión que no tienen un equipo de 40 quants detrás.
            </p>
            <p className="terminal-text text-text-dim leading-relaxed">
              No vendemos señales. Proveemos infraestructura: modelos, datos, y el contexto
              estadístico para interpretar ambos con rigor.
            </p>
          </div>
        </div>
      </section>

      {/* ── VALORES ── */}
      <section className="py-24 px-6 bg-bg">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="section-label text-gold mb-4">{'// VALORES'}</div>
            <h2 className="display-heading text-5xl sm:text-7xl text-text">
              LO QUE NOS
              <br />
              <span className="gold-text">DEFINE</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            {valores.map((v) => (
              <div key={v.tag} className="bg-surface p-6 flex flex-col gap-4 group hover:bg-surface/80 transition-colors">
                <span className="terminal-text text-xs text-gold border border-gold/20 px-2 py-0.5 self-start">
                  {v.tag}
                </span>
                <h3 className="display-heading text-2xl text-text group-hover:text-gold transition-colors">
                  {v.name}
                </h3>
                <p className="terminal-text text-sm text-text-dim leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REDES SOCIALES ── */}
      <section className="py-24 px-6 bg-bg border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="mb-14">
            <div className="section-label text-gold mb-4">{'// COMUNIDAD'}</div>
            <h2 className="display-heading text-5xl sm:text-7xl text-text">
              ÚNETE A
              <br />
              <span className="gold-text">LA COMUNIDAD</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            {redes.map((r) => (
              <a
                key={r.label}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-surface p-8 flex flex-col gap-5 group hover:bg-gold/5 transition-colors duration-200"
              >
                <div className="text-text-dim group-hover:text-gold transition-colors duration-200">
                  {r.icon}
                </div>
                <div>
                  <div className="display-heading text-2xl text-text group-hover:text-gold transition-colors duration-200">
                    {r.label}
                  </div>
                  <div className="terminal-text text-xs text-text-dim mt-1">{r.desc}</div>
                </div>
                <span className="terminal-text text-xs text-gold mt-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Ir a {r.label} →
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 bg-surface border-t border-border">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-8">
          <div className="section-label text-gold">{'// ÚNETE A LA PLATAFORMA'}</div>
          <h2 className="display-heading text-5xl sm:text-7xl text-text">
            EMPIEZA A
            <br />
            <span className="gold-text">OPERAR</span>
            <br />
            CON DATOS
          </h2>
          <p className="terminal-text text-text-dim leading-relaxed">
            Crea tu cuenta gratuita y accede al dashboard completo, la calculadora FIRE y los modelos
            de régimen de mercado sin coste.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/registro"
              className="bg-gold text-bg section-label px-8 py-3 hover:bg-gold-glow transition-colors duration-200"
            >
              CREAR CUENTA GRATIS
            </Link>
            <Link
              href="/faq"
              className="border border-border text-text-dim section-label px-8 py-3 hover:border-gold hover:text-gold transition-colors duration-200"
            >
              VER FAQ
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}
