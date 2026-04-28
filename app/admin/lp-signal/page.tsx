'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const SESSION_KEY  = 'sigma_admin_auth'

interface Signal {
  id:              string
  created_at:      string
  hyp:             string
  hyp_text:        string
  pool:            string
  fee_tier:        number
  range_low_pct:   number
  range_high_pct:  number
  ref_price:       number
  tick_lower:      number
  tick_upper:      number
  kelly_pct:       number
  vol_daily_m:     number
  days_projected:  number
  is_active:       boolean
  requires_approval: boolean
  approved_at:     string | null
  rejected_at:     string | null
  source:          string
  regime_score:    number
  atr_24h_pct:     number
  raw_pool_data:   Record<string, unknown> | null
}

interface AdminData {
  pending: Signal[]
  active:  Signal | null
  history: Signal[]
}

const HYP_COLOR: Record<string, string> = {
  ranging:     'text-emerald-400 border-emerald-400/40',
  compression: 'text-yellow-400 border-yellow-400/40',
  none:        'text-muted border-border',
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
function fmtPct(n: number) {
  return `${n.toFixed(1)}%`
}
function fmtDate(s: string) {
  return new Date(s).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminLpSignal() {
  const router  = useRouter()
  const [loading,   setLoading]   = useState(true)
  const [data,      setData]      = useState<AdminData | null>(null)
  const [error,     setError]     = useState('')
  const [working,   setWorking]   = useState(false)
  const [rawOpen,   setRawOpen]   = useState(false)

  const loadData = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/admin/lp-pending', {
        headers: {  },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando datos')
    }
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) !== 'true') {
      router.replace('/admin')
      return
    }
    setLoading(false)
    loadData()
  }, [router, loadData])

  async function approve(signalId: string) {
    setWorking(true)
    try {
      const res = await fetch('/api/lp-signal/approve', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET ?? 'adminsigma'}`,
        },
        body: JSON.stringify({ signalId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await loadData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al aprobar')
    } finally {
      setWorking(false)
    }
  }

  async function reject(signalId: string) {
    setWorking(true)
    try {
      const res = await fetch('/api/lp-signal/reject', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET ?? 'adminsigma'}`,
        },
        body: JSON.stringify({ signalId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await loadData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al rechazar')
    } finally {
      setWorking(false)
    }
  }

  if (loading) return null

  const pending = data?.pending ?? []
  const active  = data?.active  ?? null
  const history = data?.history ?? []

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">

      {/* Header */}
      <header className="bg-surface border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border border-gold flex items-center justify-center">
            <span className="display-heading text-gold text-xs leading-none">Σ</span>
          </div>
          <span className="display-heading text-lg tracking-widest text-text">SIGMA</span>
          <span className="section-label text-gold ml-1">ADMIN</span>
          <span className="hidden sm:block terminal-text text-xs text-muted border-l border-border pl-4">
            LP Signal · Panel de aprobación
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard" className="terminal-text text-xs text-text-dim hover:text-gold transition-colors">
            ← Dashboard
          </Link>
          <button
            onClick={loadData}
            className="section-label text-xs text-gold border border-gold/30 px-3 py-1 hover:bg-gold/5 transition-colors"
          >
            ACTUALIZAR
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full space-y-8">

        {error && (
          <div className="border border-red-500/40 bg-red-500/5 px-4 py-3 terminal-text text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Señal activa actual */}
        <section>
          <div className="section-label text-gold mb-3">{'// SEÑAL ACTIVA ACTUAL'}</div>
          {active ? (
            <div className="glass-card p-5 border border-emerald-400/20">
              <div className="flex items-center gap-3 mb-3">
                <span className={`section-label text-xs border px-2 py-0.5 ${HYP_COLOR[active.hyp] ?? 'text-muted'}`}>
                  {active.hyp.toUpperCase()}
                </span>
                <span className="terminal-text text-xs text-muted">{active.pool}</span>
                <span className="terminal-text text-xs text-muted">Publicada {fmtDate(active.approved_at ?? active.created_at)}</span>
              </div>
              <p className="terminal-text text-sm text-text-dim mb-4">{active.hyp_text}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Ref Price" value={fmt(active.ref_price)} />
                <Stat label="Rango" value={`-${fmtPct(active.range_low_pct)} / +${fmtPct(active.range_high_pct)}`} />
                <Stat label="APR Pool" value="Ver modelo" />
                <Stat label="Kelly %" value={`${active.kelly_pct?.toFixed(0)}%`} />
              </div>
            </div>
          ) : (
            <div className="glass-card p-5 border border-border">
              <p className="terminal-text text-sm text-muted">Sin señal activa actualmente.</p>
            </div>
          )}
        </section>

        {/* Señales pendientes de aprobación */}
        <section>
          <div className="section-label text-gold mb-3">
            {'// PENDIENTES DE APROBACIÓN'}
            {pending.length > 0 && (
              <span className="ml-2 bg-yellow-400/20 text-yellow-400 text-[10px] px-2 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </div>

          {pending.length === 0 ? (
            <div className="glass-card p-5 border border-border">
              <p className="terminal-text text-sm text-muted">Sin señales pendientes.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((sig) => (
                <div key={sig.id} className="glass-card p-6 border border-yellow-400/20">
                  {/* Header señal */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className={`section-label text-xs border px-2 py-0.5 ${HYP_COLOR[sig.hyp] ?? 'text-muted'}`}>
                      {sig.hyp.toUpperCase()}
                    </span>
                    <span className="terminal-text text-xs text-muted">{sig.pool}</span>
                    <span className="terminal-text text-xs text-muted">Generada {fmtDate(sig.created_at)}</span>
                    <span className="terminal-text text-xs text-muted">Fuente: {sig.source}</span>
                  </div>

                  {/* Texto del modelo */}
                  <p className="terminal-text text-sm text-text-dim mb-5">{sig.hyp_text}</p>

                  {/* Métricas clave */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    <Stat label="Regime Score" value={`${sig.regime_score?.toFixed(0)}/100`} accent="text-gold" />
                    <Stat label="ATR 24h" value={`${sig.atr_24h_pct?.toFixed(2)}%`} />
                    <Stat label="Ref Price" value={fmt(sig.ref_price)} />
                    <Stat label="Fee Tier" value={`${((sig.fee_tier ?? 0) * 100).toFixed(2)}%`} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    <Stat label="Rango bajo" value={`-${fmtPct(sig.range_low_pct)}`} accent="text-red-400" />
                    <Stat label="Rango alto" value={`+${fmtPct(sig.range_high_pct)}`} accent="text-emerald-400" />
                    <Stat label="Tick Lower" value={fmt(sig.tick_lower)} />
                    <Stat label="Tick Upper" value={fmt(sig.tick_upper)} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    <Stat label="Kelly %" value={`${sig.kelly_pct?.toFixed(0)}%`} accent="text-gold" />
                    <Stat label="Vol 24h" value={`$${sig.vol_daily_m?.toFixed(1)}M`} />
                    <Stat label="Horizonte" value={`${sig.days_projected}d`} />
                  </div>

                  {/* Raw pool data colapsable */}
                  {sig.raw_pool_data && (
                    <div className="mb-5">
                      <button
                        onClick={() => setRawOpen(!rawOpen)}
                        className="terminal-text text-xs text-muted hover:text-gold transition-colors mb-2"
                      >
                        {rawOpen ? '▼' : '▶'} raw_pool_data
                      </button>
                      {rawOpen && (
                        <pre className="bg-surface border border-border p-3 text-[11px] terminal-text text-text-dim overflow-auto max-h-48">
                          {JSON.stringify(sig.raw_pool_data, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex items-center gap-3 pt-3 border-t border-border">
                    <button
                      onClick={() => approve(sig.id)}
                      disabled={working}
                      className="section-label text-sm bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 px-6 py-2.5 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                    >
                      APROBAR Y PUBLICAR
                    </button>
                    <button
                      onClick={() => reject(sig.id)}
                      disabled={working}
                      className="section-label text-sm bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-2.5 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                    >
                      RECHAZAR
                    </button>
                    {working && (
                      <span className="terminal-text text-xs text-muted animate-pulse">procesando...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Historial */}
        <section>
          <div className="section-label text-gold mb-3">{'// HISTORIAL (últimas 10)'}</div>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-xs terminal-text">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="text-left px-4 py-2.5 section-label">Fecha</th>
                  <th className="text-left px-4 py-2.5 section-label">Hipótesis</th>
                  <th className="text-left px-4 py-2.5 section-label">Pool</th>
                  <th className="text-left px-4 py-2.5 section-label">Score</th>
                  <th className="text-left px-4 py-2.5 section-label">Fuente</th>
                  <th className="text-left px-4 py-2.5 section-label">Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-border/50 hover:bg-surface/50">
                    <td className="px-4 py-2.5 text-muted">{fmtDate(h.created_at)}</td>
                    <td className={`px-4 py-2.5 ${HYP_COLOR[h.hyp]?.split(' ')[0] ?? 'text-muted'}`}>
                      {h.hyp?.toUpperCase()}
                    </td>
                    <td className="px-4 py-2.5 text-text-dim">{h.pool}</td>
                    <td className="px-4 py-2.5 text-text-dim">{h.regime_score}</td>
                    <td className="px-4 py-2.5 text-muted">{h.source}</td>
                    <td className="px-4 py-2.5">
                      {h.is_active
                        ? <span className="text-emerald-400">ACTIVA</span>
                        : h.rejected_at
                        ? <span className="text-red-400">RECHAZADA</span>
                        : h.approved_at
                        ? <span className="text-muted">EXPIRADA</span>
                        : <span className="text-yellow-400">PENDIENTE</span>}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-muted">Sin historial aún.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-surface border border-border px-3 py-2.5">
      <div className="section-label text-[10px] text-muted mb-1">{label}</div>
      <div className={`terminal-text text-sm font-medium ${accent ?? 'text-text'}`}>{value}</div>
    </div>
  )
}
