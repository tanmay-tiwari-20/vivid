import 'server-only';
import { ContentError } from './content-validation';

export const IMAGE_LIMIT = 10 * 1024 * 1024;
export const VIDEO_LIMIT = 100 * 1024 * 1024;
export const MEDIA_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm',
};

export function mediaExtension(bytes: Buffer, mime: string): string {
  const starts = (signature: number[]) => bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  let extension = '';
  if (starts([0xff, 0xd8, 0xff])) extension = 'jpg';
  else if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) extension = 'png';
  else if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') extension = 'webp';
  else if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString())) extension = 'gif';
  else if (bytes.length >= 12 && bytes.subarray(4, 8).toString() === 'ftyp') extension = 'mp4';
  else if (starts([0x1a, 0x45, 0xdf, 0xa3])) extension = 'webm';
  if (!extension || MEDIA_TYPES[extension] !== mime) throw new ContentError('Choose a valid JPG, PNG, WebP, GIF, MP4, or WebM file. The file contents must match its type.');
  const limit = extension === 'mp4' || extension === 'webm' ? VIDEO_LIMIT : IMAGE_LIMIT;
  if (bytes.length > limit) throw new ContentError(`Choose a file smaller than ${limit === IMAGE_LIMIT ? '10' : '100'} MB.`, 413);
  return extension;
}

export function byteRange(value: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;
  if (!match[1]) {
    const length = Number(match[2]);
    if (!Number.isSafeInteger(length) || length <= 0) return null;
    return { start: Math.max(0, size - length), end: size - 1 };
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || start >= size || requestedEnd < start) return null;
  return { start, end: Math.min(requestedEnd, size - 1) };
}
