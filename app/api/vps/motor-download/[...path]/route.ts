import { NextResponse, type NextRequest } from 'next/server'

const VPS = process.env.VPS_INTERNAL ?? 'http://127.0.0.1:8080'

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const url = `${VPS}/download/${params.path.join('/')}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), cache: 'no-store' })
    const body = await res.arrayBuffer()

    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'text/plain; charset=utf-8',
        'Content-Disposition': res.headers.get('content-disposition') ?? 'attachment',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 503 })
  }
}
