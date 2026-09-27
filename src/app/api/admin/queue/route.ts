import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getBroadcastState } from '@/lib/broadcast';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await getBroadcastState());
}
