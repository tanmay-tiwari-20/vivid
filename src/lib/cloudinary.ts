import 'server-only';
import { v2 as cloudinary } from 'cloudinary';
import { ContentError } from './content-validation';

function localStorageSelected(): boolean {
  return process.env.VIVID_STORAGE_MODE === 'local' && !process.env.VERCEL;
}

export function cloudinaryStorageEnabled(): boolean {
  if (localStorageSelected()) return false;
  return Boolean(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_SECRET);
}

function credentials(): { cloud_name: string; api_key: string; api_secret: string } {
  let cloud_name = '', api_key = '', api_secret = '';
  if (process.env.CLOUDINARY_URL) {
    try {
      const url = new URL(process.env.CLOUDINARY_URL);
      if (url.protocol !== 'cloudinary:' || url.port || (url.pathname && url.pathname !== '/') || url.search || url.hash) throw new Error();
      cloud_name = url.hostname;
      api_key = decodeURIComponent(url.username);
      api_secret = decodeURIComponent(url.password);
    } catch { throw new ContentError('Cloudinary configuration is invalid. Use the Cloudinary API environment variable or set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET, then restart or redeploy.', 503); }
  }
  cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim() || cloud_name;
  api_key = process.env.CLOUDINARY_API_KEY?.trim() || api_key;
  api_secret = process.env.CLOUDINARY_API_SECRET?.trim() || api_secret;
  if (!/^[a-zA-Z0-9_-]+$/.test(cloud_name) || !api_key || !api_secret) {
    throw new ContentError('Studio storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (or CLOUDINARY_URL), then restart or redeploy before saving or uploading.', 503);
  }
  return { cloud_name, api_key, api_secret };
}

export function cloudinaryFolder(): string {
  const folder = process.env.VIVID_CLOUDINARY_FOLDER?.trim() || 'vivid';
  if (folder.length > 150 || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(folder) || folder.split('/').some(part => /^v\d+$/.test(part))) {
    throw new ContentError('VIVID_CLOUDINARY_FOLDER must be a folder path containing letters, numbers, hyphens, or underscores.', 503);
  }
  return folder;
}

export function requireStorageConfiguration(): void {
  if (localStorageSelected()) return;
  if (cloudinaryStorageEnabled() || process.env.VERCEL) {
    credentials();
    cloudinaryFolder();
  }
}

/** Configure only on the server; the API secret is never sent to the browser. */
export function cloudinaryClient(): typeof cloudinary {
  cloudinary.config({ ...credentials(), secure: true });
  return cloudinary;
}
