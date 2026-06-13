import type { Metadata } from 'next'
import Link from 'next/link'
import EquityCurve from '@/app/components/landing/EquityCurve'
import LiveHeroCounter from '@/app/components/landing/LiveHeroCounter'
import SigmaDivider from '@/app/components/landing/SigmaDivider'
import EntityProfile from '@/app/components/landing/EntityProfile'
import FadeIn from '@/app/components/landing/FadeIn'

export const metadata: Metadata = {
  title: 'Quiénes Somos — Sigma Research',
  description:
    'Conoce el equipo y la misión de Sigma Research: democratizar las herramientas cuantitativas institucionales para inversores independientes.',
}

const valores = [
  {
    tag: 'V-01',
    name: 'RIGOR CUANTITATIVO',
    stat: '16M+ backtests validados',
    description:
      'Cada señal, modelo y métrica pasa por walk-forward out-of-sample testing. Nunca overfitting conveniente.',
  },
  {
    tag: 'V-02',
    name: 'TRANSPARENCIA',
    stat: 'Metodología publicada',
    description:
      'Publicamos hiperparámetros y resultados completos. Si un modelo falla en producción, lo documentamos.',
  },
  {
    tag: 'V-03',
    name: 'DATOS REALES',
    stat: '11 activos · tick data en vivo',
    description:
      'Tick data, order book, macro series. Sin proxies sintéticos ni supuestos optimistas.',
  },
  {
    tag: 'V-04',
    name: 'INDEPENDENCIA',
    stat: '0 posiciones propias',
    description:
      'No gestionamos capital de terceros. No operamos los activos que cubrimos. Solo la suscripción.',
  },
]

