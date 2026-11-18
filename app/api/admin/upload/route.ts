import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { requireAdmin } from '../../../../src/lib/admin-auth';
import { apiError, json, readJson, requireSameOrigin } from '../../../../src/lib/api';
import { mediaDirectory } from '../../../../src/lib/content';
import { ContentError } from '../../../../src/lib/content-validation';
import { mediaExtension, VIDEO_LIMIT } from '../../../../src/lib/media';
import { cloudinaryClient, cloudinaryStorageEnabled, requireStorageConfiguration } from '../../../../src/lib/cloudinary';
import { cloudinaryMediaId, MEDIA_FILENAME, validateCloudinaryMedia } from '../../../../src/lib/cloudinary-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    requireStorageConfiguration();
    return json({ mode: cloudinaryStorageEnabled() ? 'cloudinary' : 'local' });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    requireStorageConfiguration();
    const contentType = request.headers.get('content-type') || '';
    if (cloudinaryStorageEnabled()) {
      const value = await readJson(request, 16 * 1024);
      if (!value || typeof value !== 'object' || !('type' in value)) throw new ContentError('This upload request is invalid.');
      if (value.type === 'vivid.upload-complete') {
        if (!('filename' in value) || typeof value.filename !== 'string' || !('url' in value) || typeof value.url !== 'string') throw new ContentError('This upload request is invalid.');
        const publicId = cloudinaryMediaId(value.filename);
        const extension = MEDIA_FILENAME.exec(value.filename)![1];
        let matchesFile = false;
        try { matchesFile = new URL(value.url).pathname.endsWith(`/${publicId}.${extension}`); } catch { /* Validation reports malformed upload URLs. */ }
        if (!matchesFile) throw new ContentError('The upload confirmation did not match this file. Choose the file again.');
        await validateCloudinaryMedia(value.url, ['mp4', 'webm'].includes(extension) ? 'video' : 'image');
        return json({ url: value.url }, 201);
      }
      if (value.type === 'vivid.upload-authorize') {
        if (!('filename' in value) || typeof value.filename !== 'string') throw new ContentError('Choose a valid image or video to upload.');
        const publicId = cloudinaryMediaId(value.filename);
        const extension = MEDIA_FILENAME.exec(value.filename)![1];
        const client = cloudinaryClient();
        const config = client.config();
        const parameters = {
          timestamp: Math.floor(Date.now() / 1000), public_id: publicId,
          overwrite: false, allowed_formats: extension, type: 'upload',
        };
        return json({
          uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloud_name}/${['mp4', 'webm'].includes(extension) ? 'video' : 'image'}/upload`,
          fields: { ...parameters, api_key: config.api_key, signature: client.utils.api_sign_request(parameters, config.api_secret!) },
        });
      }
      throw new ContentError('This upload request is invalid.');
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
