import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const workspace = path.resolve(import.meta.dirname, '..');
const credentials = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-api-key', CLOUDINARY_API_SECRET: 'test-server-only-secret' };
const snapshotId = sequence => `vivid/content/${String(sequence).padStart(12, '0')}.json`;
const image = `https://res.cloudinary.com/test-cloud/image/upload/v123/vivid/media/${randomUUID()}.png`;
const video = `https://res.cloudinary.com/test-cloud/video/upload/v123/vivid/media/${randomUUID()}.mp4`;

// Run real configuration, validation, persistence, and snapshot discovery.
// Only Cloudinary transport and media inspection are controlled here.
function harness({ environment = { VERCEL: '1', ...credentials }, uploadError, mediaError, omitExistingFlag = false } = {}) {
  const resources = new Map();
  const calls = { get: [], upload: [], disk: [], media: [], downloads: [] };
  let config = {};
  const sdk = {
    config: options => { if (options) config = { ...config, ...options }; return config; },
    utils: { private_download_url: (publicId, format, options) => {
      calls.downloads.push({ publicId, format, options });
      return `https://api.cloudinary.com/v1_1/${config.cloud_name}/raw/download?public_id=${encodeURIComponent(publicId)}&format=${format}&signature=signed`;
    } },
    uploader: { upload_stream: (options, callback) => {
      const stream = new EventEmitter();
      stream.end = bytes => {
        calls.upload.push({ options, bytes });
        if (uploadError) { callback(uploadError); return; }
        const existing = resources.has(options.public_id);
        if (!existing) resources.set(options.public_id, Buffer.from(bytes));
        callback(null, {
          public_id: options.public_id, resource_type: options.resource_type, type: options.type,
          ...(!omitExistingFlag && existing ? { existing: true } : {}),
        });
      };
      return stream;
    } },
  };
  let fetchImpl = async (url, options) => {
    const id = new URL(url).searchParams.get('public_id');
    calls.get.push({ id, options });
    const bytes = resources.get(id);
    return bytes ? new Response(bytes, { headers: { 'Content-Type': 'application/json' } }) : new Response('Not found', { status: 404 });
  };
  function worker() {
    const cache = new Map();
    function load(filename) {
      const resolved = path.resolve(workspace, 'src/lib', filename);
      if (cache.has(resolved)) return cache.get(resolved);
      const exports = {};
      cache.set(resolved, exports);
      const code = ts.transpileModule(readFileSync(resolved, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      }).outputText;
      const localRequire = id => {
        if (id === 'server-only') return {};
        if (id === 'cloudinary') return { v2: sdk };
        if (id === 'node:fs/promises') return new Proxy({}, { get: (_, name) => async () => { calls.disk.push(name); throw new Error(`Unexpected disk operation: ${String(name)}`); } });
        if (id === './cloudinary-media') return { validateCloudinaryMedia: async (url, kind) => {
          const { ContentError } = load('content-validation.ts');
          const media = new URL(url, 'https://local.example');
          if (media.hostname !== 'res.cloudinary.com' || !media.pathname.startsWith(`/test-cloud/${kind}/upload/`)) throw new ContentError(`Choose an uploaded ${kind}.`);
          calls.media.push({ url, kind });
          if (mediaError) throw mediaError;
        } };
        if (id.startsWith('.')) return load(path.relative(path.join(workspace, 'src/lib'), path.resolve(path.dirname(resolved), `${id}.ts`)));
        return require(id);
      };
      vm.runInNewContext(code, {
        exports, require: localRequire, Buffer, URL, Response, AbortSignal, ReadableStream, structuredClone, setTimeout, console,
        fetch: (url, options) => fetchImpl(url, options),
        process: { env: environment, cwd: () => workspace, pid: process.pid, kill: process.kill.bind(process) },
      }, { filename: resolved });
      return exports;
    }
    return { store: load('content.ts'), snapshots: load('cloudinary-content.ts'), config: load('cloudinary.ts'), initial: load('content-seed.ts').initialContent };
  }
  return { ...worker(), worker, calls, resources, sdk, setFetch: value => { fetchImpl = value; }, insert: (sequence, content) => resources.set(snapshotId(sequence), Buffer.from(JSON.stringify(content))) };
}

test('Vercel without Cloudinary renders seed and blocks writes without ephemeral disk', async () => {
  const h = harness({ environment: { VERCEL: '1' } });
  assert.equal(h.config.cloudinaryStorageEnabled(), false);
  assert.throws(() => h.config.requireStorageConfiguration(), error => error.status === 503 && /CLOUDINARY_CLOUD_NAME.*redeploy/.test(error.message));
  const first = await h.store.readContent();
  first.creators[0].name = 'In memory only';
  assert.notEqual((await h.store.readContent()).creators[0].name, first.creators[0].name);
  await assert.rejects(h.store.saveContent(h.initial), error => error.status === 503);
  assert.deepEqual(h.calls.disk, []);
  assert.deepEqual(h.calls.get, []);
  assert.deepEqual(h.calls.upload, []);
  assert.doesNotThrow(() => harness({ environment: {} }).config.requireStorageConfiguration());
});

