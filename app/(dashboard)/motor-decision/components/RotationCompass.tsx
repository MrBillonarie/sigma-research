'use client'
import { useMemo } from 'react'
import type { Asset, MarketRegime } from '@/types/decision-engine'

// ── Brújula de rotación ──────────────────────────────────────────────────────
// Radar circular, pieza central del Motor de Decisión: la aguja apunta
// risk-off (izquierda) ↔ risk-on (derecha) según el flowScore, las clases de
// activo ocupan sectores del dial y cada activo es un punto luminoso —
// color = señal (comprar/reducir/neutro), distancia al borde = fuerza del
// movimiento (|retorno 30d|, disponible también en el plan free; el score
// PRO no es necesario para dibujar). Tooltip nativo por punto.

const MONO = 'var(--font-dm-mono, monospace)'
const BEBAS = "var(--font-bebas, 'Bebas Neue', Impact, sans-serif)"

const SIG_COLOR: Record<string, string> = {
  comprar: '#2fd39a', reducir: '#ff5d6c', mantener: '#8b97ad', neutral: '#8b97ad',
}
const CLASS_META: Record<string, { label: string; start: number; span: number }> = {
  // sectores del dial (grados, 0° = derecha, sentido antihorario como en mate)
  etfs:       { label: 'ETFs',       start: 20,  span: 70 },
  fondos:     { label: 'FONDOS',     start: 110, span: 60 },
  renta_fija: { label: 'RENTA FIJA', start: 190, span: 70 },
  crypto:     { label: 'CRYPTO',     start: 280, span: 60 },
}

const toXY = (cx: number, cy: number, angleDeg: number, r: number) => {
  const a = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }
}

interface Props {
  signals: Asset[]
  flowScore: number
  regime: MarketRegime
  regimeLabel: string
}

