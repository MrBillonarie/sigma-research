'use client'
import type { ProfileType } from '@/types/decision-engine'

// ── Consola de perfil con dial 3D ────────────────────────────────────────────
// Instrumento de riesgo: gauge semicircular (verde→ámbar→rojo) con una perilla
// 3D cuya aguja apunta al perfil activo, y una "pantalla" digital con el
// mandato (límites Crypto/RF/RV) + el capital a repartir. Estética cockpit,
// distinta de los lingotes 3D del portafolio y del radar circular de arriba.

const MONO  = 'var(--font-dm-mono, monospace)'
const BEBAS = "var(--font-bebas, 'Bebas Neue', Impact, sans-serif)"

const META: Record<ProfileType, {
  name: string; color: string; angle: number; risk: string; horizon: string; desc: string
  crypto: number; rf: number; rv: number
}> = {
  retail: {
    name: 'RETAIL', color: '#2fd39a', angle: 158, risk: 'BAJO',
    horizon: 'Horizonte 3–5 años', desc: 'Preservación del capital',
    crypto: 5, rf: 20, rv: 70,
  },
  institucional: {
    name: 'INSTITUCIONAL', color: '#4f92ff', angle: 90, risk: 'MEDIO',
    horizon: 'Horizonte 1–3 años', desc: 'Rentabilidad ajustada al riesgo',
    crypto: 10, rf: 30, rv: 60,
  },
  trader: {
    name: 'TRADER ACTIVO', color: '#ff5d6c', angle: 22, risk: 'ALTO',
    horizon: 'Horizonte 3–12 meses', desc: 'Alta tolerancia · rotación activa',
    crypto: 30, rf: 5, rv: 90,
  },
}
const ORDER: ProfileType[] = ['retail', 'institucional', 'trader']

const CX = 180, CY = 190, R = 120
const polar = (deg: number, r: number) => ({
  x: CX + r * Math.cos((deg * Math.PI) / 180),
  y: CY - r * Math.sin((deg * Math.PI) / 180),
})

interface Props {
  selected: ProfileType
  onChange: (p: ProfileType) => void
  loading?: boolean
  capital: number
  hasCapital: boolean
}

