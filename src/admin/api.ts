export class ApiError extends Error {
  constructor(message: string, public status: number, public outcomeUnknown = false) {
    super(message);
    this.name = 'ApiError';
  }
}

const REQUEST_TIMEOUT = 45_000;
const UPLOAD_TIMEOUT = 5 * 60_000;

function offline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** A failed connection never retries a write: its server outcome may be unknown. */
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  if (offline()) throw new ApiError('You’re offline. Reconnect and try again. Your edits are still here.', 0);
  if (init?.signal?.aborted) throw new ApiError('The request was cancelled.', 0);

  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes((init?.method || 'GET').toUpperCase());
  const controller = new AbortController();
  let timedOut = false;
  let cancelled = false;
  const cancel = () => { cancelled = true; controller.abort(); };
  init?.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, { ...init, credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
    let data: unknown;
    try { data = await response.json(); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      if (!response.ok) throw new ApiError('The server could not complete this request. Please try again.', response.status);
      throw new ApiError('The server response could not be read. Check the latest content before saving again.', 502, mutating);
    }
    if (!response.ok) {
      const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.';
      throw new ApiError(message, response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const recovery = mutating ? ' Your changes may have reached the server. Check the latest content before saving again.' : ' Check your connection and try again.';
    if (timedOut) throw new ApiError(`The connection timed out.${recovery}`, 408, mutating);
    if (cancelled) throw new ApiError(`The request was cancelled.${mutating ? recovery : ''}`, 0, mutating);
    throw new ApiError(`${offline() ? 'Your connection went offline.' : 'We could not reach the server.'}${recovery}`, 0, mutating);
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener('abort', cancel);
  }
}

const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const videoTypes = ['video/mp4', 'video/webm'];
const extensionTypes: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', webm: 'video/webm',
};

/** Some mobile file pickers omit MIME types; the server still checks file signatures. */
export function mediaFile(file: File, video: boolean): File {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mime = file.type.toLowerCase() || extensionTypes[extension] || '';
  if (!video && (['heic', 'heif'].includes(extension) || /image\/hei[cf]/.test(mime))) {
    throw new ApiError('This photo uses HEIC or HEIF. Export or convert it to JPG or PNG, then upload it.', 400);
  }
  const allowed = video ? videoTypes : imageTypes;
  if (!allowed.includes(mime)) throw new ApiError(video ? 'Choose an MP4 or WebM video.' : 'Choose a JPG, PNG, WebP, or GIF image.', 400);
  if (!file.size) throw new ApiError('This file is empty. Choose another file.', 400);
  const maxMegabytes = video ? 100 : 10;
  if (file.size > maxMegabytes * 1024 * 1024) throw new ApiError(`Choose ${video ? 'a video' : 'an image'} of ${maxMegabytes} MB or less.`, 413);
  return file.type === mime ? file : new File([file], file.name, { type: mime, lastModified: file.lastModified });
}

function confirmedUpload(data: { url?: unknown } | null): { url: string } {
  if (typeof data?.url !== 'string' || !data.url.startsWith('/api/media/')) {
    throw new ApiError('The upload confirmation could not be read. Your edits are safe; choose the file again.', 502, true);
  }
  return { url: data.url };
}

function uploadLocalMedia(file: File, onProgress: (percentage: number) => void): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload');
    xhr.responseType = 'json';
    xhr.timeout = UPLOAD_TIMEOUT;
    xhr.withCredentials = true;
    const settle = (error?: ApiError, value?: { url: string }) => {
      xhr.onload = xhr.onerror = xhr.onabort = xhr.ontimeout = null;
      xhr.upload.onprogress = null;
      if (error) reject(error);
      else resolve(value!);
    };
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total) onProgress(Math.min(99, Math.floor(event.loaded / event.total * 100)));
    };
    xhr.onload = () => {
      const data = xhr.response as { url?: unknown; error?: unknown } | null;
      if (xhr.status < 200 || xhr.status >= 300) {
        const fallback = xhr.status === 413
          ? 'The hosting server rejected this file because of its upload limit. Configure direct storage uploads, then try again.'
          : 'The upload failed. Choose the file and try again.';
        settle(new ApiError(typeof data?.error === 'string' ? data.error : fallback, xhr.status));
      } else {
        try {
          const value = confirmedUpload(data);
          onProgress(100);
          settle(undefined, value);
        } catch (error) { settle(error as ApiError); }
      }
    };
    xhr.onerror = () => settle(new ApiError('The upload was interrupted. Check your connection, then choose the file again. Your edits are still here.', 0, true));
    xhr.onabort = () => settle(new ApiError('The upload was cancelled. Choose the file again when you’re ready.', 0, true));
    xhr.ontimeout = () => settle(new ApiError('The upload timed out. Try a smaller file or a stronger connection. Your edits are still here.', 408, true));
    const body = new FormData();
    body.append('file', file);
    xhr.send(body);
  });
}

