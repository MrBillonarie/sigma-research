'use client'
import { useEffect, useRef } from 'react'
import { C } from '@/app/lib/constants'

// ─── FIRE · Reactor Cockpit ──────────────────────────────────────────────────
// Columna-reactor (tubo de vidrio) con la carga real + proyección +10/+20 años,
// y un cockpit de instrumentos con slider de ahorro. Datos reales, cero motor.

interface Props {
  current: number                 // patrimonio actual (USD)
  goal: number                    // meta FIRE
  firePct: number                 // % de progreso (real)
  years: number | null            // años estimados (0 = ya, null = 50+)
  monthlyGoal: number             // retiro objetivo $/mes (para el caption)
  savings: string                 // ahorro mensual asumido (state del padre)
  onSavings: (v: string) => void
  annualReturn?: number
}

const F_DISP = "var(--font-bebas,'Bebas Neue',Impact,sans-serif)"
const fmtF = (v: number) => '$' + Math.round(v).toLocaleString('es-CL')
const fmtK = (v: number) => (v >= 1000 ? '$' + Math.round(v / 1000) + 'K' : '$' + Math.round(v))
const num  = (s: string) => Math.max(0, parseFloat(s) || 0)
function balAt(cur: number, S: number, months: number, annual: number) {
  let bal = cur; const r = annual / 12
  for (let i = 0; i < months; i++) bal = bal * (1 + r) + S
  return bal
}

