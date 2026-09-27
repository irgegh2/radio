import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import {
  getBroadcastState,
  pauseBroadcast,
  playPlaylistNow,
  playTrackNow,
  queueTrackNext,
  resumeBroadcast,
  returnToAuto,
  stopBroadcast
} from '@/lib/broadcast';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await getBroadcastState());
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    if (body.action === 'pause') return NextResponse.json(await pauseBroadcast());
    if (body.action === 'stop') return NextResponse.json(await stopBroadcast());
    if (body.action === 'resume') return NextResponse.json(await resumeBroadcast());
    if (body.action === 'auto') return NextResponse.json(await returnToAuto());
    if (body.action === 'play-track') {
      return NextResponse.json(await playTrackNow(Number(body.trackId)));
    }
    if (body.action === 'play-playlist') {
      return NextResponse.json(await playPlaylistNow(Number(body.playlistId)));
    }
    if (body.action === 'queue-next') {
      return NextResponse.json(await queueTrackNext(Number(body.trackId)));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Broadcast control failed', error);
    const message = error instanceof Error ? error.message : 'Не удалось изменить эфир';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
