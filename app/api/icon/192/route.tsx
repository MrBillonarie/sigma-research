import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192, height: 192,
          background: '#080a0f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 130, height: 130,
            border: '5px solid #39e2e6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#39e2e6', fontSize: 90, fontWeight: 700, lineHeight: 1 }}>
            Σ
          </span>
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  )
}
