'use client'
import { useEffect, useRef, useCallback } from 'react'

// ─── FIRE · Piezas visuales 3D compartidas ───────────────────────────────────
// Todo lo que antes era emoji vive acá como geometría dibujada: llama de
// partículas, esfera de nivel, escalera isométrica de rangos, anillos con
// grosor de toro y medallas acuñadas con bisel. Sin dependencias externas.

const DPRMAX = 2
const FF = "ui-monospace,'DM Mono',monospace"
export const hexa = (h: string, a: number) => {
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// ── Glifos: paths en espacio normalizado (−0.5…0.5), se escalan al dibujar ──
type GlyphFn = (c: CanvasRenderingContext2D) => void
export const GLYPHS: Record<string, GlyphFn> = {
  bolt: c => { const P = [[.11, -.36], [-.19, .05], [.03, .05], [-.05, .35], [.21, -.07], [-.01, -.07]]; c.beginPath(); P.forEach((p, i) => { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]) }); c.closePath() },
  flame: c => {
    c.beginPath(); c.moveTo(0, -.40)
    c.bezierCurveTo(.30, -.10, .26, .14, .11, .30)
    c.bezierCurveTo(.19, .12, .09, .02, -.02, -.04)
    c.bezierCurveTo(.05, .10, -.02, .20, -.10, .30)
    c.bezierCurveTo(-.30, .12, -.22, -.12, 0, -.40); c.closePath()
  },
  coins: c => {
    c.beginPath()
    ;[.26, .09, -.08].forEach(y => { c.moveTo(.28, y); c.ellipse(0, y, .28, .11, 0, 0, 7) })
    c.moveTo(-.28, .26); c.lineTo(-.28, -.08); c.moveTo(.28, .26); c.lineTo(.28, -.08)
  },
  cut: c => {
    c.beginPath(); c.moveTo(-.09, -.20); c.arc(-.20, -.20, .11, 0, 7)
    c.moveTo(-.09, .22); c.arc(-.20, .22, .11, 0, 7)
    c.moveTo(-.11, -.13); c.lineTo(.30, .28); c.moveTo(-.11, .15); c.lineTo(.30, -.26)
  },
  target: c => { c.beginPath(); c.moveTo(.32, 0); c.arc(0, 0, .32, 0, 7); c.moveTo(.17, 0); c.arc(0, 0, .17, 0, 7); c.moveTo(.05, 0); c.arc(0, 0, .05, 0, 7) },
  medal: c => {
    c.beginPath()
    c.moveTo(-.20, -.40); c.lineTo(-.07, -.10); c.moveTo(.20, -.40); c.lineTo(.07, -.10)
    c.moveTo(.26, .13); c.arc(0, .13, .26, 0, 7)
    const R = .14, r2 = .06; c.moveTo(0, .13 - R)
    for (let i = 0; i < 5; i++) {
      const a1 = -Math.PI / 2 + i * (Math.PI * 2 / 5), a2 = a1 + Math.PI / 5
      c.lineTo(Math.cos(a1) * R, .13 + Math.sin(a1) * R); c.lineTo(Math.cos(a2) * r2, .13 + Math.sin(a2) * r2)
    }
    c.closePath()
  },
  rocket: c => {
    c.beginPath()
    c.moveTo(0, -.40); c.bezierCurveTo(.19, -.20, .20, .02, .15, .20); c.lineTo(-.15, .20)
    c.bezierCurveTo(-.20, .02, -.19, -.20, 0, -.40); c.closePath()
    c.moveTo(-.15, .06); c.lineTo(-.31, .26); c.lineTo(-.13, .22)
    c.moveTo(.15, .06); c.lineTo(.31, .26); c.lineTo(.13, .22)
    c.moveTo(.07, -.13); c.arc(0, -.13, .07, 0, 7)
  },
  calendar: c => {
    c.beginPath(); c.rect(-.32, -.24, .64, .56)
    c.moveTo(-.32, -.06); c.lineTo(.32, -.06)
    c.moveTo(-.18, -.34); c.lineTo(-.18, -.14); c.moveTo(.18, -.34); c.lineTo(.18, -.14)
    c.moveTo(-.14, .10); c.lineTo(-.02, .10); c.moveTo(.06, .10); c.lineTo(.18, .10)
    c.moveTo(-.14, .22); c.lineTo(-.02, .22)
  },
  chartUp: c => { c.beginPath(); c.moveTo(-.34, .28); c.lineTo(-.34, -.30); c.moveTo(-.34, .28); c.lineTo(.34, .28); c.moveTo(-.22, .12); c.lineTo(-.02, -.10); c.lineTo(.08, 0); c.lineTo(.30, -.24); c.moveTo(.12, -.24); c.lineTo(.30, -.24); c.lineTo(.30, -.06) },
  chartDown: c => { c.beginPath(); c.moveTo(-.34, .28); c.lineTo(-.34, -.30); c.moveTo(-.34, .28); c.lineTo(.34, .28); c.moveTo(-.22, -.18); c.lineTo(-.02, .04); c.lineTo(.08, -.06); c.lineTo(.30, .18); c.moveTo(.12, .18); c.lineTo(.30, .18); c.lineTo(.30, 0) },
  book: c => { c.beginPath(); c.moveTo(0, -.24); c.bezierCurveTo(-.10, -.34, -.24, -.34, -.34, -.30); c.lineTo(-.34, .24); c.bezierCurveTo(-.24, .20, -.10, .20, 0, .30); c.bezierCurveTo(.10, .20, .24, .20, .34, .24); c.lineTo(.34, -.30); c.bezierCurveTo(.24, -.34, .10, -.34, 0, -.24); c.closePath(); c.moveTo(0, -.24); c.lineTo(0, .30) },
  search: c => { c.beginPath(); c.moveTo(.10, -.08); c.arc(-.06, -.08, .22, 0, 7); c.moveTo(.10, .08); c.lineTo(.32, .30) },
  repeat: c => { c.beginPath(); c.moveTo(-.26, -.10); c.arc(0, 0, .26, Math.PI, Math.PI * 1.75); c.moveTo(.10, -.30); c.lineTo(.26, -.18); c.lineTo(.12, -.06); c.moveTo(.26, .10); c.arc(0, 0, .26, 0, Math.PI * .75); c.moveTo(-.10, .30); c.lineTo(-.26, .18); c.lineTo(-.12, .06) },
  tag: c => { c.beginPath(); c.moveTo(-.02, -.32); c.lineTo(.32, .02); c.lineTo(.02, .32); c.lineTo(-.32, -.02); c.lineTo(-.30, -.30); c.closePath(); c.moveTo(-.14, -.18); c.arc(-.18, -.18, .04, 0, 7) },
  phone: c => { c.beginPath(); c.moveTo(-.30, -.24); c.bezierCurveTo(-.30, .12, -.06, .32, .24, .32); c.lineTo(.32, .18); c.lineTo(.10, .06); c.lineTo(.00, .16); c.bezierCurveTo(-.10, .08, -.16, .00, -.14, -.10); c.lineTo(-.04, -.20); c.lineTo(-.16, -.32); c.closePath() },
  shield: c => { c.beginPath(); c.moveTo(0, -.34); c.lineTo(.28, -.20); c.lineTo(.28, .04); c.bezierCurveTo(.28, .22, .14, .30, 0, .34); c.bezierCurveTo(-.14, .30, -.28, .22, -.28, .04); c.lineTo(-.28, -.20); c.closePath() },
  box: c => { c.beginPath(); c.moveTo(-.32, -.14); c.lineTo(0, -.32); c.lineTo(.32, -.14); c.lineTo(.32, .18); c.lineTo(0, .34); c.lineTo(-.32, .18); c.closePath(); c.moveTo(-.32, -.14); c.lineTo(0, .02); c.lineTo(.32, -.14); c.moveTo(0, .02); c.lineTo(0, .34) },
  pot: c => { c.beginPath(); c.moveTo(-.28, -.06); c.lineTo(.28, -.06); c.lineTo(.22, .26); c.lineTo(-.22, .26); c.closePath(); c.moveTo(-.28, -.06); c.lineTo(-.36, -.14); c.moveTo(.28, -.06); c.lineTo(.36, -.14); c.moveTo(-.12, -.20); c.bezierCurveTo(-.06, -.28, -.14, -.32, -.08, -.38); c.moveTo(.10, -.20); c.bezierCurveTo(.16, -.28, .08, -.32, .14, -.38) },
  compass: c => { c.beginPath(); c.moveTo(.32, 0); c.arc(0, 0, .32, 0, 7); c.moveTo(.14, -.14); c.lineTo(-.04, -.04); c.lineTo(-.14, .14); c.lineTo(.04, .04); c.closePath() },
  briefcase: c => { c.beginPath(); c.rect(-.32, -.12, .64, .40); c.moveTo(-.14, -.12); c.lineTo(-.14, -.26); c.lineTo(.14, -.26); c.lineTo(.14, -.12); c.moveTo(-.32, .04); c.lineTo(.32, .04) },
  speak: c => { c.beginPath(); c.moveTo(-.30, -.26); c.lineTo(.30, -.26); c.lineTo(.30, .12); c.lineTo(-.06, .12); c.lineTo(-.20, .30); c.lineTo(-.20, .12); c.lineTo(-.30, .12); c.closePath(); c.moveTo(-.16, -.10); c.lineTo(.16, -.10); c.moveTo(-.16, .00); c.lineTo(.06, .00) },
  calc: c => { c.beginPath(); c.rect(-.26, -.32, .52, .64); c.moveTo(-.16, -.22); c.lineTo(.16, -.22); c.lineTo(.16, -.10); c.lineTo(-.16, -.10); c.closePath(); c.moveTo(-.14, .04); c.lineTo(-.06, .04); c.moveTo(.06, .04); c.lineTo(.14, .04); c.moveTo(-.14, .18); c.lineTo(-.06, .18); c.moveTo(.06, .18); c.lineTo(.14, .18) },
  percent: c => { c.beginPath(); c.moveTo(-.10, -.20); c.arc(-.18, -.20, .08, 0, 7); c.moveTo(.26, .20); c.arc(.18, .20, .08, 0, 7); c.moveTo(.26, -.30); c.lineTo(-.26, .30) },
  scale: c => { c.beginPath(); c.moveTo(0, -.32); c.lineTo(0, .28); c.moveTo(-.22, .28); c.lineTo(.22, .28); c.moveTo(-.30, -.18); c.lineTo(.30, -.18); c.moveTo(-.30, -.18); c.lineTo(-.18, .04); c.lineTo(-.42, .04); c.closePath(); c.moveTo(.30, -.18); c.lineTo(.42, .04); c.lineTo(.18, .04); c.closePath() },
  bank: c => { c.beginPath(); c.moveTo(-.34, -.06); c.lineTo(0, -.30); c.lineTo(.34, -.06); c.moveTo(-.24, -.02); c.lineTo(-.24, .22); c.moveTo(-.08, -.02); c.lineTo(-.08, .22); c.moveTo(.08, -.02); c.lineTo(.08, .22); c.moveTo(.24, -.02); c.lineTo(.24, .22); c.moveTo(-.32, .30); c.lineTo(.32, .30) },
  car: c => { c.beginPath(); c.moveTo(-.32, .10); c.lineTo(-.26, -.10); c.lineTo(.26, -.10); c.lineTo(.32, .10); c.lineTo(.32, .22); c.lineTo(-.32, .22); c.closePath(); c.moveTo(-.26, -.10); c.lineTo(-.18, -.26); c.lineTo(.18, -.26); c.lineTo(.26, -.10); c.moveTo(-.14, .22); c.arc(-.18, .22, .04, 0, 7); c.moveTo(.22, .22); c.arc(.18, .22, .04, 0, 7) },
  doc: c => { c.beginPath(); c.moveTo(-.24, -.34); c.lineTo(.10, -.34); c.lineTo(.26, -.16); c.lineTo(.26, .34); c.lineTo(-.24, .34); c.closePath(); c.moveTo(.10, -.34); c.lineTo(.10, -.16); c.lineTo(.26, -.16); c.moveTo(-.12, .02); c.lineTo(.14, .02); c.moveTo(-.12, .16); c.lineTo(.14, .16) },
}
// Glifos que leen mejor como silueta maciza. El cohete queda fuera a propósito:
// relleno, las aletas se funden con el fuselaje y parece una cúpula.
const SOLID = new Set(['bolt', 'flame', 'shield', 'tag', 'phone'])

