import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as blobSdk from '@vercel/blob';
import { getPayloadFromClientToken } from '@vercel/blob/client';

const require = createRequire(import.meta.url);
const workspace = path.resolve(import.meta.dirname, '..');
const filename = '12345678-1234-1234-1234-123456789abc.png';
const videoFilename = filename.replace('.png', '.mp4');
const token = 'vercel_blob_rw_teststore_testcredential';
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const video = Buffer.from([0, 0, 0, 12, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, ...Array.from({ length: 60 }, (_, i) => i)]);

function harness({ authenticated = true, environment = {}, objects, ignoreRange = false } = {}) {
  const env = { VERCEL: '1', BLOB_READ_WRITE_TOKEN: token, VIVID_ADMIN_PASSWORD: 'a private test password', VIVID_SESSION_SECRET: 'a private test signing secret of sufficient length', ...environment };
  const stored = objects || new Map([
    [`vivid/media/${filename}`, { bytes: png, type: 'image/png', size: png.length }],
    [`vivid/media/${videoFilename}`, { bytes: video, type: 'video/mp4', size: video.length }],
  ]);
  const calls = [];
  const cache = new Map();
  let session;
  const sdk = {
    ...blobSdk,
    async issueSignedToken(options) {
      calls.push({ method: 'issueSignedToken', options });
      const scope = { ...options, storeId: 'teststore' };
      delete scope.token;
      return {
        delegationToken: `${Buffer.from(JSON.stringify(scope)).toString('base64url')}.signature`,
        clientSigningToken: Buffer.alloc(32, 7).toString('base64url'),
        validUntil: options.validUntil,
      };
    },
    async presignUrl(signedToken, options) {
      calls.push({ method: 'presignUrl', options });
      return blobSdk.presignUrl(signedToken, options);
    },
    async head(pathname, options) {
      calls.push({ method: 'head', pathname, options });
      const object = stored.get(pathname);
      if (!object) throw new blobSdk.BlobNotFoundError();
      return { pathname, size: object.size, contentType: object.type };
    },
    async get(pathname, options) {
      calls.push({ method: 'get', pathname, options });
      const object = stored.get(pathname);
      if (!object) return null;
      let bytes = object.bytes;
      const headers = new Headers();
      const range = /^bytes=(\d+)-(\d+)$/.exec(options.headers?.Range || '');
      if (range && !ignoreRange) {
        const end = Math.min(Number(range[2]), bytes.length - 1);
        headers.set('Content-Range', `bytes ${range[1]}-${end}/${object.size}`);
        bytes = bytes.subarray(Number(range[1]), end + 1);
      }
      return { statusCode: 200, headers, stream: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }), blob: { size: bytes.length } };
    },
  };
  function load(relative) {
    const resolved = path.resolve(workspace, relative);
    if (cache.has(resolved)) return cache.get(resolved);
    const exports = {};
    cache.set(resolved, exports);
    const code = ts.transpileModule(readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const localRequire = id => {
      if (id === 'server-only') return {};
      if (id === '@vercel/blob') return sdk;
      if (id === 'next/headers') return { cookies: async () => ({ get: () => session ? { value: session } : undefined }) };
      if (id.startsWith('.')) return load(path.relative(workspace, path.resolve(path.dirname(resolved), `${id}.ts`)));
      return require(id);
    };
    vm.runInNewContext(code, { exports, require: localRequire, Buffer, URL, Response, Request, Headers, ReadableStream, structuredClone, setTimeout, console, process: { env, cwd: () => workspace } }, { filename: resolved });
    return exports;
  }
  if (authenticated) session = load('src/lib/admin-auth.ts').createSession();
  const route = load('app/api/admin/upload/route.ts');
  const mediaRoute = load('app/api/media/[filename]/route.ts');
  const post = (body, origin = 'https://vivid.example') => route.POST(new Request('https://vivid.example/api/admin/upload', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  return { route, mediaRoute, media: load('src/lib/blob-media.ts'), post, calls, stored };
}

test('direct upload tokens authenticate the admin, constrain one media path, prohibit overwrites and enforce app limits', async () => {
  const { route, post } = harness();
  assert.deepEqual(await (await route.GET()).json(), { mode: 'blob' });
  for (const [name, mime, size] of [[filename, 'image/png', 10 * 1024 * 1024], [videoFilename, 'video/mp4', 100 * 1024 * 1024]]) {
    const response = await post({ type: 'blob.generate-client-token', payload: { pathname: `vivid/media/${name}`, multipart: true, clientPayload: null } });
    assert.equal(response.status, 200);
    const data = await response.json();
    const decoded = getPayloadFromClientToken(data.clientToken);
    assert.equal(decoded.pathname, `vivid/media/${name}`);
    assert.deepEqual(decoded.allowedContentTypes, [mime]);
    assert.equal(decoded.maximumSizeInBytes, size);
    assert.equal(decoded.allowOverwrite, false);
    assert.equal(decoded.addRandomSuffix, false);
    assert.ok(decoded.validUntil > Date.now() && decoded.validUntil <= Date.now() + 10 * 60_000);
    assert.equal(decoded.onUploadCompleted, undefined, 'confirmation comes from the studio without a webhook race');
    assert.ok(!data.clientToken.includes(token), 'the server read-write token never reaches the browser');
  }
  assert.equal((await harness({ authenticated: false }).post({ type: 'blob.generate-client-token', payload: { pathname: `vivid/media/${filename}` } })).status, 401);
  assert.equal((await post({ type: 'blob.generate-client-token', payload: { pathname: `vivid/media/${filename}` } }, 'https://foreign.example')).status, 403);
});

test('OIDC authorizes a private signed PUT scoped to one file with app size and type limits', async () => {
  const { post, calls } = harness({ environment: { BLOB_READ_WRITE_TOKEN: '', BLOB_STORE_ID: 'store_teststore' } });
  for (const [name, mime, size] of [[filename, 'image/png', 10 * 1024 * 1024], [videoFilename, 'video/mp4', 100 * 1024 * 1024]]) {
    const response = await post({ type: 'vivid.upload-authorize', filename: name });
    assert.equal(response.status, 200);
    const data = await response.json();
    const url = new URL(data.uploadUrl);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'vercel.com');
    assert.equal(url.pathname, '/api/blob/');
    assert.equal(url.searchParams.get('pathname'), `vivid/media/${name}`);
    const issue = calls.filter(call => call.method === 'issueSignedToken').at(-1).options;
    assert.equal(issue.storeId, 'store_teststore');
    assert.equal(issue.token, undefined);
    assert.equal(issue.oidcToken, undefined);
    assert.deepEqual(Array.from(issue.operations), ['put']);
    assert.equal(issue.pathname, `vivid/media/${name}`);
    assert.deepEqual(Array.from(issue.allowedContentTypes), [mime]);
    assert.equal(issue.maximumSizeInBytes, size);
    assert.ok(issue.validUntil > Date.now() && issue.validUntil <= Date.now() + 10 * 60_000);
    const signing = calls.filter(call => call.method === 'presignUrl').at(-1).options;
    assert.equal(signing.access, 'private');
    assert.equal(signing.operation, 'put');
    assert.equal(signing.allowOverwrite, false);
    assert.equal(signing.addRandomSuffix, false);
    assert.ok(!data.uploadUrl.includes(token));
    assert.ok(!data.uploadUrl.includes(Buffer.alloc(32, 7).toString('base64url')), 'signing material stays on the server');
  }
});

test('signed authorization rejects anonymous, cross-site, invalid and non-media requests before issuing credentials', async () => {
  const anonymous = harness({ authenticated: false });
  assert.equal((await anonymous.post({ type: 'vivid.upload-authorize', filename })).status, 401);
  assert.ok(!anonymous.calls.some(call => call.method === 'issueSignedToken'));
  const { post, calls } = harness();
  assert.equal((await post({ type: 'vivid.upload-authorize', filename }, 'https://foreign.example')).status, 403);
  for (const invalid of ['vivid/content.json', '../' + filename, 'unsafe.svg', 'https://foreign.example/file.png', '']) {
    assert.equal((await post({ type: 'vivid.upload-authorize', filename: invalid })).status, 400);
  }
  assert.equal((await post({ type: 'vivid.upload-authorize' })).status, 400);
  assert.ok(!calls.some(call => call.method === 'issueSignedToken'));
});

test('token requests cannot write content, escape the media directory, or accept malformed bodies', async () => {
  const { post } = harness();
  for (const pathname of ['vivid/content.json', `vivid/media/../${filename}`, `https://foreign.example/${filename}`, 'vivid/media/unsafe.svg', '/vivid/media/' + filename]) {
    assert.equal((await post({ type: 'blob.generate-client-token', payload: { pathname } })).status, 400);
  }
  for (const body of [null, {}, { type: 'unknown' }, { type: 'blob.generate-client-token' }, { type: 'vivid.upload-complete' }]) assert.equal((await post(body)).status, 400);
  const oversized = await post({ type: 'unknown', value: 'x'.repeat(17 * 1024) });
  assert.equal(oversized.status, 413);
});

test('Vercel without storage reports configuration failure instead of writing ephemeral disk', async () => {
  const { route, post } = harness({ environment: { BLOB_READ_WRITE_TOKEN: '' } });
  const response = await route.GET();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /private Vercel Blob store/);
  assert.equal((await post({ type: 'vivid.upload-complete', filename })).status, 503);
  assert.deepEqual(await (await harness({ environment: { VERCEL: '', BLOB_READ_WRITE_TOKEN: '' } }).route.GET()).json(), { mode: 'local' });
});

