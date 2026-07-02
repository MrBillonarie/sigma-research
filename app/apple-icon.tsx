import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '180px',
          height: '180px',
          background: '#04050a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '36px',
          position: 'relative',
          fontFamily: 'monospace',
        }}
      >
        {/* Gold border */}
        <div
          style={{
            position: 'absolute',
            inset: '0',
            borderRadius: '36px',
            border: '3px solid #d4af37',
            opacity: 0.6,
            display: 'flex',
          }}
        />
        {/* Sigma symbol */}
        <div
          style={{
            fontSize: '110px',
            color: '#d4af37',
            lineHeight: 1,
            display: 'flex',
          }}
        >
          Σ
        </div>
      </div>
    ),
    { ...size }
  )
}
