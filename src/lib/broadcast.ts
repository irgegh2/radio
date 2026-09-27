import { prisma } from '@/lib/prisma';

type TrackLike = {
  id: number;
  title: string;
  artist: string;
  genre: string | null;
  coverUrl: string | null;
  coverKey: string | null;
  audioUrl: string;
  s3Key: string | null;
  duration: number | null;
  kind: string;
  active: boolean;
};

type Sequence = {
  tracks: TrackLike[];
  shuffle: boolean;
  playlistId: number | null;
  playlistName: string;
  sessionStartedAt: Date;
  elapsedSeconds: number;
  source: 'SCHEDULE' | 'DEFAULT' | 'MANUAL_PLAYLIST' | 'FALLBACK';
};

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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
    secondsOfDay: hour * 3600 + minute * 60 + second,
    dateKey: `${get('year')}-${get('month')}-${get('day')}`
  };
}

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string) {
  const result = [...items];
  const random = randomFromSeed(hashSeed(seed));

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

async function playable<T extends TrackLike>(track: T) {
  return {
    ...track,
    audioUrl: track.s3Key ? `/api/public/media/${track.id}` : track.audioUrl,
    coverUrl: track.coverKey ? `/api/public/media/${track.id}/cover` : track.coverUrl
  };
}

function usableTracks(tracks: TrackLike[]) {
  return tracks.filter((track) => track.active && (track.duration || 0) > 0);
}

async function antiRepeatOrder(
  tracks: TrackLike[],
  shuffle: boolean,
  seed: string,
  sessionStartedAt: Date,
  repeatWindow: number
) {
  const usable = usableTracks(tracks);
  if (!shuffle || usable.length < 2) return usable;

  const shuffled = seededShuffle(usable, seed);
  const recent = await prisma.play.findMany({
    where: { startedAt: { lt: sessionStartedAt } },
    orderBy: { startedAt: 'desc' },
    take: Math.max(0, repeatWindow),
    select: { trackId: true }
  });

  const recentIds = new Set(recent.map((play) => play.trackId));
  const fresh = shuffled.filter((track) => !recentIds.has(track.id));
  const stale = shuffled.filter((track) => recentIds.has(track.id));

  return fresh.length ? [...fresh, ...stale] : shuffled;
}

function pickAtElapsed(tracks: TrackLike[], elapsedSeconds: number) {
  const usable = usableTracks(tracks);
  const cycleSeconds = usable.reduce((sum, track) => sum + (track.duration || 0), 0);

  if (!usable.length || cycleSeconds <= 0) {
    return { current: null, offsetSeconds: 0, cycleSeconds: 0, index: -1 };
  }

  let cursor = ((elapsedSeconds % cycleSeconds) + cycleSeconds) % cycleSeconds;

  for (let i = 0; i < usable.length; i++) {
    const duration = usable[i].duration || 0;
    if (cursor < duration) {
      return {
        current: usable[i],
        offsetSeconds: cursor,
        cycleSeconds,
        index: i
      };
    }
    cursor -= duration;
  }

  return { current: usable[0], offsetSeconds: 0, cycleSeconds, index: 0 };
}

async function ensureControl() {
  return prisma.broadcastControl.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  });
}

async function closeOpenPlay(now: Date) {
  const open = await prisma.play.findFirst({
    where: { endedAt: null },
    orderBy: { startedAt: 'desc' }
  });

  if (open) {
    await prisma.play.update({
      where: { id: open.id },
      data: { endedAt: now }
    });
  }
}

async function logCurrentTrack(trackId: number | null, playing: boolean, now: Date) {
  const open = await prisma.play.findFirst({
    where: { endedAt: null },
    orderBy: { startedAt: 'desc' }
  });

  if (!playing || !trackId) {
    if (open) {
      await prisma.play.update({ where: { id: open.id }, data: { endedAt: now } });
    }
    return;
  }

  if (open?.trackId === trackId) return;

  if (open) {
    await prisma.play.update({ where: { id: open.id }, data: { endedAt: now } });
  }

  await prisma.play.create({ data: { trackId, startedAt: now } });
}