export default function FireReactor({ current, goal, firePct, years, monthlyGoal, savings, onSavings, annualReturn = 0.08 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const savRef = useRef(num(savings))
  savRef.current = num(savings)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = canvas.getContext('2d')
    if (!c) return
    const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0, H = 0
    const size = () => {
      const r = canvas.getBoundingClientRect()
      W = r.width || 172; H = +(canvas.getAttribute('height') || 320)
      canvas.width = W * DPR; canvas.height = H * DPR; c.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    size()
    const ro = new ResizeObserver(size); ro.observe(canvas)
    let visible = true
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting }, { threshold: 0.02 })
    io.observe(canvas)
    let anim = RM ? 1 : 0
    let raf = 0
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r)
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath()
    }
    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (!visible || !W) return
      anim = RM ? 1 : Math.min(1, anim + 0.03)
      const S = savRef.current
      c.clearRect(0, 0, W, H)
      const cxp = W / 2, tw = 52, top = 30, bot = H - 24, fh = bot - top, x0 = cxp - tw / 2
      // sombra base
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(cxp, bot + 6, tw * 0.6, 6, 0, 0, 7); c.fill()
      // tubo
      c.fillStyle = 'rgba(10,16,24,0.6)'; rr(x0, top, tw, fh, 14); c.fill()
      // gradaciones + hitos
      c.strokeStyle = 'rgba(120,150,175,0.12)'; c.font = '8px monospace'; c.textAlign = 'left'; c.textBaseline = 'middle'
      for (let k = 0; k <= 8; k++) { const y = bot - fh * k / 8; c.beginPath(); c.moveTo(x0 + tw, y); c.lineTo(x0 + tw + (k % 2 ? 5 : 9), y); c.stroke() }
      ;([[1, 'FIRE', C.amber], [0.75, '75%', C.muted], [0.5, '50%', C.muted], [0.25, '25%', C.muted]] as [number, string, string][])
        .forEach(([f, l, col]) => { const y = bot - fh * f; c.fillStyle = col; c.fillText(l, x0 + tw + 12, y) })
      // proyección +10 / +20
      ;([[120, '+10a'], [240, '+20a']] as [number, string][]).forEach(([mm, lb]) => {
        const p = Math.min(1, balAt(current, S, mm, annualReturn) / goal); const y = bot - fh * p * anim
        c.strokeStyle = 'rgba(94,234,240,0.32)'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + tw, y); c.stroke(); c.setLineDash([])
        c.fillStyle = 'rgba(94,234,240,0.75)'; c.textAlign = 'right'; c.font = '7px monospace'; c.fillText(lb, x0 - 4, y)
      })
      // ghost fill (hasta +20a) + llenado real
      c.save(); rr(x0, top, tw, fh, 14); c.clip()
      const pg = Math.min(1, balAt(current, S, 240, annualReturn) / goal), gy = bot - fh * pg * anim
      c.fillStyle = 'rgba(94,234,240,0.06)'; c.fillRect(x0, gy, tw, bot - gy)
      const fillH = Math.max(9, fh * (firePct / 100)) * anim, fy = bot - fillH
      const lg = c.createLinearGradient(0, fy, 0, bot); lg.addColorStop(0, '#eafcff'); lg.addColorStop(0.5, '#5eeaf0'); lg.addColorStop(1, '#2f6bd6')
      c.fillStyle = lg; c.fillRect(x0, fy, tw, fillH)
      const ig = c.createRadialGradient(cxp, bot, 2, cxp, bot, 46); ig.addColorStop(0, 'rgba(160,244,252,0.7)'); ig.addColorStop(1, 'transparent')
      c.fillStyle = ig; c.fillRect(x0, bot - 52, tw, 52)
      if (!RM) for (let k = 0; k < 5; k++) { const bx = x0 + ((Math.sin(k * 13 + performance.now() / 560) * 0.5 + 0.5)) * tw; const by = bot - ((performance.now() / 18 + k * 26) % 46); c.fillStyle = 'rgba(234,252,255,0.45)'; c.beginPath(); c.arc(bx, by, 1.3 + k % 2, 0, 7); c.fill() }
      // reflejo de vidrio
      const gh = c.createLinearGradient(x0, 0, x0 + tw, 0); gh.addColorStop(0, 'rgba(255,255,255,0.10)'); gh.addColorStop(0.22, 'rgba(255,255,255,0.03)'); gh.addColorStop(0.5, 'transparent'); gh.addColorStop(1, 'rgba(255,255,255,0.05)')
      c.fillStyle = gh; c.fillRect(x0, top, tw, fh)
      c.restore()
      // borde + tapa
      c.strokeStyle = 'rgba(120,160,185,0.35)'; c.lineWidth = 1.5; rr(x0, top, tw, fh, 14); c.stroke()
      c.strokeStyle = 'rgba(180,220,240,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0 + 8, top + 1); c.arcTo(x0, top + 1, x0, top + 12, 10); c.stroke()
      // % arriba
      c.fillStyle = C.glow; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.font = "700 17px 'Bebas Neue',Impact,sans-serif"
      c.fillText(firePct.toFixed(1) + '%', cxp, top - 6)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [current, goal, firePct, annualReturn])

  const sav = num(savings)
  const falta = Math.max(0, goal - current)
  const b10 = balAt(current, sav, 120, annualReturn)
  const yrsLabel = years === 0 ? '¡YA!' : years === null ? '50+' : years.toFixed(1)

  return (
    <div>
      <style>{`
        .fr-cmd{display:flex;align-items:center;gap:14px;padding:10px 16px;border-bottom:1px solid ${C.border};
          background:linear-gradient(90deg,rgba(255,180,84,.06),rgba(255,255,255,.012) 40%);flex-wrap:wrap;font-size:11px;font-family:monospace}
        .fr-cmd .go{color:${C.amber}} .fr-cmd .go b{color:${C.bg};background:${C.amber};padding:1px 6px;border-radius:3px;font-weight:700;margin-left:2px}
        .fr-cmd .fn{color:${C.dimText};letter-spacing:.12em;text-transform:uppercase;font-size:10px}
        .fr-cmd .live{margin-left:auto;color:${C.green};display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.12em}
        .fr-cmd .live::before{content:'';width:6px;height:6px;border-radius:50%;background:${C.green};box-shadow:0 0 8px ${C.green};animation:frpl 1.6s infinite}
        @keyframes frpl{50%{opacity:.35}}
        .fr-grid{display:grid;grid-template-columns:172px 1fr}
        @media(max-width:680px){.fr-grid{grid-template-columns:1fr}.fr-reactor{border-right:none!important;border-bottom:1px solid ${C.border}}}
        .fr-reactor{border-right:1px solid ${C.border};position:relative;background:radial-gradient(80% 60% at 50% 90%, rgba(57,226,230,.06), transparent 70%)}
        .fr-canvas{display:block;width:100%;height:320px}
        .fr-cockpit{padding:20px 22px;display:flex;flex-direction:column;gap:16px}
        .fr-kl{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:${C.muted}}
        .fr-hero{display:flex;gap:26px;align-items:flex-end;flex-wrap:wrap}
        .fr-pbar{height:5px;border-radius:3px;background:${C.border};overflow:hidden;margin-top:7px;position:relative}
        .fr-pbar i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:linear-gradient(90deg,${C.glow},${C.blue});box-shadow:0 0 10px rgba(57,226,230,.6);min-width:5px}
        .fr-cap{font-size:11px;color:${C.dimText};letter-spacing:.03em;border-top:1px solid ${C.border};border-bottom:1px solid ${C.border};padding:9px 0;display:flex;gap:18px;flex-wrap:wrap}
        .fr-cap b{font-weight:400}
        .fr-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .fr-tile{position:relative;border:1px solid ${C.border};border-radius:10px;padding:11px 13px 11px 15px;background:linear-gradient(180deg,rgba(57,226,230,.03),transparent);overflow:hidden}
        .fr-tile::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--ac)}
        .fr-tile .tv{font-size:16px;color:${C.text};font-variant-numeric:tabular-nums;margin-top:3px}
        .fr-tb{height:3px;border-radius:2px;background:${C.border};margin-top:8px;overflow:hidden}
        .fr-tb i{display:block;height:100%;border-radius:2px;background:var(--ac)}
        .fr-sld{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:3px;background:${C.border2};outline:none;margin-top:9px}
        .fr-sld::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:linear-gradient(135deg,${C.glow},${C.blue});cursor:pointer;box-shadow:0 0 10px rgba(57,226,230,.5)}
        .fr-sld::-moz-range-thumb{width:15px;height:15px;border:none;border-radius:50%;background:${C.glow};cursor:pointer}
      `}</style>

      <div className="fr-cmd">
        <span className="go">SQUANT<b>GO</b></span>
        <span className="fn">FIRE · Reactor</span>
        <span className="fn">Regla 4%</span>
        <span className="live">{firePct.toFixed(1)}% cargado</span>
      </div>

      <div className="fr-grid">
        <div className="fr-reactor"><canvas ref={canvasRef} height={320} className="fr-canvas" /></div>
        <div className="fr-cockpit">
          <div className="fr-hero">
            <div>
              <div className="fr-kl">Progreso a FIRE</div>
              <div style={{ fontFamily: F_DISP, fontSize: 46, lineHeight: 0.88, color: C.glow }}>{firePct.toFixed(1)}<span style={{ fontSize: 26 }}>%</span></div>
              <div className="fr-pbar"><i style={{ width: `${Math.min(100, firePct)}%` }} /></div>
            </div>
            <div>
              <div className="fr-kl">Años estimados</div>
              <div style={{ fontFamily: F_DISP, fontSize: 46, lineHeight: 0.88, color: years === 0 ? C.green : C.text }}>{yrsLabel}<span style={{ fontSize: 16, color: C.dimText }}>{years === 0 ? '' : ' años'}</span></div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>a {Math.round(annualReturn * 100)}% de retorno anual</div>
            </div>
          </div>

          <div className="fr-cap">
            <span>Meta <b style={{ color: C.amber }}>{fmtF(goal)}</b></span>
            <span>Retiro <b style={{ color: C.text }}>{fmtF(monthlyGoal)}/mes</b></span>
            <span>Regla del <b style={{ color: C.text }}>4%</b></span>
          </div>

          <div className="fr-tiles">
            <div className="fr-tile" style={{ ['--ac' as string]: C.glow }}>
              <div className="fr-kl">Patrimonio actual</div><div className="tv">{fmtF(current)}</div>
              <div className="fr-tb"><i style={{ width: `${Math.min(100, firePct)}%` }} /></div>
            </div>
            <div className="fr-tile" style={{ ['--ac' as string]: C.amber }}>
              <div className="fr-kl">Falta para FIRE</div><div className="tv">{fmtF(falta)}</div>
              <div className="fr-tb"><i style={{ width: '100%', background: C.border2 }} /></div>
            </div>
            <div className="fr-tile" style={{ ['--ac' as string]: C.green }}>
              <div className="fr-kl">Ahorro mensual (USD)</div><div className="tv">{fmtF(sav)}</div>
              <input className="fr-sld" type="range" min={100} max={3000} step={50} value={Math.min(3000, Math.max(100, sav))} onChange={e => onSavings(e.target.value)} />
            </div>
            <div className="fr-tile" style={{ ['--ac' as string]: C.blue }}>
              <div className="fr-kl">En 10 años tendrás</div><div className="tv">{fmtK(b10)}</div>
              <div className="fr-tb"><i style={{ width: `${Math.min(100, b10 / goal * 100)}%` }} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