// ── Esfera 3D reutilizable: specular arriba-izq, terminador abajo-der, rim ──
export function sphere3d(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, base: [string, string, string], light: string) {
  const g = c.createRadialGradient(cx - r * .36, cy - r * .4, r * .06, cx, cy, r * 1.05)
  g.addColorStop(0, light); g.addColorStop(.42, base[0]); g.addColorStop(.78, base[1]); g.addColorStop(1, base[2])
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill()
  const oc = c.createRadialGradient(cx + r * .45, cy + r * .5, r * .1, cx + r * .2, cy + r * .3, r * 1.25)
  oc.addColorStop(0, 'rgba(0,0,0,.42)'); oc.addColorStop(1, 'transparent')
  c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip(); c.fillStyle = oc; c.fill(); c.restore()
  c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip()
  c.strokeStyle = 'rgba(255,255,255,.30)'; c.lineWidth = 1.6
  c.beginPath(); c.arc(cx, cy, r - .9, Math.PI * .15, Math.PI * .85); c.stroke(); c.restore()
  const sp = c.createRadialGradient(cx - r * .34, cy - r * .4, 0, cx - r * .34, cy - r * .4, r * .42)
  sp.addColorStop(0, 'rgba(255,255,255,.62)'); sp.addColorStop(1, 'transparent')
  c.fillStyle = sp; c.beginPath(); c.ellipse(cx - r * .34, cy - r * .4, r * .38, r * .28, -0.5, 0, 7); c.fill()
}

