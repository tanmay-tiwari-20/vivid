import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { issueSignedToken, presignUrl } from '@vercel/blob';
import { requireAdmin } from '../../../../src/lib/admin-auth';
import { apiError, json, readJson, requireSameOrigin } from '../../../../src/lib/api';
import { mediaDirectory } from '../../../../src/lib/content';
import { ContentError } from '../../../../src/lib/content-validation';
import { IMAGE_LIMIT, MEDIA_TYPES, mediaExtension, VIDEO_LIMIT } from '../../../../src/lib/media';
import { blobStorageEnabled, blobStorageOptions, requireStorageConfiguration } from '../../../../src/lib/blob-storage';
import { blobMediaPath, MEDIA_FILENAME, validateBlobMedia } from '../../../../src/lib/blob-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    requireStorageConfiguration();
    return json({ mode: blobStorageEnabled() ? 'blob' : 'local' });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    requireStorageConfiguration();
    const contentType = request.headers.get('content-type') || '';
    if (blobStorageEnabled()) {
      const value = await readJson(request, 16 * 1024);
      if (!value || typeof value !== 'object' || !('type' in value)) throw new ContentError('This upload request is invalid.');
      if (value.type === 'vivid.upload-complete') {
        if (!('filename' in value) || typeof value.filename !== 'string') throw new ContentError('This upload request is invalid.');
        await validateBlobMedia(value.filename);
        return json({ url: `/api/media/${value.filename}` }, 201);
      }
      if (value.type === 'vivid.upload-authorize') {
        if (!('filename' in value) || typeof value.filename !== 'string') throw new ContentError('Choose a valid image or video to upload.');
        const pathname = blobMediaPath(value.filename);
        const extension = MEDIA_FILENAME.exec(value.filename)![1];
        const constraints = {
          allowedContentTypes: [MEDIA_TYPES[extension]],
          maximumSizeInBytes: ['mp4', 'webm'].includes(extension) ? VIDEO_LIMIT : IMAGE_LIMIT,
          validUntil: Date.now() + 10 * 60_000,
        };
        const signedToken = await issueSignedToken({
          ...blobStorageOptions(), ...constraints, pathname, operations: ['put'],
        });
        const { presignedUrl } = await presignUrl(signedToken, {
          ...constraints, operation: 'put', access: 'private', pathname,
          addRandomSuffix: false, allowOverwrite: false,
        });
        return json({ uploadUrl: presignedUrl });
      }
      if (value.type !== 'blob.generate-client-token' || !('payload' in value) || !value.payload || typeof value.payload !== 'object' || !('pathname' in value.payload) || typeof value.payload.pathname !== 'string') {
        throw new ContentError('This upload request is invalid.');
      }
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw new ContentError('Reload the studio to use the current direct upload flow.', 409);
      return json(await handleUpload({
        body: value as HandleUploadBody,
        request,
        token: process.env.BLOB_READ_WRITE_TOKEN,
        onBeforeGenerateToken: async pathname => {
          requireSameOrigin(request);
          await requireAdmin();
          const filename = pathname.startsWith('vivid/media/') ? pathname.slice('vivid/media/'.length) : '';
          const match = MEDIA_FILENAME.exec(filename);
          if (!match || blobMediaPath(filename) !== pathname) throw new ContentError('Choose a valid image or video to upload.');
          return {
            allowedContentTypes: [MEDIA_TYPES[match[1]]],
            maximumSizeInBytes: ['mp4', 'webm'].includes(match[1]) ? VIDEO_LIMIT : IMAGE_LIMIT,
            validUntil: Date.now() + 10 * 60_000,
            addRandomSuffix: false,
            allowOverwrite: false,
          };
        },
      }));
    }
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
