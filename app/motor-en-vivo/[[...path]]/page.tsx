'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

export default function MotorEnVivoPage() {
  const params  = useParams<{ path?: string[] }>()
  const subPath = params?.path?.join('/') ?? ''
  const proxyUrl = subPath ? `/api/vps/motor-page/${subPath}` : '/api/vps/motor-proxy'

  const [authed,   setAuthed]   = useState(false)
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [status,   setStatus]   = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const containerRef = useRef<HTMLDivElement>(null)

  // Embebe el HTML del motor — copia estilos del <head>, ejecuta scripts en
  // orden, y reescribe links internos (ej. href="/models") para que sigan
  // apuntando dentro de /motor-en-vivo en vez de a squantdesk.com/<lo-que-sea>.
  const loadMotor = useCallback(async () => {
    setStatus('loading')
    const res = await fetch(proxyUrl, { cache: 'no-store' }).catch(() => null)

    if (!res) { setStatus('error'); return }
    if (res.status === 401) { setAuthed(false); setStatus('idle'); return }
    if (!res.ok) { setStatus('error'); return }

    try {
      const html = await res.text()
      if (!containerRef.current) return
      setAuthed(true)

      const doc = new DOMParser().parseFromString(html, 'text/html')

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

      containerRef.current.innerHTML = doc.body.innerHTML

      containerRef.current.querySelectorAll('a[href^="/"]').forEach(a => {
        const href = a.getAttribute('href') ?? ''
        if (href.startsWith('/api/') || href.startsWith('/download/') || href.startsWith('/motor-en-vivo') || href === '/hud') return
        if (href === '/') { a.setAttribute('href', '/hud'); return }
        a.setAttribute('href', `/motor-en-vivo${href}`)
      })

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

      setStatus('ok')
    } catch {
      setStatus('error')
    }
  }, [proxyUrl])

  // Al entrar (o cambiar de sub-página): si la cookie ya es válida se embebe
  // directo, sin pedir contraseña otra vez — por eso un link real del motor
  // (ej. "Per-Model Paper" → /models, que recarga el navegador) sigue andando.
  useEffect(() => {
    loadMotor()
  }, [loadMotor])

  // Reescritura por atributo (arriba) solo cubre links presentes en el HTML
  // inicial. El dashboard del motor genera parte de su navegación vía JS
  // *después* de ese punto, así que esos <a> nunca se reescriben y al hacer
  // clic navegan el navegador real a squantdesk.com/<ruta> (404). Un listener
  // delegado en el contenedor intercepta el clic sin importar cuándo se creó
  // el link.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      const a = target.closest('a[href^="/"]') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      if (href.startsWith('/api/') || href.startsWith('/download/') || href.startsWith('/motor-en-vivo') || href === '/hud') return
      e.preventDefault()
      window.location.href = href === '/' ? '/hud' : `/motor-en-vivo${href}`
    }
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/engine-monitor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Contraseña incorrecta')
        return
      }
      await loadMotor()
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // El contenedor de abajo queda SIEMPRE montado (nunca se desmonta por authed),
  // porque loadMotor() necesita containerRef.current disponible para poder
  // marcar authed=true en primer lugar — si el formulario reemplazaba todo el
  // árbol (como antes), containerRef.current era siempre null en ese chequeo
  // y authed nunca llegaba a ponerse en true: candado circular, login en loop
  // infinito aunque la contraseña fuera correcta y el servidor respondiera 200.
  return (
    <>
      {!authed && (
        <main style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#04050a', padding: 24 }}>
          <form onSubmit={handleSubmit} style={{ background: '#0b0d14', border: '1px solid #2a2d3e', padding: 32, width: 320 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', color: '#d4af37', marginBottom: 20 }}>
              {'// SIGMA ENGINE · ACCESO MONITOREO'}
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoFocus
              style={{ width: '100%', background: '#04050a', border: '1px solid #2a2d3e', color: '#e8e9f0', padding: '10px 12px', fontFamily: 'monospace', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }}
            />
            {error && (
              <div style={{ color: '#f87171', fontFamily: 'monospace', fontSize: 11, marginBottom: 12 }}>{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: '#d4af37', border: 'none', color: '#04050a', padding: '11px', fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.15em', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'VERIFICANDO…' : 'ENTRAR'}
            </button>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#5a5f7a', marginTop: 14, lineHeight: 1.6 }}>
              La sesión se cierra al salir del navegador.
            </div>
          </form>
        </main>
      )}

      {authed && status === 'loading' && (
        <div style={{
          position: 'fixed', inset: 0, background: '#020510',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'IBM Plex Mono',monospace", color: '#c9a227', zIndex: 9999,
        }}>
          Cargando SIGMA ENGINE…
        </div>
      )}
      {authed && status === 'error' && (
        <div style={{
          position: 'fixed', inset: 0, background: '#020510',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'IBM Plex Mono',monospace", color: '#e74c3c', zIndex: 9999,
        }}>
          Sin conexión al motor. Intenta recargar la página.
        </div>
      )}
      <div ref={containerRef} style={{ minHeight: '100vh', background: '#020510' }} />
    </>
  )
}
