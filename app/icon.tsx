import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32, height: 32,
          background: '#04050a',
          border: '1.5px solid #d4af37',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: '#d4af37', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
          Σ
        </span>
      </div>
    ),
    { ...size }
  )
}
