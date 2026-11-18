import 'server-only';
import { ContentError } from './content-validation';
import { cloudinaryClient, cloudinaryFolder } from './cloudinary';
import { IMAGE_LIMIT, MEDIA_TYPES, mediaExtension, VIDEO_LIMIT } from './media';

export const MEDIA_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|mp4|webm)$/;

export function cloudinaryMediaId(filename: string): string {
  if (!MEDIA_FILENAME.test(filename)) throw new ContentError('Choose a valid uploaded image or video.');
  return `${cloudinaryFolder()}/media/${filename.slice(0, filename.lastIndexOf('.'))}`;
}

/** Only untransformed, versioned assets in this application's cloud are uploads. */
function mediaAsset(source: string) {
  try {
    const url = new URL(source);
    const client = cloudinaryClient();
    const prefix = `/${client.config().cloud_name}/`;
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.port || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(prefix)) throw new Error();
    const match = /^(image|video)\/upload\/v([1-9][0-9]*)\/(.+)$/.exec(url.pathname.slice(prefix.length));
    if (!match) throw new Error();
    const filename = match[3].slice(match[3].lastIndexOf('/') + 1);
    const file = MEDIA_FILENAME.exec(filename);
    if (!file || match[3] !== `${cloudinaryMediaId(filename)}.${file[1]}`) throw new Error();
    const kind = ['mp4', 'webm'].includes(file[1]) ? 'video' : 'image';
    if (match[1] !== kind || !Number.isSafeInteger(Number(match[2]))) throw new Error();
    return { client, publicId: cloudinaryMediaId(filename), version: Number(match[2]), extension: file[1], kind, url: url.href };
  } catch (error) {
    if (error instanceof ContentError && error.status === 503) throw error;
    throw new ContentError('Choose a file uploaded to this studio’s Cloudinary account.');
  }
}

/** Read only the file signature even if the CDN ignores the Range header. */
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

/** Check authoritative metadata and original bytes before accepting a CDN URL. */
export async function validateCloudinaryMedia(source: string, kind?: 'image' | 'video'): Promise<void> {
  const asset = mediaAsset(source);
  if (kind && kind !== asset.kind) throw new ContentError(`Choose an uploaded ${kind}.`);
  try {
    const info = await asset.client.api.resource(asset.publicId, { resource_type: asset.kind, type: 'upload' });
    if (info.public_id !== asset.publicId || info.resource_type !== asset.kind || info.type !== 'upload' || info.format !== asset.extension || info.version !== asset.version || info.secure_url !== asset.url || !Number.isSafeInteger(info.bytes) || info.bytes <= 0) {
      throw new ContentError('This upload has an invalid file type or is empty. Choose another file.');
    }
    if (info.bytes > (asset.kind === 'video' ? VIDEO_LIMIT : IMAGE_LIMIT)) throw new ContentError(`Choose ${asset.kind === 'video' ? 'a video of 100' : 'an image of 10'} MB or less.`, 413);
    // The URL above is checked against our account and the authoritative asset.
    const response = await fetch(info.secure_url, { headers: { Range: 'bytes=0-15' }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (!response.ok || !response.body) throw new ContentError('This upload is unavailable. Please upload the file again.');
    const extension = mediaExtension(await signatureBytes(response.body), MEDIA_TYPES[asset.extension]);
    if (extension !== asset.extension) throw new ContentError('The file contents must match its type. Choose another file.');
  } catch (error) {
    if (error instanceof ContentError) throw error;
    if ((error as { http_code?: number }).http_code === 404) throw new ContentError('This upload is unavailable. Please upload the file again.');
    throw new ContentError('Cloudinary could not verify this upload. Please try again.', 503);
  }
}
