export function isBroadcastAuthorized(req: Request) {
  const expected = process.env.BROADCAST_API_KEY || '';
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return Boolean(expected) && token === expected;
}
