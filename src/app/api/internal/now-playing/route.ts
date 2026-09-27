import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBroadcastAuthorized } from '@/lib/broadcastAuth';

export async function POST(req: Request) {
  if (!isBroadcastAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const trackId = Number(body.trackId);

  if (!trackId) {
    return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
  }

  await prisma.play.updateMany({
    where: { endedAt: null },
    data: { endedAt: new Date() }
  });

  const play = await prisma.play.create({
    data: { trackId },
    include: { track: true }
  });

  return NextResponse.json(play, { status: 201 });
}
