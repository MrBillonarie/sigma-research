import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import Link from 'next/link'
import HeroAnimation from './components/HeroAnimation'
import StatsCounter  from './components/landing/StatsCounter'
import CapCards      from './components/landing/CapCards'
import ModelBars     from './components/landing/ModelBars'
import PricingToggle from './components/landing/PricingToggle'
import FadeIn        from './components/landing/FadeIn'

export const metadata: Metadata = {
  title: 'Sigma Research — Infraestructura Cuantitativa LATAM',
  description:
    'Plataforma cuantitativa de grado institucional para operadores independientes. Modelos validados, datos reales, sin conflictos de interés.',
}

const G   = '#d4af37'
const BG  = '#04050a'
const S   = '#0b0d14'
const B   = '#1a1d2e'
const T   = '#e8e9f0'
const D   = '#7a7f9a'
const DIM = '#5a6080'

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  return (
    <main style={{ background: BG, color: T, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ══ 1. HERO ══════════════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', borderBottom: `1px solid ${B}` }}>

        {/* Background layers */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          backgroundImage:`linear-gradient(rgba(212,175,55,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,0.03) 1px,transparent 1px)`,
          backgroundSize:'60px 60px' }} />
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          background:`radial-gradient(ellipse 80% 80% at -5% 50%, rgba(212,175,55,0.12) 0%, transparent 55%)` }} />
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          background:`radial-gradient(ellipse 50% 50% at 105% 80%, rgba(52,211,153,0.04) 0%, transparent 50%)` }} />

        {/* Equity curve decoration */}
        <HeroAnimation />

        <div style={{ maxWidth:1280, margin:'0 auto', width:'100%', padding:'160px 32px 80px', position:'relative', zIndex:1 }}>

          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:48, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 14px', border:`1px solid rgba(52,211,153,0.25)`, background:'rgba(52,211,153,0.05)' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#34d399', boxShadow:'0 0 10px #34d399', flexShrink:0 }} />
              <span style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.25em', color:'#34d399' }}>PLATAFORMA OPERATIVA</span>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              {['HMM · LIVE','XGB · LIVE','GARCH · LIVE'].map(m => (
                <span key={m} style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.15em', color:DIM, border:`1px solid ${B}`, padding:'4px 10px' }}>{m}</span>
              ))}
            </div>
          </div>

          {/* Main headline */}
          <div style={{ marginBottom:36 }}>
            <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", letterSpacing:'0.02em', lineHeight:0.88 }}>
              <div style={{ fontSize:'clamp(72px,12vw,140px)', color:T }}>EDGE</div>
              <div style={{ fontSize:'clamp(72px,12vw,140px)', background:`linear-gradient(135deg, ${G} 0%, #f0cc5a 35%, ${G} 65%, #8a6a10 100%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>CUANTITATIVO</div>
              <div style={{ fontSize:'clamp(48px,8vw,96px)', color:D, marginTop:4 }}>PARA OPERADORES INDEPENDIENTES</div>
            </div>
          </div>

          {/* Description */}
          <p style={{ fontFamily:'monospace', fontSize:13, color:D, lineHeight:1.9, maxWidth:540, marginBottom:44, borderLeft:`2px solid ${G}40`, paddingLeft:18 }}>
            Infraestructura analítica de grado institucional — modelos ML validados out-of-sample, datos de mercado reales y planificación FIRE integrada. Sin conflictos de interés.
          </p>

          {/* CTAs */}
          <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:64 }}>
            <Link href="/registro" style={{
              background:`linear-gradient(135deg, ${G}, #c9a227)`,
              color:BG, fontFamily:'monospace', fontSize:11, letterSpacing:'0.22em',
              padding:'15px 40px', textDecoration:'none', display:'inline-block',
              boxShadow:`0 0 32px rgba(212,175,55,0.25)`,
            }}>
              CREAR CUENTA GRATIS
            </Link>
            <Link href="/login" style={{
              border:`1px solid ${B}`, color:D,
              fontFamily:'monospace', fontSize:11, letterSpacing:'0.18em',
              padding:'15px 28px', textDecoration:'none', display:'inline-block',
              background:'rgba(255,255,255,0.02)',
            }}>
              INICIAR SESIÓN →
            </Link>
          </div>

          {/* Trust micro-badges */}
          <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
            {[
              { dot:'#34d399', text:'Sin tarjeta de crédito' },
              { dot:G,         text:'Comunidad de traders'    },
              { dot:'#60a5fa', text:'Datos Binance en vivo'  },
            ].map(b => (
              <div key={b.text} style={{ display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:b.dot, flexShrink:0 }} />
                <span style={{ fontFamily:'monospace', fontSize:10, color:DIM, letterSpacing:'0.08em' }}>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 2. STATS BAR ═════════════════════════════════════════════════════ */}
      <section style={{ borderBottom:`1px solid ${B}` }}>
        <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 32px' }}>
          <StatsCounter />
        </div>
      </section>

      {/* ══ 3. CAPACIDADES ═══════════════════════════════════════════════════ */}
      <section style={{ padding:'112px 32px', borderBottom:`1px solid ${B}` }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>

          {/* Section header */}
          <FadeIn>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', alignItems:'flex-end', marginBottom:64, gap:32, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.3em', color:G, marginBottom:16 }}>{'// PLATAFORMA · 6 HERRAMIENTAS'}</div>
              <h2 style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:'clamp(48px,7vw,88px)', color:T, lineHeight:0.92, margin:0 }}>
                TODO LO QUE UN<br />
                <span style={{ background:`linear-gradient(135deg,${G},#f0cc5a,#a88c25)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>QUANT NECESITA</span>
              </h2>
            </div>
            <Link href="/registro" style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.2em', color:G, border:`1px solid rgba(212,175,55,0.25)`, padding:'10px 18px', textDecoration:'none', whiteSpace:'nowrap' }}>
              VER TODAS →
            </Link>
          </div>
          </FadeIn>

          {/* Cards con hover glow */}
          <FadeIn delay={100}>
            <CapCards />
          </FadeIn>
        </div>
      </section>

      {/* ══ 4. MODELOS ML ════════════════════════════════════════════════════ */}
      <section style={{ background:S, padding:'112px 32px', borderBottom:`1px solid ${B}` }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div className="landing-mod-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center' }}>

            {/* Left: copy */}
            <div>
              <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.3em', color:G, marginBottom:16 }}>{'// MOTOR CUANTITATIVO'}</div>
              <h2 style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:'clamp(42px,5vw,72px)', color:T, lineHeight:0.92, margin:'0 0 28px' }}>
                CUATRO MODELOS.<br />
                <span style={{ background:`linear-gradient(135deg,${G},#f0cc5a)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>VALIDADOS OOS.</span>
              </h2>
              <p style={{ fontFamily:'monospace', fontSize:12, color:D, lineHeight:1.9, marginBottom:32 }}>
                Walk-forward testing estricto — ventanas de entrenamiento y validación completamente separadas. Métricas publicadas: accuracy, Sharpe OOS, MAE. Actualizados diariamente al cierre de mercado NY.
              </p>
              <div style={{ display:'flex', gap:20 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:40, color:G }}>4</div>
                  <div style={{ fontFamily:'monospace', fontSize:9, color:DIM, letterSpacing:'0.15em' }}>MODELOS LIVE</div>
                </div>
                <div style={{ width:1, background:B }} />
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:40, color:'#34d399' }}>30m</div>
                  <div style={{ fontFamily:'monospace', fontSize:9, color:DIM, letterSpacing:'0.15em' }}>REFRESH RATE</div>
                </div>
                <div style={{ width:1, background:B }} />
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:40, color:'#60a5fa' }}>22d</div>
                  <div style={{ fontFamily:'monospace', fontSize:9, color:DIM, letterSpacing:'0.15em' }}>ACCURACY WINDOW</div>
                </div>
              </div>
            </div>

            {/* Right: model table con barras animadas */}
            <FadeIn delay={200}>
              <ModelBars />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══ 5. PLANES ════════════════════════════════════════════════════════ */}
      <section id="planes" style={{ padding:'112px 32px', borderBottom:`1px solid ${B}` }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:64, flexWrap:'wrap', gap:20 }}>
            <div>
              <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.3em', color:G, marginBottom:16 }}>{'// PLANES DE ACCESO'}</div>
              <h2 style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:'clamp(48px,6vw,80px)', color:T, lineHeight:0.92, margin:0 }}>
                ELIGE TU <span style={{ background:`linear-gradient(135deg,${G},#f0cc5a)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>PLAN</span>
              </h2>
            </div>
            <div style={{ fontFamily:'monospace', fontSize:9, color:DIM, letterSpacing:'0.15em', textAlign:'right' }}>
              SIN PERMANENCIA<br />CANCELA CUANDO QUIERAS
            </div>
          </div>

          <FadeIn delay={50}>
            <PricingToggle />
          </FadeIn>
        </div>
      </section>

      {/* ══ 6. CTA FINAL + DISCLAIMER ════════════════════════════════════════ */}
      <section style={{ padding:'112px 32px 80px', background:S, borderBottom:`1px solid ${B}` }}>
        <div style={{ maxWidth:720, margin:'0 auto', textAlign:'center' }}>
          <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.3em', color:G, marginBottom:20 }}>{'// EMPIEZA HOY'}</div>
          <h2 style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", lineHeight:0.88, margin:'0 0 28px' }}>
            <span style={{ display:'block', fontSize:'clamp(56px,9vw,120px)', color:T }}>OPERA CON</span>
            <span style={{ display:'block', fontSize:'clamp(56px,9vw,120px)', background:`linear-gradient(135deg,${G},#f0cc5a,#a88c25)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>VENTAJA REAL</span>
          </h2>
          <p style={{ fontFamily:'monospace', fontSize:12, color:D, lineHeight:1.9, marginBottom:44 }}>
            Cuenta gratuita en 30 segundos. Sin tarjeta de crédito.<br />
            Acceso inmediato a todas las herramientas del dashboard.
          </p>

          <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap', marginBottom:64 }}>
            <Link href="/registro" style={{
              background:`linear-gradient(135deg,${G},#c9a227)`,
              color:BG, fontFamily:'monospace', fontSize:11, letterSpacing:'0.22em',
              padding:'16px 44px', textDecoration:'none',
              boxShadow:`0 0 40px rgba(212,175,55,0.3)`,
            }}>
              CREAR CUENTA GRATIS
            </Link>
            <Link href="/login" style={{
              border:`1px solid ${B}`, color:D, background:'rgba(255,255,255,0.02)',
              fontFamily:'monospace', fontSize:11, letterSpacing:'0.18em',
              padding:'16px 28px', textDecoration:'none',
            }}>
              YA TENGO CUENTA →
            </Link>
          </div>

          {/* Institutional disclaimer */}
          <div style={{ borderTop:`1px solid ${B}`, paddingTop:28, textAlign:'left' }}>
            <div style={{ fontFamily:'monospace', fontSize:9, color:DIM, letterSpacing:'0.08em', lineHeight:1.8 }}>
              AVISO LEGAL: Sigma Research es una plataforma de herramientas analíticas y no constituye asesoramiento financiero, de inversión, tributario ni legal. Los modelos, señales y análisis son de carácter exclusivamente informativo. Los resultados pasados no garantizan rendimientos futuros. Toda operación en mercados financieros conlleva riesgo de pérdida parcial o total del capital invertido. Opera únicamente con capital que puedas permitirte perder. Sigma Research no gestiona capital de terceros ni ejecuta órdenes en nombre de sus usuarios.
            </div>
          </div>
        </div>
      </section>

      {/* El Footer global lo agrega ConditionalShell automáticamente */}

    </main>
  )
}
