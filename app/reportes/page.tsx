'use client'
import { useState } from 'react'
import SiteNav from '../components/SiteNav'

const C = {
  bg: '#04050a', surface: '#0b0d14', border: '#1a1d2e',
  muted: '#3a3f55', dimText: '#7a7f9a', text: '#e8e9f0',
  gold: '#d4af37', glow: '#f0cc5a', green: '#34d399', red: '#f87171',
}

const CONTENT = [
  {
    num: '01', title: 'Resumen de mercado',
    items: ['Análisis macro semanal (SPX, NDX, BTC, Gold, DXY)', 'Régimen de mercado actual con modelo HMM', 'Lecturas de VIX, breadth, put/call ratio', 'Narrativa institucional y posicionamiento'],
  },
  {
    num: '02', title: 'Señales activas',
    items: ['Posiciones abiertas PRO.MACD v116', 'Señales OB+MACD 4H en crypto', 'Watchlist de setups high-probability', 'Entry, stop y target para cada señal'],
  },
  {
    num: '03', title: 'Performance mensual',
    items: ['Equity curve actualizada por modelo', 'P&L mensual y acumulado', 'Win rate, Sharpe y drawdown del mes', 'Comparativa vs. benchmark (SPX, BTC)'],
  },
  {
    num: '04', title: 'Análisis cuantitativo',
    items: ['Rotación sectorial por factores PCA', 'Momentum score Top 20 acciones S&P 500', 'Anomalías estadísticas detectadas (z-score)', 'Correlaciones y cambios de régimen macro'],
  },
  {
    num: '05', title: 'FIRE & Planning',
    items: ['Actualización mensual de la calculadora FIRE', 'Optimización de cartera por plataforma', 'Tax-loss harvesting opportunities', 'Proyección Monte Carlo rolling 12M'],
  },
  {
    num: '06', title: 'Modelo del mes',
    items: ['Deep-dive en uno de los modelos cuantitativos', 'Parámetros, lógica y validación estadística', 'Out-of-sample test results', 'Ideas de mejora y próximas versiones'],
  },
]

const TESTIMONIALS = [
  { name: 'C.V.', role: 'Trader independiente, Santiago', text: 'Las señales de PRO.MACD me dieron un +31% en Q3 mientras el mercado lateral. El reporte mensual es lo más denso que he leído fuera de una tesis doctoral.' },
  { name: 'M.R.', role: 'Ingeniero, Buenos Aires', text: 'Empecé con el simulador FIRE y en 3 meses ajusté completamente mi estrategia de ahorro. Recomiendo el plan anual, es fácilmente lo mejor que he pagado este año.' },
  { name: 'A.L.', role: 'Data Scientist, Bogotá', text: 'El análisis de régimen HMM es lo que buscaba. Finalmente tengo un framework riguroso para decidir cuándo operar y cuándo quedarme en cash.' },
]

const FAQ = [
  ['¿Con qué frecuencia se publica el reporte?', 'El primer miércoles de cada mes. Recibes acceso al reporte completo en PDF + acceso a la plataforma durante todo el mes.'],
  ['¿Incluye señales en tiempo real?', 'Las señales en tiempo real son parte del plan PRO. El reporte mensual incluye análisis retrospectivo y señales activas al momento de publicación.'],
  ['¿Puedo cancelar en cualquier momento?', 'Sí, sin preguntas. Tu suscripción continúa hasta el final del período pagado. No hay penalizaciones ni contratos.'],
  ['¿Los reportes son en español?', 'Sí, completamente en español. Términos técnicos en inglés cuando no existe traducción estándar en finanzas cuantitativas.'],
  ['¿Hay prueba gratuita?', 'Puedes acceder al reporte de hace 2 meses de forma gratuita en la sección de archivos. Eso te da una idea precisa del contenido.'],
]

