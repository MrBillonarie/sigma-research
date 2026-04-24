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

const equipo = [
  {
    initials: 'AR',
    name: 'Alejandro Ríos',
    role: 'Fundador & Quant Lead',
    bio: 'Ex-desk quant en banco de inversión europeo. 10 años modelando volatilidad y regímenes de mercado. PhD en Economía Financiera.',
  },
  {
    initials: 'CM',
    name: 'Carla Mendoza',
    role: 'Data & ML Engineer',
    bio: 'Especialista en pipelines de datos financieros de alta frecuencia. Background en HFT y machine learning aplicado a series temporales.',
  },
  {
    initials: 'DS',
    name: 'Daniel Solano',
    role: 'Research Analyst',
    bio: 'CFA charterholder y analista macro. Cubre estrategias de factor investing, rotación sectorial y análisis de ciclo económico.',
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

      {/* ── EQUIPO ── */}
      <section className="py-24 px-6 bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <div className="section-label text-gold mb-4">{'// EQUIPO'}</div>
            <h2 className="display-heading text-5xl sm:text-7xl text-text">
              LAS PERSONAS
              <br />
              <span className="gold-text">DETRÁS</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-border">
            {equipo.map((m) => (
              <div key={m.name} className="bg-bg p-8 flex flex-col gap-5">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-full border border-gold/40 flex items-center justify-center bg-surface shadow-gold">
                  <span className="display-heading text-2xl text-gold">{m.initials}</span>
                </div>
                <div>
                  <div className="display-heading text-2xl text-text">{m.name}</div>
                  <div className="section-label text-gold mt-1">{m.role}</div>
                </div>
                <p className="terminal-text text-sm text-text-dim leading-relaxed">{m.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 bg-bg border-t border-border">
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
            Crea tu cuenta gratuita y accede al screener, la calculadora FIRE y los modelos
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
              href="/#modelos"
              className="border border-border text-text-dim section-label px-8 py-3 hover:border-gold hover:text-gold transition-colors duration-200"
            >
              VER MODELOS
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}
