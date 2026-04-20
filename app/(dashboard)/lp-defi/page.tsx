'use client'
import { useState, useMemo, useEffect } from 'react'
import { C } from '@/app/lib/constants'

// ── Design tokens ──────────────────────────────────────────────────────────────
const MONO = "var(--font-dm-mono,'DM Mono',monospace)"
const GN   = '#1D9E75'
const RD   = '#E24B4A'
const AM   = '#BA7517'
const GOLD = '#d4af37'
const BL   = '#4a9eff'

// ── Same PLATFORMS as Home for totalUSD ────────────────────────────────────────
const PLATFORMS = [
  { id: 'ibkr',            isCLP: false },
  { id: 'binance_spot',    isCLP: false },
  { id: 'binance_futures', isCLP: false },
  { id: 'fintual',         isCLP: true  },
  { id: 'santander',       isCLP: true  },
  { id: 'cash',            isCLP: false },
] as const

const TRM = 950

type PortfolioRow = Record<string, number>
type AutoStrategy = 'conservadora' | 'balanceada' | 'agresiva'

// ── Helpers ────────────────────────────────────────────────────────────────────
const usd  = (n: number) => '$' + Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
const usd2 = (n: number) => '$' + n.toFixed(2)
const pct  = (n: number, d = 1) => n.toFixed(d) + '%'

function regimeColor(regime: string): string {
  if (regime === 'COMPRESIÓN') return GN
  if (regime === 'RANGO')      return GOLD
  if (regime === 'TENDENCIA')  return BL
  return RD
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Label({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dimText, marginBottom: 4 }}>
      {children}
    </div>
  )
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '20px 22px', ...style }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.dimText, marginBottom: 14 }}>
      {children}
    </div>
  )
}


