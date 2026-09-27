import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await prisma.show.findMany({ orderBy: { startHour: 'asc' } }));
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();

  const show = await prisma.show.create({
    data: {
      title: body.title,
      host: body.host,
      description: body.description || null,
      imageUrl: body.imageUrl || null,
      startHour: Number(body.startHour),
      endHour: Number(body.endHour),
      dayOfWeek: Number(body.dayOfWeek || 0)
    }
  });

  return NextResponse.json(show, { status: 201 });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  await prisma.show.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
