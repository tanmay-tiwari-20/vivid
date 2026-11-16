import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { ContentError } from './content-validation';

export const SESSION_COOKIE = 'vivid_studio';
export const SESSION_SECONDS = 60 * 60 * 12;

export function adminConfigured(): boolean {
  return (process.env.VIVID_ADMIN_PASSWORD?.length ?? 0) >= 12 && (process.env.VIVID_SESSION_SECRET?.length ?? 0) >= 32;
}

function signingKey(): Buffer {
  if (!adminConfigured()) throw new ContentError('Studio access has not been configured.', 503);
  return createHmac('sha256', process.env.VIVID_SESSION_SECRET!).update(process.env.VIVID_ADMIN_PASSWORD!).digest();
}

function signature(payload: string): string { return createHmac('sha256', signingKey()).update(payload).digest('base64url'); }

export function verifyPassword(value: unknown): boolean {
  if (!adminConfigured() || typeof value !== 'string' || value.length > 1024) return false;
  return timingSafeEqual(createHash('sha256').update(value).digest(), createHash('sha256').update(process.env.VIVID_ADMIN_PASSWORD!).digest());
}

export function createSession(): string {
  const payload = Buffer.from(JSON.stringify({ version: 1, expires: Math.floor(Date.now() / 1000) + SESSION_SECONDS, nonce: randomBytes(24).toString('base64url') })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifySession(value: string | undefined): boolean {
  if (!adminConfigured() || !value || value.length > 1024) return false;
  const parts = value.split('.');
  if (parts.length !== 2 || !/^[a-zA-Z0-9_-]+$/.test(parts[0]) || !/^[a-zA-Z0-9_-]{43}$/.test(parts[1])) return false;
  const expected = Buffer.from(signature(parts[0]));
  const provided = Buffer.from(parts[1]);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    return payload.version === 1 && Number.isSafeInteger(payload.expires) && payload.expires > now && payload.expires <= now + SESSION_SECONDS && typeof payload.nonce === 'string';
  } catch { return false; }
}

export async function authenticated(): Promise<boolean> { return verifySession((await cookies()).get(SESSION_COOKIE)?.value); }
export async function requireAdmin(): Promise<void> {
  if (!await authenticated()) throw new ContentError('Your studio session has ended. Please sign in again.', 401);
}

export const sessionCookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const,
  path: '/', maxAge: SESSION_SECONDS,
};

// This studio is intended for one persistent server; the in-memory limiter is scoped to that process.
const loginAttempts = new Map<string, { count: number; expires: number }>();
export function checkLoginLimit(request: Request): void {
  const now = Date.now();
  if (loginAttempts.size > 1000) for (const [key, item] of loginAttempts) if (item.expires < now) loginAttempts.delete(key);
  const key = createHash('sha256').update(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'studio').digest('hex');
  const previous = loginAttempts.get(key);
  const item = previous && previous.expires > now ? previous : { count: 0, expires: now + 15 * 60 * 1000 };
  if (item.count >= 10) throw new ContentError('Too many sign-in attempts. Please wait 15 minutes and try again.', 429);
  item.count++;
  loginAttempts.set(key, item);
}
