'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/app/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface KellyLedger {
  base_pct?: number; dd_mult?: number; stress_mult?: number
  exposure_mult?: number; regime_mult?: number; eff_risk_pct?: number
}
interface Champion {
  slot?: number; sym?: string; tf?: string; strategy?: string; type?: string; direction?: string
  grade?: string; score?: number; robustness_score?: number; robustness_action?: string; robustness_gates?: string[]
  cagr?: number; wr?: number; dd?: number; trades?: number
  wft_verdict?: string; wft_pass_rate?: number; wft_windows?: number; val_wft?: number
  mc_confidence?: number; mc_cagr_p05?: number; mc_dd_p95?: number; val_mc?: number
  val_confidence?: string
  eff_risk_pct?: number; _kelly_ledger?: KellyLedger
  notional_usd?: number; risk_usd?: number; reward_usd_at_tp?: number
  size_factor_x?: number; equity_used?: number
  price?: number; sl?: number; tp?: number
  signal?: boolean; regime_ok?: boolean
  recommendation?: string; reason?: string
  lsr?: number; lsr_long_pct?: number; oi_change_pct?: number
  fg?: number; fg_label?: string; funding_pct?: number
  n_live_trades?: number; live_wr?: number; ev?: number
  decay_warning?: boolean; corr_warning?: boolean; htf_confirms?: boolean
  stress_mult?: number; ens_mult?: number
}

// ─── Motores ─────────────────────────────────────────────────────────────────
interface MotorDef {
  id: number; name: string; label: string; color: string
  syms: string[]; desc: string; status: 'ACTIVO' | 'PRÓXIMAMENTE'
}
const MOTORS: MotorDef[] = [
  { id:1, name:'M1', label:'CRYPTO',          color:'#39e2e6', syms:['BTC','ETH','SOL','BNB','LTC'],     status:'ACTIVO',       desc:'BTC · ETH · SOL · BNB · LTC — Futures perpetuos Binance' },
  { id:2, name:'M2', label:'COMMODITIES',     color:'#1D9E75', syms:['XAU','XAG','WTI','HG','NG','PL','XPD','URNM'], status:'ACTIVO', desc:'XAU · XAG · WTI · HG · NG · PL · XPD · URNM — CFDs futuros yfinance' },
  { id:3, name:'M3', label:'STOCKS US',       color:'#378ADD', syms:['AAPL','NVDA','TSLA','JPM','XOM','CVX'], status:'ACTIVO',   desc:'AAPL · NVDA · TSLA · JPM · XOM · CVX — Acciones S&P 500 · 15m/1h/4h/1d' },
  { id:4, name:'M4', label:'ÍNDICES',         color:'#5b8def', syms:['SPY','QQQ','IWM','XLE'],           status:'ACTIVO',       desc:'SPY · QQQ · IWM · XLE — ETFs de índices y sectores US · 15m/1h/4h/1d' },
  { id:5, name:'M5', label:'INTERNACIONAL',   color:'#a78bfa', syms:['EWJ','EWT','EWY'],                status:'ACTIVO',       desc:'EWJ (Japón) · EWT (Taiwán) · EWY (Corea) — ETFs país vía yfinance · EWZ excluido por tracking' },
  { id:6, name:'M6', label:'BONOS & MACRO',   color:'#7a7f9a', syms:['TLT','HYG','TBT','ZN','ZB'],       status:'PRÓXIMAMENTE', desc:'Treasury 20Y+ · High Yield · Notas/Bonos 10Y-30Y — duration y crédito · Broker: IBKR' },
  { id:7, name:'M7', label:'FUTUROS ÍNDICES', color:'#7a7f9a', syms:['MES','MNQ','MYM'],                status:'PRÓXIMAMENTE', desc:'S&P 500 · Nasdaq 100 · Dow Jones — micro-futuros CME · Broker: IBKR' },
  { id:8, name:'M8', label:'FOREX & ÍNDICES INTL', color:'#7a7f9a', syms:['EUR/USD','GBP/USD','USD/JPY','USD/CHF'], status:'PRÓXIMAMENTE', desc:'Majors vía IBKR IDEALPRO — DAX/FTSE/Nikkei en fase 2 (margen multi-moneda)' },
  { id:9, name:'M9', label:'LATAM',           color:'#7a7f9a', syms:[],                                  status:'PRÓXIMAMENTE', desc:'Acciones Chile · Brasil · México' },
]

// Timeframes fijos de la matriz simbolo x timeframe -- reemplaza el podio
// top-3-por-CAGR-crudo (mezclaba simbolos/timeframes de un motor sin orden
// claro) por una grilla donde cada casilla (ej. "BTC 15m") se ubica al toque.
const FIXED_TFS = ['15m', '1h', '4h', '1d'] as const

