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
  { id:1, name:'M1', label:'CRYPTO',       color:'#d4af37', syms:['BTC','ETH','SOL','BNB','LTC'],     status:'ACTIVO',       desc:'BTC · ETH · SOL · BNB · LTC — Futures perpetuos Binance' },
  { id:2, name:'M2', label:'COMMODITIES',  color:'#1D9E75', syms:['XAU','XAG','WTI','HG','NG','PL'], status:'ACTIVO',       desc:'XAU · XAG · WTI · HG · NG · PL — CFDs futuros yfinance' },
  { id:3, name:'M3', label:'STOCKS US',    color:'#7a7f9a', syms:[],                                  status:'PRÓXIMAMENTE', desc:'S&P 500 · Russell 1000 · ETFs sectoriales' },
  { id:4, name:'M4', label:'LATAM',        color:'#7a7f9a', syms:[],                                  status:'PRÓXIMAMENTE', desc:'Acciones Chile · Brasil · México' },
  { id:5, name:'M5', label:'FOREX',        color:'#7a7f9a', syms:[],                                  status:'PRÓXIMAMENTE', desc:'EUR/USD · GBP/JPY · USD/JPY y más' },
]
const TF_ORDER = ['1d','4h','1h','15m','5m','30m','1w']

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
function sortTFs(tfs: string[]) {
  return [...tfs].sort((a,b)=>{
    const ia=TF_ORDER.indexOf(a), ib=TF_ORDER.indexOf(b)
    if(ia<0&&ib<0) return 0; if(ia<0) return 1; if(ib<0) return -1
    return ia-ib
  })
}
function motorOf(c: Champion): number {
  const s = champSym(c)
  if (MOTORS[0].syms.includes(s)) return 1
  if (MOTORS[1].syms.includes(s)) return 2
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

// ─── Fila de champion ─────────────────────────────────────────────────────────
function ChampRow({ c, expanded, onToggle }: { c:Champion; expanded:boolean; onToggle:()=>void }) {
  const d = champDir(c)
  const isShort = d==='short', isAdapt = d==='adaptive'
  const dirClr = isAdapt?GOLD:isShort?RED:GRN
  const dirLbl = isAdapt?'◆ ADPT':isShort?'▼ SHORT':'▲ LONG'
  const gc = gradeClr(c.grade)
  const wr = c.wr!=null ? (c.wr<=1?c.wr*100:c.wr) : null

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={e=>{ if(e.key==='Enter'||e.key===' ') onToggle() }}
        style={{
          display:'grid',
          gridTemplateColumns:'32px 52px 44px 78px 1fr 76px 62px 48px 28px',
          alignItems:'center', gap:8,
          padding:'10px 16px', cursor:'pointer',
          borderBottom:`1px solid ${expanded?'transparent':BDR}`,
          borderLeft:`3px solid ${expanded?gc:'transparent'}`,
          background: expanded?`${gc}09`:undefined,
        }}
      >
        <span style={{ fontFamily:MONO, fontSize:10, color:gc, fontWeight:700 }}>{c.grade??'?'}</span>
        <span style={{ fontFamily:BEBAS, fontSize:18, color:'#e8e9f0', letterSpacing:'0.04em', lineHeight:1 }}>{champSym(c)}</span>
        <span style={{ fontFamily:MONO, fontSize:10, color:GOLD }}>{champTF(c).toUpperCase()}</span>
        <span style={{ fontFamily:MONO, fontSize:10, color:dirClr, background:`${dirClr}14`, padding:'2px 5px', textAlign:'center' }}>{dirLbl}</span>
        <span style={{ fontFamily:MONO, fontSize:10, color:DIM, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {fmtStrat(c.strategy)}
        </span>
        <span style={{ fontFamily:MONO, fontSize:12, color:c.cagr!=null?(c.cagr>=0?GRN:RED):MUTED, textAlign:'right', fontWeight:600 }}>
          {p0(c.cagr)}
        </span>
        <span style={{ fontFamily:MONO, fontSize:11, color:wr!=null?(wr>=60?GRN:wr>=50?GOLD:RED):MUTED, textAlign:'right' }}>
          {wr!=null?`${wr.toFixed(1)}%`:'—'}
        </span>
        <span style={{ fontFamily:MONO, fontSize:11, color:MUTED, textAlign:'right' }}>
          {c.trades?.toLocaleString()??'—'}
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end' }}>
          {c.signal && <span style={{ width:5, height:5, borderRadius:'50%', background:GRN, boxShadow:`0 0 5px ${GRN}` }} />}
          <span style={{ fontFamily:MONO, fontSize:11, color:MUTED, display:'inline-block', transform:expanded?'rotate(180deg)':'none', transition:'transform 0.15s' }}>▾</span>
        </div>
      </div>
      {expanded && <DetailPanel c={c} />}
    </>
  )
}

// ─── Grupo de temporalidad ────────────────────────────────────────────────────
function TFGroup({ tfName, champs, expandedKey, onToggle }: {
  tfName: string; champs: Champion[]
  expandedKey: string|null; onToggle: (k:string)=>void
}) {
  return (
    <>
      <div style={{
        padding:'4px 16px', background:BG,
        borderBottom:`1px solid ${MUTED}20`,
        fontFamily:MONO, fontSize:8, color:MUTED, letterSpacing:'0.18em',
      }}>
        {tfName.toUpperCase()} — {champs.length} modelo{champs.length!==1?'s':''}
      </div>
      {champs.map(c=>{
        const k = champKey(c)
        return <ChampRow key={k} c={c} expanded={expandedKey===k} onToggle={()=>onToggle(k)} />
      })}
    </>
  )
}

// ─── Sección de dirección ─────────────────────────────────────────────────────
function DirectionBlock({ direction, champs, expandedKey, onToggle }: {
  direction: 'long'|'short'|'adaptive'
  champs: Champion[]
  expandedKey: string|null; onToggle:(k:string)=>void
}) {
  const [open, setOpen] = useState(true)
  const isShort = direction==='short', isAdapt = direction==='adaptive'
  const dc = isAdapt?GOLD:isShort?RED:GRN
  const dlbl = isAdapt?'◆ ADAPTIVE':isShort?'▼ SHORT':'▲ LONG'

  const byTF: Record<string,Champion[]> = {}
  for (const c of champs) {
    const t = champTF(c)
    if (!byTF[t]) byTF[t]=[]
    byTF[t].push(c)
  }
  const keys = sortTFs(Object.keys(byTF))

  return (
    <div>
      <button
        onClick={()=>setOpen(v=>!v)}
        style={{
          width:'100%', display:'flex', alignItems:'center', gap:10,
          padding:'7px 16px', background:`${dc}09`, border:'none',
          borderLeft:`2px solid ${dc}`, borderBottom:`1px solid ${BDR}`,
          cursor:'pointer', textAlign:'left',
        }}
      >
        <span style={{ fontFamily:MONO, fontSize:11, color:dc, letterSpacing:'0.1em' }}>{dlbl}</span>
        <span style={{ fontFamily:MONO, fontSize:10, color:MUTED }}>{champs.length} modelos</span>
        <span style={{ marginLeft:'auto', fontFamily:MONO, fontSize:10, color:MUTED }}>{open?'▴':'▾'}</span>
      </button>

      {open && (
        <div style={{ borderLeft:`2px solid ${dc}18` }}>
          {/* Column headers */}
          <div style={{
            display:'grid',
            gridTemplateColumns:'32px 52px 44px 78px 1fr 76px 62px 48px 28px',
            gap:8, padding:'5px 16px',
            background:BG, borderBottom:`1px solid ${BDR}`,
          }}>
            {['GRADE','SYM','TF','DIR','ESTRATEGIA','CAGR','WIN RT','TRADES',''].map((h,i)=>(
              <span key={i} style={{ fontFamily:MONO, fontSize:8, color:MUTED, letterSpacing:'0.12em', textAlign:i>=5?'right':'left' }}>{h}</span>
            ))}
          </div>
          {keys.map(t=>(
            <TFGroup key={t} tfName={t} champs={byTF[t]} expandedKey={expandedKey} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sección de motor ─────────────────────────────────────────────────────────
function MotorSection({ motor, champs }: { motor:MotorDef; champs:Champion[] }) {
  const [open, setOpen] = useState(true)
  const [expandedKey, setExpKey] = useState<string|null>(null)

  const toggle = (k:string) => setExpKey(prev=>prev===k?null:k)

  const isActive = motor.status==='ACTIVO'
  const longs    = champs.filter(c=>champDir(c)==='long')
  const shorts   = champs.filter(c=>champDir(c)==='short')
  const adaptive = champs.filter(c=>champDir(c)==='adaptive')
  const aPlus    = champs.filter(c=>c.grade==='A+').length
  const aGrd     = champs.filter(c=>c.grade==='A').length

  return (
    <div style={{ marginBottom:12, border:`1px solid ${BDR}`, overflow:'hidden' }}>
      <button
        onClick={()=>setOpen(v=>!v)}
        style={{
          width:'100%', display:'flex', alignItems:'center', gap:14,
          padding:'13px 20px', background:SURF,
          borderBottom: open?`1px solid ${BDR}`:'none',
          borderLeft:`4px solid ${motor.color}`,
          cursor:'pointer', border:'none', textAlign:'left',
          outline:'none',
        }}
      >
        <span style={{ fontFamily:BEBAS, fontSize:26, color:`${motor.color}50`, lineHeight:1, minWidth:28 }}>{motor.id}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:2, flexWrap:'wrap' }}>
            <span style={{ fontFamily:BEBAS, fontSize:18, color:motor.color, letterSpacing:'0.06em' }}>{motor.label}</span>
            <span style={{ fontFamily:MONO, fontSize:9, color:isActive?GRN:MUTED, border:`1px solid ${isActive?GRN:MUTED}40`, padding:'1px 6px' }}>{motor.status}</span>
            {isActive&&champs.length>0&&(
              <span style={{ fontFamily:MONO, fontSize:9, color:MUTED }}>
                {champs.length} champ{champs.length!==1?'s':''} · {longs.length}L / {shorts.length}S
                {aPlus>0?` · ${aPlus} A+`:''}
                {aGrd>0?` · ${aGrd} A`:''}
              </span>
            )}
          </div>
          <span style={{ fontFamily:MONO, fontSize:10, color:MUTED }}>{motor.desc}</span>
        </div>
        <span style={{ fontFamily:MONO, fontSize:11, color:MUTED }}>{open?'▴':'▾'}</span>
      </button>

      {open && (
        <>
          {!isActive ? (
            <div style={{ padding:'28px 24px', background:BG, textAlign:'center' }}>
              <div style={{ fontFamily:BEBAS, fontSize:22, color:MUTED, letterSpacing:'0.12em', marginBottom:6 }}>EN DESARROLLO</div>
              <div style={{ fontFamily:MONO, fontSize:11, color:MUTED }}>{motor.desc}</div>
            </div>
          ) : champs.length===0 ? (
            <div style={{ padding:'18px 20px', background:BG }}>
              <span style={{ fontFamily:MONO, fontSize:11, color:MUTED }}>Sin champions activos — trainer buscando modelos…</span>
            </div>
          ) : (
            <>
              {longs.length    > 0 && <DirectionBlock direction="long"     champs={longs}    expandedKey={expandedKey} onToggle={toggle} />}
              {shorts.length   > 0 && <DirectionBlock direction="short"    champs={shorts}   expandedKey={expandedKey} onToggle={toggle} />}
              {adaptive.length > 0 && <DirectionBlock direction="adaptive" champs={adaptive} expandedKey={expandedKey} onToggle={toggle} />}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ─── Barra de resumen ─────────────────────────────────────────────────────────
function SummaryBar({ champs }: { champs:Champion[] }) {
  if (!champs.length) return null
  const aPlus  = champs.filter(c=>c.grade==='A+').length
  const aGrd   = champs.filter(c=>c.grade==='A').length
  const longs  = champs.filter(c=>champDir(c)==='long').length
  const shorts = champs.filter(c=>champDir(c)==='short').length
  const sigs   = champs.filter(c=>c.signal).length
  const avgC   = champs.reduce((s,c)=>s+(c.cagr??0),0)/champs.length

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:1, background:BDR, marginBottom:14, border:`1px solid ${BDR}` }}>
      {[
        { l:'CHAMPIONS', v:champs.length.toString(),  c:GOLD },
        { l:'GRADE A+',  v:aPlus.toString(),           c:'#ffd700' },
        { l:'GRADE A',   v:aGrd.toString(),            c:GRN },
        { l:'LONGS',     v:longs.toString(),           c:GRN },
        { l:'SHORTS',    v:shorts.toString(),          c:RED },
        { l:'CAGR PROM', v:p0(avgC),                   c:GRN },
        { l:'CON SEÑAL', v:sigs.toString(),            c:sigs>0?GRN:MUTED },
        { l:'MOTORES',   v:'2/5',                      c:MUTED },
      ].map(s=>(
        <div key={s.l} style={{ background:SURF, padding:'10px 14px' }}>
          <div style={{ fontFamily:MONO, fontSize:8, color:MUTED, letterSpacing:'0.12em', marginBottom:4 }}>{s.l}</div>
          <div style={{ fontFamily:BEBAS, fontSize:22, color:s.c, lineHeight:1 }}>{s.v}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function ModelosPage() {
  const [champs,     setChamps]     = useState<Champion[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string|null>(null)

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

  const m1 = champs.filter(c=>motorOf(c)===1)
  const m2 = champs.filter(c=>motorOf(c)===2)

  return (
    <div style={{ minHeight:'100vh', background:BG, color:'#e8e9f0', fontFamily:MONO }}>
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
            <div style={{ display:'flex', gap:8 }}>
              {MOTORS.map(m=>(
                <span key={m.id} style={{ fontFamily:MONO, fontSize:9, color:m.status==='ACTIVO'?GRN:MUTED, display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:6 }}>●</span> M{m.id}
                </span>
              ))}
            </div>
            <span style={{ color:BDR }}>·</span>
            <span style={{ fontFamily:MONO, fontSize:9, color:MUTED }}>Click en fila para estadísticas completas</span>
          </div>
        </div>

        {/* Resumen */}
        {!loading && <SummaryBar champs={champs} />}

        {/* Motores */}
        <MotorSection motor={MOTORS[0]} champs={m1} />
        <MotorSection motor={MOTORS[1]} champs={m2} />
        {MOTORS.slice(2).map(m=><MotorSection key={m.id} motor={m} champs={[]} />)}

      </div>
    </div>
  )
}
