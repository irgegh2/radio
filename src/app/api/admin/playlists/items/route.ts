import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const playlistId = Number(body.playlistId);
  const trackIds = Array.isArray(body.trackIds)
    ? body.trackIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
    : [Number(body.trackId)].filter((id) => Number.isFinite(id) && id > 0);

  if (!Number.isFinite(playlistId) || playlistId <= 0) {
    return NextResponse.json({ error: 'Не выбран плейлист' }, { status: 400 });
  }

  if (!trackIds.length) {
    return NextResponse.json({ error: 'Не выбраны треки' }, { status: 400 });
  }

  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist) return NextResponse.json({ error: 'Плейлист не найден' }, { status: 404 });

  const existing = await prisma.playlistTrack.findMany({
    where: { playlistId, trackId: { in: trackIds } },
    select: { trackId: true }
  });
  const existingIds = new Set(existing.map((item) => item.trackId));
  const newIds = trackIds.filter((id: number) => !existingIds.has(id));

  const last = await prisma.playlistTrack.findFirst({
    where: { playlistId },
    orderBy: { position: 'desc' }
  });
  const start = (last?.position ?? -1) + 1;

  if (newIds.length) {
    await prisma.$transaction(
      newIds.map((trackId: number, index: number) =>
        prisma.playlistTrack.create({
          data: { playlistId, trackId, position: start + index }
        })
      )
    );
  }

  return NextResponse.json({
    ok: true,
    added: newIds.length,
    skipped: trackIds.length - newIds.length
  }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const item = await prisma.playlistTrack.update({
    where: { id: Number(body.id) },
    data: { position: Number(body.position) }
  });
  return NextResponse.json(item);
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  await prisma.playlistTrack.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
