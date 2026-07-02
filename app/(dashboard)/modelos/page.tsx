'use client'
import { useState, useEffect, useCallback } from 'react'

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
  { id:1, name:'M1', label:'CRYPTO',          color:'#d4af37', syms:['BTC','ETH','SOL','BNB','LTC'],     status:'ACTIVO',       desc:'BTC · ETH · SOL · BNB · LTC — Futures perpetuos Binance' },
  { id:2, name:'M2', label:'COMMODITIES',     color:'#1D9E75', syms:['XAU','XAG','WTI','HG','NG','PL'], status:'ACTIVO',       desc:'XAU · XAG · WTI · HG · NG · PL — CFDs futuros yfinance' },
  { id:3, name:'M3', label:'STOCKS US',       color:'#378ADD', syms:['AAPL','NVDA','TSLA','JPM','XOM'], status:'ACTIVO',       desc:'AAPL · NVDA · TSLA · JPM · XOM — Acciones S&P 500 · 15m/1h/4h/1d' },
  { id:4, name:'M4', label:'BONOS & MACRO',   color:'#7a7f9a', syms:['TLT','HYG','TBT','ZN','ZB'],       status:'PRÓXIMAMENTE', desc:'Treasury 20Y+ · High Yield · Notas/Bonos 10Y-30Y — duration y crédito · Broker: IBKR' },
  { id:5, name:'M5', label:'FUTUROS ÍNDICES', color:'#7a7f9a', syms:['MES','MNQ','MYM'],                status:'PRÓXIMAMENTE', desc:'S&P 500 · Nasdaq 100 · Dow Jones — micro-futuros CME · Broker: IBKR' },
  { id:6, name:'M6', label:'FOREX & ÍNDICES INTL', color:'#7a7f9a', syms:['EUR/USD','GBP/USD','USD/JPY','USD/CHF'], status:'PRÓXIMAMENTE', desc:'Majors vía IBKR IDEALPRO — DAX/FTSE/Nikkei en fase 2 (margen multi-moneda)' },
  { id:7, name:'M7', label:'LATAM',           color:'#7a7f9a', syms:[],                                  status:'PRÓXIMAMENTE', desc:'Acciones Chile · Brasil · México' },
]