const redes = [
  {
    label: 'Discord',
    href: 'https://discord.gg/7T8FP9p4',
    desc: 'Comunidad de traders',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
  },
  {
    label: 'X / Twitter',
    href: 'https://x.com/SQuantDesk',
    desc: '@SQuantDesk',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: 'Telegram',
    href: 'https://t.me/+oFjTIa6CrstkMTJh',
    desc: 'Canal de señales',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/sigma-quant-desk-02b620403/',
    desc: 'Sigma Quant Desk',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
]

export default function QuienesSomosPage() {
  return (
    <main className="bg-bg min-h-screen">

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="pt-40 pb-20 px-6 bg-grid-pattern bg-grid relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />

        {/* Σ watermark */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 select-none pointer-events-none"
          aria-hidden
          style={{
            fontSize: 'clamp(18rem, 40vw, 38rem)',
            lineHeight: 1,
            color: 'rgba(212,175,55,0.03)',
            fontFamily: 'var(--font-bebas, "Bebas Neue", sans-serif)',
            userSelect: 'none',
            transform: 'translateY(-50%) translateX(18%)',
          }}
        >
          Σ
        </div>

        <div className="max-w-7xl mx-auto relative">
          <FadeIn>
            <div className="section-label text-gold mb-6">{'// SIGMA RESEARCH'}</div>

            <h1 className="display-heading text-[clamp(3.5rem,10vw,8rem)] text-text leading-[0.92] mb-10 max-w-4xl">
              LAS MEJORES<br />
              HERRAMIENTAS<br />
              <span className="gold-text">PARA TODOS.</span>
            </h1>

            <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-2xl mb-10">
              Un equipo de cuantitativos e ingenieros de datos con una convicción simple:
              el análisis institucional no debería estar reservado a quienes tienen un equipo
              de cuarenta quants detrás.
            </p>
          </FadeIn>

          {/* Live ticking counter */}
          <FadeIn delay={150} className="mb-10">
            <LiveHeroCounter />
          </FadeIn>

          {/* Inline stat pills */}
          <FadeIn delay={250}>
            <div className="flex flex-wrap gap-3">
              {[
                { v: '11',    l: 'Activos cubiertos' },
                { v: '100%',  l: 'OOS validation' },
                { v: '0',     l: 'Conflictos de interés' },
              ].map(({ v, l }) => (
                <div key={l} className="flex items-center gap-3 border border-gold/20 px-4 py-2 bg-surface/60 backdrop-blur-sm">
                  <span className="num text-gold font-bold text-base">{v}</span>
                  <span className="terminal-text text-text-dim text-xs">{l}</span>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── PERFIL OPERACIONAL ──────────────────────────────────────────── */}
      <section className="px-6 py-6 bg-bg border-t border-gold/10">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <EntityProfile />
          </FadeIn>
        </div>
      </section>

      {/* · σ · */}
      <div className="px-6 bg-bg">
        <div className="max-w-7xl mx-auto">
          <SigmaDivider />
        </div>
      </div>

      {/* ── EQUITY CURVE ────────────────────────────────────────────────── */}
      <section className="px-6 pb-6 bg-bg">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <EquityCurve />
          </FadeIn>
        </div>
      </section>

      {/* ── CTA PRINCIPAL ───────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-bg border-t border-gold/10">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
          <FadeIn>
            <div className="section-label text-gold mb-2">{'// ACCEDE AL MOTOR'}</div>

            <h2 className="display-heading text-[clamp(2.8rem,7vw,5.5rem)] text-text leading-[0.93] mb-4">
              EMPIEZA HOY.<br />
              <span className="gold-text">ES GRATIS.</span>
            </h2>

            <p className="terminal-text text-sm text-text-dim leading-relaxed max-w-md mb-6">
              Dashboard completo, modelos de régimen de mercado y señales en tiempo real
              para 11 activos — sin coste.
            </p>

            <Link
              href="/registro"
              className="bg-gold text-bg section-label px-10 py-4 hover:bg-gold-glow transition-colors duration-200 text-center text-base"
            >
              CREAR CUENTA GRATIS
            </Link>

            <p className="terminal-text text-[11px] text-muted mt-2">
              Sin tarjeta de crédito · Plan gratuito permanente · Cancela cuando quieras
            </p>
          </FadeIn>
        </div>
      </section>

      {/* · σ · */}
      <div className="px-6 bg-surface">
        <div className="max-w-7xl mx-auto">
          <SigmaDivider />
        </div>
      </div>

      {/* ── MISIÓN (compacta) ───────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-surface border-t border-gold/10">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="section-label text-gold mb-4">{'// MISIÓN'}</div>
            <blockquote className="border-l-2 border-gold pl-6 py-1 mb-8">
              <p className="display-heading text-[clamp(1.8rem,4vw,3rem)] text-text leading-tight">
                &ldquo;No vendemos señales.<br />
                <span className="gold-text">Proveemos infraestructura.&rdquo;</span>
              </p>
            </blockquote>
            <p className="terminal-text text-sm text-text-dim leading-relaxed max-w-2xl">
              Las herramientas cuantitativas de grado institucional — modelos de régimen, forecasting
              de volatilidad, análisis de factor investing — han estado reservadas a hedge funds con
              presupuestos de ocho cifras. Sigma Research construye ese mismo stack y lo pone al alcance
              de inversores independientes que no tienen un equipo de cuarenta quants detrás.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* · σ · */}
      <div className="px-6 bg-surface">
        <div className="max-w-7xl mx-auto">
          <SigmaDivider />
        </div>
      </div>

      {/* ── VALORES ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-surface border-t border-gold/10">
        <div className="max-w-7xl mx-auto">

          <FadeIn className="mb-12">
            <div className="section-label text-gold mb-4">{'// VALORES'}</div>
            <h2 className="display-heading text-[clamp(2.4rem,5vw,4.5rem)] text-text leading-[0.95]">
              LO QUE NOS <span className="gold-text">DEFINE</span>
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            {valores.map((v, i) => (
              <FadeIn key={v.tag} delay={i * 80}>
                <div className="bg-bg p-7 flex flex-col gap-4 group hover:bg-surface transition-colors duration-200 relative overflow-hidden h-full">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold opacity-30 group-hover:opacity-70 transition-opacity duration-200" />

                  <div className="relative flex items-center justify-between">
                    <span className="terminal-text text-[10px] text-gold border border-gold/20 px-2 py-0.5 tracking-widest">
                      {v.tag}
                    </span>
                  </div>

                  <h3 className="display-heading text-xl text-text group-hover:text-gold transition-colors duration-200 relative leading-tight">
                    {v.name}
                  </h3>

                  <div className="terminal-text text-[11px] text-gold/60 tracking-wider border-l border-gold/20 pl-3">
                    {v.stat}
                  </div>

                  <p className="terminal-text text-xs text-text-dim leading-relaxed relative">
                    {v.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>

        </div>
      </section>

      {/* ── COMUNIDAD ───────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-bg border-t border-gold/10">
        <div className="max-w-7xl mx-auto">

          <FadeIn className="mb-10">
            <div className="section-label text-gold mb-2">{'// COMUNIDAD'}</div>
            <p className="terminal-text text-sm text-text-dim">Únete donde operas tú.</p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            {redes.map((r) => (
              <a
                key={r.label}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-surface p-8 flex flex-col gap-5 group hover:bg-gold/5 transition-colors duration-200 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gold/0 group-hover:bg-gold/30 transition-colors duration-300" />
                <div className="text-text-dim group-hover:text-gold transition-colors duration-200">
                  {r.icon}
                </div>
                <div>
                  <div className="display-heading text-2xl text-text group-hover:text-gold transition-colors duration-200">
                    {r.label}
                  </div>
                  <div className="terminal-text text-xs text-text-dim mt-1">{r.desc}</div>
                </div>
                <span className="terminal-text text-xs text-gold mt-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200 tracking-widest">
                  IR A {r.label.toUpperCase()} →
                </span>
              </a>
            ))}
          </div>

          {/* Secondary CTA — lighter, for those who scrolled this far */}
          <FadeIn delay={100}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border border-gold/15 bg-surface/50 px-8 py-5">
              <p className="terminal-text text-sm text-text-dim">
                ¿Listo para operar con datos institucionales?
              </p>
              <Link
                href="/registro"
                className="border border-gold text-gold section-label px-6 py-2.5 hover:bg-gold hover:text-bg transition-colors duration-200 text-center flex-shrink-0 text-xs"
              >
                CREAR CUENTA GRATIS →
              </Link>
            </div>
          </FadeIn>

        </div>
      </section>

    </main>
  )
}
