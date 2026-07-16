'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/app/lib/supabase'

// Gate de UX del Pine: el servidor ya bloquea la descarga a no-PRO
// (/api/vps/motor-download exige PRO/admin). Esto es solo la experiencia — el
// free ve un botón "Activar PRO" que lleva a /planes en vez de chocar con un
// 403. Solo actúa cuando sabemos que el plan es free (isPro === false).
function gatePineAnchors(root: HTMLElement | null, isPro: boolean | null) {
  if (!root || isPro !== false) return
  root.querySelectorAll<HTMLAnchorElement>('a[href*="motor-download"]').forEach(a => {
    if (a.dataset.sigmaGated === '1') return
    a.dataset.sigmaGated = '1'
    a.setAttribute('href', '/planes')
    a.removeAttribute('download')
    a.removeAttribute('target')
    a.removeAttribute('onclick')
    a.onclick = null
    a.innerHTML = '<span style="display:inline-flex;align-items:center;gap:7px;font-family:var(--font-dm-mono,monospace);font-size:12px;letter-spacing:0.06em">🔒 Activar PRO — incluye el Pine</span>'
    a.style.cssText = 'background:linear-gradient(100deg,#ffce7a,#f0913a);color:#1a1200;font-weight:700;text-decoration:none;border-radius:8px;padding:11px 18px;display:inline-flex;box-shadow:0 0 18px rgba(255,180,84,0.28)'
  })
}

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

// Notas educativas por estrategia para el Inspector HUD (lado web — el motor
// no expone descripciones). Se matchea por substring sobre el texto de la
// celda; las claves más específicas van primero.
const STRAT_NOTES: Array<{ k: string; t: string; d: string }> = [
  { k: 'regime_adaptive',  t: 'Adaptativo por régimen', d: 'Cambia su lógica según el régimen de mercado (bull, bear o rango).' },
  { k: 'bearish_rs',       t: 'Divergencia bajista RSI', d: 'El precio sube pero el RSI no acompaña — anticipa techo.' },
  { k: 'stoch_rsi',        t: 'Stoch RSI', d: 'Doble oscilador para timing fino de sobrecompra y sobreventa.' },
  { k: 'volume_climax',    t: 'Clímax de volumen', d: 'Detecta agotamiento por volumen extremo en techos.' },
  { k: 'energy_seasonal',  t: 'Estacionalidad energética', d: 'Patrones de calendario en commodities de energía.' },
  { k: 'macro_momentum',   t: 'Momentum macro', d: 'Sigue el flujo direccional impulsado por el contexto macro.' },
  { k: 'safe_haven',       t: 'Refugio', d: 'Rota hacia activos defensivos cuando el apetito de riesgo cae.' },
  { k: 'dxy_weakness',     t: 'Debilidad del dólar', d: 'Opera activos que se benefician cuando el DXY retrocede.' },
  { k: 'heikin_ashi',      t: 'Heikin Ashi', d: 'Suaviza el ruido de las velas para seguir la tendencia limpia.' },
  { k: 'zscore',           t: 'Z-Score', d: 'Mide desviaciones estadísticas extremas del precio vs. su media.' },
  { k: 'tema_cross',       t: 'Cruce TEMA', d: 'Cruces de medias triple-exponenciales de baja latencia.' },
  { k: 'ichimoku',         t: 'Ichimoku', d: 'Nube de equilibrio: tendencia, soporte y momentum en un sistema.' },
  { k: 'tma_bands',        t: 'Bandas TMA', d: 'Opera reversiones cuando el precio se estira lejos de su media triangular.' },
  { k: 'three_cand',       t: 'Tres velas', d: 'Impulso sostenido tras tres cierres consecutivos en la misma dirección.' },
  { k: 'dmi_bear',         t: 'DMI bajista', d: 'El índice direccional confirma dominio vendedor antes del corto.' },
  { k: 'lower_high',       t: 'Techos descendentes', d: 'Detecta lower highs — estructura bajista clásica.' },
  { k: 'williams_r',       t: 'Williams %R', d: 'Sobrecompra/sobreventa extrema como gatillo de reversión.' },
  { k: 'wedge_brea',       t: 'Ruptura de cuña', d: 'Opera el escape de una cuña de compresión.' },
  { k: 'psar_flip',        t: 'PSAR flip', d: 'Entra cuando el Parabolic SAR cambia de lado — giro de tendencia.' },
  { k: 'supply_zon',       t: 'Zona de oferta', d: 'Rechazo del precio en un área institucional de venta.' },
  { k: 'engulfing',        t: 'Vela envolvente', d: 'Reversión donde una vela absorbe por completo a la anterior.' },
  { k: 'fibonacci',        t: 'Fibonacci', d: 'Reacciones en retrocesos clave (38.2% / 61.8%) de la onda previa.' },
  { k: 'break_of_s',       t: 'Ruptura de estructura', d: 'Entra al quebrar un soporte o resistencia relevante.' },
  { k: 'cci_revers',       t: 'Reversión CCI', d: 'Extremos del Commodity Channel Index como señal de giro.' },
  { k: 'consecutiv',       t: 'Velas consecutivas', d: 'Racha direccional que anticipa continuación o agotamiento.' },
  { k: 'breakout',         t: 'Breakout', d: 'Ruptura de rango con expansión de volatilidad.' },
  { k: 'volatility',       t: 'Volatilidad', d: 'Entra cuando la volatilidad se expande tras una compresión.' },
  { k: 'momentum',         t: 'Momentum', d: 'Sigue la fuerza del movimiento cuando la aceleración confirma la tendencia.' },
]
const STRAT_FALLBACK = 'Estrategia validada out-of-sample: supera los gates de robustez del motor antes de operar.'

