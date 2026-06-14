import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192, height: 192,
          background: '#04050a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 130, height: 130,
            border: '5px solid #d4af37',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#d4af37', fontSize: 90, fontWeight: 700, lineHeight: 1 }}>
            Σ
          </span>
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  )
}