export default function RotationCompass({ signals, flowScore, regime, regimeLabel }: Props) {
  const W = 640, H = 430
  const cx = W / 2, cy = 226
  const R = 168

  const regimeColor = regime === 'risk-on' ? '#2fd39a' : regime === 'risk-off' ? '#ff5d6c' : '#ffb454'

  // aguja: flowScore -100..+100 → 180°(izq)..0°(der)
  const clamped = Math.max(-100, Math.min(100, flowScore))
  const needleAngle = 90 - clamped * 0.9
  const tip = toXY(cx, cy, needleAngle, R - 26)
  const tailL = toXY(cx, cy, needleAngle + 150, 26)
  const tailR = toXY(cx, cy, needleAngle - 150, 26)

  const dots = useMemo(() => {
    const byClass: Record<string, Asset[]> = {}
    for (const a of signals) (byClass[a.assetClass] ||= []).push(a)
    const out: { x: number; y: number; color: string; title: string; strong: boolean }[] = []
    for (const [cls, meta] of Object.entries(CLASS_META)) {
      const list = (byClass[cls] ?? []).slice(0, 14)
      list.forEach((a, i) => {
        const ang = meta.start + ((i + 1) / (list.length + 1)) * meta.span
        const strength = Math.min(1, Math.abs(a.return30d ?? 0) / 12)
        const r = 62 + strength * (R - 96)
        const { x, y } = toXY(cx, cy, ang, r)
        const sig = a.signal ?? 'neutral'
        out.push({
          x, y,
          color: SIG_COLOR[sig] ?? SIG_COLOR.neutral,
          strong: sig === 'comprar' || sig === 'reducir',
          title: `${a.ticker ?? a.name} · ${sig.toUpperCase()} · 30d ${a.return30d >= 0 ? '+' : ''}${(a.return30d ?? 0).toFixed(1)}%`,
        })
      })
    }
    return out
  }, [signals, cx, cy, R])

  const ticks = useMemo(() => {
    const t: string[] = []
    for (let a = 0; a < 360; a += 15) {
      const p1 = toXY(cx, cy, a, R)
      const p2 = toXY(cx, cy, a, a % 45 === 0 ? R - 10 : R - 5)
      t.push(`M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`)
    }
    return t.join(' ')
  }, [cx, cy, R])

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 14,
      background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))',
      border: '1px solid rgba(255,255,255,0.07)',
      boxShadow: '0 14px 34px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
    }}>
      {/* campo de color del régimen, muy tenue, detrás de todo */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(60% 70% at 50% 46%, ${regimeColor}12, transparent 70%)`,
        transition: 'background 1s ease',
      }} />

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img"
           aria-label={`Brújula de rotación: ${regimeLabel}, flujo ${flowScore}`}>
        <defs>
          <radialGradient id="rcHub" cx="38%" cy="34%" r="80%">
            <stop offset="0%" stopColor="#16202f" /><stop offset="100%" stopColor="#060a13" />
          </radialGradient>
          <filter id="rcGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={regimeColor} floodOpacity="0.55" />
          </filter>
          <filter id="rcDot" x="-120%" y="-120%" width="340%" height="340%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.4" floodColor="currentColor" floodOpacity="0.7" />
          </filter>
        </defs>

        {/* anillos + cruz */}
        {[R, R - 44, R - 88].map((r, i) => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none"
                  stroke="rgba(94,234,240,0.14)" strokeWidth={i === 0 ? 1.3 : 1}
                  strokeDasharray={i === 0 ? undefined : '2 5'} />
        ))}
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="rgba(148,163,196,0.10)" strokeWidth="1" />
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="rgba(148,163,196,0.10)" strokeWidth="1" />
        <path d={ticks} stroke="rgba(94,234,240,0.30)" strokeWidth="1" />

        {/* barrido de radar (rota; se apaga con prefers-reduced-motion) */}
        <g className="rc-sweep" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <path d={`M ${cx} ${cy} L ${cx + R} ${cy} A ${R} ${R} 0 0 0 ${toXY(cx, cy, 28, R).x} ${toXY(cx, cy, 28, R).y} Z`}
                fill="rgba(94,234,240,0.05)" />
          <line x1={cx} y1={cy} x2={cx + R} y2={cy} stroke="rgba(94,234,240,0.28)" strokeWidth="1" />
        </g>

        {/* extremos del eje risk-off ↔ risk-on */}
        <text x={cx - R - 8} y={cy + 4} textAnchor="end" fill="#ff5d6c" opacity="0.85"
              fontFamily={MONO} fontSize="10" letterSpacing="0.12em">RISK-OFF</text>
        <text x={cx + R + 8} y={cy + 4} textAnchor="start" fill="#2fd39a" opacity="0.85"
              fontFamily={MONO} fontSize="10" letterSpacing="0.12em">RISK-ON</text>

        {/* etiquetas de sector */}
        {Object.values(CLASS_META).map(m => {
          const mid = m.start + m.span / 2
          const p = toXY(cx, cy, mid, R + 16)
          return (
            <text key={m.label} x={p.x} y={p.y + 3} textAnchor="middle"
                  fill="#55607a" fontFamily={MONO} fontSize="9" letterSpacing="0.16em">{m.label}</text>
          )
        })}

        {/* activos */}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.strong ? 4.4 : 3.2}
                  fill={d.color} stroke="#04070f" strokeWidth="1"
                  style={{ color: d.color }} filter={d.strong ? 'url(#rcDot)' : undefined}>
            <title>{d.title}</title>
          </circle>
        ))}

        {/* aguja */}
        <g filter="url(#rcGlow)">
          <path d={`M ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L ${tailL.x.toFixed(1)} ${tailL.y.toFixed(1)} L ${tailR.x.toFixed(1)} ${tailR.y.toFixed(1)} Z`}
                fill={regimeColor} opacity="0.9"
                style={{ transition: 'all 1.2s cubic-bezier(0.22, 1, 0.36, 1)' }} />
        </g>

        {/* hub central */}
        <circle cx={cx} cy={cy} r={46} fill="url(#rcHub)" stroke={`${regimeColor}66`} strokeWidth="1.4" />
        <text x={cx} y={cy - 6} textAnchor="middle" fill={regimeColor}
              fontFamily={BEBAS} fontSize="34" letterSpacing="0.02em">
          {clamped > 0 ? '+' : ''}{Math.round(clamped)}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fill="#6b7688"
              fontFamily={MONO} fontSize="8.5" letterSpacing="0.24em">FLUJO</text>
      </svg>

      {/* leyenda */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap',
        padding: '0 16px 14px', fontFamily: MONO, fontSize: 10, color: '#7a8296',
      }}>
        <span style={{
          color: regimeColor, border: `1px solid ${regimeColor}55`, background: `${regimeColor}14`,
          borderRadius: 5, padding: '3px 10px', fontWeight: 700, letterSpacing: '0.1em',
        }}>
          {regime === 'risk-on' ? '▲' : regime === 'risk-off' ? '▼' : '◆'} {regimeLabel.toUpperCase()}
        </span>
        {(['comprar', 'mantener', 'reducir'] as const).map(s => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i style={{ width: 8, height: 8, borderRadius: '50%', background: SIG_COLOR[s], display: 'inline-block', boxShadow: `0 0 6px ${SIG_COLOR[s]}` }} />
            {s}
          </span>
        ))}
        <span style={{ color: '#55607a' }}>distancia al borde = magnitud 30d</span>
      </div>

      <style>{`
        .rc-sweep { animation: rcSweep 9s linear infinite; }
        @keyframes rcSweep { to { transform: rotate(-360deg); } }
        @media (prefers-reduced-motion: reduce) { .rc-sweep { animation: none; opacity: 0; } }
      `}</style>
    </div>
  )
}
