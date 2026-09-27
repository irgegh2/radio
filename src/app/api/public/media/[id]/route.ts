import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTrackPlaybackUrl, isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const pathname = new URL(req.url).pathname;
  const id = Number(pathname.split('/').filter(Boolean).pop());

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid media id' }, { status: 400 });
  }

  const track = await prisma.track.findUnique({ where: { id } });
  if (!track || !track.active) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }

  if (!track.s3Key) {
    return NextResponse.redirect(track.audioUrl, 307);
  }

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: 'S3 is not configured' }, { status: 503 });
  }

  const signed = await createTrackPlaybackUrl(track.s3Key);
  return NextResponse.redirect(signed, 307);
}
