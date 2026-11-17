import 'server-only';
import { ContentError } from './content-validation';

function localStorageSelected(): boolean {
  // Pulled Vercel credentials can coexist with an explicitly local workspace.
  // Vercel deployments always require shared storage, never ephemeral disk.
  return process.env.VIVID_STORAGE_MODE === 'local' && !process.env.VERCEL;
}

export function blobStorageEnabled(): boolean {
  if (localStorageSelected()) return false;
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export function blobStorageOptions(): { token?: string; storeId?: string } {
  // An explicit read-write token keeps existing installations on their store.
  // Let the SDK resolve and refresh OIDC itself when a store ID is configured.
  return process.env.BLOB_READ_WRITE_TOKEN
    ? { token: process.env.BLOB_READ_WRITE_TOKEN }
    : { storeId: process.env.BLOB_STORE_ID };
}

export function requireStorageConfiguration(): void {
  if (localStorageSelected()) return;
  if (process.env.VERCEL && !blobStorageEnabled()) {
    throw new ContentError('Studio storage is not configured. Connect a private Vercel Blob store to this project and redeploy before saving or uploading.', 503);
  }
  if (process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL && !process.env.VERCEL_OIDC_TOKEN) {
    throw new ContentError('Local studio storage authentication is missing. Run vercel env pull and restart the server, or start with vercel dev.', 503);
  }
}
