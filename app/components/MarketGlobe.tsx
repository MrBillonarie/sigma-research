'use client'
import { useEffect, useRef } from 'react'

// ─── Globo de sesiones ───────────────────────────────────────────────────────
// Esfera con continentes y terminador día/noche calculado desde la posición real
// del sol, rodeada de un bisel de 24 h con los arcos de cada plaza y la aguja en
// la hora UTC actual. El globo responde "dónde"; el anillo, "cuándo".

export interface GlobeSession {
  key:    string
  city:   'Tokyo' | 'London' | 'NY'
  color:  string
  uOpen:  number    // apertura en hora UTC decimal
  uClose: number    // cierre en hora UTC decimal
  isOpen: boolean
}

const CITY: Record<GlobeSession['city'], [number, number]> = {
  Tokyo:  [35.7, 139.7],
  London: [51.5, -0.1],
  NY:     [40.7, -74.0],
}

// Contornos muy simplificados: a 60 px de radio sólo hace falta que la silueta
// sea reconocible. Cada anillo es [lat, lon].
const LAND: [number, number][][] = [
  [[70,-160],[72,-120],[68,-95],[60,-94],[50,-80],[45,-65],[40,-74],[30,-81],[25,-97],[20,-105],[30,-115],[40,-124],[50,-128],[60,-140],[70,-160]],
  [[10,-75],[5,-60],[0,-50],[-10,-37],[-23,-43],[-35,-58],[-50,-68],[-55,-70],[-40,-73],[-20,-70],[-5,-81],[10,-75]],
  [[70,25],[60,30],[55,20],[45,15],[40,20],[38,15],[43,5],[48,-5],[55,-8],[60,5],[70,25]],
  [[35,-6],[32,20],[30,32],[15,40],[10,51],[-5,40],[-25,35],[-34,20],[-30,15],[-10,13],[5,8],[15,-17],[28,-13],[35,-6]],
  [[70,60],[70,100],[65,140],[60,160],[50,140],[40,130],[35,125],[30,120],[22,110],[10,100],[8,80],[20,70],[25,60],[35,50],[40,50],[45,55],[55,60],[70,60]],
  [[-12,132],[-12,142],[-20,148],[-32,152],[-38,145],[-35,138],[-32,128],[-25,115],[-18,122],[-12,132]],
]

const rad = (d: number) => (d * Math.PI) / 180

// Declinación solar aproximada — basta para ubicar el terminador con realismo.
function declinacion(d: Date): number {
  const inicio = Date.UTC(d.getUTCFullYear(), 0, 0)
  const dia    = Math.floor((d.getTime() - inicio) / 86_400_000)
  return 23.44 * Math.sin(rad((360 / 365) * (dia - 81)))
}

