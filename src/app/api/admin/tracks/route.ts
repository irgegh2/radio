import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await prisma.track.findMany({ orderBy: { createdAt: 'desc' } }));
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();

  if (!body.title || !body.artist || !body.audioUrl) {
    return NextResponse.json({ error: 'title, artist и audioUrl обязательны' }, { status: 400 });
  }

  const duration = Number(body.duration || 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: 'Нужна длительность трека в секундах' }, { status: 400 });
  }

  const track = await prisma.track.create({
    data: {
      title: String(body.title),
      artist: String(body.artist),
      genre: body.genre ? String(body.genre) : null,
      coverUrl: body.coverUrl ? String(body.coverUrl) : null,
      audioUrl: String(body.audioUrl),
      s3Key: body.s3Key ? String(body.s3Key) : null,
      duration: Math.round(duration),
      kind: body.kind === 'JINGLE' ? 'JINGLE' : 'MUSIC',
      active: body.active === undefined ? true : Boolean(body.active)
    }
  });

  return NextResponse.json(track, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const id = Number(body.id);

  const track = await prisma.track.update({
    where: { id },
    data: {
      active: body.active === undefined ? undefined : Boolean(body.active),
      title: body.title === undefined ? undefined : String(body.title),
      artist: body.artist === undefined ? undefined : String(body.artist),
      genre: body.genre === undefined ? undefined : (body.genre ? String(body.genre) : null),
      coverUrl: body.coverUrl === undefined ? undefined : (body.coverUrl ? String(body.coverUrl) : null),
      audioUrl: body.audioUrl === undefined ? undefined : String(body.audioUrl),
      duration: body.duration === undefined ? undefined : Math.max(1, Math.round(Number(body.duration))),
      kind: body.kind === undefined ? undefined : (body.kind === 'JINGLE' ? 'JINGLE' : 'MUSIC')
    }
  });

  return NextResponse.json(track);
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  await prisma.track.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