// ─── Tokens ───────────────────────────────────────────────────────────────────
const MONO  = "var(--font-dm-mono,'DM Mono',monospace)"
const BEBAS = "'Bebas Neue',Impact,sans-serif"
const GRN   = '#1D9E75'
const RED   = '#f87171'
const GOLD  = '#d4af37'
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
  if (MOTORS[0].syms.includes(s)) return 1
  if (MOTORS[1].syms.includes(s)) return 2
  if (MOTORS[2].syms.includes(s)) return 3
  return 0
}
function champKey(c: Champion) {
  return `${c.sym}-${c.tf}-${c.strategy}-${c.type}-${c.slot}`
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

const RANK_STYLE: Record<number, { bg:string; fg:string }> = {
  1: { bg:'linear-gradient(135deg,#ffe9a8,#d4af37)', fg:'#1a1300' },
  2: { bg:'linear-gradient(135deg,#eef0f5,#9aa3b5)', fg:'#13151c' },
  3: { bg:'linear-gradient(135deg,#e8a565,#b5651d)', fg:'#1f0d00' },
}

// ─── Tarjeta de champion (vitrina) ───────────────────────────────────────────
function ChampCard({ c, rank, motorColor, expanded, onToggle }: {
  c:Champion; rank?:number; motorColor:string; expanded:boolean; onToggle:()=>void
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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={e=>{ if(e.key==='Enter'||e.key===' ') onToggle() }}
      className={`modelos-champ-card${rank===1?' modelos-champ-card--rank1':''}`}
      style={{
        position:'relative',
        gridColumn: expanded ? '1 / -1' : undefined,
        background: isChamp ? `linear-gradient(160deg,${GOLD}12,${SURF} 55%)` : SURF,
        border: `1px solid ${isChamp?GOLD+'70':motorColor+'30'}`,
        boxShadow: isChamp ? `0 0 14px ${GOLD}22` : 'none',
        borderRadius: 6, padding:'12px 14px', cursor:'pointer',
        display:'flex', flexDirection:'column', gap:8,
      }}
    >
      {rs && (
        <span style={{
          position:'absolute', top:-9, right:12,
          fontFamily:BEBAS, fontSize:11, letterSpacing:'0.05em',
          color:rs.fg, background:rs.bg,
          padding:'2px 8px', borderRadius:10, boxShadow:'0 2px 6px rgba(0,0,0,0.45)',
        }}>#{rank}</span>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontFamily:MONO, fontSize:10, color:gc, fontWeight:700, border:`1px solid ${gc}60`, borderRadius:3, padding:'1px 5px' }}>{c.grade??'?'}</span>
        <span style={{ fontFamily:BEBAS, fontSize:20, color:'#e8e9f0', letterSpacing:'0.04em', lineHeight:1 }}>{champSym(c)}</span>
        <span style={{ fontFamily:MONO, fontSize:10, color:GOLD }}>{champTF(c).toUpperCase()}</span>
        {c.signal && <span style={{ marginLeft:'auto', width:6, height:6, borderRadius:'50%', background:GRN, boxShadow:`0 0 6px ${GRN}` }} />}
        <span style={{ marginLeft: c.signal?0:'auto', fontFamily:MONO, fontSize:11, color:MUTED, transform:expanded?'rotate(180deg)':'none', transition:'transform 0.15s' }}>▾</span>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontFamily:MONO, fontSize:9, color:dirClr, background:`${dirClr}14`, padding:'2px 6px', borderRadius:3 }}>{dirLbl}</span>
        <span style={{ fontFamily:MONO, fontSize:10, color:DIM, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {fmtStrat(c.strategy)}
        </span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, paddingTop:8, borderTop:`1px solid ${BDR}` }}>
        <div>
          <div style={{ fontFamily:MONO, fontSize:8, color:MUTED, letterSpacing:'0.1em' }}>CAGR</div>
          <div style={{ fontFamily:BEBAS, fontSize:16, color:c.cagr!=null?(c.cagr>=0?GRN:RED):MUTED }}>{p0(c.cagr)}</div>
        </div>
        <div>
          <div style={{ fontFamily:MONO, fontSize:8, color:MUTED, letterSpacing:'0.1em' }}>WIN RT</div>
          <div style={{ fontFamily:BEBAS, fontSize:16, color:wr!=null?(wr>=60?GRN:wr>=50?GOLD:RED):MUTED }}>{wr!=null?`${wr.toFixed(1)}%`:'—'}</div>
        </div>
        <div>
          <div style={{ fontFamily:MONO, fontSize:8, color:MUTED, letterSpacing:'0.1em' }}>MAX DD</div>
          <div style={{ fontFamily:BEBAS, fontSize:16, color:RED }}>{p1(c.dd)}</div>
        </div>
        <div>
          <div style={{ fontFamily:MONO, fontSize:8, color:MUTED, letterSpacing:'0.1em' }}>TRADES</div>
          <div style={{ fontFamily:BEBAS, fontSize:16, color:'#e8e9f0' }}>{c.trades?.toLocaleString()??'—'}</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, fontFamily:MONO, fontSize:9 }}>
        <span style={{ color: c.val_mc!=null&&c.val_mc>=80?GRN:GOLD }}>MC {c.val_mc!=null?`${c.val_mc.toFixed(0)}%`:'—'}</span>
        <span style={{ color:MUTED }}>·</span>
        <span style={{ color: wftClr }}>WFT {c.wft_verdict||'—'}</span>
      </div>

      {expanded && <div onClick={e=>e.stopPropagation()} style={{ marginTop:4, marginLeft:-14, marginRight:-14, marginBottom:-12 }}><DetailPanel c={c} /></div>}
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
              padding:'10px 16px', background:'transparent', border:'none',
              borderBottom:`2px solid ${isSel?m.color:'transparent'}`,
              cursor: isActive ? 'pointer' : 'not-allowed',
              fontFamily:BEBAS, fontSize:14, letterSpacing:'0.04em',
              color: isSel ? m.color : (isActive?DIM:MUTED),
              opacity: isActive||isSel ? 1 : 0.4,
              pointerEvents: isActive ? 'auto' : 'none',
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

// ─── Ticker de resumen ────────────────────────────────────────────────────────
function TickerBar({ champs }: { champs:Champion[] }) {
  if (!champs.length) return null
  const aPlus  = champs.filter(c=>c.grade==='A+').length
  const aGrd   = champs.filter(c=>c.grade==='A').length
  const longs  = champs.filter(c=>champDir(c)==='long').length
  const shorts = champs.filter(c=>champDir(c)==='short').length
  const sigs   = champs.filter(c=>c.signal).length
  const avgC   = champs.reduce((s,c)=>s+(c.cagr??0),0)/champs.length

  const Item = ({ l, v, c }:{l:string; v:string; c:string}) => (
    <span style={{ display:'flex', alignItems:'baseline', gap:5, whiteSpace:'nowrap' }}>
      <span style={{ fontFamily:MONO, fontSize:9, color:MUTED, letterSpacing:'0.1em' }}>{l}</span>
      <span style={{ fontFamily:BEBAS, fontSize:16, color:c }}>{v}</span>
    </span>
  )
  const Sep = () => <span style={{ color:BDR }}>│</span>

  return (
    <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', padding:'2px 2px 16px' }}>
      <Item l="CHAMPIONS" v={champs.length.toString()} c={GOLD} /><Sep/>
      <Item l="A+" v={aPlus.toString()} c="#ffd700" />
      <Item l="A" v={aGrd.toString()} c={GRN} /><Sep/>
      <Item l="LONGS" v={longs.toString()} c={GRN} />
      <Item l="SHORTS" v={shorts.toString()} c={RED} /><Sep/>
      <Item l="CAGR PROM" v={p0(avgC)} c={GRN} />
      <Item l="CON SEÑAL" v={sigs.toString()} c={sigs>0?GRN:MUTED} />
    </div>
  )
}

// ─── Tablero de un motor: filtros + grilla plana ─────────────────────────────
function ChampionsBoard({ motor, champs }: { motor:MotorDef; champs:Champion[] }) {
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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:12 }}>
        {filtered.map((c,i)=>{
          const k = champKey(c)
          return (
            <ChampCard
              key={k} c={c} motorColor={motor.color}
              rank={i<3?i+1:undefined}
              expanded={expandedKey===k} onToggle={()=>toggle(k)}
            />
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
          0%, 100% { box-shadow: 0 0 14px rgba(212,175,55,0.22); }
          50%      { box-shadow: 0 0 28px rgba(212,175,55,0.55); }
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
            <span style={{ background:`linear-gradient(135deg,${GOLD},#f5c842,#a88c25)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
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

        {/* Ticker de resumen del motor seleccionado */}
        {!loading && <TickerBar champs={motorChamps} />}

        {/* Tablero del motor seleccionado */}
        <ChampionsBoard motor={motor} champs={motorChamps} />

      </div>
    </div>
  )
}
