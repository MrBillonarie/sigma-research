import { BADGES } from './challenges'

const C = {
  bg: '#04050a', surface: '#0b0d14', border: '#1a1d2e',
  dimText: '#7a7f9a', text: '#e8e9f0', gold: '#d4af37', green: '#34d399',
}

interface Props {
  earnedBadges: string[]
}

export default function FireBadges({ earnedBadges }: Props) {
  const earned = new Set(earnedBadges)

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: C.dimText, marginBottom: 16 }}>
        {earnedBadges.length}/{BADGES.length} INSIGNIAS DESBLOQUEADAS
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
        {BADGES.map(badge => {
          const isEarned = earned.has(badge.id)
          return (
            <div
              key={badge.id}
              title={badge.description}
              style={{
                background: isEarned ? 'rgba(212,175,55,0.06)' : C.bg,
                border: `1px solid ${isEarned ? 'rgba(212,175,55,0.4)' : C.border}`,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                opacity: isEarned ? 1 : 0.35,
                transition: 'opacity 0.2s',
              }}
            >
              <span style={{ fontSize: 22 }}>{badge.emoji}</span>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: isEarned ? C.gold : C.dimText, fontWeight: isEarned ? 600 : 400 }}>
                {badge.name}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: C.dimText, lineHeight: 1.4 }}>
                {badge.description}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
