'use client'
import { useEffect, useRef, useState } from 'react'
import type { FlowSignal } from '@/types/decision-engine'

// Mapa de flujo vivo — el capital como núcleo y los mercados como nodos,
// conectados por corrientes de partículas animadas: verdes/en color del
// mercado cuando el capital ENTRA, rojas cuando SALE, grises tenues en
// neutro. Densidad y velocidad según la fuerza del flujo. Canvas propio
// con rAF único, pausado fuera de pantalla.

interface Props {
  signals:   FlowSignal[]
  flowScore: number
}

const BG = '#0a0e1a', BORDER = '#1f2a45', DIM = '#7a7f9a', MUTED = '#3a3f55'
const TEXT = '#e8e9f0', GREEN = '#2fd39a', RED = '#ff5d6c', GOLD = '#39e2e6'

function useCountUp(target: number, dur = 1200) {
  const [v, setV] = useState(0)
  const fromRef = useRef(0)
  const vRef = useRef(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(target); fromRef.current = target; vRef.current = target
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

// Random determinista por índice — las partículas no "saltan" entre renders.
function det(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

export default function FlowIndicator({ signals, flowScore }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef   = useRef(signals)
  const animScore = useCountUp(flowScore, 1400)
  const scoreColor = flowScore > 60 ? GREEN : flowScore > 40 ? GOLD : RED

  useEffect(() => { dataRef.current = signals }, [signals])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0, visible = true, W = 0, H = 0

    function resize() {
      if (!cv) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = cv.clientWidth; H = cv.clientHeight
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(cv)
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting }, { threshold: 0.05 }); io.observe(cv)

    function scene(now: number) {
      const S = dataRef.current
      if (!S.length || W === 0) return
      const t = now / 1000

      ctx!.clearRect(0, 0, W, H)

      // Hub — núcleo de capital
      const hubX = 64, hubY = H / 2
      // Nodos — columna derecha
      const nodeX = W - 118
      const rowH = H / (S.length + 0.4)

      S.forEach((s, i) => {
        const nodeY = rowH * (i + 0.7)
        const trend = s.trend
        const strength = trend === 'entrando' ? s.inflow : trend === 'saliendo' ? s.outflow : 30
        const cx1 = hubX + (nodeX - hubX) * 0.45
        const cx2 = hubX + (nodeX - hubX) * 0.6

        // curva base
        const curveColor = trend === 'entrando' ? s.color : trend === 'saliendo' ? RED : MUTED
        ctx!.strokeStyle = `${curveColor}30`
        ctx!.lineWidth = 1.2
        ctx!.beginPath()
        ctx!.moveTo(hubX + 40, hubY)
        ctx!.bezierCurveTo(cx1, hubY, cx2, nodeY, nodeX - 10, nodeY)
        ctx!.stroke()

        // partículas
        const nP = trend === 'neutro' ? 2 : 3 + Math.round(strength / 28)
        const speed = trend === 'neutro' ? 0.05 : 0.09 + strength * 0.0012
        for (let k = 0; k < nP; k++) {
          let tp = ((reduced ? 0.5 : t * speed) + det(k, i * 7 + 1)) % 1
          if (trend === 'saliendo') tp = 1 - tp
          // punto sobre la bezier
          const u = tp, iu = 1 - u
          const px = iu*iu*iu*(hubX+40) + 3*iu*iu*u*cx1 + 3*iu*u*u*cx2 + u*u*u*(nodeX-10)
          const py = iu*iu*iu*hubY + 3*iu*iu*u*hubY + 3*iu*u*u*nodeY + u*u*u*nodeY
          const alpha = trend === 'neutro' ? 0.35 : 0.5 + det(k, i * 13 + 5) * 0.5
          ctx!.save()
          ctx!.shadowColor = curveColor
          ctx!.shadowBlur = 6
          ctx!.fillStyle = curveColor
          ctx!.globalAlpha = alpha
          ctx!.beginPath()
          ctx!.arc(px, py, trend === 'neutro' ? 1.3 : 1.8, 0, Math.PI * 2)
          ctx!.fill()
          ctx!.restore()
        }
        ctx!.globalAlpha = 1

        // nodo del mercado
        ctx!.save()
        ctx!.shadowColor = s.color
        ctx!.shadowBlur = trend === 'entrando' ? 10 : 4
        ctx!.fillStyle = s.color
        ctx!.beginPath()
        ctx!.arc(nodeX, nodeY, 5, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.restore()

        // etiqueta del mercado + %
        ctx!.font = '600 11px monospace'
        ctx!.textAlign = 'left'
        ctx!.fillStyle = TEXT
        ctx!.fillText(s.market, nodeX + 12, nodeY - 2)
        ctx!.font = '9px monospace'
        ctx!.fillStyle = DIM
        ctx!.fillText(`${s.inflow.toFixed(0)}%/${s.outflow.toFixed(0)}%`, nodeX + 12, nodeY + 11)

        // chip de tendencia bajo el nodo (al lado izquierdo de la curva final)
        const chip = trend === 'entrando' ? '▲' : trend === 'saliendo' ? '▼' : '→'
        ctx!.font = '700 10px monospace'
        ctx!.fillStyle = trend === 'entrando' ? GREEN : trend === 'saliendo' ? RED : DIM
        ctx!.textAlign = 'right'
        ctx!.fillText(chip, nodeX - 14, nodeY + 4)
      })

      // Hub encima de las curvas
      const pulse = reduced ? 0 : Math.sin(t * 2.2) * 0.5 + 0.5
      ctx!.save()
      ctx!.shadowColor = GOLD
      ctx!.shadowBlur = 12 + pulse * 8
      ctx!.fillStyle = '#0d0f18'
      ctx!.strokeStyle = GOLD
      ctx!.lineWidth = 1.2
      const bw = 82, bh = 34
      ctx!.beginPath()
      if ('roundRect' in ctx!) (ctx as CanvasRenderingContext2D & { roundRect: (x:number,y:number,w:number,h:number,r:number)=>void }).roundRect(hubX - bw/2 + 20, hubY - bh/2, bw, bh, 6)
      else ctx!.rect(hubX - bw/2 + 20, hubY - bh/2, bw, bh)
      ctx!.fill()
      ctx!.stroke()
      ctx!.restore()
      ctx!.font = '700 11px monospace'
      ctx!.textAlign = 'center'
      ctx!.fillStyle = GOLD
      ctx!.fillText('CAPITAL', hubX + 20, hubY + 4)
    }

    function loop(now: number) {
      if (visible && !document.hidden) scene(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [])

  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 12, color: DIM, fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }}>
          FLUJO DE CAPITAL CROSS-MARKET
        </h3>
        <div style={{ fontSize: 12, fontFamily: 'monospace', color: scoreColor, fontWeight: 700 }}>
          Score global: {Math.round(animScore)}/100
        </div>
      </div>

      {/* Score global — barre al cargar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${animScore}%`, background: `linear-gradient(90deg, #4f92ff, ${scoreColor})`, borderRadius: 3 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: MUTED, fontFamily: 'monospace' }}>
          <span>BEAR</span><span>NEUTRO</span><span>BULL</span>
        </div>
      </div>

      {/* Mapa de flujo — el capital rotando entre mercados, en vivo */}
      <div style={{ flex: 1, minHeight: Math.max(190, signals.length * 52) }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      <p style={{ margin: '10px 0 0', fontSize: 10, color: MUTED, fontFamily: 'monospace', lineHeight: 1.5 }}>
        * Partículas hacia el mercado = capital entrando · hacia el núcleo = saliendo. Flujo desde momentum 1m vs 3m.
      </p>
    </div>
  )
}