async function promoteDueOverride(now: Date) {
  const due = await prisma.queueOverride.findFirst({
    where: { scheduledAt: { lte: now } },
    orderBy: [{ scheduledAt: 'asc' }, { position: 'asc' }],
    include: { track: true }
  });

  if (!due || !due.track.active || !(due.track.duration || 0)) return null;

  await prisma.$transaction([
    prisma.broadcastControl.upsert({
      where: { id: 1 },
      update: {
        mode: 'MANUAL_TRACK',
        status: 'PLAYING',
        manualTrackId: due.trackId,
        manualPlaylistId: null,
        manualStartedAt: due.scheduledAt,
        manualOffsetSeconds: 0,
        version: { increment: 1 }
      },
      create: {
        id: 1,
        mode: 'MANUAL_TRACK',
        status: 'PLAYING',
        manualTrackId: due.trackId,
        manualStartedAt: due.scheduledAt
      }
    }),
    prisma.queueOverride.delete({ where: { id: due.id } })
  ]);

  return due;
}

async function playlistSequence(
  playlistId: number,
  elapsedSeconds: number,
  sessionStartedAt: Date,
  source: Sequence['source'],
  seed: string,
  repeatWindow: number
): Promise<Sequence | null> {
  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    include: {
      items: {
        orderBy: { position: 'asc' },
        include: { track: true }
      }
    }
  });

  if (!playlist || !playlist.active) return null;

  const tracks = await antiRepeatOrder(
    playlist.items.map((item) => item.track),
    playlist.shuffle,
    seed,
    sessionStartedAt,
    repeatWindow
  );

  return {
    tracks,
    shuffle: playlist.shuffle,
    playlistId: playlist.id,
    playlistName: playlist.name,
    sessionStartedAt,
    elapsedSeconds,
    source
  };
}

async function getAutoSequence(
  now: Date,
  timezone: string,
  defaultPlaylistId: number | null,
  rotationStartedAt: Date,
  repeatWindow: number
): Promise<{ sequence: Sequence; block: any | null }> {
  const local = zonedParts(now, timezone);

  const block = await prisma.scheduleBlock.findFirst({
    where: {
      active: true,
      dayOfWeek: local.dayOfWeek,
      startSecond: { lte: local.secondsOfDay },
      endSecond: { gt: local.secondsOfDay }
    },
    include: { playlist: true },
    orderBy: { startSecond: 'desc' }
  });

  if (block) {
    const elapsed = Math.max(0, local.secondsOfDay - block.startSecond);
    const startedAt = new Date(now.getTime() - elapsed * 1000);
    const sequence = await playlistSequence(
      block.playlistId,
      elapsed,
      startedAt,
      'SCHEDULE',
      `schedule:${block.id}:${local.dateKey}`,
      repeatWindow
    );

    if (sequence) return { sequence, block };
  }

  if (defaultPlaylistId) {
    const elapsed = Math.max(0, Math.floor((now.getTime() - rotationStartedAt.getTime()) / 1000));
    const sequence = await playlistSequence(
      defaultPlaylistId,
      elapsed,
      rotationStartedAt,
      'DEFAULT',
      `default:${defaultPlaylistId}:${rotationStartedAt.toISOString()}`,
      repeatWindow
    );

    if (sequence) return { sequence, block: null };
  }

  const tracks = await prisma.track.findMany({
    where: { active: true },
    orderBy: { createdAt: 'asc' }
  });

  const elapsed = Math.max(0, Math.floor((now.getTime() - rotationStartedAt.getTime()) / 1000));
  const ordered = await antiRepeatOrder(
    tracks,
    true,
    `fallback:${rotationStartedAt.toISOString()}`,
    rotationStartedAt,
    repeatWindow
  );

  return {
    sequence: {
      tracks: ordered,
      shuffle: true,
      playlistId: null,
      playlistName: 'Основная ротация',
      sessionStartedAt: rotationStartedAt,
      elapsedSeconds: elapsed,
      source: 'FALLBACK'
    },
    block: null
  };
}

