import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getBroadcastState } from '@/lib/broadcast';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json(await getBroadcastState());
  } catch (error) {
    console.error('Admin queue failed', error);
    const message = error instanceof Error ? error.message : 'Не удалось получить состояние эфира';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
