import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await prisma.scheduleBlock.findMany({
    include: { playlist: true },
    orderBy: [{ dayOfWeek: 'asc' }, { startSecond: 'asc' }]
  }));
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const block = await prisma.scheduleBlock.create({
    data: {
      title: String(body.title || 'Эфирный блок'),
      dayOfWeek: Number(body.dayOfWeek),
      startSecond: Number(body.startSecond),
      endSecond: Number(body.endSecond),
      playlistId: Number(body.playlistId)
    }
  });
  return NextResponse.json(block, { status: 201 });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  await prisma.scheduleBlock.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
