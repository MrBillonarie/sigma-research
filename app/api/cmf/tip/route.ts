import { NextResponse } from 'next/server';

const CMF_API_KEY = '35a364e05b2334d30771f8bf2a816c27b7da86ac';

export async function GET() {
  try {
    const year = new Date().getFullYear();
    const url = `https://api.cmfchile.cl/api-sbifv3/recursos_api/tip/${year}?apikey=${CMF_API_KEY}&formato=json`;

    const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
    const data = await res.json();

    return NextResponse.json({ ok: true, data: data.TIPs?.TIP || [] });
  } catch {
    return NextResponse.json({ ok: false, error: 'Error consultando CMF' }, { status: 500 });
  }
}