export default function MarketGlobe({ sessions, utcNow, size = 164 }: {
  sessions: GlobeSession[]; utcNow: Date; size?: number
}) {
  const ref      = useRef<HTMLCanvasElement>(null)
  const datos    = useRef({ sessions, utcNow })
  const pintarRef = useRef<(() => void) | null>(null)

  // Snapshot de los datos + repintado explícito. El efecto de dibujo se monta
  // una sola vez (depende sólo de `size`), así que sin esto el globo se quedaría
  // congelado hasta el siguiente tick del intervalo.
  useEffect(() => {
    datos.current = { sessions, utcNow }
    pintarRef.current?.()
  })

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const c = cv.getContext('2d')
    if (!c) return

    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    cv.width  = size * DPR
    cv.height = size * DPR
    c.setTransform(DPR, 0, 0, DPR, 0, 0)

    const cx = size / 2, cy = size / 2
    const R  = size * 0.335        // radio del globo
    const RR = R + size * 0.075    // radio del bisel
    let visible = true

    const pintar = () => {
      const { sessions: SS, utcNow: now } = datos.current
      const U = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600

      const solLat = declinacion(now)
      const solLon = (12 - U) * 15
      // La cámara no mira al punto subsolar: se desplaza 70°. Si mirara al sol,
      // la cara visible sería siempre el mediodía y el terminador quedaría
      // escondido en el limbo — la sombra no se vería nunca.
      const lon0 = solLon - 70

      const proj = (lat: number, lon: number) => {
        const la = rad(lat), lo = rad(lon - lon0)
        return {
          x: cx + R * Math.cos(la) * Math.sin(lo),
          y: cy - R * Math.sin(la),
          z: Math.cos(la) * Math.cos(lo),
        }
      }
      const luz = (lat: number, lon: number) =>
        Math.sin(rad(lat)) * Math.sin(rad(solLat)) +
        Math.cos(rad(lat)) * Math.cos(rad(solLat)) * Math.cos(rad(lon - solLon))

      c.clearRect(0, 0, size, size)

      // Océano
      c.fillStyle = 'rgba(10,16,26,0.95)'
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill()

      // Malla
      c.lineWidth = 0.55
      for (let lat = -60; lat <= 60; lat += 30) {
        c.beginPath(); let nuevo = true
        for (let lon = -180; lon <= 180; lon += 4) {
          const p = proj(lat, lon)
          if (p.z < 0) { nuevo = true; continue }
          if (nuevo) { c.moveTo(p.x, p.y); nuevo = false } else { c.lineTo(p.x, p.y) }
        }
        c.strokeStyle = 'rgba(94,234,240,0.16)'; c.stroke()
      }
      for (let lon = -180; lon < 180; lon += 30) {
        c.beginPath(); let nuevo = true
        for (let lat = -88; lat <= 88; lat += 4) {
          const p = proj(lat, lon)
          if (p.z < 0) { nuevo = true; continue }
          if (nuevo) { c.moveTo(p.x, p.y); nuevo = false } else { c.lineTo(p.x, p.y) }
        }
        c.strokeStyle = 'rgba(94,234,240,0.12)'; c.stroke()
      }

      // Continentes
      for (const poly of LAND) {
        c.beginPath(); let nuevo = true, vistos = 0
        for (const [la, lo] of poly) {
          const p = proj(la, lo)
          if (p.z < 0) { nuevo = true; continue }
          vistos++
          if (nuevo) { c.moveTo(p.x, p.y); nuevo = false } else { c.lineTo(p.x, p.y) }
        }
        if (vistos < 2) continue
        c.closePath()
        c.fillStyle = 'rgba(57,226,230,0.13)'; c.fill()
        c.strokeStyle = 'rgba(94,234,240,0.55)'; c.lineWidth = 0.9; c.stroke()
      }

      // Noche y brillo diurno, recortados al disco
      c.save()
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip()
      const anti = proj(-solLat, solLon + 180)
      if (anti.z > -0.2) {
        const g = c.createRadialGradient(anti.x, anti.y, R * 0.15, anti.x, anti.y, R * 1.5)
        g.addColorStop(0, 'rgba(3,5,9,0.93)')
        g.addColorStop(0.55, 'rgba(4,6,11,0.62)')
        g.addColorStop(1, 'rgba(6,9,14,0)')
        c.fillStyle = g; c.fillRect(cx - R, cy - R, R * 2, R * 2)
      }
      const sp = proj(solLat, solLon)
      if (sp.z > 0) {
        const g2 = c.createRadialGradient(sp.x, sp.y, 2, sp.x, sp.y, R * 1.1)
        g2.addColorStop(0, 'rgba(94,234,240,0.20)')
        g2.addColorStop(1, 'rgba(94,234,240,0)')
        c.fillStyle = g2; c.fillRect(cx - R, cy - R, R * 2, R * 2)
      }
      c.restore()

      // Limbo
      c.strokeStyle = 'rgba(57,226,230,0.45)'; c.lineWidth = 1.1
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke()

      // Plazas
      for (const s of SS) {
        const [la, lo] = CITY[s.city]
        const p = proj(la, lo)
        if (p.z < 0) continue
        const iluminado = luz(la, lo) > 0
        c.globalAlpha = s.isOpen ? 1 : iluminado ? 0.55 : 0.3
        c.fillStyle   = s.isOpen ? s.color : '#5b6478'
        c.shadowBlur  = s.isOpen ? 10 : 0
        c.shadowColor = s.color
        c.beginPath(); c.arc(p.x, p.y, s.isOpen ? 3.3 : 2.1, 0, Math.PI * 2); c.fill()
        c.shadowBlur = 0
        if (s.isOpen) {
          c.strokeStyle = s.color; c.globalAlpha = 0.45; c.lineWidth = 1
          c.beginPath(); c.arc(p.x, p.y, 6.4, 0, Math.PI * 2); c.stroke()
        }
        c.globalAlpha = 1
      }

      // Bisel de 24 h
      const ang = (h: number) => (h / 24) * Math.PI * 2 - Math.PI / 2
      c.strokeStyle = 'rgba(255,255,255,0.055)'; c.lineWidth = 5
      c.beginPath(); c.arc(cx, cy, RR, 0, Math.PI * 2); c.stroke()
      for (const s of SS) {
        const tramos: [number, number][] = s.uOpen < s.uClose
          ? [[s.uOpen, s.uClose]]
          : [[s.uOpen, 24], [0, s.uClose]]
        for (const [a, b] of tramos) {
          c.strokeStyle = s.color
          c.globalAlpha = s.isOpen ? 1 : 0.4
          c.lineWidth   = 5
          c.shadowBlur  = s.isOpen ? 8 : 0
          c.shadowColor = s.color
          c.beginPath(); c.arc(cx, cy, RR, ang(a), ang(b)); c.stroke()
          c.shadowBlur = 0; c.globalAlpha = 1
        }
      }
      const a = ang(U)
      c.strokeStyle = 'rgba(94,234,240,0.95)'; c.lineWidth = 1.3
      c.beginPath()
      c.moveTo(cx + Math.cos(a) * (RR - 5), cy + Math.sin(a) * (RR - 5))
      c.lineTo(cx + Math.cos(a) * (RR + 5), cy + Math.sin(a) * (RR + 5))
      c.stroke()
      c.fillStyle = '#5eeaf0'
      c.beginPath(); c.arc(cx + Math.cos(a) * (RR + 5.5), cy + Math.sin(a) * (RR + 5.5), 2, 0, Math.PI * 2); c.fill()
    }

    // Sin requestAnimationFrame: esto cambia con el minuto, no con el fotograma.
    // Se repinta cuando avanza el reloj que ya mantiene RightBar y, además, cada
    // 30 s por si ese reloj se detuviera.
    pintarRef.current = pintar
    pintar()
    const io = new IntersectionObserver(es => {
      visible = es[0].isIntersecting
      if (visible) pintar()
    }, { threshold: 0 })
    io.observe(cv)
    const t = window.setInterval(() => { if (visible) pintar() }, 30_000)

    return () => {
      window.clearInterval(t)
      io.disconnect()
      pintarRef.current = null
    }
  }, [size])

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: size, height: size, display: 'block', margin: '0 auto' }}
      aria-hidden
    />
  )
}