test('completion confirms stored type, nonempty size and signature using only a short private read', async () => {
  const { post, calls } = harness();
  const response = await post({ type: 'vivid.upload-complete', filename });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { url: `/api/media/${filename}` });
  const read = calls.find(call => call.method === 'get');
  assert.equal(read.pathname, `vivid/media/${filename}`);
  assert.equal(read.options.token, token);
  assert.equal(read.options.access, 'private');
  assert.equal(read.options.useCache, false);
  assert.equal(read.options.headers.Range, 'bytes=0-15');
  for (const object of [
    { bytes: Buffer.from('fake PNG'), type: 'image/png', size: 8 },
    { bytes: png, type: 'image/jpeg', size: png.length },
    { bytes: png, type: 'image/png', size: 0 },
  ]) {
    const testHarness = harness({ objects: new Map([[`vivid/media/${filename}`, object]]) });
    assert.equal((await testHarness.post({ type: 'vivid.upload-complete', filename })).status, 400);
  }
  const tooLarge = harness({ objects: new Map([[`vivid/media/${filename}`, { bytes: png, type: 'image/png', size: 10 * 1024 * 1024 + 1 }]]) });
  assert.equal((await tooLarge.post({ type: 'vivid.upload-complete', filename })).status, 413);
  assert.ok(!tooLarge.calls.some(call => call.method === 'get'));
  assert.equal((await post({ type: 'vivid.upload-complete', filename: '00000000-0000-0000-0000-000000000000.png' })).status, 400);
  await assert.rejects(harness().media.validateBlobMedia(videoFilename, 'image'), /uploaded image/);
});

