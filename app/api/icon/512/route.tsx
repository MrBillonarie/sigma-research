import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512, height: 512,
          background: '#04050a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 340, height: 340,
            border: '12px solid #d4af37',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#d4af37', fontSize: 240, fontWeight: 700, lineHeight: 1 }}>
            Σ
          </span>
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
