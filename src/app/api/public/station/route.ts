import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [settings, tracks, shows, plays] = await Promise.all([
    prisma.stationSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 }
    }),
    prisma.track.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      take: 12
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

  const currentTrack = plays[0]?.track || tracks[0] || null;

  return NextResponse.json({
    settings,
    currentTrack,
    currentShow,
    shows,
    history: plays.length
      ? plays.map((play) => ({ ...play.track, playedAt: play.startedAt }))
      : tracks.slice(0, 6)
  });
}
