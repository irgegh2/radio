import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTrackPlaybackUrl, isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';

async function playableTrack<T extends { s3Key: string | null; audioUrl: string }>(track: T) {
  if (track.s3Key && isStorageConfigured()) {
    try {
      return { ...track, audioUrl: await createTrackPlaybackUrl(track.s3Key) };
    } catch (error) {
      console.error('Failed to sign S3 playback URL', error);
    }
  }

  return track;
}

export async function GET() {
  const [settings, tracks, shows, plays] = await Promise.all([
    prisma.stationSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 }
    }),
    prisma.track.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      take: 100
    }),
    prisma.show.findMany({
      where: { active: true },
      orderBy: { startHour: 'asc' }
    }),
    prisma.play.findMany({
      include: { track: true },
      orderBy: { startedAt: 'desc' },
      take: 6
    })
  ]);

  const hour = new Date().getHours();
  const currentShow =
    shows.find((show) => hour >= show.startHour && hour < show.endHour) ||
    shows[0] ||
    null;

  const playlist = await Promise.all(tracks.map(playableTrack));
  const fallbackCurrent = plays[0]?.track || tracks[0] || null;
  const currentTrack = fallbackCurrent ? await playableTrack(fallbackCurrent) : null;

  const historySource = plays.length
    ? plays.map((play) => ({ ...play.track, playedAt: play.startedAt }))
    : tracks.slice(0, 6);

  const history = await Promise.all(historySource.map(playableTrack));

  return NextResponse.json({
    settings,
    currentTrack,
    currentShow,
    playlist,
    shows,
    history
  });
}
