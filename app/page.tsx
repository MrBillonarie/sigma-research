import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import Link from 'next/link'
import HeroAnimation from './components/HeroAnimation'

export const metadata: Metadata = {
  title: 'Sigma Research — Infraestructura Cuantitativa LATAM',
  description:
    'Plataforma cuantitativa de grado institucional para operadores independientes. Modelos validados, datos reales, sin conflictos de interés.',
}

// ─── Constants ────────────────────────────────────────────────────────────────
const G  = '#d4af37'
const BG = '#04050a'
const S  = '#0b0d14'
const B  = '#1a1d2e'
const T  = '#e8e9f0'
const D  = '#7a7f9a'   // texto muted legible
const M  = '#4a5068'   // texto muy muted — antes #3a3f55, demasiado oscuro
const DIM = '#5a6080'  // nivel intermedio

const STATS = [
  { value: '85.2%', label: 'Win Rate',     detail: 'backtesting OOS' },
  { value: '4.16×', label: 'Profit Factor',detail: 'PRO.MACD v116' },
  { value: '1.87',  label: 'Sharpe Ratio', detail: '12M rolling' },
  { value: '−12.4%',label: 'Max Drawdown', detail: 'Ene 22 – Dic 24' },
]

const CAPS = [
  { id:'01', name:'SIGNAL HUD',        col:'#34d399', desc:'Señales del Motor de Decisión en tiempo real. Régimen HMM, bias de mercado, confianza por clase de activo.' },
  { id:'02', name:'TRADE JOURNAL',     col:'#f59e0b', desc:'CSV Binance Futures + entrada manual. Sharpe, Max DD, Profit Factor. Export PDF y CSV.' },
  { id:'03', name:'PORTFOLIO',         col:'#3b82f6', desc:'IBKR, Binance Spot/Futures, Fintual, Santander, Cash. Consolidado USD/CLP en tiempo real.' },
  { id:'04', name:'FIRE + MONTECARLO', col:'#d4af37', desc:'Regla del 4%. 2.000 trayectorias GBM. Percentiles P10/P50/P90. Proyección a 20 años.' },
  { id:'05', name:'MOTOR CUANTITATIVO',col:'#a78bfa', desc:'4 modelos ML: HMM-01, XGB-03, STAT-05, GARCH-02. Score 0–100, EV neto, Kelly fraction.' },
  { id:'06', name:'COMPARADORES',      col:'#f87171', desc:'ETFs globales, Fondos Mutuos CMF, Renta Fija DAP, LP DeFi PancakeSwap v3.' },
]

const MODELS = [
  { tag:'HMM-01',   name:'Regime Detector', metric:'91.2%',   unit:'accuracy', live:true },
  { tag:'XGB-03',   name:'Momentum Score',  metric:'2.41',    unit:'Sharpe',   live:true },
  { tag:'STAT-05',  name:'Pairs Trading',   metric:'1.87',    unit:'Sharpe',   live:true },
  { tag:'GARCH-02', name:'Vol Forecaster',  metric:'0.031',   unit:'MAE',      live:true },
  { tag:'NLP-04',   name:'Sentiment Alpha', metric:'—',       unit:'revisión', live:false},
]

