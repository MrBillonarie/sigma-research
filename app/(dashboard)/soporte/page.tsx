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
      <style>{`
        @keyframes sop-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes sop-in    { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:none } }
        .sop-area { transition: border-color 0.2s, box-shadow 0.2s; outline: none; }
        .sop-area:focus { border-color: ${C.gold}66 !important; box-shadow: 0 0 0 1px ${C.gold}33, 0 0 18px rgba(212,175,55,0.08); }
        .sop-chip { transition: color 0.15s, border-color 0.15s, background 0.15s; cursor: pointer; }
        .sop-chip:hover { border-color: ${C.gold}55; color: ${C.text}; }
        .sop-send { position: relative; overflow: hidden; transition: transform 0.2s, filter 0.2s; }
        .sop-send:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
        .sop-send::before { content:''; position:absolute; top:0; left:-60%; width:40%; height:100%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: skewX(-20deg); transition: left 0.6s ease; pointer-events:none; }
        .sop-send:hover::before { left: 130%; }
        .sop-ticket { transition: transform 0.15s ease, box-shadow 0.2s ease; }
        .sop-ticket:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,0.35); }
      `}</style>
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

        {/* New ticket form — estilo consola */}
        <form onSubmit={handleSubmit} style={{ ...cardStyle, background: C.surface, padding: 24, marginBottom: 40, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${C.gold}50, transparent)` }} />
          <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.15em', color: C.gold, marginBottom: 18, display: 'flex', alignItems: 'center' }}>
            {'> nueva_consulta'}
            <span style={{ display: 'inline-block', width: 7, height: 13, background: C.gold, marginLeft: 5, animation: 'sop-blink 1.1s step-end infinite' }} />
          </div>

          <label style={{ display: 'block', fontFamily: F.mono, fontSize: 10, color: C.textDim, marginBottom: 8 }}>Motivo</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {MOTIVOS.map(m => {
              const active = motivo === m
              return (
                <button
                  type="button"
                  key={m}
                  className="sop-chip"
                  onClick={() => setMotivo(m)}
                  style={{
                    fontFamily: F.mono, fontSize: 11, padding: '6px 14px', borderRadius: 999,
                    border: `1px solid ${active ? C.gold : C.border}`,
                    background: active ? 'rgba(212,175,55,0.12)' : 'transparent',
                    color: active ? C.gold : C.textDim,
                  }}
                >
                  {m}
                </button>
              )
            })}
          </div>

          <label style={{ display: 'block', fontFamily: F.mono, fontSize: 10, color: C.textDim, marginBottom: 6 }}>Mensaje</label>
          <textarea
            className="sop-area"
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            placeholder="Contanos el detalle de tu consulta o problema…"
            rows={4}
            maxLength={2000}
            style={{
              width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '10px 12px', color: C.text, fontFamily: F.mono, fontSize: 13,
              resize: 'vertical', marginBottom: 4,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <span style={{ fontFamily: F.mono, fontSize: 9, color: mensaje.length > 1800 ? C.amber : C.muted, letterSpacing: '0.08em' }}>
              {mensaje.length}/2000
            </span>
          </div>

          {error && (
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.red, marginBottom: 10, animation: 'sop-in 0.3s ease-out' }}>
              {'> error :: '}{error}
            </div>
          )}
          {sent && (
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.green, marginBottom: 10, animation: 'sop-in 0.3s ease-out' }}>
              {'✓ ticket_enviado :: te avisaremos cuando respondamos'}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="sop-send"
            style={{
              background: `linear-gradient(135deg, ${C.gold}, #c9a227)`, color: C.bg, border: 'none', borderRadius: 6,
              padding: '10px 24px', fontFamily: F.mono, fontSize: 12, letterSpacing: '0.1em',
              cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1,
              boxShadow: '0 0 20px rgba(212,175,55,0.18)',
            }}
          >
            {sending ? 'ENVIANDO…' : 'ENVIAR TICKET'}
          </button>
        </form>

        {/* History — timeline conversacional */}
        <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.15em', color: C.gold, marginBottom: 16 }}>
          {'> historial'}
        </div>

        {loading ? (
          <div style={{ fontFamily: F.mono, fontSize: 12, color: C.muted }}>Cargando…</div>
        ) : tickets.length === 0 ? (
          <div style={{ ...cardStyle, background: C.surface, padding: '32px 24px', textAlign: 'center' }}>
            <pre style={{
              fontFamily: F.mono, fontSize: 11, color: '#2a2f45', lineHeight: 1.65,
              margin: '0 auto 14px', display: 'inline-block', textAlign: 'left', letterSpacing: '0.04em',
            }}>{`┌──────────────────────────────┐
│  > SIGMA SUPPORT DESK        │
│  > status   : online         │
│  > tickets  : 0              │
│  > esperando tu consulta...  │
└──────────────────────────────┘`}</pre>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, letterSpacing: '0.12em' }}>
              TODAVÍA NO ENVIASTE NINGÚN TICKET
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: 26 }}>
            {/* Línea de tiempo */}
            <div style={{
              position: 'absolute', left: 7, top: 8, bottom: 8, width: 2,
              background: `linear-gradient(180deg, ${C.gold}40, ${C.border} 25%, ${C.border} 75%, transparent)`,
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {tickets.map(t => (
                <div key={t.id} style={{ position: 'relative' }}>
                  {/* Nodo de estado sobre la línea */}
                  <span style={{
                    position: 'absolute', left: -24, top: 20, width: 12, height: 12, borderRadius: '50%',
                    background: C.bg, border: `2px solid ${STATUS_COLOR[t.status]}`,
                    boxShadow: `0 0 8px ${STATUS_COLOR[t.status]}66`,
                  }} />
                  <div className="sop-ticket" style={{
                    ...cardStyle, background: C.surface, padding: 18,
                    borderLeft: `2px solid ${STATUS_COLOR[t.status]}40`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: F.mono, fontSize: 12, color: C.text, fontWeight: 600 }}>{t.motivo ?? 'Consulta general'}</span>
                      <span style={{
                        fontFamily: F.mono, fontSize: 9, letterSpacing: '0.08em', color: STATUS_COLOR[t.status],
                        background: `${STATUS_COLOR[t.status]}12`,
                        border: `1px solid ${STATUS_COLOR[t.status]}40`, borderRadius: 4, padding: '2px 8px',
                      }}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </div>
                    <div style={{ fontFamily: F.mono, fontSize: 12, color: C.textDim, lineHeight: 1.6, marginBottom: t.respuesta ? 14 : 6, whiteSpace: 'pre-wrap' }}>
                      {t.mensaje}
                    </div>
                    {t.respuesta && (
                      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(212,175,55,0.12)', border: `1px solid ${C.gold}55`,
                          color: C.gold, fontFamily: F.mono, fontSize: 13,
                        }}>Σ</span>
                        <div style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: '2px 10px 10px 10px', padding: '10px 12px' }}>
                          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.15em', color: C.gold, marginBottom: 6 }}>EQUIPO SIGMA</div>
                          <div style={{ fontFamily: F.mono, fontSize: 12, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.respuesta}</div>
                        </div>
                      </div>
                    )}
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted }}>{fmtDate(t.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
