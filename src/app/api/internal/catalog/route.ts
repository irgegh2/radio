import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBroadcastAuthorized } from '@/lib/broadcastAuth';

export async function GET(req: Request) {
  if (!isBroadcastAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tracks = await prisma.track.findMany({
    where: { active: true },
    orderBy: { createdAt: 'asc' }
  });

  return NextResponse.json({
    tracks: tracks.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      genre: track.genre,
      audioUrl: track.audioUrl,
      s3Key: track.s3Key
    }))
  });
}
