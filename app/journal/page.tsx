'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/app/lib/supabase'

const C = {
  bg:      '#04050a',
  surface: '#0b0d14',
  border:  '#1a1d2e',
  muted:   '#3a3f55',
  dimText: '#7a7f9a',
  text:    '#e8e9f0',
  gold:    '#d4af37',
  glow:    '#f0cc5a',
  green:   '#34d399',
  red:     '#f87171',
  yellow:  '#fbbf24',
} as const

interface Trade {
  id:          string
  fecha:       string
  par:         string
  lado:        'LONG' | 'SHORT'
  entry_price: number
  exit_price:  number
  sl:          number | null
  tp:          number | null
  size_usd:    number
  pnl_usd:     number
  pnl_pct:     number
  resultado:   'WIN' | 'LOSS' | 'BREAKEVEN' | null
  notas:       string
}

type FormState = Omit<Trade, 'id' | 'pnl_usd' | 'pnl_pct' | 'resultado'>

const EMPTY: FormState = {
  fecha:       new Date().toISOString().slice(0, 10),
  par:         '',
  lado:        'LONG',
  entry_price: 0,
  exit_price:  0,
  sl:          null,
  tp:          null,
  size_usd:    0,
  notas:       '',
}

function calcPnl(entry: number, exit: number, lado: 'LONG' | 'SHORT', size: number) {
  if (!entry || !exit || !size) return { pnl_usd: 0, pnl_pct: 0 }
  const mult = lado === 'LONG' ? 1 : -1
  const pnl_pct = mult * ((exit - entry) / entry) * 100
  const pnl_usd = (pnl_pct / 100) * size
  return { pnl_usd, pnl_pct }
}

function autoResultado(pnl: number): 'WIN' | 'LOSS' | 'BREAKEVEN' {
  if (pnl > 0.01)  return 'WIN'
  if (pnl < -0.01) return 'LOSS'
  return 'BREAKEVEN'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText }}>{label}</span>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, outline: 'none',
  color: C.text, fontFamily: 'monospace', fontSize: 13, padding: '9px 12px',
  fontVariantNumeric: 'tabular-nums', width: '100%',
}

