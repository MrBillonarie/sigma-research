'use client'
import { useEffect, useRef, useState } from 'react'

// ── Decision de arquitectura (2026-07-03) ───────────────────────────────────
// Esta pagina scrapea el HTML del motor (DOMParser + innerHTML) en vez de
// pedirle datos JSON y dibujar componentes React propios. Es fragil en
// teoria (si el motor renombra una clase/id, algo que dependa de eso puede
// romperse), pero se intento migrar a componentes nativos (KPI strip, tabla
// de posiciones, matrices Motor 1/2/3) y NINGUN intento de igualar el diseno
// exacto convencio en revision visual, ni siquiera calcando colores/fuentes/
// umbrales 1:1 de dashboard.py -- un problema real encontrado tarde fue que
// el header institucional del motor va ANTES del kpi-strip en el scrape,
// pero los componentes nativos se renderizaban antes de todo el bloque
// inyectado, invirtiendo el orden de lectura de la pagina.
//
// Decision: seguir scrapeando (cero riesgo visual, es literalmente el mismo
// HTML) y en cambio blindar los puntos frágiles puntuales con cambios
// aditivos que no tocan el render: atributos data-sym/data-tf/data-dir/
// data-mode/data-strategy en las filas de posiciones (ver dedupPositionRows
// abajo) + hud_reskin_canary.py en el motor (corre cada 15 min, avisa por
// Telegram si el motor cambia algo de lo que este reskin depende, antes de
// que lo note un usuario). Los componentes nativos abandonados quedan en
// app/components/hud/ por si se retoma esto con mas tiempo para iterar el
// diseno en vivo junto al usuario, en vez de a ciegas por captura de pantalla.

// El motor tiene dos trackers paralelos (portfolio global + per-modelo) que
// pueden emitir una fila por separado para el mismo trade abierto en la
// tabla "POSICIONES ABIERTAS". Se eliminan los duplicados por sym+tf+dirección
// priorizando siempre la fila marcada como REAL (posición en Binance live)
// sobre cualquier posición paper del mismo par/timeframe.
function dedupPositionRows(container: HTMLElement): void {
  const SYM = /^(BTC|ETH|SOL|BNB|LTC|XAU|XAG|WTI|NG|HG|PL)$/i
  const TF  = /^(1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|3d|1w)$/i

  container.querySelectorAll('table').forEach(tbl => {
    const rows = Array.from(tbl.querySelectorAll('tr')).filter(
      r => r.querySelectorAll('td').length >= 8
    )
    const seen = new Map<string, { row: Element; size: number; isReal: boolean }>()

    for (const row of rows) {
      const el = row as HTMLElement
      const cells = Array.from(row.querySelectorAll('td'))
        .map(td => td.textContent?.replace(/\s+/g, ' ').trim() ?? '')

      // Contrato explícito: el motor emite data-sym/data-tf/data-dir/data-mode/
      // data-strategy en el <tr> (ver dashboard.py, tabla de posiciones abiertas).
      // Si están presentes se usan tal cual — nada de adivinar por texto. Si faltan
      // (fuente vieja sin desplegar el cambio, u otra tabla ajena) cae a la
      // heurística anterior basada en regex sobre el contenido de las celdas.
      const hasContract = !!(el.dataset.sym && el.dataset.tf && el.dataset.mode)

      let sym: string, tf: string, disambig: string, isReal: boolean
      if (hasContract) {
        sym      = el.dataset.sym!.toUpperCase()
        tf       = el.dataset.tf!.toUpperCase()
        disambig = `${el.dataset.dir ?? ''}::${el.dataset.strategy ?? ''}`
        isReal   = el.dataset.mode === 'live'
      } else {
        const symIdx = cells.findIndex(c => SYM.test(c))
        const tfIdx  = cells.findIndex(c => TF.test(c.toUpperCase()))
        if (symIdx < 0 || tfIdx < 0) continue
        sym      = cells[symIdx].toUpperCase()
        tf       = cells[tfIdx].toUpperCase()
        disambig = cells[tfIdx + 1] ?? ''
        // REAL puede aparecer como texto o como clase CSS (el motor usa text-transform:uppercase)
        const rowText = row.textContent ?? ''
        const rowHtml = row.innerHTML
        isReal = /\breal\b/i.test(rowText) || /\blive\b/i.test(rowText) ||
                 /class="[^"]*\blive\b/i.test(rowHtml) || /mode['":\s]+live/i.test(rowHtml)
      }

      const key  = `${sym}::${tf}::${disambig}`
      const size = parseFloat((cells.find(c => /\$[\d,]+/.test(c)) ?? '').replace(/[^0-9.]/g, '')) || 0

      if (seen.has(key)) {
        const prev = seen.get(key)!
        // REAL/LIVE > paper siempre; si ambos iguales, gana el más pequeño
        // (posición real en Binance siempre es menor que la simulación paper)
        const keepCurrent = (!prev.isReal && isReal) || (prev.isReal === isReal && size < prev.size)
        if (keepCurrent) { prev.row.remove(); seen.set(key, { row, size, isReal }) }
        else row.remove()
      } else {
        seen.set(key, { row, size, isReal })
      }
    }
  })
}

