import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(
    await prisma.stationSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 }
    })
  );
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const data = {
    stationName: String(body.stationName || 'NEXUS RADIO'),
    tagline: String(body.tagline || ''),
    streamUrl: body.streamUrl ? String(body.streamUrl) : null,
    isLive: Boolean(body.isLive),
    volume: Math.max(0, Math.min(100, Number(body.volume ?? 72)))
  };

  return NextResponse.json(
    await prisma.stationSettings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data }
    })
  );
}