export default function ReportesPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const handlePay = (plan: string) => {
    alert(`Redirigiendo a pago: ${plan}\n(Integración con Stripe/LemonSqueezy pendiente)`)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)" }}>
      <SiteNav />

      {/* ── Hero ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '100px 24px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 12 }}>
            {'// SIGMA RESEARCH · REPORTE MENSUAL'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(52px, 8vw, 100px)', lineHeight: 0.92, letterSpacing: '0.03em', margin: '0 0 20px' }}>
            <span style={{ color: C.text }}>INTELIGENCIA</span><br />
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>CUANTITATIVA</span><br />
            <span style={{ color: C.text }}>MENSUAL</span>
          </h1>
          <p style={{ fontFamily: 'monospace', fontSize: 14, color: C.dimText, maxWidth: 580, margin: '0 auto 36px', lineHeight: 1.8 }}>
            El mismo análisis que usan gestores institucionales, ahora accesible.
            Señales, modelos, y planificación FIRE en un reporte mensual.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              '✓ 6 secciones de análisis',
              '✓ Señales activas',
              '✓ Equity curves actualizadas',
              '✓ Cancela cuando quieras',
            ].map(t => (
              <span key={t} style={{ fontFamily: 'monospace', fontSize: 11, color: C.green, background: 'rgba(52,211,153,0.08)', padding: '4px 12px', border: '1px solid rgba(52,211,153,0.2)' }}>{t}</span>
            ))}
          </div>
        </div>

        {/* ── Pricing ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: C.border, marginBottom: 1 }}>
          {/* Monthly */}
          <div style={{ background: C.bg, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 8 }}>MENSUAL</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 56, color: C.text, lineHeight: 1 }}>$29</span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText }}>USD / mes</span>
              </div>
              <p style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginTop: 8, lineHeight: 1.6 }}>Acceso mensual renovable. Cancela en cualquier momento.</p>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {['Reporte mensual completo PDF', 'Acceso plataforma 30 días', 'Señales activas al publicar', 'Equity curves actualizadas'].map(f => (
                <li key={f} style={{ fontFamily: 'monospace', fontSize: 12, color: C.text, display: 'flex', gap: 8 }}>
                  <span style={{ color: C.dimText }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={() => handlePay('Mensual $29')} style={{
              padding: '12px 0', background: 'transparent', color: C.dimText,
              border: `1px solid ${C.border}`, cursor: 'pointer',
              fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, letterSpacing: '0.12em',
              transition: 'border-color 0.2s, color 0.2s',
            }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = C.gold; (e.target as HTMLButtonElement).style.color = C.gold }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = C.border; (e.target as HTMLButtonElement).style.color = C.dimText }}
            >
              SUSCRIBIRSE
            </button>
          </div>

          {/* Annual — highlighted */}
          <div style={{ background: C.surface, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${C.gold},${C.glow})` }} />
            <div style={{ position: 'absolute', top: 12, right: 14, fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.15em', background: `rgba(212,175,55,0.15)`, color: C.gold, padding: '3px 8px', border: `1px solid rgba(212,175,55,0.3)` }}>
              MEJOR VALOR
            </div>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>ANUAL</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 56, background: `linear-gradient(135deg,${C.gold},${C.glow})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>$249</span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText }}>USD / año</span>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.green, marginTop: 4 }}>Ahorra $99 vs. mensual → $20.75/mes</div>
              <p style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginTop: 6, lineHeight: 1.6 }}>12 reportes + acceso completo a la plataforma todo el año.</p>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {['Todo del plan mensual', '12 reportes garantizados', 'Acceso plataforma 365 días', 'Modelos ML completos', 'Historial reportes anteriores', 'Soporte por email prioritario'].map(f => (
                <li key={f} style={{ fontFamily: 'monospace', fontSize: 12, color: C.text, display: 'flex', gap: 8 }}>
                  <span style={{ color: C.gold }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={() => handlePay('Anual $249')} style={{
              padding: '14px 0', background: C.gold, color: C.bg,
              border: 'none', cursor: 'pointer',
              fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, letterSpacing: '0.12em',
              boxShadow: `0 0 24px rgba(212,175,55,0.3)`,
              transition: 'background 0.2s',
            }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = C.glow }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = C.gold }}
            >
              SUSCRIBIRSE ANUAL
            </button>
          </div>

          {/* Institutional */}
          <div style={{ background: C.bg, padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 8 }}>INSTITUCIONAL</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 56, color: C.text, lineHeight: 1 }}>Custom</span>
              </div>
              <p style={{ fontFamily: 'monospace', fontSize: 12, color: C.dimText, marginTop: 8, lineHeight: 1.6 }}>Para fondos, family offices o equipos de inversión. Modelos personalizados y API.</p>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {['Todo del plan anual', 'API acceso completo', 'Modelos a medida', 'Backtesting personalizado', 'SLA y soporte dedicado', 'Reportes con branding'].map(f => (
                <li key={f} style={{ fontFamily: 'monospace', fontSize: 12, color: C.text, display: 'flex', gap: 8 }}>
                  <span style={{ color: C.dimText }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={() => handlePay('Institucional')} style={{
              padding: '12px 0', background: 'transparent', color: C.dimText,
              border: `1px solid ${C.border}`, cursor: 'pointer',
              fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, letterSpacing: '0.12em',
              transition: 'border-color 0.2s, color 0.2s',
            }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = C.gold; (e.target as HTMLButtonElement).style.color = C.gold }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = C.border; (e.target as HTMLButtonElement).style.color = C.dimText }}
            >
              CONTACTAR
            </button>
          </div>
        </div>

        {/* ── Content sections ── */}
        <div style={{ marginTop: 1, background: C.border }}>
          <div style={{ background: C.surface, padding: '12px 22px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>QUÉ INCLUYE CADA REPORTE</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {CONTENT.map(s => (
              <div key={s.num} style={{ background: C.bg, padding: '22px 22px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 20, color: C.gold, lineHeight: 1, flexShrink: 0 }}>{s.num}</span>
                  <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, color: C.text, lineHeight: 1.1 }}>{s.title.toUpperCase()}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {s.items.map(item => (
                    <li key={item} style={{ fontFamily: 'monospace', fontSize: 11, color: C.dimText, lineHeight: 1.5, display: 'flex', gap: 8 }}>
                      <span style={{ color: C.gold, flexShrink: 0 }}>▸</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── Testimonials ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: C.border, marginTop: 1 }}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} style={{ background: C.surface, padding: '24px 22px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText, lineHeight: 1.8, marginBottom: 16, fontStyle: 'italic' }}>
                &ldquo;{t.text}&rdquo;
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.gold }}>{t.name}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted }}>{t.role}</div>
            </div>
          ))}
        </div>

        {/* ── FAQ ── */}
        <div style={{ marginTop: 1, background: C.border }}>
          <div style={{ background: C.surface, padding: '12px 22px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>PREGUNTAS FRECUENTES</span>
          </div>
          {FAQ.map(([q, a], i) => (
            <div key={i} style={{ background: i % 2 === 0 ? C.bg : 'rgba(212,175,55,0.02)', borderBottom: `1px solid ${C.border}` }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 22px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.text }}>{q}</span>
                <span style={{ color: C.gold, fontSize: 18, flexShrink: 0, marginLeft: 16 }}>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 22px 16px', fontFamily: 'monospace', fontSize: 12, color: C.dimText, lineHeight: 1.8 }}>
                  {a}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Email CTA ── */}
        <div style={{ marginTop: 1, background: C.surface, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 12 }}>
            {'// LISTA DE ACCESO ANTICIPADO'}
          </div>
          <h2 style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 'clamp(32px, 5vw, 60px)', color: C.text, margin: '0 0 16px' }}>
            RECIBE EL PRÓXIMO REPORTE GRATIS
          </h2>
          <p style={{ fontFamily: 'monospace', fontSize: 13, color: C.dimText, maxWidth: 440, margin: '0 auto 28px', lineHeight: 1.7 }}>
            Suscríbete a la lista y te enviamos el próximo reporte mensual sin costo. Sin spam.
          </p>
          {submitted ? (
            <div style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 28, color: C.green }}>✓ REGISTRADO — TE ENVIAMOS EL PRÓXIMO REPORTE</div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); if (email) setSubmitted(true) }} style={{ display: 'flex', maxWidth: 480, margin: '0 auto', gap: 1 }}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com"
                style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRight: 'none', padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, color: C.text, outline: 'none' }}
              />
              <button type="submit" style={{
                padding: '12px 24px', background: C.gold, color: C.bg, border: 'none', cursor: 'pointer',
                fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, letterSpacing: '0.12em', whiteSpace: 'nowrap',
              }}>
                UNIRME
              </button>
            </form>
          )}
        </div>

        <div style={{ height: 48 }} />
      </div>
    </div>
  )
}
