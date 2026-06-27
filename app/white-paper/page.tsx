import type { Metadata } from 'next'
import Link from 'next/link'
import FadeIn from '@/app/components/landing/FadeIn'
import SigmaDivider from '@/app/components/landing/SigmaDivider'
import DownloadWhitePaperPdf from './DownloadWhitePaperPdf'

export const metadata: Metadata = {
  title: 'White Paper — SQuant Desk',
  description:
    'Arquitectura, metodología cuantitativa, gestión de riesgo y track record del motor SIGMA: cómo se valida una estrategia antes de arriesgar capital real.',
}

const BINANCE_LEAD_URL = 'https://www.binance.com/es-LA/copy-trading/lead-details/5096369356136167936'

// ─── Índice ─────────────────────────────────────────────────────────────────
const INDEX = [
  { id: 'resumen',     label: '01 · Resumen ejecutivo' },
  { id: 'problema',    label: '02 · El problema' },
  { id: 'arquitectura',label: '03 · Arquitectura' },
  { id: 'metodologia', label: '04 · Metodología' },
  { id: 'riesgo',      label: '05 · Gestión de riesgo' },
  { id: 'track',       label: '06 · Track record' },
  { id: 'participar',  label: '07 · Cómo participar' },
  { id: 'compliance',  label: '08 · Compliance y custodia' },
  { id: 'roadmap',     label: '09 · Roadmap' },
  { id: 'riesgos',     label: '10 · Disclaimers' },
]

// ─── 02 El problema ─────────────────────────────────────────────────────────
const PROBLEMA = [
  {
    tag: 'P-01',
    title: 'SESGO DE SELECCIÓN',
    description:
      'Probar cientos de variantes y quedarse con la que mejor resultado dio en el pasado (in-sample) sobreestima su ventaja real fuera de muestra.',
  },
  {
    tag: 'P-02',
    title: 'SIN VALIDACIÓN OOS',
    description:
      'Sin walk-forward testing no hay forma de distinguir una ventaja estadística real de una coincidencia del período probado.',
  },
  {
    tag: 'P-03',
    title: 'RIESGO DISCRECIONAL',
    description:
      'Sin reglas duras de tamaño de posición y drawdown máximo, una racha mala se convierte en pérdida de cuenta.',
  },
]

// ─── 03 Arquitectura ────────────────────────────────────────────────────────
const MOTORES = [
  {
    tag: 'MOTOR 1',
    title: 'CRIPTO',
    stat: 'BTC · ETH · SOL · BNB · LTC',
    description:
      'Perpetuos USDT-M. Universo cerrado a propósito — más activos no es más edge, es más ruido y más superficie de fallo.',
  },
  {
    tag: 'MOTOR 2',
    title: 'COMMODITIES',
    stat: 'XAU · XAG · WTI · HG · NG · PL',
    description:
      'Oro, plata, petróleo WTI, cobre, gas natural y platino. Mismo pipeline de validación, distinto régimen de mercado — diversificador real, no solo nominal.',
  },
]

// ─── 04 Metodología — robustness gate ──────────────────────────────────────
const GATES = [
  {
    tag: 'G-01',
    title: 'WALK-FORWARD',
    description: 'Validación fuera de muestra, no solo el período de optimización.',
  },
  {
    tag: 'G-02',
    title: 'SELECTION BIAS',
    description: 'La ventaja de la mejor variante entre N probadas se ajusta hacia abajo — parte de ese resultado es artefacto de la búsqueda misma.',
  },
  {
    tag: 'G-03',
    title: 'APUESTAS INDEPENDIENTES',
    description: 'PCA sobre el conjunto de estrategias activas para evitar la falsa sensación de diversificación.',
  },
  {
    tag: 'G-04',
    title: 'PERTURBACIÓN ADVERSARIAL',
    description: 'Slippage simulado más agresivo que el real, para confirmar que la ventaja no depende de ejecución perfecta.',
  },
  {
    tag: 'G-05',
    title: 'TECHOS DE SANIDAD',
    description: 'Métricas fuera de rango físicamente razonable se descartan automáticamente como señal de bug, no de buena suerte.',
  },
  {
    tag: 'G-06',
    title: 'KELLY FRACCIONADO',
    description: 'Position sizing por fracción de Kelly, reducido a la mitad cuando una estrategia aún no acumula historial en vivo.',
  },
]

