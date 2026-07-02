'use client'
import { useEffect, useRef, useState } from 'react'

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
      const cells = Array.from(row.querySelectorAll('td'))
        .map(td => td.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      const symIdx = cells.findIndex(c => SYM.test(c))
      const tfIdx  = cells.findIndex(c => TF.test(c.toUpperCase()))
      if (symIdx < 0 || tfIdx < 0) continue

      const key    = `${cells[symIdx].toUpperCase()}::${cells[tfIdx].toUpperCase()}::${cells[tfIdx + 1] ?? ''}`
      const size   = parseFloat((cells.find(c => /\$[\d,]+/.test(c)) ?? '').replace(/[^0-9.]/g, '')) || 0
      // REAL puede aparecer como texto o como clase CSS (el motor usa text-transform:uppercase)
      const rowText = row.textContent ?? ''
      const rowHtml = row.innerHTML
      const isReal  = /\breal\b/i.test(rowText) || /\blive\b/i.test(rowText) ||
                      /class="[^"]*\blive\b/i.test(rowHtml) || /mode['":\s]+live/i.test(rowHtml)

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
        if (!cancelled) setStatus('error')
      }
    }

    injectMotor()
    return () => {
      cancelled = true
      observer?.disconnect()
      if (dedupTimer) clearTimeout(dedupTimer)
    }
  }, [])

  // Crosshair en las matrices de señales: al pasar el mouse por una celda se
  // ilumina toda su columna (la fila la maneja CSS). Solo presentación del
  // lado web — el HTML del motor no se modifica, solo se togglea una clase.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let lastCells: Element[] = []
    const clear = () => { lastCells.forEach(c => c.classList.remove('sigma-col-hl')); lastCells = [] }
    function onOver(e: MouseEvent) {
      const cell  = (e.target as HTMLElement).closest('td, th') as HTMLTableCellElement | null
      const table = cell?.closest('table.matrix') as HTMLTableElement | null
      if (!cell || !table) { clear(); return }
      const idx = cell.cellIndex
      clear()
      table.querySelectorAll('tr').forEach(tr => {
        const c = (tr as HTMLTableRowElement).cells[idx]
        if (c) { c.classList.add('sigma-col-hl'); lastCells.push(c) }
      })
    }
    container.addEventListener('mouseover', onOver)
    container.addEventListener('mouseleave', clear)
    return () => {
      container.removeEventListener('mouseover', onOver)
      container.removeEventListener('mouseleave', clear)
      clear()
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

  return (
    <>
      {/* ── Skin visual SQuant sobre el HUD ─────────────────────────────────
          Overrides CSS del lado web. Este <style> vive en el <body>, así que
          gana la cascada frente a los estilos del motor (inyectados en <head>)
          a igual especificidad. El motor no se modifica. */}
      <style>{`
        /* ══ 1. KPI strip estilo Bloomberg — vidrio + sticky ══ */
        #sigma-hud-root #kpi-strip {
          position: sticky !important; top: 0 !important; z-index: 80 !important;
          background: rgba(2,5,16,0.82) !important;
          backdrop-filter: blur(12px) saturate(1.1);
          -webkit-backdrop-filter: blur(12px) saturate(1.1);
          border-bottom: 1px solid rgba(212,175,55,0.18) !important;
          box-shadow: 0 10px 28px rgba(0,0,0,0.5);
          padding-top: 6px !important; padding-bottom: 6px !important;
        }
        #sigma-hud-root .kpi-card {
          position: relative;
          background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.006)) !important;
          border: 1px solid rgba(212,175,55,0.12) !important;
          border-radius: 8px !important;
          margin: 5px 4px !important;
          overflow: hidden;
          transition: transform .15s ease, border-color .15s ease !important;
        }
        #sigma-hud-root .kpi-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, rgba(212,175,55,0.85), transparent 75%);
        }
        #sigma-hud-root .kpi-card:hover { transform: translateY(-2px); border-color: rgba(212,175,55,0.4) !important; }
        #sigma-hud-root .kpi-label { letter-spacing: 0.2em !important; opacity: 0.75; }
        #sigma-hud-root .kpi-value { text-shadow: 0 0 16px currentColor; }

        /* ══ 2. Crosshair en matrices M1/M2/M3 ══ */
        #sigma-hud-root .matrix td.sigma-col-hl,
        #sigma-hud-root .matrix th.sigma-col-hl {
          box-shadow: inset 0 0 0 999px rgba(212,175,55,0.07) !important;
        }
        #sigma-hud-root .matrix tr:hover td {
          box-shadow: inset 0 0 0 999px rgba(212,175,55,0.05);
        }

        /* ══ 3. Micro-detalles ══ */
        /* hover en filas de tablas normales (las matrices tienen el suyo) */
        #sigma-hud-root table:not(.matrix) tbody tr:hover td {
          background: rgba(212,175,55,0.04);
        }
        /* badges y pills con esquinas suaves */
        #sigma-hud-root .badge, #sigma-hud-root .pill, #sigma-hud-root .tf-pill {
          border-radius: 4px !important;
        }
        /* celdas listas con glow verde sutil */
        #sigma-hud-root .cell-ok { text-shadow: 0 0 12px rgba(46,204,113,0.45); }
        /* separadores de sección con la firma dorada del sitio */
        #sigma-hud-root .section-divider-line {
          background: linear-gradient(90deg, transparent, rgba(212,175,55,0.35), transparent) !important;
        }
        #sigma-hud-root .section-divider-text { color: #d4af37 !important; }
        /* cards con radio consistente */
        #sigma-hud-root .card { border-radius: 10px !important; }
        /* scrollbars finas */
        #sigma-hud-root ::-webkit-scrollbar { width: 8px; height: 8px; }
        #sigma-hud-root ::-webkit-scrollbar-track { background: transparent; }
        #sigma-hud-root ::-webkit-scrollbar-thumb { background: #242f55; border-radius: 4px; }
        #sigma-hud-root ::-webkit-scrollbar-thumb:hover { background: rgba(212,175,55,0.5); }
      `}</style>

      {status === 'loading' && (
        <div style={{
          position: 'fixed', inset: 0, background: '#020510',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'IBM Plex Mono',monospace", color: '#c9a227', zIndex: 9999
        }}>
          Cargando SIGMA ENGINE…
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
      <div
        id="sigma-hud-root"
        ref={containerRef}
        style={{ minHeight: '100vh', background: '#020510' }}
      />
    </>
  )
}
