import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { v2 as cloudinary } from 'cloudinary';

const require = createRequire(import.meta.url);
const workspace = path.resolve(import.meta.dirname, '..');
const filename = '12345678-1234-1234-1234-123456789abc.png';
const videoFilename = filename.replace('.png', '.mp4');
const cloud = 'test-cloud';
const secret = 'a-cloudinary-server-only-secret';
const filenamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|mp4|webm)$/;
const cdnURL = (name = filename, folder = 'vivid') => `https://res.cloudinary.com/${cloud}/${/\.(mp4|webm)$/.test(name) ? 'video' : 'image'}/upload/v123/${folder}/media/${name}`;

function harness({ authenticated = true, environment = {}, validationError } = {}) {
  const env = {
    VERCEL: '1', CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: secret,
    VIVID_ADMIN_PASSWORD: 'a private test password', VIVID_SESSION_SECRET: 'a private test signing secret of sufficient length', ...environment,
  };
  const calls = [];
  const cache = new Map();
  let session;
  let configuration = {};
  const sdk = {
    config(options) { if (options) configuration = { ...configuration, ...options }; return configuration; },
    utils: { api_sign_request(parameters, apiSecret) { calls.push({ method: 'sign', parameters }); return cloudinary.utils.api_sign_request(parameters, apiSecret); } },
  };
  const media = {
    MEDIA_FILENAME: filenamePattern,
    cloudinaryMediaId(name) {
      if (!filenamePattern.test(name)) throw new (load('src/lib/content-validation.ts').ContentError)('Choose a valid uploaded image or video.');
      return `${env.VIVID_CLOUDINARY_FOLDER || 'vivid'}/media/${name.slice(0, name.lastIndexOf('.'))}`;
    },
    async validateCloudinaryMedia(url, kind) {
      calls.push({ method: 'validate', url, kind });
      if (validationError) throw new (load('src/lib/content-validation.ts').ContentError)(validationError.message, validationError.status || 400);
      if (!url.startsWith(`https://res.cloudinary.com/${cloud}/`) || !url.includes('/upload/v123/')) throw new (load('src/lib/content-validation.ts').ContentError)('Choose an uploaded image or video.');
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
      if (id === 'cloudinary') return { v2: sdk };
      if (id.endsWith('/cloudinary-media')) return media;
      if (id.endsWith('/content')) return { mediaDirectory: () => path.join(workspace, '.data', 'media') };
      if (id === 'next/headers') return { cookies: async () => ({ get: () => session ? { value: session } : undefined }) };
      if (id.startsWith('.')) return load(path.relative(workspace, path.resolve(path.dirname(resolved), `${id}.ts`)));
      return require(id);
    };
    vm.runInNewContext(code, { exports, require: localRequire, Buffer, URL, Response, Request, Headers, File, FormData, ReadableStream, structuredClone, Date, setTimeout, console, process: { env, cwd: () => workspace } }, { filename: resolved });
    return exports;
  }
  if (authenticated) session = load('src/lib/admin-auth.ts').createSession();
  const route = load('app/api/admin/upload/route.ts');
  const post = (body, origin = 'https://vivid.example') => route.POST(new Request('https://vivid.example/api/admin/upload', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  return { route, post, calls };
}

test('signed Cloudinary uploads authenticate the admin, bind one format and media asset, and prohibit overwrites', async () => {
  const { route, post, calls } = harness();
  assert.deepEqual(await (await route.GET()).json(), { mode: 'cloudinary' });
  for (const [name, kind, format] of [[filename, 'image', 'png'], [videoFilename, 'video', 'mp4']]) {
    const response = await post({ type: 'vivid.upload-authorize', filename: name });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json();
    assert.equal(data.uploadUrl, `https://api.cloudinary.com/v1_1/${cloud}/${kind}/upload`);
    const { signature, api_key, ...parameters } = data.fields;
    assert.equal(api_key, 'test-key');
    assert.equal(parameters.public_id, `vivid/media/${name.slice(0, name.lastIndexOf('.'))}`);
    assert.equal(parameters.allowed_formats, format);
    assert.equal(parameters.overwrite, false);
    assert.equal(parameters.type, 'upload');
    assert.ok(Math.abs(parameters.timestamp - Math.floor(Date.now() / 1000)) <= 1);
    assert.equal(signature, cloudinary.utils.api_sign_request(parameters, secret));
    assert.ok(!JSON.stringify(data).includes(secret));
  }
  assert.equal(calls.filter(call => call.method === 'sign').length, 2);
});

test('authorization rejects anonymous, cross-site, invalid and non-media paths before signing', async () => {
  const anonymous = harness({ authenticated: false });
  assert.equal((await anonymous.route.GET()).status, 401);
  assert.equal((await anonymous.post({ type: 'vivid.upload-authorize', filename })).status, 401);
  assert.equal(anonymous.calls.length, 0);
  const h = harness();
  assert.equal((await h.post({ type: 'vivid.upload-authorize', filename }, 'https://foreign.example')).status, 403);
  for (const invalid of ['vivid/content.json', `../${filename}`, 'unsafe.svg', 'https://foreign.example/file.png', '', 'vivid/media/' + filename]) {
    assert.equal((await h.post({ type: 'vivid.upload-authorize', filename: invalid })).status, 400);
  }
  for (const body of [null, [], {}, { type: 'unknown' }, { type: 'vivid.upload-authorize' }, { type: 'vivid.upload-complete' }]) {
    assert.equal((await h.post(body)).status, 400);
  }
  assert.equal((await h.post({ type: 'unknown', payload: 'x'.repeat(17 * 1024) })).status, 413);
  assert.equal(h.calls.length, 0);
});

test('Vercel without Cloudinary reports a configuration failure and local mode remains available on persistent servers', async () => {
  const environment = { CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '' };
  const missing = harness({ environment });
  const response = await missing.route.GET();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Cloudinary/i);
  assert.equal((await missing.post({ type: 'vivid.upload-authorize', filename })).status, 503);
  assert.deepEqual(await (await harness({ environment: { ...environment, VERCEL: '' } }).route.GET()).json(), { mode: 'local' });
  assert.deepEqual(await (await harness({ environment: { VERCEL: '', VIVID_STORAGE_MODE: 'local' } }).route.GET()).json(), { mode: 'local' });
});

test('completion verifies the exact stored image or video before returning its CDN URL', async () => {
  const h = harness();
  for (const name of [filename, videoFilename]) {
    const url = cdnURL(name);
    const response = await h.post({ type: 'vivid.upload-complete', filename: name, url });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { url });
    assert.deepEqual(h.calls.at(-1), { method: 'validate', url, kind: name === filename ? 'image' : 'video' });
  }
  for (const url of ['https://foreign.example/file.png', cdnURL().replace(filename, 'another.png'), cdnURL().replace('.png', '.mp4'), 'not a URL']) {
    assert.equal((await h.post({ type: 'vivid.upload-complete', filename, url })).status, 400);
  }
  assert.equal((await h.post({ type: 'vivid.upload-complete', filename, url: cdnURL().replace(cloud, 'another-cloud') })).status, 400);
});

test('failed asset inspection and size limits never produce a successful completion', async () => {
  for (const validationError of [
    { message: 'This upload is unavailable. Please upload the file again.' },
    { message: 'The file contents must match its type.' },
    { message: 'Choose an image of 10 MB or less.', status: 413 },
  ]) {
    const h = harness({ validationError });
    const response = await h.post({ type: 'vivid.upload-complete', filename, url: cdnURL() });
    assert.equal(response.status, validationError.status || 400);
    assert.equal((await response.json()).error, validationError.message);
  }
});

test('separate Cloudinary folders scope preview uploads away from production assets', async () => {
  const h = harness({ environment: { VIVID_CLOUDINARY_FOLDER: 'vivid-preview' } });
  const authorization = await (await h.post({ type: 'vivid.upload-authorize', filename })).json();
  assert.match(authorization.fields.public_id, /^vivid-preview\/media\//);
  const response = await h.post({ type: 'vivid.upload-complete', filename, url: cdnURL(filename, 'vivid-preview') });
  assert.equal(response.status, 201);
  assert.equal((await h.post({ type: 'vivid.upload-complete', filename, url: cdnURL() })).status, 400);
});
