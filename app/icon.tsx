import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '32px',
          height: '32px',
          background: '#04050a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          border: '1px solid #d4af37',
          fontFamily: 'monospace',
        }}
      >
        <div
          style={{
            fontSize: '22px',
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
