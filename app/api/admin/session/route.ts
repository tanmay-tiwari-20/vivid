import { cookies } from 'next/headers';
import { adminConfigured, authenticated, checkLoginLimit, createSession, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from '../../../../src/lib/admin-auth';
import { apiError, json, readJson, requireSameOrigin } from '../../../../src/lib/api';
import { ContentError } from '../../../../src/lib/content-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { return json({ authenticated: await authenticated(), configured: adminConfigured() }); }
  catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!adminConfigured()) throw new ContentError('Set VIVID_ADMIN_PASSWORD and VIVID_SESSION_SECRET on the server to enable the studio.', 503);
    checkLoginLimit(request);
    const body = await readJson(request, 4096);
    if (!body || typeof body !== 'object' || !verifyPassword((body as { password?: unknown }).password)) throw new ContentError('That password does not match. Please try again.', 401);
    (await cookies()).set(SESSION_COOKIE, createSession(), sessionCookieOptions);
    return json({ authenticated: true, configured: true });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    (await cookies()).set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
    return json({ authenticated: false, configured: adminConfigured() });
  } catch (error) { return apiError(error); }
}