test('local override is honored only outside Vercel and partial credentials fail clearly', () => {
  const local = harness({ environment: { VIVID_STORAGE_MODE: 'local', CLOUDINARY_API_SECRET: 'stale-secret' } });
  assert.equal(local.config.cloudinaryStorageEnabled(), false);
  assert.doesNotThrow(() => local.config.requireStorageConfiguration());
  const deployed = harness({ environment: { VERCEL: '1', VIVID_STORAGE_MODE: 'local', ...credentials } });
  assert.equal(deployed.config.cloudinaryStorageEnabled(), true);
  assert.doesNotThrow(() => deployed.config.requireStorageConfiguration());
  const partial = harness({ environment: { CLOUDINARY_CLOUD_NAME: 'test-cloud' } });
  assert.equal(partial.config.cloudinaryStorageEnabled(), true);
  assert.throws(() => partial.config.requireStorageConfiguration(), error => error.status === 503);
});

test('Cloudinary URL credentials stay server-only and invalid URLs or folders are rejected', () => {
  const h = harness({ environment: { CLOUDINARY_URL: 'cloudinary://key:secret%3Avalue@test-cloud', VIVID_CLOUDINARY_FOLDER: 'vivid/preview' } });
  assert.equal(h.config.cloudinaryStorageEnabled(), true);
  assert.equal(h.config.cloudinaryClient().config().api_secret, 'secret:value');
  assert.equal(h.config.cloudinaryFolder(), 'vivid/preview');
  for (const url of ['https://key:secret@test-cloud', 'cloudinary://key@test-cloud', 'cloudinary://key:secret@test-cloud/other']) {
    assert.throws(() => harness({ environment: { CLOUDINARY_URL: url } }).config.requireStorageConfiguration(), error => error.status === 503);
  }
  for (const folder of ['../vivid', '/vivid', 'vivid/', 'vivid//preview', 'v123', 'vivid?other']) {
    assert.throws(() => harness({ environment: { ...credentials, VIVID_CLOUDINARY_FOLDER: folder } }).config.requireStorageConfiguration(), error => error.status === 503);
  }
});

test('private raw snapshots persist across fresh workers and public content excludes drafts', async () => {
  const h = harness();
  const next = structuredClone(h.initial);
  next.reels[0].title = 'Saved in Cloudinary';
  next.reels[1].published = false;
  const saved = await h.store.saveContent(next);
  assert.notEqual(saved.revision, next.revision);
  assert.equal(h.calls.upload[0].options.resource_type, 'raw');
  assert.equal(h.calls.upload[0].options.type, 'authenticated');
  assert.equal(h.calls.upload[0].options.public_id, snapshotId(1));
  assert.equal(h.calls.upload[0].options.overwrite, false);
  assert.equal((await h.worker().store.readContent()).reels[0].title, 'Saved in Cloudinary');
  assert.equal(h.store.publicContent(saved).reels.length, next.reels.length - 1);
  assert.ok(h.calls.get.every(call => call.options.cache === 'no-store' && call.options.redirect === 'error'));
  assert.ok(h.calls.downloads.every(call => call.options.resource_type === 'raw' && call.options.type === 'authenticated' && call.options.expires_at > Date.now() / 1000));
  assert.deepEqual(h.calls.disk, []);
});