function signedUploadUrl(data: { uploadUrl?: unknown } | null): string {
  try {
    if (typeof data?.uploadUrl !== 'string') throw new Error();
    const url = new URL(data.uploadUrl);
    const trustedEndpoint = url.hostname === 'vercel.com' && url.pathname === '/api/blob/';
    if (url.protocol !== 'https:' || !trustedEndpoint || url.username || url.password || (url.port && url.port !== '443')) throw new Error();
    return url.href;
  } catch { throw new ApiError('The upload could not be authorized. Choose the file and try again.', 502); }
}

function transferBlob(file: File, uploadUrl: string, signal: AbortSignal, onProgress: (percentage: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const settle = (error?: ApiError) => {
      if (settled) return;
      settled = true;
      xhr.onload = xhr.onerror = xhr.onabort = xhr.ontimeout = null;
      xhr.upload.onprogress = null;
      signal.removeEventListener('abort', cancel);
      if (error) reject(error);
      else resolve();
    };
    const cancel = () => {
      xhr.abort();
      settle(new ApiError('The upload was cancelled. Choose the file again when you’re ready.', 0, true));
    };
    xhr.open('PUT', uploadUrl);
    xhr.withCredentials = false;
    xhr.timeout = UPLOAD_TIMEOUT;
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total) onProgress(Math.max(0, Math.min(99, Math.floor(event.loaded / event.total * 100))));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) settle();
      else settle(new ApiError(xhr.status === 413
        ? 'This file exceeds the storage upload size limit. Choose a smaller file.'
        : 'The storage upload failed. Choose the file and try again.', xhr.status));
    };
    xhr.onerror = () => settle(new ApiError('The upload was interrupted. Check your connection, then choose the file again. Your edits are still here.', 0, true));
    xhr.onabort = () => settle(new ApiError('The upload was cancelled. Choose the file again when you’re ready.', 0, true));
    xhr.ontimeout = () => settle(new ApiError('The upload timed out. Try a smaller file or a stronger connection. Your edits are still here.', 408, true));
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) { cancel(); return; }
    try { xhr.send(file); }
    catch { settle(new ApiError('The upload could not be sent. Check your connection, then choose the file again.', 0, true)); }
  });
}

async function uploadBlobMedia(file: File, onProgress: (percentage: number) => void): Promise<{ url: string }> {
  const extension = Object.entries(extensionTypes).find(([, mime]) => mime === file.type)?.[0];
  if (!extension) throw new ApiError('Choose a supported image or video file.', 400);
  const filename = `${crypto.randomUUID()}.${extension}`;
  const controller = new AbortController();
  let timedOut = false;
  let sendingFile = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, UPLOAD_TIMEOUT);
  try {
    // Exchange only metadata with Next.js. The signed URL grants access to
    // this upload alone, and all file bytes go directly to Blob storage.
    const authorization = await request<{ uploadUrl?: unknown }>('/api/admin/upload', {
      method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'vivid.upload-authorize', filename }),
    });
    const uploadUrl = signedUploadUrl(authorization);
    sendingFile = true;
    await transferBlob(file, uploadUrl, controller.signal, onProgress);
    const data = await request<{ url?: unknown }>('/api/admin/upload', {
      method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'vivid.upload-complete', filename }),
    });
    const value = confirmedUpload(data);
    if (value.url !== `/api/media/${filename}`) throw new ApiError('The upload confirmation did not match this file. Choose the file again.', 502, true);
    onProgress(100);
    return value;
  } catch (error) {
    if (timedOut) throw new ApiError('The upload timed out. Try a smaller file or a stronger connection. Your edits are still here.', 408, sendingFile);
    if (error instanceof ApiError) throw error;
    throw new ApiError('The upload was interrupted. Check your connection, then choose the file again. Your edits are still here.', 0, sendingFile);
  } finally { clearTimeout(timer); }
}

export async function uploadMedia(file: File, onProgress: (percentage: number) => void): Promise<{ url: string }> {
  if (offline()) throw new ApiError('You’re offline. Reconnect before uploading. Your edits are still here.', 0);
  onProgress(0);
  const settings = await request<{ mode?: unknown }>('/api/admin/upload');
  if (settings?.mode === 'blob') return uploadBlobMedia(file, onProgress);
  if (settings?.mode === 'local') return uploadLocalMedia(file, onProgress);
  throw new ApiError('The upload configuration could not be read. Reload the studio and try again.', 502);
}
