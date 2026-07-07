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

        /* Monitor: marco cinematográfico de la curva de equity */
        #sigma-hud-root #equity-wrap {
          border-radius: 14px; padding: 10px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 14px 40px rgba(0,0,0,0.35);
        }
        #sigma-hud-root #equity-curve {
          background: linear-gradient(180deg, #081324, #04070f) !important;
          border-radius: 10px !important;
          filter: saturate(1.18) drop-shadow(0 0 14px rgba(57,226,230,0.22));
        }
        /* grid técnico + viñeta sobre el canvas (decorativo, no bloquea el tooltip) */
        #sigma-hud-root #equity-wrap::before {
          content: ''; position: absolute; inset: 10px; border-radius: 10px;
          pointer-events: none; z-index: 1;
          background:
            linear-gradient(rgba(57,226,230,0.05) 1px, transparent 1px) 0 0 / 100% 36px,
            linear-gradient(90deg, rgba(57,226,230,0.04) 1px, transparent 1px) 0 0 / 48px 100%,
            radial-gradient(ellipse 120% 90% at 50% 0%, transparent 55%, rgba(0,0,0,0.32));
        }
        /* ticks de esquina del monitor */
        #sigma-hud-root #equity-wrap::after {
          content: ''; position: absolute; inset: 10px; border-radius: 10px;
          pointer-events: none; z-index: 1; opacity: 0.55;
          background:
            linear-gradient(#39e2e6,#39e2e6) left 6px top 6px / 14px 1px,
            linear-gradient(#39e2e6,#39e2e6) left 6px top 6px / 1px 14px,
            linear-gradient(#39e2e6,#39e2e6) right 6px top 6px / 14px 1px,
            linear-gradient(#39e2e6,#39e2e6) right 6px top 6px / 1px 14px,
            linear-gradient(#39e2e6,#39e2e6) left 6px bottom 6px / 14px 1px,
            linear-gradient(#39e2e6,#39e2e6) left 6px bottom 6px / 1px 14px,
            linear-gradient(#39e2e6,#39e2e6) right 6px bottom 6px / 14px 1px,
            linear-gradient(#39e2e6,#39e2e6) right 6px bottom 6px / 1px 14px;
          background-repeat: no-repeat;
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
