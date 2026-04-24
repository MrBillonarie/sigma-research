'use client'
import type { Challenge } from './challenges'

const C = {
  bg: '#04050a', surface: '#0b0d14', border: '#1a1d2e',
  dimText: '#7a7f9a', text: '#e8e9f0',
  gold: '#d4af37', green: '#34d399', muted: '#3a3f55',
}

interface Props {
  challenge: Challenge
  completed: boolean
  completing: boolean
  onComplete: () => void
}

export default function FireChallengeCard({ challenge, completed, completing, onComplete }: Props) {
  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${completed ? C.green : C.border}`,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      opacity: completed ? 0.65 : 1,
      transition: 'border-color 0.2s, opacity 0.2s',
    }}>
      {/* Status indicator */}
      <div style={{
        width: 20,
        height: 20,
        borderRadius: completed ? '50%' : 4,
        background: completed ? C.green : 'transparent',
        border: completed ? 'none' : `1px solid ${C.muted}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s',
      }}>
        {completed && <span style={{ color: '#000', fontSize: 11 }}>✓</span>}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.15em', color: completed ? C.green : (challenge.detection === 'auto' ? C.dimText : C.muted), marginBottom: 2 }}>
          {completed
            ? 'COMPLETADO' + (challenge.detection === 'auto' ? ' · AUTO' : '')
            : challenge.detection === 'auto' ? 'AUTO-DETECCIÓN' : 'MANUAL'
          }
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text }}>
          {challenge.title}
        </div>
      </div>

      {/* Points + action */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontFamily: "'Bebas Neue', Impact, sans-serif",
          fontSize: 15,
          color: completed ? C.green : C.gold,
          marginBottom: completed || challenge.detection === 'auto' ? 0 : 6,
        }}>
          +{challenge.points} PTS
        </div>
        {!completed && challenge.detection === 'manual' && (
          <button
            onClick={onComplete}
            disabled={completing}
            style={{
              background: C.gold,
              color: '#000',
              border: 'none',
              fontFamily: 'monospace',
              fontSize: 9,
              letterSpacing: '0.1em',
              padding: '4px 10px',
              cursor: completing ? 'not-allowed' : 'pointer',
              opacity: completing ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {completing ? '…' : 'MARCAR ✓'}
          </button>
        )}
      </div>
    </div>
  )
}
