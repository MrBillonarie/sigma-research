import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180, height: 180,
          background: '#04050a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 36,
        }}
      >
        <div
          style={{
            width: 110, height: 110,
            border: '4px solid #d4af37',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#d4af37', fontSize: 72, fontWeight: 700, lineHeight: 1 }}>
            Σ
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
