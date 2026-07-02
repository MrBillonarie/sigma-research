'use client'
import { useEffect, useRef, useState } from 'react'

// Wrapper de scroll-reveal: el contenido (server-rendered, pasa como children)
// entra con fade+slide la primera vez que cruza el viewport. Además expone la
// clase .rv-in para que descendientes (ej. equity curve) disparen sus propias
// animaciones CSS al hacerse visibles.
export default function Reveal({ children, delay = 0, y = 24 }: {
  children: React.ReactNode
  delay?: number
  y?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); io.disconnect() }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={inView ? 'rv-in' : undefined}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : `translateY(${y}px)`,
        transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}
