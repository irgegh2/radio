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
    stationName: body.stationName === undefined ? undefined : String(body.stationName || 'NEXUS RADIO'),
    tagline: body.tagline === undefined ? undefined : String(body.tagline || ''),
    streamUrl: body.streamUrl === undefined ? undefined : (body.streamUrl ? String(body.streamUrl) : null),
    isLive: body.isLive === undefined ? undefined : Boolean(body.isLive),
    volume: body.volume === undefined ? undefined : Math.max(0, Math.min(100, Number(body.volume))),
    timezone: body.timezone === undefined ? undefined : String(body.timezone || 'Europe/Moscow'),
    defaultPlaylistId: body.defaultPlaylistId === undefined
      ? undefined
      : (body.defaultPlaylistId ? Number(body.defaultPlaylistId) : null),
    rotationStartedAt: body.restartRotation ? new Date() : undefined
  };

  return NextResponse.json(
    await prisma.stationSettings.upsert({
      where: { id: 1 },
      update: data,
      create: {
        id: 1,
        stationName: data.stationName || 'NEXUS RADIO',
        tagline: data.tagline || 'Больше, чем просто музыка',
        streamUrl: data.streamUrl ?? null,
        isLive: data.isLive ?? true,
        volume: data.volume ?? 72,
        timezone: data.timezone || 'Europe/Moscow',
        defaultPlaylistId: data.defaultPlaylistId ?? null,
        rotationStartedAt: data.rotationStartedAt || new Date()
      }
    })
  );
}
