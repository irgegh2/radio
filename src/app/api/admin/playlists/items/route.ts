import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const playlistId = Number(body.playlistId);
  const trackId = Number(body.trackId);
  const last = await prisma.playlistTrack.findFirst({
    where: { playlistId },
    orderBy: { position: 'desc' }
  });
  const item = await prisma.playlistTrack.upsert({
    where: { playlistId_trackId: { playlistId, trackId } },
    update: {},
    create: { playlistId, trackId, position: (last?.position ?? -1) + 1 }
  });
  return NextResponse.json(item, { status: 201 });
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