export async function getBroadcastState() {
  const now = new Date();
  const settings = await prisma.stationSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  });

  await promoteDueOverride(now);

  let control = await ensureControl();

  if (control.mode === 'MANUAL_TRACK' && control.status === 'PLAYING' && control.manualTrackId) {
    const track = await prisma.track.findUnique({ where: { id: control.manualTrackId } });

    if (!track || !track.active || !(track.duration || 0)) {
      control = await prisma.broadcastControl.update({
        where: { id: 1 },
        data: {
          mode: 'AUTO',
          manualTrackId: null,
          manualPlaylistId: null,
          manualStartedAt: null,
          manualOffsetSeconds: 0,
          version: { increment: 1 }
        }
      });
    } else {
      const elapsed = Math.max(
        0,
        Math.floor((now.getTime() - (control.manualStartedAt || now).getTime()) / 1000)
      );

      if (elapsed >= (track.duration || 0)) {
        control = await prisma.broadcastControl.update({
          where: { id: 1 },
          data: {
            mode: 'AUTO',
            manualTrackId: null,
            manualPlaylistId: null,
            manualStartedAt: null,
            manualOffsetSeconds: 0,
            version: { increment: 1 }
          }
        });
      }
    }
  }

  let sequence: Sequence | null = null;
  let block: any | null = null;
  let currentTrack: TrackLike | null = null;
  let offsetSeconds = 0;
  let index = -1;
  let sourceLabel = 'Автоматический эфир';

  if (control.mode === 'MANUAL_TRACK' && control.manualTrackId) {
    currentTrack = await prisma.track.findUnique({ where: { id: control.manualTrackId } });
    offsetSeconds =
      control.status === 'PAUSED'
        ? control.manualOffsetSeconds
        : Math.max(
            0,
            Math.floor((now.getTime() - (control.manualStartedAt || now).getTime()) / 1000)
          );
    sourceLabel = 'Ручной трек';
  } else if (control.mode === 'MANUAL_PLAYLIST' && control.manualPlaylistId) {
    const elapsed =
      control.status === 'PAUSED'
        ? control.manualOffsetSeconds
        : Math.max(
            0,
            Math.floor((now.getTime() - (control.manualStartedAt || now).getTime()) / 1000)
          );

    sequence = await playlistSequence(
      control.manualPlaylistId,
      elapsed,
      control.manualStartedAt || now,
      'MANUAL_PLAYLIST',
      `manual:${control.manualPlaylistId}:${(control.manualStartedAt || now).toISOString()}`,
      settings.repeatWindow
    );

    if (sequence) {
      const picked = pickAtElapsed(sequence.tracks, elapsed);
      currentTrack = picked.current;
      offsetSeconds = picked.offsetSeconds;
      index = picked.index;
      sourceLabel = 'Ручной плейлист';
    }
  }

  if (control.mode === 'AUTO' || (!currentTrack && control.mode !== 'MANUAL_TRACK')) {
    const auto = await getAutoSequence(
      now,
      settings.timezone || 'Europe/Moscow',
      settings.defaultPlaylistId,
      settings.rotationStartedAt,
      settings.repeatWindow
    );

    sequence = auto.sequence;
    block = auto.block;
    const picked = pickAtElapsed(sequence.tracks, sequence.elapsedSeconds);
    currentTrack = picked.current;
    offsetSeconds = picked.offsetSeconds;
    index = picked.index;
    sourceLabel = block ? 'Расписание' : 'Автоматический эфир';
  }

  const isPlaying = control.status !== 'PAUSED' && Boolean(currentTrack);
  await logCurrentTrack(currentTrack?.id || null, isPlaying, now);

  const queue: Array<{
    track: Awaited<ReturnType<typeof playable>>;
    startsAt: string;
    endsAt: string;
    offsetSeconds: number;
    source: string;
  }> = [];

  if (currentTrack) {
    const duration = currentTrack.duration || 0;
    const startMs = now.getTime() - offsetSeconds * 1000;
    const endMs = startMs + duration * 1000;

    queue.push({
      track: await playable(currentTrack),
      startsAt: new Date(startMs).toISOString(),
      endsAt: new Date(endMs).toISOString(),
      offsetSeconds,
      source: control.mode === 'AUTO' ? sourceLabel : control.mode
    });

    const forced = await prisma.queueOverride.findMany({
      where: { scheduledAt: { gt: now } },
      orderBy: [{ scheduledAt: 'asc' }, { position: 'asc' }],
      take: 6,
      include: { track: true }
    });

    for (const item of forced) {
      const itemDuration = item.track.duration || 0;
      queue.push({
        track: await playable(item.track),
        startsAt: item.scheduledAt.toISOString(),
        endsAt: new Date(item.scheduledAt.getTime() + itemDuration * 1000).toISOString(),
        offsetSeconds: 0,
        source: 'MANUAL_NEXT'
      });
    }

    if (sequence && sequence.tracks.length && index >= 0) {
      let cursor = Math.max(
        endMs,
        forced.length
          ? forced[forced.length - 1].scheduledAt.getTime() +
              (forced[forced.length - 1].track.duration || 0) * 1000
          : endMs
      );

      const seenStarts = new Set(queue.map((item) => item.startsAt));
      for (let step = 1; queue.length < 12 && step <= sequence.tracks.length * 2; step++) {
        const next = sequence.tracks[(index + step) % sequence.tracks.length];
        const durationNext = next.duration || 0;
        const startsAt = new Date(cursor).toISOString();

        if (!seenStarts.has(startsAt)) {
          queue.push({
            track: await playable(next),
            startsAt,
            endsAt: new Date(cursor + durationNext * 1000).toISOString(),
            offsetSeconds: 0,
            source: sequence.source
          });
          seenStarts.add(startsAt);
        }

        cursor += durationNext * 1000;
      }
    }
  }

  return {
    serverTime: now.toISOString(),
    timezone: settings.timezone || 'Europe/Moscow',
    control: {
      mode: control.mode,
      status: control.status,
      version: control.version
    },
    playlistId: sequence?.playlistId || null,
    playlistName: sequence?.playlistName || (currentTrack ? 'Ручной трек' : 'Нет эфира'),
    sourceLabel,
    scheduleBlock: block
      ? {
          id: block.id,
          title: block.title,
          startSecond: block.startSecond,
          endSecond: block.endSecond
        }
      : null,
    currentTrack: currentTrack ? await playable(currentTrack) : null,
    offsetSeconds,
    queue,
    tracks: sequence ? await Promise.all(sequence.tracks.map(playable)) : []
  };
}

