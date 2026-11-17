import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { BlobError, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob';

const require = createRequire(import.meta.url);
const workspace = path.resolve(import.meta.dirname, '..');
const token = 'test-server-only-token';
const contentPath = 'vivid/content.json';

// Execute the real content/validation/config modules. Only the external store,
// media inspection, and filesystem are replaced; a disk access fails the test.
function harness({ environment = { VERCEL: '1', BLOB_READ_WRITE_TOKEN: token }, stored = null, mediaError, putError } = {}) {
  const calls = { get: [], put: [], head: [], disk: [], media: [] };
  let current = stored ? { content: structuredClone(stored), etag: '"etag-1"' } : null;
  let version = 1;
  const blob = {
    BlobError, BlobNotFoundError, BlobPreconditionFailedError,
    get: async (pathname, options) => {
      calls.get.push({ pathname, options });
      if (!current) return null;
      const snapshot = structuredClone(current);
      // undici decompresses response bodies, but the CDN's compressed response
      // retains its weak representation ETag. Only identity reads expose the
      // strong object ETag accepted by conditional PUT.
      const identity = new Headers(options.headers).get('accept-encoding') === 'identity';
      const etag = identity ? snapshot.etag : `W/${snapshot.etag}`;
      const headers = new Headers({ ETag: etag, 'Content-Type': 'application/json' });
      if (!identity) headers.set('Content-Encoding', 'br');
      return { statusCode: 200, stream: new Response(JSON.stringify(snapshot.content)).body, headers, blob: { etag } };
    },
    put: async (pathname, body, options) => {
      calls.put.push({ pathname, body, options });
      if (putError) throw putError;
      if (current && !options.allowOverwrite) throw new BlobError('This blob already exists. Set allowOverwrite to overwrite it.');
      if (options.ifMatch && options.ifMatch !== current?.etag) throw new BlobPreconditionFailedError();
      current = { content: JSON.parse(body), etag: `"etag-${++version}"` };
      return { pathname, etag: current.etag };
    },
  };
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
      if (id === '@vercel/blob') return blob;
      if (id === 'node:fs/promises') return new Proxy({}, { get: (_, name) => async () => { calls.disk.push(name); throw new Error(`Unexpected disk operation: ${String(name)}`); } });
      if (id === './blob-media') return { validateBlobMedia: async (filename, kind) => { calls.media.push({ filename, kind }); if (mediaError) throw mediaError; } };
      if (id.startsWith('.')) return load(path.relative(path.join(workspace, 'src/lib'), path.resolve(path.dirname(resolved), `${id}.ts`)));
      return require(id);
    };
    vm.runInNewContext(code, {
      exports, require: localRequire, Buffer, URL, Response, ReadableStream, structuredClone, setTimeout, console,
      process: { env: environment, cwd: () => workspace, pid: process.pid, kill: process.kill.bind(process) },
    }, { filename: resolved });
    return exports;
  }
  return {
    store: load('content.ts'), media: load('blob-media.ts'), config: load('blob-storage.ts'), initial: load('content-seed.ts').initialContent, calls, blob,
    stored: () => structuredClone(current),
    replace: content => { current = { content: structuredClone(content), etag: `"etag-${++version}"` }; },
  };
}

test('Vercel without a Blob store keeps public seed available and blocks studio writes without disk access', async () => {
  const h = harness({ environment: { VERCEL: '1' } });
  assert.equal(h.config.blobStorageEnabled(), false);
  assert.throws(() => h.config.requireStorageConfiguration(), error => error.status === 503 && /private Vercel Blob store.*redeploy/.test(error.message));
  const first = await h.store.readContent();
  first.creators[0].name = 'Only changed in memory';
  assert.notEqual((await h.store.readContent()).creators[0].name, first.creators[0].name);
  await assert.rejects(h.store.saveContent(h.initial), error => error.status === 503);
  assert.deepEqual(h.calls.disk, []);
  assert.deepEqual(h.calls.get, []);
  assert.deepEqual(h.calls.put, []);
  const local = harness({ environment: {} });
  assert.doesNotThrow(() => local.config.requireStorageConfiguration());
});

