import 'server-only';
import { ContentError } from './content-validation';

export const privateHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export function json(value: unknown, status = 200): Response { return Response.json(value, { status, headers: privateHeaders }); }
export function apiError(error: unknown): Response {
  if (error instanceof ContentError) return json({ error: error.message }, error.status);
  console.error('Vivid content request failed.', error);
  return json({ error: 'We could not complete this request. Please try again.' }, 500);
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  const requestUrl = new URL(request.url);
  // Next may normalize request.url to localhost. Host preserves the address
  // used by the browser; forwarded hosts require an explicit public origin.
  const host = request.headers.get('host') || requestUrl.host;
  if (!/^(?:[a-zA-Z0-9.-]+|\[[a-fA-F0-9:.]+\])(?::\d{1,5})?$/.test(host)) throw new ContentError('The request host is invalid.', 403);
  let expected: string;
  try { expected = process.env.VIVID_SITE_ORIGIN ? new URL(process.env.VIVID_SITE_ORIGIN).origin : new URL(`${requestUrl.protocol}//${host}`).origin; }
  catch { throw new ContentError('The request host is invalid.', 403); }
  if (!origin || origin !== expected) throw new ContentError('This request must come from the Vivid studio.', 403);
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new ContentError('Cross-site requests are not permitted.', 403);
}

export async function readJson(request: Request, limit: number): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ContentError('Send a JSON request.');
  const declaredLength = Number(request.headers.get('content-length'));
  if (declaredLength > limit) throw new ContentError('This request is too large.', 413);
  if (!request.body) throw new ContentError('The request is empty.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw new ContentError('This request is too large.', 413); }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    try { return JSON.parse(bytes.toString('utf8')); }
    catch { throw new ContentError('This request contains invalid JSON.'); }
  } finally { reader.releaseLock(); }
}