test('private media streams intact and supports HEAD, video ranges and invalid-range responses', async () => {
  const { mediaRoute, calls } = harness();
  const context = { params: Promise.resolve({ filename: videoFilename }) };
  const url = `https://vivid.example/api/media/${videoFilename}`;
  const head = await mediaRoute.HEAD(new Request(url), context);
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), String(video.length));
  assert.equal(head.headers.get('content-type'), 'video/mp4');
  assert.equal(head.headers.get('accept-ranges'), 'bytes');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.ok(!calls.some(call => call.method === 'get'));
  const full = await mediaRoute.GET(new Request(url), context);
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), video);
  for (const [range, start, end] of [['bytes=0-15', 0, 15], ['bytes=-10', video.length - 10, video.length - 1], ['bytes=20-', 20, video.length - 1]]) {
    const response = await mediaRoute.GET(new Request(url, { headers: { Range: range } }), context);
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${video.length}`);
    assert.equal(response.headers.get('content-length'), String(end - start + 1));
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), video.subarray(start, end + 1));
  }
  for (const range of ['bytes=9999-', 'bytes=-0', 'bytes=2-1', 'bytes=0-1,3-4']) assert.equal((await mediaRoute.GET(new Request(url, { headers: { Range: range } }), context)).status, 416);
  assert.equal((await mediaRoute.GET(new Request(url), { params: Promise.resolve({ filename: 'unsafe.svg' }) })).status, 404);
});

test('range streaming stays correct when an upstream store ignores the Range header', async () => {
  const { mediaRoute } = harness({ ignoreRange: true });
  const response = await mediaRoute.GET(new Request('https://vivid.example/api/media/video', { headers: { Range: 'bytes=20-29' } }), { params: Promise.resolve({ filename: videoFilename }) });
  assert.equal(response.status, 206);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), video.subarray(20, 30));
});