export async function pauseBroadcast() {
  const state = await getBroadcastState();
  const now = new Date();

  if (!state.currentTrack) {
    return prisma.broadcastControl.upsert({
      where: { id: 1 },
      update: { status: 'PAUSED', version: { increment: 1 } },
      create: { id: 1, status: 'PAUSED' }
    });
  }

  const control = await ensureControl();

  if (control.mode === 'MANUAL_PLAYLIST' && control.manualStartedAt) {
    const elapsed = Math.max(0, Math.floor((now.getTime() - control.manualStartedAt.getTime()) / 1000));
    await prisma.broadcastControl.update({
      where: { id: 1 },
      data: {
        status: 'PAUSED',
        manualOffsetSeconds: elapsed,
        version: { increment: 1 }
      }
    });
  } else {
    await prisma.broadcastControl.update({
      where: { id: 1 },
      data: {
        mode: 'MANUAL_TRACK',
        status: 'PAUSED',
        manualTrackId: state.currentTrack.id,
        manualPlaylistId: null,
        manualStartedAt: null,
        manualOffsetSeconds: Math.floor(state.offsetSeconds),
        version: { increment: 1 }
      }
    });
  }

  await closeOpenPlay(now);
  return getBroadcastState();
}

export async function resumeBroadcast() {
  const control = await ensureControl();
  const now = new Date();

  if (control.status !== 'PAUSED') return getBroadcastState();

  const startedAt = new Date(now.getTime() - control.manualOffsetSeconds * 1000);

  await prisma.broadcastControl.update({
    where: { id: 1 },
    data: {
      status: 'PLAYING',
      manualStartedAt: startedAt,
      manualOffsetSeconds: 0,
      version: { increment: 1 }
    }
  });

  return getBroadcastState();
}

