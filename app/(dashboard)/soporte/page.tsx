'use client'
import { useState, useEffect, useCallback } from 'react'
import { C, F, cardStyle } from '@/app/lib/constants'

const MOTIVOS = ['Problema técnico', 'Duda sobre mi cuenta', 'Facturación / Plan', 'Sugerencia', 'Otro']

interface Ticket {
  id:         string
  motivo:     string | null
  mensaje:    string
  status:     'pendiente' | 'visto' | 'resuelto'
  respuesta:  string | null
  created_at: string
  updated_at?: string
}

const STATUS_LABEL: Record<Ticket['status'], string> = {
  pendiente: 'PENDIENTE',
  visto:     'EN REVISIÓN',
  resuelto:  'RESUELTO',
}
const STATUS_COLOR: Record<Ticket['status'], string> = {
  pendiente: C.amber,
  visto:     C.blue,
  resuelto:  C.green,
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SoportePage() {
  const [tickets,  setTickets]  = useState<Ticket[]>([])
  const [loading,  setLoading]  = useState(true)
  const [motivo,   setMotivo]   = useState(MOTIVOS[0])
  const [mensaje,  setMensaje]  = useState('')
  const [sending,  setSending]  = useState(false)
  const [error,    setError]    = useState('')
  const [sent,     setSent]     = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/soporte', { cache: 'no-store' })
      if (r.ok) {
        const d = await r.json()
        setTickets(d.tickets ?? [])
      }
    } catch { /* offline */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSent(false)
    if (mensaje.trim().length < 10) { setError('Mensaje demasiado corto (mínimo 10 caracteres).'); return }

    setSending(true)
    try {
      const r = await fetch('/api/soporte', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ motivo, mensaje: mensaje.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error ?? 'Error al enviar. Intenta nuevamente.'); return }
      setMensaje('')
      setSent(true)
      load()
    } catch {
      setError('Sin conexión. Verifica tu internet e intenta nuevamente.')
    } finally {
      setSending(false)
    }
  }

  return (
    <main style={{ background: C.bg, minHeight: '100vh', padding: '40px 32px 64px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.28em', color: C.muted, marginBottom: 8, textTransform: 'uppercase' }}>
            {'// SOPORTE'}
          </div>
          <h1 style={{ fontFamily: F.display, fontSize: 'clamp(28px,4vw,42px)', color: C.text, lineHeight: 1, margin: 0 }}>
            Mis tickets
          </h1>
        </div>

        {/* New ticket form */}
        <form onSubmit={handleSubmit} style={{ ...cardStyle, background: C.surface, padding: 24, marginBottom: 32 }}>
          <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.15em', color: C.gold, marginBottom: 16 }}>
            NUEVA CONSULTA
          </div>

          <label style={{ display: 'block', fontFamily: F.mono, fontSize: 10, color: C.textDim, marginBottom: 6 }}>Motivo</label>
          <select
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            style={{
              width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '9px 12px', color: C.text, fontFamily: F.mono, fontSize: 13, marginBottom: 14,
            }}
          >
            {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <label style={{ display: 'block', fontFamily: F.mono, fontSize: 10, color: C.textDim, marginBottom: 6 }}>Mensaje</label>
          <textarea
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            placeholder="Contanos el detalle de tu consulta o problema…"
            rows={4}
            maxLength={2000}
            style={{
              width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '10px 12px', color: C.text, fontFamily: F.mono, fontSize: 13,
              resize: 'vertical', marginBottom: 10,
            }}
          />

          {error && <div style={{ fontFamily: F.mono, fontSize: 11, color: C.red, marginBottom: 10 }}>{error}</div>}
          {sent  && <div style={{ fontFamily: F.mono, fontSize: 11, color: C.green, marginBottom: 10 }}>Ticket enviado. Te avisaremos cuando respondamos.</div>}

          <button
            type="submit"
            disabled={sending}
            style={{
              background: C.gold, color: C.bg, border: 'none', borderRadius: 6,
              padding: '10px 22px', fontFamily: F.mono, fontSize: 12, letterSpacing: '0.08em',
              cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1,
            }}
          >
            {sending ? 'ENVIANDO…' : 'ENVIAR TICKET'}
          </button>
        </form>

        {/* History */}
        <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.15em', color: C.gold, marginBottom: 14 }}>
          HISTORIAL
        </div>

        {loading ? (
          <div style={{ fontFamily: F.mono, fontSize: 12, color: C.muted }}>Cargando…</div>
        ) : tickets.length === 0 ? (
          <div style={{ ...cardStyle, background: C.surface, padding: 24, textAlign: 'center' }}>
            <span style={{ fontFamily: F.mono, fontSize: 12, color: C.muted }}>Todavía no enviaste ningún ticket.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tickets.map(t => (
              <div key={t.id} style={{ ...cardStyle, background: C.surface, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: F.mono, fontSize: 12, color: C.text, fontWeight: 600 }}>{t.motivo ?? 'Consulta general'}</span>
                  <span style={{
                    fontFamily: F.mono, fontSize: 9, letterSpacing: '0.08em', color: STATUS_COLOR[t.status],
                    border: `1px solid ${STATUS_COLOR[t.status]}40`, borderRadius: 4, padding: '2px 8px',
                  }}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: t.respuesta ? 12 : 6, whiteSpace: 'pre-wrap' }}>
                  {t.mensaje}
                </div>
                {t.respuesta && (
                  <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px', marginBottom: 6 }}>
                    <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.15em', color: C.gold, marginBottom: 6 }}>RESPUESTA DEL EQUIPO</div>
                    <div style={{ fontFamily: F.mono, fontSize: 12, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.respuesta}</div>
                  </div>
                )}
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>{fmtDate(t.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