export default function HUDPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const isProRef = useRef<boolean | null>(null)

  // Plan del usuario — decide si el botón del Pine descarga o lleva a /planes.
  useEffect(() => {
    let dead = false
    supabase.auth.getUser().then(({ data }) => {
      if (dead) return
      const plan = (data.user?.app_metadata?.plan as string) ?? 'free'
      isProRef.current = plan === 'pro' || plan === 'anual'
      gatePineAnchors(containerRef.current, isProRef.current)
    }).catch(() => {})
    return () => { dead = true }
  }, [])

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
      // /planes es una ruta REAL de la app (el upsell del Pine para free), no una
      // sub-página del motor → dejar que navegue directo, no reenviar al proxy.
      if (href.startsWith('/api/') || href.startsWith('/download/') || href.startsWith('/motor-en-vivo') || href.startsWith('/planes')) return
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
      let card = (e.target as HTMLElement).closest?.('.card') as HTMLElement | null
      // Las matrices M1-M4 van sin tarjeta (mesa abierta): no se inclinan
      if (card && card.id.startsWith('matrix-section')) card = null
      // la vitrina de descargas tampoco (manda el hover de sus tarjetas internas)
      if (card && card.dataset.sigmaDl === '1') card = null
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

  // Inspector HUD — al posar el mouse sobre una celda campeón de las
  // matrices, un panel fijo muestra su contenido AMPLIADO (zoom 1.9x).
  // La celda no se mueve; el inspector lee el detalle por ti. 100% web.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const insp = document.createElement('div')
    insp.id = 'hud-inspector'
    insp.setAttribute('aria-hidden', 'true')
    document.body.appendChild(insp)
    let hideTimer: ReturnType<typeof setTimeout> | null = null

    function onOver(e: MouseEvent) {
      const cell = (e.target as HTMLElement).closest?.('.matrix td.cell-ok, .matrix td.cell-run') as HTMLTableCellElement | null
      if (!cell) return
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
      // contexto: activo de la fila + timeframe de la columna
      const asset = cell.closest('tr')?.querySelector('.asset-name')?.textContent?.trim() ?? ''
      const ths = cell.closest('table')?.querySelectorAll('th')
      const tf = ths && ths[cell.cellIndex] ? (ths[cell.cellIndex].textContent?.trim() ?? '') : ''
      // nota educativa: describe la(s) estrategia(s) presentes en la celda
      const txt = (cell.textContent ?? '').toLowerCase()
      const notes = STRAT_NOTES.filter(n => txt.includes(n.k)).slice(0, 2)
      const noteHtml = (notes.length > 0 ? notes : [{ t: 'Campeón del motor', d: STRAT_FALLBACK }])
        .map(n => `<div class="insp-note"><b>◈ ${n.t}</b> — ${n.d}</div>`)
        .join('')
      insp.innerHTML =
        `<div class="insp-head"><span>${asset}</span><span>${tf}</span></div>` +
        `<div class="insp-body">${cell.innerHTML}</div>` +
        `<div class="insp-notes">${noteHtml}</div>`
      insp.classList.add('on')
    }
    function onOut(e: MouseEvent) {
      const to = e.relatedTarget as HTMLElement | null
      if (to && to.closest && to.closest('.matrix td.cell-ok, .matrix td.cell-run')) return
      hideTimer = setTimeout(() => insp.classList.remove('on'), 160)
    }
    root.addEventListener('mouseover', onOver)
    root.addEventListener('mouseout', onOut)
    return () => {
      root.removeEventListener('mouseover', onOver)
      root.removeEventListener('mouseout', onOut)
      if (hideTimer) clearTimeout(hideTimer)
      insp.remove()
    }
  }, [])

  // Vitrina de descargas — reconstruye la sección de Pine Scripts como un
  // mini-dashboard estilo TradingView. Reutiliza los <a> reales del motor
  // (conservan href/download y el onclick) moviéndolos dentro de las tarjetas.
  // No toca el motor: transforma el DOM ya inyectado en la capa web.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0

    function drawChart(cv: HTMLCanvasElement) {
      const ctx = cv.getContext('2d'); if (!ctx) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = cv.clientWidth, h = cv.clientHeight
      if (!w || !h) return
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const n = 46, cw = w / n
      const seed = [0.6, -0.4, 0.9, 0.3, -0.7, 1.1, -0.2, 0.5, -0.9, 0.7, 0.2, -0.5, 1.0, -0.3]
      let price = h * 0.55
      const closes: number[] = []
      for (let i = 0; i < n; i++) { price += seed[i % seed.length] * h * 0.022; price = Math.max(h * 0.22, Math.min(h * 0.8, price)); closes.push(price) }
      // volumen (casi imperceptible)
      ctx.globalAlpha = 0.045; ctx.fillStyle = '#3B82F6'
      for (let i = 0; i < n; i++) { const vh = (Math.abs(seed[i % seed.length]) + 0.3) * h * 0.13; ctx.fillRect(i * cw + cw * 0.22, h - vh, cw * 0.56, vh) }
      // velas japonesas (baja opacidad)
      ctx.globalAlpha = 0.07; ctx.lineWidth = 1
      for (let i = 1; i < n; i++) {
        const o = closes[i - 1], c = closes[i], up = c <= o
        const col = up ? '#22C55E' : '#00E5FF'; ctx.strokeStyle = col; ctx.fillStyle = col
        const x = i * cw + cw * 0.5
        ctx.beginPath(); ctx.moveTo(x, Math.min(o, c) - 6); ctx.lineTo(x, Math.max(o, c) + 6); ctx.stroke()
        ctx.fillRect(i * cw + cw * 0.3, Math.min(o, c), cw * 0.4, Math.max(2, Math.abs(c - o)))
      }
      // EMA
      ctx.globalAlpha = 0.13; ctx.strokeStyle = '#00E5FF'; ctx.lineWidth = 1.5; ctx.beginPath()
      let ema = closes[0]
      for (let i = 0; i < n; i++) { ema += (closes[i] - ema) * 0.2; const x = i * cw + cw * 0.5; if (i) ctx.lineTo(x, ema); else ctx.moveTo(x, ema) }
      ctx.stroke(); ctx.globalAlpha = 1
    }

    function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;') }
    function featChips(s: string) {
      const parts = s.includes(' + ') ? s.split(' + ') : s.split(' / ')
      return parts.map(p => p.trim()).filter(Boolean).map(p => `<span>${esc(p)}</span>`).join('')
    }
    function nameVer(a: HTMLAnchorElement | null) {
      const t = (a?.textContent || '').replace(/[⬇↓]/g, '').trim()
      const m = t.match(/^(.*?)(v[\d.]+)\s*$/i)
      return { name: (m?.[1] ?? t).trim(), ver: (m?.[2] ?? '').trim() }
    }
    function subLabel(a: HTMLAnchorElement | null) {
      const d = a?.parentElement ? Array.from(a.parentElement.children).find(c => c.tagName === 'DIV') as HTMLElement | undefined : undefined
      return (d?.textContent || '').trim()
    }

    function enhance() {
      // Producto único que se muestra: SIGMA TERMINAL (el <a> de descarga
      // terminal). El de ENGINE (strategy) se descarta al reconstruir.
      const keep = root!.querySelector('a[href*="download/terminal"]') as HTMLAnchorElement | null
      if (!keep) return
      const card = keep.closest('.card') as HTMLElement | null
      // guard por PRESENCIA de mi wrapper: si el motor revierte el DOM, se
      // vuelve a aplicar (no un flag que quede obsoleto tras un re-render)
      if (!card || card.querySelector(':scope > .sigma-dl')) return
      try {
      const full = card.textContent || ''
      const size = full.match(/([\d.]+)\s*KB/i)?.[1] ?? '132'
      const updated = (full.match(/actualizado\s+([\d/]+[^)\n]*?)(?:\s*\(|$)/i)?.[1] ?? 'hoy').trim()
      const desc = (card.querySelector('p')?.textContent?.trim() ?? 'Carga el indicador en tu chart de TradingView.')
        .replace(/ambos indicadores/i, 'el indicador').replace(/El ENGINE/i, 'El TERMINAL')
      const s = nameVer(keep)
      const sFeats = featChips(subLabel(keep))

      // el <a> pasa a "Cargar en TradingView" con icono de velas
      // (se conservan href/download/onclick del motor)
      const tvIcon = '<svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true">' +
        '<line x1="3" y1="1.5" x2="3" y2="12.5" stroke="currentColor" stroke-width="1"/><rect x="1.6" y="4" width="2.8" height="6" rx="0.5" fill="currentColor"/>' +
        '<line x1="8" y1="0.5" x2="8" y2="11" stroke="currentColor" stroke-width="1"/><rect x="6.6" y="2.5" width="2.8" height="5" rx="0.5" fill="currentColor"/>' +
        '<line x1="13" y1="2.5" x2="13" y2="13.5" stroke="currentColor" stroke-width="1"/><rect x="11.6" y="6" width="2.8" height="4.5" rx="0.5" fill="currentColor"/></svg>'
      keep.innerHTML = tvIcon + '<span>Cargar en TradingView</span>'

      const parts = (reduce ? '' :
        '<span class="sigma-dl-particle" style="left:12%;bottom:10%;animation-delay:0s"></span>' +
        '<span class="sigma-dl-particle" style="left:82%;bottom:16%;animation-delay:3s"></span>' +
        '<span class="sigma-dl-particle" style="left:48%;bottom:8%;animation-delay:6s"></span>')

      const wrap = document.createElement('div')
      wrap.className = 'sigma-dl'
      wrap.innerHTML =
        '<canvas class="sigma-dl-bg"></canvas><div class="sigma-dl-scanline"></div>' + parts +
        '<div class="sigma-dl-inner">' +
          '<div class="sigma-dl-head">' +
            '<span class="sigma-dl-eyebrow">↓ TradingView Package</span>' +
            '<div class="sigma-dl-title">Load Professional Indicator</div>' +
            `<p class="sigma-dl-sub">${esc(desc)}</p>` +
          '</div>' +
          '<div class="sigma-dl-grid single">' +
            '<div class="sigma-dl-card terminal">' +
              '<div class="sigma-dl-card-head"><span class="sigma-dl-ico">📊</span>' +
                `<div class="sigma-dl-id"><b>${esc(s.name || 'SIGMA TERMINAL')}</b><span class="ver">${esc(s.ver)}</span></div>` +
                '<span class="sigma-dl-status">READY</span></div>' +
              `<div class="sigma-dl-feats">${sFeats}</div>` +
              `<div class="sigma-dl-metarow"><span>📦 ${esc(size)} KB</span><span>◈ Análisis institucional</span></div>` +
              '<div class="sigma-dl-btnslot" data-slot="terminal"></div>' +
            '</div>' +
          '</div>' +
          '<div class="sigma-dl-footbadges">' +
            `<span>📦 ${esc(size)} KB</span><span>🕒 ${esc(updated)}</span>` +
            `<span>🇨🇱 Chile</span><span>✔ Verified · TradingView</span>` +
          '</div>' +
        '</div>'

      card.dataset.sigmaDl = '1'
      card.innerHTML = ''
      card.appendChild(wrap)
      wrap.querySelector('[data-slot="terminal"]')?.appendChild(keep)
      const cv = wrap.querySelector('.sigma-dl-bg') as HTMLCanvasElement | null
      if (cv) requestAnimationFrame(() => drawChart(cv))
      // Free → el botón del Pine lleva a /planes (server ya bloquea la descarga)
      gatePineAnchors(root, isProRef.current)
      } catch (e) { console.warn('[sigma-dl] enhance failed', e) }
    }

    enhance()
    const obs = new MutationObserver(() => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; enhance() })
    })
    obs.observe(root, { childList: true, subtree: true })
    // Respaldo por carreras de tiempo con la carga async del motor: reintenta
    // hasta que la vitrina exista (luego el observer la mantiene aplicada).
    const poll = setInterval(() => {
      enhance()
      if (root.querySelector('.sigma-dl')) clearInterval(poll)
    }, 500)
    setTimeout(() => clearInterval(poll), 20000)
    const onResize = () => { const cv = root.querySelector('.sigma-dl-bg') as HTMLCanvasElement | null; if (cv) drawChart(cv) }
    window.addEventListener('resize', onResize)
    return () => { obs.disconnect(); clearInterval(poll); window.removeEventListener('resize', onResize); if (raf) cancelAnimationFrame(raf) }
  }, [])

  // Régimen BTC — el motor inyecta "🐂 BULL" / "🐻 BEAR" / "🦘 RANGE" en
  // #kpi-regime via textContent en cada refresh (pisa cualquier cosa que le
  // pongamos encima), así que el guard es "¿el texto trae la MISMA palabra Y
  // el caret sigue ahí?" — si el motor lo pisó, el caret ya no está y se
  // reconstruye. Dos capas: (1) caret direccional + palabra en la línea del
  // valor; (2) un GRABADO vectorial detallado de la cabeza del animal como
  // watermark de toda la tarjeta (.regime-bg, hermano del valor dentro del
  // .kpi-card — el motor nunca toca el card, solo el value div, así que el
  // watermark sobrevive). Color = el mismo que el motor asigna al valor
  // (BEAR rojo / BULL cian / RANGE ámbar) para que texto y arte concuerden.
  // (Historial: emoji → constelación de puntos → silueta line-icon; esta es
  //  la evolución pedida: arte grande de fondo, no un ícono chico en línea.)
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    let lastWord = ''
    type Regime = 'BULL' | 'BEAR' | 'RANGE'
    const COLORS: Record<Regime, string> = { BEAR: '#ff5d6c', BULL: '#39e2e6', RANGE: '#f59e0b' }
    const CARET: Record<Regime, string> = { BEAR: '▼', BULL: '▲', RANGE: '◆' }

    // Grabado de trazo fino (viewBox 120×120). fill="none" global; los acentos
    // rellenos (nariz/ojos) llevan fill inline. Estilo "esquemático de precisión".
    const ART: Record<Regime, string> = {
      BEAR:
        '<circle cx="36" cy="33" r="16"/><circle cx="36" cy="33" r="7"/>' +
        '<circle cx="84" cy="33" r="16"/><circle cx="84" cy="33" r="7"/>' +
        '<path d="M60 25 C86 25 98 45 98 63 C98 87 80 103 60 103 C40 103 22 87 22 63 C22 45 34 25 60 25 Z"/>' +
        '<path d="M40 49 Q46 45 52 49"/><path d="M68 49 Q74 45 80 49"/>' +
        '<circle cx="46" cy="59" r="3.6" fill="currentColor"/><circle cx="74" cy="59" r="3.6" fill="currentColor"/>' +
        '<ellipse cx="60" cy="79" rx="22" ry="16"/>' +
        '<path d="M51 70 Q60 66 69 70 Q67 79 60 81 Q53 79 51 70 Z" fill="currentColor"/>' +
        '<path d="M60 81 L60 89 Q54 93 50 90 M60 89 Q66 93 70 90"/>',
      BULL:
        '<path d="M44 48 C32 42 20 44 12 30 C22 34 34 38 47 45"/>' +
        '<path d="M76 48 C88 42 100 44 108 30 C98 34 86 38 73 45"/>' +
        '<circle cx="12" cy="30" r="2.6" fill="currentColor"/><circle cx="108" cy="30" r="2.6" fill="currentColor"/>' +
        '<path d="M34 60 C22 54 14 58 12 64 C20 64 28 64 36 68 Z"/>' +
        '<path d="M86 60 C98 54 106 58 108 64 C100 64 92 64 84 68 Z"/>' +
        '<path d="M60 47 C80 47 90 61 88 79 C86 95 74 105 60 105 C46 105 34 95 32 79 C30 61 40 47 60 47 Z"/>' +
        '<path d="M50 52 Q60 44 70 52"/><path d="M56 55 L58 63 M64 55 L62 63"/>' +
        '<circle cx="48" cy="69" r="3.8" fill="currentColor"/><circle cx="72" cy="69" r="3.8" fill="currentColor"/>' +
        '<ellipse cx="60" cy="90" rx="17" ry="12"/>' +
        '<ellipse cx="53" cy="90" rx="2.3" ry="3.2" fill="currentColor"/><ellipse cx="67" cy="90" rx="2.3" ry="3.2" fill="currentColor"/>',
      RANGE:
        '<path d="M18 40 H102" stroke-dasharray="5 6" opacity="0.7"/>' +
        '<path d="M18 80 H102" stroke-dasharray="5 6" opacity="0.7"/>' +
        '<path d="M22 60 H98"/>' +
        '<path d="M36 46 L22 60 L36 74"/><path d="M84 46 L98 60 L84 74"/>' +
        '<path d="M52 60 Q60 50 68 60" opacity="0.8"/>',
    }

    function apply() {
      const el = root!.querySelector('#kpi-regime') as HTMLElement | null
      if (!el) return
      const m = (el.textContent || '').match(/BULL|BEAR|RANGE/)
      if (!m) return
      const word = m[0] as Regime
      const card = el.closest('.kpi-card') as HTMLElement | null
      const hasCaret = !!el.querySelector('.regime-caret')
      const hasBg = !!card?.querySelector(':scope > .regime-bg')
      if (word === lastWord && hasCaret && hasBg) return
      lastWord = word
      const color = COLORS[word]

      el.innerHTML = `<span class="regime-caret">${CARET[word]}</span><span class="regime-txt">${word}</span>`

      if (card) {
        card.classList.add('regime-card')
        let bg = card.querySelector(':scope > .regime-bg') as HTMLElement | null
        if (!bg) {
          bg = document.createElement('div')
          bg.className = 'regime-bg'
          card.insertBefore(bg, card.firstChild)
        }
        if (word === 'BEAR' || word === 'BULL') {
          // Foto duotono (recorte + tinte horneados en el asset) con scrim de
          // degradado del lado del texto → números 100% legibles.
          // Asset = SOLO LA CABEZA: el cuerpo entero a escala de tarjeta era un
          // fragmento de pelaje irreconocible; la cabeza (cuernos/orejas/hocico)
          // es lo que se lee como el animal. bear.webp cuerpo entero = reserva.
          // Crédito bull-head: foto "Toro De Lidia En Colombia" de Santiago
          // Molina N., Wikimedia Commons, CC BY-SA 3.0 (derivado: recorte +
          // duotono cian) — atribución también en /recursos.
          const cls = word === 'BEAR' ? 'rb-bear' : 'rb-bull'
          const src = word === 'BEAR' ? '/regime/bear-head.webp' : '/regime/bull-head.webp'
          bg.className = `regime-bg rb-photo ${cls}`
          bg.style.color = ''
          bg.innerHTML =
            `<img class="regime-photo" src="${src}" alt="" aria-hidden="true" draggable="false"/>` +
            '<span class="regime-scrim"></span>'
        } else {
          // RANGE: glifo vectorial de rango lateral (neutro, funciona bien)
          bg.className = 'regime-bg rb-vec'
          bg.style.color = color
          bg.innerHTML =
            `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2.4" ` +
            `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ART[word]}</svg>`
        }
      }
    }

    apply()
    const obs = new MutationObserver(() => apply())
    obs.observe(root, { childList: true, subtree: true, characterData: true })
    const poll = setInterval(apply, 800)
    setTimeout(() => clearInterval(poll), 20000)
    return () => { obs.disconnect(); clearInterval(poll) }
  }, [])

  // ══ MONOLITO Σ — hero del HUD ══════════════════════════════════════════════
  // La marca hecha objeto: escultura de partículas del glifo Σ (péndulo suave,
  // pulso de luz teñido por el régimen) que reemplaza VISUALMENTE la tira de
  // KPIs. El motor NO se toca: #kpi-strip queda oculto pero vivo en el DOM y
  // sigue siendo la fuente de datos — el motor le escribe por textContent y
  // nosotros espejamos esos valores en las lecturas del hero (mismo patrón que
  // la barra de equity). Si algo falla (sin canvas, sin strip), no se hace
  // nada y la tira original queda visible: fallback gratis.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let regime: 'BULL' | 'BEAR' | 'RANGE' = 'RANGE'

    // ── partículas del glifo (se muestrea una sola vez) ──
    const off = document.createElement('canvas')
    off.width = 340; off.height = 400
    const octx = off.getContext('2d')
    if (!octx) return
    octx.fillStyle = '#fff'
    octx.font = '900 360px Impact, "Arial Black", sans-serif'
    octx.textAlign = 'center'; octx.textBaseline = 'middle'
    octx.fillText('Σ', 170, 210)
    const img = octx.getImageData(0, 0, 340, 400).data
    const filled = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < 340 && y < 400 && img[((y | 0) * 340 + (x | 0)) * 4 + 3] > 128
    type Pt = { x: number; y: number; z: number; e: number; ph: number }
    const P: Pt[] = []
    for (let gy = 0; gy < 400; gy += 2) for (let gx = 0; gx < 340; gx += 2) {
      if (!filled(gx, gy)) continue
      const e = !(filled(gx - 3, gy) && filled(gx + 3, gy) && filled(gx, gy - 3) && filled(gx, gy + 3)) ? 1 : 0
      if (e || Math.random() < 0.075) {
        P.push({ x: (gx - 170) / 170, y: (gy - 205) / 170, z: (Math.random() * 2 - 1) * 0.12 * (e ? 1 : 0.7), e, ph: Math.random() * 6.28 })
      }
    }
    if (P.length < 200) return // glifo no renderizó: no montar el hero

    let t = 0
    function draw(cv: HTMLCanvasElement) {
      const ctx = cv.getContext('2d')
      if (!ctx) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = cv.clientWidth, h = cv.clientHeight
      if (!w || !h) return
      if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const cx = w * 0.5, cy = h * 0.46, S = Math.min(w, h) * 0.42
      const ang = reduced ? 0.28 : 0.44 * Math.sin(t * 0.004)
      const cosA = Math.cos(ang), sinA = Math.sin(ang)
      const pulseY = ((t * 0.006) % 2.6) - 1.3
      const REG = regime === 'BEAR' ? [255, 93, 108] : regime === 'BULL' ? [57, 226, 230] : [255, 180, 84]

      const floorY = cy + S * 1.06
      const fl = ctx.createLinearGradient(w * 0.2, 0, w * 0.8, 0)
      fl.addColorStop(0, 'transparent'); fl.addColorStop(0.5, 'rgba(94,234,240,0.22)'); fl.addColorStop(1, 'transparent')
      ctx.fillStyle = fl; ctx.fillRect(w * 0.2, floorY, w * 0.6, 1)

      // glifo fantasma en vidrio: garantiza que la Σ siempre se lea
      const gw = 340 * (S / 170) * 0.98, gh = 400 * (S / 170) * 0.98
      ctx.save()
      ctx.translate(cx, cy + S * 0.03); ctx.scale(cosA, 1)
      ctx.globalAlpha = 0.10; ctx.shadowColor = 'rgba(94,234,240,0.9)'; ctx.shadowBlur = 26
      ctx.drawImage(off, -gw / 2, -gh / 2, gw, gh)
      ctx.globalAlpha = 0.055; ctx.shadowBlur = 0
      ctx.drawImage(off, -gw / 2, -gh / 2, gw, gh)
      ctx.restore()

      const pts = P.map(p => {
        const x1 = p.x * cosA + p.z * sinA
        const z1 = -p.x * sinA + p.z * cosA
        const persp = 1 / (1 + z1 * 0.55)
        return { sx: cx + x1 * S * persp, sy: cy + p.y * S * persp, z: z1, e: p.e, y: p.y, ph: p.ph, persp }
      }).sort((a, b) => b.z - a.z)

      for (const q of pts) {
        const front = Math.max(0, Math.min(1, (0.16 - q.z) / 0.32))
        const pulse = Math.exp(-Math.pow((q.y - pulseY) * 3.2, 2)) * 0.55
        const shim = reduced ? 0 : 0.10 * Math.sin(t * 0.03 + q.ph)
        const L = Math.max(0.08, Math.min(1, 0.24 + front * 0.52 + pulse + shim + (q.e ? 0.16 : 0)))
        const mr = pulse * 1.4 // el pulso arrastra el tinte del régimen
        const r = Math.round(34 + L * 86 + (REG[0] - 120) * mr * 0.5)
        const g = Math.round(86 + L * 162 + (REG[1] - 160) * mr * 0.35)
        const b = Math.round(104 + L * 152 + (REG[2] - 150) * mr * 0.3)
        const rad = (q.e ? 1.7 : 1.2) * q.persp * (1 + pulse * 0.8)
        ctx.fillStyle = `rgba(${r},${g},${b},${(0.42 + L * 0.58).toFixed(2)})`
        ctx.beginPath(); ctx.arc(q.sx, q.sy, rad, 0, 7); ctx.fill()
        if (q.e) { // reflejo en piso, solo contorno
          const ry = floorY + (floorY - q.sy) * 0.28
          if (ry > floorY && ry < floorY + 92) {
            ctx.fillStyle = `rgba(${r},${g},${b},${(0.05 + L * 0.07).toFixed(3)})`
            ctx.beginPath(); ctx.arc(q.sx, ry, rad * 0.9, 0, 7); ctx.fill()
          }
        }
      }
      const halo = ctx.createRadialGradient(cx, cy, S * 0.2, cx, cy, S * 1.5)
      halo.addColorStop(0, `rgba(${REG[0]},${REG[1]},${REG[2]},0.03)`)
      halo.addColorStop(0.4, 'rgba(57,226,230,0.035)'); halo.addColorStop(1, 'transparent')
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
    }

    function loop() {
      const cv = root!.querySelector('.sigma-mono-cv') as HTMLCanvasElement | null
      if (cv && cv.isConnected) { draw(cv); if (!reduced) t++ }
      raf = requestAnimationFrame(loop)
    }

    // ── espejo de los KPIs del motor hacia las lecturas del hero ──
    const txt = (id: string) => (root!.querySelector('#' + id)?.textContent ?? '').trim()
    function syncReadouts(hero: HTMLElement) {
      const m = txt('kpi-regime').match(/BULL|BEAR|RANGE/)
      if (m) regime = m[0] as typeof regime
      const set = (sel: string, v: string) => {
        const el = hero.querySelector(sel) as HTMLElement | null
        if (el && el.textContent !== v) el.textContent = v
      }
      set('.smh-eq', txt('kpi-equity') || '—')
      const realized = txt('kpi-realized'), realizedSub = txt('kpi-realized-sub')
      set('.smh-eqsub', realized ? `${realized} realizado · ${realizedSub}` : txt('kpi-equity-sub'))
      const flo = txt('kpi-floating')
      set('.smh-flo', flo || '—')
      const floEl = hero.querySelector('.smh-flo') as HTMLElement | null
      if (floEl) floEl.style.color = flo.startsWith('-') ? '#ff5d6c' : '#2fd39a'
      set('.smh-wr', txt('kpi-winrate') || '—')
      set('.smh-wrsub', txt('kpi-winrate-sub'))
      set('.smh-sig', txt('kpi-signals') || '—')
      set('.smh-sigsub', txt('kpi-signals-sub'))
      set('.smh-lev', txt('kpi-leverage') || '—')
      const regEl = hero.querySelector('.smh-reg') as HTMLElement | null
      if (regEl) {
        const color = regime === 'BEAR' ? '#ff5d6c' : regime === 'BULL' ? '#39e2e6' : '#ffb454'
        const caret = regime === 'BEAR' ? '▼' : regime === 'BULL' ? '▲' : '◆'
        const want = `${caret} ${regime}`
        if (regEl.textContent !== want) regEl.textContent = want
        regEl.style.color = color
        const it = regEl.closest('.smh-it') as HTMLElement | null
        if (it) it.style.borderRightColor = `${color}66`
      }
    }

    function apply() {
      const strip = root!.querySelector('#kpi-strip') as HTMLElement | null
      if (!strip || !strip.parentElement) return
      let hero = root!.querySelector('.sigma-monolith') as HTMLElement | null
      if (!hero) {
        hero = document.createElement('div')
        hero.className = 'sigma-monolith'
        hero.innerHTML =
          '<canvas class="sigma-mono-cv" aria-hidden="true"></canvas>' +
          '<div class="smh-tl"><div class="smh-k">EQUITY · CUENTA MOTOR</div>' +
            '<div class="smh-eq">—</div><div class="smh-eqsub"></div></div>' +
          '<div class="smh-r">' +
            '<div class="smh-it"><div class="smh-k">P&L FLOTANTE</div><div class="smh-v smh-flo">—</div></div>' +
            '<div class="smh-it"><div class="smh-k">WIN RATE</div><div class="smh-v smh-wr" style="color:#ffb454">—</div><div class="smh-s smh-wrsub"></div></div>' +
            '<div class="smh-it"><div class="smh-k">SEÑALES ACTIVAS</div><div class="smh-v smh-sig" style="color:#5eeaf0">—</div><div class="smh-s smh-sigsub"></div></div>' +
            '<div class="smh-it"><div class="smh-k">APALANCAMIENTO</div><div class="smh-v smh-lev" style="color:#4f92ff">—</div></div>' +
            '<div class="smh-it"><div class="smh-k">RÉGIMEN BTC</div><div class="smh-v smh-reg">—</div></div>' +
          '</div>' +
          '<div class="smh-b"><span><b>Σ</b> PARTÍCULAS = MODELOS DEL MOTOR</span><span>PULSO = LATIDO DE EVALUACIÓN</span><span>TINTE = RÉGIMEN</span></div>'
        strip.parentElement.insertBefore(hero, strip)
        strip.classList.add('sigma-strip-hidden')
      }
      syncReadouts(hero)
    }

    apply()
    const obs = new MutationObserver(() => apply())
    obs.observe(root, { childList: true, subtree: true, characterData: true })
    const poll = setInterval(() => { apply(); if (root.querySelector('.sigma-monolith')) clearInterval(poll) }, 500)
    setTimeout(() => clearInterval(poll), 20000)
    raf = requestAnimationFrame(loop)
    return () => {
      obs.disconnect(); clearInterval(poll); cancelAnimationFrame(raf)
      root.querySelector('.sigma-monolith')?.remove()
      root.querySelector('#kpi-strip')?.classList.remove('sigma-strip-hidden')
    }
  }, [])

  // ══ COLAPSO DE ONDA — Risk Metrics cuánticas ═══════════════════════════════
  // Las 7 métricas de riesgo como "mediciones cuánticas": cada una vive como
  // una nube de partículas 3D (mismo ADN que el monolito) que, en una CASCADA
  // izquierda→derecha, colapsa en espiral sobre su valor (flash + onda de
  // choque) y vuelve a dispersarse. Números SIEMPRE nítidos: placa sobria con
  // glow solo durante la medición; partículas frontales atenuadas al cruzar
  // la placa. Patrón blindado: .risk-panel del motor queda oculto pero VIVO
  // como fuente (el motor escribe textContent/clases; acá solo se lee). Si el
  // panel no aparece o el canvas falla, no se monta nada y el original queda.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    type Metric = { label: string; value: string; ctx: string; color: string; q: number }
    let metrics: Metric[] = []
    let lastSnap = ''

    const COLOR_OF: Record<string, [string, number]> = {
      'kpi-pos': ['#2fd39a', 0.88], 'kpi-warn': ['#ffb454', 0.52],
      'kpi-neg': ['#ff5d6c', 0.28], 'kpi-neutral': ['#8b97ad', 0.4],
    }
    function readMetrics(): Metric[] {
      const cells = Array.from(root!.querySelectorAll('.risk-panel .risk-cell'))
      return cells.slice(0, 8).map(c => {
        const val = c.querySelector('.risk-cell-val') as HTMLElement | null
        const cls = Array.from(val?.classList ?? []).find(k => COLOR_OF[k])
        const [color, q] = COLOR_OF[cls ?? 'kpi-neutral'] ?? COLOR_OF['kpi-neutral']
        return {
          label: (c.querySelector('.risk-cell-label')?.textContent ?? '').trim().toUpperCase(),
          value: (val?.textContent ?? '—').trim(),
          ctx: (c.querySelector('.risk-cell-ctx')?.textContent ?? '').trim().toUpperCase(),
          color, q,
        }
      }).filter(m => m.label)
    }

    // nubes: órbitas 3D fijas por índice (no dependen del valor → sin re-seed)
    const RING_TILT = 0.42
    const clouds: { a: number; r: number; sp: number; ph: number; inc: number }[][] = []
    function cloudFor(i: number) {
      if (!clouds[i]) {
        clouds[i] = Array.from({ length: 44 }, () => ({
          a: Math.random() * 6.28, r: 0.35 + Math.random() * 0.65,
          sp: 0.5 + Math.random() * 0.9, ph: Math.random() * 6.28,
          inc: (Math.random() * 2 - 1) * 0.9,
        }))
      }
      return clouds[i]
    }

    const rgbOf = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
    const ease = (p: number) => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    function rr(x: CanvasRenderingContext2D, a: number, b: number, w: number, h: number, r: number) {
      x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r)
      x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath()
    }
    const PERIOD = 560, STAGGER = 42
    let t = 0
    function stateOf(p: number) {
      if (p < 0.52) return { mix: 0, flash: 0, shock: -1 }
      if (p < 0.66) return { mix: ease((p - 0.52) / 0.14), flash: 0, shock: -1 }
      if (p < 0.74) { const s = (p - 0.66) / 0.08; return { mix: 1, flash: 1 - s * 0.6, shock: s } }
      if (p < 0.86) { const s = (p - 0.74) / 0.12; return { mix: 1 - ease(s), flash: Math.max(0, 0.4 - s * 0.4), shock: -1 } }
      return { mix: 0, flash: 0, shock: -1 }
    }

    function draw(cv: HTMLCanvasElement) {
      const qx = cv.getContext('2d')
      if (!qx || metrics.length === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = cv.clientWidth, H = 250
      if (!w) return
      if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = H * dpr }
      qx.setTransform(dpr, 0, 0, dpr, 0, 0)
      qx.clearRect(0, 0, w, H)
      // textura de puntos + retículas de esquina
      qx.fillStyle = 'rgba(148,163,196,0.045)'
      for (let dx = 16; dx < w; dx += 24) for (let dy = 16; dy < H - 14; dy += 24) qx.fillRect(dx, dy, 1, 1)
      qx.strokeStyle = 'rgba(94,234,240,0.4)'; qx.lineWidth = 1.4
      ;[[10, 10, 1, 1], [w - 10, 10, -1, 1], [10, H - 10, 1, -1], [w - 10, H - 10, -1, -1]].forEach(c => {
        qx.beginPath(); qx.moveTo(c[0] + 9 * c[2], c[1]); qx.lineTo(c[0], c[1]); qx.lineTo(c[0], c[1] + 9 * c[3]); qx.stroke()
      })
      const n = metrics.length, slot = w / n
      for (let i = 1; i < n; i++) {
        const sg = qx.createLinearGradient(0, 24, 0, H - 44)
        sg.addColorStop(0, 'transparent'); sg.addColorStop(0.5, 'rgba(255,255,255,0.05)'); sg.addColorStop(1, 'transparent')
        qx.fillStyle = sg; qx.fillRect(slot * i, 24, 1, H - 68)
      }
      for (let i = 0; i < n; i++) {
        const m = metrics[i]
        const cx = slot * (i + 0.5), cy = 90
        const col = rgbOf(m.color)
        const phase = (((t - i * STAGGER) % PERIOD) + PERIOD) % PERIOD / PERIOD
        const st = reduced ? { mix: 0.2, flash: 0, shock: -1 } : stateOf(phase)
        const mix = st.mix
        const lit = st.flash + mix * 0.35

        // sombra de asiento
        const padG = qx.createRadialGradient(cx, 160, 2, cx, 160, 46)
        padG.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${(0.05 + lit * 0.05).toFixed(3)})`)
        padG.addColorStop(1, 'transparent')
        qx.fillStyle = padG
        qx.beginPath(); qx.ellipse(cx, 160, 46, 9, 0, 0, 2 * Math.PI); qx.fill()

        // nube 3D
        const cloud = cloudFor(i)
        const Rd = 50 * (0.7 + m.q * 0.45), Rc = 30
        type PP = { x: number; y: number; al: number; r: number; ang: number; rad: number; inc: number }
        const backs: PP[] = [], fronts: PP[] = []
        for (const p of cloud) {
          const ang = p.a + t * 0.006 * p.sp + mix * 2.6
          const rad = (Rd * p.r) * (1 - mix) + Rc * 0.72 * mix
          const incNow = p.inc * (1 - mix) + RING_TILT * mix
          const ex = Math.cos(ang) * rad * 1.35
          const ey = Math.sin(ang) * rad * Math.abs(Math.sin(incNow)) * 0.9
          const ez = Math.sin(ang) * Math.cos(incNow)
          const depth = (ez + 1) / 2
          const shim = 0.5 + 0.5 * Math.sin(t * 0.04 + p.ph)
          ;(ez > 0 ? fronts : backs).push({
            x: cx + ex, y: cy + ey,
            al: (0.10 + mix * 0.30) * (0.35 + 0.65 * shim) * (0.45 + depth * 0.75),
            r: (0.9 + mix * 0.7) * (0.55 + depth * 0.9),
            ang, rad, inc: incNow,
          })
        }
        qx.font = '700 22px Impact, sans-serif'
        const tw = qx.measureText(m.value).width, pw = Math.max(tw + 24, 72), ph2 = 31, py2 = cy - 15
        const overPlate = (x2: number, y2: number) => x2 > cx - pw / 2 - 2 && x2 < cx + pw / 2 + 2 && y2 > py2 - 2 && y2 < py2 + ph2 + 2
        const paint = (list: PP[], trail: boolean) => {
          for (const pp of list) {
            const dim = overPlate(pp.x, pp.y) ? 0.22 : 1
            if (trail && mix > 0.15 && mix < 1) {
              const tx = cx + Math.cos(pp.ang - 0.14) * (pp.rad + 3) * 1.35
              const ty = cy + Math.sin(pp.ang - 0.14) * (pp.rad + 3) * Math.abs(Math.sin(pp.inc)) * 0.9
              qx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(pp.al * 0.35 * dim).toFixed(2)})`
              qx.beginPath(); qx.arc(tx, ty, pp.r * 0.6, 0, 7); qx.fill()
            }
            qx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(pp.al * dim).toFixed(2)})`
            qx.beginPath(); qx.arc(pp.x, pp.y, pp.r, 0, 7); qx.fill()
          }
        }
        paint(backs, true)

        if (st.shock >= 0) {
          const sr = 26 + st.shock * 46
          qx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${((1 - st.shock) * 0.38).toFixed(2)})`
          qx.lineWidth = 1.3 * (1 - st.shock) + 0.3
          qx.beginPath(); qx.ellipse(cx, cy, sr * 1.35, sr * 0.5, 0, 0, 2 * Math.PI); qx.stroke()
        }

        // placa sobria: relieve físico; borde/número solo brillan al medir
        qx.shadowColor = 'rgba(0,0,0,0.6)'; qx.shadowBlur = 10; qx.shadowOffsetY = 3
        const pg = qx.createLinearGradient(0, py2, 0, py2 + ph2)
        pg.addColorStop(0, 'rgba(23,32,47,0.96)'); pg.addColorStop(1, 'rgba(8,12,20,0.96)')
        qx.fillStyle = pg; rr(qx, cx - pw / 2, py2, pw, ph2, 7); qx.fill()
        qx.shadowBlur = 0; qx.shadowOffsetY = 0
        qx.strokeStyle = 'rgba(255,255,255,0.10)'; qx.lineWidth = 1
        qx.beginPath(); qx.moveTo(cx - pw / 2 + 7, py2 + 1); qx.lineTo(cx + pw / 2 - 7, py2 + 1); qx.stroke()
        qx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.30 + lit * 0.55).toFixed(2)})`
        qx.lineWidth = 1.1 + lit * 0.9
        if (lit > 0.25) { qx.shadowColor = m.color; qx.shadowBlur = lit * 12 }
        rr(qx, cx - pw / 2, py2, pw, ph2, 7); qx.stroke(); qx.shadowBlur = 0
        qx.textAlign = 'center'
        qx.fillStyle = m.color
        qx.shadowColor = 'rgba(0,0,0,0.85)'; qx.shadowOffsetY = 1.5
        qx.fillText(m.value, cx, py2 + 22)
        qx.shadowOffsetY = 0
        if (lit > 0.3) { qx.shadowColor = m.color; qx.shadowBlur = lit * 10; qx.fillText(m.value, cx, py2 + 22); qx.shadowBlur = 0 }

        paint(fronts, true)

        // etiqueta + píldora de contexto, sobrias
        qx.font = '600 10.5px ui-monospace, monospace'; qx.fillStyle = '#aab3c6'
        qx.fillText(m.label, cx, 192)
        qx.font = '7.5px ui-monospace, monospace'
        const pw2 = qx.measureText(m.ctx).width + 18
        qx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.07)`
        qx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.32)`
        rr(qx, cx - pw2 / 2, 202, pw2, 15, 7); qx.fill(); qx.stroke()
        qx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.85)`
        qx.fillText(m.ctx, cx, 212)
      }
    }

    function loop() {
      const cv = root!.querySelector('.sigma-qwave-cv') as HTMLCanvasElement | null
      if (cv && cv.isConnected) { draw(cv); if (!reduced) t++ }
      raf = requestAnimationFrame(loop)
    }

    function apply() {
      const panel = root!.querySelector('.risk-panel') as HTMLElement | null
      if (!panel || !panel.parentElement) return
      let holder = root!.querySelector('.sigma-qwave') as HTMLElement | null
      if (!holder) {
        holder = document.createElement('div')
        holder.className = 'sigma-qwave'
        holder.innerHTML = '<canvas class="sigma-qwave-cv" aria-hidden="true"></canvas>'
        panel.parentElement.insertBefore(holder, panel)
        panel.classList.add('sigma-risk-hidden')
      }
      const next = readMetrics()
      const snap = next.map(m => m.label + m.value + m.color).join('|')
      if (snap !== lastSnap) { lastSnap = snap; metrics = next }
    }

    apply()
    const obs = new MutationObserver(() => apply())
    obs.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] })
    const poll = setInterval(() => { apply(); if (root.querySelector('.sigma-qwave')) clearInterval(poll) }, 500)
    setTimeout(() => clearInterval(poll), 20000)
    raf = requestAnimationFrame(loop)
    return () => {
      obs.disconnect(); clearInterval(poll); cancelAnimationFrame(raf)
      root.querySelector('.sigma-qwave')?.remove()
      root.querySelector('.risk-panel')?.classList.remove('sigma-risk-hidden')
    }
  }, [])

  // ══ PERFORMANCE SNAPSHOT — 3 columnas nativas ══════════════════════════════
  // Calendario de P&L (30 días) · resultado acumulado del mes · exposición en
  // "plasma". Se calcula TODO desde /api/vps/trades con la misma lógica del
  // motor (heatmap = suma de pnl_pct por día). El panel .card-purple del motor
  // (Performance Snapshot) queda oculto pero vivo como fuente/fallback; no se
  // toca el motor. Si no aparece el panel o falla el fetch, no se monta nada.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    type Day = { day: number; v: number | null; future: boolean; blank: boolean }
    let days: Day[] = []
    let monthLabel = ''
    let todayIdx = -1
    let cum: number[] = [0]
    let monthPct = 0, monthUsd = 0, peak = 0, valley = 0, nOper = 0, maxMag = 1
    let st = { sharpe: 0, streak: 0, wins: 0, losses: 0, best: 0, worst: 0 }
    let expo: { sym: string; n: number; color: string }[] = []
    let totalPos = 0
    let lastText = ''

    const SYM_COL: Record<string, string> = {
      BTC: '#f7931a', ETH: '#627eea', SOL: '#9945ff', BNB: '#f3ba2f', LTC: '#345d9d',
      XAU: '#ffd166', XAG: '#c0c8d0', WTI: '#39e2e6', NG: '#4f92ff', HG: '#c87b3a', PL: '#8bd3e6',
      AAPL: '#ff5d6c', NVDA: '#76b900', TSLA: '#e82127', CVX: '#4f92ff', JPM: '#5b8cff',
      SPY: '#5b8cff', QQQ: '#5b8cff', IWM: '#a78bfa', XLE: '#3fb950', EWJ: '#a78bfa', EWT: '#5eeaf0', EWY: '#ff9db0',
    }
    const PAL = ['#39e2e6', '#4f92ff', '#2fd39a', '#ffb454', '#ff5d6c', '#3fb950', '#5b8cff', '#a78bfa', '#5eeaf0', '#f5c842']
    const rgbOf = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
    const rrect = (x: CanvasRenderingContext2D, a: number, b: number, w: number, h: number, r: number) => {
      x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r)
      x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath()
    }
    const tint = (v: number | null): [number, number, number, number] => {
      if (v == null) return [90, 100, 120, 0.16]
      const f = Math.min(1, Math.abs(v) / maxMag)
      return v > 0 ? [47, 211, 154, 0.22 + f * 0.66] : v < 0 ? [255, 93, 108, 0.22 + f * 0.66] : [90, 100, 120, 0.2]
    }

    function compute(j: { history?: { closed_at?: string; pnl_pct?: number; pnl_dollar?: number }[]; open?: { sym?: string; tf?: string; direction?: string; strategy?: string; status?: string }[] }) {
      const hist = Array.isArray(j.history) ? j.history : []
      const now = new Date()
      const Y = now.getFullYear(), M = now.getMonth(), today = now.getDate()
      const daysInMonth = new Date(Y, M + 1, 0).getDate()
      const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const MES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
      monthLabel = `${MES[M]} ${Y}`
      // solo operaciones cerradas dentro del mes calendario en curso
      const map: Record<string, number> = {}
      monthUsd = 0
      for (const t of hist) {
        const cd = (t.closed_at ?? '').slice(0, 10)
        if (!cd) continue
        const dt = new Date(cd + 'T00:00:00')
        if (dt.getFullYear() !== Y || dt.getMonth() !== M) continue
        map[cd] = (map[cd] ?? 0) + (t.pnl_pct ?? 0)
        monthUsd += t.pnl_dollar ?? 0
      }
      // rejilla de calendario real: huecos de alineación (lunes=0) + días 1..fin
      // de mes; los días que aún no llegan quedan como placeholder vacío
      days = []
      const firstDow = (new Date(Y, M, 1).getDay() + 6) % 7
      for (let b = 0; b < firstDow; b++) days.push({ day: 0, v: null, future: false, blank: true })
      todayIdx = -1
      for (let d = 1; d <= daysInMonth; d++) {
        const k = key(new Date(Y, M, d))
        const future = d > today
        if (d === today) todayIdx = days.length
        days.push({ day: d, v: k in map ? map[k] : null, future, blank: false })
      }
      const active = days.filter(d => !d.blank && !d.future)
      const vals = active.filter(d => d.v != null).map(d => d.v as number)
      maxMag = Math.max(0.5, ...vals.map(v => Math.abs(v)))
      // acumulado solo sobre los días ya transcurridos del mes
      cum = [0]; let run = 0
      for (const d of active) { run += d.v ?? 0; cum.push(run) }
      monthPct = run; peak = Math.max(...cum); valley = Math.min(...cum); nOper = vals.length
      // rolling
      const n = vals.length, avg = n ? vals.reduce((s, v) => s + v, 0) / n : 0
      const sd = n > 1 ? Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / n) : 0
      let streak = 0, curS = 0
      for (const v of vals) { if (v > 0) { curS++; streak = Math.max(streak, curS) } else curS = 0 }
      st = {
        sharpe: sd > 0 ? (avg / sd) * Math.sqrt(365) : 0, streak,
        wins: vals.filter(v => v > 0).length, losses: vals.filter(v => v < 0).length,
        best: vals.length ? Math.max(...vals) : 0, worst: vals.length ? Math.min(...vals) : 0,
      }
      // exposición: dedup igual que la tabla de posiciones, agrupada por símbolo
      const open = Array.isArray(j.open) ? j.open : []
      const seen = new Set<string>(); const byS: Record<string, number> = {}
      for (const p of open) {
        const k = `${p.sym}|${p.tf}|${p.direction}|${p.strategy}`
        if (seen.has(k)) continue; seen.add(k)
        const s = (p.sym ?? '?').toUpperCase(); byS[s] = (byS[s] ?? 0) + 1
      }
      const syms = Object.keys(byS).sort((a, b) => byS[b] - byS[a])
      expo = syms.map((s, i) => ({ sym: s, n: byS[s], color: SYM_COL[s] ?? PAL[i % PAL.length] }))
      totalPos = syms.reduce((s, k) => s + byS[k], 0)
    }

    function drawCal(cv: HTMLCanvasElement) {
      const x = cv.getContext('2d'); if (!x) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = 196
      if (!w) return; if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr }
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h)
      const cols = 7, gap = 6, cw = Math.min(26, (w - gap * (cols - 1)) / cols), y0 = 22
      const dow = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
      x.textAlign = 'center'; x.font = '7px ui-monospace, monospace'
      for (let c = 0; c < cols; c++) { x.fillStyle = c >= 5 ? '#454f66' : '#55607a'; x.fillText(dow[c], c * (cw + gap) + cw / 2, y0 - 7) }
      const bestV = st.best, worstV = st.worst
      for (let i = 0; i < days.length; i++) {
        const d = days[i]; if (d.blank) continue
        const c = i % cols, r = Math.floor(i / cols), bx = c * (cw + gap), by = y0 + r * (cw + gap)
        if (d.future) {
          // día que aún no llega: contorno punteado tenue + número apagado
          x.strokeStyle = 'rgba(120,132,160,0.12)'; x.lineWidth = 1; x.setLineDash([2, 3]); rrect(x, bx, by, cw, cw, 5); x.stroke(); x.setLineDash([])
          x.fillStyle = 'rgba(90,100,124,0.5)'; x.font = '7px ui-monospace, monospace'; x.textAlign = 'left'; x.fillText(String(d.day), bx + 3, by + 9)
          continue
        }
        const v = d.v, t = tint(v)
        x.fillStyle = `rgba(${t[0]},${t[1]},${t[2]},${t[3]})`; rrect(x, bx, by, cw, cw, 5); x.fill()
        x.strokeStyle = 'rgba(255,255,255,0.10)'; x.lineWidth = 1; x.beginPath(); x.moveTo(bx + 4, by + 1.5); x.lineTo(bx + cw - 4, by + 1.5); x.stroke()
        x.strokeStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); x.moveTo(bx + 4, by + cw - 1.5); x.lineTo(bx + cw - 4, by + cw - 1.5); x.stroke()
        // número del día (nítido si operó, apagado si no hubo operación)
        x.fillStyle = v != null ? 'rgba(255,255,255,0.8)' : '#5a647c'; x.font = '7px ui-monospace, monospace'; x.textAlign = 'left'; x.fillText(String(d.day), bx + 3, by + 9)
        // marco del día de hoy
        if (i === todayIdx) { x.strokeStyle = 'rgba(94,234,240,0.85)'; x.lineWidth = 1.4; rrect(x, bx - 1.5, by - 1.5, cw + 3, cw + 3, 6); x.stroke() }
        // aro de récord (mejor / peor día del mes)
        if (v != null && (v === bestV || v === worstV) && v !== 0) { x.strokeStyle = v > 0 ? '#2fd39a' : '#ff5d6c'; x.lineWidth = 1.4; rrect(x, bx - 2.5, by - 2.5, cw + 5, cw + 5, 7); x.stroke() }
      }
    }
    function drawCum(cv: HTMLCanvasElement) {
      const x = cv.getContext('2d'); if (!x) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = 92
      if (!w) return; if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr }
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h)
      let lo = Math.min(...cum), hi = Math.max(...cum); const pad = (hi - lo) * 0.15 + 0.5; lo -= pad; hi += pad
      const X = (i: number) => 2 + i / (cum.length - 1) * (w - 4), Y = (v: number) => h - 6 - (v - lo) / (hi - lo) * (h - 14)
      const up = monthPct >= 0, col = up ? '#2fd39a' : '#ff5d6c', cc = rgbOf(col)
      x.setLineDash([3, 5]); x.strokeStyle = 'rgba(148,163,196,0.2)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, Y(0)); x.lineTo(w, Y(0)); x.stroke(); x.setLineDash([])
      x.beginPath(); x.moveTo(X(0), Y(cum[0])); for (let i = 1; i < cum.length; i++) x.lineTo(X(i), Y(cum[i])); x.lineTo(X(cum.length - 1), h); x.lineTo(X(0), h); x.closePath()
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `rgba(${cc[0]},${cc[1]},${cc[2]},0.22)`); g.addColorStop(1, `rgba(${cc[0]},${cc[1]},${cc[2]},0.01)`); x.fillStyle = g; x.fill()
      x.strokeStyle = col; x.lineWidth = 1.8; x.shadowColor = col; x.shadowBlur = 5; x.beginPath()
      for (let i = 0; i < cum.length; i++) { const px = X(i), py = Y(cum[i]); if (i) x.lineTo(px, py); else x.moveTo(px, py) } x.stroke(); x.shadowBlur = 0
      const ex = X(cum.length - 1), ey = Y(monthPct); x.fillStyle = '#5eeaf0'; x.shadowColor = '#5eeaf0'; x.shadowBlur = 8; x.beginPath(); x.arc(ex, ey, 3, 0, 7); x.fill(); x.shadowBlur = 0
    }
    let tp = 0
    function drawPlasma(cv: HTMLCanvasElement) {
      const x = cv.getContext('2d'); if (!x) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = 220
      if (!w) return; if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr }
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h)
      const ox = w / 2, oy = 98, R = Math.min(64, w * 0.24)
      if (expo.length === 0 || totalPos === 0) {
        x.fillStyle = '#55607a'; x.font = '11px ui-monospace, monospace'; x.textAlign = 'center'
        x.fillText('Sin exposición activa', ox, oy)
        return
      }
      let off = 0
      for (const e of expo) {
        const c = rgbOf(e.color), a0 = off - Math.PI / 2, a1 = off + e.n / totalPos * 2 * Math.PI - Math.PI / 2; off += e.n / totalPos * 2 * Math.PI
        const nP = 8 + e.n * 7
        for (let p = 0; p < nP; p++) {
          const fp = p / nP, ang = a0 + (a1 - a0) * fp, wob = reduced ? 0 : Math.sin(p * 2.3 + tp * 0.05) * 3, rr2 = R + wob
          const px = ox + Math.cos(ang) * rr2, py = oy + Math.sin(ang) * rr2 * 0.62
          const al = 0.35 + 0.5 * Math.abs(Math.sin(p * 1.7 + tp * 0.06))
          x.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${al.toFixed(2)})`
          x.beginPath(); x.arc(px, py, 1.5 + (reduced ? 0 : Math.sin(p + tp * 0.04) * 0.6), 0, 7); x.fill()
        }
        const mid = (a0 + a1) / 2, lx = ox + Math.cos(mid) * (R + 18), ly = oy + Math.sin(mid) * (R + 18) * 0.62
        x.font = '8.5px ui-monospace, monospace'; x.textAlign = 'center'; x.fillStyle = e.color; x.fillText(`${e.sym} ${e.n}`, lx, ly + 3)
      }
      const g = x.createRadialGradient(ox - 8, oy - 8, 2, ox, oy, 24); g.addColorStop(0, '#1a2433'); g.addColorStop(1, '#070c14')
      x.fillStyle = g; x.beginPath(); x.arc(ox, oy, 24, 0, 7); x.fill()
      x.strokeStyle = 'rgba(94,234,240,0.5)'; x.lineWidth = 1.3; x.beginPath(); x.arc(ox, oy, 24, 0, 7); x.stroke()
      x.font = '700 20px "Bebas Neue", Impact, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#eef3fa'; x.fillText(String(totalPos), ox, oy + 4)
      x.font = '6px ui-monospace, monospace'; x.fillStyle = '#8b97ad'; x.fillText('POSICIONES', ox, oy + 15)
    }

    function loop() {
      const holder = root!.querySelector('.sigma-snapshot')
      if (holder) {
        const cal = holder.querySelector('.ssn-cal') as HTMLCanvasElement | null
        const cu = holder.querySelector('.ssn-cum') as HTMLCanvasElement | null
        const pl = holder.querySelector('.ssn-plasma') as HTMLCanvasElement | null
        if (cal) drawCal(cal); if (cu) drawCum(cu); if (pl) drawPlasma(pl)
        if (!reduced) tp++
      }
      raf = requestAnimationFrame(loop)
    }

    function apply() {
      const wrap = root!.querySelector('.heatmap-wrap') as HTMLElement | null
      const panel = wrap?.closest('.card-purple') as HTMLElement | null
      if (!panel || !panel.parentElement) return
      let holder = root!.querySelector('.sigma-snapshot') as HTMLElement | null
      if (!holder) {
        holder = document.createElement('div')
        holder.className = 'sigma-snapshot'
        holder.innerHTML =
          '<div class="ssn-head"><span><i></i>PERFORMANCE SNAPSHOT</span><span class="ssn-r"></span></div>' +
          '<div class="ssn-grid">' +
            '<div class="ssn-col"><div class="ssn-lbl">P&L DIARIO · CALENDARIO</div><canvas class="ssn-cal"></canvas></div>' +
            '<div class="ssn-col ssn-mid"><div class="ssn-lbl">RESULTADO DEL MES · ACUMULADO</div>' +
              '<div class="ssn-num">—</div><div class="ssn-sub"></div>' +
              '<canvas class="ssn-cum"></canvas>' +
              '<div class="ssn-micro"><div>PICO DEL MES<b class="ssn-peak"></b></div><div>VALLE<b class="ssn-valley"></b></div><div>DÍAS OPERADOS<b class="ssn-nop"></b></div></div>' +
            '</div>' +
            '<div class="ssn-col"><div class="ssn-lbl ssn-c">EXPOSICIÓN ABIERTA</div><canvas class="ssn-plasma"></canvas></div>' +
          '</div>' +
          '<div class="ssn-stats"></div>'
        panel.parentElement.insertBefore(holder, panel)
        panel.classList.add('sigma-snap-hidden')
      }
      // texto (solo cuando cambia)
      const fmtP = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
      const text = [monthLabel, monthPct, monthUsd, peak, valley, nOper, st.sharpe, st.streak, st.wins, st.losses, st.best, st.worst, expo.map(e => e.sym + e.n).join()].join('|')
      if (text === lastText) return
      lastText = text
      const set = (sel: string, v: string, color?: string) => { const el = holder!.querySelector(sel) as HTMLElement | null; if (el) { el.innerHTML = v; if (color) el.style.color = color } }
      set('.ssn-r', monthLabel)
      set('.ssn-num', `${fmtP(monthPct)}<small>este mes</small>`, monthPct >= 0 ? '#2fd39a' : '#ff5d6c')
      set('.ssn-sub', `${monthUsd >= 0 ? '+' : ''}$${Math.round(monthUsd).toLocaleString('en-US')} · cuenta del motor`)
      set('.ssn-peak', fmtP(peak), '#2fd39a'); set('.ssn-valley', fmtP(valley), valley < 0 ? '#ff5d6c' : '#8b97ad'); set('.ssn-nop', String(nOper))
      const wr = st.wins + st.losses
      const chips = [
        `SHARPE MES <b style="color:${st.sharpe >= 0 ? '#2fd39a' : '#ff5d6c'}">${st.sharpe.toFixed(2)}</b>`,
        `STREAK <b>${st.streak}d</b>`,
        `DÍAS GANADORES <b style="color:#2fd39a">${st.wins}</b>/<b style="color:#ff5d6c">${wr}</b>`,
        `MEJOR DÍA <b style="color:#2fd39a">${fmtP(st.best)}</b>`,
        `PEOR DÍA <b style="color:#ff5d6c">${fmtP(st.worst)}</b>`,
      ]
      const statsEl = holder.querySelector('.ssn-stats') as HTMLElement | null
      if (statsEl) statsEl.innerHTML = chips.map(c => `<span class="ssn-chip">${c}</span>`).join('')
    }

    async function load() {
      try {
        const r = await fetch('/api/vps/trades', { cache: 'no-store' })
        if (!r.ok) return
        compute(await r.json())
        apply()
      } catch {}
    }

    const obs = new MutationObserver(() => apply())
    obs.observe(root, { childList: true, subtree: true })
    const poll = setInterval(() => { apply(); if (root.querySelector('.sigma-snapshot')) clearInterval(poll) }, 500)
    setTimeout(() => clearInterval(poll), 20000)
    load()
    const id = setInterval(load, 60_000)
    raf = requestAnimationFrame(loop)
    return () => {
      obs.disconnect(); clearInterval(poll); clearInterval(id); cancelAnimationFrame(raf)
      root.querySelector('.sigma-snapshot')?.remove()
      root.querySelector('.card-purple.sigma-snap-hidden')?.classList.remove('sigma-snap-hidden')
    }
  }, [])

  // Monitor de equity NATIVO — la curva se dibuja en la web (SVG) con los
  // mismos datos del motor (/api/vps/trades). El canvas del motor se oculta:
  // era imposible dar contraste a sus rótulos (texto dentro de canvas, CSS no
  // lo recolorea) y su info clave exigía hover. Aquí: eje nítido en nuestra
  // paleta, glow SOLO en la línea (grupo SVG filtrado, texto fuera), puntos
  // win/loss, chip de último valor, y barra de instrumentos siempre visible.
  // REALIZADO/FLOTANTE se espejan del DOM del motor (#capital-live/#equity-float).
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    let raf = 0
    let lastSnapshot = ''
    let stats: { total?: number; win_rate?: number; profit_factor?: number; open?: number } = {}
    let hist: { pnl?: number; sym?: string; date?: string; dir?: string; tf?: string; strategy?: string; grade?: string; reason?: string }[] = []
    type TradePoint = { pct: number; win: boolean; sym: string; pnl: number; date: string; dir: string; tf: string; strategy: string; grade: string; reason: string }
    let activePts: TradePoint[] = []
    let tt: HTMLDivElement | null = null

    const fmtMoney = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const humanize = (s: string) => s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'

    function ensureTooltip(): HTMLDivElement {
      if (tt) return tt
      tt = document.createElement('div')
      tt.className = 'sigma-eq-tt'
      document.body.appendChild(tt)
      return tt
    }

    // Tarjeta de trade "de otro nivel": ancla exacta al punto (no al cursor),
    // con caret propio, barra de magnitud de PnL y datos reales del motor
    // (dirección, grade, estrategia, motivo de cierre) — reemplaza el <title>
    // nativo del navegador, que era minúsculo e ilegible.
    function showTooltip(hit: SVGElement) {
      const i = Number(hit.getAttribute('data-i'))
      const p = activePts[i]
      if (!p) return
      const rect = hit.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2

      const svgEl = hit.closest('svg.sigma-eq-chart')
      svgEl?.querySelectorAll('.eqc-dot.eqc-active').forEach(d => d.classList.remove('eqc-active'))
      svgEl?.querySelector(`.eqc-dot[data-i="${i}"]`)?.classList.add('eqc-active')

      const dirRaw = (p.dir || '').toLowerCase()
      const isLong = dirRaw === 'long', isShort = dirRaw === 'short'
      const dirLabel = isLong ? '▲ LONG' : isShort ? '▼ SHORT' : '● MANUAL'
      const dirCls = isLong ? 'long' : isShort ? 'short' : 'manual'
      const gradeColor = p.grade.startsWith('A') ? '#39e2e6' : p.grade.startsWith('B') ? '#4f92ff' : p.grade ? '#8b97ad' : '#55607a'
      const maxAbs = Math.max(1, ...activePts.map(q => Math.abs(q.pnl)))
      const barPct = Math.min(100, Math.round(Math.abs(p.pnl) / maxAbs * 100))
      const reasonMap: Record<string, string> = { TP_HIT: 'Take Profit', SL_HIT: 'Stop Loss', MANUAL_CLOSE: 'Cierre manual', TRAIL_HIT: 'Trailing stop', TIME_HIT: 'Cierre por tiempo' }
      const reasonLabel = reasonMap[p.reason] || humanize(p.reason)
      const dateLabel = (p.date || '').slice(0, 16).replace('T', ' ')

      const el = ensureTooltip()
      el.className = `sigma-eq-tt ${p.win ? 'win' : 'loss'}`
      el.innerHTML =
        `<div class="eq-tt-top"><span class="eq-tt-dir ${dirCls}">${dirLabel}</span><span class="eq-tt-grade" style="color:${gradeColor};border-color:${gradeColor}55">${esc(p.grade) || '—'}</span></div>` +
        `<div class="eq-tt-sym">${esc(p.sym)}${p.tf ? ` <small>${esc(p.tf)}</small>` : ''}</div>` +
        `<div class="eq-tt-pnl ${p.win ? 'pos' : 'neg'}">${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)}</div>` +
        `<div class="eq-tt-bar"><i style="width:${barPct}%"></i></div>` +
        `<div class="eq-tt-row"><span>${esc(humanize(p.strategy))}</span><span class="eq-tt-reason">${esc(reasonLabel)}</span></div>` +
        `<div class="eq-tt-foot"><span>${esc(dateLabel)}</span><span>acum ${p.pct >= 0 ? '+' : ''}${p.pct.toFixed(2)}%</span></div>` +
        `<i class="eq-tt-caret"></i>`

      el.style.visibility = 'hidden'
      el.style.display = 'block'
      const wTT = el.offsetWidth || 216
      const hTT = el.offsetHeight || 128
      const margin = 10
      let left = cx - wTT / 2
      left = Math.max(margin, Math.min(left, window.innerWidth - margin - wTT))
      const above = cy - hTT - 16 > 8
      el.style.top = `${above ? cy - hTT - 14 : cy + 14}px`
      el.style.left = `${left}px`
      el.classList.toggle('flip', !above)
      const caretLeft = Math.min(wTT - 16, Math.max(16, cx - left))
      const caret = el.querySelector('.eq-tt-caret') as HTMLElement | null
      if (caret) caret.style.left = `${caretLeft}px`
      el.style.visibility = 'visible'
    }

    function hideTooltip() {
      if (tt) tt.style.display = 'none'
      root!.querySelectorAll('.eqc-dot.eqc-active').forEach(d => d.classList.remove('eqc-active'))
    }

    function buildChart(wrap: HTMLElement, initial: number, floatPct: number | null) {
      if (hist.length < 2) return
      const canvas = wrap.querySelector('#equity-curve') as HTMLElement | null
      if (canvas) canvas.style.display = 'none'

      const W = Math.max(320, wrap.clientWidth - 28)
      const H = 224
      const L = 46, R = 64, T = 14, B = 20
      const iw = W - L - R, ih = H - T - B

      // Serie: % acumulado vs capital inicial, trade a trade
      let acc = initial
      const pts: TradePoint[] = hist.map(t => {
        acc += t.pnl ?? 0
        return {
          pct: ((acc - initial) / initial) * 100, win: (t.pnl ?? 0) >= 0,
          sym: t.sym ?? '', pnl: t.pnl ?? 0, date: t.date ?? '',
          dir: t.dir ?? '', tf: t.tf ?? '', strategy: t.strategy ?? '', grade: t.grade ?? '', reason: t.reason ?? '',
        }
      })
      activePts = pts
      const lastPct = pts[pts.length - 1].pct
      const floatY = floatPct != null ? lastPct + floatPct : null
      const vals = pts.map(p => p.pct).concat([0], floatY != null ? [floatY] : [])
      const lo = Math.min(...vals), hi = Math.max(...vals)
      const pad = Math.max((hi - lo) * 0.12, 1)
      const yMin = lo - pad, yMax = hi + pad
      const n = pts.length
      const X = (i: number) => L + (i / (n - 1)) * iw
      const Y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * ih

      // Ticks "bonitos" del eje: paso 1/2/5/10/25 según rango
      const span = yMax - yMin
      const step = span <= 6 ? 1 : span <= 14 ? 2 : span <= 30 ? 5 : span <= 60 ? 10 : 25
      let ticks = ''
      for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
        const y = Y(v)
        const zero = v === 0
        ticks +=
          `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="${zero ? 'rgba(139,151,173,0.3)' : 'rgba(57,226,230,0.08)'}" stroke-width="1"${zero ? ' stroke-dasharray="4 4"' : ''}/>` +
          `<text x="${L - 8}" y="${y + 3}" text-anchor="end" class="eqc-tick${zero ? ' zero' : ''}">${v > 0 ? '+' : ''}${v}%</text>`
      }
      // Mesh vertical tenue — profundidad de "mesa de operaciones" sin ruido
      let vgrid = ''
      const VCOLS = 5
      for (let c = 1; c < VCOLS; c++) {
        const x = L + (c / VCOLS) * iw
        vgrid += `<line x1="${x.toFixed(1)}" y1="${T}" x2="${x.toFixed(1)}" y2="${H - B}" stroke="rgba(148,163,196,0.05)" stroke-width="1" stroke-dasharray="1 5"/>`
      }

      // High-water mark: récord acumulado corrida a corrida (arranca en 0%,
      // el capital inicial). La cinta entre el récord y la línea real marca
      // los tramos "bajo el agua" — lectura de riesgo de un vistazo, no solo
      // de rendimiento (lenguaje de un tear-sheet cuant).
      let peak = 0
      const hwm = pts.map(p => { peak = Math.max(peak, p.pct); return peak })
      const hwmD = hwm.map((v, i) => `${i === 0 ? 'M' : 'L'} ${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')
      const ddTop = hwm.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' L ')
      const ddBottom = pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.pct).toFixed(1)}`).reverse().join(' L ')
      const ddD = `M ${ddTop} L ${ddBottom} Z`

      const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${X(i).toFixed(1)} ${Y(p.pct).toFixed(1)}`).join(' ')
      const areaD = `${lineD} L ${X(n - 1).toFixed(1)} ${Y(yMin).toFixed(1)} L ${L} ${Y(yMin).toFixed(1)} Z`
      // Cada punto en 3 capas: halo tenue (aura), cuerpo con brillo propio
      // (drop-shadow currentColor) y un destello superior tipo "gema" — más
      // presencia visual sin agrandar el hit-target real.
      const dots = pts.map((p, i) => {
        const cx = X(i).toFixed(1), cy = Y(p.pct).toFixed(1)
        const col = p.win ? '#3fb950' : '#ff5d6c'
        return `<circle cx="${cx}" cy="${cy}" r="6.5" fill="${col}" opacity="0.16" class="eqc-halo"/>` +
          `<circle cx="${cx}" cy="${cy}" r="3.6" fill="${col}" stroke="#04070f" stroke-width="1" class="eqc-dot" data-i="${i}" style="color:${col}"/>` +
          `<circle cx="${(X(i) - 1).toFixed(1)}" cy="${(Y(p.pct) - 1).toFixed(1)}" r="1" fill="#fff" opacity="0.55" class="eqc-shine"/>`
      }).join('')
      // Hit-target invisible y más grande que el punto visible: hover preciso
      // sin depender de acertarle a 2.6px de radio.
      const hitDots = pts.map((p, i) =>
        `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.pct).toFixed(1)}" r="8" fill="transparent" class="eqc-hit" data-i="${i}"/>`
      ).join('')

      const lx = X(n - 1), ly = Y(lastPct)
      // Extensión flotante: segmento punteado hasta el valor con abiertas
      const floatSeg = floatY != null
        ? `<line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${(W - R + 22).toFixed(1)}" y2="${Y(floatY).toFixed(1)}" stroke="#ffb454" stroke-width="1.6" stroke-dasharray="4 4"/><circle cx="${(W - R + 22).toFixed(1)}" cy="${Y(floatY).toFixed(1)}" r="3.4" fill="none" stroke="#ffb454" stroke-width="1.6"/>`
        : ''
      const chipCls = lastPct >= 0 ? 'pos' : 'neg'
      const chipTxt = `${lastPct >= 0 ? '+' : ''}${lastPct.toFixed(1)}%`
      const chipW = 26 + chipTxt.length * 6.4

      let svg = wrap.querySelector(':scope > svg.sigma-eq-chart') as SVGSVGElement | null
      const markup =
        `<defs>` +
          `<linearGradient id="eqcArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(57,226,230,0.22)"/><stop offset="100%" stop-color="rgba(79,146,255,0)"/></linearGradient>` +
          `<linearGradient id="eqcLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#39e2e6"/><stop offset="100%" stop-color="#4f92ff"/></linearGradient>` +
          `<radialGradient id="eqcVign" cx="50%" cy="45%" r="75%"><stop offset="0%" stop-color="rgba(57,226,230,0.05)"/><stop offset="100%" stop-color="rgba(57,226,230,0)"/></radialGradient>` +
          `<filter id="eqcGlow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="3.2" flood-color="#5eeaf0" flood-opacity="0.5"/></filter>` +
        `</defs>` +
        `<rect x="${L}" y="${T}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}" fill="url(#eqcVign)"/>` +
        `<text x="${(L + iw / 2).toFixed(1)}" y="${(T + ih / 2 + 26).toFixed(1)}" text-anchor="middle" class="eqc-wm" pointer-events="none">Σ</text>` +
        vgrid + ticks +
        `<path d="${ddD}" class="eqc-dd"/>` +
        `<path d="${areaD}" fill="url(#eqcArea)"/>` +
        `<path d="${hwmD}" class="eqc-hwm"/>` +
        `<g filter="url(#eqcGlow)"><path d="${lineD}" fill="none" stroke="url(#eqcLine)" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/></g>` +
        dots + hitDots + floatSeg +
        `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4" fill="#5eeaf0" stroke="#04070f" stroke-width="1.5"/>` +
        `<rect x="${(W - R + 6).toFixed(1)}" y="${(ly - 23).toFixed(1)}" width="${chipW.toFixed(1)}" height="19" rx="5" class="eqc-chip-bg ${chipCls}"/>` +
        `<text x="${(W - R + 6 + chipW / 2).toFixed(1)}" y="${(ly - 9.5).toFixed(1)}" text-anchor="middle" class="eqc-last ${chipCls}">${chipTxt}</text>` +
        `<text x="${L}" y="${H - 5}" class="eqc-x">${esc((pts[0].date || '').slice(0, 10))}</text>` +
        `<text x="${(W - R).toFixed(1)}" y="${H - 5}" text-anchor="end" class="eqc-x">${esc((pts[n - 1].date || '').slice(0, 10))} · ${n} trades</text>`

      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('class', 'sigma-eq-chart')
        wrap.insertBefore(svg, wrap.firstChild)
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
      svg.setAttribute('width', '100%')
      svg.setAttribute('height', String(H))
      svg.innerHTML = markup
    }

    function apply() {
      const wrap = root!.querySelector('#equity-wrap') as HTMLElement | null
      if (!wrap || !wrap.parentElement) return

      const cap      = root!.querySelector('#capital-live') as HTMLElement | null
      const initial  = Number(cap?.dataset.initial ?? 10000) || 10000
      const capVal   = Number((cap?.textContent ?? '').replace(/[^0-9.]/g, '')) || null
      const floatTxt = (root!.querySelector('#equity-float')?.textContent ?? '').trim()
      const floatPct = /^-?\d/.test(floatTxt.replace('+', '')) ? parseFloat(floatTxt.replace('%', '').replace('+', '')) : null

      // Snapshot: si nada cambió, no re-renderizar (evita bucle con el observer)
      const snap = [capVal, floatTxt, stats.total, stats.open, hist.length, wrap.clientWidth].join('|')
      const existing = wrap.parentElement.querySelector(':scope > .sigma-eq-hud') as HTMLElement | null
      if (existing && snap === lastSnapshot) return
      lastSnapshot = snap

      let bar = existing
      if (!bar) {
        bar = document.createElement('div')
        bar.className = 'sigma-eq-hud'
        wrap.parentElement.insertBefore(bar, wrap)
        // la fila vieja "Curva de Equity · N trades · flotante" queda reemplazada
        const oldHeader = wrap.previousElementSibling === bar ? bar.previousElementSibling as HTMLElement | null : null
        if (oldHeader && /curva de equity/i.test(oldHeader.textContent ?? '')) oldHeader.style.display = 'none'
      }

      const realizedPct = capVal != null ? ((capVal - initial) / initial) * 100 : null
      const wrRaw = stats.win_rate
      const wr = wrRaw == null ? null : wrRaw <= 1 ? wrRaw * 100 : wrRaw
      const cls = (v: number | null) => v == null ? '' : v >= 0 ? ' pos' : ' neg'

      bar.innerHTML =
        '<span class="eqh-title"><span class="eqh-dot"></span>EQUITY · CUENTA MOTOR</span>' +
        `<span class="eqh-item"><b>REALIZADO</b><span class="eqh-v${cls(realizedPct)}">${capVal != null ? fmtMoney(capVal) : '—'}${realizedPct != null ? ` <small>${realizedPct >= 0 ? '+' : ''}${realizedPct.toFixed(2)}%</small>` : ''}</span></span>` +
        `<span class="eqh-item"><b>FLOTANTE</b><span class="eqh-v${floatTxt.startsWith('-') ? ' neg' : ' pos'}">${floatTxt ? esc(floatTxt) : '—'}</span></span>` +
        `<span class="eqh-item"><b>TRADES</b><span class="eqh-v">${stats.total ?? '—'}${stats.open != null ? ` <small>· ${stats.open} abiertas</small>` : ''}</span></span>` +
        `<span class="eqh-item"><b>WIN RATE</b><span class="eqh-v${cls(wr == null ? null : wr - 50)}">${wr != null ? wr.toFixed(1) + '%' : '—'}</span></span>` +
        (stats.profit_factor != null ? `<span class="eqh-item"><b>PF</b><span class="eqh-v">${Number(stats.profit_factor).toFixed(2)}</span></span>` : '') +
        '<span class="eqh-legend"><i class="w"></i> win <i class="l"></i> loss <i class="f"></i> flotante <i class="h"></i> récord</span>'

      buildChart(wrap, initial, floatPct)
    }

    async function loadStats() {
      try {
        const r = await fetch('/api/vps/trades', { cache: 'no-store' })
        if (!r.ok) return
        const j = await r.json()
        stats = {
          total:         j?.stats?.total,
          win_rate:      j?.stats?.win_rate,
          profit_factor: j?.stats?.profit_factor,
          open:          Array.isArray(j?.open) ? j.open.length : undefined,
        }
        const rows: { closed_at?: string; pnl_dollar?: number; sym?: string; direction?: string; tf?: string; strategy?: string; grade?: string; reason?: string; status?: string }[] = Array.isArray(j?.history) ? j.history : []
        hist = rows
          .slice()
          .sort((a, b) => (a.closed_at ?? '').localeCompare(b.closed_at ?? ''))
          .map(t => ({
            pnl: t.pnl_dollar ?? 0, sym: (t.sym ?? '').toUpperCase(), date: t.closed_at ?? '',
            dir: t.direction ?? '', tf: t.tf && t.tf !== '?' ? t.tf : '', strategy: t.strategy ?? '',
            grade: t.grade ?? '', reason: t.reason ?? t.status ?? '',
          }))
        apply()
      } catch {}
    }

    const obs = new MutationObserver(() => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; apply() })
    })
    obs.observe(root, { childList: true, subtree: true, characterData: true })
    const onResize = () => { if (!raf) { raf = requestAnimationFrame(() => { raf = 0; apply() }) } }
    window.addEventListener('resize', onResize)

    const findHit = (e: Event) => (e.target as Element | null)?.closest?.('circle.eqc-hit') as SVGElement | null
    const onOver = (e: Event) => { const hit = findHit(e); if (hit) showTooltip(hit) }
    const onOut = (e: Event) => { const hit = findHit(e); if (hit) hideTooltip() }
    root.addEventListener('pointerover', onOver)
    root.addEventListener('pointerout', onOut)

    loadStats()
    const id = setInterval(loadStats, 60_000)
    const poll = setInterval(() => { apply(); if (root.querySelector('.sigma-eq-hud')) clearInterval(poll) }, 500)
    setTimeout(() => clearInterval(poll), 20000)
    return () => {
      obs.disconnect(); window.removeEventListener('resize', onResize); clearInterval(id); clearInterval(poll)
      if (raf) cancelAnimationFrame(raf)
      root.removeEventListener('pointerover', onOver); root.removeEventListener('pointerout', onOut)
      tt?.remove()
    }
  }, [])

  // Exposición abierta — el donut del motor solo cuenta posiciones con
  // mode=PAPER/LIVE y deja fuera las de mode=None (mostraba "1" cuando hay 5
  // abiertas). Lo recalculamos en la web desde /api/vps/trades, deduplicado
  // igual que la tabla de posiciones. No toca el motor (parche de display).
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    type Pos = { sym?: string; tf?: string; direction?: string; strategy?: string }
    let positions: Pos[] = []
    let raf = 0
    const PAL = ['#39e2e6', '#4f92ff', '#2fd39a', '#9a7bff', '#ffb454', '#ff6d7a', '#5eeaf0', '#3fb950']
    const keyOf = (p: Pos) => `${p.sym}|${p.tf}|${p.direction}|${p.strategy}`

    function buildDonut(): string {
      const n = positions.length
      if (n === 0) return '<div style="color:#8b97ad;font-size:11px;padding:12px;text-align:center">Sin posiciones abiertas</div>'
      const C = 2 * Math.PI * 40
      let off = 0
      const segs = positions.map((_, i) => {
        const len = C / n
        const dash = `${(len - 1.6).toFixed(2)} ${(C - len + 1.6).toFixed(2)}`
        const s = `<circle cx="50" cy="50" r="40" fill="transparent" stroke="${PAL[i % PAL.length]}" stroke-width="16" stroke-dasharray="${dash}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 50 50)"/>`
        off += len
        return s
      }).join('')
      const svg = `<svg viewBox="0 0 100 100" width="100" height="100" style="vertical-align:middle;filter:drop-shadow(0 0 10px rgba(57,226,230,0.25))">${segs}<text x="50" y="50" text-anchor="middle" dy=".35em" fill="#eef1f7" font-family="IBM Plex Mono" font-size="18" font-weight="700">${n}</text></svg>`
      const bySym: Record<string, { c: number; col: string }> = {}
      positions.forEach((p, i) => { const s = p.sym ?? '—'; if (!bySym[s]) bySym[s] = { c: 0, col: PAL[i % PAL.length] }; bySym[s].c++ })
      const legend = Object.entries(bySym).map(([sym, v]) =>
        `<div style="display:flex;align-items:center;gap:6px;font-size:10px;color:#aab3c2;margin:2px 0"><span style="width:10px;height:10px;background:${v.col};border-radius:2px;display:inline-block"></span>${sym} (${v.c})</div>`
      ).join('')
      return `<div style="display:flex;align-items:center;gap:16px">${svg}<div>${legend}</div></div>`
    }

    function apply() {
      const labels = Array.from(root!.querySelectorAll('div[style*="0.8px"]')) as HTMLElement[]
      const labelEl = labels.find(el => el.childElementCount === 0 && (el.textContent ?? '').trim().toLowerCase().startsWith('exposicion'))
      const holder = labelEl?.nextElementSibling as HTMLElement | null
      if (!holder) return
      if (holder.getAttribute('data-sigma-expo') === String(positions.length) && holder.querySelector('.sigma-expo-mark')) return
      holder.innerHTML = '<span class="sigma-expo-mark" style="display:none"></span>' + buildDonut()
      holder.setAttribute('data-sigma-expo', String(positions.length))
    }

    async function fetchOpen() {
      try {
        const res = await fetch('/api/vps/trades', { cache: 'no-store' })
        if (!res.ok) return
        const j = await res.json()
        const arr = (Array.isArray(j.open) ? j.open : []) as Pos[]
        const seen = new Set<string>()
        positions = arr.filter(p => { const k = keyOf(p); if (seen.has(k)) return false; seen.add(k); return true })
        apply()
      } catch { /* si falla, se deja el donut del motor */ }
    }

    fetchOpen()
    const dataInt = setInterval(fetchOpen, 30_000)
    const obs = new MutationObserver(() => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; apply() }) })
    obs.observe(root, { childList: true, subtree: true })
    return () => { clearInterval(dataInt); obs.disconnect(); if (raf) cancelAnimationFrame(raf) }
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
        @keyframes hud-dlpulse {
          0%,100% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 12px 32px -8px rgba(20,184,125,0.55), 0 0 22px rgba(46,204,113,0.18); }
          50%     { box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 12px 32px -8px rgba(20,184,125,0.6), 0 0 42px rgba(46,204,113,0.42); }
        }
        @keyframes hud-dl-breathe {
          0%,100% { box-shadow: inset 0 0 0 1px rgba(0,229,255,0.08), inset 0 0 42px -32px rgba(0,229,255,0.25); }
          50%     { box-shadow: inset 0 0 0 1px rgba(0,229,255,0.2),  inset 0 0 60px -30px rgba(0,229,255,0.45); }
        }
        @keyframes hud-dl-scanx { 0% { top: -120px; } 100% { top: 118%; } }
        @keyframes hud-dl-particle {
          0%   { transform: translateY(0);      opacity: 0; }
          18%  { opacity: 0.85; }
          82%  { opacity: 0.5; }
          100% { transform: translateY(-130px); opacity: 0; }
        }
        @keyframes hud-pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @property --dl-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        @keyframes hud-dl-orbit { to { --dl-angle: 360deg; } }
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

        /* ══ Monolito Σ — hero del HUD ══
           La tira de KPIs queda oculta pero VIVA (fuente de datos que el motor
           sigue actualizando por textContent; el hero la espeja). Si el hero
           no se monta, la tira nunca recibe esta clase y todo queda como antes. */
        #sigma-hud-root .sigma-strip-hidden { display: none !important; }

        /* ══ Colapso de onda — Risk Metrics cuánticas ══
           .risk-panel del motor oculto pero VIVO como fuente de datos;
           el canvas lo espeja (ver useEffect dedicado). */
        #sigma-hud-root .sigma-risk-hidden { display: none !important; }
        #sigma-hud-root .sigma-qwave {
          position: relative; overflow: hidden; border-radius: 16px; margin-bottom: 22px;
          background: linear-gradient(180deg, rgba(14,20,31,0.6), rgba(6,9,16,0.55));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 24px 56px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        #sigma-hud-root .sigma-qwave-cv { display: block; width: 100%; height: 250px; }

        /* ══ Performance Snapshot — 3 columnas nativas ══
           .card-purple del motor oculto pero VIVO como fuente (ver useEffect). */
        #sigma-hud-root .sigma-snap-hidden { display: none !important; }
        #sigma-hud-root .sigma-snapshot {
          border-radius: 16px; padding: 18px 20px; margin-bottom: 22px;
          background: linear-gradient(180deg, rgba(20,26,38,0.5), rgba(11,15,23,0.45));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 52px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05);
          font-family: 'IBM Plex Mono', monospace;
        }
        #sigma-hud-root .ssn-head { display: flex; align-items: center; justify-content: space-between;
          font-size: 10px; letter-spacing: 0.22em; color: #39e2e6; margin-bottom: 16px; }
        #sigma-hud-root .ssn-head span:first-child { display: inline-flex; align-items: center; gap: 10px; }
        #sigma-hud-root .ssn-head i { width: 3px; height: 12px; background: currentColor; border-radius: 1px; display: inline-block; }
        #sigma-hud-root .ssn-r { color: #55607a; letter-spacing: 0.12em; }
        #sigma-hud-root .ssn-grid { display: grid; grid-template-columns: 200px 1fr 300px; gap: 0; align-items: stretch; }
        #sigma-hud-root .ssn-col { padding: 0 22px; }
        #sigma-hud-root .ssn-col:first-child { padding-left: 0; }
        #sigma-hud-root .ssn-col:last-child { padding-right: 0; }
        #sigma-hud-root .ssn-col + .ssn-col { border-left: 1px solid rgba(255,255,255,0.06); }
        #sigma-hud-root .ssn-lbl { font-size: 9px; letter-spacing: 0.2em; color: #8b97ad; margin-bottom: 12px; }
        #sigma-hud-root .ssn-lbl.ssn-c { text-align: center; }
        #sigma-hud-root .ssn-cal, #sigma-hud-root .ssn-plasma, #sigma-hud-root .ssn-cum { display: block; width: 100%; }
        #sigma-hud-root .ssn-cal { height: 196px; } #sigma-hud-root .ssn-plasma { height: 220px; } #sigma-hud-root .ssn-cum { height: 92px; margin-top: 6px; }
        #sigma-hud-root .ssn-mid { display: flex; flex-direction: column; }
        #sigma-hud-root .ssn-num { font-family: var(--font-bebas,'Bebas Neue',Impact,sans-serif); font-size: 50px; line-height: 0.95; color: #2fd39a; letter-spacing: 0.01em; }
        #sigma-hud-root .ssn-num small { font-size: 15px; color: #8b97ad; margin-left: 8px; }
        #sigma-hud-root .ssn-sub { font-size: 11px; color: #8b97ad; margin: 6px 0 2px; }
        #sigma-hud-root .ssn-micro { display: flex; gap: 22px; margin-top: auto; padding-top: 10px; }
        #sigma-hud-root .ssn-micro div { font-size: 9px; color: #55607a; letter-spacing: 0.08em; }
        #sigma-hud-root .ssn-micro b { display: block; font-family: var(--font-bebas,'Bebas Neue',Impact,sans-serif); font-size: 16px; letter-spacing: 0.02em; margin-top: 2px; color: #dde3f5; }
        #sigma-hud-root .ssn-stats { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.06); }
        #sigma-hud-root .ssn-chip { font-size: 10px; color: #8b97ad; padding: 7px 12px; border-radius: 9px;
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008)); border: 1px solid rgba(255,255,255,0.07); }
        #sigma-hud-root .ssn-chip b { font-weight: 700; }
        @media (max-width: 900px) { #sigma-hud-root .ssn-grid { grid-template-columns: 1fr; }
          #sigma-hud-root .ssn-col { padding: 18px 0 0; } #sigma-hud-root .ssn-col + .ssn-col { border-left: none; border-top: 1px solid rgba(255,255,255,0.06); } }
        #sigma-hud-root .sigma-monolith {
          position: relative; overflow: hidden; height: 480px;
          border-radius: 18px; margin-bottom: 22px;
          background: radial-gradient(90% 70% at 50% 38%, #071019 0%, #04070d 55%, #02040a 100%);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 40px 90px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        #sigma-hud-root .sigma-mono-cv { position: absolute; inset: 0; width: 100%; height: 100%; }
        #sigma-hud-root .smh-tl { position: absolute; left: 26px; top: 24px; pointer-events: none; }
        #sigma-hud-root .smh-k { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.24em; color: #8b97ad; margin-bottom: 5px; }
        #sigma-hud-root .smh-eq { font-family: var(--font-bebas,'Bebas Neue',Impact,sans-serif); font-size: 44px; line-height: 1; color: #eef3fa; }
        #sigma-hud-root .smh-eqsub { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #5eeaf0; margin-top: 6px; }
        #sigma-hud-root .smh-r {
          position: absolute; right: 26px; top: 50%; transform: translateY(-50%);
          display: flex; flex-direction: column; gap: 18px; text-align: right; pointer-events: none;
        }
        #sigma-hud-root .smh-it { border-right: 2px solid rgba(94,234,240,0.25); padding-right: 14px; }
        #sigma-hud-root .smh-v { font-family: var(--font-bebas,'Bebas Neue',Impact,sans-serif); font-size: 21px; line-height: 1.1; }
        #sigma-hud-root .smh-s { font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: #55607a; margin-top: 2px; }
        #sigma-hud-root .smh-b {
          position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; gap: 38px;
          padding: 13px 18px; flex-wrap: wrap;
          background: linear-gradient(180deg, transparent, rgba(2,4,9,0.85) 50%);
          font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; letter-spacing: 0.18em; color: #55607a;
          pointer-events: none;
        }
        #sigma-hud-root .smh-b b { color: #8b97ad; font-weight: 400; }
        @media (max-width: 760px) {
          #sigma-hud-root .sigma-monolith { height: 560px; }
          #sigma-hud-root .smh-r { top: auto; bottom: 44px; transform: none; right: 18px; left: 18px;
            flex-direction: row; flex-wrap: wrap; gap: 12px 16px; justify-content: space-between; text-align: left; }
          #sigma-hud-root .smh-it { border-right: none; border-left: 2px solid rgba(94,234,240,0.25); padding: 0 0 0 10px; }
          #sigma-hud-root .smh-b { display: none; }
        }

        /* KPIs / risk cells / asset boxes → vidrio con hover */
        #sigma-hud-root .kpi-strip {
          background: transparent !important;
          /* panel instrumental: leve inclinacion estatica, mismo lenguaje que
             el monitor de equity — sin depender del cursor */
          transform: perspective(1400px) rotateX(1.6deg);
          transform-origin: 50% 100%;
        }
        #sigma-hud-root .kpi-card, #sigma-hud-root .risk-cell, #sigma-hud-root .asset-box {
          background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012)) !important;
          border: 1px solid rgba(255,255,255,0.07) !important;
          border-radius: 12px !important;
          transition: transform .25s ease, border-color .25s ease, background .25s ease;
        }
        /* bisel: luz arriba + sombra abajo simulando relieve fisico + la
           tarjeta "flota" sobre el fondo — solo en el kpi-strip, no en
           risk-cell/asset-box para no duplicar el efecto en toda la pagina */
        #sigma-hud-root #kpi-strip .kpi-card {
          position: relative;
          box-shadow:
            0 10px 22px rgba(0,0,0,0.35),
            inset 0 1px 0 rgba(255,255,255,0.10),
            inset 0 -10px 16px -12px rgba(0,0,0,0.5) !important;
        }
        #sigma-hud-root .kpi-card { margin: 4px !important; }
        /* Retícula HUD — marcas en L en las 4 esquinas, como un visor de
           precisión (puro CSS, 8 capas de gradiente, sin nodos extra).
           Reemplaza el intento anterior de esferas de colores por categoría:
           mismo tono cian en las 7 tarjetas, la identidad ya la da el borde
           superior — esto es la "instrumentación", no un ícono por dato. */
        #sigma-hud-root #kpi-strip .kpi-card::after {
          content: ''; position: absolute; inset: 6px; pointer-events: none;
          opacity: 0.7; transition: opacity .25s ease;
          background:
            linear-gradient(to right, rgba(94,234,240,0.55) 0 7px, transparent 7px) top left / 9px 1.4px no-repeat,
            linear-gradient(to bottom, rgba(94,234,240,0.55) 0 7px, transparent 7px) top left / 1.4px 9px no-repeat,
            linear-gradient(to left, rgba(94,234,240,0.55) 0 7px, transparent 7px) top right / 9px 1.4px no-repeat,
            linear-gradient(to bottom, rgba(94,234,240,0.55) 0 7px, transparent 7px) top right / 1.4px 9px no-repeat,
            linear-gradient(to right, rgba(94,234,240,0.55) 0 7px, transparent 7px) bottom left / 9px 1.4px no-repeat,
            linear-gradient(to top, rgba(94,234,240,0.55) 0 7px, transparent 7px) bottom left / 1.4px 9px no-repeat,
            linear-gradient(to left, rgba(94,234,240,0.55) 0 7px, transparent 7px) bottom right / 9px 1.4px no-repeat,
            linear-gradient(to top, rgba(94,234,240,0.55) 0 7px, transparent 7px) bottom right / 1.4px 9px no-repeat;
        }
        #sigma-hud-root #kpi-strip .kpi-card:hover::after { opacity: 1; }
        /* Sello Σ — monograma de marca tenue, solo en la tarjeta insignia */
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(1)::before {
          content: 'Σ'; position: absolute; right: 6px; bottom: 0px;
          font-family: var(--font-bebas, 'Bebas Neue', Impact, sans-serif);
          font-size: 58px; line-height: 1; color: rgba(57,226,230,0.09);
          pointer-events: none;
        }
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
        /* kpi-warn (Win Rate medio / régimen RANGE) sin glow propio en el motor
           — se lo damos para que no rompa la consistencia del resto de KPIs */
        #sigma-hud-root .kpi-warn { text-shadow: 0 0 16px currentColor !important; }
        #sigma-hud-root .cell-ok { text-shadow: 0 0 10px rgba(47,211,154,0.45); }

        /* Acento de categoría por tarjeta del KPI strip: lectura rápida por
           posición, independiente del color dinámico del valor (pos/neg/warn).
           Régimen queda neutro: su propio valor ya cambia de color solo. */
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(1) { border-top: 2px solid rgba(57,226,230,0.4) !important; }
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(2) { border-top: 2px solid rgba(63,185,80,0.4) !important; }
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(3) { border-top: 2px solid rgba(255,180,84,0.4) !important; }
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(4) { border-top: 2px solid rgba(245,158,11,0.4) !important; }
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(5) { border-top: 2px solid rgba(79,146,255,0.4) !important; }
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(6) { border-top: 2px solid rgba(148,163,196,0.22) !important; }
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(7) { border-top: 2px solid rgba(167,139,250,0.4) !important; }
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(1):hover { border-color: rgba(57,226,230,0.55) !important; }
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(2):hover { border-color: rgba(63,185,80,0.55) !important; }
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(3):hover { border-color: rgba(255,180,84,0.55) !important; }
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(4):hover { border-color: rgba(245,158,11,0.55) !important; }
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(5):hover { border-color: rgba(79,146,255,0.55) !important; }
        #sigma-hud-root #kpi-strip .kpi-card:nth-child(7):hover { border-color: rgba(167,139,250,0.55) !important; }

        /* Régimen BTC — caret direccional + grabado del animal de fondo
           (ver useEffect dedicado; reemplaza emoji/constelación/line-icon) */
        #sigma-hud-root #kpi-regime { display: inline-flex; align-items: baseline; gap: 8px; }
        #sigma-hud-root .regime-caret { font-size: 0.62em; opacity: 0.9; filter: drop-shadow(0 0 6px currentColor); }
        #sigma-hud-root .regime-txt { font-weight: 700; letter-spacing: 0.04em; }
        /* watermark del régimen: DETRÁS del texto, sangra por el borde derecho.
           Dos variantes — .rb-photo (foto duotono, BEAR) y .rb-vec (grabado
           vectorial, BULL/RANGE de fallback). */
        #sigma-hud-root #kpi-strip .kpi-card.regime-card { overflow: hidden; }
        #sigma-hud-root .regime-bg {
          position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
        }
        /* — grabado vectorial (BULL/RANGE) — */
        #sigma-hud-root .regime-bg.rb-vec {
          opacity: 0.22; transition: opacity .3s ease;
          -webkit-mask-image: linear-gradient(100deg, transparent 8%, #000 62%);
                  mask-image: linear-gradient(100deg, transparent 8%, #000 62%);
        }
        #sigma-hud-root .regime-bg.rb-vec svg {
          position: absolute; right: -16px; top: 50%; transform: translateY(-50%);
          height: 138%; width: auto; filter: drop-shadow(0 0 10px currentColor);
        }
        #sigma-hud-root .kpi-card.regime-card:hover .regime-bg.rb-vec { opacity: 0.32; }
        /* — foto duotono (BEAR) — */
        /* campo de color: la mitad derecha bañada en el color del régimen +
           halo sobre la cara — el animal resalta al máximo y la tarjeta entera
           comunica el estado del mercado con el color (elegido sobre comparador).
           Vive DEBAJO del <img>, así nunca toca los números. */
        #sigma-hud-root .regime-bg.rb-bear {
          background:
            radial-gradient(58% 74% at 82% 46%, rgba(255,93,108,0.13) 0%, transparent 66%),
            linear-gradient(90deg, transparent 36%, rgba(120,16,30,0.28) 66%, rgba(139,18,34,0.55) 100%);
        }
        #sigma-hud-root .regime-bg.rb-bull {
          background:
            radial-gradient(58% 74% at 82% 46%, rgba(94,234,240,0.13) 0%, transparent 66%),
            linear-gradient(90deg, transparent 36%, rgba(10,70,78,0.30) 66%, rgba(12,86,94,0.55) 100%);
        }
        /* encuadre: la CABEZA completa (oreja+ojo+hocico) dentro de la tarjeta
           — validado sobre las medidas reales; el fade hacia el texto es corto
           porque el asset ya es solo la cabeza */
        #sigma-hud-root .regime-bg .regime-photo {
          position: absolute; right: 3%; top: -6%;
          height: 115%; width: auto; opacity: 0.55; transition: opacity .3s ease;
          -webkit-mask-image: linear-gradient(100deg, transparent 0%, #000 42%);
                  mask-image: linear-gradient(100deg, transparent 0%, #000 42%);
        }
        #sigma-hud-root .kpi-card.regime-card:hover .regime-bg .regime-photo { opacity: 0.66; }
        /* scrim: blinda el área del texto (izquierda) de la foto */
        #sigma-hud-root .regime-bg .regime-scrim {
          position: absolute; inset: 0;
          background: linear-gradient(90deg, rgba(4,6,12,0.82) 0%, rgba(4,6,12,0.34) 34%, transparent 60%);
        }
        /* el texto del régimen por encima del grabado */
        #sigma-hud-root .kpi-card.regime-card .kpi-label,
        #sigma-hud-root .kpi-card.regime-card .kpi-value,
        #sigma-hud-root .kpi-card.regime-card .kpi-sub { position: relative; z-index: 1; }

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
          /* tilt estático suave — sin "enderezarse" al hover: la lectura del
             gráfico ya no depende de poner el cursor encima (2026-07-11) */
          transform: perspective(1200px) rotateX(2deg);
          transform-origin: 50% 100%;
        }

        /* ── Barra de instrumentos del equity: la info clave SIEMPRE visible ── */
        #sigma-hud-root .sigma-eq-hud {
          display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px;
          padding: 10px 16px; margin: 2px 0 10px;
          background: linear-gradient(90deg, rgba(57,226,230,0.06), rgba(255,255,255,0.015) 55%);
          border: 1px solid rgba(57,226,230,0.18); border-radius: 12px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 18px rgba(0,0,0,0.3);
          font-family: 'IBM Plex Mono', monospace;
        }
        #sigma-hud-root .eqh-title { display: inline-flex; align-items: center; gap: 7px;
          font-size: 9px; letter-spacing: 0.22em; color: #5eeaf0; margin-right: 4px; white-space: nowrap; }
        #sigma-hud-root .eqh-dot { width: 6px; height: 6px; border-radius: 50%; background: #3fb950;
          box-shadow: 0 0 8px #3fb950; animation: eqhPulse 1.6s ease-in-out infinite; }
        @keyframes eqhPulse { 50% { opacity: 0.35 } }
        #sigma-hud-root .eqh-item { display: inline-flex; align-items: baseline; gap: 7px; white-space: nowrap; }
        #sigma-hud-root .eqh-item b { font-size: 8px; letter-spacing: 0.18em; color: #6b7688; font-weight: 600; }
        #sigma-hud-root .eqh-v { font-size: 14px; font-weight: 700; color: #dde3f5;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
        #sigma-hud-root .eqh-v small { font-size: 10px; font-weight: 600; opacity: 0.85; }
        #sigma-hud-root .eqh-v.pos { color: #3fb950; }
        #sigma-hud-root .eqh-v.neg { color: #ff5d6c; }
        /* Neón de la curva CONTENIDO: los drop-shadow del canvas afectan a TODO
           lo dibujado — incluidos los rótulos del eje (+5%/+10%/…), que con
           tres halos apilados quedaban difuminados. Un solo halo tenue mantiene
           el carácter de la línea y deja los números nítidos (fix 2026-07-11:
           en un gráfico de ganancias/pérdidas la legibilidad manda). */
        #sigma-hud-root #equity-curve {
          background: transparent !important;
          border-radius: 10px !important;
          filter: saturate(1.18) brightness(1.1) drop-shadow(0 0 5px rgba(94,234,240,0.35));
        }
        /* (la viñeta/grid overlay se eliminó: el chart SVG nativo trae su propia
           grilla y cualquier capa encima volvía a apagar los rótulos del eje) */

        /* ── Chart SVG nativo del equity: texto SIEMPRE nítido (fuera del grupo
           con glow — el filtro solo envuelve la línea) ── */
        #sigma-hud-root .sigma-eq-chart { display: block; }
        #sigma-hud-root .sigma-eq-chart .eqc-tick { font-family: 'IBM Plex Mono', monospace; font-size: 10px; fill: #8b97ad; }
        #sigma-hud-root .sigma-eq-chart .eqc-tick.zero { fill: #aab3c2; }
        #sigma-hud-root .sigma-eq-chart .eqc-last { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 800; }
        #sigma-hud-root .sigma-eq-chart .eqc-last.pos { fill: #3fb950; }
        #sigma-hud-root .sigma-eq-chart .eqc-last.neg { fill: #ff5d6c; }
        #sigma-hud-root .sigma-eq-chart .eqc-chip-bg { stroke-width: 1; }
        #sigma-hud-root .sigma-eq-chart .eqc-chip-bg.pos { fill: rgba(63,185,80,0.14); stroke: rgba(63,185,80,0.45); }
        #sigma-hud-root .sigma-eq-chart .eqc-chip-bg.neg { fill: rgba(255,93,108,0.14); stroke: rgba(255,93,108,0.45); }
        #sigma-hud-root .sigma-eq-chart .eqc-x { font-family: 'IBM Plex Mono', monospace; font-size: 9px; fill: #55607a; letter-spacing: 0.05em; }
        /* Watermark Σ — misma firma visual que el resto de gráficos de la web */
        #sigma-hud-root .sigma-eq-chart .eqc-wm {
          font-family: var(--font-bebas,'Bebas Neue',Impact,sans-serif); font-size: 110px; fill: rgba(57,226,230,0.045);
        }
        /* High-water-mark: récord acumulado + cinta "bajo el agua" — el mismo
           lenguaje de un tear-sheet cuant, para leer riesgo y no solo retorno */
        #sigma-hud-root .sigma-eq-chart .eqc-hwm {
          fill: none; stroke: rgba(255,180,84,0.4); stroke-width: 1; stroke-dasharray: 3 3;
        }
        #sigma-hud-root .sigma-eq-chart .eqc-dd { fill: rgba(255,93,108,0.08); }
        #sigma-hud-root .sigma-eq-chart .eqc-dot { transition: r 0.12s ease, filter 0.12s ease; filter: drop-shadow(0 0 3px currentColor); }
        #sigma-hud-root .sigma-eq-chart .eqc-dot.eqc-active { r: 6.4px; filter: drop-shadow(0 0 9px currentColor); }
        #sigma-hud-root .sigma-eq-chart .eqc-halo, #sigma-hud-root .sigma-eq-chart .eqc-shine { pointer-events: none; }
        #sigma-hud-root .sigma-eq-chart .eqc-hit { cursor: pointer; }

        /* ── Tarjeta de trade al hover: ancla al punto, no al cursor ── */
        .sigma-eq-tt {
          position: fixed; z-index: 10000; width: 216px;
          padding: 12px 14px 10px;
          background: linear-gradient(165deg, rgba(12,18,30,0.97), rgba(4,7,14,0.98));
          border: 1px solid rgba(148,163,196,0.16);
          border-radius: 12px;
          box-shadow: 0 18px 46px rgba(0,0,0,0.55);
          backdrop-filter: blur(10px);
          font-family: 'IBM Plex Mono', monospace;
          pointer-events: none;
          display: none;
        }
        .sigma-eq-tt.win { border-left: 3px solid #3fb950; box-shadow: 0 18px 46px rgba(0,0,0,0.55), -4px 0 20px rgba(63,185,80,0.16); }
        .sigma-eq-tt.loss { border-left: 3px solid #ff5d6c; box-shadow: 0 18px 46px rgba(0,0,0,0.55), -4px 0 20px rgba(255,93,108,0.16); }
        .sigma-eq-tt .eq-tt-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
        .sigma-eq-tt .eq-tt-dir { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; }
        .sigma-eq-tt .eq-tt-dir.long { color: #3fb950; }
        .sigma-eq-tt .eq-tt-dir.short { color: #ffb454; }
        .sigma-eq-tt .eq-tt-dir.manual { color: #8b97ad; }
        .sigma-eq-tt .eq-tt-grade { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 5px; border: 1px solid; }
        .sigma-eq-tt .eq-tt-sym { font-size: 15px; font-weight: 700; color: #eef1f7; margin-bottom: 2px; }
        .sigma-eq-tt .eq-tt-sym small { font-size: 10px; font-weight: 600; color: #6b7688; margin-left: 4px; }
        .sigma-eq-tt .eq-tt-pnl { font-size: 19px; font-weight: 800; margin: 2px 0 7px; }
        .sigma-eq-tt .eq-tt-pnl.pos { color: #3fb950; }
        .sigma-eq-tt .eq-tt-pnl.neg { color: #ff5d6c; }
        .sigma-eq-tt .eq-tt-bar { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.06); overflow: hidden; margin-bottom: 8px; }
        .sigma-eq-tt .eq-tt-bar i { display: block; height: 100%; border-radius: 2px; background: linear-gradient(90deg,#39e2e6,#4f92ff); }
        .sigma-eq-tt.loss .eq-tt-bar i { background: linear-gradient(90deg,#ff5d6c,#ffb454); }
        .sigma-eq-tt .eq-tt-row { display: flex; justify-content: space-between; gap: 8px; font-size: 9.5px; color: #aab3c2; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sigma-eq-tt .eq-tt-reason { color: #6b7688; flex-shrink: 0; }
        .sigma-eq-tt .eq-tt-foot { display: flex; justify-content: space-between; font-size: 9px; color: #55607a; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px; }
        .sigma-eq-tt .eq-tt-caret {
          position: absolute; bottom: -6px; width: 12px; height: 12px;
          background: #0a0e18; transform: translateX(-50%) rotate(45deg);
          border-right: 1px solid rgba(148,163,196,0.16); border-bottom: 1px solid rgba(148,163,196,0.16);
        }
        .sigma-eq-tt.flip .eq-tt-caret {
          bottom: auto; top: -6px;
          border-right: none; border-bottom: none;
          border-left: 1px solid rgba(148,163,196,0.16); border-top: 1px solid rgba(148,163,196,0.16);
        }
        #sigma-hud-root .eqh-legend { margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
          font-size: 9px; color: #6b7688; letter-spacing: 0.06em; white-space: nowrap; }
        #sigma-hud-root .eqh-legend i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
        #sigma-hud-root .eqh-legend i.w { background: #3fb950; }
        #sigma-hud-root .eqh-legend i.l { background: #ff5d6c; }
        #sigma-hud-root .eqh-legend i.f { background: transparent; border: 1.5px solid #ffb454; }
        #sigma-hud-root .eqh-legend i.h { background: none; border-radius: 0; width: 10px; height: 0;
          border-top: 1.5px dashed rgba(255,180,84,0.7); }
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

        /* ══ 9. Matrices M1–M4 — terminal institucional ══ */
        /* Nada se mueve: la matriz responde como instrumento (crosshair de
           fila+columna con spotlight, jerarquía de luminancia por estado). */
        #sigma-hud-root .matrix th {
          color: #8b97ad !important; letter-spacing: 0.2em !important;
          border-bottom: 1px solid rgba(57,226,230,0.16) !important;
        }
        /* nada de saltos: se anula el translateY del motor y cualquier pop */
        #sigma-hud-root .matrix td, #sigma-hud-root .matrix td:not(.asset-col):hover {
          transform: none !important;
        }
        #sigma-hud-root .matrix td {
          position: relative;
          transition: filter .25s ease, box-shadow .25s ease !important;
        }
        /* Las matrices NO viven en tarjeta: mesa abierta sobre el fondo,
           overflow libre para que tooltips y detalles nunca se recorten */
        #sigma-hud-root [id^="matrix-section"].card {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          border-radius: 0 !important;
          overflow: visible !important;
          padding-left: 0 !important; padding-right: 0 !important;
        }
        #sigma-hud-root [id^="matrix-section"].card::before,
        #sigma-hud-root [id^="matrix-section"].card::after { display: none !important; }
        #sigma-hud-root [id^="matrix-section"].card:hover {
          transform: none !important; border: none !important; box-shadow: none !important;
        }
        #sigma-hud-root .matrix td { overflow: visible !important; }

        /* LEGIBILIDAD: los detalles oscuros del motor ahora se leen.
           'estimado (…)', leyendas y subtextos venían en #555/#444 sobre
           oscuro; 'En cola' en un azul casi negro. */
        #sigma-hud-root [style*="color:#555"] { color: #7e8aa0 !important; }
        #sigma-hud-root [style*="color:#444"] { color: #6b7688 !important; }
        #sigma-hud-root .cell-sub { color: #8b97ad !important; }
        #sigma-hud-root .cell-pending {
          color: #5f6a7d !important;
          border-color: rgba(120,135,160,0.35) !important;
        }
        /* franja COMBINED dentro del campeón: definida y legible */
        #sigma-hud-root .matrix [style*="rgba(88,166,255,.05)"] {
          background: rgba(88,166,255,0.1) !important;
          border: 1px solid rgba(88,166,255,0.22) !important;
          border-radius: 6px !important;
          padding: 3px 6px !important;
        }

        /* INSPECTOR HUD — panel fijo que amplía la celda campeón al hover */
        #hud-inspector {
          position: fixed; right: 340px; top: 50%;
          transform: translateY(-50%) translateX(10px);
          width: 330px; z-index: 95; pointer-events: none;
          opacity: 0; transition: opacity .22s ease, transform .28s cubic-bezier(.2,.6,.2,1);
          background: linear-gradient(180deg, rgba(16,24,36,0.94), rgba(8,12,20,0.95));
          border: 1px solid rgba(57,226,230,0.35);
          border-radius: 14px; padding: 14px 16px;
          box-shadow: 0 26px 70px rgba(0,0,0,0.7), 0 0 32px rgba(57,226,230,0.13), inset 0 1px 0 rgba(255,255,255,0.07);
          backdrop-filter: blur(10px);
        }
        #hud-inspector.on { opacity: 1; transform: translateY(-50%) translateX(0); }
        #hud-inspector .insp-head {
          display: flex; justify-content: space-between; align-items: center;
          font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700;
          color: #39e2e6; letter-spacing: 0.22em; text-transform: uppercase;
          border-bottom: 1px solid rgba(57,226,230,0.22);
          padding-bottom: 8px; margin-bottom: 10px;
          text-shadow: 0 0 12px rgba(57,226,230,0.35);
        }
        /* zoom real: amplía también los tamaños inline del motor */
        #hud-inspector .insp-body { zoom: 1.9; }
        /* nota educativa de la estrategia, bajo el detalle ampliado */
        #hud-inspector .insp-notes {
          margin-top: 12px; padding-top: 10px;
          border-top: 1px dashed rgba(57,226,230,0.25);
          display: flex; flex-direction: column; gap: 8px;
        }
        #hud-inspector .insp-note {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px; line-height: 1.6; color: #8b97ad;
          letter-spacing: 0.02em;
        }
        #hud-inspector .insp-note b {
          color: #39e2e6; font-weight: 700;
          text-shadow: 0 0 10px rgba(57,226,230,0.3);
        }
        /* legibilidad dentro del inspector (vive fuera de #sigma-hud-root) */
        #hud-inspector [style*="color:#555"] { color: #8b97ad !important; }
        #hud-inspector [style*="color:#444"] { color: #7e8aa0 !important; }
        #hud-inspector .cell-sub { color: #9aa4b6 !important; }
        #hud-inspector [style*="rgba(88,166,255,.05)"] {
          background: rgba(88,166,255,0.1) !important;
          border: 1px solid rgba(88,166,255,0.22) !important;
          border-radius: 6px !important; padding: 3px 6px !important;
        }
        @media (max-width: 1500px) { #hud-inspector { right: 24px; width: 300px; } }
        @media (max-width: 1100px) { #hud-inspector { display: none; } }

        /* CROSSHAIR — fila iluminada, el resto de la matriz se atenúa */
        #sigma-hud-root .matrix tbody:hover tr:not(:hover) td {
          filter: brightness(0.55) saturate(0.75);
        }
        #sigma-hud-root .matrix tbody tr:hover td { filter: brightness(1.15); }
        #sigma-hud-root .matrix tbody tr:hover .asset-box {
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 0 20px -6px var(--asset-color, rgba(57,226,230,0.5)) !important;
        }
        /* LISTO: vidrio verde encendido (luminancia alta) */
        #sigma-hud-root .matrix td.cell-ok, #sigma-hud-root .cell-ok {
          border-radius: 10px !important;
          background: linear-gradient(180deg, rgba(18,52,36,0.85), rgba(8,26,18,0.9)) !important;
          border: 1px solid rgba(46,204,113,0.22) !important;
          box-shadow:
            inset 0 1px 0 rgba(120,255,190,0.16),
            inset 0 -8px 14px -10px rgba(0,0,0,0.7),
            0 4px 10px -6px rgba(0,0,0,0.65),
            0 10px 22px -14px rgba(46,204,113,0.35) !important;
        }
        #sigma-hud-root .matrix td.cell-ok:hover {
          box-shadow:
            inset 0 1px 0 rgba(120,255,190,0.22),
            0 4px 10px -6px rgba(0,0,0,0.65),
            0 0 24px rgba(46,204,113,0.28) !important;
        }
        /* OPTIMIZANDO: respiración cian (luminancia media) */
        #sigma-hud-root .matrix td.cell-run, #sigma-hud-root .cell-run {
          border-radius: 10px !important;
          animation: hud-optpulse 2.4s ease-in-out infinite;
        }
        #sigma-hud-root .matrix td.cell-run:hover {
          animation: none;
          box-shadow: inset 0 0 0 1px rgba(57,226,230,0.5), 0 0 22px rgba(57,226,230,0.25) !important;
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
        #sigma-hud-root #matrix-section-m5.card { border-color: rgba(167,139,250,0.35) !important; }
        #sigma-hud-root #matrix-section-m5.card::before { background: linear-gradient(90deg, #a78bfa, rgba(167,139,250,0.35) 50%, transparent 85%); }

        /* ══ 10. Franjas bajo las matrices — consola de cierre (sobrio) ══ */
        /* resumen "Portafolio operable": franja principal con rail cian */
        #sigma-hud-root .matrix tr[style*="#060d20"] > td[colspan]:not([style*="dashed"]) {
          background: linear-gradient(90deg, rgba(57,226,230,0.05), rgba(255,255,255,0.012) 60%) !important;
          border-top: 1px solid rgba(57,226,230,0.16) !important;
          border-left: 3px solid rgba(57,226,230,0.45) !important;
          padding: 14px 18px !important;
          line-height: 2.1 !important;
          border-radius: 10px 10px 0 0;
        }
        /* Activos 15/20 legible: texto cian con peso (antes tapado por bug) */
        #sigma-hud-root .matrix td[colspan] span[style*="color:#c9a227"] {
          color: #39e2e6 !important; font-weight: 700 !important;
          text-shadow: 0 0 10px rgba(57,226,230,0.35);
        }
        /* delta "CAGR ponderado vivo": log secundario, discreto */
        #sigma-hud-root .matrix tr[style*="#060d20"] > td[colspan][style*="dashed"] {
          background: rgba(255,255,255,0.012) !important;
          border-top: 1px dashed rgba(255,255,255,0.09) !important;
          border-left: 3px solid rgba(255,255,255,0.08) !important;
          padding: 10px 16px !important;
          color: #6b7688 !important;
          line-height: 1.9 !important;
        }
        /* advertencia "muestra chica": ámbar refinado con cierre redondeado */
        #sigma-hud-root .matrix tr[style*="#1c1410"] > td {
          background: linear-gradient(90deg, rgba(255,171,64,0.09), rgba(255,171,64,0.02) 70%) !important;
          border-top: 1px solid rgba(255,171,64,0.22) !important;
          border-left: 3px solid rgba(255,171,64,0.55) !important;
          padding: 10px 16px !important;
          color: #ffbe66 !important;
          letter-spacing: 0.06em;
          border-radius: 0 0 10px 10px;
        }

        /* ══ 11. Sala de estrategia — secciones inferiores del HUD ══ */
        /* ROADMAP M5-M8: bahías de hangar en construcción + línea de pipeline */
        #sigma-hud-root .card div[style*="minmax(195px"] { position: relative; }
        #sigma-hud-root .card div[style*="minmax(195px"]::before {
          content: ''; position: absolute; left: -6px; right: -6px; top: 50%; height: 2px;
          background: linear-gradient(90deg, rgba(57,226,230,0.28), rgba(57,226,230,0.04));
          z-index: 0; border-radius: 2px;
        }
        #sigma-hud-root .card div[style*="minmax(195px"] > div { position: relative; z-index: 1; }
        #sigma-hud-root div[style*="rgba(201,162,39,.035)"] {
          background:
            repeating-linear-gradient(45deg, rgba(255,255,255,0.014) 0 12px, transparent 12px 24px),
            linear-gradient(180deg, rgba(20,26,38,0.6), rgba(10,14,22,0.55)) !important;
          border: 1px dashed rgba(57,226,230,0.22) !important;
          border-radius: 12px !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          transition: border-color .25s ease, transform .25s ease;
        }
        #sigma-hud-root div[style*="rgba(201,162,39,.035)"]:hover {
          border-color: rgba(57,226,230,0.45) !important;
          transform: translateY(-2px);
        }

        /* Blotter universal para tablas .t (detalle BTC, walk-forward, VPS) */
        #sigma-hud-root table.t th {
          color: #8b97ad !important; letter-spacing: 0.18em !important;
          border-bottom: 1px solid rgba(57,226,230,0.16) !important;
        }
        #sigma-hud-root table.t td {
          padding: 9px 10px !important;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        #sigma-hud-root table.t tbody tr { transition: background .2s ease; }
        #sigma-hud-root table.t tbody tr:nth-child(even) { background: rgba(255,255,255,0.015); }
        #sigma-hud-root table.t tbody tr:hover { background: rgba(57,226,230,0.05); }
        /* rail de veredicto: fila con ✓ verde / ✗ roja en su última celda */
        #sigma-hud-root table.t tbody tr:has(> td:last-child[style*="#2ecc71"]) > td:first-child { border-left: 3px solid rgba(46,204,113,0.5); }
        #sigma-hud-root table.t tbody tr:has(> td:last-child[style*="#e74c3c"]) > td:first-child { border-left: 3px solid rgba(231,76,60,0.5); }

        /* CROSS-ASSET: tiles como lámparas de signo */
        #sigma-hud-root .card div[style*="min-width:90px"] {
          border-radius: 12px !important;
          border: 1px solid rgba(255,255,255,0.07);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px -12px rgba(0,0,0,0.7);
          transition: transform .25s ease, border-color .25s ease;
        }
        #sigma-hud-root .card div[style*="min-width:90px"]:hover { transform: translateY(-2px); }
        #sigma-hud-root .card div[style*="min-width:90px"]:has([style*="#2ecc71"]) {
          background: radial-gradient(120% 100% at 50% 0%, rgba(46,204,113,0.13), rgba(255,255,255,0.015) 65%) !important;
          border-color: rgba(46,204,113,0.25);
        }
        #sigma-hud-root .card div[style*="min-width:90px"]:has([style*="#e74c3c"]) {
          background: radial-gradient(120% 100% at 50% 0%, rgba(231,76,60,0.12), rgba(255,255,255,0.015) 65%) !important;
          border-color: rgba(231,76,60,0.25);
        }
        #sigma-hud-root .card div[style*="min-width:90px"]:has([style*="#f1c40f"]) {
          background: radial-gradient(120% 100% at 50% 0%, rgba(57,226,230,0.11), rgba(255,255,255,0.015) 65%) !important;
          border-color: rgba(57,226,230,0.25);
        }
        #sigma-hud-root .card div[style*="min-width:90px"] div[style*="font-size:18px"] { text-shadow: 0 0 12px currentColor; }

        /* VPS: contadores del optimizador como odómetros */
        #sigma-hud-root .tf-pill {
          background: rgba(57,226,230,0.05) !important;
          border: 1px solid rgba(57,226,230,0.18) !important;
          border-radius: 8px !important;
          padding: 6px 12px !important;
          transition: border-color .2s ease;
        }
        #sigma-hud-root .tf-pill:hover { border-color: rgba(57,226,230,0.4) !important; }
        #sigma-hud-root .tf-pill b {
          color: #5eeaf0 !important;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 0 10px rgba(57,226,230,0.35);
        }

        /* ══ 12. Vitrina de descargas — mini-dashboard TradingView (DOM reconstruido) ══ */
        /* la card contenedora: panel oscuro FinTech, sin brackets/rail genéricos */
        #sigma-hud-root .card:has(.sigma-dl) {
          background: linear-gradient(180deg, #0A1220, #070B14) !important;
          border: 1px solid rgba(0,229,255,0.18) !important;
          padding: 0 !important; overflow: hidden;
        }
        #sigma-hud-root .card:has(.sigma-dl)::before,
        #sigma-hud-root .card:has(.sigma-dl)::after { display: none !important; }

        #sigma-hud-root .sigma-dl {
          position: relative; overflow: hidden; padding: 32px 26px 26px;
          border-radius: inherit; animation: hud-dl-breathe 6.5s ease-in-out infinite;
        }
        /* grid técnico + líneas horizontales muy sutiles (TradingView) */
        #sigma-hud-root .sigma-dl::before {
          content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background:
            linear-gradient(rgba(0,229,255,0.05) 1px, transparent 1px) 0 0 / 100% 34px,
            linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px) 0 0 / 46px 100%;
          mask-image: radial-gradient(ellipse 100% 82% at 50% 42%, black, transparent 88%);
          -webkit-mask-image: radial-gradient(ellipse 100% 82% at 50% 42%, black, transparent 88%);
        }
        #sigma-hud-root .sigma-dl-bg { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; filter: none !important; }
        #sigma-hud-root .sigma-dl-scanline {
          position: absolute; left: 0; right: 0; top: -120px; height: 120px; z-index: 1; pointer-events: none;
          background: linear-gradient(180deg, transparent, rgba(0,229,255,0.055), transparent);
          animation: hud-dl-scanx 7.5s linear infinite;
        }
        #sigma-hud-root .sigma-dl-particle {
          position: absolute; width: 3px; height: 3px; border-radius: 50%; z-index: 1; pointer-events: none;
          background: rgba(0,229,255,0.7); box-shadow: 0 0 8px rgba(0,229,255,0.9);
          animation: hud-dl-particle 9s ease-in-out infinite;
        }
        #sigma-hud-root .sigma-dl-inner { position: relative; z-index: 2; }

        #sigma-hud-root .sigma-dl-head { text-align: center; margin-bottom: 22px; }
        #sigma-hud-root .sigma-dl-eyebrow {
          font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.28em;
          color: #00E5FF; text-transform: uppercase; text-shadow: 0 0 12px rgba(0,229,255,0.4);
        }
        #sigma-hud-root .sigma-dl-title {
          font-family: 'IBM Plex Mono', monospace; font-size: 23px; font-weight: 800;
          letter-spacing: 0.01em; color: #F8FAFC; margin: 10px 0 8px; line-height: 1.1;
        }
        #sigma-hud-root .sigma-dl-sub { color: #94A3B8; font-size: 13px; line-height: 1.7; max-width: 560px; margin: 0 auto; }
        #sigma-hud-root .sigma-dl-sub strong { color: #F8FAFC; }

        #sigma-hud-root .sigma-dl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 720px; margin: 0 auto; }
        #sigma-hud-root .sigma-dl-grid.single { grid-template-columns: minmax(280px, 440px); justify-content: center; }
        #sigma-hud-root .sigma-dl-card {
          position: relative; text-align: left; overflow: hidden;
          background: linear-gradient(180deg, #151F2F, #111827);
          border: 1px solid rgba(0,229,255,0.18); border-radius: 16px; padding: 18px;
          box-shadow: 0 14px 34px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04);
          transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
        }
        #sigma-hud-root .sigma-dl-card::before {
          content: ''; position: absolute; inset: 0 0 auto 0; height: 2px;
          background: linear-gradient(90deg, transparent, var(--dlacc), transparent);
        }
        #sigma-hud-root .sigma-dl-card.engine   { --dlacc: #22C55E; }
        #sigma-hud-root .sigma-dl-card.terminal { --dlacc: #00E5FF; }
        #sigma-hud-root .sigma-dl-card:hover {
          transform: translateY(-4px) scale(1.015);
          border-color: color-mix(in srgb, var(--dlacc) 55%, transparent);
          box-shadow: 0 22px 50px -14px rgba(0,0,0,0.7), 0 0 26px -6px var(--dlacc), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        #sigma-hud-root .sigma-dl-card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        #sigma-hud-root .sigma-dl-ico {
          width: 42px; height: 42px; flex-shrink: 0; display: grid; place-items: center; font-size: 20px;
          border-radius: 12px; background: color-mix(in srgb, var(--dlacc) 12%, #0A1220);
          border: 1px solid color-mix(in srgb, var(--dlacc) 32%, transparent);
          box-shadow: inset 0 0 14px -5px var(--dlacc);
        }
        #sigma-hud-root .sigma-dl-id { flex: 1; display: flex; flex-direction: column; }
        #sigma-hud-root .sigma-dl-id b { color: #F8FAFC; font-size: 15px; font-weight: 700; letter-spacing: 0.03em; }
        #sigma-hud-root .sigma-dl-id .ver { color: #94A3B8; font-size: 11px; font-family: 'IBM Plex Mono', monospace; margin-top: 2px; }
        #sigma-hud-root .sigma-dl-status {
          font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 700; letter-spacing: 0.14em;
          color: var(--dlacc); background: color-mix(in srgb, var(--dlacc) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--dlacc) 35%, transparent);
          padding: 4px 9px 4px 8px; border-radius: 100px; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;
        }
        #sigma-hud-root .sigma-dl-status::before {
          content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--dlacc);
          box-shadow: 0 0 8px var(--dlacc); animation: hud-pulse-dot 1.8s ease-in-out infinite;
        }
        #sigma-hud-root .sigma-dl-feats { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 13px; }
        #sigma-hud-root .sigma-dl-feats span {
          font-size: 11px; color: #cbd5e1; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07); border-radius: 7px; padding: 4px 9px;
          display: inline-flex; align-items: center; gap: 5px;
        }
        #sigma-hud-root .sigma-dl-feats span::before { content: '✓'; color: var(--dlacc); font-weight: 700; }
        #sigma-hud-root .sigma-dl-metarow {
          display: flex; gap: 14px; flex-wrap: wrap; font-size: 10px; color: #94A3B8;
          font-family: 'IBM Plex Mono', monospace; margin-bottom: 14px;
        }
        /* botones futuristas "para TradingView" — se apuntan POR href, así el
           estilo premium aplica SIEMPRE (con o sin la reconstrucción JS).
           Los <a> conservan href/download/onclick del motor. */
        #sigma-hud-root a[href*="download/strategy"],
        #sigma-hud-root a[href*="download/terminal"] {
          display: inline-flex !important; align-items: center; justify-content: center; gap: 9px;
          padding: 13px 26px !important; margin-top: 4px; border-radius: 11px !important;
          font-family: 'IBM Plex Mono', monospace !important;
          font-size: 12px !important; font-weight: 700 !important;
          letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none;
          position: relative; overflow: hidden; border: none !important;
          transition: transform .25s ease, box-shadow .25s ease, filter .25s ease !important;
        }
        /* dentro de la tarjeta reconstruida ocupan todo el ancho */
        #sigma-hud-root .sigma-dl-btnslot a { width: 100%; margin-top: 0; }
        #sigma-hud-root a[href*="download/"] svg { flex-shrink: 0; }
        /* marco de energía: arco brillante orbitando el borde (@property) */
        #sigma-hud-root a[href*="download/strategy"]::before,
        #sigma-hud-root a[href*="download/terminal"]::before {
          content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1.4px; pointer-events: none;
          background: conic-gradient(from var(--dl-angle),
            transparent 0 58%, var(--dlring) 74%, #ffffff 80%, var(--dlring) 86%, transparent 100%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          animation: hud-dl-orbit 3.4s linear infinite;
        }
        /* sheen diagonal al hover (::after) */
        #sigma-hud-root a[href*="download/strategy"]::after,
        #sigma-hud-root a[href*="download/terminal"]::after {
          content: ''; position: absolute; top: 0; left: -70%; width: 45%; height: 100%;
          background: linear-gradient(105deg, transparent, rgba(255,255,255,0.34), transparent);
          transform: skewX(-18deg); transition: left .55s ease; pointer-events: none;
        }
        #sigma-hud-root a[href*="download/strategy"]:hover::after,
        #sigma-hud-root a[href*="download/terminal"]:hover::after { left: 130%; }

        #sigma-hud-root a[href*="download/strategy"] {
          --dlring: #7CFFB0;
          background: linear-gradient(135deg, #1FB457, #17c48a) !important; color: #04160b !important;
          box-shadow: 0 10px 26px -8px rgba(34,197,94,0.5), inset 0 1px 0 rgba(255,255,255,0.35);
          animation: hud-dlpulse 3s ease-in-out infinite;
        }
        #sigma-hud-root a[href*="download/terminal"] {
          --dlring: #00E5FF;
          background: linear-gradient(180deg, rgba(0,229,255,0.12), rgba(9,16,28,0.6)) !important;
          color: #9DEEFA !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px -10px rgba(0,0,0,0.6);
          backdrop-filter: blur(6px);
        }
        #sigma-hud-root a[href*="download/strategy"]:hover,
        #sigma-hud-root a[href*="download/terminal"]:hover { transform: translateY(-2px); filter: brightness(1.06); opacity: 1 !important; }
        #sigma-hud-root a[href*="download/strategy"]:hover {
          animation: none;
          box-shadow: 0 16px 36px -8px rgba(34,197,94,0.65), 0 0 30px rgba(45,212,191,0.4), inset 0 1px 0 rgba(255,255,255,0.4);
        }
        #sigma-hud-root a[href*="download/terminal"]:hover {
          box-shadow: 0 14px 32px -10px rgba(0,0,0,0.7), 0 0 28px rgba(0,229,255,0.35);
        }
        /* Fallback sin reconstrucción JS: el panel crudo también se ve premium.
           Estructura del motor = card centrada con título, <p>, botones y meta. */
        #sigma-hud-root .card:has(a[href*="download/strategy"]) {
          background: linear-gradient(180deg, #0A1220, #070B14) !important;
          border: 1px solid rgba(0,229,255,0.18) !important;
        }
        #sigma-hud-root .card:has(a[href*="download/strategy"])::after { opacity: 0.5; } /* mantiene brackets sutiles */
        #sigma-hud-root .card:has(a[href*="download/strategy"]) .card-title { color: #00E5FF !important; }
        /* meta line del motor → fila de badges */
        #sigma-hud-root .card:has(a[href*="download/strategy"]) > div:last-child:not(:has(a)) {
          display: inline-flex; gap: 8px; flex-wrap: wrap; justify-content: center;
        }

        #sigma-hud-root .sigma-dl-footbadges { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 20px; }
        #sigma-hud-root .sigma-dl-footbadges span {
          font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #94A3B8;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(0,229,255,0.14);
          border-radius: 100px; padding: 5px 12px; display: inline-flex; align-items: center; gap: 6px;
        }
        @media (max-width: 720px) { #sigma-hud-root .sigma-dl-grid { grid-template-columns: 1fr; } }

        /* ══ 13. Panel de Señales — retoque sutil, legibilidad primero ══ */
        /* superficie de lectura: sin "lift" al pasar el mouse (no distrae) */
        #sigma-hud-root div[style*="background:#07091c"]:has(#live-counter):hover { transform: none !important; }
        /* headers: venían en #444 (casi ilegibles) → tono claro + hairline cian */
        #sigma-hud-root div[style*="background:#07091c"]:has(#live-counter) table th {
          color: #8b97ad !important;
          border-bottom: 1px solid rgba(57,226,230,0.2) !important;
          padding: 7px 6px !important; letter-spacing: 0.1em !important;
        }
        /* filas: zebra + hover (la clave para leer datos densos sin perderse) */
        #sigma-hud-root div[style*="background:#07091c"]:has(#live-counter) table td { padding: 7px 6px !important; }
        #sigma-hud-root div[style*="background:#07091c"]:has(#live-counter) tbody tr { transition: background .15s ease; }
        #sigma-hud-root div[style*="background:#07091c"]:has(#live-counter) tbody tr:nth-child(even) { background: rgba(255,255,255,0.016); }
        #sigma-hud-root div[style*="background:#07091c"]:has(#live-counter) tbody tr:hover { background: rgba(57,226,230,0.05); }

        /* ══ 14. Risk Metrics + Performance Snapshot — quita dorado + nivel ══ */
        /* --bd-gold (borde dorado del motor) → cian: limpia el remanente en
           risk-panel y cualquier otro borde que lo use */
        #sigma-hud-root { --bd-gold: rgba(57,226,230,0.18); }
        /* ambos contenedores como panel glass (risk-panel no es .card;
           card-purple tampoco recibia el tratamiento) */
        #sigma-hud-root .risk-panel, #sigma-hud-root .card-purple {
          position: relative; overflow: hidden;
          background: linear-gradient(180deg, rgba(20,26,38,0.55), rgba(10,14,22,0.5)) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 16px !important;
          box-shadow: 0 2px 10px rgba(0,0,0,0.4), 0 20px 52px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05) !important;
        }
        /* rail cian superior (reemplaza el border-top ámbar #f59e0b) */
        #sigma-hud-root .risk-panel::before, #sigma-hud-root .card-purple::before {
          content: ''; position: absolute; inset: 0 0 auto 0; height: 2px; z-index: 1;
          background: linear-gradient(90deg, rgba(57,226,230,0.85), rgba(79,146,255,0.4) 45%, transparent 82%);
        }
        /* brackets de esquina sutiles (como las .card) */
        #sigma-hud-root .risk-panel::after, #sigma-hud-root .card-purple::after {
          content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0.35;
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
        /* header: hairline dorada → cian; título ya hereda --gold (cian) */
        #sigma-hud-root .risk-header { border-bottom-color: rgba(57,226,230,0.16) !important; }
        #sigma-hud-root .risk-title { color: #39e2e6 !important; }
        /* cualquier border-top ámbar residual del motor → cian */
        #sigma-hud-root [style*="2px solid #f59e0b"] { border-top-color: rgba(57,226,230,0.55) !important; }

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
        /* Barrita de acento del título de la card: dorada → gradiente cian.
           OJO: solo la barra (background gradient), no textos color #c9a227 */
        #sigma-hud-root span[style*="background:linear-gradient(180deg,#c9a227"] {
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
          #sigma-hud-root .eqh-dot { animation: none !important; }
          #sigma-hud-root div[style*="rgba(46,204,113,.06)"],
          #sigma-hud-root div[style*="background:#f1c40f"],
          #sigma-hud-root .matrix td.cell-run, #sigma-hud-root .cell-run,
          #sigma-hud-root a[href*="download/strategy"],
          #sigma-hud-root .sigma-dl, #sigma-hud-root .sigma-dl-scanline,
          #sigma-hud-root .sigma-dl-particle, #sigma-hud-root .sigma-dl-status::before,
          #sigma-hud-root .sigma-dl-card.engine a,
          #sigma-hud-root .sigma-dl-btnslot a::before { animation: none !important; }
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
