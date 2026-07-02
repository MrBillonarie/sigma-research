'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/app/lib/supabase'
import { C, F } from '@/app/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Setup {
  id: string
  par: string
  tipo: 'LONG' | 'SHORT' | 'LP'
  entry: number | null
  sl: number | null
  tp: number | null
  range_low: number | null
  range_high: number | null
  fee_tier: string | null
  protocol: string | null
  rr: number | null
  timeframe: string | null
  metodologia: string | null
  nota: string | null
  fecha: string
  created_at: string
  activo: boolean
  profiles?: {
    username: string | null
    reputation: number
  }
  // votes computed client-side
  vote_count?: number
  user_voted?: boolean
}

interface FormState {
  par: string
  tipo: 'LONG' | 'SHORT' | 'LP'
  entry: string
  sl: string
  tp: string
  range_low: string
  range_high: string
  fee_tier: string
  protocol: string
  rr: string
  timeframe: string
  metodologia: string
  nota: string
}

const EMPTY_FORM: FormState = {
  par: '', tipo: 'LONG', entry: '', sl: '', tp: '',
  range_low: '', range_high: '', fee_tier: '', protocol: '',
  rr: '', timeframe: '', metodologia: '', nota: '',
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MONO  = F.mono
const BEBAS = F.display

const TIPO_COLOR: Record<string, string> = {
  LONG:  C.green,
  SHORT: C.red,
  LP:    C.blue,
}

const TF_OPTIONS = ['1m','5m','15m','30m','1h','4h','1D','1W']

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1,2,3,4].map(i => (
        <div key={i} className="animate-pulse" style={{
          height: 120,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: C.radiusMd,
        }} />
      ))}
    </div>
  )
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 10, fontSize: 10, color: C.textDim,
      fontFamily: MONO, letterSpacing: 1.5, textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ height: 1, width: 20, background: C.border }} />
      {children}
      <div style={{ height: 1, flex: 1, background: C.border }} />
    </div>
  )
}