export default function ProfileConsole({ selected, onChange, loading, capital, hasCapital }: Props) {
  const m = META[selected]
  const needleRot = 90 - m.angle   // rotación del grupo aguja (apunta arriba por defecto)

  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = 180 - i * 18
    const p1 = polar(a, R)
    const p2 = polar(a, R - (i % 5 === 0 ? 14 : 8))
    return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }).join(' ')

  const limits = [
    { label: 'Crypto máx', value: m.crypto, color: '#a78bfa' },
    { label: 'RF mínima',  value: m.rf,     color: '#ffb454' },
    { label: 'RV máxima',  value: m.rv,     color: '#39e2e6' },
  ]

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: 0,
      borderRadius: 16, overflow: 'hidden',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008))',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.06), 0 24px 50px -20px rgba(0,0,0,0.7)',
    }} className="md-console">
      {/* ── gauge + perilla 3D ── */}
      <div style={{
        position: 'relative', padding: '24px 18px 18px',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        background: `radial-gradient(120% 90% at 50% 118%, ${m.color}0e, transparent 60%)`,
        transition: 'background 0.6s ease',
      }}>
        <svg viewBox="0 0 360 250" width="100%" role="img" aria-label={`Nivel de riesgo: ${m.risk}`}>
          <defs>
            <linearGradient id="pcArc" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#2fd39a" /><stop offset="0.5" stopColor="#ffb454" /><stop offset="1" stopColor="#ff5d6c" />
            </linearGradient>
            <radialGradient id="pcKnob" cx="40%" cy="32%" r="75%">
              <stop offset="0" stopColor="#28323f" /><stop offset="0.6" stopColor="#141c26" /><stop offset="1" stopColor="#070c12" />
            </radialGradient>
            <radialGradient id="pcKnob2" cx="42%" cy="34%" r="72%">
              <stop offset="0" stopColor="#3a4657" /><stop offset="1" stopColor="#0c131c" />
            </radialGradient>
            <filter id="pcNeedle" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={m.color} floodOpacity="0.6" />
            </filter>
          </defs>

          {/* pista + arco de riesgo */}
          <path d={`M ${polar(180, R).x} ${polar(180, R).y} A ${R} ${R} 0 0 1 ${polar(0, R).x} ${polar(0, R).y}`}
                fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" strokeLinecap="round" />
          <path d={`M ${polar(180, R).x} ${polar(180, R).y} A ${R} ${R} 0 0 1 ${polar(0, R).x} ${polar(0, R).y}`}
                fill="none" stroke="url(#pcArc)" strokeWidth="10" strokeLinecap="round" />
          <path d={ticks} stroke="rgba(148,163,196,0.32)" strokeWidth="1.5" />

          {/* stops de perfil (clickeables) */}
          {ORDER.map(pt => {
            const meta = META[pt], on = pt === selected
            const p = polar(meta.angle, R)
            const lbl = polar(meta.angle, R + (meta.angle === 90 ? 20 : 16))
            return (
              <g key={pt} style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                 onClick={() => !loading && onChange(pt)}>
                <circle cx={p.x} cy={p.y} r={on ? 5 : 3.5} fill={on ? meta.color : '#0a0e1a'}
                        stroke={meta.color} strokeWidth="1.6"
                        style={{ filter: on ? `drop-shadow(0 0 5px ${meta.color})` : undefined }} />
                <text x={lbl.x} y={lbl.y + (meta.angle === 90 ? -2 : 4)} textAnchor="middle"
                      fill={on ? meta.color : '#6b7688'} fontFamily={MONO} fontSize="10"
                      letterSpacing="0.06em" style={{ transition: 'fill 0.3s' }}>
                  {pt === 'retail' ? 'RETAIL' : pt === 'institucional' ? 'INSTIT.' : 'TRADER'}
                </text>
                {/* área de click amplia e invisible */}
                <circle cx={p.x} cy={p.y} r="16" fill="transparent" />
              </g>
            )
          })}
          <text x={polar(180, R).x - 2} y="240" textAnchor="middle" fill="#2fd39a" fontFamily={MONO} fontSize="8" opacity="0.8">PRESERVAR</text>
          <text x={polar(0, R).x + 2} y="240" textAnchor="middle" fill="#ff5d6c" fontFamily={MONO} fontSize="8" opacity="0.8">AGRESIVO</text>

          {/* aguja (rota hacia el perfil activo) */}
          <g style={{ transform: `rotate(${needleRot}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: 'transform 0.7s cubic-bezier(0.22,1,0.36,1)' }}>
            <g filter="url(#pcNeedle)">
              <line x1={CX} y1={CY} x2={CX} y2={CY - (R - 22)} stroke={m.color} strokeWidth="3.5" strokeLinecap="round"
                    style={{ transition: 'stroke 0.4s' }} />
            </g>
          </g>

          {/* perilla 3D */}
          <circle cx={CX} cy={CY} r="42" fill="url(#pcKnob)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <circle cx={CX} cy={CY} r="30" fill="url(#pcKnob2)" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
          <ellipse cx={CX - 5} cy={CY - 8} rx="11" ry="7" fill="rgba(255,255,255,0.10)" />
          <text x={CX} y={CY - 2} textAnchor="middle" fill={m.color} fontFamily={BEBAS} fontSize="19"
                letterSpacing="0.04em" style={{ transition: 'fill 0.4s' }}>{m.risk}</text>
          <text x={CX} y={CY + 13} textAnchor="middle" fill="#6b7688" fontFamily={MONO} fontSize="7" letterSpacing="0.24em">RIESGO</text>
        </svg>

        {/* selector de modo — switch segmentado con pastilla deslizante */}
        <div style={{ marginTop: 4 }}>
          <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.2em', color: '#55607a', textAlign: 'center', marginBottom: 8 }}>
            SELECCIONAR MODO
          </div>
          <div style={{
            position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0,
            background: 'rgba(0,0,0,0.35)', borderRadius: 11, padding: 3,
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)',
          }}>
            {/* pastilla activa */}
            <div aria-hidden style={{
              position: 'absolute', top: 3, bottom: 3, left: 3, width: 'calc((100% - 6px) / 3)',
              transform: `translateX(calc(${ORDER.indexOf(selected)} * 100%))`,
              background: `linear-gradient(180deg, ${m.color}30, ${m.color}18)`,
              border: `1px solid ${m.color}`, borderRadius: 8,
              boxShadow: `0 0 14px ${m.color}55, inset 0 1px 0 rgba(255,255,255,0.15)`,
              transition: 'transform 0.42s cubic-bezier(0.22,1,0.36,1), background 0.4s, border-color 0.4s, box-shadow 0.4s',
            }} />
            {ORDER.map(pt => {
              const meta = META[pt], on = pt === selected
              const short = pt === 'retail' ? 'RETAIL' : pt === 'institucional' ? 'INSTIT.' : 'TRADER'
              return (
                <button key={pt} onClick={() => !loading && onChange(pt)} disabled={loading}
                  aria-pressed={on} title={meta.name}
                  style={{
                    position: 'relative', zIndex: 1, background: 'transparent', border: 'none',
                    padding: '9px 4px', cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: MONO, fontSize: 10, fontWeight: on ? 700 : 400, letterSpacing: '0.04em',
                    color: on ? m.color : '#7a8296', transition: 'color 0.35s, font-weight 0.35s',
                  }}>
                  {short}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── pantalla digital: mandato + capital ── */}
      <div style={{
        padding: '24px 26px',
        background: 'linear-gradient(180deg, rgba(4,8,16,0.55), rgba(4,8,16,0.25)), repeating-linear-gradient(0deg, rgba(255,255,255,0.014) 0 1px, transparent 1px 3px)',
      }}>
        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: '#55607a', marginBottom: 4 }}>MANDATO ACTIVO</div>
        <div style={{ fontFamily: BEBAS, fontSize: 30, letterSpacing: '0.03em', color: m.color, lineHeight: 1, marginBottom: 3, transition: 'color 0.4s' }}>{m.name}</div>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: '#7a8296', marginBottom: 18 }}>{m.desc} · {m.horizon}</div>

        <div style={{ display: 'grid', gap: 9, marginBottom: 16 }}>
          {limits.map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: '#8b97ad', width: 78, flexShrink: 0 }}>{l.label}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)' }}>
                <div style={{ height: '100%', width: `${l.value}%`, borderRadius: 4, background: `linear-gradient(90deg, ${l.color}, ${l.color}bb)`, boxShadow: `0 0 8px ${l.color}88`, transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)' }} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: l.color, width: 36, textAlign: 'right' }}>{l.value}%</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', color: '#6b7688', marginBottom: 3 }}>CAPITAL A REPARTIR</div>
            <div style={{ fontFamily: BEBAS, fontSize: 32, letterSpacing: '0.02em', color: hasCapital ? m.color : '#3a3f55', lineHeight: 1, transition: 'color 0.4s' }}>
              {hasCapital ? `$${Math.round(capital).toLocaleString('en-US')}` : '—'}
              {hasCapital && <span style={{ fontSize: 13, color: '#7a8296', marginLeft: 6 }}>USD</span>}
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: '#7a8296', lineHeight: 1.6, flex: 1, minWidth: 200 }}>
            {hasCapital ? (
              <>Se reparte según la asignación óptima de <span style={{ color: m.color, fontWeight: 700 }}>{m.name}</span>; monto por activo con señal <span style={{ color: '#2fd39a', fontWeight: 700 }}>COMPRAR</span>.</>
            ) : (
              <>Ingresá tu capital en <a href="/portafolio" style={{ color: '#4f92ff', textDecoration: 'none' }}>Portafolio</a> para ver los montos sugeridos.</>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) { .md-console { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
