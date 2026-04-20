'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { C } from '@/app/lib/constants'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

// ── Types ─────────────────────────────────────────────────────────────────────

interface Signal {
  id:             string
  created_at:     string
  published_at:   string | null
  expires_at:     string | null
  hyp:            string
  hyp_text:       string
  pool:           string
  fee_tier:       number
  range_low_pct:  number
  range_high_pct: number
  ref_price:      number
  tick_lower:     number
  tick_upper:     number
  kelly_pct:      number
  vol_daily_m:    number
  days_projected: number
  regime_score:   number
  atr_24h_pct:    number
}

// ── Hypothesis config ─────────────────────────────────────────────────────────

const HYP: Record<string, { label: string; color: string; bg: string; sigClass: 'go' | 'wait' | 'no' }> = {
  ranging:     { label: 'LATERAL — DEPLOY LIQUIDEZ',   color: C.green,  bg: 'rgba(52,211,153,0.07)',  sigClass: 'go'   },
  compression: { label: 'COMPRESIÓN — ESPERAR',        color: C.yellow, bg: 'rgba(251,191,36,0.07)',  sigClass: 'wait' },
  reversion:   { label: 'REVERSIÓN A MEDIA',           color: C.green,  bg: 'rgba(52,211,153,0.07)',  sigClass: 'go'   },
  none:        { label: 'SIN SEÑAL ACTIVA',            color: C.muted,  bg: 'transparent',            sigClass: 'no'   },
}

const SIG_COLORS = {
  go:   { border: '#0F6E56', bg: 'rgba(15,110,86,0.10)',  title: '#5DCAA5' },
  wait: { border: '#854F0B', bg: 'rgba(133,79,11,0.10)', title: '#EF9F27' },
  no:   { border: C.border,  bg: C.surface,               title: C.muted   },
}

// ── Monte Carlo ───────────────────────────────────────────────────────────────

