import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import Link from 'next/link'
import HeroAnimation from '../components/HeroAnimation'

export const metadata: Metadata = {
  title: 'SQuant Desk — Quantitative Infrastructure LATAM',
  description:
    'Institutional-grade quantitative platform for independent operators. Validated models, real data, no conflicts of interest.',
}

const G  = '#39e2e6'
const BG = '#080a0f'
const S  = '#0e1119'
const B  = '#202634'
const T  = '#eef1f7'
const D  = '#9aa4b6'
const M  = '#5f6a7d'
const DIM = '#5a6080'

const STATS = [
  { value: '85.2%', label: 'Win Rate',     detail: 'out-of-sample backtest' },
  { value: '4.16×', label: 'Profit Factor',detail: 'PRO.MACD v116' },
  { value: '1.87',  label: 'Sharpe Ratio', detail: '12M rolling' },
  { value: '−12.4%',label: 'Max Drawdown', detail: 'Jan 22 – Dec 24' },
]

const CAPS = [
  { id:'01', name:'SIGNAL HUD',        col:'#34d399', desc:'Real-time signals from the Decision Engine. HMM regime, market bias, confidence per asset class.' },
  { id:'02', name:'TRADE JOURNAL',     col:'#f59e0b', desc:'Binance Futures CSV import + manual entry. Sharpe, Max DD, Profit Factor. PDF & CSV export.' },
  { id:'03', name:'PORTFOLIO',         col:'#3b82f6', desc:'IBKR, Binance Spot/Futures, Fintual, Santander, Cash. Consolidated in USD/CLP in real time.' },
  { id:'04', name:'FIRE + MONTECARLO', col:'#39e2e6', desc:'4% rule. 2,000 GBM trajectories. P10/P50/P90 percentiles. 20-year projection.' },
  { id:'05', name:'QUANT ENGINE',      col:'#a78bfa', desc:'4 ML models: HMM-01, XGB-03, STAT-05, GARCH-02. Score 0–100, net EV, Kelly fraction.' },
  { id:'06', name:'COMPARATORS',       col:'#ff5d6c', desc:'Global ETFs, Chilean Mutual Funds CMF, Fixed Income DAP, LP DeFi PancakeSwap v3.' },
  { id:'07', name:'LP SIGNAL',         col:'#06b6d4', desc:'Uniswap v3 concentrated liquidity signals. Kelly-sized ranges, Monte Carlo fee projection, IL breakeven.' },
  { id:'08', name:'PASSIVE INCOME',    col:'#10b981', desc:'Staking, DeFi, dividends and bots catalog. APY comparison, compound growth and impermanent loss calculator.' },
  { id:'09', name:'NOTIFICATIONS',     col:'#8b5cf6', desc:'Real-time alerts via Supabase Realtime. Urgent signals pinned, toast system with 6-second auto-dismiss.' },
]

const MODELS = [
  { tag:'HMM-01',   name:'Regime Detector', metric:'91.2%', unit:'accuracy', live:true },
  { tag:'XGB-03',   name:'Momentum Score',  metric:'2.41',  unit:'Sharpe',   live:true },
  { tag:'STAT-05',  name:'Pairs Trading',   metric:'1.87',  unit:'Sharpe',   live:true },
  { tag:'GARCH-02', name:'Vol Forecaster',  metric:'0.031', unit:'MAE',      live:true },
  { tag:'NLP-04',   name:'Sentiment Alpha', metric:'—',     unit:'review',   live:false},
]

const PLANS = [
  { tier:'FREE ACCESS', price:'$0',    period:'always free',   accent:'#2a2d3e', textAccent:D,  fill:false, badge:null,            cta:'OPEN ACCOUNT',  href:'/en/registro',
    items:['Full dashboard','Trade journal','FIRE calculator','Monte Carlo','Signal HUD','Comparators'] },
  { tier:'PRO',          price:'$29',  period:'USD / month',   accent:G,         textAccent:G,  fill:true,  badge:'★ MOST POPULAR', cta:'ACTIVATE PRO',  href:'/en/registro',
    items:['Everything in free','Monthly PDF reports','Active PRO.MACD signals','Updated equity curves','Priority support'] },
  { tier:'INSTITUTIONAL',price:'Custom',period:'quote',        accent:'#3b82f6', textAccent:'#4f92ff', fill:false, badge:null,      cta:'CONTACT US',    href:'/en/contacto',
    items:['Everything in PRO','Full API access','Custom models','White label available','SLA guaranteed'] },
]

