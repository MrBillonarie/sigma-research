'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence, animate, useMotionValue } from 'framer-motion'

/* ─── Paleta ─────────────────────────────────────────────────────────────────── */
const BG      = '#080a0f'
const GOLD    = '#39e2e6'
const GOLD2   = '#f0cc5a'
const GREEN   = '#2fd39a'
const RED     = '#f87171'
const BORDER  = '#202634'
const SURFACE = '#0b0d14'
const DIM     = '#7a7f9a'
const TEXT    = '#e8e9f0'
const MONO    = "'DM Mono', 'Courier New', monospace"
const BEBAS   = "'Bebas Neue', Impact, sans-serif"

/* ─── Señales mock para el demo ─────────────────────────────────────────────── */
const SIGNALS = [
  { ticker: 'SPY',  name: 'S&P 500 ETF',     signal: 'comprar',  score: 78, r1m: +2.31, cls: 'etfs'       },
  { ticker: 'BTC',  name: 'Bitcoin',           signal: 'comprar',  score: 83, r1m: +8.44, cls: 'crypto'     },
  { ticker: 'ETH',  name: 'Ethereum',          signal: 'comprar',  score: 71, r1m: +5.22, cls: 'crypto'     },
  { ticker: 'QQQ',  name: 'Nasdaq 100',        signal: 'mantener', score: 55, r1m: +1.10, cls: 'etfs'       },
  { ticker: 'GLD',  name: 'Oro SPDR ETF',      signal: 'mantener', score: 61, r1m: +1.80, cls: 'commodities'},
  { ticker: 'TLT',  name: 'T-Bond 20Y',        signal: 'reducir',  score: 29, r1m: -0.82, cls: 'renta_fija' },
]

const ALLOC = [
  { label: 'Renta Variable', pct: 42, color: GOLD    },
  { label: 'Renta Fija',     pct: 28, color: '#60a5fa'},
  { label: 'Crypto',         pct: 18, color: GREEN    },
  { label: 'Fondos',         pct: 12, color: '#a78bfa'},
]

/* ─── Hook: contador animado ─────────────────────────────────────────────────── */
function AnimatedNumber({
  target, decimals = 0, prefix = '', suffix = '', delay = 0, duration = 1.8,
}: {
  target: number; decimals?: number; prefix?: string; suffix?: string
  delay?: number; duration?: number
}) {
  const mv      = useMotionValue(0)
  const [val, setVal] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => {
      const ctrl = animate(mv, target, {
        duration,
        ease: 'easeOut',
        onUpdate: v => setVal(v),
      })
      return () => ctrl.stop()
    }, delay * 1000)
    return () => clearTimeout(t)
  }, [target, duration, delay, mv])

  return (
    <span>{prefix}{val.toFixed(decimals)}{suffix}</span>
  )
}

/* ─── Curva equity (SVG path) ────────────────────────────────────────────────── */
const EQUITY_PATH =
  'M0,168 C18,162 35,172 55,152 C75,132 92,145 115,122 C138,99 152,115 175,94 C198,73 212,89 235,68 C258,47 272,62 295,44 C318,26 332,40 355,30 C378,20 392,33 415,23 C438,13 452,20 475,13 C492,8 498,10 520,7 L600,5'
const EQUITY_FILL =
  EQUITY_PATH + ' L600,200 L0,200 Z'