const PLANS = [
  { tier:'ACCESO LIBRE', price:'$0',    period:'siempre gratis',  accent:'#2a2d3e', textAccent:D,  fill:false, badge:null,          cta:'ABRIR CUENTA',  href:'/registro',
    items:['Dashboard completo','Journal de trades','Calculadora FIRE','Monte Carlo','HUD señales','Comparadores'] },
  { tier:'PRO',          price:'$29',   period:'USD / mes',        accent:G,         textAccent:G,  fill:true,  badge:'★ MÁS POPULAR',cta:'ACTIVAR PRO',   href:'/registro',
    items:['Todo del plan libre','Reportes PDF mensuales','Señales activas PRO.MACD','Equity curves actualizadas','Soporte prioritario'] },
  { tier:'INSTITUCIONAL',price:'Custom',period:'cotizar',          accent:'#3b82f6', textAccent:'#60a5fa', fill:false, badge:null,  cta:'CONTACTAR',     href:'/contacto',
    items:['Todo del plan PRO','API acceso completo','Modelos a medida','White label disponible','SLA garantizado'] },
]

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
              { dot:G,         text:'127 traders activos'    },
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
          <div className="landing-stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', background:B, gap:1 }}>
            {STATS.map(s => (
              <div key={s.label} style={{ background:BG, padding:'48px 36px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${G}, transparent)` }} />
                <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.28em', color:DIM, textTransform:'uppercase', marginBottom:16 }}>
                  {s.label}
                </div>
                <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:62, color:G, lineHeight:1, letterSpacing:'0.02em', marginBottom:8 }}>
                  {s.value}
                </div>
                <div style={{ fontFamily:'monospace', fontSize:9, color:DIM, letterSpacing:'0.1em' }}>{s.detail}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:'8px 0', display:'flex', justifyContent:'flex-end' }}>
            <span style={{ fontFamily:'monospace', fontSize:9, color:DIM, letterSpacing:'0.08em' }}>
              * Backtesting out-of-sample · Pasados no garantizan futuros
            </span>
          </div>
        </div>
      </section>

      {/* ══ 3. CAPACIDADES ═══════════════════════════════════════════════════ */}
      <section style={{ padding:'112px 32px', borderBottom:`1px solid ${B}` }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>

          {/* Section header */}
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

          {/* Cards */}
          <div className="landing-cap-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, background:B }}>
            {CAPS.map(c => (
              <div key={c.id} style={{ background:S, padding:'36px 30px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:c.col }} />
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                  <span style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:34, color:T, letterSpacing:'0.03em' }}>{c.name}</span>
                  <span style={{ fontFamily:'monospace', fontSize:9, color:c.col, background:`${c.col}15`, border:`1px solid ${c.col}40`, padding:'2px 8px', flexShrink:0, marginLeft:8 }}>
                    {c.id}
                  </span>
                </div>
                <p style={{ fontFamily:'monospace', fontSize:11, color:D, lineHeight:1.8, margin:0 }}>{c.desc}</p>
              </div>
            ))}
          </div>
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

            {/* Right: model table */}
            <div style={{ background:BG, border:`1px solid ${B}` }}>
              <div style={{ padding:'14px 20px', borderBottom:`1px solid ${B}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.2em', color:M }}>MODELOS ACTIVOS</span>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background:'#34d399' }} />
                  <span style={{ fontFamily:'monospace', fontSize:9, color:'#34d399', letterSpacing:'0.15em' }}>LIVE</span>
                </span>
              </div>
              {MODELS.map((m, i) => (
                <div key={m.tag} style={{ padding:'18px 20px', borderBottom: i < MODELS.length - 1 ? `1px solid ${B}` : 'none', display:'flex', alignItems:'center', gap:16 }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background: m.live ? '#34d399' : '#fbbf24', boxShadow: m.live ? '0 0 8px #34d399' : 'none', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:'monospace', fontSize:10, color:G, letterSpacing:'0.1em' }}>{m.tag}</div>
                    <div style={{ fontFamily:'monospace', fontSize:12, color:T, marginTop:2 }}>{m.name}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:22, color: m.live ? T : M, lineHeight:1 }}>{m.metric}</div>
                    <div style={{ fontFamily:'monospace', fontSize:9, color:DIM, letterSpacing:'0.08em' }}>{m.unit}</div>
                  </div>
                </div>
              ))}
            </div>
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

          <div className="landing-plans-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, background:B }}>
            {PLANS.map(p => (
              <div key={p.tier} style={{ background:S, padding:'44px 32px', position:'relative', display:'flex', flexDirection:'column',
                outline: p.fill ? `2px solid ${p.accent}` : 'none', outlineOffset:-2 }}>
                {p.badge && (
                  <div style={{ position:'absolute', top:-1, left:24, fontFamily:'monospace', fontSize:9, letterSpacing:'0.18em', background:p.accent, color:BG, padding:'4px 12px' }}>
                    {p.badge}
                  </div>
                )}
                {p.fill && <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${G},#f0cc5a)` }} />}

                <div style={{ marginBottom:28 }}>
                  <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.25em', color:p.textAccent, marginBottom:14 }}>{p.tier}</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:4 }}>
                    <span style={{ fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:60, color:p.textAccent, lineHeight:1 }}>{p.price}</span>
                    <span style={{ fontFamily:'monospace', fontSize:11, color:M }}>{p.period}</span>
                  </div>
                </div>

                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10, marginBottom:32 }}>
                  {p.items.map(item => (
                    <div key={item} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                      <span style={{ color:p.textAccent, fontFamily:'monospace', fontSize:12, flexShrink:0, marginTop:1 }}>✓</span>
                      <span style={{ fontFamily:'monospace', fontSize:11, color:D, lineHeight:1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>

                <Link href={p.href} style={{
                  display:'block', textAlign:'center', padding:'14px',
                  fontFamily:'monospace', fontSize:10, letterSpacing:'0.22em',
                  textDecoration:'none',
                  background: p.fill ? `linear-gradient(135deg,${p.accent},#c9a227)` : 'transparent',
                  color: p.fill ? BG : p.textAccent,
                  border: `1px solid ${p.accent}`,
                  boxShadow: p.fill ? `0 0 24px rgba(212,175,55,0.2)` : 'none',
                }}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
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
