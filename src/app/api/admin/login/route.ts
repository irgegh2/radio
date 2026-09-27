import { NextResponse } from 'next/server';
import { isValidPassword, setAdminSession } from '@/lib/auth';

export async function POST(req: Request) {
  const { password } = await req.json();

  if (!isValidPassword(String(password || ''))) {
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
  }

  await setAdminSession();
  return NextResponse.json({ ok: true });
}
