'use client'
import { useEffect, useRef } from 'react'

// ─── Sello personal — capas orbitales según plan ─────────────────────────────
// Reemplaza el anillo cónico giratorio (idéntico para todos) por un sello cuya
// GEOMETRÍA se deriva del id de la cuenta —única y estable por usuario— y cuya
// DENSIDAD/PALETA la define el plan: FREE 1 capa en acero, PRO 3 capas en cian
// con nodos esféricos y anillo perimetral de acreditación.

interface Props {
  /** id de usuario (o cualquier string estable) — de acá sale la geometría */
  seedKey: string
  isPro: boolean
  size?: number
}

const PAL = {
  free: {
    ring: ['#8fa3b8', '#6b7a8f'],
    core: ['rgba(150,170,190,.95)', 'rgba(80,95,115,.95)', 'rgba(20,26,36,.98)'] as [string, string, string],
    light: 'rgba(225,235,245,.9)',
  },
  pro: {
    ring: ['#39e2e6', '#4f92ff'],
    core: ['rgba(120,225,240,.98)', 'rgba(40,140,195,.96)', 'rgba(8,36,66,.98)'] as [string, string, string],
    light: 'rgba(232,253,255,.99)',
  },
}

const hexa = (h: string, a: number) => {
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}
// FNV-1a: mismo id → mismo sello, siempre, en cualquier dispositivo
function seedFrom(str: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h >>> 0
}
function rngFrom(seed: number) {
  let s = seed >>> 0
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 }
}
function sphere(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, base: [string, string, string], light: string) {
  const g = c.createRadialGradient(cx - r * .36, cy - r * .4, r * .06, cx, cy, r * 1.05)
  g.addColorStop(0, light); g.addColorStop(.42, base[0]); g.addColorStop(.78, base[1]); g.addColorStop(1, base[2])
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill()
  c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip()
  c.strokeStyle = 'rgba(255,255,255,.30)'; c.lineWidth = Math.max(1, r * 0.22)
  c.beginPath(); c.arc(cx, cy, r - .8, Math.PI * .15, Math.PI * .85); c.stroke(); c.restore()
}

export default function PerfilSeal({ seedKey, isPro, size = 118 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = canvas.getContext('2d')
    if (!c) return
    const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0, H = 0
    const fit = () => {
      const r = canvas.getBoundingClientRect()
      W = r.width || size; H = r.height || size
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR)
      c.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit); ro.observe(canvas)
    let visible = true
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting }, { threshold: 0.02 })
    io.observe(canvas)
    let raf = 0

    const P = isPro ? PAL.pro : PAL.free
    const shells = isPro ? 3 : 1

    const draw = (t: number) => {
      if (!W) return
      const rnd = rngFrom(seedFrom(seedKey))
      c.clearRect(0, 0, W, H)
      const cx = W / 2, cy = H / 2
      const R = Math.min(W, H) * 0.42
      const coreR = R * 0.30            // hueco: la foto del avatar va acá
      const spin = RM ? 0.35 : t * 0.14

      if (isPro) {
        const hl = c.createRadialGradient(cx, cy, coreR, cx, cy, R * 1.3)
        hl.addColorStop(0, hexa(P.ring[0], .13)); hl.addColorStop(1, 'transparent')
        c.fillStyle = hl; c.fillRect(0, 0, W, H)
      }

      for (let i = 0; i < shells; i++) {
        const rx = coreR + (R - coreR) * (0.5 + 0.5 * ((i + 1) / shells))
        const ky = 0.28 + rnd() * 0.42
        const rot = rnd() * Math.PI + spin * (i % 2 ? -0.7 : 0.7)
        const col = i === 0 ? P.ring[0] : P.ring[1]

        c.save(); c.translate(cx, cy); c.rotate(rot)
        if (isPro) {  // pasada de sombra = espesor del anillo
          c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 2.6
          c.beginPath(); c.ellipse(0, 1.6, rx, rx * ky, 0, 0, 7); c.stroke()
        }
        c.strokeStyle = hexa(col, isPro ? .5 : .35)
        c.lineWidth = isPro ? 1.6 : 1.2
        c.beginPath(); c.ellipse(0, 0, rx, rx * ky, 0, 0, 7); c.stroke()
        if (isPro) {  // reflejo especular sólo en el cuarto superior
          c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 0.9
          c.beginPath(); c.ellipse(0, -.8, rx, rx * ky, 0, Math.PI * 1.08, Math.PI * 1.62); c.stroke()
        }
        c.restore()

        // nodos: en PRO son esferas con profundidad (adelante brillan, atrás se apagan)
        const nodes = isPro ? 2 + Math.floor(rnd() * 2) : 1
        for (let k = 0; k < nodes; k++) {
          const a = rnd() * Math.PI * 2 + spin * (1.6 + i * 0.6)
          const depth = (Math.sin(a) + 1) / 2
          const x = cx + Math.cos(a) * rx * Math.cos(rot) - Math.sin(a) * rx * ky * Math.sin(rot)
          const y = cy + Math.cos(a) * rx * Math.sin(rot) + Math.sin(a) * rx * ky * Math.cos(rot)
          if (isPro) sphere(c, x, y, 1.8 + depth * 2.2, P.core, P.light)
          else { c.fillStyle = hexa(P.ring[0], .45); c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill() }
        }
      }

      if (isPro) {  // anillo perimetral de acreditación
        c.strokeStyle = hexa(P.ring[0], .34); c.lineWidth = 1
        c.beginPath(); c.arc(cx, cy, R * 1.12, 0, 7); c.stroke()
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 - spin * 0.5
          c.strokeStyle = hexa(P.ring[0], .6); c.lineWidth = 1.4
          c.beginPath()
          c.moveTo(cx + Math.cos(a) * R * 1.12, cy + Math.sin(a) * R * 1.12)
          c.lineTo(cx + Math.cos(a) * R * 1.19, cy + Math.sin(a) * R * 1.19)
          c.stroke()
        }
      }
    }

    if (RM) draw(0)
    else {
      const frame = () => { raf = requestAnimationFrame(frame); if (visible) draw(performance.now() / 1000) }
      raf = requestAnimationFrame(frame)
    }
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [seedKey, isPro, size])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: 'absolute', inset: 0, display: 'block', width: size, height: size, pointerEvents: 'none' }}
    />
  )
}