export default function JournalPage() {
  const [trades,  setTrades]  = useState<Trade[]>([])
  const [form,    setForm]    = useState<FormState>(EMPTY)
  const [errors,  setErrors]  = useState<Record<string, string>>({})
  const [filter,  setFilter]  = useState<'ALL' | 'LONG' | 'SHORT'>('ALL')
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  // ── Load trades from Supabase ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('trades')
        .select('*')
        .order('fecha', { ascending: false })
      if (data) setTrades(data as Trade[])
      setLoading(false)
    }
    load()
  }, [])

  // ── Validate ───────────────────────────────────────────────────────────────
  function validate() {
    const e: Record<string, string> = {}
    if (!form.par.trim())       e.par         = 'Requerido'
    if (!form.entry_price)      e.entry_price = 'Debe ser > 0'
    if (!form.exit_price)       e.exit_price  = 'Debe ser > 0'
    if (!form.size_usd)         e.size_usd    = 'Debe ser > 0'
    return e
  }

  // ── Submit (insert or update) ──────────────────────────────────────────────
  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    const { pnl_usd, pnl_pct } = calcPnl(form.entry_price, form.exit_price, form.lado, form.size_usd)
    const resultado = autoResultado(pnl_usd)

    const payload = { ...form, pnl_usd, pnl_pct, resultado }

    if (editing) {
      const { error } = await supabase
        .from('trades')
        .update(payload)
        .eq('id', editing)
      if (!error) {
        setTrades(ts => ts.map(t => t.id === editing ? { ...t, ...payload } : t))
        setEditing(null)
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('trades')
        .insert({ ...payload, user_id: user?.id })
        .select()
        .single()
      if (!error && data) setTrades(ts => [data as Trade, ...ts])
    }

    setSaving(false)
    setForm({ ...EMPTY, fecha: new Date().toISOString().slice(0, 10) })
  }

  function handleEdit(t: Trade) {
    setEditing(t.id)
    setForm({
      fecha: t.fecha, par: t.par, lado: t.lado,
      entry_price: t.entry_price, exit_price: t.exit_price,
      sl: t.sl, tp: t.tp, size_usd: t.size_usd, notas: t.notas,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id: string) {
    await supabase.from('trades').delete().eq('id', id)
    setTrades(ts => ts.filter(t => t.id !== id))
    if (editing === id) { setEditing(null); setForm({ ...EMPTY }) }
  }

  const visible = useMemo(() =>
    filter === 'ALL' ? trades : trades.filter(t => t.lado === filter),
    [trades, filter]
  )

  const stats = useMemo(() => {
    if (!trades.length) return { total: 0, wins: 0, winRate: 0, pnl: 0, best: 0, worst: 0, avgSize: 0 }
    const wins = trades.filter(t => t.resultado === 'WIN').length
    const pnls = trades.map(t => t.pnl_usd)
    return {
      total:   trades.length,
      wins,
      winRate: Math.round((wins / trades.length) * 100),
      pnl:     pnls.reduce((a, b) => a + b, 0),
      best:    Math.max(...pnls),
      worst:   Math.min(...pnls),
      avgSize: trades.reduce((a, t) => a + (t.size_usd || 0), 0) / trades.length,
    }
  }, [trades])

  const fmt  = (v: number) => `${v >= 0 ? '+' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtN = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "var(--font-dm-mono,'DM Mono',monospace)" }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 24px 64px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>
            {'// JOURNAL · REGISTRO DE TRADES'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',var(--font-bebas),Impact,sans-serif", fontSize: 'clamp(40px,5vw,72px)', lineHeight: 0.93, letterSpacing: '0.03em', margin: 0 }}>
            <span style={{ color: C.text }}>TRADE</span>{' '}
            <span style={{ background: `linear-gradient(135deg,${C.gold},${C.glow},#a88c25)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>JOURNAL</span>
          </h1>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 1, background: C.border, marginBottom: 1 }}>
          {[
            { label: 'Total trades',  value: stats.total.toString(),                                  color: C.gold },
            { label: 'Win Rate',      value: `${stats.winRate}%`,                                     color: stats.winRate >= 50 ? C.green : C.red },
            { label: 'P&L Total',     value: fmt(stats.pnl),                                          color: stats.pnl >= 0 ? C.green : C.red },
            { label: 'Mejor trade',   value: trades.length ? fmt(stats.best)  : '—',                  color: C.green },
            { label: 'Peor trade',    value: trades.length ? fmt(stats.worst) : '—',                  color: C.red },
            { label: 'Tamaño medio',  value: trades.length ? `$${fmtN(stats.avgSize)}` : '—',         color: C.dimText },
          ].map(s => (
            <div key={s.label} style={{ background: C.surface, padding: '16px 18px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dimText, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Form */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '24px', marginBottom: 1 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: editing ? C.yellow : C.gold, marginBottom: 16 }}>
            {editing ? '// EDITAR TRADE' : '// NUEVO TRADE'}
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16, marginBottom: 16 }}>

              <Field label="Fecha">
                <input type="date" value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  style={inputStyle} />
              </Field>

              <Field label="Par">
                <input type="text" placeholder="BTC/USDT" value={form.par}
                  onChange={e => setForm(f => ({ ...f, par: e.target.value.toUpperCase() }))}
                  style={{ ...inputStyle, borderColor: errors.par ? C.red : C.border }} />
                {errors.par && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.red }}>{errors.par}</span>}
              </Field>

              <Field label="Dirección">
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['LONG', 'SHORT'] as const).map(d => (
                    <button key={d} type="button" onClick={() => setForm(f => ({ ...f, lado: d }))}
                      style={{ flex: 1, padding: '9px', fontFamily: 'monospace', fontSize: 12, cursor: 'pointer',
                        border: `1px solid ${form.lado === d ? (d === 'LONG' ? C.green : C.red) : C.border}`,
                        background: form.lado === d ? (d === 'LONG' ? `${C.green}15` : `${C.red}15`) : C.surface,
                        color: form.lado === d ? (d === 'LONG' ? C.green : C.red) : C.dimText,
                        letterSpacing: '0.1em' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Entrada ($)">
                <input type="number" step="any" min="0" placeholder="0.00"
                  value={form.entry_price || ''}
                  onChange={e => setForm(f => ({ ...f, entry_price: parseFloat(e.target.value) || 0 }))}
                  style={{ ...inputStyle, borderColor: errors.entry_price ? C.red : C.border }} />
                {errors.entry_price && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.red }}>{errors.entry_price}</span>}
              </Field>

              <Field label="Salida ($)">
                <input type="number" step="any" min="0" placeholder="0.00"
                  value={form.exit_price || ''}
                  onChange={e => setForm(f => ({ ...f, exit_price: parseFloat(e.target.value) || 0 }))}
                  style={{ ...inputStyle, borderColor: errors.exit_price ? C.red : C.border }} />
                {errors.exit_price && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.red }}>{errors.exit_price}</span>}
              </Field>

              <Field label="Tamaño (USD)">
                <input type="number" step="any" min="0" placeholder="500"
                  value={form.size_usd || ''}
                  onChange={e => setForm(f => ({ ...f, size_usd: parseFloat(e.target.value) || 0 }))}
                  style={{ ...inputStyle, borderColor: errors.size_usd ? C.red : C.border }} />
                {errors.size_usd && <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.red }}>{errors.size_usd}</span>}
              </Field>

              <Field label="Stop Loss ($)">
                <input type="number" step="any" min="0" placeholder="opcional"
                  value={form.sl || ''}
                  onChange={e => setForm(f => ({ ...f, sl: parseFloat(e.target.value) || null }))}
                  style={inputStyle} />
              </Field>

              <Field label="Take Profit ($)">
                <input type="number" step="any" min="0" placeholder="opcional"
                  value={form.tp || ''}
                  onChange={e => setForm(f => ({ ...f, tp: parseFloat(e.target.value) || null }))}
                  style={inputStyle} />
              </Field>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Field label="Notas">
                <textarea value={form.notas}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  placeholder="Setup, contexto, lección aprendida…" rows={2}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving}
                style={{ padding: '10px 28px', background: C.gold, color: C.bg, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'GUARDANDO…' : editing ? 'ACTUALIZAR' : 'GUARDAR TRADE'}
              </button>
              {editing && (
                <button type="button" onClick={() => { setEditing(null); setForm({ ...EMPTY }) }}
                  style={{ padding: '10px 20px', background: 'transparent', color: C.dimText, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
                  CANCELAR
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 1, background: C.border, marginBottom: 1 }}>
          {(['ALL', 'LONG', 'SHORT'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '10px 20px', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', border: 'none', cursor: 'pointer', background: filter === f ? C.gold : C.surface, color: filter === f ? C.bg : C.dimText }}>
              {f === 'ALL' ? 'TODOS' : f}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', background: C.surface, padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: C.dimText }}>
            {visible.length} trade{visible.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Trade table */}
        <div style={{ background: C.surface }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: C.muted }}>
              Cargando…
            </div>
          ) : visible.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: C.muted }}>
              No hay trades. Añade el primero arriba.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['Fecha', 'Par', 'Dir', 'Entrada', 'Salida', 'SL', 'TP', 'Tamaño', 'P&L', '%', 'Resultado', 'Notas', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: C.dimText, fontWeight: 400, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((t, i) => {
                    const resColor = t.resultado === 'WIN' ? C.green : t.resultado === 'LOSS' ? C.red : C.yellow
                    return (
                      <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : `${C.gold}03` }}>
                        <td style={{ padding: '12px 14px', color: C.dimText, whiteSpace: 'nowrap' }}>{t.fecha}</td>
                        <td style={{ padding: '12px 14px', color: C.text, fontWeight: 600 }}>{t.par}</td>
                        <td style={{ padding: '12px 14px', color: t.lado === 'LONG' ? C.green : C.red, fontWeight: 700 }}>{t.lado}</td>
                        <td style={{ padding: '12px 14px', color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmtN(t.entry_price)}</td>
                        <td style={{ padding: '12px 14px', color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmtN(t.exit_price)}</td>
                        <td style={{ padding: '12px 14px', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{t.sl ? fmtN(t.sl) : '—'}</td>
                        <td style={{ padding: '12px 14px', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{t.tp ? fmtN(t.tp) : '—'}</td>
                        <td style={{ padding: '12px 14px', color: C.dimText, fontVariantNumeric: 'tabular-nums' }}>${fmtN(t.size_usd)}</td>
                        <td style={{ padding: '12px 14px', color: t.pnl_usd >= 0 ? C.green : C.red, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(t.pnl_usd)}</td>
                        <td style={{ padding: '12px 14px', color: t.pnl_pct >= 0 ? C.green : C.red, fontVariantNumeric: 'tabular-nums' }}>{t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct?.toFixed(2)}%</td>
                        <td style={{ padding: '12px 14px' }}>
                          {t.resultado && (
                            <span style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', color: resColor, border: `1px solid ${resColor}40`, padding: '2px 7px' }}>
                              {t.resultado}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', color: C.dimText, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notas || '—'}</td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <button onClick={() => handleEdit(t)}
                            style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.dimText, fontFamily: 'monospace', fontSize: 10, padding: '4px 10px', cursor: 'pointer', marginRight: 6 }}>
                            EDITAR
                          </button>
                          <button onClick={() => handleDelete(t.id)}
                            style={{ background: 'transparent', border: `1px solid ${C.red}30`, color: C.red, fontFamily: 'monospace', fontSize: 10, padding: '4px 10px', cursor: 'pointer' }}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
