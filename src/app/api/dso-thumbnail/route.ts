import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ra  = searchParams.get('ra');
  const dec = searchParams.get('dec');
  const fov = searchParams.get('fov');

  if (!ra || !dec || !fov) {
    return new NextResponse('Missing parameters', { status: 400 });
  }

  const upstream =
    `https://aladinlite.cds.unistra.fr/hips2fits?hips=CDS%2FP%2FDSS2%2Fcolor` +
    `&ra=${ra}&dec=${dec}&fov=${fov}&width=200&height=200&projection=TAN`;

  try {
    const res = await fetch(upstream, { next: { revalidate: 86400 } });
    if (!res.ok) {
      return new NextResponse('Upstream error', { status: 502 });
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new NextResponse('Fetch failed', { status: 502 });
  }
}
