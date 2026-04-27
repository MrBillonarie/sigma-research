'use client'
import type { Profile, ProfileType } from '@/types/decision-engine'

const PROFILES_META: Record<ProfileType, {
  icon: string; color: string; glowColor: string
  maxCrypto: number; minFixedIncome: number; maxEquity: number
  description: string
}> = {
  retail: {
    icon: '🛡️', color: '#1D9E75', glowColor: 'rgba(29,158,117,0.12)',
    maxCrypto: 5, minFixedIncome: 20, maxEquity: 70,
    description: 'Preservación del capital. Horizonte largo plazo (3-5 años).',
  },
  trader: {
    icon: '⚡', color: '#f87171', glowColor: 'rgba(248,113,113,0.12)',
    maxCrypto: 30, minFixedIncome: 5, maxEquity: 90,
    description: 'Alta tolerancia al riesgo. Rotación activa (3-12 meses).',
  },
  institucional: {
    icon: '🏛️', color: '#378ADD', glowColor: 'rgba(55,138,221,0.12)',
    maxCrypto: 10, minFixedIncome: 30, maxEquity: 60,
    description: 'Rentabilidad ajustada al riesgo. Medio plazo (1-3 años).',
  },
}

interface Props {
  selected: ProfileType
  profile?: Profile
  onChange: (p: ProfileType) => void
  loading?: boolean
}

export default function ProfileSelector({ selected, onChange, loading }: Props) {
  const types: ProfileType[] = ['retail', 'trader', 'institucional']

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {types.map(pt => {
        const meta     = PROFILES_META[pt]
        const isActive = selected === pt
        return (
          <button
            key={pt}
            onClick={() => onChange(pt)}
            disabled={loading}
            style={{
              flex: 1, minWidth: 200,
              background: isActive ? meta.glowColor : '#0b0d14',
              border: `1px solid ${isActive ? meta.color : '#1a1d2e'}`,
              borderTop: `2px solid ${isActive ? meta.color : '#1a1d2e'}`,
              borderRadius: 10, padding: '16px 20px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', textAlign: 'left',
              opacity: loading ? 0.6 : 1,
              boxShadow: isActive ? `0 0 20px ${meta.glowColor}` : 'none',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>{meta.icon}</span>
              <span style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 17, letterSpacing: 1, color: isActive ? meta.color : '#e8e9f0' }}>
                {pt === 'retail' ? 'RETAIL' : pt === 'trader' ? 'TRADER ACTIVO' : 'INSTITUCIONAL'}
              </span>
              {isActive && (
                <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'monospace', background: meta.color, color: '#000', borderRadius: 3, padding: '2px 6px', fontWeight: 700, letterSpacing: '0.1em' }}>
                  ACTIVO
                </span>
              )}
            </div>

            {/* Constraints */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              {[
                { label: 'Crypto máx', value: `${meta.maxCrypto}%` },
                { label: 'RF mín',     value: `${meta.minFixedIncome}%` },
                { label: 'RV máx',     value: `${meta.maxEquity}%` },
              ].map(({ label, value }) => (
                <div key={label} style={{ fontSize: 11, fontFamily: 'monospace' }}>
                  <span style={{ color: '#3a3f55' }}>{label}: </span>
                  <span style={{ color: isActive ? meta.color : '#7a7f9a' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* J: Description always visible, dimmer when inactive */}
            <p style={{ margin: 0, fontSize: 11, color: isActive ? '#7a7f9a' : '#3a3f55', lineHeight: 1.5, fontFamily: 'monospace' }}>
              {meta.description}
            </p>
          </button>
        )
      })}
    </div>
  )
}
