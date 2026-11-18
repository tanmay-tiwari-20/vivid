import 'server-only';
import type { UploadApiResponse } from 'cloudinary';
import { cloudinaryClient, cloudinaryFolder, requireStorageConfiguration } from './cloudinary';
import { ContentError, validateContent } from './content-validation';
import { initialContent } from './content-seed';
import type { SiteContent } from './content-types';

const CONTENT_LIMIT = 8 * 1024 * 1024;
const MAX_SEQUENCE = 999_999_999_999;
type Snapshot = { sequence: number; content: SiteContent };
const hints = new Map<string, Snapshot>();
const unavailable = () => new ContentError('The latest studio content could not be read from Cloudinary. Try again before saving.', 503);
const conflict = () => new ContentError('Content changed in another session. Reload the studio before saving again.', 409);

function contentId(sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > MAX_SEQUENCE) throw unavailable();
  return `${cloudinaryFolder()}/content/${String(sequence).padStart(12, '0')}.json`;
}

async function readSnapshot(sequence: number, signal?: AbortSignal): Promise<Snapshot | null> {
  const client = cloudinaryClient();
  const url = client.utils.private_download_url(contentId(sequence), 'json', {
    resource_type: 'raw', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60,
  });
  let response: Response;
  try { response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: signal || AbortSignal.timeout(15_000) }); }
  catch { throw unavailable(); }
  if (response.status === 404) { await response.body?.cancel(); return null; }
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > CONTENT_LIMIT) {
    await response.body?.cancel();
    throw unavailable();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > CONTENT_LIMIT) { await reader.cancel(); throw unavailable(); }
      chunks.push(value);
    }
    return { sequence, content: validateContent(JSON.parse(Buffer.concat(chunks).toString('utf8'))) };
  } catch { throw unavailable(); }
  finally { reader.releaseLock(); }
}

/** Exact lookups bypass the eventually indexed Search API and public CDN cache. */
export async function readCloudinaryContent(): Promise<Snapshot> {
  requireStorageConfiguration();
  const client = cloudinaryClient();
  const key = `${client.config().cloud_name}/${cloudinaryFolder()}`;
  // Bound the whole cold search, not each lookup independently, so discovery
  // cannot outlive a serverless request when the upstream service stalls.
  const signal = AbortSignal.timeout(20_000);
  let latest = hints.get(key) || { sequence: 0, content: structuredClone(initialContent) };
  let distance = 1;
  let upper: number;
  for (;;) {
    upper = latest.sequence + distance;
    if (upper > MAX_SEQUENCE) throw unavailable();
    const candidate = await readSnapshot(upper, signal);
    if (!candidate) break;
    latest = candidate;
    distance *= 2;
  }
  while (upper - latest.sequence > 1) {
    const middle = Math.floor((latest.sequence + upper) / 2);
    const candidate = await readSnapshot(middle, signal);
    if (candidate) latest = candidate;
    else upper = middle;
  }
  hints.set(key, latest);
  return { sequence: latest.sequence, content: structuredClone(latest.content) };
}

/** A slot is create-only: two workers can never replace the same revision. */
export async function writeCloudinaryContent(saved: SiteContent, sequence: number): Promise<void> {
  const client = cloudinaryClient();
  const public_id = contentId(sequence);
  const bytes = Buffer.from(JSON.stringify(saved));
  if (bytes.length > CONTENT_LIMIT) throw new ContentError('Studio content must be 8 MB or less.', 413);
  let result: UploadApiResponse;
  try {
    result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = client.uploader.upload_stream({
        resource_type: 'raw', type: 'authenticated', public_id,
        overwrite: false, use_filename: false, unique_filename: false,
        timeout: 30_000,
      }, (error, response) => {
        if (error) reject(error);
        else if (!response) reject(unavailable());
        else resolve(response);
      });
      stream.on('error', reject);
      stream.end(bytes);
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'http_code' in error && error.http_code === 409) throw conflict();
    throw new ContentError('Studio content could not be saved to Cloudinary. Reload the latest content before trying again.', 503);
  }
  if (result.existing) throw conflict();
  if (result.public_id !== public_id || result.resource_type !== 'raw' || result.type !== 'authenticated') throw unavailable();
  // Verify actual stored revision: overwrite:false may return an existing asset
  // as success, and ambiguous transports must never claim a losing write won.
  const confirmed = await readSnapshot(sequence);
  if (!confirmed) throw unavailable();
  if (confirmed.content.revision !== saved.revision) throw conflict();
  hints.set(`${client.config().cloud_name}/${cloudinaryFolder()}`, confirmed);
}
