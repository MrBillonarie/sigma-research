'use client'
import type { ProfileType } from '@/types/decision-engine'

// ── Espectro de riesgo ───────────────────────────────────────────────────────
// Contraparte LINEAL del radar: los 3 perfiles viven sobre una barra de
// tolerancia al riesgo (preservación → agresivo). El seleccionado despliega su
// "mandato" — límites Crypto/RF/RV como mini-barras + horizonte — y el capital
// disponible se integra como "lo que se reparte bajo este mandato". Un solo
// bloque, distinto del portafolio (que usa lingotes 3D).

const MONO  = 'var(--font-dm-mono, monospace)'
const BEBAS = "var(--font-bebas, 'Bebas Neue', Impact, sans-serif)"

const META: Record<ProfileType, {
  name: string; icon: string; color: string; pos: number; horizon: string; desc: string
  crypto: number; rf: number; rv: number
}> = {
  retail: {
    name: 'RETAIL', icon: '🛡️', color: '#2fd39a', pos: 0.13,
    horizon: '3–5 años', desc: 'Preservación del capital',
    crypto: 5, rf: 20, rv: 70,
  },
  institucional: {
    name: 'INSTITUCIONAL', icon: '🏛️', color: '#4f92ff', pos: 0.5,
    horizon: '1–3 años', desc: 'Rentabilidad ajustada al riesgo',
    crypto: 10, rf: 30, rv: 60,
  },
  trader: {
    name: 'TRADER ACTIVO', icon: '⚡', color: '#ff5d6c', pos: 0.87,
    horizon: '3–12 meses', desc: 'Alta tolerancia · rotación activa',
    crypto: 30, rf: 5, rv: 90,
  },
}
const ORDER: ProfileType[] = ['retail', 'institucional', 'trader']

interface Props {
  selected: ProfileType
  onChange: (p: ProfileType) => void
  loading?: boolean
  capital: number        // valor animado
  hasCapital: boolean
}

export default function ProfileSpectrum({ selected, onChange, loading, capital, hasCapital }: Props) {
  const m = META[selected]

  const limits: { label: string; value: number; color: string }[] = [
    { label: 'Crypto máx', value: m.crypto, color: '#a78bfa' },
    { label: 'RF mínima',  value: m.rf,     color: '#ffb454' },
    { label: 'RV máxima',  value: m.rv,     color: '#39e2e6' },
  ]

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 14,
      background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))',
      border: '1px solid rgba(255,255,255,0.07)',
      boxShadow: '0 14px 34px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
      padding: '20px 22px 22px',
    }}>
      {/* campo de color del perfil, muy tenue */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(70% 120% at 100% 0%, ${m.color}10, transparent 60%)`,
        transition: 'background 0.6s ease',
      }} />

      {/* encabezado */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 26, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: '#7a8296' }}>
          TOLERANCIA AL RIESGO
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: m.color }}>
          MANDATO ACTIVO
        </span>
      </div>

      {/* espectro */}
      <div style={{ position: 'relative', marginBottom: 34 }}>
        {/* endpoints */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: '#55607a', marginBottom: 10 }}>
          <span>◄ PRESERVACIÓN</span><span>AGRESIVO ►</span>
        </div>
        {/* track */}
        <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'linear-gradient(90deg,#2fd39a,#ffb454 52%,#ff5d6c)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)' }}>
          {/* cursor del perfil activo */}
          <div style={{
            position: 'absolute', top: -5, left: `${m.pos * 100}%`, transform: 'translateX(-50%)',
            width: 16, height: 16, borderRadius: '50%', background: m.color,
            border: '2px solid #04070f', boxShadow: `0 0 12px ${m.color}`,
            transition: 'left 0.5s cubic-bezier(0.22,1,0.36,1), background 0.4s',
          }} />
          {/* nodos */}
          {ORDER.map(pt => {
            const meta = META[pt], on = pt === selected
            return (
              <button key={pt} onClick={() => onChange(pt)} disabled={loading}
                aria-pressed={on}
                title={meta.name}
                style={{
                  position: 'absolute', top: 3, left: `${meta.pos * 100}%`, transform: 'translate(-50%,-50%)',
                  width: on ? 0 : 11, height: on ? 0 : 11, borderRadius: '50%',
                  background: on ? 'transparent' : '#0a0e1a', border: on ? 'none' : `2px solid ${meta.color}`,
                  cursor: loading ? 'not-allowed' : 'pointer', padding: 0,
                }} />
            )
          })}
        </div>
        {/* etiquetas de nodo bajo el track */}
        <div style={{ position: 'relative', height: 30, marginTop: 12 }}>
          {ORDER.map(pt => {
            const meta = META[pt], on = pt === selected
            return (
              <button key={pt} onClick={() => onChange(pt)} disabled={loading}
                style={{
                  position: 'absolute', left: `${meta.pos * 100}%`, transform: 'translateX(-50%)',
                  display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                  background: 'transparent', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: BEBAS, fontSize: 15, letterSpacing: '0.04em',
                  color: on ? meta.color : '#6b7688', transition: 'color 0.3s', padding: 0,
                }}>
                <span style={{ fontSize: 13, filter: on ? 'none' : 'grayscale(0.7) opacity(0.7)' }}>{meta.icon}</span>
                {meta.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* mandato del perfil activo */}
      <div style={{
        position: 'relative', borderRadius: 12, padding: '18px 20px',
        background: 'rgba(255,255,255,0.02)', border: `1px solid ${m.color}2e`,
        borderLeft: `2px solid ${m.color}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: BEBAS, fontSize: 20, letterSpacing: '0.04em', color: '#e8e9f0' }}>{m.name}</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: m.color, background: `${m.color}16`, border: `1px solid ${m.color}40`, borderRadius: 5, padding: '2px 9px', letterSpacing: '0.06em' }}>
            {m.horizon}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: '#7a8296' }}>{m.desc}</span>
        </div>

        {/* límites como mini-barras */}
        <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          {limits.map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: '#8b97ad', width: 82, flexShrink: 0 }}>{l.label}</span>
              <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${l.value}%`, borderRadius: 4,
                  background: `linear-gradient(90deg, ${l.color}, ${l.color}bb)`,
                  boxShadow: `0 0 8px ${l.color}66`,
                  transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
                }} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: l.color, width: 38, textAlign: 'right' }}>{l.value}%</span>
            </div>
          ))}
        </div>

        {/* capital que se reparte bajo este mandato */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', color: '#6b7688', marginBottom: 3 }}>CAPITAL A REPARTIR</div>
            <div style={{ fontFamily: BEBAS, fontSize: 30, letterSpacing: '0.02em', color: hasCapital ? m.color : '#3a3f55', lineHeight: 1 }}>
              {hasCapital ? `$${Math.round(capital).toLocaleString('en-US')}` : '—'}
              {hasCapital && <span style={{ fontSize: 13, color: '#7a8296', marginLeft: 6 }}>USD</span>}
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: '#7a8296', lineHeight: 1.6, flex: 1, minWidth: 220 }}>
            {hasCapital ? (
              <>El motor reparte este capital según la asignación óptima de <span style={{ color: m.color, fontWeight: 700 }}>{m.name}</span> y muestra el monto por activo con señal <span style={{ color: '#2fd39a', fontWeight: 700 }}>COMPRAR</span>.</>
            ) : (
              <>Ingresá tu capital en <a href="/portafolio" style={{ color: '#4f92ff', textDecoration: 'none' }}>Portafolio</a> para ver los montos sugeridos bajo este mandato.</>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