test('same-revision seed saves across separate workers have exactly one winner', async () => {
  const h = harness();
  const first = structuredClone(h.initial);
  const second = structuredClone(h.initial);
  first.creators[0].bio = 'First writer';
  second.creators[0].bio = 'Second writer';
  const results = await Promise.allSettled([h.store.saveContent(first), h.worker().store.saveContent(second)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  assert.equal(h.resources.size, 1);
  assert.ok(h.calls.upload.every(call => call.options.overwrite === false && call.options.public_id === snapshotId(1)));
  assert.equal((await h.worker().store.readContent()).revision, results.find(result => result.status === 'fulfilled').value.revision);
});

test('existing snapshot saves conflict across workers and missing existing flags cannot hide a losing save', async () => {
  for (const omitExistingFlag of [false, true]) {
    const h = harness({ omitExistingFlag });
    const current = await h.store.saveContent(h.initial);
    const first = structuredClone(current);
    const second = structuredClone(current);
    first.reels[0].title = 'First revision';
    second.reels[0].title = 'Second revision';
    const results = await Promise.allSettled([h.store.saveContent(first), h.worker().store.saveContent(second)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
    assert.equal(h.resources.size, 2);
    await assert.rejects(h.store.saveContent(current), error => error.status === 409);
    assert.equal((await h.worker().store.readContent()).revision, results.find(result => result.status === 'fulfilled').value.revision);
  }
});

test('latest discovery uses logarithmic exact probes and a warm worker notices another writer', async () => {
  const h = harness();
  for (let sequence = 1; sequence <= 1000; sequence++) h.insert(sequence, { ...h.initial, revision: `revision-${sequence}` });
  assert.equal((await h.store.readContent()).revision, 'revision-1000');
  assert.ok(h.calls.get.length < 24, `expected logarithmic lookups, got ${h.calls.get.length}`);
  h.calls.get.length = 0;
  assert.equal((await h.store.readContent()).revision, 'revision-1000');
  assert.equal(h.calls.get.length, 1, 'cached immutable latest content only probes the next slot');
  h.insert(1001, { ...h.initial, revision: 'new-worker-save' });
  assert.equal((await h.store.readContent()).revision, 'new-worker-save');
});

test('Cloudinary media replacements are verified while retained legacy media stays usable', async () => {
  const h = harness();
  const next = structuredClone(h.initial);
  next.creators[0].image = image;
  next.reels[0].video = video;
  const saved = await h.store.saveContent(next);
  assert.deepEqual(h.calls.media.map(item => item.kind), ['image', 'video']);
  assert.equal(saved.reels[1].video, h.initial.reels[1].video);
  const denied = harness({ mediaError: new Error('Upload unavailable') });
  await assert.rejects(denied.store.saveContent(next), /Upload unavailable/);
  assert.equal(denied.calls.upload.length, 0);
});

test('new published Instagram reels inspect only the Cloudinary cover and canonicalize links', async () => {
  const h = harness();
  const next = structuredClone(h.initial);
  next.reels.push({ ...next.reels[0], id: 'instagram-campaign', image, video: 'https://www.instagram.com/reel/ABC_def-123/?igsh=shared', demo: false });
  const saved = await h.store.saveContent(next);
  assert.equal(h.store.publicContent(saved).reels.find(item => item.id === 'instagram-campaign').video, 'https://www.instagram.com/reel/ABC_def-123/');
  assert.deepEqual(h.calls.media, [{ url: image, kind: 'image' }]);
  assert.equal((await h.worker().store.readContent()).reels.at(-1).video, 'https://www.instagram.com/reel/ABC_def-123/');
});

test('Instagram video link updates bypass media inspection but invalid links and image links cannot save', async () => {
  const h = harness();
  const next = structuredClone(h.initial);
  next.reels[0].video = 'https://m.instagram.com/reels/First_123/?igsh=share';
  const saved = await h.store.saveContent(next);
  saved.reels[0].video = 'https://instagram.com/reel/Second_123/#watch';
  assert.equal((await h.store.saveContent(saved)).reels[0].video, 'https://www.instagram.com/reel/Second_123/');
  assert.deepEqual(h.calls.media, []);
  for (const field of ['image', 'video']) {
    const denied = harness();
    const bad = structuredClone(denied.initial);
    bad.reels[0][field] = field === 'image' ? 'https://www.instagram.com/reel/ABC123/' : 'https://www.instagram.com/example-profile/';
    await assert.rejects(denied.store.saveContent(bad), error => error.status === 400);
    assert.equal(denied.calls.upload.length, 0);
  }
});

test('missing published brand logos prevent saves and unchanged sample wordmarks remain usable', async () => {
  const h = harness();
  await h.store.saveContent(h.initial);
  const current = await h.store.readContent();
  current.brands.push({ ...current.brands[0], id: 'new-brand', logo: '', demo: false });
  await assert.rejects(h.store.saveContent(current), error => error.status === 400 && /logo is required/.test(error.message));
  current.brands.at(-1).logo = image;
  assert.equal((await h.store.saveContent(current)).brands.at(-1).logo, image);
});

test('bad reads, oversized snapshots, and unrelated upload errors never report success', async () => {
  for (const status of [401, 403, 429, 500]) {
    const h = harness();
    h.setFetch(async () => new Response('Denied', { status }));
    await assert.rejects(h.store.saveContent(h.initial), error => error.status === 503);
    assert.equal(h.calls.upload.length, 0);
  }
  for (const bytes of ['{', JSON.stringify({ invalid: true }), 'x'.repeat(8 * 1024 * 1024 + 1)]) {
    const h = harness();
    h.resources.set(snapshotId(1), Buffer.from(bytes));
    await assert.rejects(h.store.readContent(), error => error.status === 503);
  }
  const failure = { http_code: 500, message: 'Storage unavailable' };
  const h = harness({ uploadError: failure });
  await assert.rejects(h.store.saveContent(h.initial), error => error.status === 503 && /could not be saved to Cloudinary/.test(error.message));
  assert.equal(h.resources.size, 0);
});
