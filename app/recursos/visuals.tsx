'use client'
import { useRef } from 'react'
import Link from 'next/link'

export interface Tool {
  tag: string
  name: string
  desc: string
  detail: string
  href: string
  cta: string
}

const GOLD = '#d4af37'

// Tilt 3D via CSS vars escritas directo al DOM — cero re-renders por mousemove.
function useTilt() {
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: React.MouseEvent) {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return
    const r  = el.getBoundingClientRect()
    const px = Math.max(-0.6, Math.min(0.6, (e.clientX - r.left) / r.width - 0.5))
    const py = Math.max(-0.6, Math.min(0.6, (e.clientY - r.top) / r.height - 0.5))
    el.style.setProperty('--px', px.toFixed(3))
    el.style.setProperty('--py', py.toFixed(3))
    el.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`)
    el.classList.add('rc-on')
  }
  function onLeave() {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--px', '0')
    el.style.setProperty('--py', '0')
    el.classList.remove('rc-on')
  }
  return { ref, onMove, onLeave }
}

// ─── Hero: título extruido 3D + suelo con fuga de perspectiva + brasas ────────
export function HeroRecursos() {
  const { ref, onMove, onLeave } = useTilt()
  return (
    <section
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="pt-40 pb-32 px-6 relative overflow-hidden"
      style={{ perspective: 900 }}
    >
      <style>{RC_CSS}</style>

      {/* Suelo con fuga de perspectiva */}
      <div className="rc-floor" aria-hidden />
      <div className="rc-horizon" aria-hidden />

      {/* Brasas doradas */}
      {[
        { l: '8%',  b: 120, d: 0.0, s: 7.0 },
        { l: '22%', b: 90,  d: 2.4, s: 8.5 },
        { l: '38%', b: 140, d: 4.1, s: 7.6 },
        { l: '55%', b: 100, d: 1.3, s: 9.2 },
        { l: '72%', b: 130, d: 5.2, s: 8.0 },
        { l: '88%', b: 110, d: 3.0, s: 7.3 },
      ].map((e, i) => (
        <span key={i} className="rc-ember" aria-hidden style={{ left: e.l, bottom: e.b, animationDelay: `${e.d}s`, animationDuration: `${e.s}s` }} />
      ))}

      <div ref={ref} className="rc-hero max-w-7xl mx-auto relative">
        <div className="section-label text-gold mb-6">{'// SQUANT DESK · HERRAMIENTAS'}</div>
        <h1 className="rc-title display-heading text-6xl sm:text-8xl lg:text-[9rem] leading-none mb-8">
          <span className="rc-t1">TODOS LOS</span>
          <br />
          <span className="rc-t2">RECURSOS</span>
        </h1>
        <p className="terminal-text text-text-dim text-sm leading-relaxed max-w-xl relative">
          Infraestructura cuantitativa para inversores independientes en LATAM.
          Motor real, datos reales, sin conflictos de interés.
        </p>
      </div>
    </section>
  )
}

// ─── Mini-visual monocromo por herramienta ────────────────────────────────────
function ToolViz({ tag }: { tag: string }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const viz = (() => {
    switch (tag) {
      case 'T-01': return <polyline {...s} points="1,11 6,11 9,4 13,18 16,11 21,11" />
      case 'T-02': return <g {...s}><circle cx="5.5" cy="6.5" r="1.7" /><circle cx="16.5" cy="5.5" r="1.7" /><circle cx="11" cy="13" r="1.7" /><circle cx="17.5" cy="16.5" r="1.7" /><line x1="6.8" y1="7.6" x2="9.7" y2="11.9" /><line x1="15.2" y1="6.6" x2="12.3" y2="11.9" /><line x1="12.4" y1="14.1" x2="16" y2="15.7" /></g>
      case 'T-03': return <g {...s}><circle cx="11" cy="11" r="8" /><ellipse cx="11" cy="11" rx="8" ry="3.2" /><line x1="11" y1="3" x2="11" y2="19" opacity="0.5" /></g>
      case 'T-04': return <g {...s}><line x1="3" y1="18" x2="19" y2="4" opacity="0.9" /><line x1="3" y1="18" x2="20" y2="9" opacity="0.65" /><line x1="3" y1="18" x2="20" y2="14" opacity="0.45" /><line x1="3" y1="18" x2="19" y2="18" opacity="0.3" /></g>
      case 'T-05': return <g {...s}><path d="M 4 17.5 A 8 8 0 0 1 18 10" /><line x1="11" y1="15.5" x2="16" y2="8.5" /><circle cx="11" cy="15.5" r="1.4" /></g>
      case 'T-06': return <g {...s}><line x1="4.5" y1="19" x2="4.5" y2="10" /><line x1="9.5" y1="19" x2="9.5" y2="5" /><line x1="14.5" y1="19" x2="14.5" y2="12" /><line x1="19.5" y1="19" x2="19.5" y2="8" /></g>
      case 'T-07': return <path {...s} d="M 11 3 C 11 3 5.5 9.5 5.5 13.5 A 5.5 5.5 0 0 0 16.5 13.5 C 16.5 9.5 11 3 11 3 Z" />
      case 'T-08': return <g {...s}><rect x="4.5" y="3" width="13" height="16" /><line x1="8" y1="7.5" x2="14.5" y2="7.5" /><line x1="8" y1="11" x2="14.5" y2="11" /><line x1="8" y1="14.5" x2="12" y2="14.5" /></g>
      default:     return <text x="11" y="16" textAnchor="middle" fontSize="14" fill="currentColor" fontFamily="'Bebas Neue',Impact,sans-serif">Σ</text>
    }
  })()
  return (
    <span className="rc-viz" aria-hidden>
      <svg width="22" height="22" viewBox="0 0 22 22">{viz}</svg>
    </span>
  )
}

// ─── Tarjeta-módulo con tilt 3D, capas y detalle expandible ───────────────────
export function ModuleCard({ tool }: { tool: Tool }) {
  const { ref, onMove, onLeave } = useTilt()
  return (
    <div style={{ perspective: 800 }} className="h-full">
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="rc-card bg-surface border border-border relative overflow-hidden p-7 flex flex-col h-full"
      >
        <span className="rc-shine" aria-hidden />
        {/* Tag grabado gigante — capa de fondo con paralaje inverso */}
        <span className="rc-wm" aria-hidden>{tool.tag}</span>

        <div className="rc-front flex items-center gap-4 mb-4 relative">
          <ToolViz tag={tool.tag} />
          <div>
            <span className="terminal-text text-xs text-gold border border-gold/20 px-2 py-0.5">{tool.tag}</span>
            <h2 className="display-heading text-3xl text-text mt-2 leading-none">{tool.name}</h2>
          </div>
        </div>

        <p className="terminal-text text-sm text-text-dim leading-relaxed relative">{tool.desc}</p>

        {/* Detalle extendido — se abre al hover / siempre visible en táctil */}
        <div className="rc-detail" aria-hidden={false}>
          <div className="rc-detail-in">
            <p className="terminal-text text-sm text-text-dim leading-relaxed pt-4 mt-4 border-t border-border">{tool.detail}</p>
          </div>
        </div>

        <div className="mt-auto pt-6 relative">
          <Link
            href={tool.href}
            className="section-label text-sm px-6 py-2.5 border border-gold text-gold hover:bg-gold hover:text-bg transition-all duration-200 inline-block"
          >
            {tool.cta}
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── CSS compartido ───────────────────────────────────────────────────────────
const RC_CSS = `
  /* Hero: título extruido que se inclina con el mouse */
  .rc-hero { --px:0; --py:0 }
  .rc-title { display:inline-block; transform: rotateX(calc(var(--py) * 7deg)) rotateY(calc(var(--px) * -9deg));
    transition: transform .55s ease; will-change: transform }
  .rc-hero.rc-on .rc-title { transition: transform .12s ease-out }
  .rc-t1 { color:#e8e9f0;
    text-shadow: 1px 1px 0 #2a2d3a, 2px 2px 0 #262939, 3px 3px 0 #222536, 4px 4px 0 #1e2132,
      5px 5px 0 #1a1d2e, 6px 6px 0 #15182a, 7px 7px 0 #111426, 11px 13px 26px rgba(0,0,0,.55) }
  .rc-t2 { color:${GOLD};
    text-shadow: 1px 1px 0 #a3862c, 2px 2px 0 #8f7526, 3px 3px 0 #7b6420, 4px 4px 0 #67531a,
      5px 5px 0 #534214, 6px 6px 0 #3f320f, 7px 7px 0 #2b2109, 11px 13px 28px rgba(0,0,0,.6), 0 0 48px rgba(212,175,55,.16) }

  /* Suelo con fuga + horizonte */
  .rc-floor { position:absolute; left:-12%; right:-12%; bottom:-60px; height:300px; pointer-events:none;
    transform: perspective(620px) rotateX(63deg); transform-origin:50% 100%;
    background-image: linear-gradient(rgba(212,175,55,.12) 1px, transparent 1px),
      linear-gradient(90deg, rgba(212,175,55,.12) 1px, transparent 1px);
    background-size: 46px 46px; animation: rcFloor 12s linear infinite;
    -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,.9) 15%, transparent 82%);
    mask-image: linear-gradient(to top, rgba(0,0,0,.9) 15%, transparent 82%) }
  @keyframes rcFloor { to { background-position: 0 46px } }
  .rc-horizon { position:absolute; left:10%; right:10%; bottom:216px; height:1px; pointer-events:none;
    background: linear-gradient(90deg, transparent, rgba(212,175,55,.35), transparent);
    box-shadow: 0 0 24px 3px rgba(212,175,55,.14) }

  /* Brasas */
  .rc-ember { position:absolute; width:3px; height:3px; border-radius:50%; background:#f0d78c;
    box-shadow:0 0 7px ${GOLD}; opacity:0; pointer-events:none; animation: rcEmber 8s linear infinite }
  @keyframes rcEmber {
    0%   { transform: translateY(0) scale(.8); opacity:0 }
    18%  { opacity:.5 }
    60%  { opacity:.22 }
    100% { transform: translateY(-110px) scale(1.15); opacity:0 }
  }

  /* Tarjetas-módulo */
  .rc-card { --px:0; --py:0; --mx:50%; --my:30%;
    transform: rotateX(calc(var(--py) * -5deg)) rotateY(calc(var(--px) * 7deg));
    transition: transform .5s ease, border-color .25s, box-shadow .25s; will-change: transform }
  .rc-card.rc-on { transition: transform .1s ease-out, border-color .25s, box-shadow .25s;
    border-color: rgba(212,175,55,.45); box-shadow: 0 18px 44px rgba(0,0,0,.5) }
  .rc-shine { position:absolute; inset:0; opacity:0; transition:opacity .35s; pointer-events:none;
    background: radial-gradient(320px circle at var(--mx) var(--my), rgba(212,175,55,.10), transparent 65%) }
  .rc-card.rc-on .rc-shine { opacity:1 }
  .rc-wm { position:absolute; right:-10px; bottom:-34px; font-family:'Bebas Neue',Impact,sans-serif;
    font-size:140px; line-height:1; color:rgba(212,175,55,.055); pointer-events:none; user-select:none;
    transform: translate(calc(var(--px) * -9px), calc(var(--py) * -7px)); transition: transform .25s ease }
  .rc-front { transform: translate(calc(var(--px) * 5px), calc(var(--py) * 4px)); transition: transform .25s ease }
  .rc-viz { width:46px; height:46px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
    border:1px solid rgba(139,143,168,.25); color:#8b8fa8; transition: color .2s, border-color .2s, box-shadow .2s }
  .rc-card:hover .rc-viz, .rc-card:focus-within .rc-viz { color:${GOLD}; border-color:rgba(212,175,55,.5);
    box-shadow:0 0 16px rgba(212,175,55,.15) }

  /* Detalle expandible: cerrado en desktop, se abre al hover/focus */
  .rc-detail { display:grid; grid-template-rows:0fr; transition: grid-template-rows .45s ease; position:relative }
  .rc-detail-in { overflow:hidden; min-height:0 }
  .rc-card:hover .rc-detail, .rc-card:focus-within .rc-detail { grid-template-rows:1fr }
  @media (hover:none) { .rc-detail { grid-template-rows:1fr } }

  @media (prefers-reduced-motion: reduce) {
    .rc-title, .rc-card { transform:none !important; transition:none }
    .rc-wm, .rc-front { transform:none !important }
    .rc-shine, .rc-ember { display:none }
    .rc-floor { animation:none }
    .rc-detail { grid-template-rows:1fr }
  }
`
