import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await prisma.playlist.findMany({
    include: { items: { orderBy: { position: 'asc' }, include: { track: true } } },
    orderBy: { createdAt: 'asc' }
  }));
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });
  const playlist = await prisma.playlist.create({
    data: { name: String(body.name), description: body.description ? String(body.description) : null }
  });
  return NextResponse.json(playlist, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const playlist = await prisma.playlist.update({
    where: { id: Number(body.id) },
    data: {
      name: body.name === undefined ? undefined : String(body.name),
      description: body.description === undefined ? undefined : (body.description ? String(body.description) : null),
      active: body.active === undefined ? undefined : Boolean(body.active)
    }
  });
  return NextResponse.json(playlist);
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  await prisma.playlist.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