// ─── Tokens ───────────────────────────────────────────────────────────────────
const MONO  = "var(--font-dm-mono,'DM Mono',monospace)"
const BEBAS = "'Bebas Neue',Impact,sans-serif"
const GRN   = '#1D9E75'
const RED   = '#f87171'
const GOLD  = '#39e2e6'
const SURF  = '#0b0d14'
const BG    = '#04050a'
const BDR   = '#1a1d2e'
const DIM   = '#7a7f9a'
const MUTED = '#3a3f55'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function p0(n?: number | null) { if (n==null||isNaN(n)) return '—'; return `${n>=0?'+':''}${Math.round(n)}%` }
function p1(n?: number | null) { if (n==null||isNaN(n)) return '—'; return `${n>=0?'+':''}${n.toFixed(1)}%` }
function fx(n?: number | null, d=2) { if (n==null) return '—'; return n.toFixed(d) }
function usd(n?: number | null) { if (!n) return '—'; return `$${n.toLocaleString('en-US',{maximumFractionDigits:0})}` }
function pctSign(n?: number | null) { if (n==null) return '—'; return `${(n*100).toFixed(3)}%` }

function champDir(c: Champion): 'long'|'short'|'adaptive' {
  const v = (c.type ?? c.direction ?? '').toLowerCase()
  if (v==='long')  return 'long'
  if (v==='short') return 'short'
  return 'adaptive'
}
function champSym(c: Champion) { return (c.sym ?? '?').toUpperCase() }
function champTF(c: Champion)  { return (c.tf  ?? '?').toLowerCase() }
function gradeClr(g?: string) {
  if (g==='A+') return '#ffd700'
  if (g==='A')  return GRN
  if (g==='B')  return '#378ADD'
  return MUTED
}
function fmtStrat(s?: string) {
  return (s??'—').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
}
function motorOf(c: Champion): number {
  const s = champSym(c)
  const m = MOTORS.find(m => m.syms.includes(s))
  return m ? m.id : 0
}
function champKey(c: Champion) {
  return `${c.sym}-${c.tf}-${c.strategy}-${c.type}-${c.slot}`
}

// ─── CountUp — anima de valor previo → target con ease-out cúbico ─────────────
function useCountUp(target: number, dur = 1000) {
  const [v, setV] = useState(0)
  const vRef    = useRef(0)
  const fromRef = useRef(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      vRef.current = target; fromRef.current = target; setV(target)
      return
    }
    const from = fromRef.current
    let raf = 0
    let t0: number | null = null
    const tick = (t: number) => {
      if (t0 === null) t0 = t
      const p = Math.min(1, (t - t0) / dur)
      const val = from + (target - from) * (1 - Math.pow(1 - p, 3))
      vRef.current = val
      setV(val)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); fromRef.current = vRef.current }
  }, [target, dur])
  return v
}