test('OIDC storage forwards only the store ID so the SDK can refresh authentication', async () => {
  const storeId = 'store_test-oidc';
  for (const environment of [
    { VERCEL: '1', BLOB_STORE_ID: storeId },
    { BLOB_STORE_ID: storeId, VERCEL_OIDC_TOKEN: 'test-short-lived-token' },
  ]) {
    const h = harness({ environment });
    assert.equal(h.config.blobStorageEnabled(), true);
    assert.doesNotThrow(() => h.config.requireStorageConfiguration());
    const content = await h.store.readContent();
    await h.store.saveContent(content);
    for (const call of [...h.calls.get, ...h.calls.put]) {
      assert.equal(call.options.storeId, storeId);
      assert.equal(Object.hasOwn(call.options, 'token'), false);
      assert.equal(Object.hasOwn(call.options, 'oidcToken'), false, 'explicit OIDC tokens disable SDK refresh');
      assert.equal(call.options.access, 'private');
    }
    assert.deepEqual(h.calls.disk, []);
  }
});

test('a store ID without local OIDC authentication gives recovery instructions before contacting storage', async () => {
  const h = harness({ environment: { BLOB_STORE_ID: 'store_test-oidc' } });
  assert.equal(h.config.blobStorageEnabled(), true);
  assert.throws(() => h.config.requireStorageConfiguration(), error => error.status === 503 && /vercel env pull.*vercel dev/.test(error.message));
  await assert.rejects(h.store.readContent(), error => error.status === 503);
  await assert.rejects(h.store.saveContent(h.initial), error => error.status === 503);
  assert.deepEqual(h.calls.get, []);
  assert.deepEqual(h.calls.put, []);
  assert.deepEqual(h.calls.disk, []);
});

test('explicit read-write credentials take priority when OIDC is also configured', async () => {
  const h = harness({ environment: { BLOB_READ_WRITE_TOKEN: token, BLOB_STORE_ID: 'store_test-oidc', VERCEL_OIDC_TOKEN: 'test-short-lived-token' } });
  assert.doesNotThrow(() => h.config.requireStorageConfiguration());
  const content = await h.store.readContent();
  await h.store.saveContent(content);
  for (const call of [...h.calls.get, ...h.calls.put]) {
    assert.equal(call.options.token, token);
    assert.equal(Object.hasOwn(call.options, 'storeId'), false);
    assert.equal(Object.hasOwn(call.options, 'oidcToken'), false);
  }
});

test('media inspection and delivery use store ID authentication without forwarding OIDC secrets', async () => {
  const storeId = 'store_test-oidc';
  const h = harness({ environment: { VERCEL: '1', BLOB_STORE_ID: storeId } });
  const filename = `${randomUUID()}.png`;
  const pathname = `vivid/media/${filename}`;
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  h.blob.head = async (path, options) => {
    h.calls.head.push({ pathname: path, options });
    return { pathname, contentType: 'image/png', size: bytes.length };
  };
  h.blob.get = async (path, options) => {
    h.calls.get.push({ pathname: path, options });
    return { statusCode: 200, stream: new Response(bytes).body, headers: new Headers(), blob: { etag: 'etag' } };
  };
  await h.media.validateBlobMedia(filename, 'image');
  const response = await h.media.serveBlobMedia(new Request(`https://vivid.test/api/media/${filename}`), filename);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  const head = await h.media.serveBlobMedia(new Request(`https://vivid.test/api/media/${filename}`, { method: 'HEAD' }), filename, true);
  assert.equal(head.status, 200);
  assert.equal(head.body, null);
  assert.equal(h.calls.head.length, 3);
  assert.equal(h.calls.get.length, 2);
  for (const call of [...h.calls.head, ...h.calls.get]) {
    assert.equal(call.pathname, pathname);
    assert.equal(call.options.storeId, storeId);
    assert.equal(Object.hasOwn(call.options, 'token'), false);
    assert.equal(Object.hasOwn(call.options, 'oidcToken'), false);
  }
});

