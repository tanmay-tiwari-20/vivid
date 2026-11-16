import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { requireAdmin } from '../../../../src/lib/admin-auth';
import { apiError, json, requireSameOrigin } from '../../../../src/lib/api';
import { mediaDirectory } from '../../../../src/lib/content';
import { ContentError } from '../../../../src/lib/content-validation';
import { mediaExtension, VIDEO_LIMIT } from '../../../../src/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data;')) throw new ContentError('Choose a file to upload.');
    const requestLimit = VIDEO_LIMIT + 1024 * 1024;
    if (Number(request.headers.get('content-length')) > requestLimit) throw new ContentError('Choose a file smaller than 100 MB.', 413);
    if (!request.body) throw new ContentError('Choose a file to upload.');
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > requestLimit) { await reader.cancel(); throw new ContentError('Choose a file smaller than 100 MB.', 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let form: FormData;
    try { form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { 'Content-Type': contentType } }).formData(); }
    catch { throw new ContentError('This upload could not be read. Please select the file again.'); }
    const file = form.get('file');
    if (!(file instanceof File) || !file.size) throw new ContentError('Choose a non-empty file to upload.');
    const bytes = Buffer.from(await file.arrayBuffer());
    const extension = mediaExtension(bytes, file.type.toLowerCase());
    const filename = `${randomUUID()}.${extension}`;
    await mkdir(mediaDirectory(), { recursive: true });
    // Uploaded media lives on the runtime volume and is not part of the build.
    await writeFile(path.join(/* turbopackIgnore: true */ mediaDirectory(), filename), bytes, { mode: 0o600, flag: 'wx' });
    return json({ url: `/api/media/${filename}` }, 201);
  } catch (error) { return apiError(error); }
}