// ─── Tilt 3D para el #1 del podio — CSS vars al DOM, sin re-renders ───────────
function TiltWrap({ children, style, delay }: { children: React.ReactNode; style?: React.CSSProperties; delay?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  function onMove(e: React.MouseEvent) {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return
    const r  = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--px', px.toFixed(3))
    el.style.setProperty('--py', py.toFixed(3))
    el.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`)
    el.classList.add('mdl-on')
  }
  function onLeave() {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--px', '0')
    el.style.setProperty('--py', '0')
    el.classList.remove('mdl-on')
  }
  return (
    <div style={{ perspective: 750, ...style }} className="mdl-in">
      <div ref={ref} className="mdl-tilt" onMouseMove={onMove} onMouseLeave={onLeave} style={{ animationDelay: delay }}>
        <span className="mdl-tilt-shine" aria-hidden />
        {children}
      </div>
    </div>
  )
}

// ─── Panel de detalles (expandible) ──────────────────────────────────────────
function DetailPanel({ c }: { c: Champion }) {
  const kl = c._kelly_ledger ?? {}
  const fgClr = c.fg!=null ? (c.fg<=25 ? RED : c.fg>=75 ? GRN : GOLD) : MUTED
  const wrDisplay = c.wr!=null ? (c.wr<=1 ? c.wr*100 : c.wr) : null

  type Row = [string, string, string?]
  const Section = ({ title, rows }: { title: string; rows: Row[] }) => (
    <div style={{ background: BG, border:`1px solid ${BDR}`, padding:'12px 14px', minWidth:170 }}>
      <div style={{ fontFamily:MONO, fontSize:8, color:MUTED, letterSpacing:'0.2em', marginBottom:8, textTransform:'uppercase' }}>{title}</div>
      {rows.map(([lbl,val,clr]) => (
        <div key={lbl} style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:4 }}>
          <span style={{ fontFamily:MONO, fontSize:10, color:DIM, flexShrink:0 }}>{lbl}</span>
          <span style={{ fontFamily:MONO, fontSize:11, color:clr??'#e8e9f0', fontWeight:600, textAlign:'right' }}>{val}</span>
        </div>
      ))}
    </div>
  )

  const wftClr = c.wft_verdict==='PASS' ? GRN : c.wft_verdict==='FAIL' ? RED : MUTED
  const robClr = c.robustness_action==='PASS_LIVE' ? GRN : c.robustness_action==='BLOCKED' ? RED : GOLD

  return (
    <div style={{ background:SURF, borderBottom:`1px solid ${BDR}`, padding:'14px 16px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))', gap:8 }}>

        <Section title="BACKTEST OOS" rows={[
          ['CAGR',        p0(c.cagr),         c.cagr!=null?(c.cagr>=50?GRN:c.cagr>=0?GOLD:RED):MUTED],
          ['Win Rate',    wrDisplay!=null?`${wrDisplay.toFixed(1)}%`:'—', wrDisplay!=null?(wrDisplay>=65?GRN:wrDisplay>=50?GOLD:RED):MUTED],
          ['Max DD',      p1(c.dd),            RED],
          ['Trades',      c.trades?.toLocaleString()??'—', c.trades!=null&&c.trades>=30?GRN:GOLD],
          ['Score',       fx(c.score),         GOLD],
          ['Robustness',  fx(c.robustness_score), c.robustness_score!=null&&c.robustness_score>=0.7?GRN:GOLD],
        ]} />

        <Section title="WALK-FORWARD" rows={[
          ['Veredicto',   c.wft_verdict||'—',   wftClr],
          ['OOS WR',      c.val_wft!=null?`${c.val_wft.toFixed(1)}%`:'—', c.val_wft!=null&&c.val_wft>=60?GRN:GOLD],
          ['Pass rate',   c.wft_pass_rate!=null?`${c.wft_pass_rate.toFixed(0)}%`:'—', MUTED],
          ['Ventanas',    c.wft_windows?.toString()??'—', MUTED],
        ]} />

        <Section title="MONTE CARLO" rows={[
          ['Confianza',   c.val_mc!=null?`${c.val_mc.toFixed(1)}%`:'—',  c.val_mc!=null&&c.val_mc>=80?GRN:GOLD],
          ['MC conf raw', c.mc_confidence!=null?`${c.mc_confidence.toFixed(0)}%`:'—', MUTED],
          ['CAGR p05',    c.mc_cagr_p05!=null?p0(c.mc_cagr_p05):'—',    MUTED],
          ['DD p95',      c.mc_dd_p95!=null?`${c.mc_dd_p95.toFixed(1)}%`:'—', RED],
          ['Nivel val.',  c.val_confidence??'—', GOLD],
        ]} />

        <Section title="SIZING KELLY" rows={[
          ['Base Kelly',  kl.base_pct!=null?`${kl.base_pct.toFixed(2)}%`:c.eff_risk_pct!=null?`${c.eff_risk_pct.toFixed(2)}%`:'—', GOLD],
          ['Eff. riesgo', c.eff_risk_pct!=null?`${c.eff_risk_pct.toFixed(2)}%`:'—', GRN],
          ['Stress ×',    kl.stress_mult!=null?`×${kl.stress_mult.toFixed(3)}`:'—',  MUTED],
          ['Notional',    usd(c.notional_usd),   MUTED],
          ['Riesgo USD',  usd(c.risk_usd),        RED],
          ['Reward USD',  usd(c.reward_usd_at_tp),GRN],
        ]} />

        <Section title="SEÑAL ACTUAL" rows={[
          ['Señal',       c.signal?'✓ ACTIVA':'○ NINGUNA', c.signal?GRN:MUTED],
          ['Precio',      usd(c.price),           '#e8e9f0'],
          ['SL',          usd(c.sl),              RED],
          ['TP',          usd(c.tp),              GRN],
          ['Rec.',        c.recommendation??'—',  GOLD],
          ['Régimen OK',  c.regime_ok?'SÍ':'NO',  c.regime_ok?GRN:RED],
        ]} />

        <Section title="DERIVADOS" rows={[
          ['LSR ratio',   c.lsr?.toFixed(3)??'—',  MUTED],
          ['% Longs',     c.lsr_long_pct!=null?`${c.lsr_long_pct.toFixed(1)}%`:'—', MUTED],
          ['OI cambio',   c.oi_change_pct!=null?`${c.oi_change_pct>0?'+':''}${c.oi_change_pct.toFixed(2)}%`:'—', MUTED],
          ['Funding',     c.funding_pct!=null?pctSign(c.funding_pct):'—', MUTED],
          ['F&G',         c.fg!=null?`${c.fg} — ${c.fg_label??''}`:'—', fgClr],
        ]} />

        <Section title="LIVE / BAYESIAN" rows={[
          ['n live',      c.n_live_trades?.toString()??'—',  MUTED],
          ['Live WR',     c.live_wr!=null?`${c.live_wr.toFixed(1)}%`:'—', c.live_wr!=null&&c.live_wr>=50?GRN:RED],
          ['EV',          c.ev!=null?c.ev.toFixed(3):'—',   c.ev!=null&&c.ev>0?GRN:RED],
          ['Rob. acción', c.robustness_action??'—',          robClr],
        ]} />

      </div>

      {/* Warnings */}
      {(c.decay_warning||c.corr_warning||(c.robustness_gates?.length??0)>0) && (
        <div style={{ marginTop:10, display:'flex', gap:6, flexWrap:'wrap' }}>
          {c.decay_warning && <span style={{ fontFamily:MONO, fontSize:9, color:'#f59e0b', border:'1px solid #f59e0b30', padding:'2px 7px' }}>⚠ DECAY</span>}
          {c.corr_warning  && <span style={{ fontFamily:MONO, fontSize:9, color:'#f59e0b', border:'1px solid #f59e0b30', padding:'2px 7px' }}>⚠ CORR</span>}
          {c.robustness_gates?.map(g=>(
            <span key={g} style={{ fontFamily:MONO, fontSize:9, color:RED, border:`1px solid ${RED}30`, padding:'2px 7px' }}>✗ {g}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Inspector bloqueado — plan free (el server ya filtra los campos) ─────────
function LockedInspector() {
  return (
    <div style={{ background:SURF, borderBottom:`1px solid ${BDR}`, padding:'22px 16px', textAlign:'center' }}>
      <div style={{ fontFamily:MONO, fontSize:11, color:'#ffb454', letterSpacing:'0.12em', marginBottom:6 }}>
        🔒 INSPECTOR COMPLETO · EXCLUSIVO PRO
      </div>
      <div style={{ fontFamily:MONO, fontSize:10, color:MUTED, lineHeight:1.7, maxWidth:440, margin:'0 auto 12px' }}>
        Walk-forward, Monte Carlo, sizing Kelly, derivados y validación live del modelo.
      </div>
      <a href="/planes" onClick={e=>e.stopPropagation()} style={{
        display:'inline-block', fontFamily:MONO, fontSize:10, letterSpacing:'0.18em',
        color:'#ffb454', border:'1px solid rgba(255,180,84,0.35)', borderRadius:6,
        padding:'8px 18px', textDecoration:'none',
      }}>
        ACTIVAR PRO →
      </a>
    </div>
  )
}

const RANK_STYLE: Record<number, { bg:string; fg:string }> = {
  1: { bg:'linear-gradient(135deg,#ffe9a8,#39e2e6)', fg:'#1a1300' },
  2: { bg:'linear-gradient(135deg,#eef0f5,#9aa3b5)', fg:'#13151c' },
  3: { bg:'linear-gradient(135deg,#e8a565,#b5651d)', fg:'#1f0d00' },
}

// Marcos metálicos del podio (borde con gradiente via padding-box/border-box)
const PODIUM_FRAME: Record<number, { grad:string; glow:string; wm:string }> = {
  1: { grad:'linear-gradient(135deg,#ffe9a8,#39e2e6 40%,#8a7222)', glow:`0 0 26px ${GOLD}33, 0 14px 34px rgba(0,0,0,0.5)`, wm:'rgba(57,226,230,0.07)' },
  2: { grad:'linear-gradient(135deg,#f0f2f7,#9aa3b5 45%,#5c6474)', glow:'0 10px 26px rgba(0,0,0,0.45)',                    wm:'rgba(154,163,181,0.06)' },
  3: { grad:'linear-gradient(135deg,#e8a565,#b5651d 45%,#6e3c10)', glow:'0 10px 26px rgba(0,0,0,0.45)',                    wm:'rgba(181,101,29,0.07)'  },
}

// ─── Tarjeta de champion (vitrina) ───────────────────────────────────────────
function ChampCard({ c, rank, motorColor, expanded, onToggle, podium, isPro, hideBadge }: {
  c:Champion; rank?:number; motorColor:string; expanded:boolean; onToggle:()=>void; podium?:boolean; isPro:boolean; hideBadge?:boolean
}) {
  const d = champDir(c)
  const isShort = d==='short', isAdapt = d==='adaptive'
  const dirClr = isAdapt?GOLD:isShort?RED:GRN
  const dirLbl = isAdapt?'◆ ADAPTIVE':isShort?'▼ SHORT':'▲ LONG'
  const gc = gradeClr(c.grade)
  const isChamp = c.grade === 'A+'
  const wr = c.wr!=null ? (c.wr<=1?c.wr*100:c.wr) : null
  const wftClr = c.wft_verdict==='PASS' ? GRN : c.wft_verdict==='FAIL' ? RED : MUTED
  const rs = rank ? RANK_STYLE[rank] : undefined
  const frame = podium && rank ? PODIUM_FRAME[rank] : undefined
  const isFirst = podium && rank===1
  const kpiSize = isFirst ? 21 : 16
  const symSize = isFirst ? 27 : 20

  const baseBg = isChamp ? `linear-gradient(160deg,${GOLD}12,${SURF} 55%)` : SURF

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={e=>{ if(e.key==='Enter'||e.key===' ') onToggle() }}
      className={`modelos-champ-card${isFirst?' modelos-champ-card--rank1':''}`}
      style={{
        position:'relative',
        gridColumn: !podium && expanded ? '1 / -1' : undefined,
        ...(frame ? {
          overflow:'hidden',
          border:'1px solid transparent',
          background:`${`linear-gradient(160deg,${rank===1?GOLD+'14':SURF},${SURF} 60%)`} padding-box, ${frame.grad} border-box`,
          boxShadow: frame.glow,
        } : {
          background: baseBg,
          border: `1px solid ${isChamp?GOLD+'70':motorColor+'30'}`,
          boxShadow: isChamp ? `0 0 14px ${GOLD}22` : 'none',
        }),
        borderRadius: 6, padding: isFirst ? '16px 18px' : '12px 14px', cursor:'pointer',
        display:'flex', flexDirection:'column', gap:8,
      }}
    >
      {/* Símbolo grabado de fondo — solo podio */}
      {frame && (
        <span aria-hidden style={{ position:'absolute', right:-4, bottom:-18, fontFamily:BEBAS, fontSize: isFirst?96:72, lineHeight:1, color:frame.wm, pointerEvents:'none', userSelect:'none' }}>
          {champSym(c)}
        </span>
      )}
      {rs && !hideBadge && (
        <span style={{
          position:'absolute', top:podium?10:-9, right:12,
          fontFamily:BEBAS, fontSize:podium?13:11, letterSpacing:'0.05em',
          color:rs.fg, background:rs.bg,
          padding:podium?'3px 10px':'2px 8px', borderRadius:10, boxShadow:'0 2px 6px rgba(0,0,0,0.45)',
          zIndex:1,
        }}>{podium && rank===1 ? '★ #1' : `#${rank}`}</span>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:8, position:'relative' }}>
        <span style={{ fontFamily:MONO, fontSize:10, color:gc, fontWeight:700, border:`1px solid ${gc}60`, borderRadius:3, padding:'1px 5px' }}>{c.grade??'?'}</span>
        <span style={{ fontFamily:BEBAS, fontSize:symSize, color:'#e8e9f0', letterSpacing:'0.04em', lineHeight:1 }}>{champSym(c)}</span>
        <span style={{ fontFamily:MONO, fontSize:10, color:GOLD }}>{champTF(c).toUpperCase()}</span>
        {c.signal && <span style={{ marginLeft:'auto', width:6, height:6, borderRadius:'50%', background:GRN, boxShadow:`0 0 6px ${GRN}`, marginRight:rs&&podium?52:0 }} />}
        <span style={{ marginLeft: c.signal?0:'auto', fontFamily:MONO, fontSize:11, color:MUTED, transform:expanded?'rotate(180deg)':'none', transition:'transform 0.15s', marginRight:!c.signal&&rs&&podium?52:0 }}>▾</span>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, position:'relative' }}>
        <span style={{ fontFamily:MONO, fontSize:9, color:dirClr, background:`${dirClr}14`, padding:'2px 6px', borderRadius:3 }}>{dirLbl}</span>
        <span style={{ fontFamily:MONO, fontSize:10, color:DIM, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {fmtStrat(c.strategy)}
        </span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, paddingTop:8, borderTop:`1px solid ${BDR}`, position:'relative' }}>
        <div>
          <div style={{ fontFamily:MONO, fontSize:8, color:MUTED, letterSpacing:'0.1em' }}>CAGR</div>
          <div style={{ fontFamily:BEBAS, fontSize:kpiSize, color:c.cagr!=null?(c.cagr>=0?GRN:RED):MUTED }}>{p0(c.cagr)}</div>
        </div>
        <div>
          <div style={{ fontFamily:MONO, fontSize:8, color:MUTED, letterSpacing:'0.1em' }}>WIN RT</div>
          <div style={{ fontFamily:BEBAS, fontSize:kpiSize, color:wr!=null?(wr>=60?GRN:wr>=50?GOLD:RED):MUTED }}>{wr!=null?`${wr.toFixed(1)}%`:'—'}</div>
        </div>
        <div>
          <div style={{ fontFamily:MONO, fontSize:8, color:MUTED, letterSpacing:'0.1em' }}>MAX DD</div>
          <div style={{ fontFamily:BEBAS, fontSize:kpiSize, color:RED }}>{p1(c.dd)}</div>
        </div>
        <div>
          <div style={{ fontFamily:MONO, fontSize:8, color:MUTED, letterSpacing:'0.1em' }}>TRADES</div>
          <div style={{ fontFamily:BEBAS, fontSize:kpiSize, color:'#e8e9f0' }}>{c.trades?.toLocaleString()??'—'}</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, fontFamily:MONO, fontSize:9, position:'relative' }}>
        <span style={{ color: c.val_mc!=null&&c.val_mc>=80?GRN:GOLD }}>MC {c.val_mc!=null?`${c.val_mc.toFixed(0)}%`:'—'}</span>
        <span style={{ color:MUTED }}>·</span>
        <span style={{ color: wftClr }}>WFT {c.wft_verdict||'—'}</span>
      </div>

      {expanded && <div onClick={e=>e.stopPropagation()} style={{ marginTop:4, marginLeft:isFirst?-18:-14, marginRight:isFirst?-18:-14, marginBottom:isFirst?-16:-12, position:'relative' }}>{isPro ? <DetailPanel c={c} /> : <LockedInspector />}</div>}
    </div>
  )
}

