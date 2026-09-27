import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE = 'nexus_admin';

function expectedToken() {
  const secret = process.env.ADMIN_SESSION_SECRET || 'dev-only-secret';
  return crypto.createHmac('sha256', secret).update('nexus-radio-admin').digest('hex');
}

export function isValidPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD || 'change-me-now';
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function isAdmin() {
  const jar = await cookies();
  return jar.get(COOKIE)?.value === expectedToken();
}

export async function setAdminSession() {
  const jar = await cookies();
  jar.set(COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}
