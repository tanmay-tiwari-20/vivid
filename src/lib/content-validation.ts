import type { Brand, Creator, Reel, SiteContent } from './content-types';
import { initialBrands } from './content-seed';
import { getInstagramReel } from './instagram';

export class ContentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ContentError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 200, required = false): string {
  if (typeof value !== 'string') throw new ContentError(`${label} must be text.`);
  const result = value.trim();
  if (result.length > max || (required && !result)) throw new ContentError(`${label} ${required && !result ? 'is required' : `must be ${max} characters or fewer`}.`);
  return result;
}

function flag(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new ContentError(`${label} must be true or false.`);
  return value;
}

function id(value: unknown, label: string): string {
  const result = text(value, label, 100, true);
  if (!/^[a-zA-Z0-9_-]+$/.test(result)) throw new ContentError(`${label} contains invalid characters.`);
  return result;
}

export function safeMediaUrl(value: unknown, label: string, required = false): string {
  const result = text(value, label, 2048, required);
  if (!result) return result;
  if (result.startsWith('/')) {
    if (!/^\/(?:images|videos|api\/media)\/[a-zA-Z0-9_./-]+$/.test(result) || result.includes('..')) throw new ContentError(`${label} must be a media upload, a local image/video path, or an HTTPS URL.`);
    return result;
  }
  try {
    const url = new URL(result);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new ContentError(`${label} must use an HTTPS URL.`); }
}

function profileUrl(value: unknown, label: string, kind = 'profile'): string {
  const result = text(value, label, 2048);
  if (!result) return result;
  try {
    const url = new URL(result);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new ContentError(`${label} must be a full HTTPS ${kind} URL.`); }
}

export function validateContent(value: unknown): SiteContent {
  const input = record(value, 'Content');
  const revision = text(input.revision, 'Revision', 100, true);
  if (!Array.isArray(input.reels) || !Array.isArray(input.creators)) throw new ContentError('Reels and creators must be lists.');
  // Stores written before brands were editable receive the default brand lineup.
  const brandInput = input.brands === undefined ? structuredClone(initialBrands) : input.brands;
  if (!Array.isArray(brandInput)) throw new ContentError('Brands must be a list.');
  if (input.reels.length > 500 || input.creators.length > 500 || brandInput.length > 500) throw new ContentError('You can save up to 500 reels, 500 creators, and 500 brands.');
  const brands: Brand[] = brandInput.map((value, index) => {
    const item = record(value, `Brand ${index + 1}`);
    const label = `Brand ${index + 1}`;
    return {
      id: id(item.id, `${label} ID`), name: text(item.name, `${label} name`, 120, true),
      category: text(item.category, `${label} category`, 100), description: text(item.description, `${label} description`, 3000),
      logo: safeMediaUrl(item.logo, `${label} logo`), websiteUrl: profileUrl(item.websiteUrl, `${label} website`, 'website'),
      published: flag(item.published, `${label} published`), demo: flag(item.demo, `${label} demo`),
    };
  });
  const brandIds = new Set(brands.map(item => item.id));
  if (brandIds.size !== brands.length) throw new ContentError('Brand IDs must be unique.');
  const creators: Creator[] = input.creators.map((value, index) => {
    const item = record(value, `Creator ${index + 1}`);
    const label = `Creator ${index + 1}`;
    const published = flag(item.published, `${label} published`);
    return {
      id: id(item.id, `${label} ID`), name: text(item.name, `${label} name`, 120, true),
      category: text(item.category, `${label} category`, 100), specialty: text(item.specialty, `${label} specialty`),
      bio: text(item.bio, `${label} bio`, 3000), image: safeMediaUrl(item.image, `${label} image`, published),
      profileUrl: profileUrl(item.profileUrl, `${label} profile`), handle: text(item.handle, `${label} handle`, 100),
      followers: text(item.followers, `${label} followers`, 30), featured: flag(item.featured, `${label} featured`),
      published, demo: flag(item.demo, `${label} demo`),
    };
  });
  const creatorIds = new Set(creators.map(item => item.id));
  if (creatorIds.size !== creators.length) throw new ContentError('Creator IDs must be unique.');
  const reels: Reel[] = input.reels.map((value, index) => {
    const item = record(value, `Reel ${index + 1}`);
    const label = `Reel ${index + 1}`;
    const published = flag(item.published, `${label} published`);
    const creatorId = text(item.creatorId, `${label} creator ID`, 100);
    if (creatorId && !creatorIds.has(creatorId)) throw new ContentError(`${label} references a deleted creator. Choose another creator or remove the link.`);
    const brandId = item.brandId === undefined
      ? brands.find(brand => brand.name.trim().toLowerCase() === (typeof item.brand === 'string' ? item.brand.trim().toLowerCase() : ''))?.id || ''
      : text(item.brandId, `${label} brand ID`, 100);
    if (brandId && !brandIds.has(brandId)) throw new ContentError(`${label} references a deleted brand. Choose another brand or remove the link.`);
    const color = text(item.color, `${label} color`, 7, true);
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new ContentError(`${label} color must be a six-digit hex color.`);
    const video = safeMediaUrl(item.video, `${label} video`, published);
    return {
      id: id(item.id, `${label} ID`), title: text(item.title, `${label} title`, 200, true),
      brand: brandId ? brands.find(brand => brand.id === brandId)!.name : text(item.brand, `${label} brand`, 120), brandId, creatorId,
      creator: creatorId ? creators.find(creator => creator.id === creatorId)!.name : text(item.creator, `${label} creator`, 120),
      category: text(item.category, `${label} category`, 100), description: text(item.description, `${label} description`, 5000),
      image: safeMediaUrl(item.image, `${label} cover image`, published), video: getInstagramReel(video)?.url ?? video,
      views: text(item.views, `${label} views`, 30), reach: text(item.reach, `${label} reach`, 30), color,
      featured: flag(item.featured, `${label} featured`), published, demo: flag(item.demo, `${label} demo`),
    };
  });
  if (new Set(reels.map(item => item.id)).size !== reels.length) throw new ContentError('Reel IDs must be unique.');
  return { revision, reels, creators, brands };
}
