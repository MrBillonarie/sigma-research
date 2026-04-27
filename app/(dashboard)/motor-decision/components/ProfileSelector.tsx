'use client'
import type { Profile, ProfileType } from '@/types/decision-engine'

const PROFILES_META: Record<ProfileType, {
  icon: string; color: string; glowColor: string
  maxCrypto: number; minFixedIncome: number; maxEquity: number
}> = {
  retail: {
    icon: '🛡️', color: '#1D9E75', glowColor: 'rgba(29,158,117,0.15)',
    maxCrypto: 5, minFixedIncome: 20, maxEquity: 70,
  },
  trader: {
    icon: '⚡', color: '#f87171', glowColor: 'rgba(248,113,113,0.15)',
    maxCrypto: 30, minFixedIncome: 5, maxEquity: 90,
  },
  institucional: {
    icon: '🏛️', color: '#378ADD', glowColor: 'rgba(55,138,221,0.15)',
    maxCrypto: 10, minFixedIncome: 30, maxEquity: 60,
  },
}

interface Props {
  selected: ProfileType
  profile?: Profile
  onChange: (p: ProfileType) => void
  loading?: boolean
}

export default function ProfileSelector({ selected, profile, onChange, loading }: Props) {
  const types: ProfileType[] = ['retail', 'trader', 'institucional']

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {types.map(pt => {
          const meta    = PROFILES_META[pt]
          const isActive = selected === pt
          return (
            <button
              key={pt}
              onClick={() => onChange(pt)}
              disabled={loading}
              style={{
                flex: 1, minWidth: 180,
                background: isActive ? meta.glowColor : '#0b0d14',
                border: `1px solid ${isActive ? meta.color : '#1a1d2e'}`,
                borderRadius: 10, padding: '16px 20px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left',
                opacity: loading ? 0.6 : 1,
                boxShadow: isActive ? `0 0 16px ${meta.glowColor}` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{meta.icon}</span>
                <span style={{
                  fontFamily: "'Bebas Neue', Impact, sans-serif",
                  fontSize: 18, letterSpacing: 1,
                  color: isActive ? meta.color : '#e8e9f0',
                }}>
                  {pt === 'retail' ? 'RETAIL' : pt === 'trader' ? 'TRADER ACTIVO' : 'INSTITUCIONAL'}
                </span>
                {isActive && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, fontFamily: 'monospace',
                    background: meta.color, color: '#000',
                    borderRadius: 4, padding: '2px 6px', fontWeight: 700,
                  }}>ACTIVO</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { label: 'Crypto máx', value: `${meta.maxCrypto}%` },
                  { label: 'RF mín',     value: `${meta.minFixedIncome}%` },
                  { label: 'RV máx',     value: `${meta.maxEquity}%` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ fontSize: 11, fontFamily: 'monospace' }}>
                    <span style={{ color: '#7a7f9a' }}>{label}: </span>
                    <span style={{ color: isActive ? meta.color : '#e8e9f0' }}>{value}</span>
                  </div>
                ))}
              </div>
              {isActive && profile && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#7a7f9a', lineHeight: 1.4 }}>
                  {profile.description}
                </p>
              )}
            </button>
          )
        })}
      </div>
      {isLoading(loading) && (
        <p style={{ marginTop: 10, fontSize: 12, color: '#7a7f9a', fontFamily: 'monospace' }}>
          Calculando señales...
        </p>
      )}
    </div>
  )
}

function isLoading(v?: boolean) { return !!v }