// ─── Tabs de motor ────────────────────────────────────────────────────────────
function MotorTabs({ selected, onSelect, counts }: {
  selected: number; onSelect:(id:number)=>void; counts: Record<number, number>
}) {
  return (
    <div style={{ display:'flex', gap:4, flexWrap:'wrap', borderBottom:`1px solid ${BDR}`, marginBottom:18 }}>
      {MOTORS.map(m=>{
        const isSel = m.id===selected
        const n = counts[m.id] ?? 0
        const isActive = m.status==='ACTIVO'
        return (
          <button
            key={m.id}
            onClick={isActive ? ()=>onSelect(m.id) : undefined}
            disabled={!isActive}
            title={!isActive ? 'Próximamente — en desarrollo' : undefined}
            style={{
              display:'flex', alignItems:'center', gap:7,
              padding:'10px 16px', border:'none',
              background: isSel ? `linear-gradient(180deg,transparent 55%,${m.color}14)` : 'transparent',
              borderBottom:`2px solid ${isSel?m.color:'transparent'}`,
              boxShadow: isSel ? `0 8px 20px -10px ${m.color}aa` : 'none',
              textShadow: isSel ? `0 0 14px ${m.color}66` : 'none',
              cursor: isActive ? 'pointer' : 'not-allowed',
              fontFamily:BEBAS, fontSize:14, letterSpacing:'0.04em',
              color: isSel ? m.color : (isActive?DIM:MUTED),
              opacity: isActive||isSel ? 1 : 0.4,
              pointerEvents: isActive ? 'auto' : 'none',
              transition:'color .2s, background .2s, box-shadow .2s',
            }}
          >
            M{m.id} · {m.label}
            {isActive && n>0 && (
              <span style={{ fontFamily:MONO, fontSize:9, color: isSel?m.color:MUTED, background:`${m.color}18`, borderRadius:8, padding:'1px 6px' }}>{n}</span>
            )}
            {!isActive && (
              <span style={{
                fontFamily:MONO, fontSize:8, color:'#f59e0b',
                background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.25)',
                borderRadius:3, padding:'1px 5px', letterSpacing:'0.08em',
              }}>PRÓXIMAMENTE</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Ticker de resumen — los números cuentan al cargar/cambiar de motor ──────
function TickerBar({ champs }: { champs:Champion[] }) {
  const aPlus  = champs.filter(c=>c.grade==='A+').length
  const aGrd   = champs.filter(c=>c.grade==='A').length
  const longs  = champs.filter(c=>champDir(c)==='long').length
  const shorts = champs.filter(c=>champDir(c)==='short').length
  const sigs   = champs.filter(c=>c.signal).length
  const avgC   = champs.length ? champs.reduce((s,c)=>s+(c.cagr??0),0)/champs.length : 0

  // hooks siempre antes del return condicional
  const cN   = useCountUp(champs.length, 850)
  const cAp  = useCountUp(aPlus, 850)
  const cA   = useCountUp(aGrd, 850)
  const cLg  = useCountUp(longs, 900)
  const cSh  = useCountUp(shorts, 900)
  const cSig = useCountUp(sigs, 950)
  const cAvg = useCountUp(avgC, 1100)

  if (!champs.length) return null

  const Item = ({ l, v, c }:{l:string; v:string; c:string}) => (
    <span style={{ display:'flex', alignItems:'baseline', gap:5, whiteSpace:'nowrap' }}>
      <span style={{ fontFamily:MONO, fontSize:9, color:MUTED, letterSpacing:'0.1em' }}>{l}</span>
      <span style={{ fontFamily:BEBAS, fontSize:16, color:c }}>{v}</span>
    </span>
  )
  const Sep = () => <span style={{ color:BDR }}>│</span>

  return (
    <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', padding:'2px 2px 16px' }}>
      <Item l="CHAMPIONS" v={Math.round(cN).toString()} c={GOLD} /><Sep/>
      <Item l="A+" v={Math.round(cAp).toString()} c="#ffd700" />
      <Item l="A" v={Math.round(cA).toString()} c={GRN} /><Sep/>
      <Item l="LONGS" v={Math.round(cLg).toString()} c={GRN} />
      <Item l="SHORTS" v={Math.round(cSh).toString()} c={RED} /><Sep/>
      <Item l="CAGR PROM" v={p0(cAvg)} c={GRN} />
      <Item l="CON SEÑAL" v={Math.round(cSig).toString()} c={sigs>0?GRN:MUTED} />
    </div>
  )
}

// ─── Tablero de un motor: filtros + grilla plana ─────────────────────────────
function ChampionsBoard({ motor, champs, isPro }: { motor:MotorDef; champs:Champion[]; isPro:boolean }) {
  const [filter, setFilter]   = useState<'all'|'long'|'short'|'adaptive'>('all')
  const [expandedKey, setKey] = useState<string|null>(null)
  const toggle = (k:string) => setKey(prev=>prev===k?null:k)

  if (motor.status!=='ACTIVO') {
    return (
      <div style={{ padding:'40px 24px', background:BG, textAlign:'center', border:`1px solid ${BDR}` }}>
        <div style={{ fontFamily:BEBAS, fontSize:24, color:MUTED, letterSpacing:'0.12em', marginBottom:8 }}>EN DESARROLLO</div>
        <div style={{ fontFamily:MONO, fontSize:11, color:MUTED }}>{motor.desc}</div>
      </div>
    )
  }
  if (champs.length===0) {
    return (
      <div style={{ padding:'24px 20px', background:BG, border:`1px solid ${BDR}` }}>
        <span style={{ fontFamily:MONO, fontSize:11, color:MUTED }}>Sin champions activos — trainer buscando modelos…</span>
      </div>
    )
  }

  const longs  = champs.filter(c=>champDir(c)==='long').length
  const shorts = champs.filter(c=>champDir(c)==='short').length
  const adapt  = champs.filter(c=>champDir(c)==='adaptive').length

  const filtered = champs
    .filter(c => filter==='all' || champDir(c)===filter)
    .sort((a,b) => (b.cagr ?? -9999) - (a.cagr ?? -9999))

  const FILTERS: Array<{ k:'all'|'long'|'short'|'adaptive'; lbl:string; n:number; c:string }> = [
    { k:'all',   lbl:'TODOS',      n:champs.length, c:GOLD },
    { k:'long',  lbl:'▲ LONG',     n:longs,         c:GRN  },
    { k:'short', lbl:'▼ SHORT',    n:shorts,        c:RED  },
    ...(adapt>0 ? [{ k:'adaptive' as const, lbl:'◆ ADAPTIVE', n:adapt, c:GOLD }] : []),
  ]

  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        {FILTERS.map(f=>(
          <button
            key={f.k}
            onClick={()=>setFilter(f.k)}
            style={{
              fontFamily:MONO, fontSize:10, letterSpacing:'0.06em',
              padding:'6px 12px', borderRadius:14, cursor:'pointer',
              border:`1px solid ${filter===f.k?f.c:BDR}`,
              background: filter===f.k?`${f.c}14`:'transparent',
              color: filter===f.k?f.c:DIM,
            }}
          >
            {f.lbl} <span style={{ opacity:0.65 }}>{f.n}</span>
          </button>
        ))}
      </div>
      {/* ── Matriz simbolo x timeframe: cada casilla es 1 champion, sin ── */}
      {/* ranking artificial -- solo tiering visual por grade (oro/plata/bronce). */}
      <div className="mdl-matrix-head" style={{ display:'grid', gridTemplateColumns:`92px repeat(${FIXED_TFS.length}, minmax(150px,1fr))`, gap:10, marginBottom:8, padding:'0 2px' }}>
        <div />
        {FIXED_TFS.map(tf => (
          <div key={tf} style={{ fontFamily:MONO, fontSize:10, letterSpacing:'0.16em', color:MUTED, textAlign:'center' }}>{tf.toUpperCase()}</div>
        ))}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {motor.syms.map((sym, si) => {
          const rowChamps = FIXED_TFS.map(tf => filtered.find(c => champSym(c)===sym && champTF(c)===tf))
          const hasAny = rowChamps.some(Boolean)
          return (
            <div
              key={sym} className="mdl-in"
              style={{ display:'grid', gridTemplateColumns:`92px repeat(${FIXED_TFS.length}, minmax(150px,1fr))`, gap:10, alignItems:'start', opacity:hasAny?1:0.4, animationDelay:`${Math.min(si,10)*40}ms` }}
            >
              <div style={{ fontFamily:BEBAS, fontSize:19, color:'#e8e9f0', letterSpacing:'0.03em', display:'flex', alignItems:'center' }}>{sym}</div>
              {FIXED_TFS.map((tf, ci) => {
                const c = rowChamps[ci]
                if (!c) {
                  return (
                    <div key={tf} style={{ border:`1px dashed ${BDR}`, borderRadius:6, minHeight:58, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ fontFamily:MONO, fontSize:9, color:MUTED }}>—</span>
                    </div>
                  )
                }
                const k = champKey(c)
                const tier = c.grade==='A+' ? 1 : c.grade==='A' ? 2 : 3
                return (
                  <div key={tf} style={{ gridColumn: expandedKey===k ? `${ci+2} / -1` : undefined }}>
                    <ChampCard
                      c={c} motorColor={motor.color} isPro={isPro}
                      podium rank={tier} hideBadge
                      expanded={expandedKey===k} onToggle={()=>toggle(k)}
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function ModelosPage() {
  const [champs,     setChamps]     = useState<Champion[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string|null>(null)
  const [selMotor,   setSelMotor]   = useState(1)
  const [isPro,      setIsPro]      = useState(false)

  // Plan del usuario — solo para elegir la UI (candado vs Inspector);
  // el server ya filtra los campos del detalle para no-PRO.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const plan = (data.user?.app_metadata?.plan as string) ?? 'free'
      setIsPro(plan === 'pro' || plan === 'anual')
    }).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/vps/champions', { cache:'no-store' })
      if (r.ok) {
        const d = await r.json()
        if (Array.isArray(d)) {
          setChamps(d)
          setLastUpdate(new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}))
        }
      }
    } catch { /* offline */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 90_000)
    return () => clearInterval(id)
  }, [load])

  const counts: Record<number, number> = {}
  for (const m of MOTORS) counts[m.id] = champs.filter(c=>motorOf(c)===m.id).length
  const motor = MOTORS.find(m=>m.id===selMotor) ?? MOTORS[0]
  const motorChamps = champs.filter(c=>motorOf(c)===selMotor)

  return (
    <div style={{ minHeight:'100vh', background:BG, color:'#e8e9f0', fontFamily:MONO }}>
      <style>{`
        .modelos-champ-card { transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }
        .modelos-champ-card:hover { transform: translateY(-3px); box-shadow: 0 10px 22px rgba(0,0,0,0.4); }
        .modelos-champ-card--rank1 { animation: modelosChampPulse 2.6s ease-in-out infinite; }
        @keyframes modelosChampPulse {
          0%, 100% { box-shadow: 0 0 18px rgba(57,226,230,0.25), 0 14px 34px rgba(0,0,0,0.5); }
          50%      { box-shadow: 0 0 32px rgba(57,226,230,0.55), 0 14px 34px rgba(0,0,0,0.5); }
        }

        /* ── Podio top 3 ── */
        .mdl-podium { display:grid; grid-template-columns:1fr 1.18fr 1fr; gap:14px; align-items:start; margin-bottom:18px; }
        .mdl-side { margin-top:28px; }
        @media (max-width:760px) {
          .mdl-podium { grid-template-columns:1fr; }
          .mdl-side { margin-top:0; }
        }

        /* ── Cascada de entrada ── */
        .mdl-in { animation: mdlIn .42s ease both; }
        @keyframes mdlIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }

        /* ── Tilt 3D del #1 ── */
        .mdl-tilt { --px:0; --py:0; --mx:50%; --my:30%; position:relative;
          transform: rotateX(calc(var(--py) * -5deg)) rotateY(calc(var(--px) * 7deg));
          transition: transform .5s ease; will-change: transform; }
        .mdl-tilt.mdl-on { transition: transform .1s ease-out; }
        .mdl-tilt-shine { position:absolute; inset:0; z-index:2; opacity:0; transition:opacity .35s; pointer-events:none; border-radius:6px;
          background: radial-gradient(280px circle at var(--mx) var(--my), rgba(57,226,230,.13), transparent 65%); }
        .mdl-tilt.mdl-on .mdl-tilt-shine { opacity:1; }

        /* ── Loader encendido ── */
        .mdl-pulse { animation: mdlPulse 1.5s ease-in-out infinite; }
        @keyframes mdlPulse { 0%,100% { opacity:.45; transform:scale(.96); } 50% { opacity:1; transform:scale(1.04); } }
        .mdl-scan { animation: mdlScan 1.2s ease-in-out infinite alternate; }
        @keyframes mdlScan { from { transform:translateX(-10px); } to { transform:translateX(102px); } }

        @media (prefers-reduced-motion: reduce) {
          .mdl-in { animation:none; }
          .mdl-tilt { transform:none !important; transition:none; }
          .mdl-tilt-shine { display:none; }
          .mdl-pulse, .mdl-scan { animation:none; }
          .modelos-champ-card--rank1 { animation:none; }
          .modelos-champ-card:hover { transform:none; }
        }
      `}</style>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'88px 24px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'0.28em', color:MUTED, marginBottom:8, textTransform:'uppercase' }}>
            {'// SQUANT DESK · MOTOR CUÁNTICO · PAPER TRADING'}
          </div>
          <h1 style={{ fontFamily:BEBAS, fontSize:'clamp(38px,5vw,60px)', lineHeight:0.95, margin:'0 0 10px' }}>
            <span style={{ color:'#e8e9f0' }}>MODELOS</span>{' '}
            <span style={{ background:`linear-gradient(135deg,${GOLD},#f5c842,#2f6bd6)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              EN PRODUCCIÓN
            </span>
          </h1>
          <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
            <span style={{ fontFamily:MONO, fontSize:10, color:MUTED }}>
              {loading ? 'Conectando…' : lastUpdate ? `↻ ${lastUpdate}` : 'Motor offline'}
            </span>
            <span style={{ color:BDR }}>·</span>
            <span style={{ fontFamily:MONO, fontSize:9, color:MUTED }}>Click en una tarjeta para estadísticas completas</span>
          </div>
        </div>

        {/* Tabs de motor */}
        <MotorTabs selected={selMotor} onSelect={setSelMotor} counts={counts} />

        {loading ? (
          /* Encendido — conectando al motor */
          <div style={{ padding:'72px 0', textAlign:'center' }}>
            <div className="mdl-pulse" style={{ fontFamily:BEBAS, fontSize:56, color:GOLD, lineHeight:1 }}>Σ</div>
            <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:'0.32em', color:MUTED, marginTop:14 }}>CONECTANDO AL MOTOR…</div>
            <div style={{ width:140, height:2, margin:'16px auto 0', background:BDR, overflow:'hidden', borderRadius:2 }}>
              <div className="mdl-scan" style={{ width:48, height:'100%', background:`linear-gradient(90deg,transparent,${GOLD},transparent)` }} />
            </div>
          </div>
        ) : (
          <>
            {/* Ticker de resumen del motor seleccionado */}
            <TickerBar champs={motorChamps} />

            {/* Tablero del motor seleccionado */}
            <ChampionsBoard motor={motor} champs={motorChamps} isPro={isPro} />
          </>
        )}

      </div>
    </div>
  )
}