// ─── 05 Gestión de riesgo ───────────────────────────────────────────────────
const RIESGOS_GATES = [
  {
    tag: 'R-01',
    title: 'CIRCUIT BREAKER',
    description: 'Corta la operación automáticamente tras pérdidas consecutivas o drawdown que excede el umbral definido.',
  },
  {
    tag: 'R-02',
    title: 'CORRELACIÓN CROSS-MOTOR',
    description: 'Evita acumular el mismo riesgo direccional disfrazado de diversificación entre Motor 1 y Motor 2.',
  },
  {
    tag: 'R-03',
    title: 'FUNDING-RATE GATE',
    description: 'En perpetuos, funding desfavorable persistente penaliza o suspende la estrategia.',
  },
  {
    tag: 'R-04',
    title: 'HRP',
    description: 'Hierarchical Risk Parity — el capital se distribuye entre estrategias activas ponderando por riesgo, no por convicción.',
  },
]

// ─── 07 Comunidad / canales ─────────────────────────────────────────────────
const CANALES = [
  {
    label: 'Telegram',
    href: 'https://t.me/+oFjTIa6CrstkMTJh',
    desc: 'Noticias y señales',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    label: 'Discord',
    href: 'https://discord.gg/7T8FP9p4',
    desc: 'Comunidad de traders',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
  },
  {
    label: 'X / Twitter',
    href: 'https://x.com/SQuantDesk',
    desc: '@SQuantDesk',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/sigma-quant-desk-02b620403/',
    desc: 'Sigma Quant Desk',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: 'WhatsApp',
    href: 'https://wa.me/',
    desc: 'Canal directo',
    icon: (
      <svg width="24" height="24" viewBox="0 0 448 512" fill="currentColor">
        <path d="M380.9 97.1C339 55.1 283.2 32 224.4 32c-122 0-221 99-221 221.1c0 39 10.2 77 29.6 110.5L1 480l118.7-31.1c32.3 17.6 68.7 26.9 105.6 26.9h.1c121.9 0 221-99 221.1-221.1c0-59-23-114.5-65.6-156.6zM224.4 438.2h-.1c-32.9 0-65.1-8.8-93.1-25.5l-6.7-4-69.8 18.3L73.4 359l-4.4-7c-18.4-29.3-28.1-63.1-28.1-97.9c0-101.7 82.8-184.5 184.6-184.5c49.3 0 95.6 19.2 130.4 54.1c34.8 34.9 56.2 81.2 56.1 130.5c0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18c-5.1-1.9-8.8-2.8-12.5 2.8c-3.7 5.6-14.3 18-17.6 21.8c-3.2 3.7-6.5 4.2-12 1.4c-32.6-16.3-54-29.1-75.5-66c-5.7-9.8 5.7-9.1 16.3-30.3c1.8-3.7.9-6.9-.6-9.7c-1.5-2.8-13.4-32.3-18.3-44.2c-4.8-11.6-9.7-10-13.3-10.2c-3.4-.2-7.3-.2-11.2-.2c-3.9 0-10.2 1.5-15.6 7.3c-5.4 5.8-20.6 20.1-20.6 49c0 28.9 21 56.9 23.9 60.8c2.9 3.9 39.7 60.6 96.2 82.6c47.9 18.6 57.7 14.9 68.1 13.9c10.4-1 33.8-13.8 38.5-27.2c4.7-13.4 4.7-24.9 3.3-27.2c-1.4-2.3-5.1-3.7-10.6-6.5z" />
      </svg>
    ),
  },
  {
    label: 'Binance Copy Trading',
    href: BINANCE_LEAD_URL,
    desc: 'Lead Trader oficial',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2 14.5 4.5 12 7 9.5 4.5zM6 8l2.5 2.5L6 13 3.5 10.5zM18 8l2.5 2.5L18 13l-2.5-2.5zM12 9.5 14.5 12 12 14.5 9.5 12zM6 15l2.5 2.5L6 20l-2.5-2.5zM18 15l2.5 2.5L18 20l-2.5-2.5zM12 16.5 14.5 19 12 21.5 9.5 19z" />
      </svg>
    ),
  },
  {
    label: 'squantdesk.com',
    href: 'https://squantdesk.com',
    desc: 'HUD, modelos y reportes',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
]

