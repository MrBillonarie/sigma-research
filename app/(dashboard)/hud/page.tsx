'use client'
import { useEffect, useRef, useState } from 'react'
import KpiStrip from '@/app/components/hud/KpiStrip'
import PositionsTable from '@/app/components/hud/PositionsTable'
import MotorMatrix from '@/app/components/hud/MotorMatrix'
import { dedupePositions, computeNotional } from '@/app/lib/dedupePositions'
import { MOTOR_GROUPS } from '@/app/lib/motorGroups'
import type { TradesResponse, SignalsResponse, MatrixCellData } from '@/app/types/hud'

// Estas dos se reemplazan por completo (KpiStrip/PositionsTable nativos
// cubren el 100% de lo que mostraban) — se ocultan enteras.
const HIDE_LEGACY_IDS = ['kpi-strip', 'open-positions-section']

// Las matrices comparten la MISMA tabla con la fila "Ponderado" y la línea
// "Portafolio operable" (CAGR/WR/DD/PF/Calmar/EV agregados, con peso por
// trades + filtro de robustness) — no son un contenedor aparte. MotorMatrix
// nativo solo reemplaza la grilla por slot; esas dos filas siguen viniendo
// del scrape porque esa agregación no se reimplementa (mismo criterio de
// riesgo de toda esta migración: no tocar lógica de selección de campeón/
// portfolio). Por eso acá se ocultan sólo las <tr> con un asset-col.
const MATRIX_SECTION_IDS = ['matrix-section', 'matrix-section-m2', 'matrix-section-m3']

