import { prisma } from '@/lib/prisma';

type TrackLike = {
  id: number;
  title: string;
  artist: string;
  genre: string | null;
  coverUrl: string | null;
  audioUrl: string;
  s3Key: string | null;
  duration: number | null;
  kind: string;
  active: boolean;
};

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || '';

  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };

  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  const second = Number(get('second'));

  return {
    dayOfWeek: dayMap[get('weekday')] ?? 0,
    secondsOfDay: hour * 3600 + minute * 60 + second
  };
}

async function playable<T extends TrackLike>(track: T) {
  return track.s3Key
    ? { ...track, audioUrl: `/api/public/media/${track.id}` }
    : track;
}

function pickAtElapsed(tracks: TrackLike[], elapsedSeconds: number) {
  const usable = tracks.filter((track) => track.active && (track.duration || 0) > 0);
  const cycle = usable.reduce((sum, track) => sum + (track.duration || 0), 0);

  if (!usable.length || cycle <= 0) {
    return { current: null, offsetSeconds: 0, cycleSeconds: 0, index: -1 };
  }

  let cursor = ((elapsedSeconds % cycle) + cycle) % cycle;

  for (let i = 0; i < usable.length; i++) {
    const duration = usable[i].duration || 0;
    if (cursor < duration) {
      return {
        current: usable[i],
        offsetSeconds: cursor,
        cycleSeconds: cycle,
        index: i
      };
    }
    cursor -= duration;
  }

  return { current: usable[0], offsetSeconds: 0, cycleSeconds: cycle, index: 0 };
}

export async function getBroadcastState() {
  const now = new Date();

  const settings = await prisma.stationSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  });

  const zone = settings.timezone || 'Europe/Moscow';
  const local = zonedParts(now, zone);

  const block = await prisma.scheduleBlock.findFirst({
    where: {
      active: true,
      dayOfWeek: local.dayOfWeek,
      startSecond: { lte: local.secondsOfDay },
      endSecond: { gt: local.secondsOfDay }
    },
    include: {
      playlist: {
        include: {
          items: {
            orderBy: { position: 'asc' },
            include: { track: true }
          }
        }
      }
    },
    orderBy: { startSecond: 'desc' }
  });

  let playlistId = block?.playlistId || settings.defaultPlaylistId || null;
  let playlistName = block?.playlist.name || 'Основная ротация';
  let tracks: TrackLike[] = [];
  let elapsed = Math.max(0, Math.floor((now.getTime() - settings.rotationStartedAt.getTime()) / 1000));

  if (block) {
    tracks = block.playlist.items.map((item) => item.track);
    elapsed = Math.max(0, local.secondsOfDay - block.startSecond);
  } else if (playlistId) {
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { track: true }
        }
      }
    });
    if (playlist) {
      tracks = playlist.items.map((item) => item.track);
      playlistName = playlist.name;
    }
  }

  if (!tracks.length) {
    tracks = await prisma.track.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' }
    });
    playlistId = null;
    playlistName = 'Основная ротация';
  }

  const picked = pickAtElapsed(tracks, elapsed);
  const current = picked.current ? await playable(picked.current) : null;

  const queue: Array<{
    track: Awaited<ReturnType<typeof playable>>;
    startsAt: string;
    offsetSeconds: number;
  }> = [];

  if (picked.current && picked.index >= 0) {
    const usable = tracks.filter((track) => track.active && (track.duration || 0) > 0);
    const currentDuration = picked.current.duration || 0;
    let startMs = now.getTime() - picked.offsetSeconds * 1000;

    for (let step = 0; step < Math.min(12, Math.max(usable.length * 2, 1)); step++) {
      const index = (picked.index + step) % usable.length;
      const track = usable[index];
      const signed = await playable(track);
      queue.push({
        track: signed,
        startsAt: new Date(startMs).toISOString(),
        offsetSeconds: step === 0 ? picked.offsetSeconds : 0
      });
      startMs += (track.duration || 0) * 1000;
    }
  }

  return {
    serverTime: now.toISOString(),
    timezone: zone,
    playlistId,
    playlistName,
    scheduleBlock: block
      ? {
          id: block.id,
          title: block.title,
          startSecond: block.startSecond,
          endSecond: block.endSecond
        }
      : null,
    currentTrack: current,
    offsetSeconds: picked.offsetSeconds,
    queue,
    tracks: await Promise.all(tracks.map(playable))
  };
}