// ── Hook de canvas: DPR, resize, visibilidad, reduced-motion ──
// draw(c, W, H, t) se llama por frame; si `animated` es false o el usuario
// pidió menos movimiento, se dibuja una sola vez (y en cada resize).
function useCanvas(
  draw: (c: CanvasRenderingContext2D, W: number, H: number, t: number) => void,
  animated: boolean,
  deps: unknown[],
) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const c = canvas.getContext('2d')
    if (!c) return
    const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const DPR = Math.min(window.devicePixelRatio || 1, DPRMAX)
    let W = 0, H = 0
    const size = () => {
      const r = canvas.getBoundingClientRect()
      W = r.width || 60; H = r.height || 60
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR)
      c.setTransform(DPR, 0, 0, DPR, 0, 0)
      if (!animated || RM) drawRef.current(c, W, H, 0)
    }
    size()
    const ro = new ResizeObserver(size); ro.observe(canvas)
    let raf = 0, visible = true
    if (animated && !RM) {
      const io = new IntersectionObserver(es => { visible = es[0].isIntersecting }, { threshold: 0.02 })
      io.observe(canvas)
      const frame = () => { raf = requestAnimationFrame(frame); if (visible && W) drawRef.current(c, W, H, performance.now() / 1000) }
      raf = requestAnimationFrame(frame)
      return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
    }
    return () => { ro.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}