export default function HUDPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [trades, setTrades] = useState<TradesResponse | null>(null)
  const [signals, setSignals] = useState<SignalsResponse | null>(null)
  const [matrixCells, setMatrixCells] = useState<MatrixCellData[]>([])

  // ── Datos nativos: KPI strip + tabla de posiciones + matrices Motor 1/2/3 ──
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [tRes, sRes, mRes] = await Promise.all([
          fetch('/api/vps/trades', { cache: 'no-store' }),
          fetch('/api/vps/signals', { cache: 'no-store' }),
          fetch('/api/vps/matrix-data', { cache: 'no-store' }),
        ])
        if (cancelled) return
        if (tRes.ok) setTrades(await tRes.json())
        if (sRes.ok) setSignals(await sRes.json())
        if (mRes.ok) setMatrixCells(await mRes.json())
      } catch (e) {
        console.error('HUD data fetch error:', e)
      }
    }

    load()
    const interval = setInterval(load, 20_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  useEffect(() => {
    let cancelled = false
    let observer: MutationObserver | null = null

    async function injectMotor() {
      try {
        const res = await fetch('/api/vps/motor-proxy', { cache: 'no-store' })
        if (!res.ok) throw new Error(`${res.status}`)
        const html = await res.text()
        if (cancelled || !containerRef.current) return

        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        doc.querySelectorAll('style').forEach(s => {
          const el = document.createElement('style')
          el.textContent = s.textContent
          document.head.appendChild(el)
        })

        doc.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
          const el = document.createElement('link')
          el.rel = 'stylesheet'
          el.href = (l as HTMLLinkElement).href
          document.head.appendChild(el)
        })

        if (containerRef.current) {
          containerRef.current.innerHTML = doc.body.innerHTML
          hideLegacySections(containerRef.current)
        }

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

        if (containerRef.current && !cancelled) hideLegacySections(containerRef.current)

        // MutationObserver: el motor reescribe estas secciones via polling/JS
        // — hay que re-ocultarlas cada vez o reaparecen duplicando lo nativo.
        if (containerRef.current && !cancelled) {
          observer = new MutationObserver(() => {
            if (containerRef.current) hideLegacySections(containerRef.current)
          })
          observer.observe(containerRef.current, { childList: true, subtree: true })
        }

        if (!cancelled) setStatus('ok')
      } catch (e) {
        console.error('Motor proxy error:', e)
        if (!cancelled) setStatus('error')
      }
    }

    function hideLegacySections(container: HTMLElement) {
      for (const id of HIDE_LEGACY_IDS) {
        const el = container.querySelector(`#${id}`) as HTMLElement | null
        if (el && el.style.display !== 'none') el.style.display = 'none'
      }
      for (const id of MATRIX_SECTION_IDS) {
        const section = container.querySelector(`#${id}`) as HTMLElement | null
        if (!section) continue
        section.querySelectorAll('tr').forEach(tr => {
          const row = tr as HTMLElement
          if (row.querySelector('.asset-col') && row.style.display !== 'none') {
            row.style.display = 'none'
          }
        })
      }
    }

    injectMotor()
    return () => {
      cancelled = true
      observer?.disconnect()
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

  const positions = trades ? dedupePositions(trades.open) : []
  const equity = trades?.portfolio?.equity || 10000
  const initial = trades?.portfolio?.initial || 10000
  const floatEquity = trades?.portfolio?.float_equity ?? equity
  const floatingPct = equity > 0 ? (floatEquity - equity) / equity * 100 : 0
  const realizedPct = trades?.portfolio?.return_pct ?? 0
  const stats = trades?.stats
  const signalModels = signals?.signals ?? []
  const activeSignals = signalModels.filter(m => m.signal).length
  const totalModels = signalModels.length
  const leverage = equity > 0
    ? positions.reduce((sum, p) => sum + computeNotional(p, equity), 0) / equity
    : 0

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

        #sigma-hud-root .card {
          position: relative;
          background: #0b0d14 !important;
          border: 1px solid #1a1d2e !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 22px rgba(0,0,0,0.35);
          overflow: hidden;
        }
        #sigma-hud-root .card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, rgba(212,175,55,0.75), transparent 70%);
        }
        #sigma-hud-root .card-title {
          color: #d4af37 !important;
          letter-spacing: 0.18em !important;
          text-transform: uppercase;
        }
        #sigma-hud-root .kpi-strip { background: transparent !important; }
        #sigma-hud-root .kpi-card {
          background: #0b0d14 !important;
          border: 1px solid #1a1d2e !important;
          border-radius: 8px !important;
          margin: 3px !important;
        }
        #sigma-hud-root .kpi-label { color: #7a7f9a !important; letter-spacing: 0.18em !important; }
        #sigma-hud-root .asset-box { background: #0b0d14 !important; border-color: #1a1d2e !important; border-radius: 6px !important; }
        #sigma-hud-root .risk-cell { background: #0b0d14 !important; border-color: #1a1d2e !important; border-radius: 6px !important; }
        #sigma-hud-root [style*="background:#141b38"], #sigma-hud-root [style*="background: #141b38"],
        #sigma-hud-root [style*="background:#1a2240"], #sigma-hud-root [style*="background: #1a2240"] {
          background-color: #0b0d14 !important;
        }
        #sigma-hud-root .badge, #sigma-hud-root .pill, #sigma-hud-root .tf-pill { border-radius: 4px !important; }
        #sigma-hud-root .matrix td { border-radius: 6px !important; }

        #sigma-hud-root .section-divider { margin: 36px 0 18px !important; }
        #sigma-hud-root .section-divider-text {
          font-family: 'Bebas Neue', Impact, sans-serif !important;
          font-size: 22px !important;
          letter-spacing: 0.14em !important;
          color: #d4af37 !important;
          text-shadow: 0 0 24px rgba(212,175,55,0.3);
        }
        #sigma-hud-root .section-divider-line {
          height: 1px !important;
          background: linear-gradient(90deg, transparent, rgba(212,175,55,0.45)) !important;
        }
        #sigma-hud-root .section-divider-line:last-of-type {
          background: linear-gradient(270deg, transparent, rgba(212,175,55,0.45)) !important;
        }

        #sigma-hud-root .kpi-value { text-shadow: 0 0 14px currentColor; }
        #sigma-hud-root .cell-ok   { text-shadow: 0 0 10px rgba(46,204,113,0.4); }

        #sigma-hud-root ::-webkit-scrollbar { width: 8px; height: 8px; }
        #sigma-hud-root ::-webkit-scrollbar-track { background: transparent; }
        #sigma-hud-root ::-webkit-scrollbar-thumb { background: #1a1d2e; border-radius: 4px; }
        #sigma-hud-root ::-webkit-scrollbar-thumb:hover { background: rgba(212,175,55,0.45); }
      `}</style>

      {status === 'loading' && (
        <div style={{
          position: 'fixed', inset: 0, background: '#020510',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 20, zIndex: 9999,
        }}>
          <div style={{
            fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 64, color: '#c9a227',
            lineHeight: 1, animation: 'hud-pulse 1.6s ease-in-out infinite',
            textShadow: '0 0 34px rgba(201,162,39,0.45)',
          }}>
            Σ
          </div>
          <div style={{ width: 180, height: 2, background: 'rgba(201,162,39,0.15)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 0, bottom: 0, width: '40%',
              background: 'linear-gradient(90deg, transparent, #c9a227, transparent)',
              animation: 'hud-scan 1.4s ease-in-out infinite',
            }} />
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '0.3em', color: 'rgba(201,162,39,0.7)' }}>
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
      <div
        id="sigma-hud-root"
        style={{
          minHeight: '100vh', background: '#04050a', padding: status === 'ok' ? '20px 20px 0' : 0,
          opacity: status === 'ok' ? 1 : 0,
          transition: 'opacity 0.7s ease',
        }}
      >
        {status === 'ok' && trades && (
          <KpiStrip
            equity={equity}
            equitySub={`desde $${Math.round(initial).toLocaleString()}`}
            realizedPct={realizedPct}
            realizedSub={`${stats?.total ?? 0} trades`}
            floatingPct={floatingPct}
            floatingSub={`${positions.length} abiertos`}
            winRate={stats?.win_rate ?? 0}
            winRateSub={`${stats?.wins ?? 0}W / ${stats?.losses ?? 0}L`}
            activeSignals={activeSignals}
            totalModels={totalModels}
            regime={signals?.regime ?? '?'}
            leverage={leverage}
            leverageSub="exposición actual"
          />
        )}
        {status === 'ok' && trades && (
          <div style={{ marginBottom: 20 }}>
            <PositionsTable positions={positions} equity={equity} />
          </div>
        )}
        {status === 'ok' && matrixCells.length > 0 && MOTOR_GROUPS.map(group => (
          <MotorMatrix key={group.id} label={group.label} assets={group.assets} cells={matrixCells} />
        ))}
        <div ref={containerRef} />
      </div>
    </>
  )
}
