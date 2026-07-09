import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.CMF_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'CMF_API_KEY no configurada' }, { status: 503 });
    }
    const year = new Date().getFullYear();
    const url = `https://api.cmfchile.cl/api-sbifv3/recursos_api/tip/${year}?apikey=${apiKey}&formato=json`;

    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) }); // cache 24h
    const data = await res.json();

    return NextResponse.json({ ok: true, data: data.TIPs?.TIP || [] });
  } catch {
    return NextResponse.json({ ok: false, error: 'Error consultando CMF' }, { status: 500 });
  }
}