export default async function EnPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  return (
    <main style={{ background: BG, color: T, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ══ HERO ══ */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', borderBottom: `1px solid ${B}` }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          backgroundImage:`linear-gradient(rgba(57,226,230,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(57,226,230,0.03) 1px,transparent 1px)`,
          backgroundSize:'60px 60px' }} />
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          background:`radial-gradient(ellipse 80% 80% at -5% 50%, rgba(57,226,230,0.12) 0%, transparent 55%)` }} />

        <HeroAnimation />

        <div style={{ maxWidth:1280, margin:'0 auto', width:'100%', padding:'160px 32px 80px', position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:48, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 14px', border:`1px solid rgba(52,211,153,0.25)`, background:'rgba(52,211,153,0.05)' }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#34d399', boxShadow:'0 0 10px #34d399', flexShrink:0 }} />
              <span style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.25em', color:'#34d399' }}>PLATFORM LIVE</span>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              {['HMM · LIVE','XGB · LIVE','GARCH · LIVE'].map(m => (
                <span key={m} style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.15em', color:DIM, border:`1px solid ${B}`, padding:'4px 10px' }}>{m}</span>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:36 }}>
            <div style={{ fontFamily:"-apple-system, 'Segoe UI', system-ui, 'Helvetica Neue', Arial, sans-serif", letterSpacing:'0.02em', lineHeight:0.88 }}>
              <div style={{ fontSize:'clamp(72px,12vw,140px)', color:T }}>QUANTITATIVE</div>
              <div style={{ fontSize:'clamp(72px,12vw,140px)', background:`linear-gradient(135deg, ${G} 0%, #5eeaf0 35%, ${G} 65%, #2f6bd6 100%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>EDGE</div>
              <div style={{ fontSize:'clamp(48px,8vw,96px)', color:D, marginTop:4 }}>FOR INDEPENDENT OPERATORS</div>
            </div>
          </div>

          <p style={{ fontFamily:'monospace', fontSize:13, color:D, lineHeight:1.9, maxWidth:540, marginBottom:44, borderLeft:`2px solid ${G}40`, paddingLeft:18 }}>
            Institutional-grade analytical infrastructure — out-of-sample validated ML models, real market data and integrated FIRE planning. No conflicts of interest.
          </p>

          <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:64 }}>
            <Link href="/en/registro" style={{
              background:`linear-gradient(135deg, ${G}, #2f6bd6)`,
              color:BG, fontFamily:'monospace', fontSize:11, letterSpacing:'0.22em',
              padding:'15px 40px', textDecoration:'none', display:'inline-block',
              boxShadow:`0 0 32px rgba(57,226,230,0.25)`,
            }}>
              CREATE FREE ACCOUNT
            </Link>
            <Link href="/en/login" style={{
              border:`1px solid ${B}`, color:D,
              fontFamily:'monospace', fontSize:11, letterSpacing:'0.18em',
              padding:'15px 28px', textDecoration:'none', display:'inline-block',
              background:'rgba(255,255,255,0.02)',
            }}>
              SIGN IN →
            </Link>
          </div>

          <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
            {[
              { dot:'#34d399', text:'No credit card required' },
              { dot:G,         text:'Trader community'       },
              { dot:'#4f92ff', text:'Binance live data'      },
            ].map(b => (
              <div key={b.text} style={{ display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:b.dot, flexShrink:0 }} />
                <span style={{ fontFamily:'monospace', fontSize:10, color:M, letterSpacing:'0.08em' }}>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ STATS ══ */}
      <section style={{ borderBottom:`1px solid ${B}` }}>
        <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 32px' }}>
          <div className="landing-stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', background:B, gap:1 }}>
            {STATS.map(s => (
              <div key={s.label} style={{ background:BG, padding:'48px 36px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${G}, transparent)` }} />
                <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.28em', color:M, textTransform:'uppercase', marginBottom:16 }}>{s.label}</div>
                <div style={{ fontFamily:"-apple-system, 'Segoe UI', system-ui, 'Helvetica Neue', Arial, sans-serif", fontSize:62, color:G, lineHeight:1, letterSpacing:'0.02em', marginBottom:8 }}>{s.value}</div>
                <div style={{ fontFamily:'monospace', fontSize:9, color:M, letterSpacing:'0.1em' }}>{s.detail}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:'8px 0', display:'flex', justifyContent:'flex-end' }}>
            <span style={{ fontFamily:'monospace', fontSize:9, color:B, letterSpacing:'0.08em' }}>* Out-of-sample backtesting · Past results do not guarantee future returns</span>
          </div>
        </div>
      </section>

      {/* ══ CAPABILITIES ══ */}
      <section style={{ padding:'112px 32px', borderBottom:`1px solid ${B}` }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', alignItems:'flex-end', marginBottom:64, gap:32 }}>
            <div>
              <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.3em', color:G, marginBottom:16 }}>{'// PLATFORM · 9 TOOLS'}</div>
              <h2 style={{ fontFamily:"-apple-system, 'Segoe UI', system-ui, 'Helvetica Neue', Arial, sans-serif", fontSize:'clamp(48px,7vw,88px)', color:T, lineHeight:0.92, margin:0 }}>
                EVERYTHING A<br />
                <span style={{ background:`linear-gradient(135deg,${G},#5eeaf0,#2f6bd6)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>QUANT NEEDS</span>
              </h2>
            </div>
            <Link href="/en/registro" style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.2em', color:G, border:`1px solid rgba(57,226,230,0.25)`, padding:'10px 18px', textDecoration:'none', whiteSpace:'nowrap' }}>
              SEE ALL →
            </Link>
          </div>
          <div className="landing-cap-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, background:B }}>
            {CAPS.map(c => (
              <div key={c.id} style={{ background:S, padding:'36px 30px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:c.col }} />
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                  <span style={{ fontFamily:"-apple-system, 'Segoe UI', system-ui, 'Helvetica Neue', Arial, sans-serif", fontSize:34, color:T, letterSpacing:'0.03em' }}>{c.name}</span>
                  <span style={{ fontFamily:'monospace', fontSize:9, color:c.col, background:`${c.col}15`, border:`1px solid ${c.col}40`, padding:'2px 8px', flexShrink:0, marginLeft:8 }}>{c.id}</span>
                </div>
                <p style={{ fontFamily:'monospace', fontSize:11, color:D, lineHeight:1.8, margin:0 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ MODELS ══ */}
      <section style={{ background:S, padding:'112px 32px', borderBottom:`1px solid ${B}` }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div className="landing-mod-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center' }}>
            <div>
              <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.3em', color:G, marginBottom:16 }}>{'// QUANTITATIVE ENGINE'}</div>
              <h2 style={{ fontFamily:"-apple-system, 'Segoe UI', system-ui, 'Helvetica Neue', Arial, sans-serif", fontSize:'clamp(42px,5vw,72px)', color:T, lineHeight:0.92, margin:'0 0 28px' }}>
                FOUR MODELS.<br />
                <span style={{ background:`linear-gradient(135deg,${G},#5eeaf0)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>OOS VALIDATED.</span>
              </h2>
              <p style={{ fontFamily:'monospace', fontSize:12, color:D, lineHeight:1.9, marginBottom:32 }}>
                Strict walk-forward testing — completely separate training and validation windows. Published metrics: accuracy, OOS Sharpe, MAE. Updated daily at NY market close.
              </p>
              <div style={{ display:'flex', gap:20 }}>
                {[{v:'4',c:G,l:'LIVE MODELS'},{v:'30m',c:'#34d399',l:'REFRESH RATE'},{v:'22d',c:'#4f92ff',l:'ACCURACY WINDOW'}].map(s => (
                  <div key={s.l} style={{ textAlign:'center' }}>
                    <div style={{ fontFamily:"-apple-system, 'Segoe UI', system-ui, 'Helvetica Neue', Arial, sans-serif", fontSize:40, color:s.c }}>{s.v}</div>
                    <div style={{ fontFamily:'monospace', fontSize:9, color:M, letterSpacing:'0.15em' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:BG, border:`1px solid ${B}` }}>
              <div style={{ padding:'14px 20px', borderBottom:`1px solid ${B}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.2em', color:M }}>ACTIVE MODELS</span>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background:'#34d399' }} />
                  <span style={{ fontFamily:'monospace', fontSize:9, color:'#34d399', letterSpacing:'0.15em' }}>LIVE</span>
                </span>
              </div>
              {MODELS.map((m, i) => (
                <div key={m.tag} style={{ padding:'18px 20px', borderBottom: i < MODELS.length - 1 ? `1px solid ${B}` : 'none', display:'flex', alignItems:'center', gap:16 }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background: m.live ? '#34d399' : '#ffb454', boxShadow: m.live ? '0 0 8px #34d399' : 'none', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:'monospace', fontSize:10, color:G, letterSpacing:'0.1em' }}>{m.tag}</div>
                    <div style={{ fontFamily:'monospace', fontSize:12, color:T, marginTop:2 }}>{m.name}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontFamily:"-apple-system, 'Segoe UI', system-ui, 'Helvetica Neue', Arial, sans-serif", fontSize:22, color: m.live ? T : M, lineHeight:1 }}>{m.metric}</div>
                    <div style={{ fontFamily:'monospace', fontSize:9, color:M, letterSpacing:'0.08em' }}>{m.unit}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ PLANS ══ */}
      <section id="plans" style={{ padding:'112px 32px', borderBottom:`1px solid ${B}` }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:64, flexWrap:'wrap', gap:20 }}>
            <div>
              <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.3em', color:G, marginBottom:16 }}>{'// ACCESS PLANS'}</div>
              <h2 style={{ fontFamily:"-apple-system, 'Segoe UI', system-ui, 'Helvetica Neue', Arial, sans-serif", fontSize:'clamp(48px,6vw,80px)', color:T, lineHeight:0.92, margin:0 }}>
                CHOOSE YOUR <span style={{ background:`linear-gradient(135deg,${G},#5eeaf0)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>PLAN</span>
              </h2>
            </div>
            <div style={{ fontFamily:'monospace', fontSize:9, color:M, letterSpacing:'0.15em', textAlign:'right' }}>NO LOCK-IN<br />CANCEL ANYTIME</div>
          </div>
          <div className="landing-plans-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, background:B }}>
            {PLANS.map(p => (
              <div key={p.tier} style={{ background:S, padding:'44px 32px', position:'relative', display:'flex', flexDirection:'column',
                outline: p.fill ? `2px solid ${p.accent}` : 'none', outlineOffset:-2 }}>
                {p.badge && <div style={{ position:'absolute', top:-1, left:24, fontFamily:'monospace', fontSize:9, letterSpacing:'0.18em', background:p.accent, color:BG, padding:'4px 12px' }}>{p.badge}</div>}
                {p.fill && <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${G},#5eeaf0)` }} />}
                <div style={{ marginBottom:28 }}>
                  <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:'0.25em', color:p.textAccent, marginBottom:14 }}>{p.tier}</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:4 }}>
                    <span style={{ fontFamily:"-apple-system, 'Segoe UI', system-ui, 'Helvetica Neue', Arial, sans-serif", fontSize:60, color:p.textAccent, lineHeight:1 }}>{p.price}</span>
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
                  background: p.fill ? `linear-gradient(135deg,${p.accent},#2f6bd6)` : 'transparent',
                  color: p.fill ? BG : p.textAccent,
                  border: `1px solid ${p.accent}`,
                  boxShadow: p.fill ? `0 0 24px rgba(57,226,230,0.2)` : 'none',
                }}>{p.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section style={{ padding:'112px 32px 80px', background:S, borderBottom:`1px solid ${B}` }}>
        <div style={{ maxWidth:720, margin:'0 auto', textAlign:'center' }}>
          <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:'0.3em', color:G, marginBottom:20 }}>{'// START TODAY'}</div>
          <h2 style={{ fontFamily:"-apple-system, 'Segoe UI', system-ui, 'Helvetica Neue', Arial, sans-serif", lineHeight:0.88, margin:'0 0 28px' }}>
            <span style={{ display:'block', fontSize:'clamp(56px,9vw,120px)', color:T }}>OPERATE WITH</span>
            <span style={{ display:'block', fontSize:'clamp(56px,9vw,120px)', background:`linear-gradient(135deg,${G},#5eeaf0,#2f6bd6)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>REAL EDGE</span>
          </h2>
          <p style={{ fontFamily:'monospace', fontSize:12, color:D, lineHeight:1.9, marginBottom:44 }}>
            Free account in 30 seconds. No credit card required.<br />
            Immediate access to all dashboard tools.
          </p>
          <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap', marginBottom:64 }}>
            <Link href="/en/registro" style={{ background:`linear-gradient(135deg,${G},#2f6bd6)`, color:BG, fontFamily:'monospace', fontSize:11, letterSpacing:'0.22em', padding:'16px 44px', textDecoration:'none', boxShadow:`0 0 40px rgba(57,226,230,0.3)` }}>
              CREATE FREE ACCOUNT
            </Link>
            <Link href="/en/login" style={{ border:`1px solid ${B}`, color:D, background:'rgba(255,255,255,0.02)', fontFamily:'monospace', fontSize:11, letterSpacing:'0.18em', padding:'16px 28px', textDecoration:'none' }}>
              ALREADY HAVE AN ACCOUNT →
            </Link>
          </div>
          <div style={{ borderTop:`1px solid ${B}`, paddingTop:28, textAlign:'left' }}>
            <p style={{ fontFamily:'monospace', fontSize:9, color:DIM, letterSpacing:'0.08em', lineHeight:1.8 }}>
              LEGAL NOTICE: SQuant Desk is an analytical tools platform and does not constitute financial, investment, tax or legal advice. Models, signals and analyses are for informational purposes only. Past results do not guarantee future returns. All trading involves risk of partial or total loss of invested capital. Only trade with capital you can afford to lose.
            </p>
          </div>
        </div>
      </section>

    </main>
  )
}