// ═══ 1 · LLAMA DE RACHA (partículas con additive blending) ═══
export function StreakFlame({ height = 78, color = '#ffb454' }: { height?: number; color?: string }) {
  const parts = useRef<{ x: number; y: number; vx: number; vy: number; life: number; r: number; rot: number }[]>([])
  const ref = useCanvas((c, W, H, t) => {
    c.clearRect(0, 0, W, H)
    const bg = c.createRadialGradient(W / 2, H - 12, 2, W / 2, H - 12, 42)
    bg.addColorStop(0, hexa(color, .30)); bg.addColorStop(1, 'transparent')
    c.fillStyle = bg; c.fillRect(0, 0, W, H)
    const P = parts.current
    const spawn = () => P.push({
      x: W / 2 + (Math.random() - .5) * 10, y: H - 12, vx: (Math.random() - .5) * .28,
      vy: -(0.75 + Math.random() * 0.85), life: 1, r: 5 + Math.random() * 8, rot: Math.random() * 6,
    })
    if (t === 0) { // fotograma estático: precalienta la simulación
      P.length = 0
      for (let i = 0; i < 70; i++) { spawn(); P.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.022 }) }
    } else { spawn(); spawn() }
    c.save(); c.globalCompositeOperation = 'lighter'
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]
      if (t !== 0) { p.x += p.vx + Math.sin(t * 3 + p.rot) * .22; p.y += p.vy; p.vy *= 0.985; p.life -= 0.019 }
      if (p.life <= 0 || p.y < 6) { P.splice(i, 1); continue }
      const lf = p.life
      const col = lf > .72 ? [255, 242, 200] : lf > .45 ? [255, 190, 90] : [255, 110, 50]
      const rad = p.r * (0.35 + lf * 0.85)
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad)
      g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${(lf * 0.5).toFixed(3)})`)
      g.addColorStop(1, 'transparent')
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, rad, 0, 7); c.fill()
    }
    c.restore()
    if (P.length > 240) P.splice(0, P.length - 240)
    const core = c.createRadialGradient(W / 2, H - 14, 1, W / 2, H - 14, 13)
    core.addColorStop(0, 'rgba(255,252,235,.9)'); core.addColorStop(1, 'transparent')
    c.fillStyle = core; c.beginPath(); c.arc(W / 2, H - 14, 13, 0, 7); c.fill()
  }, true, [color])
  return <canvas ref={ref} style={{ display: 'block', width: '100%', height }} />
}

// ═══ 2 · ESFERA DE NIVEL (3D + anillo orbital de progreso) ═══
export function LevelOrb({ pct, height = 96 }: { pct: number; height?: number }) {
  const ref = useCanvas((c, W, H, t) => {
    c.clearRect(0, 0, W, H)
    const cx = W / 2, cy = H * 0.46, r = Math.min(W, H) * 0.25
    const hl = c.createRadialGradient(cx, cy, r * .4, cx, cy, r * 2.4)
    hl.addColorStop(0, 'rgba(57,226,230,.16)'); hl.addColorStop(1, 'transparent')
    c.fillStyle = hl; c.fillRect(0, 0, W, H)
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(cx, cy + r * 1.5, r * .85, r * .2, 0, 0, 7); c.fill()
    const rot = t === 0 ? 0.6 : t * 0.5
    c.save(); c.translate(cx, cy); c.rotate(-0.38)
    c.strokeStyle = hexa('#5eeaf0', .22); c.lineWidth = 2; c.setLineDash([3, 5])
    c.beginPath(); c.ellipse(0, 0, r * 1.75, r * .55, 0, Math.PI, Math.PI * 2); c.stroke(); c.setLineDash([]); c.restore()
    sphere3d(c, cx, cy, r, ['rgba(94,234,240,.97)', 'rgba(46,150,206,.95)', 'rgba(9,40,74,.98)'], 'rgba(226,252,255,.99)')
    c.save(); c.translate(cx, cy); c.rotate(-0.38)
    c.strokeStyle = hexa('#bff4fb', .6); c.lineWidth = 2
    c.beginPath(); c.ellipse(0, 0, r * 1.75, r * .55, 0, 0, Math.PI); c.stroke()
    c.strokeStyle = hexa('#39e2e6', .18); c.lineWidth = 6
    c.beginPath(); c.ellipse(0, 0, r * 1.75, r * .55, 0, 0, Math.PI); c.stroke()
    const a = rot % (Math.PI * 2)
    c.fillStyle = Math.sin(a) >= 0 ? '#eafcff' : hexa('#5eeaf0', .45)
    c.beginPath(); c.arc(Math.cos(a) * r * 1.75, Math.sin(a) * r * .55, Math.sin(a) >= 0 ? 3.6 : 2.4, 0, 7); c.fill()
    c.restore()
    c.lineCap = 'round'
    c.beginPath(); c.arc(cx, cy, r * 1.3, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5)
    c.strokeStyle = hexa('#2b3346', .85); c.lineWidth = 4; c.stroke()
    const gp = t === 0 ? 1 : 0.75 + Math.sin(t * 1.8) * 0.25
    const f = Math.max(0.001, Math.min(1, pct / 100))
    c.beginPath(); c.arc(cx, cy, r * 1.3, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * f)
    c.strokeStyle = '#39e2e6'; c.lineWidth = 4; c.shadowColor = '#5eeaf0'; c.shadowBlur = 10 * gp; c.stroke(); c.shadowBlur = 0
  }, true, [pct])
  return <canvas ref={ref} style={{ display: 'block', width: '100%', height }} />
}

// ═══ 3 · ESCALERA DE RANGOS (bloques isométricos que crecen) ═══
export function RankLadder({ ranks, currentIdx, height = 88 }: { ranks: { name: string; color: string }[]; currentIdx: number; height?: number }) {
  const ref = useCanvas((c, W, H, t) => {
    c.clearRect(0, 0, W, H)
    const n = ranks.length, gap = W / (n + 0.5), baseY = H - 26, depth = 9
    ranks.forEach((rk, i) => {
      const x = gap * 0.6 + i * gap, hgt = 10 + i * 7, y = baseY - hgt
      const w = gap * 0.52, done = i <= currentIdx, act = i === currentIdx
      const top = done ? rk.color : '#232c3a'
      const sideL = done ? hexa(rk.color, .55) : '#1a2130'
      const front = done ? hexa(rk.color, .32) : '#141a26'
      if (act) {
        const gl = c.createRadialGradient(x + w / 2, y, 2, x + w / 2, y, 52)
        gl.addColorStop(0, hexa(rk.color, .22)); gl.addColorStop(1, 'transparent')
        c.fillStyle = gl; c.fillRect(0, 0, W, H)
      }
      c.fillStyle = front; c.fillRect(x, y, w, hgt)
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + depth, y - depth * 0.62); c.lineTo(x + w + depth, y - depth * 0.62); c.lineTo(x + w, y); c.closePath()
      c.fillStyle = top; c.fill()
      c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w + depth, y - depth * 0.62); c.lineTo(x + w + depth, y + hgt - depth * 0.62); c.lineTo(x + w, y + hgt); c.closePath()
      c.fillStyle = sideL; c.fill()
      c.strokeStyle = done ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.07)'; c.lineWidth = 1
      c.beginPath(); c.moveTo(x + depth, y - depth * 0.62); c.lineTo(x + w + depth, y - depth * 0.62); c.stroke()
      c.textAlign = 'center'; c.textBaseline = 'top'
      c.fillStyle = act ? rk.color : hexa('#7b8698', done ? .95 : .6)
      c.font = (act ? '700 9px ' : '8px ') + FF
      c.fillText(rk.name, x + w / 2 + depth / 2, baseY + 8)
      if (act) {
        const bob = t === 0 ? 0 : Math.sin(t * 2.4) * 2.5
        const mx = x + w / 2 + depth / 2, my = y - depth * 0.62 - 9 + bob
        c.fillStyle = rk.color; c.beginPath()
        c.moveTo(mx, my); c.lineTo(mx - 4.5, my - 7); c.lineTo(mx + 4.5, my - 7); c.closePath(); c.fill()
      }
    })
  }, true, [ranks, currentIdx])
  return <canvas ref={ref} style={{ display: 'block', width: '100%', height }} />
}

// ═══ 4 · ÍCONO DE MISIÓN — medallón esférico, totalmente estático ═══
export function MissionIcon({ glyph, size = 76, color = '#39e2e6' }: { glyph: string; size?: number; color?: string }) {
  const ref = useCanvas((c, W, H) => {
    c.clearRect(0, 0, W, H)
    const cx = W / 2, cy = H / 2 - 2, r = W * 0.36
    const hl = c.createRadialGradient(cx, cy, r * .5, cx, cy, r * 2.0)
    hl.addColorStop(0, hexa(color, .22)); hl.addColorStop(1, 'transparent')
    c.fillStyle = hl; c.fillRect(0, 0, W, H)
    c.strokeStyle = hexa('#5eeaf0', .35); c.lineWidth = 1.4
    c.beginPath(); c.arc(cx, cy, r * 1.32, 0, 7); c.stroke()
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1.4
    c.beginPath(); c.arc(cx, cy, r * 1.32 + 1.4, Math.PI * .1, Math.PI * .9); c.stroke()
    sphere3d(c, cx, cy, r, ['rgba(70,205,220,.97)', 'rgba(30,120,175,.96)', 'rgba(7,32,60,.98)'], 'rgba(220,250,255,.99)')
    const g = GLYPHS[glyph] ?? GLYPHS.bolt
    const solid = SOLID.has(glyph)
    const s = r * 1.9
    const stamp = (dx: number, dy: number, style: string) => {
      c.save(); c.translate(cx + dx, cy + dy); c.scale(s, s); g(c); c.restore()
      if (solid) { c.fillStyle = style; c.fill() }
      else { c.strokeStyle = style; c.lineWidth = 2; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke() }
    }
    stamp(1, 1.3, 'rgba(2,18,34,.6)')
    stamp(0, 0, 'rgba(240,253,255,.96)')
  }, false, [glyph, color])
  return <canvas ref={ref} style={{ display: 'block', width: size, height: size, flexShrink: 0 }} />
}

// ═══ 5 · ANILLO SEMANAL (toro con grosor, luz superior y cabeza esférica) ═══
export function WeeklyRing({ pct, color, size = 88 }: { pct: number; color: string; size?: number }) {
  const ref = useCanvas((c, W, H, t) => {
    c.clearRect(0, 0, W, H)
    const cx = W / 2, cy = H / 2 - 3, r = Math.min(W, H) * 0.33
    const f = Math.max(0, Math.min(1, pct))
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(cx, cy + r + 9, r * .8, r * .18, 0, 0, 7); c.fill()
    c.strokeStyle = '#0b1018'; c.lineWidth = 11; c.beginPath(); c.arc(cx, cy + 2.5, r, 0, 7); c.stroke()
    c.strokeStyle = '#1b2331'; c.lineWidth = 10; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke()
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy + 1.5, r, 0, 7); c.stroke()
    const a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * f
    c.lineCap = 'round'
    if (f > 0) {
      c.strokeStyle = hexa(color, .35); c.lineWidth = 10
      c.beginPath(); c.arc(cx, cy + 2.5, r, a0, a1); c.stroke()
      const grad = c.createLinearGradient(cx, cy - r, cx, cy + r)
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(.35, color); grad.addColorStop(1, hexa(color, .55))
      c.strokeStyle = grad; c.lineWidth = 8
      const gp = t === 0 ? 1 : 0.75 + Math.sin(t * 1.7 + f * 3) * 0.25
      c.shadowColor = color; c.shadowBlur = 12 * gp
      c.beginPath(); c.arc(cx, cy, r, a0, a1); c.stroke(); c.shadowBlur = 0
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2
      c.beginPath(); c.arc(cx, cy - 2, r, a0, Math.min(a1, a0 + Math.PI * 0.85)); c.stroke()
      if (f < 1) sphere3d(c, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, 5.5, [color, hexa(color, .8), 'rgba(4,10,20,.95)'], '#ffffff')
    }
    // canvas no resuelve var(--…): la pila de fuentes va literal
    c.fillStyle = color; c.font = "700 15px 'Bebas Neue',Impact,sans-serif"
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(Math.round(f * 100) + '%', cx, cy + 1)
  }, true, [pct, color])
  return <canvas ref={ref} style={{ display: 'block', width: size, height: size }} />
}

// ═══ 6 · MEDALLA ACUÑADA (bisel + cara hundida + glifo en relieve) ═══
export function Medal({ glyph, color, earned, size = 62 }: { glyph: string; color: string; earned: boolean; size?: number }) {
  const ref = useCanvas((c, W, H, t) => {
    c.clearRect(0, 0, W, H)
    const cx = W / 2, cy = H / 2, r = W * 0.42
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(cx, cy + r * .95, r * .72, r * .16, 0, 0, 7); c.fill()
    const bevel = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    if (earned) {
      bevel.addColorStop(0, '#ffffff'); bevel.addColorStop(.3, color)
      bevel.addColorStop(.72, hexa(color, .42)); bevel.addColorStop(1, 'rgba(255,255,255,.22)')
    } else {
      bevel.addColorStop(0, '#39424f'); bevel.addColorStop(.4, '#232c38'); bevel.addColorStop(1, '#3a4350')
    }
    c.fillStyle = bevel; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill()
    const face = c.createRadialGradient(cx - r * .3, cy - r * .35, r * .05, cx, cy, r * .86)
    if (earned) { face.addColorStop(0, hexa(color, .5)); face.addColorStop(.55, 'rgba(11,26,42,.95)'); face.addColorStop(1, 'rgba(4,10,18,.98)') }
    else { face.addColorStop(0, '#1d2531'); face.addColorStop(1, '#0d1219') }
    c.fillStyle = face; c.beginPath(); c.arc(cx, cy, r * .82, 0, 7); c.fill()
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 2.4
    c.beginPath(); c.arc(cx, cy, r * .82, Math.PI * 1.05, Math.PI * 1.95); c.stroke()
    c.strokeStyle = earned ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.06)'; c.lineWidth = 1.4
    c.beginPath(); c.arc(cx, cy, r * .82, Math.PI * .08, Math.PI * .9); c.stroke()
    const g = GLYPHS[glyph] ?? GLYPHS.medal
    const solid = SOLID.has(glyph)
    const s = r * 1.55
    const stamp = (dx: number, dy: number, style: string) => {
      c.save(); c.translate(cx + dx, cy + dy); c.scale(s, s); g(c); c.restore()
      if (solid) { c.fillStyle = style; c.fill() }
      else { c.strokeStyle = style; c.lineWidth = 2.2; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke() }
    }
    stamp(1.1, 1.4, 'rgba(0,0,0,.6)')
    stamp(0, 0, earned ? 'rgba(248,254,255,.97)' : 'rgba(120,134,152,.5)')
    if (earned) {
      const a = t === 0 ? -0.9 : (t * 0.7) % (Math.PI * 2)
      c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip()
      c.globalCompositeOperation = 'lighter'
      const sg = c.createLinearGradient(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx - Math.cos(a) * r, cy - Math.sin(a) * r)
      sg.addColorStop(0, 'rgba(255,255,255,.30)'); sg.addColorStop(.42, 'transparent')
      c.fillStyle = sg; c.fillRect(cx - r, cy - r, r * 2, r * 2); c.restore()
    }
  }, earned, [glyph, color, earned])
  return <canvas ref={ref} style={{ display: 'block', width: size, height: size }} />
}

// ═══ 7 · CONFETI 3D (canvas fijo a pantalla completa) ═══
type Conf = { x: number; y: number; z: number; vx: number; vy: number; vz: number; rot: number; vr: number; w: number; h: number; col: string; life: number }
export function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const items = useRef<Conf[]>([])
  const raf = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = canvas.getContext('2d')
    if (!c) return
    const DPR = Math.min(window.devicePixelRatio || 1, DPRMAX)
    const size = () => { canvas.width = innerWidth * DPR; canvas.height = innerHeight * DPR; c.setTransform(DPR, 0, 0, DPR, 0, 0) }
    size(); window.addEventListener('resize', size)
    const frame = () => {
      raf.current = requestAnimationFrame(frame)
      c.clearRect(0, 0, innerWidth, innerHeight)
      const P = items.current
      if (!P.length) return
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i]
        p.vy += 0.26; p.x += p.vx; p.y += p.vy; p.z += p.vz; p.vx *= 0.99; p.rot += p.vr; p.life -= 0.011
        if (p.life <= 0 || p.y > innerHeight + 40) { P.splice(i, 1); continue }
        const scale = 1 / (1.35 - p.z * 0.75)     // perspectiva: z acerca/aleja
        const flip = Math.abs(Math.cos(p.rot * 1.6))  // giro del papel → lee como 3D
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(scale, scale)
        c.globalAlpha = Math.min(1, p.life * 1.6)
        c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h * flip / 2, p.w, Math.max(1, p.h * flip))
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-p.w / 2, p.h * flip / 2, p.w, 1.4)   // canto = espesor
        c.restore()
      }
      c.globalAlpha = 1
    }
    raf.current = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener('resize', size) }
  }, [])

  const fire = useCallback((el: HTMLElement | null) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = el?.getBoundingClientRect()
    const ox = r ? r.left + r.width / 2 : innerWidth / 2
    const oy = r ? r.top + r.height / 2 : innerHeight / 2
    const cols = ['#39e2e6', '#5eeaf0', '#2fd39a', '#ffb454', '#ffffff']
    for (let i = 0; i < 70; i++) {
      const ang = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 7
      items.current.push({
        x: ox, y: oy, z: Math.random() * 1.2 - .2,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 5, vz: (Math.random() - .5) * .09,
        rot: Math.random() * 6, vr: (Math.random() - .5) * .42,
        w: 5 + Math.random() * 7, h: 3 + Math.random() * 5,
        col: cols[(Math.random() * cols.length) | 0], life: 1,
      })
    }
  }, [])

  const node = (
    <canvas ref={canvasRef} aria-hidden style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 60 }} />
  )
  return { fire, node }
}
