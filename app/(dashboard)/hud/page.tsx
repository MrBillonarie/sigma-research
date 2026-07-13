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
    let hist: { pnl?: number; sym?: string; date?: string }[] = []

    const fmtMoney = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

    function buildChart(wrap: HTMLElement, initial: number, floatPct: number | null) {
      if (hist.length < 2) return
      const canvas = wrap.querySelector('#equity-curve') as HTMLElement | null
      if (canvas) canvas.style.display = 'none'

      const W = Math.max(320, wrap.clientWidth - 28)
      const H = 210
      const L = 46, R = 64, T = 14, B = 20
      const iw = W - L - R, ih = H - T - B

      // Serie: % acumulado vs capital inicial, trade a trade
      let acc = initial
      const pts = hist.map(t => { acc += t.pnl ?? 0; return { pct: ((acc - initial) / initial) * 100, win: (t.pnl ?? 0) >= 0, sym: t.sym ?? '', pnl: t.pnl ?? 0, date: t.date ?? '' } })
      const lastPct = pts[pts.length - 1].pct
      const floatY = floatPct != null ? lastPct + floatPct : null
      const vals = pts.map(p => p.pct).concat([0], floatY != null ? [floatY] : [])
      const lo = Math.min(...vals), hi = Math.max(...vals)
      const pad = Math.max((hi - lo) * 0.12, 1)
      const yMin = lo - pad, yMax = hi + pad
      const X = (i: number) => L + (i / (pts.length - 1)) * iw
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

      const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${X(i).toFixed(1)} ${Y(p.pct).toFixed(1)}`).join(' ')
      const areaD = `${lineD} L ${X(pts.length - 1).toFixed(1)} ${Y(yMin).toFixed(1)} L ${L} ${Y(yMin).toFixed(1)} Z`
      const dots = pts.map((p, i) =>
        `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.pct).toFixed(1)}" r="2.4" fill="${p.win ? '#3fb950' : '#ff5d6c'}" stroke="#04070f" stroke-width="1"><title>${esc(p.sym)} · ${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)} · ${esc(p.date.slice(0, 10))} · acum ${p.pct >= 0 ? '+' : ''}${p.pct.toFixed(2)}%</title></circle>`
      ).join('')

      const lx = X(pts.length - 1), ly = Y(lastPct)
      // Extensión flotante: segmento punteado hasta el valor con abiertas
      const floatSeg = floatY != null
        ? `<line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${(W - R + 22).toFixed(1)}" y2="${Y(floatY).toFixed(1)}" stroke="#ffb454" stroke-width="1.6" stroke-dasharray="4 4"/><circle cx="${(W - R + 22).toFixed(1)}" cy="${Y(floatY).toFixed(1)}" r="3.4" fill="none" stroke="#ffb454" stroke-width="1.6"/>`
        : ''
      const chipCls = lastPct >= 0 ? 'pos' : 'neg'

      let svg = wrap.querySelector(':scope > svg.sigma-eq-chart') as SVGSVGElement | null
      const markup =
        `<defs>` +
          `<linearGradient id="eqcArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(57,226,230,0.22)"/><stop offset="100%" stop-color="rgba(57,226,230,0)"/></linearGradient>` +
          `<filter id="eqcGlow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="3.2" flood-color="#5eeaf0" flood-opacity="0.5"/></filter>` +
        `</defs>` +
        ticks +
        `<path d="${areaD}" fill="url(#eqcArea)"/>` +
        `<g filter="url(#eqcGlow)"><path d="${lineD}" fill="none" stroke="#5eeaf0" stroke-width="2" stroke-linejoin="round"/></g>` +
        dots + floatSeg +
        `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4" fill="#5eeaf0" stroke="#04070f" stroke-width="1.5"/>` +
        `<text x="${(W - R + 10).toFixed(1)}" y="${(ly - 8).toFixed(1)}" class="eqc-last ${chipCls}">${lastPct >= 0 ? '+' : ''}${lastPct.toFixed(1)}%</text>` +
        `<text x="${L}" y="${H - 5}" class="eqc-x">${esc((pts[0].date || '').slice(0, 10))}</text>` +
        `<text x="${(W - R).toFixed(1)}" y="${H - 5}" text-anchor="end" class="eqc-x">${esc((pts[pts.length - 1].date || '').slice(0, 10))} · ${pts.length} trades</text>`

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
        '<span class="eqh-legend"><i class="w"></i> win <i class="l"></i> loss <i class="f"></i> flotante</span>'

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
        const rows: { closed_at?: string; pnl_dollar?: number; sym?: string }[] = Array.isArray(j?.history) ? j.history : []
        hist = rows
          .slice()
          .sort((a, b) => (a.closed_at ?? '').localeCompare(b.closed_at ?? ''))
          .map(t => ({ pnl: t.pnl_dollar ?? 0, sym: (t.sym ?? '').toUpperCase(), date: t.closed_at ?? '' }))
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
    loadStats()
    const id = setInterval(loadStats, 60_000)
    const poll = setInterval(() => { apply(); if (root.querySelector('.sigma-eq-hud')) clearInterval(poll) }, 500)
    setTimeout(() => clearInterval(poll), 20000)
    return () => { obs.disconnect(); window.removeEventListener('resize', onResize); clearInterval(id); clearInterval(poll); if (raf) cancelAnimationFrame(raf) }
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
        #sigma-hud-root .sigma-eq-chart .eqc-last { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 700; }
        #sigma-hud-root .sigma-eq-chart .eqc-last.pos { fill: #3fb950; }
        #sigma-hud-root .sigma-eq-chart .eqc-last.neg { fill: #ff5d6c; }
        #sigma-hud-root .sigma-eq-chart .eqc-x { font-family: 'IBM Plex Mono', monospace; font-size: 9px; fill: #55607a; letter-spacing: 0.05em; }
        #sigma-hud-root .eqh-legend { margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
          font-size: 9px; color: #6b7688; letter-spacing: 0.06em; white-space: nowrap; }
        #sigma-hud-root .eqh-legend i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
        #sigma-hud-root .eqh-legend i.w { background: #3fb950; }
        #sigma-hud-root .eqh-legend i.l { background: #ff5d6c; }
        #sigma-hud-root .eqh-legend i.f { background: transparent; border: 1.5px solid #ffb454; }
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
