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
  const days: number[] = Array.isArray(body.dayOfWeeks)
    ? body.dayOfWeeks.map((day: unknown) => Number(day))
    : [Number(body.dayOfWeek)];

  if (!days.length || days.some((day) => day < 0 || day > 6)) {
    return NextResponse.json({ error: 'Выбери дни недели' }, { status: 400 });
  }

  const startSecond = Number(body.startSecond);
  const endSecond = Number(body.endSecond);
  if (!(endSecond > startSecond)) {
    return NextResponse.json({ error: 'Конец должен быть позже начала' }, { status: 400 });
  }

  const created = await prisma.$transaction(
    days.map((dayOfWeek) =>
      prisma.scheduleBlock.create({
        data: {
          title: String(body.title || 'Эфирный блок'),
          dayOfWeek,
          startSecond,
          endSecond,
          playlistId: Number(body.playlistId)
        }
      })
    )
  );

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const block = await prisma.scheduleBlock.update({
    where: { id: Number(body.id) },
    data: {
      title: body.title === undefined ? undefined : String(body.title),
      startSecond: body.startSecond === undefined ? undefined : Number(body.startSecond),
      endSecond: body.endSecond === undefined ? undefined : Number(body.endSecond),
      playlistId: body.playlistId === undefined ? undefined : Number(body.playlistId),
      active: body.active === undefined ? undefined : Boolean(body.active)
    }
  });
  return NextResponse.json(block);
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  await prisma.scheduleBlock.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
