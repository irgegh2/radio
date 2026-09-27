import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTrackPlaybackUrl, isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const id = Number(parts[parts.indexOf('media') + 1]);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid media id' }, { status: 400 });
  }

  const track = await prisma.track.findUnique({ where: { id } });
  if (!track) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }

  if (track.coverKey) {
    if (!isStorageConfigured()) {
      return NextResponse.json({ error: 'S3 is not configured' }, { status: 503 });
    }
    return NextResponse.redirect(await createTrackPlaybackUrl(track.coverKey), 307);
  }

  if (track.coverUrl) {
    return NextResponse.redirect(track.coverUrl, 307);
  }

  return new NextResponse(null, { status: 404 });
}
