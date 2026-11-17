import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const workspace = path.resolve(import.meta.dirname, '..');

// Compile the actual TypeScript modules using the project's compiler. Stub only
// Next's server boundary and cookie API; validation, crypto, and filesystem code run unchanged.
function loadBackend(environment = {}, overrides = {}) {
  const cache = new Map();
  function load(filename) {
    const resolved = path.resolve(workspace, 'src/lib', filename);
    if (cache.has(resolved)) return cache.get(resolved);
    const exports = {};
    cache.set(resolved, exports);
    const code = ts.transpileModule(readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const localRequire = id => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id === 'server-only') return {};
      if (id === 'next/headers') return { cookies: async () => ({ get: () => undefined }) };
      if (id.startsWith('.')) return load(path.relative(path.join(workspace, 'src/lib'), path.resolve(path.dirname(resolved), `${id}.ts`)));
      return require(id);
    };
    vm.runInNewContext(code, { exports, require: localRequire, Buffer, URL, structuredClone, setTimeout, console, process: { env: environment, cwd: () => workspace, pid: process.pid, kill: process.kill.bind(process) } }, { filename: resolved });
    return exports;
  }
  return load;
}

async function withUploadStore(run) {
  const testRoot = path.join(workspace, '.data');
  await fs.mkdir(testRoot, { recursive: true });
  const directory = await fs.mkdtemp(path.join(testRoot, 'backend-test-'));
  assert.ok(path.resolve(directory).startsWith(`${path.resolve(testRoot)}${path.sep}`));
  try {
    const store = loadBackend({ VIVID_DATA_DIR: directory })('content.ts');
    await fs.mkdir(store.mediaDirectory());
    const image = `/api/media/${randomUUID()}.png`;
    const video = `/api/media/${randomUUID()}.mp4`;
    await fs.writeFile(path.join(store.mediaDirectory(), path.basename(image)), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    await fs.writeFile(path.join(store.mediaDirectory(), path.basename(video)), Buffer.from([0, 0, 0, 12, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]));
    await run({ store, directory, image, video });
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}

test('content validation rejects unsafe URLs, duplicate IDs, dangling creator links, and nonboolean flags', () => {
  const load = loadBackend();
  const { initialContent } = load('content-seed.ts');
  const { validateContent } = load('content-validation.ts');
  const content = () => structuredClone(initialContent);
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', '//example.com/image.png', '/images/../secret', 'http://example.com/video.mp4']) {
    const bad = content(); bad.reels[0].video = url;
    assert.throws(() => validateContent(bad));
  }
  const duplicate = content(); duplicate.reels.push(duplicate.reels[0]);
  assert.throws(() => validateContent(duplicate));
  const dangling = content(); dangling.reels[0].creatorId = 'unknown';
  assert.throws(() => validateContent(dangling));
  const danglingBrand = content(); danglingBrand.reels[0].brandId = 'unknown';
  assert.throws(() => validateContent(danglingBrand));
  const duplicateBrand = content(); duplicateBrand.brands.push(duplicateBrand.brands[0]);
  assert.throws(() => validateContent(duplicateBrand));
  const unsafeWebsite = content(); unsafeWebsite.brands[0].websiteUrl = 'http://example.com';
  assert.throws(() => validateContent(unsafeWebsite));
  const brandFlag = content(); brandFlag.brands[0].published = 'false';
  assert.throws(() => validateContent(brandFlag));
  const flag = content(); flag.creators[0].published = 'false';
  assert.throws(() => validateContent(flag));
  const renamed = content(); renamed.creators.find(item => item.id === 'anaya').name = 'Updated creator';
  assert.equal(validateContent(renamed).reels[0].creator, 'Updated creator');
  renamed.brands.find(item => item.id === 'nykaa').name = 'Updated brand';
  assert.equal(validateContent(renamed).reels[0].brand, 'Updated brand');
});

test('drafts stay out of public content, including links to unpublished creator names', () => {
  const load = loadBackend();
  const { initialContent } = load('content-seed.ts');
  const { publicContent } = load('content.ts');
  const content = structuredClone(initialContent);
  content.creators.find(item => item.id === 'anaya').published = false;
  content.brands.find(item => item.id === 'nykaa').published = false;
  content.reels[1].published = false;
  const visible = publicContent(content);
  assert.equal(visible.creators.length, 3);
  assert.equal(visible.reels.length, 4);
  assert.equal(visible.reels[0].creatorId, '');
  assert.equal(visible.reels[0].creator, '');
  assert.equal(visible.brands.length, 5);
  assert.equal(visible.reels[0].brandId, '');
  assert.equal(visible.reels[0].brand, '');
});

test('persistent saves survive fresh module instances and serialize revision conflicts', async () => {
  const testRoot = path.join(workspace, '.data');
  await fs.mkdir(testRoot, { recursive: true });
  const directory = await fs.mkdtemp(path.join(testRoot, 'backend-test-'));
  assert.ok(path.resolve(directory).startsWith(`${path.resolve(testRoot)}${path.sep}`));
  try {
    const env = { VIVID_DATA_DIR: directory };
    const store = loadBackend(env)('content.ts');
    const first = await store.readContent();
    first.reels[0].title = 'A saved campaign';
    const saved = await store.saveContent(first);
    assert.notEqual(saved.revision, first.revision);
    const restarted = loadBackend(env)('content.ts');
    assert.equal((await restarted.readContent()).reels[0].title, 'A saved campaign');
    await assert.rejects(() => restarted.saveContent(first), error => error.status === 409);
    const one = structuredClone(saved); one.reels[0].title = 'Editor one';
    const two = structuredClone(saved); two.reels[0].title = 'Editor two';
    const results = await Promise.allSettled([store.saveContent(one), restarted.saveContent(two)]);
    assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(results.filter(item => item.status === 'rejected' && item.reason.status === 409).length, 1);
    await fs.writeFile(path.join(directory, 'content.json'), '{invalid json');
    await assert.rejects(() => store.readContent());
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('explicit local storage reads and saves existing records without contacting connected Blob', async () => {
  await withUploadStore(async ({ store, directory, image }) => {
    const existing = await store.readContent();
    existing.reels[0].title = 'Saved before Blob was connected';
    await store.saveContent(existing);

    const blobCalls = [];
    const blob = { ...require('@vercel/blob') };
    for (const method of ['get', 'put', 'head']) blob[method] = async () => {
      blobCalls.push(method);
      throw new Error('Local storage must not contact Blob.');
    };
    const environment = {
      VIVID_STORAGE_MODE: 'local', VIVID_DATA_DIR: directory,
      BLOB_STORE_ID: 'store_development', VERCEL_OIDC_TOKEN: 'expired-development-token',
      BLOB_READ_WRITE_TOKEN: 'stale-server-token',
    };
    const overrides = { '@vercel/blob': blob };
    const local = loadBackend(environment, overrides)('content.ts');
    const content = await local.readContent();
    assert.equal(content.reels[0].title, 'Saved before Blob was connected');
    content.reels[0].title = 'Updated in local storage';
    content.reels[0].image = image;
    const saved = await local.saveContent(content);
    const restarted = loadBackend(environment, overrides)('content.ts');
    assert.deepEqual(structuredClone(await restarted.readContent()), structuredClone(saved));
    const persisted = JSON.parse(await fs.readFile(path.join(directory, 'content.json'), 'utf8'));
    assert.equal(persisted.reels[0].title, 'Updated in local storage');
    assert.equal(persisted.reels[0].image, image);
    assert.deepEqual(blobCalls, []);
  });
});

test('new records and media replacements accept existing uploads while profile links and empty drafts remain supported', async () => {
  await withUploadStore(async ({ store, image, video }) => {
    const next = await store.readContent();
    next.creators[0].image = image;
    next.creators[0].profileUrl = 'https://www.instagram.com/updatedcreator/';
    next.brands[0].logo = image;
    next.brands[0].websiteUrl = 'https://www.example.com/brand/';
    next.brands.push({ ...next.brands[0], id: 'uploaded-brand', name: 'Uploaded brand' });
    next.brands.push({ ...next.brands[0], id: 'draft-brand', logo: '', published: false });
    next.reels[0].image = image;
    next.reels[0].video = video;
    next.reels[0].brandId = 'uploaded-brand';
    next.creators.push({ ...next.creators[0], id: 'uploaded-creator' });
    next.reels.push({ ...next.reels[0], id: 'uploaded-reel', creatorId: 'uploaded-creator' });
    next.creators.push({ ...next.creators[0], id: 'draft-creator', image: '', published: false });
    next.reels.push({ ...next.reels[0], id: 'draft-reel', image: '', video: '', published: false });
    const saved = await store.saveContent(next);
    assert.equal(saved.creators[0].image, image);
    assert.equal(saved.creators[0].profileUrl, 'https://www.instagram.com/updatedcreator/');
    assert.equal(saved.reels[0].video, video);
    assert.equal(saved.reels[0].brand, 'Uploaded brand');
    assert.equal(saved.brands[0].websiteUrl, 'https://www.example.com/brand/');
    assert.equal(saved.brands.find(item => item.id === 'draft-brand').logo, '');
    assert.equal(saved.creators.find(item => item.id === 'draft-creator').image, '');
    assert.equal(saved.reels.find(item => item.id === 'draft-reel').video, '');
    assert.deepEqual(structuredClone(await store.readContent()), structuredClone(saved));
    const missingLogo = structuredClone(saved); missingLogo.brands.find(item => item.id === 'draft-brand').published = true;
    await assert.rejects(() => store.saveContent(missingLogo), error => error.status === 400 && /logo is required/.test(error.message));
    const clearedLogo = structuredClone(saved); clearedLogo.brands[0].logo = '';
    await assert.rejects(() => store.saveContent(clearedLogo), error => error.status === 400 && /logo is required/.test(error.message));
    const newBrand = structuredClone(saved); newBrand.brands.push({ ...saved.brands[0], id: 'new-brand-without-logo', logo: '' });
    await assert.rejects(() => store.saveContent(newBrand), error => error.status === 400 && /logo is required/.test(error.message));
  });
});

test('unchanged legacy media survives edits and ordering without permitting it on new records', async () => {
  await withUploadStore(async ({ store, directory }) => {
    const legacy = await store.readContent();
    legacy.creators[0].image = 'https://legacy.example/creator.jpg';
    legacy.reels[0].image = 'https://legacy.example/cover.jpg';
    legacy.reels[0].video = 'https://legacy.example/reel.mp4';
    legacy.brands[0].logo = 'https://legacy.example/brand.png';
    await fs.writeFile(path.join(directory, 'content.json'), JSON.stringify(legacy));
    const next = await store.readContent();
    next.creators[0].bio = 'An updated biography.';
    next.reels[0].title = 'An updated reel.';
    next.brands[0].description = 'Updated brand details.';
    next.creators.reverse(); next.reels.reverse();
    const saved = await store.saveContent(next);
    const existing = saved.reels.find(item => item.id === legacy.reels[0].id);
    assert.equal(existing.image, legacy.reels[0].image);
    assert.equal(existing.video, legacy.reels[0].video);
    assert.equal(saved.creators.find(item => item.id === legacy.creators[0].id).image, legacy.creators[0].image);
    assert.equal(saved.brands[0].logo, legacy.brands[0].logo);
    assert.equal(saved.reels.find(item => item.id === legacy.reels[1].id).image, legacy.reels[1].image);
    const copied = structuredClone(saved);
    copied.reels.push({ ...existing, id: 'copied-legacy-reel' });
    await assert.rejects(() => store.saveContent(copied), error => error.status === 400 && /uploaded/.test(error.message));
  });
});

test('saving rejects new or changed media links, wrong upload types, missing files, and directory references without changing stored content', async () => {
  await withUploadStore(async ({ store, image, video }) => {
    const current = await store.saveContent(await store.readContent());
    const directoryImage = `/api/media/${randomUUID()}.png`;
    await fs.mkdir(path.join(store.mediaDirectory(), path.basename(directoryImage)));
    const fields = [
      { collection: 'creators', field: 'image', wrongKind: video, local: '/images/new-not-uploaded.jpg', missing: `/api/media/${randomUUID()}.png` },
      { collection: 'reels', field: 'image', wrongKind: video, local: '/images/new-not-uploaded.jpg', missing: `/api/media/${randomUUID()}.png` },
      { collection: 'reels', field: 'video', wrongKind: image, local: '/videos/new-not-uploaded.mp4', missing: `/api/media/${randomUUID()}.mp4` },
      { collection: 'brands', field: 'logo', wrongKind: video, local: '/images/new-not-uploaded.jpg', missing: `/api/media/${randomUUID()}.png` },
    ];
    for (const { collection, field, wrongKind, local, missing } of fields) {
      for (const value of ['https://cdn.example/media', 'https://drive.google.com/file/d/example/view', local, wrongKind, missing, directoryImage]) {
        for (const isNew of [false, true]) {
          const next = structuredClone(current);
          const record = isNew ? { ...next[collection][0], id: `new-${collection}-${field}` } : next[collection][0];
          record[field] = value;
          if (isNew) next[collection].push(record);
          await assert.rejects(() => store.saveContent(next), error => error.status === 400);
          assert.equal((await store.readContent()).revision, current.revision);
        }
      }
    }
    const stale = structuredClone(current); stale.revision = 'stale-revision'; stale.reels[0].video = 'https://cdn.example/new.mp4';
    await assert.rejects(() => store.saveContent(stale), error => error.status === 409);
  });
});

test('old persisted stores gain seeded brands and matching reel relationships without changing their revision', async () => {
  await withUploadStore(async ({ store, directory }) => {
    const legacy = await store.readContent();
    delete legacy.brands;
    legacy.reels.forEach(item => { delete item.brandId; });
    legacy.reels[0].brand = ' nYkAa ';
    await fs.writeFile(path.join(directory, 'content.json'), JSON.stringify(legacy));
    const migrated = await store.readContent();
    assert.equal(migrated.revision, legacy.revision);
    assert.equal(migrated.brands.length, 6);
    assert.equal(migrated.reels[0].brandId, 'nykaa');
    assert.equal(migrated.reels[0].brand, 'Nykaa');
    migrated.brands[0].description = 'Existing wordmark remains editable.';
    const saved = await store.saveContent(migrated);
    assert.equal(saved.brands[0].logo, '');
    assert.equal(saved.brands[0].description, 'Existing wordmark remains editable.');
  });
});

test('signed sessions reject tampering and changing credentials, and require configured secrets', () => {
  const credentials = { VIVID_ADMIN_PASSWORD: 'backend-test-admin-password', VIVID_SESSION_SECRET: 'backend-test-session-secret-at-least-32-chars' };
  const auth = loadBackend(credentials)('admin-auth.ts');
  assert.equal(auth.verifyPassword(credentials.VIVID_ADMIN_PASSWORD), true);
  assert.equal(auth.verifyPassword('incorrect-password'), false);
  const session = auth.createSession();
  assert.equal(auth.verifySession(session), true);
  assert.equal(auth.verifySession(`${session}x`), false);
  assert.equal(auth.verifySession('abc.a'), false);
  assert.equal(auth.verifySession('x'.repeat(2048)), false);
  const changed = loadBackend({ ...credentials, VIVID_ADMIN_PASSWORD: 'changed-admin-password' })('admin-auth.ts');
  assert.equal(changed.verifySession(session), false);
  assert.equal(loadBackend()('admin-auth.ts').adminConfigured(), false);
});

test('storage recovers dead or old malformed locks while protecting a live writer', async () => {
  const testRoot = path.join(workspace, '.data');
  await fs.mkdir(testRoot, { recursive: true });
  const directory = await fs.mkdtemp(path.join(testRoot, 'backend-test-'));
  assert.ok(path.resolve(directory).startsWith(`${path.resolve(testRoot)}${path.sep}`));
  try {
    const store = loadBackend({ VIVID_DATA_DIR: directory })('content.ts');
    const lock = path.join(directory, 'content.lock');
    let content = await store.readContent();
    await fs.writeFile(lock, JSON.stringify({ pid: 999999999, created: Date.now(), token: 'dead-writer' }));
    content = await store.saveContent(content);
    await assert.rejects(() => fs.stat(lock), error => error.code === 'ENOENT');
    await fs.writeFile(lock, 'invalid-lock');
    const old = new Date(Date.now() - 120_000);
    await fs.utimes(lock, old, old);
    content = await store.saveContent(content);
    await fs.writeFile(lock, JSON.stringify({ pid: process.pid, created: Date.now() - 120_000, token: 'live-writer' }));
    await assert.rejects(() => store.saveContent(content), error => error.status === 503);
    assert.equal(JSON.parse(await fs.readFile(lock, 'utf8')).token, 'live-writer');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('stale lock recovery preserves a replacement even when filesystem identity and timestamps match', async () => {
  const testRoot = path.join(workspace, '.data');
  await fs.mkdir(testRoot, { recursive: true });
  const directory = await fs.mkdtemp(path.join(testRoot, 'backend-test-'));
  assert.ok(path.resolve(directory).startsWith(`${path.resolve(testRoot)}${path.sep}`));
  try {
    const lock = path.join(directory, 'content.lock');
    const created = Date.now();
    const old = JSON.stringify({ pid: 999999999, created, token: 'old-owner' });
    const replacement = JSON.stringify({ pid: process.pid, created, token: 'new-owner' }).padEnd(old.length, ' ');
    await fs.writeFile(lock, old);
    const timestamp = new Date(created - 1000);
    await fs.utimes(lock, timestamp, timestamp);
    let replaced = false;
    const wrappedFs = { ...fs, stat: async filename => {
      const info = await fs.stat(filename);
      if (filename === lock && !replaced) {
        replaced = true;
        await fs.writeFile(lock, replacement);
        await fs.utimes(lock, timestamp, timestamp);
      }
      return info;
    } };
    const store = loadBackend({ VIVID_DATA_DIR: directory }, { 'node:fs/promises': wrappedFs })('content.ts');
    await assert.rejects(async () => store.saveContent(await store.readContent()), error => error.status === 503);
    assert.equal(await fs.readFile(lock, 'utf8'), replacement);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('origin checks reject missing and foreign origins and support configured deployment origins', () => {
  const api = loadBackend()('api.ts');
  assert.doesNotThrow(() => api.requireSameOrigin(new Request('https://vivid.test/api/admin/content', { headers: { origin: 'https://vivid.test' } })));
  assert.throws(() => api.requireSameOrigin(new Request('https://vivid.test/api/admin/content')));
  assert.throws(() => api.requireSameOrigin(new Request('https://vivid.test/api/admin/content', { headers: { origin: 'https://foreign.test' } })));
  const normalizedUrl = 'http://localhost:3100/api/admin/content';
  assert.doesNotThrow(() => api.requireSameOrigin(new Request(normalizedUrl, { headers: { host: '127.0.0.1:3100', origin: 'http://127.0.0.1:3100' } })));
  assert.throws(() => api.requireSameOrigin(new Request(normalizedUrl, { headers: { host: '127.0.0.1:3100', origin: 'http://localhost:3100' } })));
  assert.throws(() => api.requireSameOrigin(new Request(normalizedUrl, { headers: { host: '127.0.0.1:3100', 'x-forwarded-host': 'foreign.test', origin: 'http://foreign.test' } })));
  assert.throws(() => api.requireSameOrigin(new Request(normalizedUrl, { headers: { host: '127.0.0.1:3100@foreign.test', origin: 'http://foreign.test' } })));
  const deployed = loadBackend({ VIVID_SITE_ORIGIN: 'https://vivid.test' })('api.ts');
  assert.doesNotThrow(() => deployed.requireSameOrigin(new Request('http://internal:3000/api/admin/content', { headers: { origin: 'https://vivid.test' } })));
});

test('media signatures and byte ranges validate mismatches and unsatisfiable requests', () => {
  const { mediaExtension, byteRange } = loadBackend()('media.ts');
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(mediaExtension(png, 'image/png'), 'png');
  assert.throws(() => mediaExtension(png, 'image/jpeg'));
  assert.throws(() => mediaExtension(Buffer.from('<svg/>'), 'image/svg+xml'));
  for (const [header, start, end] of [['bytes=0-9', 0, 9], ['bytes=90-', 90, 99], ['bytes=-10', 90, 99], ['bytes=0-1000', 0, 99]]) {
    const range = byteRange(header, 100); assert.equal(range.start, start); assert.equal(range.end, end);
  }
  for (const header of ['bytes=100-', 'bytes=10-2', 'bytes=-0', 'bytes=-', 'bytes=0-2,4-6', 'bytes=9999999999999999999-']) assert.equal(byteRange(header, 100), null);
});
