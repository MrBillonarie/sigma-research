import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512, height: 512,
          background: '#080a0f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 340, height: 340,
            border: '12px solid #39e2e6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#39e2e6', fontSize: 240, fontWeight: 700, lineHeight: 1 }}>
            Σ
          </span>
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
