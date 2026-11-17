import 'server-only';
import { BlobNotFoundError, get, head } from '@vercel/blob';
import { ContentError } from './content-validation';
import { blobStorageOptions } from './blob-storage';
import { byteRange, IMAGE_LIMIT, MEDIA_TYPES, mediaExtension, VIDEO_LIMIT } from './media';

export const MEDIA_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|mp4|webm)$/;

export function blobMediaPath(filename: string): string {
  if (!MEDIA_FILENAME.test(filename)) throw new ContentError('Choose a valid uploaded image or video.');
  return `vivid/media/${filename}`;
}

/** Read only the signature, even if an upstream server ignores Range. */
async function signatureBytes(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (length < 16) {
      const { done, value } = await reader.read();
      if (done) break;
      const part = value.subarray(0, 16 - length);
      chunks.push(part);
      length += part.length;
    }
    return Buffer.concat(chunks);
  } finally {
    try { await reader.cancel(); } finally { reader.releaseLock(); }
  }
}

/** Never fetch a client-provided URL: resolve a bounded path in our own store. */
export async function validateBlobMedia(filename: string, kind?: 'image' | 'video'): Promise<void> {
  const pathname = blobMediaPath(filename);
  const extension = MEDIA_FILENAME.exec(filename)![1];
  const video = ['mp4', 'webm'].includes(extension);
  if (kind && (kind === 'video') !== video) throw new ContentError(`Choose an uploaded ${kind}.`);
  try {
    const info = await head(pathname, blobStorageOptions());
    if (info.pathname !== pathname || info.contentType.split(';')[0].toLowerCase() !== MEDIA_TYPES[extension] || !info.size) {
      throw new ContentError('This upload has an invalid file type or is empty. Choose another file.');
    }
    if (info.size > (video ? VIDEO_LIMIT : IMAGE_LIMIT)) throw new ContentError(`Choose ${video ? 'a video of 100' : 'an image of 10'} MB or less.`, 413);
    const result = await get(pathname, { ...blobStorageOptions(), access: 'private', useCache: false, headers: { Range: 'bytes=0-15' } });
    if (!result || !result.stream) throw new ContentError('This upload is unavailable. Please upload the file again.');
    const detected = mediaExtension(await signatureBytes(result.stream), MEDIA_TYPES[extension]);
    if (detected !== extension) throw new ContentError('The file contents must match its type. Choose another file.');
  } catch (error) {
    if (error instanceof BlobNotFoundError) throw new ContentError('This upload is unavailable. Please upload the file again.');
    throw error;
  }
}

/** Stream a bounded range without buffering an entire video in the function. */
function sliceStream(source: ReadableStream<Uint8Array>, start: number, end: number): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let offset = 0;
  return new ReadableStream({
    async pull(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) { controller.close(); reader.releaseLock(); return; }
          const previous = offset;
          offset += value.length;
          if (offset <= start) continue;
          const part = value.subarray(Math.max(0, start - previous), Math.min(value.length, end + 1 - previous));
          if (part.length) controller.enqueue(part);
          if (offset > end) {
            controller.close();
            await reader.cancel();
            reader.releaseLock();
          }
          return;
        }
      } catch (error) { controller.error(error); reader.releaseLock(); }
    },
    async cancel(reason) { try { await reader.cancel(reason); } finally { reader.releaseLock(); } },
  });
}

export async function serveBlobMedia(request: Request, filename: string, headOnly = false): Promise<Response> {
  const pathname = blobMediaPath(filename);
  try {
    const info = await head(pathname, blobStorageOptions());
    const extension = MEDIA_FILENAME.exec(filename)![1];
    const headers: Record<string, string> = {
      'Content-Type': MEDIA_TYPES[extension], 'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
    };
    const range = headOnly ? null : request.headers.get('range');
    const selection = range ? byteRange(range, info.size) : { start: 0, end: info.size - 1 };
    if (!selection) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${info.size}` } });
    headers['Content-Length'] = String(selection.end - selection.start + 1);
    const contentRange = `bytes ${selection.start}-${selection.end}/${info.size}`;
    if (range) headers['Content-Range'] = contentRange;
    if (headOnly || info.size === 0) return new Response(null, { headers });
    const result = await get(pathname, {
      ...blobStorageOptions(), access: 'private', abortSignal: request.signal,
      ...(range ? { headers: { Range: `bytes=${selection.start}-${selection.end}` } } : {}),
    });
    if (!result || !result.stream) return new Response('Not found', { status: 404 });
    const body = range && result.headers.get('content-range') !== contentRange
      ? sliceStream(result.stream, selection.start, selection.end) : result.stream;
    return new Response(body, { status: range ? 206 : 200, headers });
  } catch (error) {
    if (error instanceof BlobNotFoundError) return new Response('Not found', { status: 404 });
    console.error('Vivid media request failed.', error);
    return new Response('Media unavailable', { status: 500 });
  }
}