// ─── SetupCard ────────────────────────────────────────────────────────────────
function SetupCard({
  setup,
  onVote,
  voting,
}: {
  setup: Setup
  onVote: (id: string) => void
  voting: boolean
}) {
  const tipoColor = TIPO_COLOR[setup.tipo] ?? C.textDim
  const dateStr   = setup.fecha
    ? new Date(setup.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' })
    : '—'

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: C.radiusMd,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      transition: 'border-color 0.15s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border2 }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border }}
    >
      {/* ── Row 1: Par + tipo + tf + fecha + autor ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: BEBAS, fontSize: 22, letterSpacing: 1, color: C.text, lineHeight: 1,
        }}>
          {setup.par}
        </span>

        <span style={{
          fontFamily: MONO, fontSize: 10, fontWeight: 700,
          color: tipoColor, background: `${tipoColor}18`,
          border: `1px solid ${tipoColor}40`,
          padding: '2px 8px', borderRadius: 4, letterSpacing: 1,
        }}>
          {setup.tipo}
        </span>

        {setup.timeframe && (
          <span style={{
            fontFamily: MONO, fontSize: 10, color: C.textDim,
            background: C.surface2 ?? '#0e1019', border: `1px solid ${C.border}`,
            padding: '2px 7px', borderRadius: 4,
          }}>
            {setup.timeframe}
          </span>
        )}

        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, color: C.muted }}>
          {setup.profiles?.username
            ? <span style={{ color: C.textDim }}>@{setup.profiles.username}</span>
            : <span>anónimo</span>
          }
          {' · '}
          {dateStr}
        </span>
      </div>

      {/* ── Row 2: Precios entry/sl/tp o rango LP ── */}
      {setup.tipo !== 'LP' ? (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {setup.entry != null && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 2 }}>ENTRY</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: C.text }}>{setup.entry}</div>
            </div>
          )}
          {setup.sl != null && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 2 }}>SL</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: C.red }}>{setup.sl}</div>
            </div>
          )}
          {setup.tp != null && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 2 }}>TP</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: C.green }}>{setup.tp}</div>
            </div>
          )}
          {setup.rr != null && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 2 }}>R:R</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: C.gold }}>{setup.rr}x</div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {setup.range_low != null && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 2 }}>RANGE LOW</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: C.text }}>{setup.range_low}</div>
            </div>
          )}
          {setup.range_high != null && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 2 }}>RANGE HIGH</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: C.text }}>{setup.range_high}</div>
            </div>
          )}
          {setup.fee_tier && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 2 }}>FEE TIER</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: C.blue }}>{setup.fee_tier}</div>
            </div>
          )}
          {setup.protocol && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 2 }}>PROTOCOL</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: C.blue }}>{setup.protocol}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Row 3: Metodología / nota ── */}
      {(setup.metodologia || setup.nota) && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          paddingTop: 10,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {setup.metodologia && (
            <p style={{ margin: 0, fontFamily: MONO, fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
              <span style={{ color: C.muted, marginRight: 6 }}>{'// metodología'}</span>
              {setup.metodologia}
            </p>
          )}
          {setup.nota && (
            <p style={{ margin: 0, fontFamily: MONO, fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
              <span style={{ color: C.muted, marginRight: 6 }}>{'// nota'}</span>
              {setup.nota}
            </p>
          )}
        </div>
      )}

      {/* ── Row 4: Voto ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button
          onClick={() => onVote(setup.id)}
          disabled={voting || setup.user_voted}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: setup.user_voted ? `${C.gold}18` : 'transparent',
            border: `1px solid ${setup.user_voted ? C.gold : C.border}`,
            borderRadius: 6,
            padding: '5px 12px',
            color: setup.user_voted ? C.gold : C.textDim,
            fontFamily: MONO, fontSize: 11,
            cursor: voting || setup.user_voted ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            opacity: voting ? 0.6 : 1,
          }}
          onMouseEnter={e => { if (!setup.user_voted && !voting) { (e.currentTarget as HTMLElement).style.borderColor = C.gold; (e.currentTarget as HTMLElement).style.color = C.gold } }}
          onMouseLeave={e => { if (!setup.user_voted && !voting) { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.color = C.textDim } }}
        >
          ↑ {setup.user_voted ? 'Votado' : 'Votar'}
          {(setup.vote_count ?? 0) > 0 && (
            <span style={{
              background: `${C.gold}22`, border: `1px solid ${C.gold}40`,
              borderRadius: 4, padding: '1px 7px', fontSize: 10,
              color: C.gold, fontFamily: MONO,
            }}>
              {setup.vote_count}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── PublishForm ──────────────────────────────────────────────────────────────
function PublishForm({
  onPublished,
  token,
}: {
  onPublished: () => void
  token: string | null
}) {
  const [open,      setOpen]      = useState(false)
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState(false)

  const isLP = form.tipo === 'LP'

  function set(k: keyof FormState, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.par.trim()) { setError('El par es requerido.'); return }
    if (!token) { setError('No autenticado. Recarga la página.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/community-setups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          par:        form.par.trim().toUpperCase(),
          tipo:       form.tipo,
          entry:      !isLP && form.entry      ? parseFloat(form.entry)      : null,
          sl:         !isLP && form.sl         ? parseFloat(form.sl)         : null,
          tp:         !isLP && form.tp         ? parseFloat(form.tp)         : null,
          range_low:   isLP && form.range_low  ? parseFloat(form.range_low)  : null,
          range_high:  isLP && form.range_high ? parseFloat(form.range_high) : null,
          fee_tier:    isLP ? form.fee_tier  || null : null,
          protocol:    isLP ? form.protocol  || null : null,
          rr:         !isLP && form.rr        ? parseFloat(form.rr)         : null,
          timeframe:  form.timeframe  || null,
          metodologia: form.metodologia || null,
          nota:        form.nota        || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Error al publicar el setup.')
      }

      setSuccess(true)
      setForm(EMPTY_FORM)
      setTimeout(() => {
        setSuccess(false)
        setOpen(false)
        onPublished()
      }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#04050a',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: '8px 12px',
    color: C.text,
    fontFamily: MONO,
    fontSize: 12,
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: 9,
    color: C.muted,
    letterSpacing: 1.2,
    marginBottom: 4,
    display: 'block',
    textTransform: 'uppercase',
  }

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${open ? C.gold + '60' : C.border}`,
      borderRadius: C.radiusMd,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'transparent', border: 'none',
          cursor: 'pointer', color: C.text,
          fontFamily: MONO, fontSize: 12,
          letterSpacing: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: C.gold, fontSize: 16 }}>+</span>
          <span>PUBLICAR SETUP</span>
        </div>
        <span style={{ color: C.muted, fontSize: 14, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>
          ▼
        </span>
      </button>

      {/* Form body */}
      {open && (
        <form onSubmit={handleSubmit} style={{
          borderTop: `1px solid ${C.border}`,
          padding: '20px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Par + Tipo + TF */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Par *</label>
              <input
                value={form.par}
                onChange={e => set('par', e.target.value)}
                placeholder="BTC, ETH, SOL…"
                style={inputStyle}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = C.gold + '60' }}
                onBlur={e => { (e.target as HTMLInputElement).style.borderColor = C.border }}
              />
            </div>
            <div>
              <label style={labelStyle}>Tipo *</label>
              <select
                value={form.tipo}
                onChange={e => set('tipo', e.target.value as 'LONG' | 'SHORT' | 'LP')}
                style={{ ...inputStyle, appearance: 'none' }}
              >
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
                <option value="LP">LP DeFi</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Timeframe</label>
              <select
                value={form.timeframe}
                onChange={e => set('timeframe', e.target.value)}
                style={{ ...inputStyle, appearance: 'none' }}
              >
                <option value="">— sin TF —</option>
                {TF_OPTIONS.map(tf => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </div>
          </div>

          {/* Entry/SL/TP/RR (no LP) */}
          {!isLP && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              {(['entry','sl','tp','rr'] as const).map(field => (
                <div key={field}>
                  <label style={labelStyle}>{field.toUpperCase()}</label>
                  <input
                    type="number"
                    step="any"
                    value={form[field]}
                    onChange={e => set(field, e.target.value)}
                    placeholder="0.00"
                    style={inputStyle}
                    onFocus={e => { (e.target as HTMLInputElement).style.borderColor = C.gold + '60' }}
                    onBlur={e => { (e.target as HTMLInputElement).style.borderColor = C.border }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* LP fields */}
          {isLP && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Range Low</label>
                <input type="number" step="any" value={form.range_low} onChange={e => set('range_low', e.target.value)} placeholder="0.00" style={inputStyle}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = C.gold + '60' }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = C.border }}
                />
              </div>
              <div>
                <label style={labelStyle}>Range High</label>
                <input type="number" step="any" value={form.range_high} onChange={e => set('range_high', e.target.value)} placeholder="0.00" style={inputStyle}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = C.gold + '60' }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = C.border }}
                />
              </div>
              <div>
                <label style={labelStyle}>Fee Tier</label>
                <input value={form.fee_tier} onChange={e => set('fee_tier', e.target.value)} placeholder="0.05%, 0.3%…" style={inputStyle}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = C.gold + '60' }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = C.border }}
                />
              </div>
              <div>
                <label style={labelStyle}>Protocol</label>
                <input value={form.protocol} onChange={e => set('protocol', e.target.value)} placeholder="Uniswap v3…" style={inputStyle}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = C.gold + '60' }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = C.border }}
                />
              </div>
            </div>
          )}

          {/* Metodología */}
          <div>
            <label style={labelStyle}>Metodología</label>
            <textarea
              value={form.metodologia}
              onChange={e => set('metodologia', e.target.value)}
              placeholder="¿Qué señal te dio entrada? RSI divergencia, break de estructura, confluencia con EMA…"
              rows={2}
              maxLength={500}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = C.gold + '60' }}
              onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = C.border }}
            />
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, marginTop: 3, textAlign: 'right' }}>
              {form.metodologia.length}/500
            </div>
          </div>

          {/* Nota */}
          <div>
            <label style={labelStyle}>Nota / Contexto adicional</label>
            <textarea
              value={form.nota}
              onChange={e => set('nota', e.target.value)}
              placeholder="Contexto macro, nivel de riesgo, catalizadores…"
              rows={2}
              maxLength={1000}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = C.gold + '60' }}
              onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = C.border }}
            />
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, marginTop: 3, textAlign: 'right' }}>
              {form.nota.length}/1000
            </div>
          </div>

          {/* Error / success */}
          {error && (
            <div style={{
              background: `${C.red}12`, border: `1px solid ${C.red}50`,
              borderRadius: 6, padding: '10px 14px',
              color: C.red, fontFamily: MONO, fontSize: 11,
            }}>
              ⚠ {error}
            </div>
          )}
          {success && (
            <div style={{
              background: `${C.green}12`, border: `1px solid ${C.green}50`,
              borderRadius: 6, padding: '10px 14px',
              color: C.green, fontFamily: MONO, fontSize: 11,
            }}>
              ✓ Setup publicado correctamente.
            </div>
          )}

          {/* Submit */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={() => { setOpen(false); setForm(EMPTY_FORM); setError(null) }}
              style={{
                background: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '8px 16px',
                color: C.textDim, fontFamily: MONO, fontSize: 11, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !form.par.trim()}
              style={{
                background: loading ? `${C.gold}30` : C.gold,
                border: 'none', borderRadius: 6, padding: '8px 20px',
                color: loading ? C.gold : '#000',
                fontFamily: MONO, fontSize: 11, fontWeight: 700,
                cursor: loading || !form.par.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                opacity: !form.par.trim() ? 0.5 : 1,
              }}
            >
              {loading ? '⏳ Publicando…' : '↑ Publicar Setup'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CommunitySetupsPage() {
  const [setups,    setSetups]    = useState<Setup[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [votingId,  setVotingId]  = useState<string | null>(null)
  const [token,     setToken]     = useState<string | null>(null)

  // Hydrate auth token once on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setToken(session.access_token)
      }
    })
  }, [])

  const fetchSetups = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/community-setups')
      if (!res.ok) throw new Error('Error cargando setups')
      const data: Setup[] = await res.json()
      setSetups(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSetups() }, [fetchSetups])

  async function handleVote(setupId: string) {
    if (!token) { setError('Debes iniciar sesión para votar.'); return }
    if (votingId) return

    setVotingId(setupId)
    try {
      const res = await fetch('/api/community-setups', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ setup_id: setupId, vote_type: 'up' }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Error al votar')
      }

      // Optimistic update
      setSetups(prev => prev.map(s =>
        s.id === setupId
          ? { ...s, vote_count: (s.vote_count ?? 0) + 1, user_voted: true }
          : s
      ))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al votar')
    } finally {
      setVotingId(null)
    }
  }

  return (
    <div className="dash-content" style={{
      minHeight: '100vh', background: C.bg,
      paddingBottom: 64, maxWidth: 900, margin: '0 auto', width: '100%',
    }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: C.gold, boxShadow: `0 0 8px ${C.gold}`,
          }} />
          <span style={{ fontSize: 10, color: C.gold, fontFamily: MONO, letterSpacing: 1 }}>
            SIGMA RESEARCH — COMUNIDAD
          </span>
        </div>

        <h1 style={{
          margin: '0 0 4px', fontSize: 32,
          fontFamily: BEBAS, letterSpacing: 2, color: C.text,
        }}>
          {'// COMMUNITY SETUPS'}
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: C.textDim, fontFamily: MONO }}>
          Setups compartidos por la comunidad · Vota los que más te aporten · Aprende del flujo colectivo
        </p>

        <button
          onClick={fetchSetups}
          disabled={loading}
          style={{
            background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7,
            padding: '8px 14px', color: C.textDim, fontSize: 11, fontFamily: MONO,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '⏳ Cargando...' : '↻ Actualizar'}
        </button>
      </div>

      {/* ── Formulario publicar ─────────────────────────────────────────── */}
      <section style={{ marginBottom: 28 }}>
        <SectionLabel>PUBLICAR SETUP</SectionLabel>
        {token ? (
          <PublishForm token={token} onPublished={fetchSetups} />
        ) : (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radiusMd,
            padding: '16px 20px', fontFamily: MONO, fontSize: 12, color: C.textDim,
          }}>
            Inicia sesión para publicar un setup.
          </div>
        )}
      </section>

      {/* ── Error global ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: `${C.red}10`, border: `1px solid ${C.red}50`,
          borderRadius: 8, padding: '12px 16px', marginBottom: 20,
          color: C.red, fontSize: 12, fontFamily: MONO,
        }}>
          ⚠ {error}
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 12, background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontFamily: MONO, fontSize: 12 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Lista de setups ──────────────────────────────────────────────── */}
      <section>
        <SectionLabel>SETUPS RECIENTES</SectionLabel>

        {loading ? (
          <LoadingSkeleton />
        ) : setups.length === 0 ? (
          /* Empty state */
          <div style={{
            background: C.surface,
            border: `1px dashed ${C.border}`,
            borderRadius: C.radiusMd,
            padding: '48px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ fontFamily: BEBAS, fontSize: 22, letterSpacing: 1, color: C.text, marginBottom: 8 }}>
              AÚN NO HAY SETUPS
            </div>
            <p style={{ fontFamily: MONO, fontSize: 12, color: C.textDim, margin: 0 }}>
              Sé el primero en publicar un setup y ayuda a la comunidad a encontrar oportunidades.
            </p>
            {!token && (
              <p style={{ fontFamily: MONO, fontSize: 11, color: C.muted, margin: '12px 0 0' }}>
                Necesitas iniciar sesión para publicar.
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {setups.map(setup => (
              <SetupCard
                key={setup.id}
                setup={setup}
                onVote={handleVote}
                voting={votingId === setup.id}
              />
            ))}
            <div style={{
              fontFamily: MONO, fontSize: 10, color: C.muted,
              textAlign: 'center', marginTop: 8,
            }}>
              Mostrando {setups.length} setup{setups.length !== 1 ? 's' : ''} · Solo autores con reputación ≥ 10 pueden publicar
            </div>
          </div>
        )}
      </section>

      {/* Footer note */}
      <div style={{
        marginTop: 40,
        borderTop: `1px solid ${C.border}`,
        paddingTop: 20,
        fontFamily: MONO, fontSize: 10, color: C.muted,
        lineHeight: 1.7,
      }}>
        <span style={{ color: C.gold }}>{'// '}</span>
        Los setups de la comunidad son ideas, no recomendaciones de inversión.
        SIGMA Research no es responsable de las posiciones que tomes basadas en información de terceros.
      </div>
    </div>
  )
}

