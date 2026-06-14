'use client'
import { useState, useEffect } from 'react'

interface PanelData {
  regime: string
  equity: number
  equity_initial: number
  last_decision_at: string | null
  snapshot_trigger: string | null
  bayesian_confirmed: number
  bayesian_watching: number
  coverage_active: number
  coverage_target: number
  wr: number
  promoted_today: number
}

interface CycleStep { asset: string; tf: string; from: string; to: string }

function parseSnapshot(raw: string | null): CycleStep[] {
  if (!raw) return []
  return raw
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map(s => {
      const [header = '', transition = ''] = s.split(':').map(p => p.trim())
      const parts  = header.split(' ')
      const asset  = parts[0] ?? ''
      const tf     = parts[1] ?? ''
      const [fromRaw = '', toRaw = ''] = transition.split('→').map(p => p.trim())
      const from   = fromRaw.split('|')[0].replace(/_/g, ' ')
      const to     = toRaw.split('|')[0].replace(/_/g, ' ')
      return { asset, tf, from, to }
    })
    .filter(s => s.asset)
}

function relTime(iso: string | null): string {
  if (!iso) return '--'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diff < 1)  return '<1m'
  if (diff < 60) return `${diff}m`
  return `${Math.floor(diff / 60)}h`
}

const REGIME_COLOR: Record<string, string> = {
  BEAR: '#f87171', BULL: '#34d399', NEUTRAL: '#d4af37', UNKNOWN: '#7a7f9a',
}

export default function EngineHeroPanel() {
  const [data,   setData]   = useState<PanelData | null>(null)
  const [tick,   setTick]   = useState('')

  async function load() {
    try {
      const r = await fetch('/api/public/landing-data', { cache: 'no-store' })
      if (r.ok) {
        setData(await r.json())
        setTick(new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }))
      }
    } catch {}
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  const rc   = data ? (REGIME_COLOR[data.regime] ?? '#7a7f9a') : '#7a7f9a'
  const ret  = data ? (((data.equity - data.equity_initial) / data.equity_initial) * 100).toFixed(1) : '--'
  const steps = parseSnapshot(data?.snapshot_trigger ?? null)

  return (
    <div className="relative border border-gold/20 bg-surface/60 backdrop-blur-sm overflow-hidden">
      {/* top scan line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gold/10">
        <span className="terminal-text text-[9px] text-gold/60 tracking-[0.3em]">{'// SIGMA ENGINE · LIVE'}</span>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="terminal-text text-[9px] text-muted">{tick || '--:--'}</span>
        </div>
      </div>

      {/* ── Régimen + última decisión ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px bg-gold/8 border-b border-gold/10">
        <div className="bg-surface px-5 py-4">
          <div className="terminal-text text-[9px] text-muted tracking-[0.25em] uppercase mb-2">Régimen</div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: rc }} />
            <span className="terminal-text text-sm font-bold" style={{ color: rc }}>
              {data?.regime ?? '---'}
            </span>
          </div>
        </div>
        <div className="bg-surface px-5 py-4">
          <div className="terminal-text text-[9px] text-muted tracking-[0.25em] uppercase mb-2">Última decisión</div>
          <div className="terminal-text text-sm font-bold text-text">
            hace {relTime(data?.last_decision_at ?? null)}
          </div>
        </div>
      </div>

      {/* ── Snapshot trigger — lo que el motor vio ──────────────────────── */}
      <div className="border-b border-gold/10">
        <div className="px-5 pt-4 pb-2">
          <span className="terminal-text text-[9px] text-gold/50 tracking-[0.25em]">{'// ÚLTIMO CICLO DEL MOTOR'}</span>
        </div>

        <div className="px-5 pb-4 flex flex-col gap-2 min-h-[64px]">
          {steps.length > 0 ? steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="terminal-text text-[10px] font-bold text-text w-8 shrink-0">{s.asset}</span>
              <span className="terminal-text text-[9px] text-muted w-6 shrink-0">{s.tf}</span>
              <span className="terminal-text text-[9px] text-text-dim truncate max-w-[80px]">{s.from}</span>
              <span className="terminal-text text-[9px] text-gold/60 shrink-0">→</span>
              <span className="terminal-text text-[9px] text-gold truncate">{s.to}</span>
            </div>
          )) : (
            <div className="terminal-text text-[9px] text-muted italic">aguardando ciclo…</div>
          )}
        </div>

        {data?.promoted_today ? (
          <div className="px-5 py-2 border-t border-gold/8 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            <span className="terminal-text text-[9px] text-emerald-400">
              {data.promoted_today} champion{data.promoted_today > 1 ? 's' : ''} promovido{data.promoted_today > 1 ? 's' : ''} hoy
            </span>
          </div>
        ) : null}
      </div>

      {/* ── Stats: bayesian · modelos · fire ────────────────────────────── */}
      <div className="grid grid-cols-3 gap-px bg-gold/8">

        <div className="bg-surface px-4 py-4 flex flex-col gap-1">
          <div className="terminal-text text-[8px] text-muted tracking-[0.2em] uppercase">Bayesian</div>
          <div className="num text-xl font-bold text-gold tabular-nums">
            {data?.bayesian_confirmed ?? '--'}
          </div>
          <div className="terminal-text text-[8px] text-muted leading-tight">
            edge confirmado<br />
            <span className="text-text-dim">{data?.bayesian_watching ?? '--'} en estudio</span>
          </div>
        </div>

        <div className="bg-surface px-4 py-4 flex flex-col gap-1">
          <div className="terminal-text text-[8px] text-muted tracking-[0.2em] uppercase">Modelos</div>
          <div className="num text-xl font-bold text-text tabular-nums">
            {data ? `${data.coverage_active}/${data.coverage_target}` : '--'}
          </div>
          <div className="w-full h-1 bg-border rounded-full overflow-hidden mt-1">
            <div
              className="h-full rounded-full bg-gold/60"
              style={{ width: data ? `${(data.coverage_active / data.coverage_target) * 100}%` : '0%' }}
            />
          </div>
        </div>

        <div className="bg-surface px-4 py-4 flex flex-col gap-1">
          <div className="terminal-text text-[8px] text-muted tracking-[0.2em] uppercase">Fire Eq.</div>
          <div className="num text-lg font-bold text-gold tabular-nums leading-tight">
            ${data ? Math.round(data.equity).toLocaleString('es-CL') : '--'}
          </div>
          <div className="terminal-text text-[9px] text-emerald-400 tabular-nums">
            +{ret}%
          </div>
        </div>
      </div>

      {/* bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
    </div>
  )
}