export default function WhitePaperPage() {
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
            <div className="section-label text-gold mb-6">{'// SIGMA ENGINE'}</div>
            <h1 className="display-heading text-[clamp(3.5rem,10vw,8rem)] text-text leading-[0.92] mb-8 max-w-4xl">
              WHITE PAPER<br />
              <span className="gold-text">DEL MOTOR.</span>
            </h1>
            <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-2xl mb-10">
              Arquitectura, metodología cuantitativa y gestión de riesgo de SIGMA — cómo se
              valida una estrategia antes de que arriesgue un solo dólar de capital real.
            </p>
          </FadeIn>

          <FadeIn delay={150}>
            <div className="flex flex-wrap items-center gap-3">
              {[
                { v: 'v1.0',  l: 'Junio 2026' },
                { v: '2',     l: 'Motores activos' },
                { v: '17/06', l: 'Capital real desde' },
              ].map(({ v, l }) => (
                <div key={l} className="flex items-center gap-3 border border-gold/20 px-4 py-2 bg-surface/60 backdrop-blur-sm">
                  <span className="num text-gold font-bold text-base">{v}</span>
                  <span className="terminal-text text-text-dim text-xs">{l}</span>
                </div>
              ))}
              <DownloadWhitePaperPdf />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── ÍNDICE + RESUMEN ───────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-bg border-t border-gold/10">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[220px_1fr] gap-12 items-start">

          <nav className="hidden lg:flex flex-col gap-1 sticky top-24">
            <div className="section-label text-gold mb-3">ÍNDICE</div>
            {INDEX.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="terminal-text text-xs text-text-dim hover:text-gold transition-colors py-1"
              >
                {s.label}
              </a>
            ))}
          </nav>

          <div id="resumen" className="scroll-mt-24">
            <FadeIn>
              <div className="section-label text-gold mb-4">{'// 01 · RESUMEN EJECUTIVO'}</div>
              <h2 className="display-heading text-[clamp(2rem,4.5vw,3.2rem)] text-text leading-[0.98] mb-8 max-w-3xl">
                DISCIPLINA CUANTITATIVA,<br /><span className="gold-text">NO DISCRECIÓN.</span>
              </h2>
              <div className="flex flex-col gap-5 max-w-3xl">
                <p className="terminal-text text-sm text-text-dim leading-relaxed">
                  SIGMA es un motor de trading cuantitativo multi-activo construido y operado por un grupo pequeño de traders
                  profesionales junto a un equipo de agentes de IA que cubren investigación, ejecución, riesgo
                  e infraestructura. No es un bot de señales ni un indicador: es un sistema completo de
                  generación, validación y ejecución de estrategias, con capital real desde el 17 de junio de 2026.
                </p>
                <div className="border-l-2 border-gold/50 pl-6 py-1">
                  <p className="terminal-text text-sm text-text leading-relaxed">
                    La mayoría de los traders retail no pierde por falta de buenas ideas, sino por
                    ausencia de proceso. SIGMA reemplaza la discrecionalidad por un proceso sistemático,
                    auditable y con gates explícitos antes de arriesgar capital.
                  </p>
                </div>
                <p className="terminal-text text-sm text-text-dim leading-relaxed">
                  La misión de fondo es la autocustodia: cada ciclo de ganancias está diseñado para
                  eventualmente retirarse a cold storage. <span className="text-gold">Not your keys, not your coins.</span>
                </p>
              </div>
            </FadeIn>
          </div>

        </div>
      </section>

      <div className="px-6 bg-surface"><div className="max-w-7xl mx-auto"><SigmaDivider /></div></div>

      {/* ── 02 EL PROBLEMA ─────────────────────────────────────────────── */}
      <section id="problema" className="py-20 px-6 bg-surface scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="mb-12">
            <div className="section-label text-gold mb-4">{'// 02 · EL PROBLEMA'}</div>
            <h2 className="display-heading text-[clamp(2.2rem,4.5vw,3.5rem)] text-text leading-[0.98]">
              POR QUÉ FALLA EL <span className="gold-text">TRADER PROMEDIO</span>
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-px bg-border">
            {PROBLEMA.map((p, i) => (
              <FadeIn key={p.tag} delay={i * 80}>
                <div className="bg-bg p-7 flex flex-col gap-4 h-full border-l-2 border-transparent hover:border-gold/60 transition-colors relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-gold/40 via-gold/10 to-transparent" />
                  <span className="terminal-text text-[10px] text-gold border border-gold/20 px-2 py-0.5 tracking-widest w-fit">
                    {p.tag}
                  </span>
                  <h3 className="display-heading text-lg text-text leading-tight">{p.title}</h3>
                  <p className="terminal-text text-xs text-text-dim leading-relaxed">{p.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── 03 ARQUITECTURA ────────────────────────────────────────────── */}
      <section id="arquitectura" className="py-20 px-6 bg-bg border-t border-gold/10 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="mb-12">
            <div className="section-label text-gold mb-4">{'// 03 · ARQUITECTURA DEL MOTOR'}</div>
            <h2 className="display-heading text-[clamp(2.2rem,4.5vw,3.5rem)] text-text leading-[0.98] mb-6">
              DOS MOTORES, <span className="gold-text">UN MISMO ESTÁNDAR.</span>
            </h2>
            <p className="terminal-text text-sm text-text-dim leading-relaxed max-w-2xl">
              SIGMA corre dos motores en paralelo, cada uno con su propio universo de activos,
              pipeline de optimización y gates de riesgo. Cada combinación activo/timeframe/dirección
              se trata como un slot independiente, optimizado de forma continua mediante búsqueda
              bayesiana (Optuna) corriendo 24/7. Un regime gate, basado en EMA200 de referencia
              semanal, determina si el contexto de mercado favorece tendencia, reversión, o ninguna
              estrategia activa.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-px bg-border">
            {MOTORES.map((m, i) => (
              <FadeIn key={m.tag} delay={i * 100}>
                <div className="bg-surface p-8 flex flex-col gap-5 h-full relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-gold/40 via-gold/10 to-transparent" />
                  <span className="terminal-text text-[10px] text-gold border border-gold/20 px-2 py-0.5 tracking-widest w-fit">
                    {m.tag}
                  </span>
                  <h3 className="display-heading text-2xl text-text leading-tight">{m.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="w-px h-4 bg-gold/40 shrink-0" />
                    <span className="terminal-text text-[11px] text-gold tracking-wider font-medium">{m.stat}</span>
                  </div>
                  <p className="terminal-text text-xs text-text-dim leading-relaxed mt-auto">{m.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <div className="px-6 bg-bg"><div className="max-w-7xl mx-auto"><SigmaDivider /></div></div>

      {/* ── 04 METODOLOGÍA ─────────────────────────────────────────────── */}
      <section id="metodologia" className="py-20 px-6 bg-bg scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="mb-12">
            <div className="section-label text-gold mb-4">{'// 04 · METODOLOGÍA'}</div>
            <h2 className="display-heading text-[clamp(2.2rem,4.5vw,3.5rem)] text-text leading-[0.98] mb-6">
              EL <span className="gold-text">ROBUSTNESS GATE</span>
            </h2>
            <p className="terminal-text text-sm text-text-dim leading-relaxed max-w-2xl">
              Ninguna estrategia llega a producción solo por tener buen resultado en backtest.
              Antes de ser candidata a &quot;champion&quot; de su slot, debe sobrevivir seis filtros:
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {GATES.map((g, i) => (
              <FadeIn key={g.tag} delay={i * 60}>
                <div className="bg-surface p-7 flex flex-col gap-4 h-full group hover:bg-bg transition-colors border-l-2 border-transparent hover:border-gold/60">
                  <span className="terminal-text text-[10px] text-gold border border-gold/20 px-2 py-0.5 tracking-widest w-fit">
                    {g.tag}
                  </span>
                  <h3 className="display-heading text-base text-text group-hover:text-gold transition-colors leading-tight">
                    {g.title}
                  </h3>
                  <p className="terminal-text text-xs text-text-dim leading-relaxed">{g.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={120}>
            <p className="terminal-text text-xs text-text-dim leading-relaxed mt-8 max-w-2xl">
              Long y short pueden coexistir como champions independientes del mismo slot — en lugar
              de forzar un único ganador por activo y timeframe.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── 05 GESTIÓN DE RIESGO ───────────────────────────────────────── */}
      <section id="riesgo" className="py-20 px-6 bg-surface border-t border-gold/10 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="mb-12">
            <div className="section-label text-gold mb-4">{'// 05 · GESTIÓN DE RIESGO'}</div>
            <h2 className="display-heading text-[clamp(2.2rem,4.5vw,3.5rem)] text-text leading-[0.98]">
              CUATRO CAPAS DE <span className="gold-text">CONTENCIÓN</span>
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border mb-10">
            {RIESGOS_GATES.map((r, i) => (
              <FadeIn key={r.tag} delay={i * 70}>
                <div className="bg-bg p-7 flex flex-col gap-4 h-full border-l-2 border-transparent hover:border-gold/60 transition-colors">
                  <span className="terminal-text text-[10px] text-gold border border-gold/20 px-2 py-0.5 tracking-widest w-fit">
                    {r.tag}
                  </span>
                  <h3 className="display-heading text-base text-text leading-tight">{r.title}</h3>
                  <p className="terminal-text text-xs text-text-dim leading-relaxed">{r.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={150}>
            <div className="border border-gold/20 bg-bg/60 px-8 py-6 max-w-3xl">
              <span className="terminal-text text-[10px] text-gold tracking-widest">REGLA DE GOBERNANZA</span>
              <p className="terminal-text text-sm text-text mt-2 leading-relaxed">
                El riesgo nunca se ajusta para cumplir una meta o una fecha. La disciplina del
                proceso pesa más que el calendario.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      <div className="px-6 bg-bg"><div className="max-w-7xl mx-auto"><SigmaDivider /></div></div>

      {/* ── 06 TRACK RECORD ────────────────────────────────────────────── */}
      <section id="track" className="py-20 px-6 bg-bg scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="mb-10">
            <div className="section-label text-gold mb-4">{'// 06 · TRACK RECORD'}</div>
            <h2 className="display-heading text-[clamp(2.2rem,4.5vw,3.5rem)] text-text leading-[0.98] mb-8">
              VERIFICABLE, <span className="gold-text">NO PROYECTADO.</span>
            </h2>
          </FadeIn>

          <FadeIn delay={80}>
            <div className="flex flex-col gap-5 max-w-3xl mb-10">
              <p className="terminal-text text-sm text-text-dim leading-relaxed">
                <span className="text-text">Paper trading</span> — el sistema no pasa a ejecutar con dinero real
                hasta cumplir, todos a la vez: mínimo 30 trades cerrados, mínimo 21 días de observación,
                win rate ≥55% y profit factor ≥1.5. El motor superó los cuatro gates antes de recibir luz verde.
              </p>
              <p className="terminal-text text-sm text-text-dim leading-relaxed">
                <span className="text-text">Capital real</span> — activo desde el 17 de junio de 2026, sobre una
                cuenta profesional de Binance habilitada como Lead Trader, con $550.51 USDT de capital inicial.
                Es, deliberadamente, una etapa temprana — días de operación real, no años — y se presenta como
                tal, sin proyectar ese desempeño hacia el futuro.
              </p>
              <p className="terminal-text text-xs text-text-dim/80 leading-relaxed italic">
                No se publican aquí cifras de PnL en vivo porque este documento es estático y esas cifras
                cambian todos los días. La fuente de verdad es siempre el HUD público y el perfil de
                Binance — nunca un número congelado en una página.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={160}>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/hud"
                className="border border-gold text-gold section-label px-6 py-2.5 hover:bg-gold hover:text-bg transition-colors duration-200 text-center text-xs"
              >
                VER HUD EN VIVO →
              </Link>
              <a
                href={BINANCE_LEAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-gold/30 text-text-dim section-label px-6 py-2.5 hover:border-gold hover:text-gold transition-colors duration-200 text-center text-xs"
              >
                PERFIL BINANCE LEAD TRADER →
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── 07 CÓMO PARTICIPAR ─────────────────────────────────────────── */}
      <section id="participar" className="py-20 px-6 bg-surface border-t border-gold/10 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="mb-10">
            <div className="section-label text-gold mb-4">{'// 07 · CÓMO PARTICIPAR'}</div>
            <h2 className="display-heading text-[clamp(2.2rem,4.5vw,3.5rem)] text-text leading-[0.98] mb-6">
              UN SOLO CAMINO <span className="gold-text">SOPORTADO.</span>
            </h2>
            <p className="terminal-text text-sm text-text-dim leading-relaxed max-w-2xl">
              La única forma soportada de replicar las operaciones de SIGMA es el Copy Trading
              oficial de Binance, buscando al Lead Trader del proyecto dentro de la app.
            </p>
          </FadeIn>

          <FadeIn delay={80}>
            <div className="border border-gold/20 bg-bg/60 px-8 py-6 max-w-3xl mb-12">
              <span className="terminal-text text-[10px] text-gold tracking-widest">RECOMENDACIÓN OPERATIVA</span>
              <p className="terminal-text text-sm text-text mt-2 leading-relaxed">
                Configura la copia en modalidad <span className="text-gold">Fixed Ratio (%)</span>, no Fixed
                Amount ($) — replica el riesgo proporcional real del Lead Trader en vez de un monto
                fijo desalineado del tamaño de cada posición.
              </p>
            </div>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            {CANALES.map((c, i) => (
              <FadeIn key={c.label} delay={i * 60}>
                <a
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-bg p-7 flex flex-col gap-5 group hover:bg-gold/5 transition-colors duration-200 relative overflow-hidden border-b-2 border-transparent hover:border-gold/40 h-full"
                >
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/0 group-hover:via-gold/40 to-transparent transition-all duration-300" />
                  <div className="w-11 h-11 border border-gold/20 group-hover:border-gold/50 flex items-center justify-center text-text-dim group-hover:text-gold transition-all duration-200">
                    {c.icon}
                  </div>
                  <div className="flex-1">
                    <div className="display-heading text-lg text-text group-hover:text-gold transition-colors duration-200">
                      {c.label}
                    </div>
                    <div className="terminal-text text-xs text-text-dim mt-1">{c.desc}</div>
                  </div>
                  <span className="terminal-text text-[10px] text-gold tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    ABRIR →
                  </span>
                </a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── 08 COMPLIANCE Y CUSTODIA ───────────────────────────────────── */}
      <section id="compliance" className="py-20 px-6 bg-bg border-t border-gold/10 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="section-label text-gold mb-4">{'// 08 · COMPLIANCE Y CUSTODIA'}</div>
            <h2 className="display-heading text-[clamp(2.2rem,4.5vw,3.5rem)] text-text leading-[0.98] mb-8">
              NUNCA CUSTODIAMOS <span className="gold-text">TUS LLAVES.</span>
            </h2>
            <div className="border border-gold/20 bg-surface px-8 py-7 max-w-3xl flex flex-col gap-4">
              <p className="terminal-text text-sm text-text leading-relaxed">
                SIGMA <span className="text-gold">nunca solicita ni almacena</span> las API keys de Binance de
                terceros para operar en su nombre. Toda réplica de operaciones de la comunidad pasa
                exclusivamente por el producto de Copy Trading regulado de Binance — el exchange es
                quien custodia esa relación, no SIGMA.
              </p>
              <p className="terminal-text text-xs text-text-dim leading-relaxed">
                Esta es una decisión de diseño, no solo una restricción técnica: minimiza la superficie
                de riesgo legal y operacional, y evita que el proyecto custodie secretos de terceros
                que no necesita custodiar para cumplir su función.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── 09 ROADMAP ──────────────────────────────────────────────────── */}
      <section id="roadmap" className="py-16 px-6 bg-surface border-t border-gold/10 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border border-gold/15 bg-bg/50 px-8 py-7">
              <div>
                <div className="section-label text-gold mb-2">{'// 09 · ROADMAP'}</div>
                <p className="terminal-text text-sm text-text-dim max-w-xl">
                  La hoja de ruta completa, con hitos medibles y su estado actual, vive en una página
                  dedicada y se actualiza con más frecuencia que este documento.
                </p>
              </div>
              <Link
                href="/roadmap"
                className="border border-gold text-gold section-label px-6 py-2.5 hover:bg-gold hover:text-bg transition-colors duration-200 text-center flex-shrink-0 text-xs"
              >
                VER ROADMAP →
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA FINAL — COPY TRADING ───────────────────────────────────── */}
      <section className="py-28 px-6 bg-grid-pattern bg-grid relative overflow-hidden border-t border-gold/10">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <FadeIn>
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="section-label text-gold mb-6">{'// ÚNETE AL MOTOR'}</div>
                <h2 className="display-heading text-[clamp(2.6rem,7vw,5.5rem)] text-text leading-[0.95] mb-6">
                  COPIA EL MOTOR.<br />
                  <span className="gold-text">NO LA SUERTE.</span>
                </h2>
                <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-md mb-8">
                  Cada operación que copias pasó por el mismo robustness gate descrito en este
                  documento — gates de validación antes de un solo dólar, no convicción discrecional.
                  Configura Fixed Ratio (%) al copiar para replicar el riesgo real del Lead Trader.
                </p>
                <div className="flex flex-wrap gap-4">
                  <a
                    href={BINANCE_LEAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-gold text-gold section-label px-6 py-2.5 hover:bg-gold hover:text-bg transition-colors duration-200 text-center text-xs"
                  >
                    COPIAR EN BINANCE →
                  </a>
                  <DownloadWhitePaperPdf className="border border-gold/30 text-text-dim section-label px-6 py-2.5 hover:border-gold hover:text-gold transition-colors duration-200 text-center text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px bg-gold/10">
                {[
                  { v: '6',   l: 'Gates de robustez por estrategia' },
                  { v: '4',   l: 'Capas de gestión de riesgo' },
                  { v: '2',   l: 'Motores corriendo en paralelo' },
                  { v: '0',   l: 'Tu API key, nunca custodiada' },
                ].map(({ v, l }) => (
                  <div key={l} className="bg-bg/80 p-6 flex flex-col gap-2">
                    <span className="num text-gold font-bold text-3xl">{v}</span>
                    <span className="terminal-text text-text-dim text-xs leading-snug">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── 10 DISCLAIMERS ─────────────────────────────────────────────── */}
      <section id="riesgos" className="py-16 px-6 bg-bg scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <FadeIn>
            <div className="section-label text-text-dim mb-4">{'// 10 · RIESGOS Y DISCLAIMERS'}</div>
            <ul className="flex flex-col gap-2 max-w-3xl">
              {[
                'El trading de futuros y derivados conlleva riesgo real de pérdida total del capital invertido.',
                'Los resultados de backtest y paper trading no garantizan resultados futuros en capital real.',
                'El track record en capital real de SIGMA es reciente (días, no años, al momento de publicar este documento) y debe evaluarse con ese contexto.',
                'Este documento es informativo y no constituye asesoría financiera, una oferta de inversión, ni una garantía de rentabilidad.',
                'Cualquier decisión de replicar las operaciones de SIGMA vía Binance Copy Trading es responsabilidad exclusiva de cada usuario, sujeta a los términos del propio exchange.',
              ].map((d, i) => (
                <li key={i} className="terminal-text text-xs text-text-dim/70 leading-relaxed flex gap-3">
                  <span className="text-text-dim/40">—</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 pt-8 border-t border-border flex flex-col sm:flex-row gap-4">
              <Link href="/quienes-somos" className="section-label text-text-dim hover:text-gold transition-colors">
                → Quiénes somos
              </Link>
              <Link href="/terminos" className="section-label text-text-dim hover:text-gold transition-colors">
                → Términos y condiciones
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

    </main>
  )
}
