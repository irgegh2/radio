import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBroadcastState } from '@/lib/broadcast';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [settings, broadcast, shows] = await Promise.all([
    prisma.stationSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 }
    }),
    getBroadcastState(),
    prisma.show.findMany({
      where: { active: true },
      orderBy: { startHour: 'asc' }
    })
  ]);

  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: settings.timezone || 'Europe/Moscow',
      hour: '2-digit',
      hour12: false
    }).format(now)
  ) % 24;

  const currentShow =
    shows.find((show) => hour >= show.startHour && hour < show.endHour) ||
    shows[0] ||
    null;

  return NextResponse.json({
    settings,
    currentShow,
    shows,
    playlist: broadcast.tracks,
    currentTrack: broadcast.currentTrack,
    offsetSeconds: broadcast.offsetSeconds,
    serverTime: broadcast.serverTime,
    playlistName: broadcast.playlistName,
    scheduleBlock: broadcast.scheduleBlock,
    queue: broadcast.queue,
    history: broadcast.queue.slice(0, 6).map((item) => ({
      ...item.track,
      playedAt: item.startsAt
    }))
  });
}