/* ─── Página principal ───────────────────────────────────────────────────────── */
export default function DemoPage() {
  const [phase, setPhase] = useState(0)   // 0→header 1→metrics 2→chart 3→signals 4→alloc 5→final

  useEffect(() => {
    const ts = [
      setTimeout(() => setPhase(1), 1200),
      setTimeout(() => setPhase(2), 3800),
      setTimeout(() => setPhase(3), 5600),
      setTimeout(() => setPhase(4), 10200),
      setTimeout(() => setPhase(5), 12500),
    ]
    return () => ts.forEach(clearTimeout)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: BG,
      fontFamily: MONO, overflow: 'hidden', userSelect: 'none',
    }}>

      {/* ── Dot grid ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `radial-gradient(circle, ${BORDER} 1px, transparent 1px)`,
        backgroundSize: '28px 28px',
        opacity: 0.55,
      }} />

      {/* ── Vignette ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: `radial-gradient(ellipse at center, transparent 40%, ${BG} 90%)`,
        pointerEvents: 'none',
      }} />

      {/* ── Scan line ─────────────────────────────────────────────────────── */}
      <motion.div
        style={{
          position: 'absolute', left: 0, right: 0, height: 2, zIndex: 50,
          background: `linear-gradient(90deg, transparent, ${GOLD}55, transparent)`,
          boxShadow: `0 0 12px ${GOLD}40`,
        }}
        animate={{ top: ['-2px', '100vh'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 0.5 }}
      />

      {/* ── Contenido principal ───────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column',
        height: '100%', padding: '28px 36px', gap: 20,
      }}>

        {/* ═══ HEADER ══════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}
        >
          {/* Logo Σ */}
          <motion.div
            animate={{ boxShadow: [`0 0 10px ${GOLD}40`, `0 0 28px ${GOLD}80`, `0 0 10px ${GOLD}40`] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 52, height: 52,
              border: `1px solid ${GOLD}`,
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, color: GOLD, fontFamily: BEBAS,
              background: `rgba(57,226,230,0.08)`,
              flexShrink: 0,
            }}
          >
            Σ
          </motion.div>

          <div>
            <div style={{ fontFamily: BEBAS, fontSize: 30, letterSpacing: 5, color: TEXT, lineHeight: 1 }}>
              SIGMA RESEARCH
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <motion.div
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN, boxShadow: `0 0 8px ${GREEN}` }}
              />
              <span style={{ fontSize: 10, color: GREEN, letterSpacing: '0.25em' }}>
                LIVE — MOTOR CUANTITATIVO
              </span>
            </div>
          </div>

          {/* Regime badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={phase >= 2 ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4 }}
            style={{ marginLeft: 'auto', flexShrink: 0 }}
          >
            <motion.div
              animate={{ boxShadow: [`0 0 6px ${GREEN}30`, `0 0 18px ${GREEN}60`, `0 0 6px ${GREEN}30`] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                padding: '6px 16px',
                background: `rgba(29,158,117,0.12)`,
                border: `1px solid ${GREEN}60`,
                borderRadius: 6,
                fontSize: 11, color: GREEN, fontFamily: MONO,
                letterSpacing: '0.18em',
              }}
            >
              ▲ RISK-ON
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : {}}
            style={{
              padding: '6px 14px',
              background: `rgba(57,226,230,0.08)`,
              border: `1px solid ${GOLD}40`,
              borderRadius: 6,
              fontSize: 10, color: DIM, fontFamily: MONO,
              letterSpacing: '0.1em',
              flexShrink: 0,
            }}
          >
            127 activos · 89 BUY · 18 SELL
          </motion.div>
        </motion.div>

        {/* ═══ DIVIDER ══════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          style={{ height: 1, background: `linear-gradient(90deg, ${GOLD}60, ${GOLD}20, transparent)`, transformOrigin: 'left', flexShrink: 0 }}
        />

        {/* ═══ MAIN GRID ════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>

          {/* ── Columna izquierda: métricas ────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 210, flexShrink: 0 }}>
            {[
              { label: 'WIN RATE',      target: 85.2, decimals: 1, suffix: '%',  color: GREEN,   delay: phase >= 1 ? 0 : 999 },
              { label: 'PROFIT FACTOR', target: 4.16, decimals: 2, suffix: '×',  color: GOLD,    delay: phase >= 1 ? 0.5 : 999 },
              { label: 'SHARPE RATIO',  target: 1.87, decimals: 2, suffix: '',   color: GOLD2,   delay: phase >= 1 ? 1.0 : 999 },
              { label: 'MAX DRAWDOWN',  target: 12.4, decimals: 1, prefix: '-', suffix: '%', color: RED, delay: phase >= 1 ? 1.5 : 999 },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, x: -24 }}
                animate={phase >= 1 ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: i * 0.22, duration: 0.5 }}
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderLeft: `3px solid ${m.color}`,
                  borderRadius: 8,
                  padding: '14px 16px',
                  flex: 1,
                }}
              >
                <div style={{ fontSize: 9, color: DIM, letterSpacing: '0.22em', marginBottom: 6 }}>
                  {m.label}
                </div>
                <div style={{ fontFamily: BEBAS, fontSize: 32, color: m.color, lineHeight: 1 }}>
                  {phase >= 1
                    ? <AnimatedNumber target={m.target} decimals={m.decimals} prefix={m.prefix ?? ''} suffix={m.suffix} delay={i * 0.22} />
                    : '—'
                  }
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Columna central: equity chart ─────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : {}}
            transition={{ duration: 0.4 }}
            style={{
              flex: 1,
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            {/* Chart header */}
            <div style={{
              padding: '12px 18px',
              borderBottom: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', gap: 10,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 9, color: DIM, letterSpacing: '0.22em' }}>EQUITY CURVE — BACKTESTING OOS</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: GREEN }}>+341.2% acum.</span>
            </div>

            {/* SVG Chart */}
            <div style={{ flex: 1, padding: '12px 18px 16px', minHeight: 0 }}>
              <svg
                viewBox="0 0 600 200"
                preserveAspectRatio="none"
                style={{ width: '100%', height: '100%' }}
              >
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={GOLD} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={GOLD} stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor={GOLD} stopOpacity="0.4" />
                    <stop offset="60%"  stopColor={GOLD} />
                    <stop offset="100%" stopColor={GOLD2} />
                  </linearGradient>
                  {/* Grid lines horizontal */}
                  {[40, 80, 120, 160].map(y => (
                    <line key={y} x1="0" y1={y} x2="600" y2={y}
                      stroke={BORDER} strokeWidth="0.5" strokeDasharray="4,6" />
                  ))}
                </defs>

                {/* Grid lines */}
                {[40, 80, 120, 160].map(y => (
                  <line key={y} x1="0" y1={y} x2="600" y2={y}
                    stroke={BORDER} strokeWidth="0.5" strokeDasharray="4,6" />
                ))}

                {/* Fill area */}
                {phase >= 2 && (
                  <motion.path
                    d={EQUITY_FILL}
                    fill="url(#eqGrad)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 1 }}
                  />
                )}

                {/* Equity line — draw animation */}
                {phase >= 2 && (
                  <motion.path
                    d={EQUITY_PATH}
                    fill="none"
                    stroke="url(#lineGrad)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 1 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 3.2, ease: 'easeInOut', delay: 0.2 }}
                    style={{ filter: `drop-shadow(0 0 5px ${GOLD}80)` }}
                  />
                )}

                {/* Punto final pulsante */}
                {phase >= 2 && (
                  <motion.circle
                    cx="520" cy="7" r="4"
                    fill={GOLD2}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 1], scale: [0, 1.4, 1] }}
                    transition={{ delay: 3.2, duration: 0.5 }}
                    style={{ filter: `drop-shadow(0 0 6px ${GOLD2})` }}
                  />
                )}
              </svg>
            </div>

            {/* Chart labels */}
            <div style={{
              padding: '0 18px 12px',
              display: 'flex', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              {['Ene 22', 'Jul 22', 'Ene 23', 'Jul 23', 'Ene 24', 'Jul 24', 'Ene 25'].map(l => (
                <span key={l} style={{ fontSize: 9, color: DIM }}>{l}</span>
              ))}
            </div>
          </motion.div>

          {/* ── Columna derecha: señales + allocación ─────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 260, flexShrink: 0 }}>

            {/* Señales */}
            <div style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              overflow: 'hidden',
              flex: 1,
            }}>
              <div style={{
                padding: '10px 16px',
                borderBottom: `1px solid ${BORDER}`,
                fontSize: 9, color: DIM, letterSpacing: '0.22em',
              }}>
                SEÑALES EN TIEMPO REAL
              </div>
              <div style={{ padding: '6px 0' }}>
                <AnimatePresence>
                  {phase >= 3 && SIGNALS.map((s, i) => {
                    const isBuy  = s.signal === 'comprar'
                    const isSell = s.signal === 'reducir'
                    const sColor = isBuy ? GREEN : isSell ? RED : DIM
                    const sLabel = isBuy ? 'BUY' : isSell ? 'SEL' : 'HOL'
                    const sIcon  = isBuy ? '▲' : isSell ? '▼' : '◆'
                    return (
                      <motion.div
                        key={s.ticker}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.42, duration: 0.38, ease: 'easeOut' }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 16px',
                          borderBottom: i < SIGNALS.length - 1 ? `1px solid ${BORDER}40` : 'none',
                        }}
                      >
                        {/* Signal badge */}
                        <span style={{
                          fontSize: 9, color: sColor,
                          width: 28, flexShrink: 0, letterSpacing: '0.05em',
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          {sIcon} {sLabel}
                        </span>

                        {/* Ticker */}
                        <span style={{ fontSize: 11, color: TEXT, fontWeight: 600, width: 34, flexShrink: 0 }}>
                          {s.ticker}
                        </span>

                        {/* Name */}
                        <span style={{ fontSize: 9, color: DIM, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </span>

                        {/* Score bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 36, height: 3, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${s.score}%` }}
                              transition={{ delay: i * 0.42 + 0.2, duration: 0.6 }}
                              style={{ height: '100%', background: sColor, borderRadius: 2 }}
                            />
                          </div>
                          <span style={{ fontSize: 9, color: sColor, width: 22, textAlign: 'right' }}>
                            {s.score}
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>

            {/* Allocación */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={phase >= 4 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              style={{
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div style={{
                padding: '10px 16px',
                borderBottom: `1px solid ${BORDER}`,
                fontSize: 9, color: DIM, letterSpacing: '0.22em',
              }}>
                ASIGNACIÓN ÓPTIMA
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ALLOC.map((a, i) => (
                  <div key={a.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 9, color: DIM }}>{a.label}</span>
                      <span style={{ fontSize: 9, color: a.color }}>{a.pct}%</span>
                    </div>
                    <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={phase >= 4 ? { width: `${a.pct}%` } : {}}
                        transition={{ delay: i * 0.15 + 0.2, duration: 0.8, ease: 'easeOut' }}
                        style={{
                          height: '100%',
                          background: `linear-gradient(90deg, ${a.color}bb, ${a.color})`,
                          borderRadius: 2,
                          boxShadow: `0 0 6px ${a.color}60`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>
        </div>

        {/* ═══ FOOTER ══════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={phase >= 5 ? { opacity: 1 } : {}}
          transition={{ duration: 0.8 }}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingTop: 12,
            borderTop: `1px solid ${BORDER}40`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 9, color: DIM, letterSpacing: '0.15em' }}>
            SIGMA RESEARCH © 2025 · Inteligencia cuantitativa para inversores independientes
          </span>
          <div style={{ display: 'flex', gap: 20 }}>
            {['HMM-01  91.2%', 'XGB-03  2.41x', 'STAT-05  1.87', 'GARCH-02  0.031'].map(m => (
              <span key={m} style={{ fontSize: 9, color: DIM, letterSpacing: '0.08em' }}>
                {m}
              </span>
            ))}
          </div>
        </motion.div>

      </div>

      {/* ── Final glow pulse ─────────────────────────────────────────────── */}
      {phase >= 5 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.06, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
            background: `radial-gradient(ellipse at 50% 50%, ${GOLD}30, transparent 70%)`,
          }}
        />
      )}

      {/* ── Esquinas decorativas ──────────────────────────────────────────── */}
      {(['tl','tr','bl','br'] as const).map(corner => (
        <div
          key={corner}
          style={{
            position: 'absolute', zIndex: 20,
            width: 16, height: 16,
            ...(corner === 'tl' ? { top: 12,  left: 12  } : {}),
            ...(corner === 'tr' ? { top: 12,  right: 12 } : {}),
            ...(corner === 'bl' ? { bottom: 12, left: 12 } : {}),
            ...(corner === 'br' ? { bottom: 12, right: 12 } : {}),
            borderTop:    corner.startsWith('t') ? `1px solid ${GOLD}60` : undefined,
            borderBottom: corner.startsWith('b') ? `1px solid ${GOLD}60` : undefined,
            borderLeft:   corner.endsWith('l')   ? `1px solid ${GOLD}60` : undefined,
            borderRight:  corner.endsWith('r')   ? `1px solid ${GOLD}60` : undefined,
          }}
        />
      ))}

    </div>
  )
}
