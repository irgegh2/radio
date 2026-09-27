import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    await prisma.track.findMany({ orderBy: { createdAt: 'desc' } })
  );
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  if (!body.title || !body.artist || !body.audioUrl) {
    return NextResponse.json(
      { error: 'title, artist и audioUrl обязательны' },
      { status: 400 }
    );
  }

  const track = await prisma.track.create({
    data: {
      title: body.title,
      artist: body.artist,
      genre: body.genre || null,
      coverUrl: body.coverUrl || null,
      audioUrl: body.audioUrl,
      s3Key: body.s3Key || null
    }
  });

  return NextResponse.json(track, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const id = Number(body.id);

  const track = await prisma.track.update({
    where: { id },
    data: {
      active: body.active,
      title: body.title,
      artist: body.artist,
      genre: body.genre,
      coverUrl: body.coverUrl,
      audioUrl: body.audioUrl
    }
  });

  return NextResponse.json(track);
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = Number(new URL(req.url).searchParams.get('id'));
  await prisma.track.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