export async function returnToAuto() {
  await prisma.broadcastControl.upsert({
    where: { id: 1 },
    update: {
      mode: 'AUTO',
      status: 'PLAYING',
      manualTrackId: null,
      manualPlaylistId: null,
      manualStartedAt: null,
      manualOffsetSeconds: 0,
      version: { increment: 1 }
    },
    create: { id: 1 }
  });

  return getBroadcastState();
}

export async function playTrackNow(trackId: number) {
  const track = await prisma.track.findUnique({ where: { id: trackId } });
  if (!track || !track.active || !(track.duration || 0)) throw new Error('Track unavailable');

  const now = new Date();
  await prisma.queueOverride.deleteMany({});
  await prisma.broadcastControl.upsert({
    where: { id: 1 },
    update: {
      mode: 'MANUAL_TRACK',
      status: 'PLAYING',
      manualTrackId: trackId,
      manualPlaylistId: null,
      manualStartedAt: now,
      manualOffsetSeconds: 0,
      version: { increment: 1 }
    },
    create: {
      id: 1,
      mode: 'MANUAL_TRACK',
      status: 'PLAYING',
      manualTrackId: trackId,
      manualStartedAt: now
    }
  });

  return getBroadcastState();
}

export async function playPlaylistNow(playlistId: number) {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist || !playlist.active) throw new Error('Playlist unavailable');

  const now = new Date();
  await prisma.queueOverride.deleteMany({});
  await prisma.broadcastControl.upsert({
    where: { id: 1 },
    update: {
      mode: 'MANUAL_PLAYLIST',
      status: 'PLAYING',
      manualTrackId: null,
      manualPlaylistId: playlistId,
      manualStartedAt: now,
      manualOffsetSeconds: 0,
      version: { increment: 1 }
    },
    create: {
      id: 1,
      mode: 'MANUAL_PLAYLIST',
      status: 'PLAYING',
      manualPlaylistId: playlistId,
      manualStartedAt: now
    }
  });

  return getBroadcastState();
}

export async function queueTrackNext(trackId: number) {
  const state = await getBroadcastState();
  const track = await prisma.track.findUnique({ where: { id: trackId } });

  if (!track || !track.active || !(track.duration || 0)) throw new Error('Track unavailable');

  const last = await prisma.queueOverride.findFirst({
    orderBy: [{ scheduledAt: 'desc' }, { position: 'desc' }],
    include: { track: true }
  });

  let scheduledAt = state.queue[0]?.endsAt
    ? new Date(state.queue[0].endsAt)
    : new Date();

  if (last) {
    const lastEnd = new Date(last.scheduledAt.getTime() + (last.track.duration || 0) * 1000);
    if (lastEnd > scheduledAt) scheduledAt = lastEnd;
  }

  const maxPosition = await prisma.queueOverride.findFirst({ orderBy: { position: 'desc' } });

  await prisma.queueOverride.create({
    data: {
      trackId,
      scheduledAt,
      position: (maxPosition?.position ?? -1) + 1
    }
  });

  await prisma.broadcastControl.upsert({
    where: { id: 1 },
    update: { version: { increment: 1 } },
    create: { id: 1, version: 1 }
  });

  return getBroadcastState();
}
