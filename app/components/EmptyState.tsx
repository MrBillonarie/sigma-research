'use client'

interface EmptyStateProps {
  icon?: string
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

const MONO  = 'var(--font-dm-mono, monospace)'
const BEBAS = "'Bebas Neue', Impact, sans-serif"

export default function EmptyState({ icon = '◈', title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 320,
      padding: '48px 24px',
      textAlign: 'center',
      gap: 16,
    }}>
      {/* Icono */}
      <div style={{
        width: 64,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(212,175,55,0.06)',
        border: '1px solid rgba(212,175,55,0.20)',
        borderRadius: 12,
        fontSize: 28,
        color: '#d4af37',
        fontFamily: MONO,
      }}>
        {icon}
      </div>

      {/* Título */}
      <div>
        <h3 style={{
          margin: '0 0 8px',
          fontFamily: BEBAS,
          fontSize: 22,
          letterSpacing: 2,
          color: '#e8e9f0',
        }}>
          {title}
        </h3>
        <p style={{
          margin: 0,
          fontFamily: MONO,
          fontSize: 12,
          color: '#7a7f9a',
          maxWidth: 340,
          lineHeight: 1.7,
        }}>
          {description}
        </p>
      </div>

      {/* CTA */}
      {action && (
        action.href ? (
          <a
            href={action.href}
            style={{
              display: 'inline-block',
              background: '#d4af37',
              color: '#04050a',
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              padding: '10px 24px',
              borderRadius: 7,
              textDecoration: 'none',
              marginTop: 8,
            }}
          >
            {action.label}
          </a>
        ) : (
          <button
            onClick={action.onClick}
            style={{
              background: '#d4af37',
              color: '#04050a',
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              padding: '10px 24px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              marginTop: 8,
            }}
          >
            {action.label}
          </button>
        )
      )}
    </div>
  )
}
