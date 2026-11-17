import 'server-only';
import { mkdir, readFile, rename, writeFile, unlink, open, stat, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { BlobError, BlobPreconditionFailedError, get, put } from '@vercel/blob';
import { initialContent } from './content-seed';
import { ContentError, validateContent } from './content-validation';
import { blobStorageEnabled, blobStorageOptions, requireStorageConfiguration } from './blob-storage';
import { validateBlobMedia } from './blob-media';
import type { SiteContent } from './content-types';

const CONTENT_PATHNAME = 'vivid/content.json';
const conflict = () => new ContentError('Content changed in another session. Reload the studio before saving again.', 409);

// Local installations use a persistent volume; Vercel uses a private Blob store.
export function dataDirectory(): string { return path.resolve(/* turbopackIgnore: true */ process.env.VIVID_DATA_DIR || path.join(process.cwd(), '.data')); }
export function mediaDirectory(): string { return path.join(dataDirectory(), 'media'); }

async function readBlobContent(): Promise<{ content: SiteContent; etag: string | null }> {
  requireStorageConfiguration();
  const result = await get(CONTENT_PATHNAME, {
    access: 'private', useCache: false, ...blobStorageOptions(),
    // Compression changes the download ETag to a weak representation tag.
    // Read the original bytes so conditional saves use the storage ETag.
    headers: { 'Accept-Encoding': 'identity' },
  });
  if (!result) return { content: structuredClone(initialContent), etag: null };
  if (result.statusCode !== 200 || !result.blob.etag) throw new ContentError('The latest studio content could not be read. Try again before saving.', 503);
  const content = validateContent(await new Response(result.stream).json());
  return { content, etag: result.blob.etag };
}

export async function readContent(): Promise<SiteContent> {
  if (blobStorageEnabled()) return (await readBlobContent()).content;
  // Keep public pages available while the deployment's store is being connected.
  if (process.env.VERCEL) return structuredClone(initialContent);
  try { return validateContent(JSON.parse(await readFile(path.join(dataDirectory(), 'content.json'), 'utf8'))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(initialContent);
    throw error;
  }
}

export function publicContent(content: SiteContent): SiteContent {
  const creators = content.creators.filter(item => item.published);
  const publishedIds = new Set(creators.map(item => item.id));
  const brands = content.brands.filter(item => item.published);
  const publishedBrandIds = new Set(brands.map(item => item.id));
  return {
    revision: content.revision,
    creators,
    brands,
    reels: content.reels.filter(item => item.published).map(item => ({
      ...item,
      ...(item.creatorId && !publishedIds.has(item.creatorId) ? { creatorId: '', creator: '' } : {}),
      ...(item.brandId && !publishedBrandIds.has(item.brandId) ? { brandId: '', brand: '' } : {}),
    })),
  };
}

async function validateUploadedMedia(next: SiteContent, current: SiteContent): Promise<void> {
  const creators = new Map(current.creators.map(item => [item.id, item]));
  const reels = new Map(current.reels.map(item => [item.id, item]));
  const brands = new Map(current.brands.map(item => [item.id, item]));
  const changed: { value: string; label: string; kind: 'image' | 'video' }[] = [];
  // Existing media stays usable while every replacement or new record must use
  // a real upload. Drafts can still be saved before choosing their files.
  next.creators.forEach((item, index) => {
    if (item.image && item.image !== creators.get(item.id)?.image) changed.push({ value: item.image, label: `Creator ${index + 1} image`, kind: 'image' });
  });
  next.brands.forEach((item, index) => {
    const previous = brands.get(item.id);
    if (item.published && !item.logo && (!previous || !previous.published || previous.logo)) throw new ContentError(`Brand ${index + 1} logo is required before publishing. Upload a logo in the studio.`);
    if (item.logo && item.logo !== previous?.logo) changed.push({ value: item.logo, label: `Brand ${index + 1} logo`, kind: 'image' });
  });
  next.reels.forEach((item, index) => {
    const previous = reels.get(item.id);
    if (item.image && item.image !== previous?.image) changed.push({ value: item.image, label: `Reel ${index + 1} cover image`, kind: 'image' });
    if (item.video && item.video !== previous?.video) changed.push({ value: item.video, label: `Reel ${index + 1} video`, kind: 'video' });
  });
  await Promise.all(changed.map(async ({ value, label, kind }) => {
    const match = /^\/api\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|mp4|webm))$/.exec(value);
    if (!match || (kind === 'video') !== ['mp4', 'webm'].includes(match[2])) throw new ContentError(`${label} must be an uploaded ${kind}. Choose a file in the studio.`);
    if (blobStorageEnabled()) {
      await validateBlobMedia(match[1], kind);
      return;
    }
    try {
      const info = await lstat(path.join(mediaDirectory(), match[1]));
      if (!info.isFile()) throw new ContentError(`${label} upload is unavailable. Please upload the file again.`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ContentError(`${label} upload is unavailable. Please upload the file again.`);
      throw error;
    }
  }));
}

async function recoverAbandonedLock(lockPath: string): Promise<void> {
  try {
    const snapshot = await readFile(lockPath, 'utf8');
    const info = await stat(lockPath);
    let abandoned = false;
    try {
      const metadata = JSON.parse(snapshot);
      if (!Number.isSafeInteger(metadata.pid) || metadata.pid <= 0 || !Number.isSafeInteger(metadata.created) || metadata.created <= 0 || typeof metadata.token !== 'string') throw new Error('Invalid lock metadata');
      try { process.kill(metadata.pid, 0); }
      catch (error) { abandoned = (error as NodeJS.ErrnoException).code === 'ESRCH'; }
    } catch { abandoned = Date.now() - info.mtimeMs > 60_000; }
    if (!abandoned) return;
    // A new owner writes a unique token. Recheck both identity and contents so
    // recovering a crashed writer does not remove a replacement lock.
    const latest = await stat(lockPath);
    if (latest.ino !== info.ino || latest.mtimeMs !== info.mtimeMs || latest.size !== info.size || await readFile(lockPath, 'utf8') !== snapshot) return;
    await unlink(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

// Locks are scoped to workers on the same host and persistent volume.
async function acquireLock() {
  const lockPath = path.join(dataDirectory(), 'content.lock');
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const handle = await open(lockPath, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify({ pid: process.pid, created: Date.now(), token: randomUUID() })); }
      catch (error) { await handle.close(); await unlink(lockPath); throw error; }
      return { handle, path: lockPath };
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      await recoverAbandonedLock(lockPath);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  throw new ContentError('Content is being saved elsewhere. Please try again.', 503);
}

export async function saveContent(value: unknown): Promise<SiteContent> {
  requireStorageConfiguration();
  const next = validateContent(value);
  if (blobStorageEnabled()) {
    const { content: current, etag } = await readBlobContent();
    if (next.revision !== current.revision) throw conflict();
    await validateUploadedMedia(next, current);
    const saved = { ...next, revision: randomUUID() };
    try {
      await put(CONTENT_PATHNAME, JSON.stringify(saved, null, 2), {
        access: 'private', ...blobStorageOptions(),
        contentType: 'application/json', addRandomSuffix: false,
        cacheControlMaxAge: 60,
        // Existing content uses storage-level compare-and-swap. The first save
        // must also be conditional so two workers cannot both replace the seed.
        ...(etag ? { allowOverwrite: true, ifMatch: etag } : { allowOverwrite: false }),
      });
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError || (error instanceof BlobError && /already exists/i.test(error.message))) throw conflict();
      throw error;
    }
    return saved;
  }
  await mkdir(dataDirectory(), { recursive: true });
  const lock = await acquireLock();
  const temporary = path.join(dataDirectory(), `content-${randomUUID()}.tmp`);
  try {
    const current = await readContent();
    if (next.revision !== current.revision) throw conflict();
    await validateUploadedMedia(next, current);
    const saved = { ...next, revision: randomUUID() };
    await writeFile(temporary, JSON.stringify(saved, null, 2), { mode: 0o600, flag: 'wx' });
    await rename(temporary, path.join(dataDirectory(), 'content.json'));
    return saved;
  } finally {
    await unlink(temporary).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Could not clean content temporary file.'); });
    await lock.handle.close();
    await unlink(lock.path);
  }
}