test('private Blob reads bypass cached content and always use the explicit server token', async () => {
  const h = harness();
  const seed = await h.store.readContent();
  seed.creators[0].name = 'First stored creator';
  seed.creators[0].published = false;
  h.replace(seed);
  assert.equal((await h.store.readContent()).creators[0].name, 'First stored creator');
  seed.creators[0].name = 'Newest stored creator';
  h.replace(seed);
  const latest = await h.store.readContent();
  assert.equal(latest.creators[0].name, 'Newest stored creator');
  assert.equal(h.store.publicContent(latest).creators.some(item => item.id === seed.creators[0].id), false, 'drafts stay out of public content');
  for (const call of h.calls.get) {
    assert.equal(call.pathname, contentPath);
    assert.equal(call.options.access, 'private');
    assert.equal(call.options.useCache, false);
    assert.equal(call.options.token, token);
    assert.equal(new Headers(call.options.headers).get('accept-encoding'), 'identity');
  }
  assert.deepEqual(h.calls.disk, []);
});

test('first save creates one private content blob without permitting overwrite', async () => {
  const h = harness();
  const next = await h.store.readContent();
  next.creators[0].bio = 'Saved in durable storage.';
  const saved = await h.store.saveContent(next);
  assert.notEqual(saved.revision, 'initial');
  assert.equal((await h.store.readContent()).creators[0].bio, next.creators[0].bio);
  const call = h.calls.put[0];
  assert.equal(call.pathname, contentPath);
  assert.equal(call.options.access, 'private');
  assert.equal(call.options.contentType, 'application/json');
  assert.equal(call.options.token, token);
  assert.equal(call.options.addRandomSuffix, false);
  assert.equal(call.options.allowOverwrite, false);
  assert.equal(call.options.ifMatch, undefined);
  assert.equal(JSON.parse(call.body).revision, saved.revision);
  assert.deepEqual(h.calls.disk, []);
});

test('conditional updates preserve revision checks and reject stale editors before writing', async () => {
  const h = harness();
  const seed = await h.store.readContent();
  const first = await h.store.saveContent(seed);
  const snapshot = h.stored();
  const next = structuredClone(first);
  next.creators[0].bio = 'Updated safely';
  const second = await h.store.saveContent(next);
  assert.equal(h.calls.put[1].options.ifMatch, snapshot.etag);
  assert.equal(h.calls.put[1].options.allowOverwrite, true);
  assert.notEqual(second.revision, first.revision);
  await assert.rejects(h.store.saveContent(first), error => error.status === 409);
  assert.equal(h.calls.put.length, 2);
  assert.equal(h.stored().content.revision, second.revision);
  assert.deepEqual(h.calls.disk, []);
});

test('featured and published changes save successively using the strong ETag from the same identity read', async () => {
  const seed = harness().initial;
  const h = harness({ stored: seed });
  const compressed = await h.blob.get(contentPath, { access: 'private', useCache: false });
  assert.equal(compressed.headers.get('content-encoding'), 'br');
  assert.equal(compressed.headers.get('etag'), `W/${h.stored().etag}`);
  assert.notEqual(compressed.blob.etag, h.stored().etag, 'compressed GET ETags cannot authorize object writes');
  await compressed.stream.cancel();

  const original = await h.store.readContent();
  const first = structuredClone(original);
  first.creators[0].featured = !original.creators[0].featured;
  const beforeFirstSave = h.stored();
  const featuredSaved = await h.store.saveContent(first);
  assert.notEqual(featuredSaved.revision, original.revision);
  assert.equal(featuredSaved.creators[0].featured, first.creators[0].featured);
  assert.equal(h.calls.put[0].options.ifMatch, beforeFirstSave.etag);

  const second = structuredClone(featuredSaved);
  second.creators[0].published = !featuredSaved.creators[0].published;
  const beforeSecondSave = h.stored();
  const publishedSaved = await h.store.saveContent(second);
  assert.notEqual(publishedSaved.revision, featuredSaved.revision);
  assert.equal(publishedSaved.creators[0].featured, first.creators[0].featured);
  assert.equal(publishedSaved.creators[0].published, second.creators[0].published);
  assert.equal(h.calls.put[1].options.ifMatch, beforeSecondSave.etag);
  assert.deepEqual(structuredClone(await h.store.readContent()), structuredClone(publishedSaved));

  await assert.rejects(h.store.saveContent(featuredSaved), error => error.status === 409);
  assert.equal(h.calls.put.length, 2, 'a genuinely stale editor cannot overwrite either successful change');
  assert.equal(h.stored().content.revision, publishedSaved.revision);
  for (const call of h.calls.get.slice(1)) {
    assert.equal(new Headers(call.options.headers).get('accept-encoding'), 'identity');
  }
});