function runMonteCarlo(feesDay: number, capital: number, ilMax: number, days: number, n = 500): number[] {
  const results: number[] = []
  for (let i = 0; i < n; i++) {
    const volFactor   = 0.4 + Math.random() * 1.8
    const priceWalk   = (Math.random() - 0.48) * 0.15
    const daysInRange = Math.max(0, days * (1 - Math.abs(priceWalk) * 3.5))
    const feesEarned  = feesDay * volFactor * daysInRange
    const ilCost      = capital * (ilMax / 100) * Math.min(1, Math.abs(priceWalk) * 7)
    results.push((feesEarned - ilCost) / capital * 100)
  }
  return results.sort((a, b) => a - b)
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtUsd  = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`
const fmtUsd2 = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct  = (v: number, d = 1) => `${v.toFixed(d)}%`

// ── Component ─────────────────────────────────────────────────────────────────

export default function LpSignalPage() {
  const router = useRouter()

  const [signal,   setSignal]   = useState<Signal | null>(null)
  const [noSig,    setNoSig]    = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [btcPrice, setBtcPrice] = useState<number>(0)
  const [capital,  setCapital]  = useState(() => {
    if (typeof window === 'undefined') return 5000
    return parseFloat(localStorage.getItem('sigma_lp_client_pat') || '5000')
  })
  const [copied, setCopied] = useState(false)

  // ── Data loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/lp-signal/active')
      .then(r => r.json())
      .then(({ signal: s }) => { if (s) setSignal(s); else setNoSig(true) })
      .catch(() => setNoSig(true))
      .finally(() => setLoading(false))
  }, [])

  // Live BTC price via WebSocket
  useEffect(() => {
    let ws: WebSocket
    function connect() {
      ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@miniTicker')
      ws.onmessage = (e) => {
        try { setBtcPrice(parseFloat(JSON.parse(e.data).c)) } catch {}
      }
      ws.onerror = () => ws.close()
      ws.onclose = () => setTimeout(connect, 5000)
    }
    connect()
    return () => ws?.close()
  }, [])

  function saveCapital(v: number) {
    setCapital(v)
    localStorage.setItem('sigma_lp_client_pat', String(v))
  }

  // ── Derived calculations ──────────────────────────────────────────────────────

  const calc = useMemo(() => {
    if (!signal) return null
    const price    = btcPrice > 0 ? btcPrice : signal.ref_price
    const pLow     = price  * (1 - signal.range_low_pct  / 100)
    const pHigh    = price  * (1 + signal.range_high_pct / 100)
    const rangeW   = signal.range_low_pct + signal.range_high_pct
    const sqrtR    = Math.sqrt(pHigh / pLow)
    const eff      = sqrtR / (sqrtR - 1)
    const ilMax    = Math.abs(2 * sqrtR / (1 + sqrtR) - 1) * 100
    const kelly    = signal.kelly_pct / 100
    const cap      = capital * kelly
    const volDaily = signal.vol_daily_m * 1_000_000
    const liqShare = cap / (cap + 2_000_000)
    const feesDay  = volDaily * signal.fee_tier * liqShare * eff * 0.0012
    const aprAnn   = cap > 0 ? (feesDay * 365 / cap) * 100 : 0
    const beDays   = feesDay > 0 ? (cap * (ilMax / 100)) / feesDay : 999
    const retProj  = feesDay * signal.days_projected

    // Range visualisation
    const chartMin = price * 0.88
    const chartMax = price * 1.12
    const span     = chartMax - chartMin
    const toX      = (v: number) => Math.max(0, Math.min(100, ((v - chartMin) / span) * 100))
    const xL = toX(pLow), xH = toX(pHigh), xP = toX(price)

    // Monte Carlo
    const mc      = runMonteCarlo(feesDay, cap, ilMax, signal.days_projected)
    const mcMean  = mc.reduce((s, v) => s + v, 0) / mc.length
    const mcP10   = mc[Math.floor(mc.length * 0.1)]
    const mcP90   = mc[Math.floor(mc.length * 0.9)]
    const mcPos   = mc.filter(v => v > 0).length / mc.length * 100
    const BIN_N   = 24
    const minV    = mc[0], maxV = mc[mc.length - 1]
    const bw      = (maxV - minV) / BIN_N || 1
    const bins    = Array.from({ length: BIN_N }, (_, i) => {
      const lo = minV + i * bw
      return { label: (lo + bw / 2).toFixed(1), count: mc.filter(v => v >= lo && v < lo + bw).length, pos: lo + bw / 2 >= 0 }
    })

    return {
      price, pLow, pHigh, rangeW, eff, ilMax,
      kelly, cap, feesDay, aprAnn, beDays, retProj,
      xL, xH, xP,
      mc: { mean: mcMean, p10: mcP10, p90: mcP90, posProb: mcPos, bins },
    }
  }, [signal, btcPrice, capital])

  // ── Summary text ─────────────────────────────────────────────────────────────

  const summaryText = useMemo(() => {
    if (!signal || !calc) return ''
    const hyp = HYP[signal.hyp]?.label ?? signal.hyp
    return `SIGMA RESEARCH — LP SIGNAL
─────────────────────────
Pool:          ${signal.pool} ${(signal.fee_tier * 100).toFixed(2)}% (PancakeSwap v3)
Hipótesis:     ${hyp}
Precio BTC:    ${fmtUsd(calc.price)}
─────────────────────────
Tick inferior: ${fmtUsd(calc.pLow)}
Tick superior: ${fmtUsd(calc.pHigh)}
Amplitud:      ${fmtPct(calc.rangeW)}
─────────────────────────
Capital LP:    ${fmtUsd(calc.cap)} (${fmtPct(signal.kelly_pct, 0)} patrimonio)
APR estimado:  ${fmtPct(calc.aprAnn)}
Fees / día:    ${fmtUsd2(calc.feesDay)}
Retorno esp.:  ${fmtUsd2(calc.retProj)} en ${signal.days_projected}d
IL máximo:     ${fmtPct(calc.ilMax)}
─────────────────────────
Señal:         ${hyp}
${signal.published_at ? 'Publicada: ' + new Date(signal.published_at).toLocaleString('es-CL') : ''}
${signal.hyp_text}`
  }, [signal, calc])

  function copySummary() {
    navigator.clipboard.writeText(summaryText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Shared styles ─────────────────────────────────────────────────────────────

  const mono: React.CSSProperties = { fontFamily: "var(--font-dm-mono,'DM Mono',monospace)" }
  const sectionTitle = (mb = 12): React.CSSProperties => ({ ...mono, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: mb, marginTop: 24 })

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ ...mono, fontSize: 11, color: C.dimText, letterSpacing: '0.15em' }}>CARGANDO SEÑAL…</span>
    </div>
  )

  const hyp      = signal ? (HYP[signal.hyp] ?? HYP.none) : HYP.none
  const sigColor = SIG_COLORS[hyp.sigClass]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, ...mono }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 64px' }}>

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.25em', color: C.dimText, marginBottom: 6 }}>
              {'// SIGMA LP SIGNAL · PANCAKESWAP V3'}
            </div>
            <h1 style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 'clamp(36px,5vw,56px)', letterSpacing: '0.05em', margin: 0, lineHeight: 1 }}>
              LP <span style={{ color: C.gold }}>SIGNAL</span>
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 3 }}>
              BTC{' '}
              <span style={{ color: C.gold }}>
                {btcPrice > 0 ? fmtUsd(btcPrice) : '—'}
              </span>
              {btcPrice > 0 && <span style={{ fontSize: 9, color: C.green, marginLeft: 6 }}>● LIVE</span>}
            </div>
            <div style={{ fontSize: 9, color: C.muted }}>
              {new Date().toLocaleString('es-CL')}
            </div>
            <button
              onClick={() => router.push('/admin/lp-signal')}
              style={{ marginTop: 8, padding: '4px 10px', background: 'transparent', border: `1px solid ${C.border}`, color: C.dimText, fontSize: 9, letterSpacing: '0.15em', cursor: 'pointer' }}
            >
              MODO OPERADOR →
            </button>
          </div>
        </div>

        {/* ── No signal ────────────────────────────────────────────────────────── */}
        {(noSig || !signal) && (
          <div style={{ border: `1px solid ${C.border}`, background: C.surface, padding: '40px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.15em', color: C.muted, marginBottom: 12 }}>SIN SETUP ACTIVO</div>
            <p style={{ fontSize: 13, color: C.dimText, lineHeight: 1.7, margin: 0 }}>
              El modelo no detecta condiciones óptimas para LP en este momento.<br />
              BTC podría estar en tendencia. Capital sugerido: futuros / spot.
            </p>
          </div>
        )}

        {signal && calc && (() => {
          return (
            <>
              {/* ── Signal badge ───────────────────────────────────────────────── */}
              <div style={{ border: `1px solid ${sigColor.border}`, background: sigColor.bg, padding: '16px 20px', marginBottom: 24, borderRadius: 2 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: sigColor.title, marginBottom: 6 }}>
                  {hyp.label}
                </div>
                <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>{signal.hyp_text}</div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 8 }}>
                  {signal.published_at
                    ? `Señal publicada: ${new Date(signal.published_at).toLocaleString('es-CL')} · Precio ref: ${fmtUsd(signal.ref_price)}`
                    : 'Sin publicación registrada'}
                  {' · '}Score régimen: {signal.regime_score}/100 · ATR 24h: {fmtPct(signal.atr_24h_pct)}
                </div>
              </div>

              {/* ── Range visualisation ────────────────────────────────────────── */}
              <div style={sectionTitle()}>{'// RANGO RECOMENDADO (precio live)'}</div>
              <div style={{ position: 'relative', height: 52, background: '#0d0e15', overflow: 'hidden', marginBottom: 10, borderRadius: 4 }}>
                {/* out-of-range left */}
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${calc.xL}%`, background: 'rgba(248,113,113,0.15)' }} />
                {/* in-range */}
                <div style={{ position: 'absolute', top: 0, left: `${calc.xL}%`, height: '100%', width: `${Math.max(0, calc.xH - calc.xL)}%`, background: 'rgba(52,211,153,0.18)' }} />
                {/* out-of-range right */}
                <div style={{ position: 'absolute', top: 0, left: `${calc.xH}%`, height: '100%', width: `${100 - calc.xH}%`, background: 'rgba(248,113,113,0.15)' }} />
                {/* tick lower */}
                <div style={{ position: 'absolute', top: 0, left: `${calc.xL}%`, height: '100%', width: 2, background: '#378ADD', opacity: 0.8 }} />
                {/* tick upper */}
                <div style={{ position: 'absolute', top: 0, left: `${calc.xH}%`, height: '100%', width: 2, background: '#378ADD', opacity: 0.8 }} />
                {/* price */}
                <div style={{ position: 'absolute', top: 0, left: `calc(${calc.xP}% - 1px)`, height: '100%', width: 2, background: C.gold }} />
                {/* labels */}
                <div style={{ position: 'absolute', bottom: 4, left: '2%', fontSize: 9, color: '#555', ...mono }}>{fmtUsd(calc.pLow)}</div>
                <div style={{ position: 'absolute', bottom: 4, right: '2%', fontSize: 9, color: '#555', ...mono, textAlign: 'right' }}>{fmtUsd(calc.pHigh)}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 20 }}>
                {[
                  { k: 'Tick inferior (SL)', v: fmtUsd(calc.pLow),        c: C.red   },
                  { k: 'Tick superior (TP)', v: fmtUsd(calc.pHigh),       c: C.green },
                  { k: 'Amplitud del rango', v: fmtPct(calc.rangeW),      c: C.text  },
                  { k: 'Capital efficiency', v: `${calc.eff.toFixed(1)}x`, c: C.gold  },
                ].map(({ k, v, c }) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `0.5px solid ${C.border}` }}>
                    <span style={{ fontSize: 11, color: C.dimText }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: c }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* ── Capital input ──────────────────────────────────────────────── */}
              <div style={sectionTitle()}>{'// TU CAPITAL'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: C.dimText }}>Patrimonio total ($)</span>
                <input
                  type="number"
                  value={capital}
                  min={100}
                  step={100}
                  onChange={e => saveCapital(Math.max(100, parseFloat(e.target.value) || 100))}
                  style={{ background: '#0d0e15', border: `1px solid ${C.border}`, color: C.text, fontSize: 14, padding: '6px 10px', width: 150, ...mono, outline: 'none', borderRadius: 4 }}
                />
              </div>
              {/* allocation bar */}
              <div style={{ height: 8, background: '#0d0e15', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: `${Math.min(100, signal.kelly_pct)}%`, background: C.gold, borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 11, color: C.dimText, marginBottom: 8 }}>
                <span style={{ color: C.gold, fontWeight: 600 }}>{fmtUsd(calc.cap)}</span> → LP &nbsp;|&nbsp;
                <span>{fmtUsd(capital - calc.cap)}</span> fuera
              </div>

              {/* ── Projection metrics ─────────────────────────────────────────── */}
              <div style={sectionTitle()}>{'// PROYECCIÓN DEL MODELO'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 8, marginBottom: 24 }}>
                {[
                  { l: 'Capital a depositar', v: fmtUsd(calc.cap),           c: C.gold  },
                  { l: 'APR estimado',         v: fmtPct(calc.aprAnn),        c: C.green },
                  { l: `Fees / día`,           v: fmtUsd2(calc.feesDay),      c: C.text  },
                  { l: 'IL máximo',            v: fmtPct(calc.ilMax),         c: C.yellow },
                  { l: `Retorno ${signal.days_projected}d`, v: fmtUsd2(calc.retProj), c: C.green },
                  { l: 'Break-even días',      v: calc.beDays > 999 ? '>999d' : `${calc.beDays.toFixed(0)}d`, c: C.text },
                ].map(({ l, v, c }) => (
                  <div key={l} style={{ background: '#0d0e15', borderRadius: 6, padding: '12px 14px' }}>
                    <div style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>{l.toUpperCase()}</div>
                    <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 22, color: c, lineHeight: 1 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* ── Monte Carlo ────────────────────────────────────────────────── */}
              <div style={sectionTitle()}>{'// MONTE CARLO — 500 ESCENARIOS'}</div>
              <div style={{ height: 130, marginBottom: 10 }}>
                <Bar
                  data={{
                    labels: calc.mc.bins.map(b => b.label),
                    datasets: [{
                      data: calc.mc.bins.map(b => b.count),
                      backgroundColor: calc.mc.bins.map(b => b.pos ? 'rgba(52,211,153,0.65)' : 'rgba(248,113,113,0.55)'),
                      borderWidth: 0,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, titleColor: C.dimText, bodyColor: C.text, callbacks: { title: (items) => `${items[0].label}%`, label: (item) => `${item.raw} escenarios` } } },
                    scales: {
                      x: { ticks: { color: C.muted, font: { family: 'monospace', size: 9 }, maxTicksLimit: 7 }, grid: { color: '#111' } },
                      y: { ticks: { color: C.muted, font: { family: 'monospace', size: 9 } }, grid: { color: '#111' } },
                    },
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 24 }}>
                {[
                  { l: 'P10',        v: fmtPct(calc.mc.p10),            c: C.yellow },
                  { l: 'Esperado',   v: fmtPct(calc.mc.mean),           c: C.green  },
                  { l: 'P90',        v: fmtPct(calc.mc.p90),            c: C.green  },
                  { l: 'Prob > 0',   v: `${calc.mc.posProb.toFixed(0)}%`, c: C.text },
                ].map(({ l, v, c }) => (
                  <div key={l} style={{ background: '#0d0e15', borderRadius: 6, padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: C.muted, marginBottom: 3 }}>{l}</div>
                    <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 18, color: c }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* ── Summary ────────────────────────────────────────────────────── */}
              <div style={sectionTitle()}>{'// RESUMEN PARA CLIENTE'}</div>
              <div style={{ background: '#0d0e15', border: `1px solid ${C.border}`, borderRadius: 4, padding: '14px 16px', fontSize: 11, lineHeight: 1.8, color: '#aaa', whiteSpace: 'pre-wrap', marginBottom: 10, ...mono }}>
                {summaryText}
              </div>
              <button
                onClick={copySummary}
                style={{ padding: '8px 20px', background: copied ? C.green : 'transparent', color: copied ? C.bg : C.dimText, border: `1px solid ${copied ? C.green : C.border}`, fontSize: 10, letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.2s', ...mono }}
              >
                {copied ? '✓ COPIADO' : 'COPIAR RESUMEN'}
              </button>
            </>
          )
        })()}

      </div>
    </div>
  )
}
