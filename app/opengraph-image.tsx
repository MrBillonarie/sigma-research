import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'SIGMA Research'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#04050a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          fontFamily: 'monospace',
        }}
      >
        {/* Gold border accent */}
        <div
          style={{
            position: 'absolute',
            inset: '0',
            border: '3px solid #d4af37',
            opacity: 0.4,
            display: 'flex',
          }}
        />
        {/* Corner accents */}
        <div
          style={{
            position: 'absolute',
            top: '24px',
            left: '24px',
            width: '48px',
            height: '48px',
            borderTop: '3px solid #d4af37',
            borderLeft: '3px solid #d4af37',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            width: '48px',
            height: '48px',
            borderTop: '3px solid #d4af37',
            borderRight: '3px solid #d4af37',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            width: '48px',
            height: '48px',
            borderBottom: '3px solid #d4af37',
            borderLeft: '3px solid #d4af37',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            width: '48px',
            height: '48px',
            borderBottom: '3px solid #d4af37',
            borderRight: '3px solid #d4af37',
            display: 'flex',
          }}
        />

        {/* Sigma symbol */}
        <div
          style={{
            fontSize: '160px',
            color: '#d4af37',
            lineHeight: 1,
            marginBottom: '16px',
            display: 'flex',
            textShadow: '0 0 40px rgba(212,175,55,0.5)',
          }}
        >
          Σ
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '72px',
            color: '#ffffff',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            display: 'flex',
            marginBottom: '16px',
          }}
        >
          SIGMA Research
        </div>

        {/* Divider */}
        <div
          style={{
            width: '320px',
            height: '2px',
            background: '#d4af37',
            marginBottom: '20px',
            display: 'flex',
            opacity: 0.7,
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            fontSize: '28px',
            color: '#a0a0b0',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            display: 'flex',
          }}
        >
          Trading Intelligence Platform
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            fontSize: '18px',
            color: '#d4af37',
            opacity: 0.6,
            letterSpacing: '0.1em',
            display: 'flex',
          }}
        >
          squantdesk.com
        </div>
      </div>
    ),
    { ...size }
  )
}