test('two workers starting from the seed cannot both create content', async () => {
  const h = harness();
  const first = structuredClone(h.initial);
  const second = structuredClone(h.initial);
  first.creators[0].bio = 'First writer';
  second.creators[0].bio = 'Second writer';
  const results = await Promise.allSettled([h.store.saveContent(first), h.store.saveContent(second)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  assert.equal(h.calls.put.length, 2, 'both read a missing blob before storage arbitrates the create');
  assert.ok(h.calls.put.every(call => call.options.allowOverwrite === false));
  const winner = results.find(result => result.status === 'fulfilled').value;
  assert.equal(h.stored().content.revision, winner.revision);
});

test('two workers updating the same ETag cannot overwrite one another', async () => {
  const seed = harness().initial;
  const h = harness({ stored: seed });
  const first = structuredClone(seed);
  const second = structuredClone(seed);
  first.creators[0].bio = 'First writer';
  second.creators[0].bio = 'Second writer';
  const results = await Promise.allSettled([h.store.saveContent(first), h.store.saveContent(second)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  assert.equal(h.calls.put.length, 2);
  assert.ok(h.calls.put.every(call => call.options.ifMatch === '"etag-1"'));
  assert.equal(h.stored().content.revision, results.find(result => result.status === 'fulfilled').value.revision);
});

test('Blob-backed media replacements are inspected before saving and invalid uploads prevent writes', async () => {
  const h = harness();
  const next = structuredClone(h.initial);
  const filename = `${randomUUID()}.png`;
  next.creators[0].image = `/api/media/${filename}`;
  await h.store.saveContent(next);
  assert.equal(h.calls.media.length, 1);
  assert.equal(h.calls.media[0].filename, filename);
  assert.equal(h.calls.media[0].kind, 'image');
  assert.deepEqual(h.calls.disk, []);

  const rejected = harness({ mediaError: new Error('Upload signature is invalid') });
  await assert.rejects(rejected.store.saveContent(next), /signature is invalid/);
  assert.equal(rejected.calls.put.length, 0);
  const wrongKind = structuredClone(rejected.initial);
  wrongKind.creators[0].image = `/api/media/${randomUUID()}.mp4`;
  await assert.rejects(rejected.store.saveContent(wrongKind), error => error.status === 400 && /uploaded image/.test(error.message));
  assert.equal(rejected.calls.media.length, 1, 'wrong media kinds are rejected before Blob inspection');
});

test('unreadable snapshots and unrelated storage failures never report successful saves', async () => {
  const h = harness();
  h.blob.get = async () => ({ statusCode: 200, blob: { etag: '' }, stream: new Response('{}').body });
  await assert.rejects(h.store.saveContent(h.initial), error => error.status === 503);
  assert.equal(h.calls.put.length, 0, 'missing ETag must not allow unconditional overwrite');
  h.blob.get = async () => ({ statusCode: 200, blob: { etag: 'etag' }, stream: new Response('{').body });
  await assert.rejects(h.store.saveContent(h.initial), error => error.name === 'SyntaxError');
  assert.equal(h.calls.put.length, 0);

  const failure = new BlobError('Storage is unavailable');
  const unavailable = harness({ putError: failure });
  await assert.rejects(unavailable.store.saveContent(unavailable.initial), error => error === failure);
  assert.equal(unavailable.stored(), null);
});