export default function HUDPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    let observer: MutationObserver | null = null
    let dedupTimer: ReturnType<typeof setTimeout> | null = null

    async function injectMotor() {
      try {
        const res = await fetch('/api/vps/motor-proxy', { cache: 'no-store' })
        if (!res.ok) throw new Error(`${res.status}`)
        const html = await res.text()
        if (cancelled || !containerRef.current) return

        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        // ── 1. Inject <style> blocks ───────────────────────────────────────
        doc.querySelectorAll('style').forEach(s => {
          const el = document.createElement('style')
          el.textContent = s.textContent
          document.head.appendChild(el)
        })

        // ── 2. Inject <link rel="stylesheet"> ─────────────────────────────
        doc.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
          const el = document.createElement('link')
          el.rel = 'stylesheet'
          el.href = (l as HTMLLinkElement).href
          document.head.appendChild(el)
        })

        // ── 3. Inject body HTML ────────────────────────────────────────────
        if (containerRef.current) {
          containerRef.current.innerHTML = doc.body.innerHTML
          dedupPositionRows(containerRef.current)
        }

        // ── 4. Execute <script> tags in order ─────────────────────────────
        const scripts = Array.from(doc.querySelectorAll('script'))
        for (const oldScript of scripts) {
          await new Promise<void>(resolve => {
            const s = document.createElement('script')
            if (oldScript.src) {
              s.src = oldScript.src
              s.onload = () => resolve()
              s.onerror = () => resolve()
            } else {
              s.textContent = oldScript.textContent
            }
            document.body.appendChild(s)
            if (!oldScript.src) resolve()
          })
        }

        // Re-run after scripts execute in case they rebuilt rows
        if (containerRef.current && !cancelled) dedupPositionRows(containerRef.current)

        // MutationObserver: re-aplica dedup cuando los scripts del motor
        // actualicen la tabla vía polling/WebSocket (sin esto las filas
        // duplicadas reaparecen en cada refresh del motor)
        if (containerRef.current && !cancelled) {
          observer = new MutationObserver(() => {
            if (dedupTimer) clearTimeout(dedupTimer)
            dedupTimer = setTimeout(() => {
              if (containerRef.current && !cancelled) {
                observer?.disconnect()
                dedupPositionRows(containerRef.current)
                if (containerRef.current && !cancelled) {
                  observer?.observe(containerRef.current, { childList: true, subtree: true })
                }
              }
            }, 150)
          })
          observer.observe(containerRef.current, { childList: true, subtree: true })
        }

        if (!cancelled) setStatus('ok')
      } catch (e) {
        console.error('Motor proxy error:', e)
        // Reintento automatico con backoff antes de pedirle al usuario que
        // recargue a mano -- cubre caidas cortas del motor (deploy, restart)
        // sin que el usuario tenga que hacer nada. Solo afecta el camino de
        // falla, no cambia nada del render normal.
        if (!cancelled && retryCount < 3) {
          retryCount += 1
          const delay = retryCount * 3000
          retryTimer = setTimeout(() => { if (!cancelled) injectMotor() }, delay)
        } else if (!cancelled) {
          setStatus('error')
        }
      }
    }

    let retryCount = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    injectMotor()
    return () => {
      cancelled = true
      observer?.disconnect()
      if (dedupTimer) clearTimeout(dedupTimer)
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [])

  // El dashboard del motor genera parte de su navegación (ej. "Per-Model
  // Paper") vía JS, con hrefs absolutos como /models. /hud no tiene sub-rutas
  // propias para servir eso, pero /motor-en-vivo sí (ya con su propio proxy
  // y gate de contraseña) — así que cualquier link interno se redirige ahí
  // en vez de navegar a squantdesk.com/<ruta>, que no existe.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      const a = target.closest('a[href^="/"]') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      if (href.startsWith('/api/') || href.startsWith('/download/') || href.startsWith('/motor-en-vivo')) return
      e.preventDefault()
      window.location.href = `/motor-en-vivo${href}`
    }
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [])

  // Tilt 3D en las tarjetas del motor — efecto 100% del lado web (transform
  // inline sobre el DOM inyectado), delegado para sobrevivir a los refresh
  // del motor. Ángulos suaves (≤2.5°) para look premium, no mareo.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = containerRef.current
    if (!root) return
    let raf = 0
    let target: HTMLElement | null = null
    let rx = 0, ry = 0
    function onMove(e: MouseEvent) {
      const card = (e.target as HTMLElement).closest?.('.card') as HTMLElement | null
      if (card !== target && target) target.style.transform = ''
      target = card
      if (!card) return
      const r = card.getBoundingClientRect()
      ry = ((e.clientX - r.left) / r.width - 0.5) * 2.6
      rx = -((e.clientY - r.top) / r.height - 0.5) * 2.0
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0
        if (target) target.style.transform = `perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-2px)`
      })
    }
    function onLeave() { if (target) { target.style.transform = ''; target = null } }
    root.addEventListener('mousemove', onMove)
    root.addEventListener('mouseleave', onLeave)
    return () => {
      root.removeEventListener('mousemove', onMove)
      root.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      {/* Re-skin "Black & Gold" — overrides CSS del lado web. Vive en el
          <body>, gana la cascada frente a los estilos del motor (en <head>)
          sin modificar nada del motor. Traduce la paleta azulada del engine
          al negro profundo + dorado del sitio, con títulos de sección estilo
          landing y un glow ligero en los datos clave. */}
      <style>{`
        @keyframes hud-pulse { 0%,100%{opacity:1; transform:scale(1)} 50%{opacity:0.55; transform:scale(0.96)} }
        @keyframes hud-scan  { 0%{left:-40%} 100%{left:100%} }
        @keyframes hud-drift1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-46px,54px)} }
        @keyframes hud-drift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(52px,-40px)} }
        @keyframes hud-scanY  { 0%{top:-6%} 100%{top:106%} }
        @keyframes hud-stripes { to { background-position: 28px 0; } }
        @keyframes hud-optpulse {
          0%,100% { box-shadow: inset 0 0 0 1px rgba(57,226,230,0.25), 0 0 10px rgba(57,226,230,0.1); }
          50%     { box-shadow: inset 0 0 0 1px rgba(57,226,230,0.55), 0 0 20px rgba(57,226,230,0.25); }
        }
        @keyframes hud-alphapulse {
          0%,100% { box-shadow: 0 0 18px rgba(46,204,113,0.12), inset 0 0 14px rgba(46,204,113,0.05); }
          50%     { box-shadow: 0 0 34px rgba(46,204,113,0.28), inset 0 0 20px rgba(46,204,113,0.1); }
        }

        /* ══ 0. Redefinir el acento del motor: --gold → cian ══
           kpi-pos, acentos y bordes del motor usan var(--gold). Al reescribir
           la variable sobre #sigma-hud-root, todo el dorado se vuelve cian de
           una, conservando kpi-neg (rojo) y kpi-neutral (texto). */
        #sigma-hud-root {
          --gold: #39e2e6; --gold-2: #5eeaf0; --amber: #39e2e6;
          --acc: #39e2e6; --accent: #39e2e6; --brand: #39e2e6;
        }
        /* golds directos (no via variable) que sobreviven */
        #sigma-hud-root [style*="#f1c40f"], #sigma-hud-root [style*="#ffd700"],
        #sigma-hud-root [style*="#c9a227"], #sigma-hud-root [style*="#ffeb3b"] { color: #39e2e6 !important; }

        /* contenedores raíz del motor transparentes: dejan ver el escenario
           ambiental (grilla + auroras) detrás de las tarjetas */
        #sigma-hud-root > div, #sigma-hud-root .container, #sigma-hud-root .wrap,
        #sigma-hud-root main { background: transparent !important; }

        /* ══ 1. Tarjetas → vidrio premium con hover ══ */
        #sigma-hud-root .card {
          position: relative;
          background: linear-gradient(180deg, rgba(22,28,40,0.5), rgba(11,15,23,0.42)) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 16px !important;
          box-shadow: 0 2px 10px rgba(0,0,0,0.4), 0 20px 52px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05) !important;
          backdrop-filter: blur(8px);
          overflow: hidden;
          transition: transform .3s ease, box-shadow .3s ease, border-color .3s ease;
        }
        #sigma-hud-root .card:hover {
          transform: translateY(-2px);
          border-color: rgba(57,226,230,0.32) !important;
          box-shadow: 0 8px 20px rgba(0,0,0,0.45), 0 30px 72px rgba(0,0,0,0.5), 0 0 0 1px rgba(57,226,230,0.12) !important;
        }
        #sigma-hud-root .card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, rgba(57,226,230,0.85), rgba(79,146,255,0.4) 45%, transparent 82%);
        }
        #sigma-hud-root .card-title {
          color: #39e2e6 !important;
          letter-spacing: 0.2em !important;
          text-transform: uppercase;
        }

        /* KPIs / risk cells / asset boxes → vidrio con hover */
        #sigma-hud-root .kpi-strip { background: transparent !important; }
        #sigma-hud-root .kpi-card, #sigma-hud-root .risk-cell, #sigma-hud-root .asset-box {
          background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012)) !important;
          border: 1px solid rgba(255,255,255,0.07) !important;
          border-radius: 12px !important;
          transition: transform .25s ease, border-color .25s ease, background .25s ease;
        }
        #sigma-hud-root .kpi-card { margin: 4px !important; }
        #sigma-hud-root .kpi-card:hover, #sigma-hud-root .risk-cell:hover, #sigma-hud-root .asset-box:hover {
          transform: translateY(-1px);
          border-color: rgba(57,226,230,0.3) !important;
          background: linear-gradient(180deg, rgba(57,226,230,0.06), rgba(255,255,255,0.015)) !important;
        }
        #sigma-hud-root .kpi-label, #sigma-hud-root .risk-cell-label {
          color: #8b97ad !important; letter-spacing: 0.2em !important; text-transform: uppercase;
        }
        /* números: peso + glow del propio color (cian pos / rojo neg) */
        #sigma-hud-root .kpi-value, #sigma-hud-root .risk-cell-val { font-weight: 600 !important; text-shadow: 0 0 16px currentColor; }
        #sigma-hud-root .kpi-neg { color: #ff5d6c !important; }
        #sigma-hud-root .cell-ok { text-shadow: 0 0 10px rgba(47,211,154,0.45); }

        /* Unificar paneles azules del motor (inline) a superficie oscura */
        #sigma-hud-root [style*="#141b38"], #sigma-hud-root [style*="#1a2240"],
        #sigma-hud-root [style*="#242f55"], #sigma-hud-root [style*="#0d1428"],
        #sigma-hud-root [style*="#07091c"], #sigma-hud-root [style*="#060d20"],
        #sigma-hud-root [style*="#050d1e"] { background-color: rgba(255,255,255,0.02) !important; }

        #sigma-hud-root .badge, #sigma-hud-root .pill, #sigma-hud-root .tf-pill { border-radius: 6px !important; }
        #sigma-hud-root .matrix td { border-radius: 6px !important; }
        /* filas del feed: hover sutil */
        #sigma-hud-root .feed-item { border-radius: 8px !important; transition: background .25s ease; }
        #sigma-hud-root .feed-item:hover { background: rgba(57,226,230,0.05) !important; }

        /* ══ 2. Títulos de sección estilo landing ══ */
        #sigma-hud-root .section-divider { margin: 40px 0 20px !important; }
        #sigma-hud-root .section-divider-text {
          font-family: 'Bebas Neue', Impact, sans-serif !important;
          font-size: 22px !important;
          letter-spacing: 0.14em !important;
          color: #39e2e6 !important;
          text-shadow: 0 0 24px rgba(57,226,230,0.3);
        }
        #sigma-hud-root .section-divider-line {
          height: 1px !important;
          background: linear-gradient(90deg, transparent, rgba(57,226,230,0.45)) !important;
        }
        #sigma-hud-root .section-divider-line:last-of-type {
          background: linear-gradient(270deg, transparent, rgba(57,226,230,0.45)) !important;
        }

        /* ══ 6. Sala de máquinas — Simulación Paper Trading (#trades-section) ══ */
        /* Cockpit: la fila de stats del header como barra de instrumentos glass */
        #sigma-hud-root #trades-section div[style*="gap:20px"][style*="align-items:center"] {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; padding: 8px 16px !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }
        #sigma-hud-root #trades-section span[style*="color:#333"] { display: none; } /* separadores "·" */
        #sigma-hud-root #float-pnl { font-size: 16px !important; text-shadow: 0 0 12px currentColor; }

        /* Barra de capital: instrumento con marco propio */
        #sigma-hud-root #trades-section div[style*="border-bottom:1px solid #141b38"] {
          background: linear-gradient(90deg, rgba(57,226,230,0.05), rgba(255,255,255,0.015) 40%);
          border: 1px solid rgba(255,255,255,0.07) !important;
          border-radius: 10px; padding: 9px 16px !important; margin-bottom: 14px !important;
        }
        #sigma-hud-root #capital-live {
          font-size: 16px !important; color: #5eeaf0 !important;
          text-shadow: 0 0 14px rgba(57,226,230,0.5) !important;
        }

        /* Blotter institucional: tablas de posiciones e historial */
        #sigma-hud-root #trades-section th {
          color: #8b97ad !important; font-size: 10px !important;
          letter-spacing: 0.16em !important; text-transform: uppercase;
          padding: 9px 10px !important;
          border-bottom: 1px solid rgba(57,226,230,0.18) !important;
        }
        #sigma-hud-root #trades-section td {
          padding: 10px 10px !important;
          border-bottom: 1px solid rgba(255,255,255,0.045) !important;
        }
        #sigma-hud-root #trades-section tbody tr { transition: background .2s ease; }
        #sigma-hud-root #trades-section tbody tr:nth-child(even) { background: rgba(255,255,255,0.018); }
        #sigma-hud-root #trades-section tbody tr:hover { background: rgba(57,226,230,0.055) !important; }
        /* pills (LONG/SHORT, grades) con glow sutil */
        #sigma-hud-root #trades-section td span[style*="border-radius"] {
          border-radius: 6px !important; font-weight: 700;
          letter-spacing: 0.07em; box-shadow: 0 0 12px -3px currentColor;
        }
        /* semánticos de texto → paleta Cyan Deck */
        #sigma-hud-root [style*="color:#00e676"] { color: #2fd39a !important; }
        #sigma-hud-root [style*="color:#f44336"], #sigma-hud-root [style*="color:#f85149"] { color: #ff5d6c !important; }

        /* Monitor: "holograma de mesa" — la curva descansa inclinada en 3D y
           se endereza al hover (para explorar el tooltip en plano). Debajo,
           reflejo EN VIVO del propio canvas animado, como sobre vidrio negro. */
        #sigma-hud-root #equity-wrap {
          border-radius: 16px; padding: 14px;
          /* el fondo-pantalla vive en el marco: el canvas queda transparente
             para que el bloom abrace SOLO la línea dibujada */
          background: linear-gradient(180deg, #081324, #04070f);
          border: 1px solid rgba(57,226,230,0.16);
          box-shadow:
            inset 0 1px 0 rgba(94,234,240,0.16),
            0 34px 80px rgba(0,0,0,0.5),
            0 0 70px rgba(57,226,230,0.08);
          transform: perspective(1200px) rotateX(3.2deg);
          transform-origin: 50% 100%;
          transition: transform .55s cubic-bezier(.2,.6,.2,1), box-shadow .55s ease;
        }
        #sigma-hud-root #equity-wrap:hover {
          transform: perspective(1200px) rotateX(0deg);
          box-shadow:
            inset 0 1px 0 rgba(94,234,240,0.22),
            0 22px 60px rgba(0,0,0,0.5),
            0 0 90px rgba(57,226,230,0.13);
        }
        /* La línea del motor con neón real: núcleo blanco caliente + halo
           medio + resplandor ancho. clearRect del motor = canvas transparente,
           así el drop-shadow sigue la silueta de línea/puntos, no el rectángulo. */
        #sigma-hud-root #equity-curve {
          background: transparent !important;
          border-radius: 10px !important;
          filter:
            saturate(1.28) brightness(1.05)
            drop-shadow(0 0 1.5px rgba(255,255,255,0.55))
            drop-shadow(0 0 9px rgba(94,234,240,0.4))
            drop-shadow(0 0 26px rgba(57,226,230,0.2));
        }
        /* grid técnico + viñeta sobre el canvas (decorativo, no bloquea el tooltip) */
        #sigma-hud-root #equity-wrap::before {
          content: ''; position: absolute; inset: 14px; border-radius: 10px;
          pointer-events: none; z-index: 1;
          background:
            linear-gradient(rgba(57,226,230,0.05) 1px, transparent 1px) 0 0 / 100% 36px,
            linear-gradient(90deg, rgba(57,226,230,0.04) 1px, transparent 1px) 0 0 / 48px 100%,
            radial-gradient(ellipse 120% 90% at 50% 0%, transparent 55%, rgba(0,0,0,0.32));
        }
        /* tooltip del monitor: vidrio con borde cian */
        #sigma-hud-root #equity-tooltip {
          background: rgba(10,14,22,0.92) !important;
          backdrop-filter: blur(8px);
          border: 1px solid rgba(57,226,230,0.35) !important;
          border-radius: 10px !important;
          box-shadow: 0 12px 34px rgba(0,0,0,0.65), 0 0 16px rgba(57,226,230,0.14) !important;
        }

        /* Paginación del historial: segmented control */
        #sigma-hud-root #hist-pagination { padding: 10px 0 2px; }
        #sigma-hud-root #hist-pagination button, #sigma-hud-root #hist-pagination span[onclick] {
          border-radius: 8px !important;
          transition: border-color .2s ease, box-shadow .2s ease, color .2s ease;
        }
        #sigma-hud-root #hist-pagination [style*="#c9a227"], #sigma-hud-root #hist-pagination [style*="#f0d060"] {
          border-color: #39e2e6 !important; color: #39e2e6 !important;
          box-shadow: 0 0 12px rgba(57,226,230,0.28);
        }

        /* ══ 7. Proof of Work — cada tarjeta con identidad propia ══ */
        /* Banner del contador: héroe de la sección */
        #sigma-hud-root .counter-banner {
          position: relative; overflow: hidden;
          background: linear-gradient(135deg, rgba(22,30,44,0.7), rgba(9,13,21,0.6)) !important;
          border: 1px solid rgba(57,226,230,0.2) !important;
          border-radius: 16px !important;
          box-shadow: 0 20px 54px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        #sigma-hud-root .counter-banner::before {
          content: ''; position: absolute; inset: 0 0 auto 0; height: 2px;
          background: linear-gradient(90deg, #39e2e6, rgba(79,146,255,0.5) 50%, transparent 85%);
        }
        #sigma-hud-root .counter-banner::after {
          content: 'Σ'; position: absolute; right: 8px; bottom: -46px;
          font-size: 190px; font-weight: 800; line-height: 1;
          color: rgba(57,226,230,0.055); pointer-events: none;
          font-family: 'Bebas Neue', Impact, sans-serif;
        }
        #sigma-hud-root .counter-number {
          background: linear-gradient(100deg, #5eeaf0, #4f92ff);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent; color: transparent !important;
          filter: drop-shadow(0 0 20px rgba(57,226,230,0.35));
          letter-spacing: 0.02em;
        }
        /* mini-tiles por timeframe */
        #sigma-hud-root .counter-stat {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 8px 14px !important;
          transition: transform .25s ease, border-color .25s ease;
        }
        #sigma-hud-root .counter-stat:hover { transform: translateY(-2px); border-color: rgba(57,226,230,0.3); }
        #sigma-hud-root .counter-stat .val { text-shadow: 0 0 12px currentColor; }
        #sigma-hud-root .counter-stat .lbl { letter-spacing: 0.2em !important; }

        /* Tarjetas PoW (divs planos #07091c) → vidrio con hover */
        #sigma-hud-root div[style*="background:#07091c"] {
          position: relative; overflow: hidden;
          background: linear-gradient(180deg, rgba(20,26,38,0.55), rgba(10,14,22,0.5)) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 14px !important;
          padding: 16px 20px !important;
          box-shadow: 0 12px 34px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.05);
          transition: transform .3s ease, border-color .3s ease, box-shadow .3s ease;
        }
        #sigma-hud-root div[style*="background:#07091c"]:hover {
          transform: translateY(-2px);
          border-color: rgba(57,226,230,0.25) !important;
          box-shadow: 0 18px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07);
        }

        /* Duelo VS: SIGMA (verde) vs BTC DCA (rojo) — cada esquina con su tinte */
        #sigma-hud-root div[style*="background:#0d1428"] {
          border-radius: 10px !important;
          border: 1px solid rgba(255,255,255,0.06);
        }
        #sigma-hud-root div[style*="background:#0d1428"]:has([style*="#2ecc71"]) {
          background: linear-gradient(180deg, rgba(46,204,113,0.08), rgba(255,255,255,0.015)) !important;
          border-color: rgba(46,204,113,0.22) !important;
        }
        #sigma-hud-root div[style*="background:#0d1428"]:has([style*="#e74c3c"]) {
          background: linear-gradient(180deg, rgba(231,76,60,0.08), rgba(255,255,255,0.015)) !important;
          border-color: rgba(231,76,60,0.22) !important;
        }
        /* El ganador (Alpha real) late con aura verde */
        #sigma-hud-root div[style*="rgba(46,204,113,.06)"] {
          animation: hud-alphapulse 3.2s ease-in-out infinite;
          border-radius: 10px !important;
        }
        /* números del duelo más grandes y con glow */
        #sigma-hud-root div[style*="background:#0d1428"] div[style*="font-size:20px"],
        #sigma-hud-root div[style*="rgba(46,204,113,.06)"] div[style*="font-size:20px"] {
          font-size: 24px !important; text-shadow: 0 0 14px currentColor;
        }

        /* BTC Cold Storage: identidad naranja Bitcoin + marca de agua ₿ */
        #sigma-hud-root div[style*="background:#07091c"]:has([style*="#f7931a"]) {
          border-color: rgba(247,147,26,0.25) !important;
        }
        #sigma-hud-root div[style*="background:#07091c"]:has([style*="#f7931a"])::after {
          content: '₿'; position: absolute; right: 6px; bottom: -34px;
          font-size: 130px; font-weight: 800; line-height: 1;
          color: rgba(247,147,26,0.07); pointer-events: none;
        }
        #sigma-hud-root span[style*="color:#f7931a"][style*="font-size:22px"] { text-shadow: 0 0 16px rgba(247,147,26,0.45); }
        /* progreso hacia 1 BTC: barra roja fina → energía naranja */
        #sigma-hud-root div[style*="background:#07091c"]:has([style*="#f7931a"]) div[style*="background:#e74c3c"] {
          background: linear-gradient(90deg, #f7931a, #ffb454) !important;
          box-shadow: 0 0 10px rgba(247,147,26,0.6);
        }
        #sigma-hud-root div[style*="background:#07091c"]:has([style*="#f7931a"]) div[style*="height:6px"] {
          height: 8px !important; border-radius: 6px !important;
        }

        /* Executor Gate: barra de energía animada (rayas que avanzan) */
        #sigma-hud-root div[style*="background:#f1c40f"][style*="height:100%"] {
          background: repeating-linear-gradient(45deg, #ffd75e 0 10px, #e8a51e 10px 20px) !important;
          background-size: 28px 28px !important;
          animation: hud-stripes 1.1s linear infinite;
          box-shadow: 0 0 12px rgba(241,196,15,0.5);
        }
        #sigma-hud-root div[style*="color:#e67e22"] { text-shadow: 0 0 12px rgba(230,126,34,0.5); }

        /* Filas de criterios/stress/AUM: rail de color por estado + hover */
        #sigma-hud-root div[style*="justify-content:space-between"][style*="border-bottom:1px solid #141b38"] {
          padding: 7px 10px !important; margin: 0 -10px;
          border-bottom: 1px solid rgba(255,255,255,0.05) !important;
          border-left: 2px solid transparent; border-radius: 4px;
          transition: background .2s ease;
        }
        #sigma-hud-root div[style*="justify-content:space-between"][style*="border-bottom:1px solid #141b38"]:hover {
          background: rgba(255,255,255,0.03);
        }
        #sigma-hud-root div[style*="border-bottom:1px solid #141b38"]:has(span[style*="#2ecc71"]) { border-left-color: rgba(46,204,113,0.55); }
        #sigma-hud-root div[style*="border-bottom:1px solid #141b38"]:has(span[style*="#e74c3c"]) { border-left-color: rgba(231,76,60,0.55); }

        /* AUM: bóveda dorada (el oro aquí es identidad, no acento del sitio) */
        #sigma-hud-root div[style*="background:#07091c"]:has([style*="#d4af37"]) {
          border-color: rgba(212,175,55,0.28) !important;
        }
        #sigma-hud-root div[style*="background:#07091c"]:has([style*="#d4af37"])::after {
          content: '$'; position: absolute; right: 14px; bottom: -30px;
          font-size: 120px; font-weight: 800; line-height: 1;
          color: rgba(212,175,55,0.07); pointer-events: none;
          font-family: 'IBM Plex Mono', monospace;
        }
        #sigma-hud-root div[style*="color:#d4af37"][style*="font-size:22px"] {
          background: linear-gradient(100deg, #f0cc5a, #c9982e);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 14px rgba(212,175,55,0.35));
          font-size: 26px !important;
        }

        /* ══ 8. Mercado & Modelos — de cajas a lámparas de régimen ══ */
        /* El tile deja de ser una caja con borde: es una superficie que se
           tiñe con la luz de su régimen (rojo bear / verde bull / ámbar range) */
        #sigma-hud-root .regime-grid { gap: 12px !important; }
        #sigma-hud-root .regime-card {
          position: relative;
          background: linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.008)) !important;
          border: 1px solid transparent !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 26px -14px rgba(0,0,0,0.7) !important;
          transition: transform .25s ease, box-shadow .25s ease !important;
          overflow: hidden;
        }
        #sigma-hud-root .regime-card:hover { transform: translateY(-3px) !important; }
        /* beacon superior: línea de luz centrada del color del régimen */
        #sigma-hud-root .regime-card::before {
          content: ''; position: absolute; top: 0; left: 22%; right: 22%; height: 2px;
          border-radius: 2px; background: rgba(255,255,255,0.12);
        }
        /* BEAR: lavado rojo */
        #sigma-hud-root .regime-card:has([style*="#e74c3c"]), #sigma-hud-root .regime-card:has([style*="#f44336"]) {
          background:
            radial-gradient(120% 90% at 50% 0%, rgba(231,76,60,0.14), transparent 62%),
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.006)) !important;
        }
        #sigma-hud-root .regime-card:has([style*="#e74c3c"])::before, #sigma-hud-root .regime-card:has([style*="#f44336"])::before {
          background: #ff5d6c; box-shadow: 0 0 10px rgba(255,93,108,0.8);
        }
        /* BULL: lavado verde */
        #sigma-hud-root .regime-card:has([style*="#00e676"]), #sigma-hud-root .regime-card:has([style*="#2ecc71"]) {
          background:
            radial-gradient(120% 90% at 50% 0%, rgba(46,204,113,0.15), transparent 62%),
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.006)) !important;
        }
        #sigma-hud-root .regime-card:has([style*="#00e676"])::before, #sigma-hud-root .regime-card:has([style*="#2ecc71"])::before {
          background: #2fd39a; box-shadow: 0 0 10px rgba(47,211,154,0.8);
        }
        /* RANGE: lavado ámbar */
        #sigma-hud-root .regime-card:has([style*="#e67e22"]), #sigma-hud-root .regime-card:has([style*="#f1c40f"]) {
          background:
            radial-gradient(120% 90% at 50% 0%, rgba(230,146,34,0.13), transparent 62%),
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.006)) !important;
        }
        #sigma-hud-root .regime-card:has([style*="#e67e22"])::before, #sigma-hud-root .regime-card:has([style*="#f1c40f"])::before {
          background: #ffb454; box-shadow: 0 0 10px rgba(255,180,84,0.8);
        }
        /* el pill interno pierde su caja: texto del régimen con glow puro */
        #sigma-hud-root .regime-card span[style*="border"], #sigma-hud-root .regime-card div[style*="border"] {
          border-color: transparent !important;
          background: transparent !important;
          letter-spacing: 0.16em; text-shadow: 0 0 14px currentColor;
        }

        /* Pipeline feed: stream de terminal (el motor ya trae rec/neg/pos/skip) */
        #sigma-hud-root .feed-item {
          border-radius: 8px;
          border-left-color: rgba(57,226,230,0.14);
        }
        #sigma-hud-root .feed-item:hover { background: rgba(57,226,230,0.05); transform: translateX(3px); }
        #sigma-hud-root .feed-ts { color: #5f6a7d !important; }
        #sigma-hud-root .feed-cagr { text-shadow: 0 0 10px currentColor; }

        /* Pills genéricos: dorado → cian (los que traen color propio por
           activo, como LTC azul / SOL violeta, CONSERVAN su identidad) */
        #sigma-hud-root .pill { background: rgba(57,226,230,0.06) !important; border-radius: 8px !important; }
        #sigma-hud-root .pill:not([style*="border-color"]) { border-color: rgba(57,226,230,0.22) !important; }
        #sigma-hud-root .pill:hover { background: rgba(57,226,230,0.12) !important; }
        #sigma-hud-root .pill:not([style*="border-color"]):hover { border-color: rgba(57,226,230,0.45) !important; }
        #sigma-hud-root .pill[style*="border-color"] {
          background: rgba(255,255,255,0.03) !important;
          box-shadow: 0 0 14px -5px currentColor;
        }

        /* Actividad del Pipeline: consola con pozo de terminal */
        #sigma-hud-root .feed {
          position: relative; overflow: hidden;
          background: linear-gradient(180deg, rgba(18,24,36,0.6), rgba(9,13,20,0.55)) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 16px !important;
          padding: 18px 20px !important;
          box-shadow: 0 2px 10px rgba(0,0,0,0.4), 0 20px 52px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05) !important;
          backdrop-filter: blur(8px);
        }
        #sigma-hud-root .feed::before {
          content: ''; position: absolute; inset: 0 0 auto 0; height: 2px;
          background: linear-gradient(90deg, rgba(57,226,230,0.85), rgba(79,146,255,0.4) 45%, transparent 82%);
        }
        #sigma-hud-root .feed-title {
          color: #39e2e6 !important; letter-spacing: 0.24em !important;
          text-shadow: 0 0 14px rgba(57,226,230,0.35);
        }
        /* el stream vive en un pozo hundido, como pantalla dentro de la consola */
        #sigma-hud-root .feed-list {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 10px; padding: 8px;
          max-height: 300px !important;
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
        }

        /* Regla de Portfolio: barra de mando */
        #sigma-hud-root .rule {
          position: relative; overflow: hidden;
          background: linear-gradient(90deg, rgba(57,226,230,0.06), rgba(255,255,255,0.02) 45%) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 14px !important;
          padding: 16px 20px !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 34px rgba(0,0,0,0.32) !important;
        }
        #sigma-hud-root .rule::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          background: linear-gradient(180deg, #39e2e6, #4f92ff);
          box-shadow: 0 0 12px rgba(57,226,230,0.6);
        }
        #sigma-hud-root .rule-title { color: #eef1f7 !important; }
        #sigma-hud-root .rule-sub { color: #8b97ad !important; }
        #sigma-hud-root .rule .prog {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 8px 14px;
        }
        #sigma-hud-root .rule .prog strong {
          color: #39e2e6 !important; font-size: 14px;
          text-shadow: 0 0 12px rgba(57,226,230,0.45);
        }

        /* Profundidad física de las lámparas de régimen: relieve interior +
           sombra de asiento + resplandor de piso del color del régimen */
        #sigma-hud-root .regime-card {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.07),
            inset 0 -10px 18px -14px rgba(0,0,0,0.85),
            0 2px 5px rgba(0,0,0,0.5),
            0 16px 30px -14px rgba(0,0,0,0.75) !important;
        }
        #sigma-hud-root .regime-card:has([style*="#e74c3c"]), #sigma-hud-root .regime-card:has([style*="#f44336"]) {
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -10px 18px -14px rgba(0,0,0,0.85),
            0 2px 5px rgba(0,0,0,0.5), 0 18px 34px -16px rgba(255,93,108,0.3) !important;
        }
        #sigma-hud-root .regime-card:has([style*="#00e676"]), #sigma-hud-root .regime-card:has([style*="#2ecc71"]) {
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -10px 18px -14px rgba(0,0,0,0.85),
            0 2px 5px rgba(0,0,0,0.5), 0 18px 34px -16px rgba(47,211,154,0.32) !important;
        }
        #sigma-hud-root .regime-card:has([style*="#e67e22"]), #sigma-hud-root .regime-card:has([style*="#f1c40f"]) {
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -10px 18px -14px rgba(0,0,0,0.85),
            0 2px 5px rgba(0,0,0,0.5), 0 18px 34px -16px rgba(255,180,84,0.28) !important;
        }
        #sigma-hud-root .regime-card:hover {
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -10px 18px -14px rgba(0,0,0,0.85),
            0 6px 14px rgba(0,0,0,0.55), 0 26px 48px -16px rgba(0,0,0,0.8) !important;
        }

        /* Matrices de modelos: celdas con relieve (encajan con las lámparas) */
        #sigma-hud-root .matrix td { border-radius: 8px !important; }
        #sigma-hud-root .cell-ok {
          border-radius: 8px !important;
          box-shadow: inset 0 1px 0 rgba(0,230,118,0.14), inset 0 -6px 12px -9px rgba(0,0,0,0.65), 0 4px 10px -6px rgba(0,0,0,0.6) !important;
        }
        #sigma-hud-root .asset-box { border-radius: 10px !important; }

        /* ══ 9. Matrices M1–M4 — rack de servidores 3D ══ */
        /* cabecera de timeframes: rail iluminado */
        #sigma-hud-root .matrix th {
          color: #8b97ad !important; letter-spacing: 0.2em !important;
          border-bottom: 1px solid rgba(57,226,230,0.16) !important;
        }
        /* módulo LISTO: enchufado al rack, con relieve físico */
        #sigma-hud-root .matrix td.cell-ok, #sigma-hud-root .cell-ok {
          border-radius: 10px !important;
          background: linear-gradient(180deg, rgba(18,52,36,0.85), rgba(8,26,18,0.9)) !important;
          border: 1px solid rgba(46,204,113,0.22) !important;
          box-shadow:
            inset 0 1px 0 rgba(120,255,190,0.16),
            inset 0 -8px 14px -10px rgba(0,0,0,0.7),
            0 4px 10px -6px rgba(0,0,0,0.65),
            0 10px 22px -14px rgba(46,204,113,0.35) !important;
          transition: transform .22s ease, box-shadow .22s ease !important;
        }
        /* el módulo SALTA en 3D hacia ti al hover */
        #sigma-hud-root .matrix td.cell-ok:hover {
          position: relative; z-index: 6;
          transform: perspective(700px) translateZ(18px) !important;
          box-shadow:
            inset 0 1px 0 rgba(120,255,190,0.22),
            0 22px 44px -12px rgba(0,0,0,0.85),
            0 0 26px rgba(46,204,113,0.3) !important;
        }
        /* módulo OPTIMIZANDO: late con energía cian */
        #sigma-hud-root .matrix td.cell-run, #sigma-hud-root .cell-run {
          border-radius: 10px !important;
          animation: hud-optpulse 2.4s ease-in-out infinite;
        }
        #sigma-hud-root .matrix td.cell-run:hover {
          position: relative; z-index: 6;
          transform: perspective(700px) translateZ(14px) !important;
          animation: none;
          box-shadow: inset 0 0 0 1px rgba(57,226,230,0.55), 0 18px 38px -12px rgba(0,0,0,0.8), 0 0 24px rgba(57,226,230,0.3) !important;
        }
        /* slot PENDIENTE ("En cola"): bahía vacía hundida en el rack */
        #sigma-hud-root .matrix td[style*="#242f55"], #sigma-hud-root .matrix td div[style*="#242f55"] {
          background: rgba(0,0,0,0.3) !important;
          border: 1px dashed rgba(255,255,255,0.08) !important;
          border-radius: 10px !important;
          box-shadow: inset 0 3px 12px rgba(0,0,0,0.6) !important;
        }
        /* etiqueta de activo: placa del rack con su color */
        #sigma-hud-root .asset-box {
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 6px 14px -8px rgba(0,0,0,0.8) !important;
        }
        /* identidad por motor: rail superior y borde de su color */
        #sigma-hud-root #matrix-section-m3.card { border-color: rgba(63,185,80,0.3) !important; }
        #sigma-hud-root #matrix-section-m3.card::before { background: linear-gradient(90deg, #3fb950, rgba(63,185,80,0.3) 50%, transparent 85%); }
        #sigma-hud-root #matrix-section-m4.card { border-color: rgba(91,141,239,0.35) !important; }
        #sigma-hud-root #matrix-section-m4.card::before { background: linear-gradient(90deg, #5b8def, rgba(91,141,239,0.35) 50%, transparent 85%); }

        /* ══ 4. Marco de terminal: brackets en las esquinas de cada card ══ */
        #sigma-hud-root .card::after {
          content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.4;
          transition: opacity .3s ease;
          background:
            linear-gradient(#39e2e6,#39e2e6) left 8px top 8px / 12px 1px,
            linear-gradient(#39e2e6,#39e2e6) left 8px top 8px / 1px 12px,
            linear-gradient(#39e2e6,#39e2e6) right 8px top 8px / 12px 1px,
            linear-gradient(#39e2e6,#39e2e6) right 8px top 8px / 1px 12px,
            linear-gradient(#39e2e6,#39e2e6) left 8px bottom 8px / 12px 1px,
            linear-gradient(#39e2e6,#39e2e6) left 8px bottom 8px / 1px 12px,
            linear-gradient(#39e2e6,#39e2e6) right 8px bottom 8px / 12px 1px,
            linear-gradient(#39e2e6,#39e2e6) right 8px bottom 8px / 1px 12px;
          background-repeat: no-repeat;
        }
        #sigma-hud-root .card:hover::after { opacity: 0.9; }

        /* ══ 5. Gráficos del motor (canvas/SVG en runtime) → neón ══ */
        #sigma-hud-root canvas { filter: drop-shadow(0 0 12px rgba(57,226,230,0.28)); }
        #sigma-hud-root svg    { filter: drop-shadow(0 0 9px rgba(57,226,230,0.22)); }

        /* ══ 5b. Performance Snapshot — tratamiento profesional ══ */
        /* Marco del heatmap: panel propio con aire */
        #sigma-hud-root .heatmap-wrap {
          display: inline-block; padding: 10px 12px; border-radius: 12px;
          background: rgba(255,255,255,0.022);
          border: 1px solid rgba(255,255,255,0.055);
        }
        /* Celdas: más grandes, radio suave, filo interior */
        #sigma-hud-root .heatmap-wrap div {
          width: 22px !important; height: 22px !important;
          border-radius: 6px !important; margin: 3px !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.14);
        }
        #sigma-hud-root .heatmap-wrap div:hover {
          position: relative; z-index: 3;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 16px rgba(0,0,0,0.5), 0 0 12px currentColor;
        }
        /* Recolor de la escala: fintech refinado (gana a los inline styles) */
        #sigma-hud-root .heatmap-wrap div[style*="#141b38"] {
          background: rgba(255,255,255,0.045) !important;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
        }
        #sigma-hud-root .heatmap-wrap div[style*="#43a047"] {
          background: linear-gradient(135deg, #19cf8c, #0ea06a) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 0 9px rgba(25,207,140,0.35);
        }
        #sigma-hud-root .heatmap-wrap div[style*="#ff9800"] {
          background: linear-gradient(135deg, #ffbe55, #e8952e) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 0 8px rgba(255,180,84,0.3);
        }
        #sigma-hud-root .heatmap-wrap div[style*="#ef5350"] {
          background: linear-gradient(135deg, #ff6478, #e04358) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 0 8px rgba(255,93,108,0.3);
        }
        #sigma-hud-root .heatmap-wrap div[style*="#c62828"] {
          background: linear-gradient(135deg, #d63a55, #a81f3d) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 0 10px rgba(214,58,85,0.4);
        }
        /* Barrita de acento del título de la card: dorada → gradiente cian */
        #sigma-hud-root span[style*="#c9a227"] {
          background: linear-gradient(180deg, #5eeaf0, #4f92ff) !important;
          box-shadow: 0 0 10px rgba(57,226,230,0.55);
        }
        /* Donut de exposición: aro gris → cian con brillo; swatch de leyenda igual */
        #sigma-hud-root circle[stroke="#888"] { stroke: #39e2e6 !important; }
        #sigma-hud-root span[style*="background:#888"], #sigma-hud-root span[style*="background: #888"] {
          background: #39e2e6 !important; box-shadow: 0 0 8px rgba(57,226,230,0.5);
        }
        /* Fila de stats (SHARPE 30D / STREAK / MEJOR DÍA…) → chips */
        #sigma-hud-root div[style*="border-top"][style*="flex-wrap"] > span {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px; padding: 6px 12px;
          transition: border-color .25s ease, background .25s ease;
        }
        #sigma-hud-root div[style*="border-top"][style*="flex-wrap"] > span:hover {
          border-color: rgba(57,226,230,0.3);
          background: rgba(57,226,230,0.05);
        }
        /* Semánticos del motor → paleta Cyan Deck + glow suave */
        #sigma-hud-root b[style*="#00e676"] { color: #2fd39a !important; text-shadow: 0 0 9px rgba(47,211,154,0.45); }
        #sigma-hud-root b[style*="#f85149"] { color: #ff5d6c !important; text-shadow: 0 0 9px rgba(255,93,108,0.4); }
        /* Micro-etiquetas (P&L DIARIO / EXPOSICIÓN ABIERTA / labels) más legibles */
        #sigma-hud-root div[style*="#4e5f90"], #sigma-hud-root span[style*="color:#4e5f90"] { color: #8b97ad !important; }

        /* Tarjetas con perspectiva (el tilt 3D lo maneja JS del lado web) */
        #sigma-hud-root .card { transform-style: preserve-3d; will-change: transform; }

        @media (prefers-reduced-motion: reduce) {
          #hud-stage * { animation: none !important; }
          #sigma-hud-root .card, #sigma-hud-root .kpi-card,
          #sigma-hud-root .risk-cell, #sigma-hud-root .asset-box { transition: none !important; }
          #sigma-hud-root #equity-wrap { transform: none !important; transition: none !important; }
          #sigma-hud-root div[style*="rgba(46,204,113,.06)"],
          #sigma-hud-root div[style*="background:#f1c40f"],
          #sigma-hud-root .matrix td.cell-run, #sigma-hud-root .cell-run { animation: none !important; }
        }

        /* scrollbars finas */
        #sigma-hud-root ::-webkit-scrollbar { width: 8px; height: 8px; }
        #sigma-hud-root ::-webkit-scrollbar-track { background: transparent; }
        #sigma-hud-root ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
        #sigma-hud-root ::-webkit-scrollbar-thumb:hover { background: rgba(57,226,230,0.45); }
      `}</style>

      {status === 'loading' && (
        <div style={{
          position: 'fixed', inset: 0, background: '#020510',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 20, zIndex: 9999,
        }}>
          <div style={{
            fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 64, color: '#39e2e6',
            lineHeight: 1, animation: 'hud-pulse 1.6s ease-in-out infinite',
            textShadow: '0 0 34px rgba(57,226,230,0.5)',
          }}>
            Σ
          </div>
          <div style={{ width: 180, height: 2, background: 'rgba(57,226,230,0.15)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 0, bottom: 0, width: '40%',
              background: 'linear-gradient(90deg, transparent, #39e2e6, transparent)',
              animation: 'hud-scan 1.4s ease-in-out infinite',
            }} />
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '0.3em', color: 'rgba(94,234,240,0.75)' }}>
            CONECTANDO AL MOTOR…
          </div>
        </div>
      )}
      {status === 'error' && (
        <div style={{
          position: 'fixed', inset: 0, background: '#020510',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'IBM Plex Mono',monospace", color: '#e74c3c', zIndex: 9999
        }}>
          Sin conexión al motor. Intenta recargar la página.
        </div>
      )}
      {/* Wrapper relativo: contiene el escenario ambiental DENTRO del área del
          HUD (no fixed al viewport — eso tapaba la barra lateral del sitio). */}
      <div style={{ position: 'relative', background: '#04050a' }}>
        {/* Escenario ambiental — grilla técnica, auroras a la deriva y línea
            de escaneo. Todo del lado web, cero motor. */}
        <div id="hud-stage" aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(57,226,230,0.065) 1px, transparent 1px), linear-gradient(90deg, rgba(57,226,230,0.065) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.25) 75%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.25) 75%, transparent 100%)',
          }} />
          <div style={{ position: 'absolute', width: 720, height: 720, top: -280, right: -160, background: 'radial-gradient(circle, rgba(79,146,255,0.22), transparent 62%)', filter: 'blur(70px)', animation: 'hud-drift1 26s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 620, height: 620, top: '30%', left: -200, background: 'radial-gradient(circle, rgba(57,226,230,0.16), transparent 62%)', filter: 'blur(70px)', animation: 'hud-drift2 32s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 560, height: 560, bottom: -240, right: '20%', background: 'radial-gradient(circle, rgba(154,123,255,0.13), transparent 62%)', filter: 'blur(70px)', animation: 'hud-drift1 38s ease-in-out infinite' }} />
          {/* Línea de escaneo — barrido vertical lento */}
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 2, top: '-6%',
            background: 'linear-gradient(90deg, transparent, rgba(57,226,230,0.2), transparent)',
            boxShadow: '0 0 22px rgba(57,226,230,0.18)',
            animation: 'hud-scanY 11s linear infinite',
          }} />
        </div>

        <div
          id="sigma-hud-root"
          ref={containerRef}
          style={{
            minHeight: '100vh', background: 'transparent',
            position: 'relative', zIndex: 1,
            // Fade-in único al terminar de cargar — después nada se mueve
            opacity: status === 'ok' ? 1 : 0,
            transition: 'opacity 0.7s ease',
          }}
        />
      </div>
    </>
  )
}
