import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { mediaDirectory } from '../../../../src/lib/content';
import { byteRange, MEDIA_TYPES } from '../../../../src/lib/media';
import { blobStorageEnabled } from '../../../../src/lib/blob-storage';
import { serveBlobMedia } from '../../../../src/lib/blob-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ filename: string }> };

async function serve(request: Request, context: Context, head = false): Promise<Response> {
  const { filename } = await context.params;
  const match = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|mp4|webm)$/.exec(filename);
  if (!match) return new Response('Not found', { status: 404 });
  if (blobStorageEnabled()) return serveBlobMedia(request, filename, head);
  const target = path.join(mediaDirectory(), filename);
  let size: number;
  try {
    const info = await stat(target);
    if (!info.isFile()) return new Response('Not found', { status: 404 });
    size = info.size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Response('Not found', { status: 404 });
    return new Response('Media unavailable', { status: 500 });
  }
  const headers: Record<string, string> = {
    'Content-Type': MEDIA_TYPES[match[1]], 'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
  };
  const range = head ? null : request.headers.get('range');
  const selection = range ? byteRange(range, size) : { start: 0, end: size - 1 };
  if (!selection) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
  const length = selection.end - selection.start + 1;
  headers['Content-Length'] = String(length);
  if (range) headers['Content-Range'] = `bytes ${selection.start}-${selection.end}/${size}`;
  if (head || size === 0) return new Response(null, { status: range ? 206 : 200, headers });
  const stream = createReadStream(target, selection);
  const body = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  return new Response(body, { status: range ? 206 : 200, headers });
}

export async function GET(request: Request, context: Context) { return serve(request, context); }
export async function HEAD(request: Request, context: Context) { return serve(request, context, true); }
