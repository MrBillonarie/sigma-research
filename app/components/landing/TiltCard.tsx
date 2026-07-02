'use client'
import { useRef } from 'react'

// Card con inclinación 3D sutil siguiendo el mouse + shine radial en el punto
// del cursor. El contenido llega server-rendered como children.
export default function TiltCard({ children, accent, style }: {
  children: React.ReactNode
  accent: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: React.MouseEvent) {
    const el = ref.current
    if (!el) return
    const r  = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.transform = `perspective(700px) rotateX(${((0.5 - py) * 4).toFixed(2)}deg) rotateY(${((px - 0.5) * 4).toFixed(2)}deg) translateY(-4px)`
    el.style.boxShadow = `0 14px 30px -10px ${accent}45, inset 0 0 0 1px ${accent}35`
    const shine = el.querySelector<HTMLElement>('.tilt-shine')
    if (shine) {
      shine.style.opacity    = '1'
      shine.style.background = `radial-gradient(circle at ${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%, ${accent}16, transparent 55%)`
    }
  }

  function onLeave() {
    const el = ref.current
    if (!el) return
    el.style.transform = 'none'
    el.style.boxShadow = style?.boxShadow?.toString() ?? 'none'
    const shine = el.querySelector<HTMLElement>('.tilt-shine')
    if (shine) shine.style.opacity = '0'
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        ...style,
        transition: 'transform 0.18s ease, box-shadow 0.25s ease',
        willChange: 'transform',
      }}
    >
      <div className="tilt-shine" style={{ position: 'absolute', inset: 0, opacity: 0, transition: 'opacity 0.25s', pointerEvents: 'none', zIndex: 1 }} />
      {children}
    </div>
  )
}