function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, padding: '12px 14px', textAlign: 'center' }}>
      <Label>{label}</Label>
      <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, color }}>{value}</div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function LpDefiPage() {
  const [btcPrice,    setBtcPrice]    = useState(84_000)
  const [priceChange, setPriceChange] = useState(0)
  const [portfolio,   setPortfolio]   = useState<PortfolioRow>({})
  const [copied,      setCopied]      = useState(false)

  // Live BTC price via Binance WebSocket
  useEffect(() => {
    let ws: WebSocket
    let prev = 0
    function connect() {
      ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@miniTicker')
      ws.onmessage = (e: MessageEvent) => {
        const d = JSON.parse(e.data as string) as { c: string }
        const p = parseFloat(d.c)
        if (prev > 0) setPriceChange(((p - prev) / prev) * 100)
        prev = p
        setBtcPrice(p)
      }
      ws.onclose = () => setTimeout(connect, 5000)
    }
    connect()
    return () => ws?.close()
  }, [])

  // Portfolio from localStorage (same key as Home)
  useEffect(() => {
    try {
      const r = localStorage.getItem('sigma_portfolio')
      if (r) setPortfolio(JSON.parse(r) as PortfolioRow)
    } catch { /* ignore */ }
  }, [])

  // totalUSD — identical logic to Home
  const totalUSD = useMemo(() =>
    PLATFORMS.reduce((sum, p) => {
      const raw = portfolio[p.id] ?? 0
      return sum + (p.isCLP ? raw / TRM : raw)
    }, 0),
    [portfolio]
  )

  // ── Quantitative engine ───────────────────────────────────────────────────────
  const engine = useMemo(() => {
    // REGIME from price volatility (priceChange as ATR proxy)
    const absChange = Math.abs(priceChange)
    const atrPct = Math.max(0.5, Math.min(15, absChange * 8))

    const regime: string =
      atrPct < 1.5 ? 'COMPRESIÓN' :
      atrPct < 4   ? 'RANGO'      :
      atrPct < 8   ? 'TENDENCIA'  : 'ALTA VOL'

    // OB levels (auto)
    const obLower = btcPrice * (1 - atrPct / 100)
    const obUpper = btcPrice * (1 + atrPct / 100)

    // Strategy selection by regime
    const autoStrategy: AutoStrategy =
      regime === 'COMPRESIÓN' ? 'agresiva' :
      regime === 'RANGO'      ? 'balanceada' : 'conservadora'

    // Range per strategy
    const ranges: Record<AutoStrategy, { lo: number; hi: number; label: string }> = {
      conservadora: { lo: 0.12, hi: 0.12, label: '±12%' },
      balanceada:   { lo: 0.06, hi: 0.06, label: '±6%'  },
      agresiva:     { lo: 0.03, hi: 0.03, label: '±3%'  },
    }
    const r = ranges[autoStrategy]
    const pLow  = btcPrice * (1 - r.lo)
    const pHigh = btcPrice * (1 + r.hi)

    // Capital efficiency
    const sqrtR = Math.sqrt(pHigh / pLow)
    const eff   = sqrtR / (sqrtR - 1)

    // IL max
    const ilPct = Math.abs(2 * sqrtR / (1 + sqrtR) - 1) * 100

    // Kelly sizing (Sigma PRO.MACD parameters)
    const winRate   = 0.852
    const avgWin    = 3.62
    const avgLoss   = 5.03
    const kellyFull = winRate - (1 - winRate) / (avgWin / avgLoss)
    const kellyFrac = kellyFull * 0.25
    const regimeFactor: number =
      regime === 'COMPRESIÓN' ? 0.6 :
      regime === 'RANGO'      ? 1.0 :
      regime === 'TENDENCIA'  ? 0.3 : 0.1
    const capitalLP = Math.max(0, totalUSD * kellyFrac * regimeFactor)

    // Days recommended
    const daysRec: number =
      regime === 'COMPRESIÓN' ? 7  :
      regime === 'RANGO'      ? 14 :
      regime === 'TENDENCIA'  ? 3  : 1

    // APR estimate (BTC/USDC pool ~$131M daily, 0.05% fee)
    const poolVolume   = 131_000_000
    const feeTier      = 0.0005
    const liqShare     = capitalLP > 0 ? capitalLP / (capitalLP + 2_000_000) : 0
    const feesPerDay   = poolVolume * feeTier * liqShare * eff * 0.0012
    const feesTotal    = feesPerDay * daysRec
    const aprEstimated = capitalLP > 0 ? (feesPerDay * 365 / capitalLP) * 100 : 0

    // IL in USD
    const ilUSD    = capitalLP * (ilPct / 100)
    const breakEven = feesPerDay > 0 ? ilUSD / feesPerDay : 999

    // Net PnL
    const netPnL = feesTotal - ilUSD

    // Monte Carlo (500 sims)
    const mc: number[] = []
    for (let i = 0; i < 500; i++) {
      const volF   = 0.4 + Math.random() * 1.8
      const walk   = (Math.random() - 0.48) * 0.15
      const daysIn = Math.max(0, daysRec * (1 - Math.abs(walk) * 3.5))
      const earned = feesPerDay * volF * daysIn
      const ilCost = capitalLP * (ilPct / 100) * Math.min(1, Math.abs(walk) * 7)
      mc.push(capitalLP > 0 ? (earned - ilCost) / capitalLP * 100 : 0)
    }
    mc.sort((a, b) => a - b)
    const mcMean    = mc.reduce((a, b) => a + b, 0) / mc.length
    const mcP10     = mc[Math.floor(mc.length * 0.1)]
    const mcP90     = mc[Math.floor(mc.length * 0.9)]
    const mcPosProb = mc.filter(v => v > 0).length / mc.length * 100

    // Histogram (24 bins)
    const BINS = 24
    const minV = mc[0]
    const maxV = mc[mc.length - 1]
    const bw   = ((maxV - minV) / BINS) || 1
    const bins = Array.from({ length: BINS }, (_, i) => {
      const lo  = minV + i * bw
      const hi  = lo + bw
      const mid = (lo + hi) / 2
      return {
        count: mc.filter(v => v >= lo && v < hi).length,
        mid,
        positive: mid > 0,
      }
    })
    const maxCount = Math.max(...bins.map(b => b.count), 1)

    return {
      regime, autoStrategy, atrPct,
      obLower, obUpper,
      pLow, pHigh, rangeLabel: r.label,
      eff, ilPct, ilUSD,
      capitalLP, kellyFrac, regimeFactor,
      daysRec, feesPerDay, feesTotal,
      aprEstimated, breakEven, netPnL,
      mcMean, mcP10, mcP90, mcPosProb,
      bins, maxCount,
    }
  }, [btcPrice, priceChange, totalUSD])

  const rColor = regimeColor(engine.regime)

  // Range visualization helpers (±15% window, price always at center)
  const chartSpan = btcPrice * 0.30
  const chartMin  = btcPrice - chartSpan / 2
  const toX = (v: number) => Math.max(0, Math.min(100, ((v - chartMin) / chartSpan) * 100))
  const xLow   = toX(engine.pLow)
  const xHigh  = toX(engine.pHigh)
  const xPrice = toX(btcPrice) // always ~50%

  // Executive summary
  const summaryText =
`SIGMA RESEARCH — LP CUANTITATIVO
─────────────────────────────────
Régimen:        ${engine.regime}
Estrategia:     ${engine.autoStrategy.toUpperCase()} (${engine.rangeLabel})
BTC Precio:     ${usd(btcPrice)}
─────────────────────────────────
Tick inferior:  ${usd(engine.pLow)}
Tick superior:  ${usd(engine.pHigh)}
Cap. efficiency:${engine.eff.toFixed(1)}x
─────────────────────────────────
Patrimonio:     ${usd(totalUSD)}
Capital LP:     ${usd(engine.capitalLP)}
Kelly aplicado: ${pct(engine.kellyFrac * engine.regimeFactor * 100)}
─────────────────────────────────
APR estimado:   ${pct(engine.aprEstimated)}
Fees /${engine.daysRec}d:      ${usd2(engine.feesTotal)}
IL máximo:      ${pct(engine.ilPct, 2)} (${usd2(engine.ilUSD)})
Retorno esp.:   ${usd2(engine.netPnL)}
Break-even:     ${engine.breakEven.toFixed(0)}d
─────────────────────────────────
MC Esperado:    ${pct(engine.mcMean, 2)}
MC P10/P90:     ${pct(engine.mcP10, 2)} / ${pct(engine.mcP90, 2)}
Prob >0:        ${pct(engine.mcPosProb, 0)}
─────────────────────────────────
Generado: ${new Date().toLocaleString('es-CL')}`

  function handleCopy() {
    navigator.clipboard.writeText(summaryText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: MONO, minHeight: '100%' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* ── A) HEADER ───────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: GOLD, marginBottom: 6 }}>
            {'// LP DEFI · MOTOR CUANTITATIVO AUTOMÁTICO'}
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',var(--font-bebas),Impact,sans-serif", fontSize: 'clamp(40px,5vw,68px)', lineHeight: 0.95, letterSpacing: '0.03em', margin: '0 0 6px' }}>
            <span style={{ color: C.text }}>LP </span>
            <span style={{ color: GOLD }}>DEFI</span>
          </h1>
          <div style={{ fontSize: 11, color: C.dimText, letterSpacing: '0.08em' }}>
            Señal calculada en tiempo real · sin inputs manuales
          </div>
        </div>

        {/* ── B) STATUS BAR — 4 panels ────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: C.border, marginBottom: 16 }}>

          {/* 1. BTC price live */}
          <div style={{ background: C.surface, padding: '16px 18px' }}>
            <Label>BTC PRICE LIVE</Label>
            <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: GOLD, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {usd(btcPrice)}
            </div>
            <div style={{ fontSize: 11, color: priceChange >= 0 ? GN : RD, marginTop: 4, fontWeight: 600 }}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(3)}%
            </div>
          </div>

          {/* 2. Patrimonio base */}
          <div style={{ background: C.surface, padding: '16px 18px' }}>
            <Label>PATRIMONIO BASE</Label>
            <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: GOLD, lineHeight: 1 }}>
              {totalUSD > 0 ? usd(totalUSD) : '—'}
            </div>
            <div style={{ fontSize: 9, color: C.dimText, marginTop: 4 }}>base de cálculo Kelly</div>
          </div>

          {/* 3. Régimen actual */}
          <div style={{ background: C.surface, padding: '16px 18px' }}>
            <Label>RÉGIMEN ACTUAL</Label>
            <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: rColor, lineHeight: 1, letterSpacing: '0.04em' }}>
              {engine.regime}
            </div>
            <div style={{ fontSize: 9, color: C.dimText, marginTop: 4 }}>ATR proxy: {engine.atrPct.toFixed(1)}%</div>
          </div>

          {/* 4. Capital a deployar */}
          <div style={{ background: C.surface, padding: '16px 18px' }}>
            <Label>CAPITAL A DEPLOYAR</Label>
            <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 28, color: GOLD, lineHeight: 1 }}>
              {engine.capitalLP > 0 ? usd(engine.capitalLP) : '—'}
            </div>
            <div style={{ fontSize: 9, color: C.dimText, marginTop: 4 }}>
              Kelly {pct(engine.kellyFrac * 100)} × régimen {pct(engine.regimeFactor * 100, 0)}
            </div>
          </div>
        </div>

        {/* ── C) SIGNAL BANNER ────────────────────────────────────────────────── */}
        <div style={{
          padding: '12px 20px', marginBottom: 20,
          background: `${rColor}0d`,
          borderLeft: `3px solid ${rColor}`,
          borderTop: `1px solid ${rColor}30`,
          borderBottom: `1px solid ${rColor}30`,
          borderRight: `1px solid ${rColor}30`,
        }}>
          <span style={{ fontSize: 10, color: rColor, letterSpacing: '0.2em', marginRight: 12 }}>▶ MOTOR SIGMA</span>
          <span style={{ fontSize: 11, color: C.text }}>
            Régimen <strong style={{ color: rColor }}>{engine.regime}</strong> detectado ·{' '}
            Estrategia AUTO: <strong style={{ color: GOLD }}>{engine.autoStrategy.toUpperCase()}</strong> ·{' '}
            Días recomendados: <strong>{engine.daysRec}d</strong> ·{' '}
            OB Lower: <span style={{ color: RD }}>{usd(engine.obLower)}</span> ·{' '}
            OB Upper: <span style={{ color: GN }}>{usd(engine.obUpper)}</span>
          </span>
        </div>

        {/* ── D) RANGE VISUALIZATION ──────────────────────────────────────────── */}
        <Panel style={{ marginBottom: 20 }}>
          <SectionTitle>{`// RANGO ÓPTIMO · ${engine.rangeLabel} · Capital efficiency ${engine.eff.toFixed(1)}x`}</SectionTitle>

          {/* Visual bar */}
          <div style={{ position: 'relative', height: 56, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            {/* Left red zone */}
            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${xLow}%`, background: `${RD}22` }} />
            {/* Green in-range zone */}
            <div style={{ position: 'absolute', top: 0, left: `${xLow}%`, height: '100%', width: `${Math.max(0, xHigh - xLow)}%`, background: `${GN}22` }} />
            {/* Right red zone */}
            <div style={{ position: 'absolute', top: 0, left: `${xHigh}%`, height: '100%', width: `${100 - xHigh}%`, background: `${RD}22` }} />
            {/* pLow tick (blue) */}
            <div style={{ position: 'absolute', top: 0, left: `${xLow}%`, height: '100%', width: 2, background: BL, opacity: 0.8 }} />
            {/* pHigh tick (blue) */}
            <div style={{ position: 'absolute', top: 0, left: `${xHigh}%`, height: '100%', width: 2, background: BL, opacity: 0.8 }} />
            {/* BTC price (gold) */}
            <div style={{ position: 'absolute', top: 0, left: `calc(${xPrice}% - 1px)`, height: '100%', width: 2, background: GOLD }} />
            {/* Labels */}
            <div style={{ position: 'absolute', bottom: 4, left: `${Math.max(1, xLow - 1)}%`, fontSize: 9, color: BL, fontFamily: MONO, transform: 'translateX(-50%)' }}>
              {usd(engine.pLow)}
            </div>
            <div style={{ position: 'absolute', bottom: 4, left: `${xPrice}%`, fontSize: 9, color: GOLD, fontFamily: MONO, transform: 'translateX(-50%)' }}>
              BTC {usd(btcPrice)}
            </div>
            <div style={{ position: 'absolute', bottom: 4, left: `${Math.min(99, xHigh + 1)}%`, fontSize: 9, color: BL, fontFamily: MONO, transform: 'translateX(-50%)' }}>
              {usd(engine.pHigh)}
            </div>
          </div>

          {/* 4 stat boxes below bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 12 }}>
            <StatBox label="TICK INFERIOR" value={usd(engine.pLow)}    color={RD}  />
            <StatBox label="TICK SUPERIOR" value={usd(engine.pHigh)}   color={GN}  />
            <StatBox label="OB LOWER (AUTO)" value={usd(engine.obLower)} color={RD} />
            <StatBox label="OB UPPER (AUTO)" value={usd(engine.obUpper)} color={GN} />
          </div>
        </Panel>

        {/* ── E) PROJECTION GRID (6 boxes) ────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: C.border, marginBottom: 20 }}>
          {[
            { label: 'CAPITAL LP',                    value: usd(engine.capitalLP),                      color: GOLD },
            { label: 'APR ESTIMADO',                  value: pct(engine.aprEstimated),                   color: GN   },
            { label: 'FEES / DÍA',                    value: usd2(engine.feesPerDay),                    color: C.text },
            { label: 'IL MÁXIMO',                     value: `${pct(engine.ilPct, 2)} → ${usd(engine.ilUSD)}`, color: AM },
            { label: `RETORNO ${engine.daysRec}D`,    value: usd2(engine.netPnL),                        color: engine.netPnL >= 0 ? GN : RD },
            { label: 'BREAK-EVEN',                    value: `${engine.breakEven.toFixed(0)}d`,          color: C.text },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: C.surface, padding: '16px 18px' }}>
              <Label>{label}</Label>
              <div style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", fontSize: 26, color, lineHeight: 1, letterSpacing: '0.02em' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── F) MONTE CARLO ──────────────────────────────────────────────────── */}
        <Panel style={{ marginBottom: 20 }}>
          <SectionTitle>{`// MONTE CARLO · 500 ESCENARIOS · ${engine.daysRec} DÍAS · ${engine.autoStrategy.toUpperCase()}`}</SectionTitle>

          {/* 4 stat boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
            <StatBox label="P10"      value={pct(engine.mcP10, 2)}     color={AM}    />
            <StatBox label="ESPERADO" value={pct(engine.mcMean, 2)}    color={GN}    />
            <StatBox label="P90"      value={pct(engine.mcP90, 2)}     color={GN}    />
            <StatBox label="PROB >0"  value={pct(engine.mcPosProb, 0)} color={C.text} />
          </div>

          {/* CSS histogram */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100, background: C.bg, padding: '8px 8px 0', border: `1px solid ${C.border}` }}>
            {engine.bins.map((bin, i) => (
              <div key={i} style={{
                flex: 1,
                height: `${(bin.count / engine.maxCount) * 100}%`,
                background: bin.positive ? `${GN}cc` : `${RD}cc`,
                minHeight: bin.count > 0 ? 2 : 0,
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 9, color: C.dimText }}>{pct(engine.mcP10, 1)}</span>
            <span style={{ fontSize: 9, color: C.dimText }}>0%</span>
            <span style={{ fontSize: 9, color: C.dimText }}>{pct(engine.mcP90, 1)}</span>
          </div>
        </Panel>

        {/* ── G) EXECUTIVE SUMMARY ────────────────────────────────────────────── */}
        <Panel>
          <SectionTitle>{'// RESUMEN EJECUTIVO'}</SectionTitle>
          <pre style={{
            fontFamily: MONO, fontSize: 11, color: C.dimText, lineHeight: 1.8,
            background: C.bg, border: `1px solid ${C.border}`, padding: '16px',
            whiteSpace: 'pre-wrap', margin: '0 0 12px', overflowX: 'auto',
          }}>
            {summaryText}
          </pre>
          <button onClick={handleCopy} style={{
            fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em',
            background: copied ? `${GN}20` : 'transparent',
            border: `1px solid ${copied ? GN : C.border}`,
            color: copied ? GN : C.dimText,
            padding: '8px 20px', cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {copied ? '✓ COPIADO' : 'COPIAR RESUMEN'}
          </button>
        </Panel>

      </div>
    </div>
  )
}
